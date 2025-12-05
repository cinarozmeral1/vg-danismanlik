const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const { authenticateUser } = require('../middleware/auth');
const stripeConfig = require('../config/stripe');

const router = express.Router();

// Configure multer for file uploads (Vercel compatible - memory storage)
const upload = multer({
    storage: multer.memoryStorage(), // Use memory storage for Vercel
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, JPG, JPEG, PNG, DOC, DOCX files are allowed.'), false);
        }
    }
});

// Test endpoint (no auth required)
router.get('/test', async (req, res) => {
    res.json({ success: true, message: 'User routes working!' });
});

// Render user applications page
router.get('/applications', async (req, res) => {
    try {
        // Check if user is logged in
        if (!res.locals.isLoggedIn) {
            return res.redirect('/login');
        }

        res.render('user/applications', { 
            title: 'Başvurularım',
            currentLanguage: res.locals.currentLanguage || 'tr',
            isLoggedIn: res.locals.isLoggedIn,
            currentUser: res.locals.currentUser,
            user: res.locals.currentUser,
            t: res.locals.t
        });
    } catch (error) {
        console.error('Applications page error:', error);
        res.redirect('/login');
    }
});

// Render user dashboard page
router.get('/dashboard', async (req, res) => {
    try {
        // Check if user is logged in
        if (!res.locals.isLoggedIn) {
            return res.redirect('/login');
        }

        const profileResult = await pool.query(
            `SELECT 
                id,
                first_name,
                last_name,
                email,
                tc_number,
                phone,
                english_level,
                high_school_graduation_date,
                birth_date,
                passport_type,
                passport_number,
                desired_country,
                active_class
             FROM users
             WHERE id = $1`,
            [res.locals.currentUser.id]
        );

        const profile = profileResult.rows[0] || null;

        res.render('user/dashboard', { 
            title: 'Profil Bilgileri',
            currentLanguage: res.locals.currentLanguage || 'tr',
            isLoggedIn: res.locals.isLoggedIn,
            currentUser: res.locals.currentUser,
            user: profile,
            profile,
            t: res.locals.t
        });
    } catch (error) {
        console.error('Dashboard page error:', error);
        res.redirect('/login');
    }
});

// Render user files page
router.get('/files', async (req, res) => {
    try {
        // Check if user is logged in
        if (!res.locals.isLoggedIn) {
            return res.redirect('/login');
        }

        res.render('user/files', { 
            title: 'Dosyalarım',
            currentLanguage: res.locals.currentLanguage || 'tr',
            isLoggedIn: res.locals.isLoggedIn,
            currentUser: res.locals.currentUser,
            user: res.locals.currentUser,
            t: res.locals.t
        });
    } catch (error) {
        console.error('Files page error:', error);
        res.redirect('/login');
    }
});

// Render user services page
router.get('/services', async (req, res) => {
    try {
        // Check if user is logged in
        if (!res.locals.isLoggedIn) {
            return res.redirect('/login');
        }

        res.render('user/services', { 
            title: 'Hizmetler & Ödemeler',
            currentLanguage: res.locals.currentLanguage || 'tr',
            isLoggedIn: res.locals.isLoggedIn,
            currentUser: res.locals.currentUser,
            user: res.locals.currentUser,
            t: res.locals.t
        });
    } catch (error) {
        console.error('Services page error:', error);
        res.redirect('/login');
    }
});

// Debug test page
router.get('/services-test', async (req, res) => {
    try {
        if (!res.locals.isLoggedIn) {
            return res.redirect('/login');
        }

        res.render('user/services-test', { 
            title: 'Services Test',
            currentLanguage: res.locals.currentLanguage || 'tr',
            isLoggedIn: res.locals.isLoggedIn,
            currentUser: res.locals.currentUser,
            user: res.locals.currentUser,
            t: res.locals.t
        });
    } catch (error) {
        console.error('Services test page error:', error);
        res.redirect('/login');
    }
});

// Render user settings page
router.get('/settings', async (req, res) => {
    try {
        // Check if user is logged in
        if (!res.locals.isLoggedIn) {
            return res.redirect('/login');
        }

        res.render('user/settings', { 
            title: 'Ayarlar',
            currentLanguage: res.locals.currentLanguage || 'tr',
            isLoggedIn: res.locals.isLoggedIn,
            currentUser: res.locals.currentUser,
            user: res.locals.currentUser,
            t: res.locals.t
        });
    } catch (error) {
        console.error('Settings page error:', error);
        res.redirect('/login');
    }
});

// Get user profile
router.get('/profile', authenticateUser, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id,
                first_name,
                last_name,
                email,
                tc_number,
                phone,
                english_level,
                high_school_graduation_date,
                birth_date,
                passport_type,
                passport_number,
                desired_country,
                active_class,
                created_at
            FROM users 
            WHERE id = $1
        `, [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching user profile'
        });
    }
});

// Update user profile
router.put('/profile', authenticateUser, async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            phone,
            english_level,
            high_school_graduation_date,
            birth_date,
            passport_type,
            passport_number,
            desired_country,
            active_class,
            tc_number
        } = req.body;

        const parseDate = (value) => {
            if (!value) return null;
            // Accept GG/AA/YYYY or YYYY-MM-DD
            const slashRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
            if (slashRegex.test(value)) {
                const [, day, month, year] = value.match(slashRegex);
                return `${year}-${month}-${day}`; // ISO format for Postgres
            }
            const dashRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
            if (dashRegex.test(value)) {
                return value;
            }
            return value; // leave as-is; database will validate
        };

        const normalizedHighSchoolDate = parseDate(high_school_graduation_date);
        const normalizedBirthDate = parseDate(birth_date);

        const result = await pool.query(
            `UPDATE users SET 
                first_name = $1,
                last_name = $2,
                phone = $3,
                english_level = $4,
                high_school_graduation_date = $5,
                birth_date = $6,
                passport_type = $7,
                passport_number = $8,
                desired_country = $9,
                active_class = $10,
                tc_number = $11,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $12 RETURNING *
            `,
            [
                first_name,
                last_name,
                phone,
                english_level,
                normalizedHighSchoolDate,
                normalizedBirthDate,
                passport_type,
                passport_number,
                desired_country,
                active_class,
                tc_number,
                req.user.id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            message: 'Profil bilgileriniz başarıyla güncellendi!',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Update user profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Profil güncellenirken bir hata oluştu: ' + error.message
        });
    }
});

// Get user applications API
router.get('/api/applications', authenticateUser, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id, university_name, university_logo, program_name,
                application_date, status, required_documents, created_at
            FROM applications 
            WHERE user_id = $1
            ORDER BY created_at DESC
        `, [req.user.id]);

        res.json({
            success: true,
            applications: result.rows
        });

    } catch (error) {
        console.error('Get user applications error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching applications'
        });
    }
});

// Get application documents API
router.get('/api/applications/:id/documents', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify application belongs to user
        const appCheck = await pool.query(
            'SELECT id FROM basvurular WHERE id = $1 AND kullanici_id = $2',
            [id, req.user.id]
        );

        if (appCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        const result = await pool.query(`
            SELECT 
                id, filename, original_filename, file_size, mime_type, uploaded_at
            FROM documents 
            WHERE application_id = $1
            ORDER BY uploaded_at DESC
        `, [id]);

        res.json({
            success: true,
            documents: result.rows
        });

    } catch (error) {
        console.error('Get application documents error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching documents'
        });
    }
});

// Upload document
router.post('/applications/:id/documents', authenticateUser, upload.single('document'), async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Verify application belongs to user
        const appCheck = await pool.query(
            'SELECT id FROM basvurular WHERE id = $1 AND kullanici_id = $2',
            [id, req.user.id]
        );

        if (appCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // Save document to database
        const result = await pool.query(`
            INSERT INTO documents (
                application_id, kullanici_id, filename, original_filename, 
                file_path, file_size, mime_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, filename, original_filename, file_size, uploaded_at
        `, [
            id, req.user.id, req.file.filename, req.file.originalname,
            req.file.path, req.file.size, req.file.mimetype
        ]);

        res.status(201).json({
            success: true,
            message: 'Document uploaded successfully',
            document: result.rows[0]
        });

    } catch (error) {
        console.error('Upload document error:', error);
        
        // Clean up uploaded file if database error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            message: error.message || 'An error occurred while uploading document'
        });
    }
});

// Download document
router.get('/documents/:id/download', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;

        // Get document info
        const result = await pool.query(`
            SELECT d.*, a.kullanici_id as application_kullanici_id
            FROM documents d
            JOIN applications a ON d.application_id = a.id
            WHERE d.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        const document = result.rows[0];

        // Verify user owns the document
        if (document.kullanici_id !== req.user.id && document.application_kullanici_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const filePath = document.file_path;
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'File not found on server'
            });
        }

        res.download(filePath, document.original_filename);

    } catch (error) {
        console.error('Download document error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while downloading document'
        });
    }
});

// Delete document
router.delete('/documents/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;

        console.log('🗑️ User delete application document request:', { userId: req.user.id, docId: id });

        // Get document info
        const result = await pool.query(
            'SELECT * FROM documents WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        const document = result.rows[0];

        // Delete from database (no file system deletion needed for Base64)
        await pool.query('DELETE FROM documents WHERE id = $1', [id]);

        console.log('✅ User application document deleted:', document.original_filename);

        res.json({
            success: true,
            message: 'Document deleted successfully'
        });

    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while deleting document'
        });
    }
});

// Get user documents (standalone documents)
router.get('/documents', authenticateUser, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id, title, category, description, file_path, original_filename,
                created_at
            FROM user_documents 
            WHERE user_id = $1
            ORDER BY created_at DESC
        `, [req.user.id]);

        res.json({
            success: true,
            documents: result.rows
        });

    } catch (error) {
        console.error('Get user documents error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching documents'
        });
    }
});

// Upload standalone document
router.post('/documents', authenticateUser, upload.single('document'), async (req, res) => {
    try {
        console.log('📁 Document upload request received for user:', req.user.id);

        if (!req.file) {
            console.log('❌ No file uploaded');
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const { title, category, description } = req.body;

        if (!title || !category) {
            console.log('❌ Missing title or category');
            return res.status(400).json({
                success: false,
                message: 'Title and category are required'
            });
        }

        console.log('✅ File validation passed:', req.file.originalname, req.file.size, 'bytes');

        // Convert file buffer to Base64 for Vercel compatibility
        const fileBuffer = req.file.buffer; // Memory storage provides buffer directly
        const base64Data = fileBuffer.toString('base64');
        const fileDataUrl = `data:${req.file.mimetype};base64,${base64Data}`;

        console.log('✅ File converted to Base64, size:', base64Data.length);

        // Insert into user_documents table using file_data column
        const result = await pool.query(`
            INSERT INTO user_documents (user_id, title, category, description, file_data, original_filename, file_size, mime_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [req.user.id, title, category, description || null, base64Data, req.file.originalname, req.file.size, req.file.mimetype]);

        res.json({
            success: true,
            message: 'Belge başarıyla yüklendi!',
            documentId: result.rows[0].id
        });

    } catch (error) {
        console.error('Upload standalone document error:', error);
        res.status(500).json({
            success: false,
            message: 'Belge yüklenirken bir hata oluştu: ' + error.message
        });
    }
});

// Download standalone document
router.get('/user-documents/:id/download', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;

        // Get document info
        const result = await pool.query(
            'SELECT * FROM user_documents WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        const document = result.rows[0];
        
        // Check if file_data exists (new format) or file_path (legacy format)
        if (document.file_data) {
            // New format: use file_data column
            const buffer = Buffer.from(document.file_data, 'base64');
            
            res.setHeader('Content-Type', document.mime_type);
            res.setHeader('Content-Disposition', `attachment; filename="${document.original_filename}"`);
            res.send(buffer);
        } else if (document.file_path && document.file_path.startsWith('data:')) {
            // Legacy format: data URL in file_path
            const base64Data = document.file_path.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            
            res.setHeader('Content-Type', document.mime_type);
            res.setHeader('Content-Disposition', `attachment; filename="${document.original_filename}"`);
            res.send(buffer);
        } else {
            return res.status(404).json({
                success: false,
                message: 'File data not found'
            });
        }

    } catch (error) {
        console.error('Download standalone document error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while downloading document'
        });
    }
});

// Delete standalone document
router.delete('/user-documents/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;

        console.log('🗑️ User delete document request:', { userId: req.user.id, docId: id });

        // Get document info
        const result = await pool.query(
            'SELECT * FROM user_documents WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        const document = result.rows[0];

        // Delete from database (no file system deletion needed for Base64)
        await pool.query('DELETE FROM user_documents WHERE id = $1', [id]);

        console.log('✅ User document deleted:', document.title);

        res.json({
            success: true,
            message: 'Document deleted successfully'
        });

    } catch (error) {
        console.error('Delete standalone document error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while deleting document'
        });
    }
});

// Change password
router.post('/change-password', authenticateUser, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Verify current password
        const userResult = await pool.query(
            'SELECT password FROM kullanicilar WHERE id = $1',
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const bcrypt = require('bcryptjs');
        const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);

        if (!isValidPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await pool.query(
            'UPDATE users SET password = $1 WHERE id = $2',
            [hashedPassword, req.user.id]
        );

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while changing password'
        });
    }
});

// Notification settings
router.post('/notification-settings', authenticateUser, async (req, res) => {
    try {
        const { epostaNotifications, smsNotifications, marketingEmails, newsletter } = req.body;

        // Update user notification settings
        await pool.query(`
            UPDATE users SET 
                eposta_notifications = $1,
                sms_notifications = $2,
                marketing_epostas = $3,
                newsletter = $4
            WHERE id = $5
        `, [epostaNotifications, smsNotifications, marketingEmails, newsletter, req.user.id]);

        res.json({
            success: true,
            message: 'Notification settings updated successfully'
        });

    } catch (error) {
        console.error('Update notification settings error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating notification settings'
        });
    }
});

// Privacy settings
router.post('/privacy-settings', authenticateUser, async (req, res) => {
    try {
        const { profileVisibility, dataSharing, thirdPartyCookies, locationSharing } = req.body;

        // Update user privacy settings
        await pool.query(`
            UPDATE users SET 
                profile_visibility = $1,
                data_sharing = $2,
                third_party_cookies = $3,
                location_sharing = $4
            WHERE id = $5
        `, [profileVisibility, dataSharing, thirdPartyCookies, locationSharing, req.user.id]);

        res.json({
            success: true,
            message: 'Privacy settings updated successfully'
        });

    } catch (error) {
        console.error('Update privacy settings error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating privacy settings'
        });
    }
});

// Freeze account
router.post('/freeze-account', authenticateUser, async (req, res) => {
    try {
        await pool.query(
            'UPDATE users SET is_active = FALSE WHERE id = $1',
            [req.user.id]
        );

        res.json({
            success: true,
            message: 'Account frozen successfully'
        });

    } catch (error) {
        console.error('Freeze account error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while freezing account'
        });
    }
});

// Delete account
router.post('/delete-account', authenticateUser, async (req, res) => {
    try {
        const { password } = req.body;

        // Verify password
        const userResult = await pool.query(
            'SELECT password FROM kullanicilar WHERE id = $1',
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const bcrypt = require('bcryptjs');
        const isValidPassword = await bcrypt.compare(password, userResult.rows[0].password);

        if (!isValidPassword) {
            return res.status(400).json({
                success: false,
                message: 'Password is incorrect'
            });
        }

        // Delete user and all related data
        await pool.query('DELETE FROM kullanicilar WHERE id = $1', [req.user.id]);

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });

    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while deleting account'
        });
    }
});

// Get user files API
router.get('/api/files', authenticateUser, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                id, title, description, category, file_size, 
                original_filename, uploaded_at
            FROM user_documents 
            WHERE user_id = $1
            ORDER BY uploaded_at DESC
        `, [req.user.id]);

        res.json({
            success: true,
            files: result.rows
        });
    } catch (error) {
        console.error('Get files error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Upload user file API
router.post('/api/files/upload', authenticateUser, upload.single('file'), async (req, res) => {
    try {
        const { title, description } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Convert file to base64
        const fileBase64 = file.buffer.toString('base64');

        const result = await pool.query(
            `INSERT INTO user_documents 
            (user_id, title, description, file_data, file_size, 
             original_filename, mime_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
            [
                req.user.id,
                title,
                description || '',
                fileBase64,
                file.size,
                file.originalname,
                file.mimetype
            ]
        );

        res.json({
            success: true,
            message: 'File uploaded successfully',
            fileId: result.rows[0].id
        });
    } catch (error) {
        console.error('Upload file error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + error.message,
            error: error.message,
            stack: error.stack,
            details: error.toString(),
            fullError: JSON.stringify(error)
        });
    }
});

// Download user file API
router.get('/api/files/:id/download', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'SELECT file_data, mime_type, original_filename FROM user_documents WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        const file = result.rows[0];
        const fileBuffer = Buffer.from(file.file_data, 'base64');

        res.setHeader('Content-Type', file.mime_type);
        res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename}"`);
        res.send(fileBuffer);
    } catch (error) {
        console.error('Download file error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete user file API
router.delete('/api/files/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM user_documents WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =====================================================
// PAYMENT & SERVICES API ENDPOINTS
// =====================================================

// Get Stripe configuration (publishable key)
router.get('/stripe-config', authenticateUser, async (req, res) => {
    try {
        res.json({
            success: true,
            publishableKey: stripeConfig.stripePublishableKey
        });
    } catch (error) {
        console.error('Get Stripe config error:', error);
        res.status(500).json({
            success: false,
            message: 'Yapılandırma alınamadı'
        });
    }
});

// Get user's services (for payment)
router.get('/api/services', authenticateUser, async (req, res) => {
    try {
        console.log('📋 Fetching services for user:', req.user.id);
        
        // Get services - simple query first
        const servicesResult = await pool.query(`
            SELECT *
            FROM services
            WHERE user_id = $1
            ORDER BY 
                is_paid ASC,
                due_date ASC NULLS LAST,
                created_at DESC
        `, [req.user.id]);
        
        console.log('✅ Found', servicesResult.rows.length, 'services');

        // Get installments for each service
        const services = [];
        for (let service of servicesResult.rows) {
            const installmentsResult = await pool.query(`
                SELECT *
                FROM installments
                WHERE service_id = $1
                ORDER BY installment_number
            `, [service.id]);

            services.push({
                ...service,
                installments: installmentsResult.rows,
                has_installments: installmentsResult.rows.length > 0
            });
        }

        res.json({
            success: true,
            services: services
        });
    } catch (error) {
        console.error('Get services error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Hizmetler yüklenirken bir hata oluştu' 
        });
    }
});

// Create payment intent for a service
router.post('/api/services/:id/create-payment-intent', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { currency } = req.body;

        // Verify service belongs to user and is not paid
        const serviceResult = await pool.query(
            'SELECT * FROM services WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (serviceResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Hizmet bulunamadı'
            });
        }

        const service = serviceResult.rows[0];

        if (service.is_paid) {
            return res.status(400).json({
                success: false,
                message: 'Bu hizmet zaten ödenmiş'
            });
        }

        // Use provided currency or service's currency
        const paymentCurrency = currency || service.currency || 'EUR';

        // Validate currency
        if (!stripeConfig.supportedCurrencies.includes(paymentCurrency.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: 'Geçersiz para birimi'
            });
        }

        // Create payment intent
        const paymentIntent = await stripeConfig.createPaymentIntent(
            service.amount,
            paymentCurrency,
            {
                service_id: service.id,
                user_id: req.user.id,
                service_name: service.service_name
            }
        );

        // Update service with payment intent ID
        await pool.query(
            `UPDATE services 
             SET stripe_payment_intent_id = $1, 
                 stripe_payment_status = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [paymentIntent.id, paymentIntent.status, service.id]
        );

        // Log payment attempt
        await pool.query(
            `INSERT INTO payment_logs 
             (service_id, user_id, stripe_event_type, status, amount, currency, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                service.id,
                req.user.id,
                'payment_intent.created',
                paymentIntent.status,
                service.amount,
                paymentCurrency,
                JSON.stringify({ payment_intent_id: paymentIntent.id })
            ]
        );

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: service.amount,
            currency: paymentCurrency
        });
    } catch (error) {
        console.error('Create payment intent error:', error);
        res.status(500).json({
            success: false,
            message: 'Ödeme işlemi başlatılırken bir hata oluştu: ' + error.message
        });
    }
});

// Check payment status for a service
router.get('/api/services/:id/payment-status', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;

        const serviceResult = await pool.query(
            'SELECT * FROM services WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (serviceResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Hizmet bulunamadı'
            });
        }

        const service = serviceResult.rows[0];

        let paymentIntent = null;
        if (service.stripe_payment_intent_id) {
            try {
                paymentIntent = await stripeConfig.retrievePaymentIntent(
                    service.stripe_payment_intent_id
                );
            } catch (error) {
                console.error('Error retrieving payment intent:', error);
            }
        }

        res.json({
            success: true,
            service: {
                id: service.id,
                service_name: service.service_name,
                amount: service.amount,
                currency: service.currency,
                is_paid: service.is_paid,
                payment_date: service.payment_date,
                stripe_payment_status: service.stripe_payment_status,
                stripe_payment_intent_id: service.stripe_payment_intent_id
            },
            paymentIntent: paymentIntent ? {
                id: paymentIntent.id,
                status: paymentIntent.status,
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency
            } : null
        });
    } catch (error) {
        console.error('Get payment status error:', error);
        res.status(500).json({
            success: false,
            message: 'Ödeme durumu sorgulanırken bir hata oluştu'
        });
    }
});

// Get installments for a service
router.get('/api/services/:id/installments', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify service belongs to user
        const serviceResult = await pool.query(
            'SELECT * FROM services WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (serviceResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Hizmet bulunamadı'
            });
        }

        const installmentsResult = await pool.query(
            'SELECT * FROM installments WHERE service_id = $1 ORDER BY installment_number',
            [id]
        );

        res.json({
            success: true,
            installments: installmentsResult.rows
        });
    } catch (error) {
        console.error('Get installments error:', error);
        res.status(500).json({
            success: false,
            message: 'Taksitler yüklenirken bir hata oluştu'
        });
    }
});

// Get installment details
router.get('/api/installments/:id/details', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT i.*, s.service_name, s.currency, s.user_id
            FROM installments i
            JOIN services s ON i.service_id = s.id
            WHERE i.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Taksit bulunamadı'
            });
        }

        const installment = result.rows[0];

        // Verify ownership
        if (installment.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Bu taksit size ait değil'
            });
        }

        res.json({
            success: true,
            installment: {
                id: installment.id,
                service_name: installment.service_name,
                installment_number: installment.installment_number,
                amount: installment.amount,
                currency: installment.currency,
                due_date: installment.due_date,
                is_paid: installment.is_paid
            }
        });
    } catch (error) {
        console.error('Get installment details error:', error);
        res.status(500).json({
            success: false,
            message: 'Taksit bilgileri alınamadı'
        });
    }
});

// Create payment intent for an installment
router.post('/api/installments/:id/create-payment-intent', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { currency } = req.body;

        // Get installment and verify ownership
        const installmentResult = await pool.query(`
            SELECT i.*, s.user_id, s.currency as service_currency
            FROM installments i
            JOIN services s ON i.service_id = s.id
            WHERE i.id = $1
        `, [id]);

        if (installmentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Taksit bulunamadı'
            });
        }

        const installment = installmentResult.rows[0];

        if (installment.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Bu taksit size ait değil'
            });
        }

        if (installment.is_paid) {
            return res.status(400).json({
                success: false,
                message: 'Bu taksit zaten ödenmiş'
            });
        }

        // Use provided currency or service's currency
        const paymentCurrency = currency || installment.service_currency || 'EUR';

        // Create payment intent
        const paymentIntent = await stripeConfig.createPaymentIntent(
            installment.amount,
            paymentCurrency,
            {
                installment_id: installment.id,
                service_id: installment.service_id,
                user_id: req.user.id,
                installment_number: installment.installment_number
            }
        );

        // Update installment with payment intent ID
        await pool.query(
            `UPDATE installments 
             SET updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [installment.id]
        );

        // Log payment attempt
        await pool.query(
            `INSERT INTO payment_logs 
             (service_id, user_id, stripe_event_type, status, amount, currency, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                installment.service_id,
                req.user.id,
                'installment_payment_intent.created',
                paymentIntent.status,
                installment.amount,
                paymentCurrency,
                JSON.stringify({ 
                    payment_intent_id: paymentIntent.id,
                    installment_id: installment.id,
                    installment_number: installment.installment_number
                })
            ]
        );

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: installment.amount,
            currency: paymentCurrency
        });
    } catch (error) {
        console.error('Create installment payment intent error:', error);
        res.status(500).json({
            success: false,
            message: 'Taksit ödemesi başlatılırken bir hata oluştu: ' + error.message
        });
    }
});

module.exports = router; 