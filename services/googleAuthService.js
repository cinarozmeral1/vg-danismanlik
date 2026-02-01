/**
 * Google OAuth Service
 * Handles Google authentication for both registration and login
 */

const { OAuth2Client } = require('google-auth-library');
const pool = require('../config/database');
const { generateUserToken } = require('../middleware/auth');

// Google OAuth Client
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Verify Google ID Token
 * @param {string} token - Google ID token from client
 * @returns {Object} - Decoded user info
 */
async function verifyGoogleToken(token) {
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        
        return {
            success: true,
            user: {
                google_id: payload.sub,
                email: payload.email,
                email_verified: payload.email_verified,
                first_name: payload.given_name || '',
                last_name: payload.family_name || '',
                picture: payload.picture || null,
                locale: payload.locale || 'tr'
            }
        };
    } catch (error) {
        console.error('Google token verification failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Handle Google Sign In/Sign Up (Smart Logic)
 * If user exists -> Login
 * If user doesn't exist -> Register and Login
 * 
 * @param {string} googleToken - Google ID token
 * @param {Object} options - Additional options (wizard_recommendation_id, language)
 * @returns {Object} - Result with user data and JWT token
 */
async function handleGoogleAuth(googleToken, options = {}) {
    const { language = 'tr', wizard_recommendation_id = null } = options;
    
    try {
        // 1. Verify Google token
        const verification = await verifyGoogleToken(googleToken);
        
        if (!verification.success) {
            return {
                success: false,
                message: language === 'tr' ? 'Google doğrulama hatası' : 'Google verification failed'
            };
        }
        
        const googleUser = verification.user;
        
        // 2. Check if user exists by google_id OR email
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE google_id = $1 OR email = $2 LIMIT 1',
            [googleUser.google_id, googleUser.email]
        );
        
        let user;
        let isNewUser = false;
        
        if (existingUser.rows.length > 0) {
            // User exists - update google_id if not set and login
            user = existingUser.rows[0];
            
            // Update google_id if user registered via email but now using Google
            if (!user.google_id) {
                await pool.query(
                    'UPDATE users SET google_id = $1 WHERE id = $2',
                    [googleUser.google_id, user.id]
                );
            }
            
            // Update last login
            await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
            
        } else {
            // New user - create account
            isNewUser = true;
            
            // Generate placeholder values for required fields (user will fill later)
            // Use unique values to avoid constraint violations
            const randomNum = Math.floor(Math.random() * 90000000000) + 10000000000;
            const uniqueTc = randomNum.toString().slice(0, 11);
            const uniquePhone = '5' + Math.floor(Math.random() * 900000000 + 100000000).toString();
            const placeholderDate = '2000-01-01';
            
            const result = await pool.query(`
                INSERT INTO users (
                    google_id,
                    email,
                    first_name,
                    last_name,
                    tc_number,
                    phone,
                    password_hash,
                    english_level,
                    high_school_graduation_date,
                    birth_date,
                    email_verified,
                    registered_via,
                    personal_info_completed,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
                RETURNING *
            `, [
                googleUser.google_id,
                googleUser.email,
                googleUser.first_name,
                googleUser.last_name,
                uniqueTc, // Placeholder tc_number - user will fill later
                uniquePhone, // Placeholder phone - user will fill later
                'GOOGLE_AUTH_NO_PASSWORD', // Marker for Google users
                'Belirtilmedi', // Placeholder english_level
                placeholderDate, // Placeholder graduation date
                placeholderDate, // Placeholder birth date
                1, // Google users are automatically verified
                'google',
                false // Personal info not completed yet
            ]);
            
            user = result.rows[0];
            
            // Initialize default checklist for new user
            const defaultChecklistItems = [
                'Her okul için niyet mektubu hazırlandı ve sisteme yüklendi.',
                'CV düzenlendi ve sisteme yüklendi.',
                'Referans mektupları alındı ve sisteme yüklendi.',
                'Danışmanlık Ücreti ödendi.',
                'Üniversite kayıt ücretleri ödendi.',
                'Okullar tarafından düzenlenen video mülakat denemeleri ve genel deneme mülakatları tamamlandı.',
                'Öğrenci kayıt ücretlerinin iade süreçleri için doktor ve okul raporları gerekli formatta hazırlandı.',
                'Danışmanlık ücretinin iade süreçleri için gerekli belgeler sisteme yüklendi.',
                'Kabul alınan okullar listelendi ve aralarından seçim yapıldı.',
                'Finansal durumu kanıtlayan ve vize için gerekli olan belgeler sisteme yüklendi.',
                'Üniversite başvurusu için gerekli yazılı belgeler eklendi.',
                'Apostil ve çeviri gereken vize için gerekli belgeler sisteme yüklendi.'
            ];
            
            for (const item of defaultChecklistItems) {
                await pool.query(
                    `INSERT INTO checklist_items (user_id, item_name, is_completed) VALUES ($1, $2, false)`,
                    [user.id, item]
                );
            }
        }
        
        // 3. If there's a wizard recommendation, link it to this user
        if (wizard_recommendation_id) {
            try {
                await pool.query(
                    'UPDATE ai_recommendations SET user_id = $1 WHERE id = $2 AND user_id IS NULL',
                    [user.id, wizard_recommendation_id]
                );
                console.log(`📎 Linked wizard recommendation ${wizard_recommendation_id} to user ${user.id}`);
            } catch (err) {
                console.warn('Could not link wizard recommendation:', err.message);
            }
        }
        
        // 4. Generate JWT token
        const token = generateUserToken(user.id);
        
        return {
            success: true,
            message: isNewUser 
                ? (language === 'tr' ? 'Kayıt başarılı! Hoş geldiniz.' : 'Registration successful! Welcome.')
                : (language === 'tr' ? 'Giriş başarılı!' : 'Login successful!'),
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                is_admin: user.is_admin || false,
                email_verified: user.email_verified,
                registered_via: user.registered_via || 'email',
                personal_info_completed: user.personal_info_completed || false
            },
            token,
            is_new_user: isNewUser,
            needs_personal_info: !user.personal_info_completed
        };
        
    } catch (error) {
        console.error('Google auth error:', error);
        return {
            success: false,
            message: language === 'tr' ? 'Bir hata oluştu' : 'An error occurred',
            error_detail: error.message,
            error_code: error.code
        };
    }
}

module.exports = {
    verifyGoogleToken,
    handleGoogleAuth
};

