const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { generateUserToken, generatePartnerToken } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail, sendPartnerVerificationEmail, sendNewStudentNotificationEmail, generateVerificationToken, generateResetToken } = require('../services/emailService');
const { handleGoogleAuth } = require('../services/googleAuthService');

const router = express.Router();

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.trim() : '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ? process.env.GOOGLE_CLIENT_SECRET.trim() : '';
// Hardcoded redirect URI to avoid NODE_ENV issues
const GOOGLE_REDIRECT_URI = 'https://vgdanismanlik.com/api/auth/google/callback';

// =====================================================
// GOOGLE OAUTH - SERVER-SIDE REDIRECT FLOW
// =====================================================
// Helper function to format phone number with space after country code
function formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Tüm boşlukları kaldır
    const cleaned = phone.replace(/\s+/g, '');
    
    if (!cleaned.startsWith('+')) {
        return phone;
    }
    
    // Bilinen ülke kodları (uzundan kısaya sıralı - önce 3 haneli, sonra 2, sonra 1)
    const countryCodes = [
        '+420', // Çekya
        '+380', // Ukrayna
        '+371', // Letonya
        '+370', // Litvanya
        '+372', // Estonya
        '+90',  // Türkiye
        '+49',  // Almanya
        '+44',  // İngiltere
        '+43',  // Avusturya
        '+39',  // İtalya
        '+48',  // Polonya
        '+36',  // Macaristan
        '+31',  // Hollanda
        '+33',  // Fransa
        '+34',  // İspanya
        '+41',  // İsviçre
        '+32',  // Belçika
        '+30',  // Yunanistan
        '+45',  // Danimarka
        '+46',  // İsveç
        '+47',  // Norveç
        '+351', // Portekiz
        '+352', // Lüksemburg
        '+353', // İrlanda
        '+358', // Finlandiya
        '+1',   // ABD/Kanada
        '+7',   // Rusya
    ];
    
    // Bilinen ülke kodlarını kontrol et
    for (const code of countryCodes) {
        if (cleaned.startsWith(code)) {
            const number = cleaned.substring(code.length);
            return code + ' ' + number;
        }
    }
    
    // Bilinmeyen ülke kodu - 2 hane varsay (çoğu ülke 2 haneli)
    const match = cleaned.match(/^(\+\d{2})(\d+)$/);
        if (match) {
            return match[1] + ' ' + match[2];
        }
    
    return phone;
}

router.get('/google/redirect', (req, res) => {
    const { action = 'login', wizard_rec, phone, english_level, first_name, last_name, tc_number } = req.query;
    
    // Store action in cookie for callback
    res.cookie('google_auth_action', action, { 
        maxAge: 10 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
    
    // Store first_name if provided
    if (first_name) {
        res.cookie('google_auth_first_name', first_name, { 
            maxAge: 10 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        console.log('👤 Storing first_name for registration:', first_name);
    }
    
    // Store last_name if provided
    if (last_name) {
        res.cookie('google_auth_last_name', last_name, { 
            maxAge: 10 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        console.log('👤 Storing last_name for registration:', last_name);
    }
    
    // Store tc_number if provided
    if (tc_number) {
        res.cookie('google_auth_tc_number', tc_number, { 
            maxAge: 10 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        console.log('🆔 Storing tc_number for registration:', tc_number);
    }
    
    // Store wizard recommendation ID if provided
    if (wizard_rec) {
        res.cookie('wizard_recommendation_id', wizard_rec, { 
            maxAge: 10 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        console.log('📎 Storing wizard recommendation:', wizard_rec);
    }
    
    // Store phone number if provided (for Google registration)
    if (phone) {
        const formattedPhone = formatPhoneNumber(phone);
        res.cookie('google_auth_phone', formattedPhone, { 
            maxAge: 10 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        console.log('📱 Storing phone for registration:', formattedPhone);
    }
    
    // Store english level if provided
    if (english_level) {
        res.cookie('google_auth_english_level', english_level, { 
            maxAge: 10 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        console.log('📚 Storing english level for registration:', english_level);
    }
    
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');
    
    console.log('🔗 Google OAuth Debug:');
    console.log('   Client ID:', GOOGLE_CLIENT_ID.substring(0, 30) + '...');
    console.log('   Redirect URI:', GOOGLE_REDIRECT_URI);
    console.log('   Full URL:', googleAuthUrl.toString());
    res.redirect(googleAuthUrl.toString());
});

// Google OAuth Callback
router.get('/google/callback', async (req, res) => {
    const language = req.cookies.language || 'tr';
    
    try {
        const { code, error, error_description } = req.query;
        const action = req.cookies.google_auth_action || 'login';
        const wizardRecommendationId = req.cookies.wizard_recommendation_id || null;
        const phoneNumber = req.cookies.google_auth_phone || null;
        const englishLevel = req.cookies.google_auth_english_level || null;
        const firstName = req.cookies.google_auth_first_name || null;
        const lastName = req.cookies.google_auth_last_name || null;
        const tcNumber = req.cookies.google_auth_tc_number || null;
        
        console.log('📥 Google callback received');
        console.log('   Code:', code ? 'present' : 'missing');
        console.log('   Error:', error || 'none');
        console.log('   Action:', action);
        console.log('   Wizard Rec:', wizardRecommendationId || 'none');
        console.log('   First Name:', firstName || 'none');
        console.log('   Last Name:', lastName || 'none');
        console.log('   TC Number:', tcNumber || 'none');
        console.log('   Phone:', phoneNumber || 'none');
        console.log('   English Level:', englishLevel || 'none');
        
        // Clear cookies
        res.clearCookie('google_auth_action');
        res.clearCookie('wizard_recommendation_id');
        res.clearCookie('google_auth_phone');
        res.clearCookie('google_auth_english_level');
        res.clearCookie('google_auth_first_name');
        res.clearCookie('google_auth_last_name');
        res.clearCookie('google_auth_tc_number');
        
        if (error) {
            console.error('Google OAuth error:', error, error_description);
            return res.redirect(`/login?error=${encodeURIComponent(error_description || error)}`);
        }
        
        if (!code) {
            console.error('No code received');
            return res.redirect(`/login?error=${encodeURIComponent(language === 'tr' ? 'Yetkilendirme kodu alınamadı' : 'Authorization code not received')}`);
        }
        
        console.log('🔄 Exchanging code for tokens...');
        
        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });
        
        const tokenData = await tokenResponse.json();
        
        if (tokenData.error) {
            console.error('❌ Token exchange error:', tokenData);
            return res.redirect(`/login?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
        }
        
        console.log('✅ Got access token');
        
        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        
        const googleUser = await userInfoResponse.json();
        console.log('👤 Google user:', googleUser.email);
        
        // Check if user exists
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR google_id = $2',
            [googleUser.email, googleUser.id]
        );
        
        let user;
        let isNewUser = false;
        
        if (existingUser.rows.length > 0) {
            // Existing user - update google_id if needed and login
            user = existingUser.rows[0];
            
            // Update google_id and last_login_at
            await pool.query(
                'UPDATE users SET google_id = COALESCE(google_id, $1), last_login_at = NOW() WHERE id = $2',
                [googleUser.id, user.id]
            );
            
            console.log('✅ Existing user logged in:', user.email);
            
            // Link wizard recommendation if exists
            if (wizardRecommendationId) {
                try {
                    await pool.query(
                        'UPDATE ai_recommendations SET user_id = $1 WHERE id = $2 AND user_id IS NULL',
                        [user.id, wizardRecommendationId]
                    );
                    console.log('📎 Linked wizard recommendation', wizardRecommendationId, 'to user', user.id);
                } catch (linkErr) {
                    console.error('Failed to link wizard recommendation:', linkErr.message);
                }
            }
            
            // Generate JWT token (same as normal login)
            const token = generateUserToken(user.id);
            
            // Set cookie - SAME AS NORMAL LOGIN
            res.cookie('userToken', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });
            
            console.log('✅ Google login complete for:', user.email);
            return res.redirect('/user/dashboard');
        } else {
            // NEW USER - Redirect to complete registration page
            console.log('🆕 New Google user detected, redirecting to complete registration');
            console.log('   Email:', googleUser.email);
            console.log('   Google ID:', googleUser.id);
            
            // Store Google user info in cookies for registration page
            res.cookie('google_pending_email', googleUser.email, {
                maxAge: 30 * 60 * 1000, // 30 minutes
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax'
            });
            res.cookie('google_pending_id', googleUser.id, {
                maxAge: 30 * 60 * 1000,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax'
            });
            res.cookie('google_pending_name', googleUser.name || '', {
                maxAge: 30 * 60 * 1000,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax'
            });
            
            // Store wizard recommendation ID if exists
            if (wizardRecommendationId) {
                res.cookie('google_pending_wizard_rec', wizardRecommendationId, {
                    maxAge: 30 * 60 * 1000,
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax'
                });
            }
            
            return res.redirect('/complete-google-registration');
        }
        
    } catch (error) {
        console.error('❌ Google callback error:', error);
        res.redirect(`/login?error=${encodeURIComponent(language === 'tr' ? 'Google girişi başarısız: ' + error.message : 'Google sign-in failed: ' + error.message)}`);
    }
});

// =====================================================
// COMPLETE GOOGLE REGISTRATION
// Called from complete-google-registration page
// =====================================================
router.post('/complete-google-registration', async (req, res) => {
    const language = req.cookies.language || 'tr';
    
    try {
        const { first_name, last_name, tc_number, phone, english_level,
                desired_country, current_school, active_class,
                passport_type, passport_number, home_address } = req.body;
        
        // Get pending Google info from cookies
        const googleEmail = req.cookies.google_pending_email;
        const googleId = req.cookies.google_pending_id;
        const wizardRecommendationId = req.cookies.google_pending_wizard_rec;
        
        if (!googleEmail || !googleId) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Google oturum bilgisi bulunamadı. Lütfen tekrar deneyin.' : 'Google session not found. Please try again.'
            });
        }
        
        // Validate required fields
        if (!first_name || !last_name || !tc_number || !phone || !english_level) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Tüm alanları doldurun' : 'Please fill all fields'
            });
        }
        
        // Validate additional required fields
        if (!desired_country || !current_school || !active_class || !passport_type || !passport_number || !home_address) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Lütfen tüm zorunlu alanları doldurun (ülke, okul, sınıf, pasaport bilgileri, ev adresi)' : 'Please fill in all required fields (country, school, grade, passport info, home address)'
            });
        }
        
        // Validate TC number
        if (!/^\d{11}$/.test(tc_number)) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'TC kimlik numarası 11 haneli olmalıdır' : 'TC ID number must be 11 digits'
            });
        }

        // Spam/garbage input detection
        function isGarbageG(str, minLength) {
            if (!str || str.replace(/\s/g, '').length < minLength) return true;
            const cleaned = str.replace(/\s/g, '');
            const uniqueChars = new Set(cleaned.toLowerCase()).size;
            if (cleaned.length >= 5 && uniqueChars <= 1) return true;
            if (cleaned.length >= 8 && uniqueChars <= 2) return true;
            return false;
        }
        if (/\d/.test(first_name) || first_name.trim().length < 2 || isGarbageG(first_name, 2)) {
            return res.status(400).json({ success: false, message: language === 'tr' ? 'Lütfen geçerli bir ad girin' : 'Please enter a valid first name' });
        }
        if (/\d/.test(last_name) || last_name.trim().length < 2 || isGarbageG(last_name, 2)) {
            return res.status(400).json({ success: false, message: language === 'tr' ? 'Lütfen geçerli bir soyad girin' : 'Please enter a valid last name' });
        }
        if (/^(\d)\1{10}$/.test(tc_number)) {
            return res.status(400).json({ success: false, message: language === 'tr' ? 'Lütfen geçerli bir TC kimlik numarası girin' : 'Please enter a valid TC number' });
        }
        if (phone) {
            const pd = phone.replace(/\D/g, '');
            if (pd.length >= 8 && new Set(pd).size <= 2) {
                return res.status(400).json({ success: false, message: language === 'tr' ? 'Lütfen geçerli bir telefon numarası girin' : 'Please enter a valid phone number' });
            }
        }
        if (isGarbageG(passport_number, 4)) {
            return res.status(400).json({ success: false, message: language === 'tr' ? 'Lütfen geçerli bir pasaport numarası girin' : 'Please enter a valid passport number' });
        }
        if (isGarbageG(current_school, 3)) {
            return res.status(400).json({ success: false, message: language === 'tr' ? 'Lütfen geçerli bir okul adı girin' : 'Please enter a valid school name' });
        }
        if (isGarbageG(home_address, 5)) {
            return res.status(400).json({ success: false, message: language === 'tr' ? 'Lütfen geçerli bir ev adresi girin' : 'Please enter a valid home address' });
        }
        
        // Check if user already exists (double check)
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1 OR google_id = $2',
            [googleEmail, googleId]
        );
        
        if (existingUser.rows.length > 0) {
            // Clear pending cookies
            res.clearCookie('google_pending_email');
            res.clearCookie('google_pending_id');
            res.clearCookie('google_pending_name');
            res.clearCookie('google_pending_wizard_rec');
            
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Bu e-posta ile zaten bir hesap mevcut' : 'An account already exists with this email'
            });
        }
        
        // Format phone number
        const formattedPhone = formatPhoneNumber(phone);
        
        // Create new user
        const result = await pool.query(`
            INSERT INTO users (
                google_id, email, first_name, last_name, tc_number, phone, password_hash,
                english_level, high_school_graduation_date, birth_date,
                desired_country, current_school, active_class,
                passport_type, passport_number, home_address,
                email_verified, registered_via, personal_info_completed, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
            RETURNING *
        `, [
            googleId,
            googleEmail,
            first_name,
            last_name,
            tc_number,
            formattedPhone,
            'GOOGLE_AUTH_NO_PASSWORD',
            english_level,
            null,
            null,
            desired_country || null,
            current_school || null,
            active_class || null,
            passport_type || null,
            passport_number || null,
            home_address || null,
            true, // email_verified
            'google',
            true // personal_info_completed
        ]);
        
        const user = result.rows[0];
        console.log('✅ New user created via Google registration:', user.email);
        
        // Create default checklist for new user
        const defaultChecklistItems = [
            'Her okul için niyet mektubu hazırlandı ve sisteme yüklendi.',
            'CV düzenlendi ve sisteme yüklendi.',
            'Referans mektupları alındı ve sisteme yüklendi.'
        ];
        for (const item of defaultChecklistItems) {
            await pool.query(
                'INSERT INTO checklist_items (user_id, item_name, is_completed) VALUES ($1, $2, false)',
                [user.id, item]
            );
        }
        
        // Link wizard recommendation if exists
        if (wizardRecommendationId) {
            try {
                await pool.query(
                    'UPDATE ai_recommendations SET user_id = $1 WHERE id = $2 AND user_id IS NULL',
                    [user.id, wizardRecommendationId]
                );
                console.log('📎 Linked wizard recommendation', wizardRecommendationId, 'to user', user.id);
            } catch (linkErr) {
                console.error('Failed to link wizard recommendation:', linkErr.message);
            }
        }
        
        // Generate JWT token
        const token = generateUserToken(user.id);
        
        // Set user token cookie
        res.cookie('userToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        // Clear pending Google cookies
        res.clearCookie('google_pending_email');
        res.clearCookie('google_pending_id');
        res.clearCookie('google_pending_name');
        res.clearCookie('google_pending_wizard_rec');

        // Send new student notification to admin (non-blocking)
        sendNewStudentNotificationEmail({
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            phone: user.phone
        }, 'google_redirect').catch(err => {
            console.error('⚠️ Admin notification email error:', err.message);
        });
        
        res.json({
            success: true,
            message: language === 'tr' ? 'Kayıt başarılı! Yönlendiriliyorsunuz...' : 'Registration successful! Redirecting...',
            redirect: '/user/dashboard'
        });
        
    } catch (error) {
        console.error('❌ Complete Google registration error:', error);
        
        // Kullanıcı dostu hata mesajları
        let userMessage;
        if (error.message.includes('users_tc_number_key') || error.message.includes('tc_number')) {
            userMessage = language === 'tr' 
                ? 'Bu TC Kimlik Numarası ile zaten bir hesap mevcut. Lütfen giriş yapın veya farklı bir TC Kimlik No kullanın.' 
                : 'An account already exists with this TC ID number. Please login or use a different TC ID.';
        } else if (error.message.includes('users_email_key') || error.message.includes('email')) {
            userMessage = language === 'tr' 
                ? 'Bu e-posta adresi ile zaten bir hesap mevcut. Lütfen giriş yapın.' 
                : 'An account already exists with this email. Please login.';
        } else if (error.message.includes('users_phone_key') || error.message.includes('phone')) {
            userMessage = language === 'tr' 
                ? 'Bu telefon numarası ile zaten bir hesap mevcut.' 
                : 'An account already exists with this phone number.';
        } else {
            userMessage = language === 'tr' 
                ? 'Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.' 
                : 'An error occurred during registration. Please try again.';
        }
        
        res.status(500).json({
            success: false,
            message: userMessage
        });
    }
});

// =====================================================
// GOOGLE OAUTH ENDPOINT (ID Token method)
// Smart logic: If user exists -> Login, If not -> Register
// =====================================================
router.post('/google', async (req, res) => {
    try {
        const { credential, wizard_recommendation_id, language = 'tr' } = req.body;
        
        if (!credential) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Google kimlik bilgisi gerekli' : 'Google credential required'
            });
        }
        
        // Handle Google authentication (smart login/register)
        const result = await handleGoogleAuth(credential, {
            language,
            wizard_recommendation_id
        });
        
        if (!result.success) {
            return res.status(401).json(result);
        }
        
        // Set cookie
        res.cookie('userToken', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        res.json({
            success: true,
            message: result.message,
            user: result.user,
            token: result.token,
            is_new_user: result.is_new_user,
            needs_personal_info: result.needs_personal_info,
            redirect: result.needs_personal_info ? '/user/dashboard?complete_profile=1' : '/user/dashboard'
        });
        
    } catch (error) {
        console.error('Google auth route error:', error);
        res.status(500).json({
            success: false,
            message: req.body.language === 'tr' ? 'Bir hata oluştu' : 'An error occurred',
            error_detail: error.message,
            error_code: error.code
        });
    }
});

// =====================================================
// GOOGLE OAUTH2 ENDPOINT (Access Token method - fallback)
// For browsers that block One Tap
// =====================================================
router.post('/google-oauth2', async (req, res) => {
    try {
        const { access_token, user_data, wizard_recommendation_id, language = 'tr' } = req.body;
        
        if (!access_token || !user_data || !user_data.email) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Google bilgileri eksik' : 'Google data missing'
            });
        }
        
        console.log('📧 Google OAuth2 login attempt:', user_data.email);
        
        // Check if user exists
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE google_id = $1 OR email = $2 LIMIT 1',
            [user_data.sub, user_data.email]
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
                    [user_data.sub, user.id]
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
                user_data.sub,
                user_data.email,
                '', // Will be filled later by user - not auto-filled from Google
                '', // Will be filled later by user - not auto-filled from Google
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
                'Üniversite kayıt ücretleri ödendi.'
            ];
            
            for (const item of defaultChecklistItems) {
                await pool.query(
                    `INSERT INTO checklist_items (user_id, item_name, is_completed) VALUES ($1, $2, false)`,
                    [user.id, item]
                );
            }
        }
        
        // If there's a wizard recommendation, link it to this user
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
        
        // Generate JWT token
        const token = generateUserToken(user.id);
        
        // Set cookie
        res.cookie('userToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        res.json({
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
                personal_info_completed: user.personal_info_completed || false
            },
            token,
            is_new_user: isNewUser,
            needs_personal_info: !user.personal_info_completed,
            redirect: !user.personal_info_completed ? '/user/dashboard?complete_profile=1' : '/user/dashboard'
        });
        
    } catch (error) {
        console.error('Google OAuth2 route error:', error);
        res.status(500).json({
            success: false,
            message: req.body.language === 'tr' ? 'Bir hata oluştu' : 'An error occurred',
            error_detail: error.message,
            error_code: error.code
        });
    }
});

// User Registration (Simplified - only email and password required)
router.post('/register', async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            email,
            tc_number,
            phone,
            password,
            english_level,
            high_school_graduation_date,
            birth_date,
            passport_number,
            passport_type,
            desired_country,
            active_class,
            current_school,
            home_address,
            language = 'tr'
        } = req.body;

        // Full validation - all required fields must be provided
        if (!email || !password || !first_name || !last_name || !tc_number || !phone || !english_level) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Tüm zorunlu alanlar doldurulmalıdır' : 'All required fields must be filled'
            });
        }

        // Validate additional required fields
        if (!desired_country || !current_school || !active_class || !passport_type || !passport_number || !home_address) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Lütfen tüm zorunlu alanları doldurun (ülke, okul, sınıf, pasaport bilgileri, ev adresi)' : 'Please fill in all required fields (country, school, grade, passport info, home address)'
            });
        }

        // Password validation
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Şifre en az 6 karakter olmalıdır' : 'Password must be at least 6 characters'
            });
        }

        // TC Number validation - required and must be 11 digits
        if (!tc_number || !/^\d{11}$/.test(tc_number)) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'TC kimlik numarası 11 haneli olmalıdır' : 'TC number must be 11 digits'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Geçerli bir e-posta adresi girin' : 'Please enter a valid email address'
            });
        }

        // Spam/garbage input detection
        function isGarbageInput(str, minLength = 3) {
            if (!str || str.length < minLength) return true;
            const cleaned = str.replace(/\s/g, '');
            if (cleaned.length < 2) return true;
            const uniqueChars = new Set(cleaned.toLowerCase()).size;
            if (cleaned.length >= 5 && uniqueChars <= 1) return true;
            if (cleaned.length >= 8 && uniqueChars <= 2) return true;
            return false;
        }

        function isValidName(name) {
            if (!name || name.trim().length < 2) return false;
            if (/\d/.test(name)) return false;
            if (isGarbageInput(name, 2)) return false;
            return true;
        }

        if (!isValidName(first_name)) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Lütfen geçerli bir ad girin (en az 2 karakter, rakam içermemeli)' : 'Please enter a valid first name (at least 2 characters, no numbers)'
            });
        }

        if (!isValidName(last_name)) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Lütfen geçerli bir soyad girin (en az 2 karakter, rakam içermemeli)' : 'Please enter a valid last name (at least 2 characters, no numbers)'
            });
        }

        if (tc_number && /^(\d)\1{10}$/.test(tc_number)) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Lütfen geçerli bir TC kimlik numarası girin' : 'Please enter a valid TC number'
            });
        }

        if (phone) {
            const phoneDigits = phone.replace(/\D/g, '');
            const uniquePhoneDigits = new Set(phoneDigits).size;
            if (phoneDigits.length >= 8 && uniquePhoneDigits <= 2) {
                return res.status(400).json({
                    success: false,
                    message: language === 'tr' ? 'Lütfen geçerli bir telefon numarası girin' : 'Please enter a valid phone number'
                });
            }
        }

        if (passport_number && isGarbageInput(passport_number, 4)) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Lütfen geçerli bir pasaport numarası girin' : 'Please enter a valid passport number'
            });
        }

        if (current_school && isGarbageInput(current_school, 3)) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Lütfen geçerli bir okul adı girin' : 'Please enter a valid school name'
            });
        }

        if (home_address && isGarbageInput(home_address, 5)) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Lütfen geçerli bir ev adresi girin' : 'Please enter a valid home address'
            });
        }

        // Check if user already exists - only check email for simplified registration
        // tc_number and phone are placeholders, so don't check them
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 
                    'Bu e-posta adresi zaten kayıtlı. Şifrenizi unuttuysanız şifre sıfırlama sayfasını kullanın.' : 
                    'This email address is already registered. If you forgot your password, use the password reset page.',
                redirectTo: '/forgot-password'
            });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Generate verification token
        const verificationToken = generateVerificationToken();

        // Personal info is complete at registration since all required fields are now mandatory
        const isPersonalInfoComplete = !!(first_name && last_name && tc_number && phone && english_level);

        // Format phone number with space after country code
        const formattedPhone = formatPhoneNumber(phone);
        
        // Insert user with all provided fields from registration form
        const result = await pool.query(`
            INSERT INTO users (
                first_name,
                last_name,
                email,
                tc_number,
                phone,
                password_hash,
                english_level,
                high_school_graduation_date,
                birth_date,
                passport_type,
                passport_number,
                desired_country,
                active_class,
                current_school,
                home_address,
                verification_token,
                registered_via,
                personal_info_completed,
                email_verified
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING id, first_name, last_name, email, phone
        `, [
            first_name || '',
            last_name || '',
            email,
            tc_number || null,
            formattedPhone || null,
            passwordHash,
            english_level || null,
            high_school_graduation_date || null,
            birth_date || null,
            passport_type || null,
            passport_number || null,
            desired_country || null,
            active_class || null,
            current_school || null,
            home_address || null,
            verificationToken,
            'email',
            isPersonalInfoComplete,
            false // email_verified - must verify via email
        ]);

        const user = result.rows[0];

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
                `INSERT INTO checklist_items (user_id, item_name, is_completed)
                 VALUES ($1, $2, false)`,
                [user.id, item]
            );
        }

        // Send emails (must await in serverless environment)
        await Promise.all([
            sendVerificationEmail(email, user.first_name, verificationToken, language)
                .then(() => console.log('Verification email sent to:', email))
                .catch(err => console.error('Verification email failed:', err.message)),
            sendNewStudentNotificationEmail({
                first_name: user.first_name,
                last_name: user.last_name || last_name,
                email: email,
                phone: formattedPhone
            }, 'email')
                .then(() => console.log('Admin notification sent for:', email))
                .catch(err => console.error('Admin notification failed:', err.message))
        ]);

        res.status(201).json({
            success: true,
            message: language === 'tr' ? 
                'Kayıt başarılı! Lütfen e-posta adresinizi doğrulayın.' : 
                'Registration successful! Please verify your email address.',
            user: {
                id: user.id,
                first_name: user.first_name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        // Kullanıcı dostu hata mesajları
        let userMessage;
        if (error.message && (error.message.includes('users_tc_number_key') || error.message.includes('tc_number'))) {
            userMessage = language === 'tr' 
                ? 'Bu TC Kimlik Numarası ile zaten bir hesap mevcut. Lütfen giriş yapın.' 
                : 'An account already exists with this TC ID number. Please login.';
        } else if (error.message && (error.message.includes('users_email_key') || error.message.includes('email'))) {
            userMessage = language === 'tr' 
                ? 'Bu e-posta adresi ile zaten bir hesap mevcut. Lütfen giriş yapın.' 
                : 'An account already exists with this email. Please login.';
        } else if (error.message && (error.message.includes('users_phone_key') || error.message.includes('phone'))) {
            userMessage = language === 'tr' 
                ? 'Bu telefon numarası ile zaten bir hesap mevcut.' 
                : 'An account already exists with this phone number.';
        } else {
            userMessage = language === 'tr' 
                ? 'Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.' 
                : 'An error occurred during registration. Please try again.';
        }
        
        res.status(500).json({
            success: false,
            message: userMessage
        });
    }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
    try {
        const { email, language = 'tr' } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'E-posta adresi gerekli' : 'Email address is required'
            });
        }

        const userResult = await pool.query(
            'SELECT id, first_name, email_verified FROM users WHERE email = $1 LIMIT 1',
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: language === 'tr' ? 'Bu e-posta ile kullanıcı bulunamadı' : 'User not found for this email'
            });
        }

        const user = userResult.rows[0];

        if (user.email_verified) {
            return res.json({
                success: true,
                message: language === 'tr' ? 'E-posta zaten doğrulanmış' : 'Email already verified'
            });
        }

        const newToken = generateVerificationToken();
        await pool.query('UPDATE users SET verification_token = $1 WHERE id = $2', [newToken, user.id]);
        await sendVerificationEmail(email, user.first_name, newToken, language);

        res.json({
            success: true,
            message: language === 'tr' ? 'Yeni doğrulama maili gönderildi' : 'New verification email sent'
        });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Verification email could not be resent'
        });
    }
});
// Email Verification
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;
        const language = req.query.lang || 'tr';

        console.log('📧 Email verification request received');
        console.log('   Token:', token ? token.substring(0, 20) + '...' : 'missing');

        if (!token) {
            return res.status(400).render('verification-error', { 
                title: 'Doğrulama Hatası',
                message: language === 'tr' ? 'Geçersiz doğrulama tokeni' : 'Invalid verification token',
                language 
            });
        }

        // Find user with this token (check both boolean false and integer 0)
        const result = await pool.query(
            `SELECT id, first_name, email, email_verified, verification_token 
             FROM users 
             WHERE verification_token = $1 
             AND (email_verified = false OR email_verified = 0 OR email_verified IS NULL)`,
            [token]
        );

        console.log('   Found users with token:', result.rows.length);

        if (result.rows.length === 0) {
            // Check if token was already used (user verified)
            const alreadyVerified = await pool.query(
                `SELECT id, email, email_verified FROM users 
                 WHERE verification_token IS NULL 
                 AND (email_verified = true OR email_verified = 1)
                 ORDER BY created_at DESC LIMIT 5`
            );

            console.log('   Already verified users:', alreadyVerified.rows.length);
            
            // Token doesn't exist - might be already used or invalid
                return res.status(400).render('verification-error', { 
                    title: 'Doğrulama Hatası',
                message: language === 'tr' ? 'Geçersiz veya kullanılmış doğrulama tokeni. E-postanız zaten doğrulanmış olabilir.' : 'Invalid or used verification token. Your email may already be verified.',
                language 
            });
        }

        const user = result.rows[0];
        console.log('   Verifying user:', user.email);

        // Update user as verified (use boolean true for consistency)
        await pool.query(
            'UPDATE users SET email_verified = true, verification_token = NULL WHERE id = $1',
            [user.id]
        );
        
        console.log('   ✅ User email verified successfully:', user.email);

        res.render('verification-success', { 
            title: 'E-posta Doğrulandı',
            message: language === 'tr' ? 
                'E-posta adresiniz başarıyla doğrulandı! Giriş yapabilirsiniz.' : 
                'Your email has been verified successfully! You can now login.',
            user: {
                id: user.id,
                first_name: user.first_name,
                email: user.email
            },
            language 
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).render('verification-error', { 
            title: 'Doğrulama Hatası',
            message: language === 'tr' ? 'Doğrulama sırasında bir hata oluştu' : 'An error occurred during verification',
            language 
        });
    }
});

// Forgot Password - works for users, admins, and partners
router.post('/forgot-password', async (req, res) => {
    try {
        const { email, language = 'tr' } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'E-posta adresi gereklidir' : 'Email address is required'
            });
        }

        const emailLower = email.toLowerCase().trim();
        let userRecord = null;
        let userType = null;

        // 1. Check users table
        const userResult = await pool.query(
            'SELECT id, first_name, email FROM users WHERE LOWER(email) = $1',
            [emailLower]
        );
        if (userResult.rows.length > 0) {
            userRecord = userResult.rows[0];
            userType = 'user';
        }

        // 2. Check admins table
        if (!userRecord) {
            const adminResult = await pool.query(
                'SELECT id, name as first_name, email FROM admins WHERE LOWER(email) = $1',
                [emailLower]
            );
            if (adminResult.rows.length > 0) {
                userRecord = adminResult.rows[0];
                userType = 'admin';
            }
        }

        // 3. Check partners table
        if (!userRecord) {
            const partnerResult = await pool.query(
                'SELECT id, first_name, email FROM partners WHERE LOWER(email) = $1',
                [emailLower]
            );
            if (partnerResult.rows.length > 0) {
                userRecord = partnerResult.rows[0];
                userType = 'partner';
            }
        }

        if (!userRecord) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 
                    'Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı.' : 
                    'No user found with this email address.'
            });
        }

        // Generate reset token
        const resetToken = generateResetToken();

        // Save reset token to the correct table
        if (userType === 'user') {
            await pool.query(
                'UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL \'1 hour\' WHERE id = $2',
                [resetToken, userRecord.id]
            );
        } else if (userType === 'admin') {
            await pool.query(
                'UPDATE admins SET reset_token = $1, reset_token_expires = NOW() + INTERVAL \'1 hour\' WHERE id = $2',
                [resetToken, userRecord.id]
            );
        } else if (userType === 'partner') {
            await pool.query(
                'UPDATE partners SET reset_token = $1, reset_token_expires = NOW() + INTERVAL \'1 hour\' WHERE id = $2',
                [resetToken, userRecord.id]
            );
        }

        // Send reset email
        await sendPasswordResetEmail(userRecord.email, userRecord.first_name, resetToken, language);

        console.log(`✅ Password reset token sent to ${userType}: ${userRecord.email}`);

        res.json({
            success: true,
            message: language === 'tr' ? 
                'Şifre sıfırlama linki e-posta adresinize gönderildi.' : 
                'Password reset link has been sent to your email address.'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: language === 'tr' ? 'Şifre sıfırlama sırasında bir hata oluştu' : 'An error occurred during password reset'
        });
    }
});

// Unified Login (Admin and User)
router.post('/login', async (req, res) => {
    try {
        const { email, password, language = 'tr' } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'E-posta ve şifre gerekli' : 'Email and password required'
            });
        }

        // First, try to find user (student/admin)
        const userResult = await pool.query(
            'SELECT id, first_name, last_name, email, password_hash, email_verified, is_admin FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length > 0) {
            // User found - process user login
            const user = userResult.rows[0];

            // Check password first
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            if (!passwordMatch) {
                return res.status(401).json({
                    success: false,
                    message: language === 'tr' ? 'Geçersiz e-posta veya şifre' : 'Invalid email or password'
                });
            }

            // Hard enforcement: block login for unverified non-admin users
            if (!user.is_admin && !user.email_verified) {
                return res.status(403).json({
                    success: false,
                    needs_verification: true,
                    message: language === 'tr' 
                        ? 'Önce e-posta adresinize gelen mailden hesabınızı doğrulayın. Doğrulama maili gelmedi mi? Aşağıdaki butona tıklayın.' 
                        : 'Please verify your account from the email sent to your email address. Didn\'t receive the verification email? Click the button below.',
                    email: user.email
                });
            }

            // Generate token with login timestamp
            const token = generateUserToken(user.id);
            await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

            // Set cookie
            res.cookie('userToken', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            return res.json({
                success: true,
                message: language === 'tr' ? 'Giriş başarılı' : 'Login successful',
                user: {
                    id: user.id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    email: user.email,
                    is_admin: user.is_admin,
                    email_verified: user.email_verified
                },
                token,
                is_admin: user.is_admin,
                is_partner: false
            });
        }

        // If not found in users, try partners table
        const partnerResult = await pool.query(
            'SELECT id, first_name, last_name, email, password_hash, email_verified, is_active, company_name FROM partners WHERE email = $1',
            [email]
        );

        if (partnerResult.rows.length > 0) {
            // Partner found - process partner login
            const partner = partnerResult.rows[0];

            // Check if partner is active
            if (!partner.is_active) {
                return res.status(401).json({
                    success: false,
                    message: language === 'tr' ? 'Partner hesabınız aktif değil' : 'Your partner account is not active'
                });
            }

            // Check if email is verified
            if (!partner.email_verified) {
                return res.status(401).json({
                    success: false,
                    message: language === 'tr' ? 'Lütfen e-posta adresinizi doğrulayın' : 'Please verify your email address'
                });
            }

            // Check password
            const passwordMatch = await bcrypt.compare(password, partner.password_hash);
            if (!passwordMatch) {
                return res.status(401).json({
                    success: false,
                    message: language === 'tr' ? 'Geçersiz e-posta veya şifre' : 'Invalid email or password'
                });
            }

            // Generate partner token
            const token = generatePartnerToken(partner.id);

            // Set cookie for partner
            res.cookie('partnerToken', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            return res.json({
                success: true,
                message: language === 'tr' ? 'Giriş başarılı' : 'Login successful',
                partner: {
                    id: partner.id,
                    name: `${partner.first_name} ${partner.last_name}`,
                    email: partner.email,
                    company_name: partner.company_name
                },
                token,
                is_admin: false,
                is_partner: true,
                redirect: '/partner/dashboard'
            });
        }

        // Neither user nor partner found
        return res.status(401).json({
            success: false,
            message: language === 'tr' ? 'Geçersiz e-posta veya şifre' : 'Invalid email or password'
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: language === 'tr' ? 'Giriş sırasında bir hata oluştu' : 'An error occurred during login'
        });
    }
});

// Reset Password - works for users, admins, and partners
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password, language = 'tr' } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Token ve yeni şifre gerekli' : 'Token and new password required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Şifre en az 6 karakter olmalıdır' : 'Password must be at least 6 characters'
            });
        }

        let userRecord = null;
        let userType = null;

        // 1. Check users table
        const userResult = await pool.query(
            'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
            [token]
        );
        if (userResult.rows.length > 0) {
            userRecord = userResult.rows[0];
            userType = 'user';
        }

        // 2. Check admins table
        if (!userRecord) {
            const adminResult = await pool.query(
                'SELECT id FROM admins WHERE reset_token = $1 AND reset_token_expires > NOW()',
                [token]
            );
            if (adminResult.rows.length > 0) {
                userRecord = adminResult.rows[0];
                userType = 'admin';
            }
        }

        // 3. Check partners table
        if (!userRecord) {
            const partnerResult = await pool.query(
                'SELECT id FROM partners WHERE reset_token = $1 AND reset_token_expires > NOW()',
                [token]
            );
            if (partnerResult.rows.length > 0) {
                userRecord = partnerResult.rows[0];
                userType = 'partner';
            }
        }

        if (!userRecord) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Geçersiz veya süresi dolmuş sıfırlama linki. Lütfen tekrar deneyin.' : 'Invalid or expired reset link. Please try again.'
            });
        }

        // Hash new password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Update password and clear reset token in the correct table
        const tableName = userType === 'admin' ? 'admins' : userType === 'partner' ? 'partners' : 'users';
        await pool.query(
            `UPDATE ${tableName} SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2`,
            [passwordHash, userRecord.id]
        );

        console.log(`✅ Password reset successful for ${userType} ID: ${userRecord.id}`);

        res.json({
            success: true,
            message: language === 'tr' ? 'Şifreniz başarıyla güncellendi!' : 'Your password has been updated successfully!'
        });

    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({
            success: false,
            message: language === 'tr' ? 'Şifre sıfırlama sırasında bir hata oluştu' : 'An error occurred during password reset'
        });
    }
});

// Logout
router.post('/logout', (req, res) => {
    const expireOpts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 };
    res.cookie('userToken', '', expireOpts);
    res.cookie('adminToken', '', expireOpts);
    res.cookie('partnerToken', '', expireOpts);
    res.clearCookie('userToken');
    res.clearCookie('adminToken');
    res.clearCookie('partnerToken');
    console.log('Logout endpoint called - cookies expired');
    res.json({ success: true, message: 'Logout successful' });
});

// Partner specific logout
router.post('/partner-logout', (req, res) => {
    const expireOpts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 };
    res.cookie('partnerToken', '', expireOpts);
    res.clearCookie('partnerToken');
    res.json({ success: true, message: 'Partner çıkışı başarılı' });
});

// =====================================================
// PARTNER AUTHENTICATION ENDPOINTS
// =====================================================

// Partner Login
router.post('/partner-login', async (req, res) => {
    try {
        const { email, password, language = 'tr' } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'E-posta ve şifre gerekli' : 'Email and password required'
            });
        }

        // Find partner
        const result = await pool.query(
            'SELECT id, first_name, last_name, email, password_hash, email_verified, is_active, company_name FROM partners WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: language === 'tr' ? 'Geçersiz e-posta veya şifre' : 'Invalid email or password'
            });
        }

        const partner = result.rows[0];

        // Check if partner is active
        if (!partner.is_active) {
            return res.status(401).json({
                success: false,
                message: language === 'tr' ? 'Hesabınız devre dışı bırakılmış' : 'Your account has been deactivated'
            });
        }

        // Check if email is verified
        if (!partner.email_verified) {
            return res.status(401).json({
                success: false,
                message: language === 'tr' ? 'Lütfen önce e-posta adresinizi doğrulayın' : 'Please verify your email address first'
            });
        }

        // Check if password is set
        if (!partner.password_hash) {
            return res.status(401).json({
                success: false,
                message: language === 'tr' ? 'Lütfen önce şifrenizi belirleyin' : 'Please set your password first'
            });
        }

        // Check password
        const passwordMatch = await bcrypt.compare(password, partner.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: language === 'tr' ? 'Geçersiz e-posta veya şifre' : 'Invalid email or password'
            });
        }

        // Generate token
        const token = generatePartnerToken(partner.id);

        // Set cookie
        res.cookie('partnerToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            success: true,
            message: language === 'tr' ? 'Giriş başarılı' : 'Login successful',
            partner: {
                id: partner.id,
                name: `${partner.first_name} ${partner.last_name}`,
                email: partner.email,
                company_name: partner.company_name
            },
            token,
            redirect: '/partner/dashboard'
        });

    } catch (error) {
        console.error('Partner login error:', error);
        res.status(500).json({
            success: false,
            message: language === 'tr' ? 'Giriş sırasında bir hata oluştu' : 'An error occurred during login'
        });
    }
});

// Partner Email Verification and Password Setup
router.get('/verify-partner-email', async (req, res) => {
    try {
        const { token } = req.query;
        const language = req.query.lang || 'tr';

        if (!token) {
            return res.status(400).render('verification-error', { 
                title: 'Doğrulama Hatası',
                message: language === 'tr' ? 'Geçersiz doğrulama tokeni' : 'Invalid verification token',
                language 
            });
        }

        // Find partner with this token
        const result = await pool.query(
            'SELECT id, first_name, last_name, email FROM partners WHERE verification_token = $1 AND email_verified = false',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).render('verification-error', { 
                title: 'Doğrulama Hatası',
                message: language === 'tr' ? 'Geçersiz veya kullanılmış doğrulama tokeni' : 'Invalid or used verification token',
                language 
            });
        }

        const partnerData = result.rows[0];

        // Render password setup page for partner
        res.render('partner-setup-password', { 
            title: 'Şifre Belirleme',
            partner: {
                id: partnerData.id,
                name: `${partnerData.first_name} ${partnerData.last_name}`,
                email: partnerData.email
            },
            token,
            language 
        });

    } catch (error) {
        console.error('Partner email verification error:', error);
        res.status(500).render('verification-error', { 
            title: 'Doğrulama Hatası',
            message: language === 'tr' ? 'Doğrulama sırasında bir hata oluştu' : 'An error occurred during verification',
            language 
        });
    }
});

// Partner Password Setup (after email verification)
router.post('/partner-setup-password', async (req, res) => {
    try {
        const { token, password, language = 'tr' } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Token ve şifre gerekli' : 'Token and password required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Şifre en az 6 karakter olmalıdır' : 'Password must be at least 6 characters'
            });
        }

        // Find partner with this token
        const result = await pool.query(
            'SELECT id, first_name, last_name, email FROM partners WHERE verification_token = $1',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Geçersiz token' : 'Invalid token'
            });
        }

        const partner = result.rows[0];

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Update partner: set password, verify email, clear token
        await pool.query(
            'UPDATE partners SET password_hash = $1, email_verified = true, verification_token = NULL WHERE id = $2',
            [passwordHash, partner.id]
        );

        // Generate login token
        const loginToken = generatePartnerToken(partner.id);

        // Set cookie
        res.cookie('partnerToken', loginToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            success: true,
            message: language === 'tr' ? 'Şifreniz başarıyla belirlendi' : 'Password set successfully',
            redirect: '/partner/dashboard'
        });

    } catch (error) {
        console.error('Partner password setup error:', error);
        res.status(500).json({
            success: false,
            message: language === 'tr' ? 'Şifre belirlenirken bir hata oluştu' : 'An error occurred while setting password'
        });
    }
});

// Temporary admin creation endpoint (for development only)
router.post('/create-admin', async (req, res) => {
    try {
        const { eposta, password, name } = req.body;
        
        if (!eposta || !password || !name) {
            return res.status(400).json({
                success: false,
                message: 'Email, password and name are required'
            });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert admin user
        const result = await pool.query(`
            INSERT INTO kullanicilar (ad, soyad, eposta, tc_kimlik_no, telefon, sifre_hash, ingilizce_seviyesi, lise_mezuniyet_tarihi, dogum_tarihi, eposta_verified, is_admin)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?0, ?1)
            RETURNING id, ad, soyad, eposta, is_admin
        `, [
            name, 'Admin', eposta, '00000000000', '00000000000', passwordHash, 
            'Advanced', '2020-01-01', '1990-01-01', true, true
        ]);

        const admin = result.rows[0];

        res.status(201).json({
            success: true,
            message: 'Admin user created successfully',
            admin: {
                id: admin.id,
                name: admin.ad,
                eposta: admin.eposta,
                is_admin: admin.is_admin
            }
        });

    } catch (error) {
        console.error('Admin creation error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while creating admin user'
        });
    }
});

module.exports = router; 