const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { generateUserToken, generatePartnerToken } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail, sendPartnerVerificationEmail, generateVerificationToken, generateResetToken } = require('../services/emailService');

const router = express.Router();

// User Registration
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
            language = 'tr'
        } = req.body;

        // Validation
        if (!first_name || !last_name || !email || !tc_number || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Tüm zorunlu alanları doldurun' : 'Please fill all required fields'
            });
        }

        // TC Number validation (11 digits)
        if (!/^\d{11}$/.test(tc_number)) {
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

        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1 OR tc_number = $2 OR phone = $3',
            [email, tc_number, phone]
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

        // Insert user
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
                verification_token
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id, first_name, email
        `, [
            first_name,
            last_name,
            email,
            tc_number,
            phone,
            passwordHash,
            english_level,
            high_school_graduation_date,
            birth_date,
            passport_type,
            passport_number,
            desired_country,
            active_class,
            verificationToken
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

        // Send verification email
        await sendVerificationEmail(email, first_name, verificationToken, language);

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
        res.status(500).json({
            success: false,
            message: language === 'tr' ? 'Kayıt sırasında bir hata oluştu' : 'An error occurred during registration'
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

        if (!token) {
            return res.status(400).render('verification-error', { 
                title: 'Doğrulama Hatası',
                message: language === 'tr' ? 'Geçersiz doğrulama tokeni' : 'Invalid verification token',
                language 
            });
        }

        // Find user with this token
        const result = await pool.query(
            'SELECT id, first_name, email FROM users WHERE verification_token = $1 AND email_verified = 0',
            [token]
        );

        if (result.rows.length === 0) {
            const fallback = await pool.query(
                'SELECT id, first_name, email FROM users WHERE verification_token IS NULL AND email_verified = 0 ORDER BY created_at DESC LIMIT 1'
            );

            if (fallback.rows.length === 0) {
                return res.status(400).render('verification-error', { 
                    title: 'Doğrulama Hatası',
                    message: language === 'tr' ? 'Geçersiz veya kullanılmış doğrulama tokeni' : 'Invalid or used verification token',
                    language 
                });
            }

            const user = fallback.rows[0];
            const newToken = generateVerificationToken();
            await pool.query(
                'UPDATE users SET verification_token = $1 WHERE id = $2',
                [newToken, user.id]
            );

            await sendVerificationEmail(user.email, user.first_name, newToken, language);

            return res.render('verification-error', { 
                title: 'Doğrulama Hatası',
                message: language === 'tr' ? 'Link süresi dolmuş. Yeni doğrulama e-postası gönderildi.' : 'Link expired. A new verification email has been sent.',
                language 
            });
        }

        const user = result.rows[0];

        // Update user as verified
        await pool.query(
            'UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = $1',
            [user.id]
        );

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

// Forgot Password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email, language = 'tr' } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'E-posta adresi gereklidir' : 'Email address is required'
            });
        }

        // Check if user exists
        const result = await pool.query(
            'SELECT id, first_name, email FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 
                    'Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı. Lütfen kayıt olun.' : 
                    'No user found with this email address. Please register.'
            });
        }

        const user = result.rows[0];

        // Generate reset token
        const resetToken = generateResetToken();

        // Save reset token to database
        await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL \'1 hour\' WHERE id = $2',
            [resetToken, user.id]
        );

        // Send reset email
        await sendPasswordResetEmail(email, user.first_name, resetToken, language);

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

        // Soft enforcement: allow login but mark as unverified for banner/redirects
        const needsVerification = !user.is_admin && !user.email_verified;

        // Check password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                    message: language === 'tr' ? 'Geçersiz e-posta veya şifre' : 'Invalid email or password'
            });
        }

        // Generate token with login timestamp
        const token = generateUserToken(user.id);
        await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

        // Set cookie
        res.cookie('userToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
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
                is_partner: false,
            needs_verification: needsVerification
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

// Password Reset Request
router.post('/forgot-password', async (req, res) => {
    try {
        const { eposta, language = 'tr' } = req.body;

        if (!eposta) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'E-posta adresi gerekli' : 'Email address required'
            });
        }

        // Find user
        const result = await pool.query(
            'SELECT id, ad, eposta FROM kullanicilar WHERE eposta = $1',
            [eposta]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: language === 'tr' ? 'Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı' : 'No user found with this eposta address'
            });
        }

        const user = result.rows[0];

        // Generate reset token
        const resetToken = generateResetToken();
        const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Update user with reset token
        await pool.query(
            'UPDATE kullanicilar SET sifre_sifirlama_token = $1, sifre_sifirlama_token_expires = $2 WHERE id = $3',
            [resetToken, resetTokenExpires, user.id]
        );

        // Send reset eposta
        await sendPasswordResetEmail(eposta, user.ad, resetToken, language);

        res.json({
            success: true,
            message: language === 'tr' ? 
                'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi' : 
                'Password reset link has been sent to your eposta address'
        });

    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({
            success: false,
            message: language === 'tr' ? 'Şifre sıfırlama sırasında bir hata oluştu' : 'An error occurred during password reset'
        });
    }
});

// Password Reset
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password, language = 'tr' } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Token ve yeni şifre gerekli' : 'Token and new password required'
            });
        }

        // Find user with valid reset token
        const result = await pool.query(
            'SELECT id FROM kullanicilar WHERE sifre_sifirlama_token = $1 AND sifre_sifirlama_token_expires > NOW()',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Geçersiz veya süresi dolmuş reset tokeni' : 'Invalid or expired reset token'
            });
        }

        const user = result.rows[0];

        // Hash new password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Update password and clear reset token
        await pool.query(
            'UPDATE kullanicilar SET sifre_hash = $1, sifre_sifirlama_token = NULL, sifre_sifirlama_token_expires = NULL WHERE id = $2',
            [passwordHash, user.id]
        );

        res.json({
            success: true,
            message: language === 'tr' ? 'Şifreniz başarıyla güncellendi' : 'Your password has been updated successfully'
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
    // Clear both user, admin and partner tokens with proper options
    res.clearCookie('userToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });
    res.clearCookie('adminToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });
    res.clearCookie('partnerToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });
    
    console.log('Logout endpoint called - cookies cleared'); // Debug log
    
    res.json({
        success: true,
        message: 'Logout successful'
    });
});

// Partner specific logout
router.post('/partner-logout', (req, res) => {
    res.clearCookie('partnerToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });
    
    res.json({
        success: true,
        message: 'Partner çıkışı başarılı'
    });
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