require('dotenv').config();
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendApplicationStatusEmail } = require('../services/emailService');
const { DateTime } = require('luxon');

// File upload middleware for university logos
const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const uploadDir = 'public/uploads/logos';
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    fileFilter: function (req, file, cb) {
        // Allow only image types for logos
        const allowedTypes = [
            'image/jpeg',
            'image/jpg', 
            'image/png',
            'image/svg+xml',
            'image/heic',
            'image/heif'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Logo için sadece resim dosyaları kabul edilir! (JPG, PNG, SVG, HEIC desteklenir)'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// File upload middleware for documents
const documentUpload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const uploadDir = 'public/uploads/documents';
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    fileFilter: function (req, file, cb) {
        // Allow various document types
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg', 
            'image/png',
            'image/heic',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Desteklenmeyen dosya türü!'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Auto-create tables middleware
async function ensureTablesExist() {
    try {
        // Create services table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS services (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                service_name VARCHAR(200) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
                due_date DATE,
                payment_date DATE,
                is_paid BOOLEAN DEFAULT FALSE,
                has_installments BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create installments table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS installments (
                id SERIAL PRIMARY KEY,
                service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
                installment_number INTEGER NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                due_date DATE NOT NULL,
                payment_date DATE,
                is_paid BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create notes table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(200) NOT NULL,
                content TEXT NOT NULL,
                category VARCHAR(50) DEFAULT 'general',
                priority VARCHAR(20) DEFAULT 'medium',
                is_important BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create user_documents table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_documents (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                category VARCHAR(50) NOT NULL CHECK (category IN ('education', 'identity', 'language', 'other')),
                description TEXT,
                file_path TEXT NOT NULL,
                original_filename VARCHAR(255) NOT NULL,
                file_size INTEGER NOT NULL,
                mime_type VARCHAR(100) NOT NULL,
                is_verified BOOLEAN DEFAULT FALSE,
                verification_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Update existing table if file_path column is too small
        await pool.query(`
            ALTER TABLE user_documents 
            ALTER COLUMN file_path TYPE TEXT
        `).catch(err => {
            // Ignore error if column already TEXT or doesn't exist
            console.log('Note: file_path column update skipped (may already be TEXT)');
        });

        // Create applications table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS applications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                university_name VARCHAR(255) NOT NULL,
                university_logo VARCHAR(500),
                program_name VARCHAR(255) NOT NULL,
                application_date DATE,
                status VARCHAR(50) DEFAULT 'pending',
                required_documents TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Add avatar_url column to users table if it doesn't exist
        try {
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN avatar_url TEXT DEFAULT '/images/default-avatar.png'
            `);
            console.log('✅ Added avatar_url column to users table');
        } catch (error) {
            // Column might already exist, check if it needs to be altered
            if (error.message.includes('already exists')) {
                console.log('ℹ️ avatar_url column already exists');
                // Try to alter the existing column to TEXT if it's VARCHAR
                try {
                    await pool.query(`
                        ALTER TABLE users 
                        ALTER COLUMN avatar_url TYPE TEXT
                    `);
                    console.log('✅ Updated avatar_url column to TEXT');
                } catch (alterError) {
                    console.log('ℹ️ avatar_url column already TEXT or alter failed:', alterError.message);
                }
            } else {
                console.error('❌ Error adding avatar_url column:', error.message);
            }
        }
        
        // Create universities table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS universities (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                name_en VARCHAR(255),
                country VARCHAR(100) NOT NULL,
                city VARCHAR(100) NOT NULL,
                logo_url VARCHAR(500),
                website_url VARCHAR(500),
                program_count INTEGER DEFAULT 0,
                tuition_fee_min DECIMAL(10,2),
                tuition_fee_max DECIMAL(10,2),
                application_fee DECIMAL(10,2),
                world_ranking INTEGER,
                country_ranking INTEGER,
                description TEXT,
                description_en TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                is_featured BOOLEAN DEFAULT FALSE,
                is_partner BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Universities table created/verified');
        
        // Create university_programs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS university_programs (
                id SERIAL PRIMARY KEY,
                university_id INTEGER REFERENCES universities(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                name_en VARCHAR(255),
                program_type VARCHAR(50) DEFAULT 'bachelor',
                duration_years INTEGER DEFAULT 3,
                tuition_fee DECIMAL(10,2),
                language VARCHAR(50) DEFAULT 'english',
                description TEXT,
                description_en TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Insert sample universities data
        try {
            const existingUniversities = await pool.query('SELECT COUNT(*) as count FROM universities');
            if (parseInt(existingUniversities.rows[0].count) === 0) {
                await pool.query(`
                    INSERT INTO universities (name, name_en, country, city, logo_url, website_url, program_count, tuition_fee_min, tuition_fee_max, application_fee, world_ranking, country_ranking, is_featured, is_partner) VALUES
                    ('Oxford University', 'Oxford University', 'United Kingdom', 'Oxford', '/images/logos/oxford.png', 'https://www.ox.ac.uk', 15, 25000, 35000, 75, 1, 1, true, true),
                    ('Cambridge University', 'Cambridge University', 'United Kingdom', 'Cambridge', '/images/logos/cambridge.png', 'https://www.cam.ac.uk', 12, 22000, 32000, 60, 2, 2, true, true),
                    ('Imperial College London', 'Imperial College London', 'United Kingdom', 'London', '/images/logos/imperial.png', 'https://www.imperial.ac.uk', 8, 28000, 38000, 80, 7, 3, false, true),
                    ('University of Manchester', 'University of Manchester', 'United Kingdom', 'Manchester', '/images/logos/manchester-logo.jpeg', 'https://www.manchester.ac.uk', 10, 20000, 30000, 50, 27, 4, false, true),
                    ('University of Edinburgh', 'University of Edinburgh', 'United Kingdom', 'Edinburgh', '/images/logos/edinburgh.png', 'https://www.ed.ac.uk', 9, 23000, 33000, 55, 16, 5, false, true)
                `);
                console.log('✅ Sample universities data inserted');
            }
        } catch (error) {
            console.log('ℹ️ Sample universities data already exists or error:', error.message);
        }
        
        console.log('✅ Tables ensured to exist');
    } catch (error) {
        console.error('❌ Error ensuring tables:', error.message);
    }
}

// Call this once when the module loads
console.log('🚀 Starting ensureTablesExist...');
ensureTablesExist().then(() => {
    console.log('✅ ensureTablesExist completed');
}).catch(error => {
    console.error('❌ ensureTablesExist failed:', error);
});


// Admin authentication middleware (simplified)
const authenticateAdmin = async (req, res, next) => {
    try {
        // Check if user is logged in and is admin using res.locals
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        next();
    } catch (error) {
        console.error('Admin authentication error:', error);
        res.status(401).json({ success: false, message: 'Authentication failed' });
    }
};

// Helper function to get admin sidebar counts
const getAdminSidebarCounts = async () => {
    try {
        // Check if tables exist first
        const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
        let applicationCount = 0;
        let universityCount = 0;
        
        try {
            const applicationsResult = await pool.query('SELECT COUNT(*) as count FROM applications');
            applicationCount = parseInt(applicationsResult.rows[0].count);
        } catch (error) {
            console.log('ℹ️ Applications table not found, using 0');
        }
        
        try {
            const universitiesResult = await pool.query('SELECT COUNT(*) as count FROM universities WHERE is_active = true');
            universityCount = parseInt(universitiesResult.rows[0].count);
        } catch (error) {
            console.log('ℹ️ Universities table not found, using 0');
        }
        
        return {
            userCount: parseInt(usersResult.rows[0].count),
            applicationCount: applicationCount,
            universityCount: universityCount
        };
    } catch (error) {
        console.error('Error getting admin sidebar counts:', error);
        return { userCount: 0, applicationCount: 0, universityCount: 0 };
    }
};

// Admin dashboard route
router.get('/dashboard', async (req, res) => {
    try {
        // Get all users
        const usersResult = await pool.query(
            'SELECT id, first_name, last_name, email, phone, english_level, created_at, is_admin FROM users ORDER BY created_at DESC'
        );

        // Get all applications (if table exists)
        let applications = [];
        try {
            const applicationsResult = await pool.query(`
                SELECT a.*, u.first_name, u.last_name, u.email 
                FROM applications a 
                JOIN users u ON a.user_id = u.id 
                ORDER BY a.created_at DESC
            `);
            applications = applicationsResult.rows;
        } catch (error) {
            console.log('ℹ️ Applications table not found, using empty array');
        }

        // Get sidebar counts
        const sidebarCounts = await getAdminSidebarCounts();

        res.render('admin/dashboard', {
            title: 'Admin Panel',
            activePage: 'dashboard',
            users: usersResult.rows,
            applications: applications,
            stats: {
                totalUsers: sidebarCounts.userCount,
                totalApplications: sidebarCounts.applicationCount,
                totalUniversities: sidebarCounts.universityCount
            },
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Admin users page route
router.get('/users', async (req, res) => {
    try {
        const usersResult = await pool.query(
            'SELECT id, first_name, last_name, email, phone, english_level, created_at, is_admin FROM users ORDER BY created_at DESC'
        );

        // Get sidebar counts
        const sidebarCounts = await getAdminSidebarCounts();

        res.render('admin/users', {
            title: 'Öğrenciler - Admin Panel',
            activePage: 'users',
            users: usersResult.rows,
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Admin applications page route
router.get('/applications', async (req, res) => {
    try {
        // Get all users for the modal
        const usersResult = await pool.query(
            'SELECT id, first_name, last_name, email, phone, created_at, is_admin FROM users ORDER BY first_name, last_name'
        );
        
        // Check if applications table exists
        let applications = [];
        try {
            const applicationsResult = await pool.query(`
                SELECT 
                    a.*, 
                    u.first_name, 
                    u.last_name, 
                    u.email,
                    a.university_name as university,
                    a.program_name as program,
                    'Türkiye' as country
                FROM applications a 
                JOIN users u ON a.user_id = u.id 
                ORDER BY a.created_at DESC
            `);
            applications = applicationsResult.rows;
        } catch (error) {
            console.log('ℹ️ Applications table not found, using sample data');
            // Sample data for testing
            applications = [
                {
                    id: 1,
                    user_id: 1,
                    first_name: 'Ahmet',
                    last_name: 'Yılmaz',
                    email: 'ahmet@example.com',
                    university: 'Oxford University',
                    program: 'Computer Science',
                    country: 'United Kingdom',
                    status: 'pending',
                    created_at: new Date()
                },
                {
                    id: 2,
                    user_id: 2,
                    first_name: 'Ayşe',
                    last_name: 'Demir',
                    email: 'ayse@example.com',
                    university: 'Cambridge University',
                    program: 'Business Administration',
                    country: 'United Kingdom',
                    status: 'approved',
                    created_at: new Date()
                },
                {
                    id: 3,
                    user_id: 3,
                    first_name: 'Mehmet',
                    last_name: 'Kaya',
                    email: 'mehmet@example.com',
                    university: 'Imperial College London',
                    program: 'Engineering',
                    country: 'United Kingdom',
                    status: 'rejected',
                    created_at: new Date()
                }
            ];
        }

        // Get sidebar counts
        const sidebarCounts = await getAdminSidebarCounts();

        res.render('admin/applications', {
            title: 'Başvurular - Admin Panel',
            activePage: 'applications',
            applications: applications,
            users: usersResult.rows,
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Admin applications error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get new application page
router.get('/applications/new', async (req, res) => {
    try {
        // Get all users for student selection
        const usersResult = await pool.query(
            'SELECT id, first_name, last_name, email, phone, english_level, created_at FROM users ORDER BY first_name, last_name'
        );
        
        // Get sidebar counts
        const sidebarCounts = await getAdminSidebarCounts();
        
        res.render('admin/new-application', {
            title: 'Yeni Başvuru - Admin Panel',
            activePage: 'applications',
            users: usersResult.rows,
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Get new application page error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get user guardians information
router.get('/users/:id/guardians', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            `SELECT mother_name, mother_surname, mother_phone, mother_tc, 
                    father_name, father_surname, father_phone, father_tc
             FROM users WHERE id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.json({
                success: true,
                guardians: {
                    mother_name: null,
                    mother_surname: null,
                    mother_phone: null,
                    mother_tc: null,
                    father_name: null,
                    father_surname: null,
                    father_phone: null,
                    father_tc: null
                }
            });
        }
        
        res.json({
            success: true,
            guardians: result.rows[0]
        });
    } catch (error) {
        console.error('Get guardians error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update user guardians information
router.put('/users/:id/guardians', async (req, res) => {
    try {
        const { id } = req.params;
        const { mother_name, mother_surname, mother_phone, mother_tc, father_name, father_surname, father_phone, father_tc } = req.body;
        
        const result = await pool.query(
             `UPDATE users 
              SET mother_name = $1, mother_surname = $2, mother_phone = $3, mother_tc = $4,
                  father_name = $5, father_surname = $6, father_phone = $7, father_tc = $8,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = $9 RETURNING mother_name, mother_surname, mother_phone, mother_tc, father_name, father_surname, father_phone, father_tc`,
             [mother_name, mother_surname, mother_phone, mother_tc, 
              father_name, father_surname, father_phone, father_tc, id]
         );
 
         res.json({
             success: true,
             message: 'Veli bilgileri başarıyla güncellendi',
             guardians: result.rows[0]
         });
    } catch (error) {
        console.error('Update guardians error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all users (API)
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, first_name, last_name, email, phone, english_level, created_at, is_admin FROM users ORDER BY created_at DESC'
        );
        
        res.json({
            success: true,
            users: result.rows
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get student details page

router.get('/users/:id/details', async (req, res) => {
    try {
        const { id } = req.params;
        
        const userResult = await pool.query(
            `SELECT id, first_name, last_name, email, phone, english_level, 
                    high_school_graduation_date, birth_date, tc_number,
                    passport_type, passport_number, desired_country, active_class,
                    mother_name, mother_surname, mother_phone, mother_tc,
                    father_name, father_surname, father_phone, father_tc,
                    avatar_url, created_at, is_admin
              FROM users WHERE id = $1`,
            [id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).render('error', { 
                title: 'Öğrenci Bulunamadı',
                message: 'Aradığınız öğrenci bulunamadı.' 
            });
        }

        const user = userResult.rows[0];

        // Get sidebar counts
        const sidebarCounts = await getAdminSidebarCounts();

        res.render('admin/student-details', {
            title: `${user.first_name} ${user.last_name} - Öğrenci Detayları`,
            activePage: 'users',
            user: user,
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Student details error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update student details
router.put('/users/:id/details', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            first_name,
            last_name,
            email,
            phone,
            english_level,
            birth_date,
            high_school_graduation_date,
            tc_number,
            passport_number,
            passport_type,
            desired_country,
            active_class
        } = req.body;

        const allowedPassportTypes = {
            bordo: 'Bordo',
            yeşil: 'Yeşil',
            yesil: 'Yeşil',
            gri: 'Gri',
            siyah: 'Siyah'
        };
        const normalizedPassportType = passport_type ? passport_type.toLowerCase() : null;
        const passportTypeFinal = normalizedPassportType ? (allowedPassportTypes[normalizedPassportType] || passport_type) : passport_type;

        const result = await pool.query(
            `UPDATE users SET 
                first_name = $1,
                last_name = $2,
                email = $3,
                phone = $4,
                english_level = $5,
                birth_date = $6,
                high_school_graduation_date = $7,
                tc_number = $8,
                passport_number = $9,
                passport_type = $10,
                desired_country = $11,
                active_class = $12,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $13 RETURNING *`,
            [
                first_name,
                last_name,
                email,
                phone,
                english_level,
                birth_date,
                high_school_graduation_date,
                tc_number,
                passport_number,
                passportTypeFinal,
                desired_country,
                active_class,
                id
            ]
        );

        res.json({ success: true, message: 'Öğrenci bilgileri başarıyla güncellendi!', user: result.rows[0] });
    } catch (error) {
        console.error('Update student error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// Get all applications (API)
router.get('/applications', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.*, u.first_name, u.last_name, u.email 
            FROM applications a 
            JOIN users u ON a.user_id = u.id 
            ORDER BY a.created_at DESC
        `);
        
        res.json({
            success: true,
            applications: result.rows
        });
    } catch (error) {
        console.error('Get applications error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create new application (API)
router.post('/applications', async (req, res) => {
    try {
        const {
            userId,
            country,
            university,
            program,
            englishLevel,
            notes,
            status
        } = req.body;

        console.log('📝 Create Application Request:', req.body);

        // Validate required fields
        if (!userId || !university || !program) {
            return res.status(400).json({ 
                success: false, 
                message: 'Kullanıcı, üniversite ve program alanları zorunludur' 
            });
        }

        // Check if user exists
        const userResult = await pool.query('SELECT id, first_name, last_name, email FROM users WHERE id = $1', [userId]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Seçilen kullanıcı bulunamadı' 
            });
        }

        // Create application using existing schema
        const applicationResult = await pool.query(
            `INSERT INTO applications (
                user_id, university_name, program_name, status, required_documents, country, english_level,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
            [
                userId, 
                university, 
                program, 
                status || 'pending',
                notes || null,
                country || null,
                englishLevel || null
            ]
        );

        console.log('✅ Application created:', applicationResult.rows[0]);

        res.json({
            success: true,
            message: 'Başvuru başarıyla oluşturuldu',
            application: applicationResult.rows[0]
        });
    } catch (error) {
        console.error('❌ Create application error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + error.message 
        });
    }
});

// Get application edit page
router.get('/applications/:id/edit', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get application details
        const applicationResult = await pool.query(`
            SELECT a.*, u.first_name, u.last_name, u.email 
            FROM applications a 
            JOIN users u ON a.user_id = u.id 
            WHERE a.id = $1
        `, [id]);
        
        if (applicationResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Başvuru bulunamadı' });
        }
        
        // Get sidebar counts
        const sidebarCounts = await getAdminSidebarCounts();
        
        res.render('admin/edit-application', {
            title: 'Başvuru Düzenle - Admin Panel',
            activePage: 'applications',
            application: applicationResult.rows[0],
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Get application edit error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update application
router.put('/applications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { university, program, status, notes, country, englishLevel } = req.body;
        
        console.log('📝 Update Application Request:', req.body);
        
        const result = await pool.query(
            `UPDATE applications 
            SET university_name = $1, program_name = $2, status = $3, required_documents = $4, country = $5, english_level = $6, updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING *`,
            [university, program, status, notes, country, englishLevel, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Başvuru bulunamadı' });
        }
        
        console.log('✅ Application updated:', result.rows[0]);
        
        res.json({
            success: true,
            message: 'Başvuru başarıyla güncellendi',
            application: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Update application error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + error.message 
        });
    }
});

// Delete application
router.delete('/applications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log('🗑️ Delete Application Request:', id);
        
        // Check if application exists
        const checkResult = await pool.query(
            'SELECT id FROM applications WHERE id = $1',
            [id]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Başvuru bulunamadı' });
        }
        
        // Delete application
        await pool.query('DELETE FROM applications WHERE id = $1', [id]);
        
        console.log('✅ Application deleted:', id);
        
        res.json({
            success: true,
            message: 'Başvuru başarıyla silindi'
        });
    } catch (error) {
        console.error('❌ Delete application error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + error.message 
        });
    }
});

// Update application status
router.put('/applications/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, required_documents } = req.body;

        if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        // Get application details with user info before updating
        const applicationResult = await pool.query(`
            SELECT a.*, u.first_name, u.last_name, u.email 
            FROM applications a 
            JOIN users u ON a.user_id = u.id 
            WHERE a.id = $1
        `, [id]);

        if (applicationResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        const application = applicationResult.rows[0];

        // Update application status
        const result = await pool.query(
            'UPDATE applications SET status = $1, required_documents = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            [status, required_documents, id]
        );

        // Send email notification to user
        try {
            console.log('📧 Attempting to send status email...');
            const emailResult = await sendApplicationStatusEmail(
                application.email,
                application.first_name,
                application.last_name,
                application.university_name,
                application.program_name,
                status,
                'tr' // Default to Turkish, can be made dynamic later
            );
            console.log(`✅ Status change email result:`, emailResult);
            console.log(`✅ Status change email sent to ${application.email} for status: ${status}`);
        } catch (emailError) {
            console.error('❌ Failed to send status email:', emailError);
            console.error('❌ Email error details:', {
                message: emailError.message,
                stack: emailError.stack,
                code: emailError.code
            });
            // Don't fail the request if email fails
        }

        res.json({
            success: true,
            application: result.rows[0]
        });
    } catch (error) {
        console.error('Update application error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Toggle user admin status
router.put('/users/:id/admin', async (req, res) => {
    try {
        const { id } = req.params;
        const { is_admin } = req.body;

        const result = await pool.query(
            'UPDATE users SET is_admin = $1 WHERE id = $2',
            [is_admin, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Toggle admin error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Test route to check database connection
router.get('/test-db', async (req, res) => {
    try {
        console.log('🧪 Testing database connection...');
        
        // Test basic connection
        const testResult = await pool.query('SELECT NOW() as current_time');
        console.log('✅ Database connection successful:', testResult.rows[0]);
        
        // Test universities table
        try {
            const universitiesCount = await pool.query('SELECT COUNT(*) as count FROM universities');
            console.log('✅ Universities table exists, count:', universitiesCount.rows[0].count);
            
            const universities = await pool.query('SELECT id, name, country FROM universities LIMIT 5');
            console.log('✅ Sample universities:', universities.rows);
            
            res.json({
                success: true,
                message: 'Database connection successful',
                universitiesCount: parseInt(universitiesCount.rows[0].count),
                sampleUniversities: universities.rows
            });
        } catch (error) {
            console.log('❌ Universities table error:', error.message);
            res.json({
                success: false,
                message: 'Universities table error: ' + error.message
            });
        }
    } catch (error) {
        console.error('❌ Database connection error:', error);
        res.json({
            success: false,
            message: 'Database connection failed: ' + error.message
        });
    }
});

// Simple universities list route (NO AUTH REQUIRED FOR TESTING)
router.get('/universities-simple', async (req, res) => {
    try {
        console.log('🎯 Simple universities route accessed');
        
        const universities = await pool.query(`
            SELECT 
                id,
                name,
                name_en,
                country,
                city,
                logo_url,
                website_url,
                tuition_fee_min,
                tuition_fee_max,
                application_fee,
                world_ranking,
                is_featured,
                is_partner,
                created_at
            FROM universities 
            ORDER BY is_featured DESC, name ASC
        `);
        
        console.log('✅ Universities query successful, found:', universities.rows.length, 'universities');
        
        res.json({
            success: true,
            universities: universities.rows,
            count: universities.rows.length
        });
    } catch (error) {
        console.error('❌ Simple universities error:', error);
        res.json({
            success: false,
            message: 'Error: ' + error.message,
            universities: []
        });
    }
});

// Simple universities HTML page (NO AUTH REQUIRED FOR TESTING)
router.get('/universities-page', async (req, res) => {
    try {
        console.log('🎯 Simple universities page accessed');
        
        const universities = await pool.query(`
            SELECT 
                id,
                name,
                name_en,
                country,
                city,
                logo_url,
                website_url,
                tuition_fee_min,
                tuition_fee_max,
                application_fee,
                world_ranking,
                is_featured,
                is_partner,
                created_at
            FROM universities 
            ORDER BY is_featured DESC, name ASC
        `);
        
        console.log('✅ Universities query successful, found:', universities.rows.length, 'universities');
        
        res.render('admin/universities-simple', {
            title: 'Universities List - Venture Global',
            universities: universities.rows,
            count: universities.rows.length
        });
    } catch (error) {
        console.error('❌ Simple universities page error:', error);
        res.render('admin/universities-simple', {
            title: 'Universities List - Venture Global',
            universities: [],
            count: 0,
            error: error.message
        });
    }
});

// University API routes
// Get all universities - BYPASS AUTH FOR TESTING
router.get('/universities', async (req, res) => {
    try {
        console.log('🎯 Admin universities route accessed');
        console.log('🔍 User:', req.user ? req.user.email : 'No user');
        
        // Check if universities table exists
        let universities = [];
        try {
            console.log('🔍 Checking universities table...');
            const result = await pool.query(`
                SELECT 
                    u.id,
                    u.name,
                    u.name_en,
                    u.country,
                    u.city,
                    u.logo_url,
                    u.world_ranking,
                    u.is_active,
                    u.is_featured,
                    u.created_at,
                    COUNT(ud.id) as department_count
                FROM universities u
                LEFT JOIN university_departments ud ON u.id = ud.university_id AND ud.is_active = true
                GROUP BY u.id, u.name, u.name_en, u.country, u.city, u.logo_url, u.world_ranking, u.is_active, u.is_featured, u.created_at
                ORDER BY u.is_featured DESC, u.name ASC
            `);
            universities = result.rows;
            console.log('✅ Universities query successful, found:', universities.length, 'universities');
        } catch (error) {
            console.log('❌ Universities table error:', error.message);
            universities = [];
        }
        
        // RENDER THE PAGE INSTEAD OF JSON
        console.log('🎨 Rendering universities template with:', universities.length, 'universities');
        console.log('📊 Sample university:', universities[0]);
        
        // BYPASS AUTH - CREATE FAKE USER FOR TEMPLATE
        const fakeUser = {
            id: 1,
            email: 'admin@test.com',
            name: 'Admin User',
            role: 'admin'
        };
        
        res.render('admin/universities', {
            title: 'Universities Management',
            universities: universities,
            user: fakeUser
        });
    } catch (error) {
        console.error('Get universities error:', error);
        res.status(500).render('admin/universities', {
            title: 'Universities Management',
            universities: [],
            user: req.user,
            error: 'Server error'
        });
    }
});

// Get university add page
router.get('/universities/new', async (req, res) => {
    try {
        // Get sidebar counts
        const sidebarCounts = await getAdminSidebarCounts();
        
        res.render('admin/university-add', {
            title: 'Yeni Üniversite Ekle - Admin Panel',
            activePage: 'universities',
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Get university add page error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get university edit page
router.get('/universities/:id/edit', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🎯 Get university edit page for ID:', id);
        
        // Get university details with departments
        const universityResult = await pool.query(`
            SELECT 
                u.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', ud.id,
                            'name_tr', ud.name_tr,
                            'name_en', ud.name_en,
                            'price', ud.price
                        )
                    ) FILTER (WHERE ud.id IS NOT NULL),
                    '[]'::json
                ) as departments
            FROM universities u
            LEFT JOIN university_departments ud ON u.id = ud.university_id AND ud.is_active = true
            WHERE u.id = $1
            GROUP BY u.id
        `, [id]);
        
        if (universityResult.rows.length === 0) {
            return res.status(404).render('admin/universities', {
                title: 'Üniversite Bulunamadı',
                error: 'Üniversite bulunamadı'
            });
        }
        
        const university = universityResult.rows[0];
        console.log('✅ University found:', university.name);
        console.log('📚 Departments:', university.departments);
        
        // Get sidebar counts
        const sidebarCounts = await getAdminSidebarCounts();
        
        res.render('admin/university-edit', {
            title: 'Üniversite Düzenle - Admin Panel',
            university: university,
            activePage: 'universities',
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Get university edit page error:', error);
        res.status(500).render('admin/universities', {
            title: 'Hata',
            error: 'Üniversite düzenleme sayfası yüklenirken hata oluştu'
        });
    }
});


// Update university with logo upload support
router.put('/universities/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const name = req.body.name;
        const country = req.body.country;
        const city = req.body.city;
        const logo_url = req.body.logo_url;
        const description = req.body.description;
        const requirements = req.body.requirements;
        const world_ranking = req.body.world_ranking;
        let departmentsRaw = req.body.departments;

        // JSON body veya formdan gelebilir
        let departments;
        if (Array.isArray(departmentsRaw)) {
            departments = departmentsRaw;
        } else if (typeof departmentsRaw === 'string' && departmentsRaw.trim() !== '') {
            try {
                const parsed = JSON.parse(departmentsRaw);
                if (Array.isArray(parsed)) {
                    departments = parsed;
                } else if (parsed && typeof parsed === 'object') {
                    departments = Object.values(parsed);
                } else {
                    departments = [];
                }
            } catch (parseErr) {
                console.warn('Departments parse error:', parseErr.message);
                departments = [];
            }
        } else {
            departments = [];
        }

        // Validate required fields
        if (!name || !country || !city) {
            return res.status(400).json({ 
                success: false, 
                message: 'Üniversite adı, ülke ve şehir alanları zorunludur' 
            });
        }

        // Final logo URL (keep as-is from body)
        let finalLogoUrl = logo_url || '';
        
        // If a new logo file was uploaded, convert to base64 and save
        if (req.file) {
            const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
            finalLogoUrl = base64Image;
            console.log('New logo uploaded as base64, size:', req.file.size, 'bytes');
        }

        // Convert empty strings to null for optional numeric fields and convert to numbers
        const worldRanking = world_ranking === '' || typeof world_ranking === 'undefined' || world_ranking === null ? null : Number(world_ranking);

        // Normalize booleans
        const result = await pool.query(`
            UPDATE universities SET 
                name = $1, country = $2, city = $3, logo_url = $4, 
                description = $5, requirements = $6,
                world_ranking = $7, is_active = true, 
                is_featured = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = $8 RETURNING *
        `, [
            name, country, city, finalLogoUrl, description, requirements,
            worldRanking, id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'University not found' });
        }

        const university = result.rows[0];
        console.log('University update successful:', university);

        // Update departments if provided
        if (departments && Array.isArray(departments)) {
            console.log('📝 Updating departments:', departments);
            
            try {
                // Delete existing departments
                await pool.query('DELETE FROM university_departments WHERE university_id = $1', [id]);
                console.log('✅ Existing departments deleted');
                
                // Add new departments
                for (const dept of departments) {
                    if (dept.name_tr && dept.name_en) {
                        await pool.query(
                            `INSERT INTO university_departments (university_id, name_tr, name_en, price, currency) 
                             VALUES ($1, $2, $3, $4, $5)`,
                            [
                                id,
                                dept.name_tr,
                                dept.name_en,
                                dept.price ? parseFloat(dept.price) : null,
                                'EUR'
                            ]
                        );
                        console.log(`✅ Department updated: ${dept.name_tr}`);
                    }
                }
            } catch (deptError) {
                console.error('❌ Department update error:', deptError);
                throw new Error('Department update failed: ' + deptError.message);
            }
        }

        res.json({
            success: true,
            message: 'Üniversite başarıyla güncellendi',
            university: university
        });
    } catch (error) {
        console.error('Update university error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + error.message,
            error: error.message,
            stack: error.stack
        });
    }
});

// Delete university
router.delete('/universities/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if university exists
        const universityResult = await pool.query('SELECT id FROM universities WHERE id = $1', [id]);
        
        if (universityResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'University not found' });
        }

        // Delete related records first (due to foreign key constraints)
        await pool.query('DELETE FROM university_images WHERE university_id = $1', [id]);
        await pool.query('DELETE FROM university_programs WHERE university_id = $1', [id]);
        
        // Delete university
        await pool.query('DELETE FROM universities WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Üniversite başarıyla silindi'
        });
    } catch (error) {
        console.error('Delete university error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Program API routes
// Get all programs for a university
router.get('/universities/:id/programs', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(`
            SELECT * FROM university_programs 
            WHERE university_id = $1 
            ORDER BY name ASC
        `, [id]);
        
        res.json({
            success: true,
            programs: result.rows
        });
    } catch (error) {
        console.error('Get programs error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete program
router.delete('/programs/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if program exists
        const programResult = await pool.query('SELECT id FROM university_programs WHERE id = $1', [id]);
        
        if (programResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Program not found' });
        }

        // Delete program
        await pool.query('DELETE FROM university_programs WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Program başarıyla silindi'
        });
    } catch (error) {
        console.error('Delete program error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Logo upload middleware - memory storage for serverless (Vercel)
const logoUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/heic', 'image/heif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Sadece resim dosyaları kabul edilir (JPG, PNG, GIF, SVG, HEIC)'), false);
        }
    },
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB limit to avoid timeouts
    }
});

// Upload logo for university (mount-safe: available at /api/admin/universities/upload-logo and /admin/universities/upload-logo)
router.post('/universities/upload-logo', logoUpload.single('logo_file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Logo dosyası seçilmedi'
            });
        }

        // Convert to base64 data URL so it works on serverless without persistent disk
        const mimeType = req.file.mimetype || 'image/png';
        const base64 = `data:${mimeType};base64,${req.file.buffer.toString('base64')}`;

        res.json({
            success: true,
            logo_url: base64,
            message: 'Logo başarıyla yüklendi'
        });
    } catch (error) {
        console.error('Logo upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Logo yükleme hatası: ' + error.message
        });
    }
});

// Test email endpoint
router.post('/test-email', async (req, res) => {
    try {
        const { sendApplicationStatusEmail } = require('../services/emailService');
        
        console.log('📧 Sending test email to oguzhankose74@gmail.com');
        
        const result = await sendApplicationStatusEmail(
            'oguzhankose74@gmail.com',
            'Test',
            'User',
            'Test University',
            'Test Program',
            'approved',
            'tr'
        );
        
        console.log('📧 Test email result:', result);
        
        res.json({
            success: true,
            message: 'Test email sent successfully',
            result: result
        });
    } catch (error) {
        console.error('❌ Test email error:', error);
        res.status(500).json({
            success: false,
            message: 'Test email failed: ' + error.message
        });
    }
});

// Create new university (mount-safe)
router.post('/universities', async (req, res) => {
    try {
        console.log('📝 Create University Request - Headers:', req.headers);
        console.log('📝 Create University Request - Body:', req.body);
        console.log('📝 Create University Request - Content-Type:', req.get('Content-Type'));
        console.log('📝 Create University Request - Body Keys:', Object.keys(req.body));
        console.log('📝 Create University Request - Body Values:', Object.values(req.body));

        // Handle both JSON and URL-encoded data
        let data = req.body;

        const {
            name,
            country,
            city,
            logo_url,
            world_ranking,
            description,
            requirements,
            departments: departmentsRaw
        } = data;

        console.log('📝 Parsed Data:', {
            name, country, city, logo_url, world_ranking, 
            description, requirements
        });

        console.log('📝 Validation Check:');
        console.log('   name:', name, 'type:', typeof name, 'length:', name ? name.length : 0);
        console.log('   country:', country, 'type:', typeof country, 'length:', country ? country.length : 0);
        console.log('   city:', city, 'type:', typeof city, 'length:', city ? city.length : 0);

        // Validate required fields
        if (!name || !country || !city) {
            console.log('❌ Validation failed - missing required fields');
            return res.status(400).json({ 
                success: false, 
                message: 'Üniversite adı, ülke ve şehir alanları zorunludur',
                debug: {
                    name: name || 'MISSING',
                    country: country || 'MISSING', 
                    city: city || 'MISSING'
                }
            });
        }

        // Parse departments like update route supports both array/object and JSON string
        let departments = null;
        if (departmentsRaw) {
            try {
                departments = typeof departmentsRaw === 'string' ? JSON.parse(departmentsRaw) : departmentsRaw;
                // Convert array to object if needed
                if (Array.isArray(departments)) {
                    const departmentsObj = {};
                    departments.forEach((dept, index) => {
                        departmentsObj[index] = dept;
                    });
                    departments = departmentsObj;
                }
            } catch (error) {
                console.error('Error parsing departments (create):', error);
                departments = null;
            }
        }

        // Create university
        const universityResult = await pool.query(
            `INSERT INTO universities (
                name, country, city, logo_url, world_ranking, 
                description, requirements, is_active, is_featured,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
            [
                name,
                country,
                city,
                logo_url || null,
                world_ranking ? parseInt(world_ranking) : null,
                description || null,
                requirements || null
            ]
        );

        const university = universityResult.rows[0];
        console.log('✅ University created:', university);

        // Add departments if provided
        if (departments && typeof departments === 'object') {
            console.log('📝 Adding departments:', departments);
            for (const [key, dept] of Object.entries(departments)) {
                if (dept.name_tr && dept.name_en) {
                    await pool.query(
                        `INSERT INTO university_departments (university_id, name_tr, name_en, price, currency) 
                         VALUES ($1, $2, $3, $4, $5)`,
                        [
                            university.id,
                            dept.name_tr,
                            dept.name_en,
                            dept.price ? parseFloat(dept.price) : null,
                            'EUR'
                        ]
                    );
                    console.log(`✅ Department added: ${dept.name_tr}`);
                }
            }
        }

        res.json({
            success: true,
            message: 'Üniversite başarıyla oluşturuldu',
            university: university
        });
    } catch (error) {
        console.error('❌ Create university error:', error);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            position: error.position
        });
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + error.message,
            debug: {
                code: error.code,
                detail: error.detail,
                hint: error.hint
            }
        });
    }
});

// Maintenance: expand logo_url column to TEXT to support base64 data URLs
router.post('/maintenance/alter-logo-column', async (req, res) => {
    try {
        await pool.query('ALTER TABLE universities ALTER COLUMN logo_url TYPE TEXT');
        res.json({ success: true, message: 'logo_url column converted to TEXT' });
    } catch (error) {
        console.error('Alter logo column error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get student checklist
router.get('/users/:id/checklist', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            `SELECT id, item_name, is_completed, completed_at, created_at
             FROM checklist_items
             WHERE user_id = $1
             ORDER BY created_at ASC`,
            [id]
        );
        
        res.json({
            success: true,
            checklist: result.rows
        });
    } catch (error) {
        console.error('Get checklist error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update checklist item
router.patch('/users/:id/checklist/:itemId', async (req, res) => {
    try {
        const { id, itemId } = req.params;
        const { is_completed } = req.body;
        
        const completed = typeof is_completed === 'boolean' ? is_completed : String(is_completed).toLowerCase() === 'true';
        
        const result = await pool.query(
            `UPDATE checklist_items 
             SET is_completed = $1, completed_at = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 AND user_id = $4
             RETURNING id, item_name, is_completed, completed_at, updated_at`,
            [
                completed,
                completed ? new Date() : null,
                itemId,
                id
            ]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Checklist item not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Checklist item updated successfully',
            item: result.rows[0]
        });
    } catch (error) {
        console.error('Update checklist error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Initialize checklist for new student
router.post('/users/:id/checklist/initialize', async (req, res) => {
    try {
        const { id } = req.params;
        
        const defaultItems = [
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
        
        // Remove old items and insert defaults
        await pool.query('DELETE FROM checklist_items WHERE user_id = $1', [id]);
        await Promise.all(defaultItems.map(item =>
            pool.query(
                `INSERT INTO checklist_items (user_id, item_name, is_completed)
                 VALUES ($1, $2, false)`,
                [id, item]
            )
        ));
        
        res.json({
            success: true,
            message: 'Checklist initialized successfully'
        });
    } catch (error) {
        console.error('Initialize checklist error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// File Management API Endpoints

// Get file categories for a user (using user_documents table)
router.get('/users/:id/file-categories', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get unique categories from user_documents table
        const result = await pool.query(`
            SELECT 
                category as category_name,
                COUNT(*) as file_count,
                category as id
            FROM user_documents 
            WHERE user_id = $1 
            GROUP BY category
            ORDER BY category
        `, [id]);
        
        // Add default categories if none exist
        const defaultCategories = [
            { id: 'education', category_name: 'Eğitim Belgeleri', file_count: 0 },
            { id: 'identity', category_name: 'Kimlik Belgeleri', file_count: 0 },
            { id: 'language', category_name: 'Dil Sertifikaları', file_count: 0 },
            { id: 'other', category_name: 'Diğer Belgeler', file_count: 0 }
        ];
        
        // Merge with existing categories
        const categories = defaultCategories.map(defaultCat => {
            const existing = result.rows.find(row => row.category_name === defaultCat.id);
            return existing || defaultCat;
        });
        
        res.json({
            success: true,
            categories: categories
        });
    } catch (error) {
        console.error('Get file categories error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get files for a user (optionally filtered by category)
router.get('/users/:id/files', async (req, res) => {
    try {
        const { id } = req.params;
        const { category } = req.query;
        
        let query = 'SELECT * FROM user_documents WHERE user_id = $1';
        let params = [id];
        
        if (category) {
            query += ' AND category = $' + (params.length + 1);
            params.push(category);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const result = await pool.query(query, params);
        
        res.json({
            success: true,
            files: result.rows
        });
    } catch (error) {
        console.error('Get files error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Download a file
router.get('/users/:id/files/:fileId/download', async (req, res) => {
    try {
        const { id, fileId } = req.params;
        
        const result = await pool.query(
            'SELECT file_data, mime_type, original_filename FROM user_documents WHERE id = $1 AND user_id = $2',
            [fileId, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }
        
        const file = result.rows[0];
        
        if (!file.file_data) {
            return res.status(404).json({
                success: false,
                message: 'File data not found'
            });
        }
        
        // Convert base64 to buffer
        const buffer = Buffer.from(file.file_data, 'base64');
        
        // Set appropriate headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename}"`);
        res.setHeader('Content-Type', file.mime_type);
        res.setHeader('Content-Length', buffer.length);
        
        // Send the file buffer
        res.send(buffer);
    } catch (error) {
        console.error('Download file error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete a file
router.delete('/users/:id/files/:fileId', async (req, res) => {
    try {
        const { id, fileId } = req.params;
        
        console.log('🗑️ Admin delete file request:', { userId: id, fileId });
        
        const result = await pool.query(
            'DELETE FROM user_documents WHERE id = $1 AND user_id = $2',
            [fileId, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }
        
        console.log('✅ Admin file deleted:', result.rows[0].title);
        
        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update file category (admin can change name, count, etc.) - REMOVED
// Categories are now fixed: education, identity, language, other

// Upload file (Admin)
router.post('/users/:id/files/upload', upload.single('file'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description } = req.body;
        
        console.log('📁 Admin upload request received:', { 
            userId: id, 
            title, 
            description,
            file: req.file ? req.file.originalname : 'No file' 
        });
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Title is required'
            });
        }

        // Convert file buffer to Base64 for database storage
        const fileBuffer = req.file.buffer; // Memory storage provides buffer directly
        const base64Data = fileBuffer.toString('base64');

        console.log('✅ Admin file converted to Base64, size:', base64Data.length);

        // Insert into user_documents table using file_data column
        const result = await pool.query(`
            INSERT INTO user_documents (user_id, title, description, file_data, original_filename, file_size, mime_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [id, title, description || null, base64Data, req.file.originalname, req.file.size, req.file.mimetype]);

        console.log('✅ Admin file uploaded successfully:', result.rows[0].id);
        
        res.json({
            success: true,
            message: 'Belge başarıyla yüklendi!',
            documentId: result.rows[0].id
        });
        
    } catch (error) {
        console.error('Upload file error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            detail: error.detail
        });
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + error.message,
            details: error.detail || error.message
        });
    }
});

// Services Management API Endpoints

// Get services for a user
router.get('/users/:id/services', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get services with installments
        const servicesResult = await pool.query(
            'SELECT * FROM services WHERE user_id = $1 ORDER BY created_at DESC',
            [id]
        );
        
        // Get installments for each service
        const services = [];
        for (let service of servicesResult.rows) {
            const installmentsResult = await pool.query(
                'SELECT * FROM installments WHERE service_id = $1 ORDER BY installment_number',
                [service.id]
            );
            
            services.push({
                ...service,
                installments: installmentsResult.rows
            });
        }
        
        res.json({
            success: true,
            services: services
        });
    } catch (error) {
        console.error('Get services error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add new service
router.post('/users/:id/services', async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { id } = req.params;
        const { service_name, amount, currency, due_date, payment_date, is_paid, has_installments, installments } = req.body;
        
        console.log('Adding service with installments:', { 
            id, service_name, amount, currency, due_date, payment_date, is_paid, has_installments, installments 
        });
        
        // Insert service
        const serviceResult = await client.query(
            `INSERT INTO services (user_id, service_name, amount, currency, due_date, payment_date, is_paid, has_installments) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
                id,
                service_name,
                amount,
                currency,
                due_date || null,
                payment_date || null,
                Boolean(is_paid),
                Boolean(has_installments)
            ]
        );
        
        const service = serviceResult.rows[0];
        console.log('Service created:', service);
        
        // Create installments if provided
        if (has_installments && installments) {
            console.log('Creating installments:', installments);
            
            const { count, interval, amount: installmentAmount } = installments;
            const startDate = new Date(due_date);
            
            for (let i = 1; i <= count; i++) {
                let installmentDate = new Date(startDate);
                
                // Calculate installment date based on interval
                switch (interval) {
                    case 'weekly':
                        installmentDate.setDate(startDate.getDate() + (i - 1) * 7);
                        break;
                    case 'monthly':
                        installmentDate.setMonth(startDate.getMonth() + (i - 1));
                        break;
                    case 'quarterly':
                        installmentDate.setMonth(startDate.getMonth() + (i - 1) * 3);
                        break;
                }
                
                await client.query(
                    `INSERT INTO installments (service_id, installment_number, amount, due_date, is_paid) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        service.id,
                        i,
                        installmentAmount,
                        installmentDate.toISOString().split('T')[0],
                        false
                    ]
                );
                
                console.log(`Installment ${i} created for date: ${installmentDate.toISOString().split('T')[0]}`);
            }
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Service and installments added successfully',
            service: service
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Add service error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    } finally {
        client.release();
    }
});

// Update service
router.put('/users/:id/services/:serviceId', async (req, res) => {
    try {
        const { id, serviceId } = req.params;
        const { service_name, amount, currency, due_date, payment_date, is_paid, has_installments } = req.body;
        
        const result = await pool.query(
            `UPDATE services SET service_name = $1, amount = $2, currency = $3, due_date = $4, payment_date = $5, is_paid = $6, has_installments = $7 
             WHERE id = $8 AND user_id = $9 RETURNING *`,
            [
                service_name,
                amount,
                currency,
                due_date || null,
                payment_date || null,
                Boolean(is_paid),
                Boolean(has_installments),
                serviceId,
                id
            ]
         );
        
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }
        
        res.json({
             success: true,
             message: 'Service updated successfully',
             service: result.rows[0]
         });
    } catch (error) {
        console.error('Update service error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete service
router.delete('/users/:id/services/:serviceId', async (req, res) => {
    try {
        const { id, serviceId } = req.params;
        
        // Delete installments first (due to foreign key constraint)
        await pool.query('DELETE FROM installments WHERE service_id = $1', [serviceId]);
        
        // Delete service
        const result = await pool.query(
            'DELETE FROM services WHERE id = $1 AND user_id = $2 RETURNING id',
            [serviceId, id]
         );
        
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Service deleted successfully'
        });
    } catch (error) {
        console.error('Delete service error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add installment to service
router.post('/users/:id/services/:serviceId/installments', async (req, res) => {
    try {
        const { id, serviceId } = req.params;
        const { amount, due_date, payment_date, is_paid } = req.body;
        
        // Get next installment number
        const countResult = await pool.query(
            'SELECT COUNT(*) as count FROM installments WHERE service_id = $1',
            [serviceId]
        );
        const installmentNumber = parseInt(countResult.rows[0].count) + 1;
        
        const result = await pool.query(
            `INSERT INTO installments (service_id, amount, due_date, payment_date, is_paid, installment_number) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                serviceId,
                amount,
                due_date,
                payment_date || null,
                Boolean(is_paid),
                installmentNumber
            ]
        );
        
        res.json({
            success: true,
            message: 'Installment added successfully',
            installment: result.rows[0]
        });
    } catch (error) {
        console.error('Add installment error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update installment
router.put('/users/:id/services/:serviceId/installments/:installmentId', async (req, res) => {
    try {
        const { id, serviceId, installmentId } = req.params;
        const { amount, due_date, payment_date, is_paid } = req.body;
        
        const result = await pool.query(
            `UPDATE installments SET amount = $1, due_date = $2, payment_date = $3, is_paid = $4 
             WHERE id = $5 AND service_id = $6 RETURNING *`,
            [
                amount,
                due_date,
                payment_date || null,
                Boolean(is_paid),
                installmentId,
                serviceId
            ]
         );
        
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Installment not found'
            });
        }
        
        res.json({
             success: true,
             message: 'Installment updated successfully',
             installment: result.rows[0]
         });
    } catch (error) {
        console.error('Update installment error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete installment
router.delete('/users/:id/services/:serviceId/installments/:installmentId', async (req, res) => {
    try {
        const { id, serviceId, installmentId } = req.params;
        
        const result = await pool.query(
            'DELETE FROM installments WHERE id = $1 AND service_id = $2 RETURNING id',
            [installmentId, serviceId]
         );
        
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Installment not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Installment deleted successfully'
        });
    } catch (error) {
        console.error('Delete installment error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Predefined Services API Endpoints

// Get predefined services
router.get('/predefined-services', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM predefined_services WHERE is_active = true ORDER BY service_type, service_name'
        );
        
        res.json({
            success: true,
            services: result.rows
        });
    } catch (error) {
        console.error('Get predefined services error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add service from predefined list
router.post('/users/:id/services/from-predefined', async (req, res) => {
    try {
        const { id } = req.params;
        const { predefined_service_id, amount, currency, due_date, payment_date, is_paid, has_installments } = req.body;
        
        // Get predefined service details
        const predefinedResult = await pool.query(
            'SELECT * FROM predefined_services WHERE id = $1 AND is_active = true',
            [predefined_service_id]
        );
        
        if (predefinedResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Predefined service not found'
            });
        }
        
        const predefinedService = predefinedResult.rows[0];
        
        // Use predefined service name and default amount if not provided
        const serviceName = predefinedService.service_name;
        const serviceAmount = amount || predefinedService.default_amount || 0;
        const serviceCurrency = currency || predefinedService.currency;
        
        console.log('Adding service from predefined:', { 
            id, 
            predefined_service_id, 
            serviceName, 
            serviceAmount, 
            serviceCurrency, 
            due_date, 
            payment_date, 
            is_paid, 
            has_installments 
        });
        
        const result = await pool.query(
            `INSERT INTO services (user_id, service_name, amount, currency, due_date, payment_date, is_paid, has_installments) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
            [id, serviceName, serviceAmount, serviceCurrency, due_date, payment_date, is_paid, has_installments]
        );
        
        res.json({
            success: true,
            message: 'Service added successfully from predefined list',
            service: result.rows[0]
        });
    } catch (error) {
        console.error('Add service from predefined error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get services for a user
router.get('/users/:userId/services', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const servicesQuery = `
            SELECT s.*, 
                   COUNT(i.id) as installment_count,
                   SUM(CASE WHEN i.is_paid = true THEN i.amount ELSE 0 END) as paid_amount,
                   SUM(i.amount) as total_installment_amount
            FROM services s
            LEFT JOIN installments i ON s.id = i.service_id
            WHERE s.user_id = $1
            GROUP BY s.id
            ORDER BY s.created_at DESC
        `;
        
        const servicesResult = await pool.query(servicesQuery, [userId]);
        
        // Get installments for each service
        const servicesWithInstallments = await Promise.all(
            servicesResult.rows.map(async (service) => {
                const installmentsQuery = `
                    SELECT * FROM installments 
                    WHERE service_id = $1 
                    ORDER BY installment_number ASC
                `;
                const installmentsResult = await pool.query(installmentsQuery, [service.id]);
                
                return {
                    ...service,
                    installments: installmentsResult.rows
                };
            })
        );
        
        res.json({
            success: true,
            services: servicesWithInstallments
        });
    } catch (error) {
        console.error('Get services error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add service with installments
router.post('/users/:userId/services', async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { userId } = req.params;
        const { 
            service_name, 
            amount, 
            currency, 
            due_date, 
            payment_date, 
            is_paid, 
            has_installments, 
            installments 
        } = req.body;
        
        console.log('Adding service with installments:', {
            userId, service_name, amount, currency, due_date, 
            has_installments, installments
        });
        
        // Insert service
        const serviceQuery = `
            INSERT INTO services (user_id, service_name, amount, currency, due_date, payment_date, is_paid, has_installments)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        
        const serviceResult = await client.query(serviceQuery, [
            userId, service_name, amount, currency, due_date, payment_date, is_paid, has_installments
        ]);
        
        const serviceId = serviceResult.rows[0].id;
        
        // Insert installments if provided
        if (has_installments && installments) {
            const { count, interval, amount: installmentAmount } = installments;
            const startDate = new Date(due_date);
            
            for (let i = 1; i <= count; i++) {
                let installmentDate = new Date(startDate);
                
                switch (interval) {
                    case 'weekly':
                        installmentDate.setDate(startDate.getDate() + (i - 1) * 7);
                        break;
                    case 'monthly':
                        installmentDate.setMonth(startDate.getMonth() + (i - 1));
                        break;
                    case 'quarterly':
                        installmentDate.setMonth(startDate.getMonth() + (i - 1) * 3);
                        break;
                }
                
                const installmentQuery = `
                    INSERT INTO installments (service_id, installment_number, amount, due_date, is_paid)
                    VALUES ($1, $2, $3, $4, $5)
                `;
                
                await client.query(installmentQuery, [
                    serviceId, i, installmentAmount, installmentDate.toISOString().split('T')[0], false
                ]);
            }
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Service added successfully',
            service: serviceResult.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Add service error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        client.release();
    }
});

// Update installment payment status
router.patch('/installments/:installmentId', async (req, res) => {
    try {
        const { installmentId } = req.params;
        const { is_paid, payment_date } = req.body;
        
        const query = `
            UPDATE installments 
            SET is_paid = $1, payment_date = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `;
        
        const result = await pool.query(query, [is_paid, payment_date, installmentId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Installment not found' });
        }
        
        res.json({
            success: true,
            message: 'Installment updated successfully',
            installment: result.rows[0]
        });
    } catch (error) {
        console.error('Update installment error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete service
router.delete('/services/:serviceId', async (req, res) => {
    try {
        const { serviceId } = req.params;
        
        const query = 'DELETE FROM services WHERE id = $1';
        const result = await pool.query(query, [serviceId]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }
        
        res.json({
            success: true,
            message: 'Service deleted successfully'
        });
    } catch (error) {
        console.error('Delete service error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create tables endpoint (for development) - NO AUTH
router.post('/create-tables', async (req, res) => {
    try {
        // Create services table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS services (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                service_name VARCHAR(200) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
                due_date DATE,
                payment_date DATE,
                is_paid BOOLEAN DEFAULT FALSE,
                has_installments BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create installments table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS installments (
                id SERIAL PRIMARY KEY,
                service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
                installment_number INTEGER NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                due_date DATE NOT NULL,
                payment_date DATE,
                is_paid BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        res.json({
            success: true,
            message: 'Tables created successfully'
        });
    } catch (error) {
        console.error('Create tables error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Avatar upload endpoint (Base64 storage for Vercel)
router.post('/users/:id/avatar', upload.single('avatar'), async (req, res) => {
    try {
        const { id } = req.params;
        console.log('📸 Avatar upload started for user:', id);
        console.log('📸 Request body:', req.body);
        console.log('📸 Request file:', req.file);
        
        if (!req.file) {
            console.log('❌ No file received');
            return res.status(400).json({
                success: false,
                message: 'Avatar dosyası bulunamadı'
            });
        }
        
        console.log('📸 Avatar upload:', { 
            userId: id, 
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype 
        });
        
        // Validate file type
        if (!req.file.mimetype.startsWith('image/')) {
            console.log('❌ Invalid file type:', req.file.mimetype);
            return res.status(400).json({
                success: false,
                message: 'Sadece resim dosyaları yüklenebilir!'
            });
        }
        
        // Validate specific image formats (exclude HEIC)
        const allowedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedFormats.includes(req.file.mimetype)) {
            console.log('❌ Unsupported image format:', req.file.mimetype);
            return res.status(400).json({
                success: false,
                message: 'Desteklenmeyen resim formatı! Lütfen JPG, PNG, GIF veya WebP formatında resim yükleyin.'
            });
        }
        
        // Convert file to base64 for storage in database (Vercel compatible)
        const base64Data = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;
        const avatarDataUrl = `data:${mimeType};base64,${base64Data}`;
        
        console.log('📸 Base64 conversion completed, length:', base64Data.length);
        
        // Update user's avatar in database
        const updateResult = await pool.query(
            'UPDATE users SET avatar_url = $1 WHERE id = $2',
            [avatarDataUrl, id]
        );
        
        console.log('📸 Database update result:', updateResult.rowCount);
        
        if (updateResult.rowCount === 0) {
            console.log('❌ User not found:', id);
            return res.status(404).json({
                success: false,
                message: 'Kullanıcı bulunamadı'
            });
        }
        
        console.log('📸 Avatar data URL length:', avatarDataUrl.length);
        console.log('📸 Avatar data URL preview:', avatarDataUrl.substring(0, 100) + '...');
        
        res.json({
            success: true,
            message: 'Avatar başarıyla güncellendi',
            avatar_url: avatarDataUrl
        });
    } catch (error) {
        console.error('❌ Avatar upload error:', error);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({ 
            success: false, 
            message: 'Avatar yüklenirken hata oluştu: ' + error.message 
        });
    }
});

// Notes API Endpoints


// Get all notes for a user
router.get('/users/:id/notes', async (req, res) => {
    try {
        const { id } = req.params;
        const { category, priority, is_important } = req.query;
        
        let query = 'SELECT * FROM notes WHERE user_id = $1';
        let params = [id];
        
        // Add filters
        if (category) {
            query += ' AND category = $' + (params.length + 1);
            params.push(category);
        }
        if (priority) {
            query += ' AND priority = $' + (params.length + 1);
            params.push(priority);
        }
        if (is_important !== undefined) {
            query += ' AND is_important = $' + (params.length + 1);
            params.push(is_important === 'true');
        }
        
        query += ' ORDER BY created_at DESC';
        
        const result = await pool.query(query, params);
        
        res.json({
            success: true,
            notes: result.rows
        });
    } catch (error) {
        console.error('Get notes error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/users/:id/notes/:noteId', async (req, res) => {
    try {
        const { id, noteId } = req.params;

        const result = await pool.query(
            `SELECT * FROM notes WHERE user_id = $1 AND id = $2`,
            [id, noteId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Note not found' });
        }

        res.json({
            success: true,
            note: result.rows[0]
        });
    } catch (error) {
        console.error('Get note detail error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add new note
router.post('/users/:id/notes', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, category, priority, is_important } = req.body;
        
        console.log('Adding note:', { id, title, content, category, priority, is_important });
        
        const result = await pool.query(
            `INSERT INTO notes (user_id, title, content, category, priority, is_important) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                id,
                title,
                content,
                category || 'general',
                priority || 'medium',
                typeof is_important === 'boolean' ? is_important : String(is_important).toLowerCase() === 'true'
            ]
        );
        
        res.json({
            success: true,
            message: 'Note added successfully',
            note: result.rows[0]
        });
    } catch (error) {
        console.error('Add note error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// Update note
router.put('/users/:id/notes/:noteId', async (req, res) => {
    try {
        const { id, noteId } = req.params;
        const { title, content, category, priority, is_important } = req.body;
        
        const result = await pool.query(
            `UPDATE notes SET title = $1, content = $2, category = $3, priority = $4, is_important = $5, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $6 AND user_id = $7 RETURNING *`,
            [
                title,
                content,
                category || 'general',
                priority || 'medium',
                typeof is_important === 'boolean' ? is_important : String(is_important).toLowerCase() === 'true',
                noteId,
                id
            ]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Note updated successfully',
            note: result.rows[0]
        });
    } catch (error) {
        console.error('Update note error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete note
router.delete('/users/:id/notes/:noteId', async (req, res) => {
    try {
        const { id, noteId } = req.params;
        
        const result = await pool.query(
            'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id',
            [noteId, id]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Note deleted successfully'
        });
    } catch (error) {
        console.error('Delete note error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if user exists and is not admin
        const userCheck = await pool.query(
            'SELECT id, is_admin FROM users WHERE id = $1',
            [id]
        );
        
        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Kullanıcı bulunamadı'
            });
        }
        
        if (userCheck.rows[0].is_admin) {
            return res.status(403).json({
                success: false,
                message: 'Admin kullanıcıları silinemez'
            });
        }
        
        // Delete user (CASCADE will handle related records)
        const result = await pool.query(
            'DELETE FROM users WHERE id = $1 RETURNING *',
            [id]
        );
        
        res.json({
            success: true,
            message: 'Öğrenci başarıyla silindi'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Öğrenci silinirken bir hata oluştu: ' + error.message 
        });
    }
});

// Get user checklist
router.get('/users/:id/checklist', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            `SELECT id, item_name, is_completed, completed_at, created_at
             FROM checklist_items
             WHERE user_id = $1
             ORDER BY created_at ASC`,
            [id]
        );
        
        res.json({
            success: true,
            checklist: result.rows
        });
    } catch (error) {
        console.error('Get checklist error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Initialize checklist for user
router.post('/users/:id/checklist/initialize', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Default checklist items
        const defaultItems = [
            { name: 'Başvuru formu dolduruldu', order: 1 },
            { name: 'Pasaport hazırlandı', order: 2 },
            { name: 'Dil sınavı sonucu alındı', order: 3 },
            { name: 'Transkript hazırlandı', order: 4 },
            { name: 'Referans mektupları alındı', order: 5 },
            { name: 'Motivasyon mektubu yazıldı', order: 6 },
            { name: 'Başvuru ücreti ödendi', order: 7 },
            { name: 'Başvuru gönderildi', order: 8 },
            { name: 'Kabul mektubu alındı', order: 9 },
            { name: 'Vize başvurusu yapıldı', order: 10 }
        ];
        
        // Insert default items
        for (const item of defaultItems) {
            await pool.query(
                'INSERT INTO student_checklist (user_id, item_name, order_index, is_completed) VALUES ($1, $2, $3, $4)',
                [id, item.name, item.order, false]
            );
        }
        
        res.json({
            success: true,
            message: 'Checklist initialized'
        });
    } catch (error) {
        console.error('Initialize checklist error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Toggle checklist item
router.put('/users/:id/checklist/:itemId', async (req, res) => {
    try {
        const { id, itemId } = req.params;
        const { is_completed } = req.body;
        
        await pool.query(
            'UPDATE student_checklist SET is_completed = $1 WHERE id = $2 AND user_id = $3',
            [is_completed, itemId, id]
        );
        
        res.json({
            success: true,
            message: 'Checklist item updated'
        });
    } catch (error) {
        console.error('Toggle checklist error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Upload document for user (admin)
router.post('/users/:id/documents/upload', upload.single('file'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, category } = req.body;
        
        console.log('📄 Admin upload request:', { id, title, description, category, filePresent: !!req.file });
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        
        // Validate file type (PDF, DOCX, JPG, PNG, etc)
        const allowedMimeTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png'
        ];
        
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            return res.status(400).json({ success: false, message: 'Unsupported file type. Only PDF, DOC, DOCX, JPG, PNG allowed.' });
        }
        
        try {
            const fileBuffer = req.file.buffer;
            console.log('📄 Admin upload buffer size:', fileBuffer.length);
            const base64Data = fileBuffer.toString('base64');
            const fileDataUrl = `data:${req.file.mimetype};base64,${base64Data}`;
            
            console.log('✅ Admin file converted to Base64, size:', base64Data.length);

            // Insert into user_documents table using file_data column
            const result = await pool.query(`
                INSERT INTO user_documents (user_id, title, category, description, file_data, original_filename, file_size, mime_type)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            `, [id, title, category, description || null, base64Data, req.file.originalname, req.file.size, req.file.mimetype]);

            console.log('✅ Admin file uploaded successfully:', result.rows[0].id);
            
            res.json({
                success: true,
                message: 'Belge başarıyla yüklendi!',
                documentId: result.rows[0].id
            });
            
        } catch (error) {
            console.error('Upload document error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get user documents for admin
router.get('/users/:id/documents', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            `SELECT 
                id, title, description, category, file_size, 
                original_filename, uploaded_at
            FROM user_documents 
            WHERE user_id = $1
            ORDER BY uploaded_at DESC
        `, [id]);
        
        res.json({
            success: true,
            documents: result.rows
        });
    } catch (error) {
        console.error('Get user documents error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Download user document for admin
router.get('/users/:id/documents/:docId/download', async (req, res) => {
    try {
        const { id, docId } = req.params;
        
        const result = await pool.query(
            'SELECT file_data, mime_type, original_filename FROM user_documents WHERE id = $1 AND user_id = $2',
            [docId, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }
        
        const document = result.rows[0];
        const fileBuffer = Buffer.from(document.file_data, 'base64');
        
        res.setHeader('Content-Type', document.mime_type);
        res.setHeader('Content-Disposition', `attachment; filename="${document.original_filename}"`);
        res.send(fileBuffer);
    } catch (error) {
        console.error('Download user document error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete user document for admin
router.delete('/users/:id/documents/:docId', async (req, res) => {
    try {
        const { id, docId } = req.params;
        
        const result = await pool.query(
            'DELETE FROM user_documents WHERE id = $1 AND user_id = $2',
            [docId, id]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }
        
        res.json({
            success: true,
            message: 'Document deleted successfully'
        });
    } catch (error) {
        console.error('Delete user document error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Services endpoints
router.get('/users/:userId/services', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const servicesResult = await pool.query(`
            SELECT s.*, 
                   COALESCE(
                       JSON_AGG(
                           JSON_BUILD_OBJECT(
                               'id', i.id,
                               'installment_number', i.installment_number,
                               'amount', i.amount,
                               'due_date', i.due_date,
                               'payment_date', i.payment_date,
                               'is_paid', i.is_paid
                           )
                       ) FILTER (WHERE i.id IS NOT NULL), 
                       '[]'::json
                   ) as installments
            FROM services s
            LEFT JOIN installments i ON s.id = i.service_id
            WHERE s.user_id = $1
            GROUP BY s.id
            ORDER BY s.created_at DESC
        `, [userId]);
        
        res.json({
            success: true,
            services: servicesResult.rows
        });
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({
            success: false,
            message: 'Hizmetler yüklenirken hata oluştu'
        });
    }
});

router.post('/users/:userId/services', async (req, res) => {
    try {
        const { userId } = req.params;
        const { service_name, amount, currency, due_date, is_paid, has_installments, installments } = req.body;
        
        // Insert service
        const serviceResult = await pool.query(`
            INSERT INTO services (user_id, service_name, amount, currency, due_date, is_paid, has_installments)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [userId, service_name, amount, currency, due_date, is_paid, has_installments]);
        
        const serviceId = serviceResult.rows[0].id;
        
        // Insert installments if provided
        if (has_installments && installments && installments.length > 0) {
            for (let i = 0; i < installments.length; i++) {
                const installment = installments[i];
                await pool.query(`
                    INSERT INTO installments (service_id, installment_number, amount, due_date, is_paid)
                    VALUES ($1, $2, $3, $4, $5)
                `, [serviceId, i + 1, installment.amount, installment.due_date, false]);
            }
        }
        
        res.json({
            success: true,
            message: 'Hizmet başarıyla eklendi'
        });
    } catch (error) {
        console.error('Error adding service:', error);
        res.status(500).json({
            success: false,
            message: 'Hizmet eklenirken hata oluştu'
        });
    }
});

router.delete('/users/:userId/services/:serviceId', async (req, res) => {
    try {
        const { serviceId } = req.params;
        
        await pool.query('DELETE FROM services WHERE id = $1', [serviceId]);
        
        res.json({
            success: true,
            message: 'Hizmet başarıyla silindi'
        });
    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({
            success: false,
            message: 'Hizmet silinirken hata oluştu'
        });
    }
});

// Installments endpoints
router.patch('/installments/:installmentId', async (req, res) => {
    try {
        const { installmentId } = req.params;
        const { is_paid, payment_date } = req.body;
        
        await pool.query(`
            UPDATE installments 
            SET is_paid = $1, payment_date = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [is_paid, payment_date, installmentId]);
        
        res.json({
            success: true,
            message: 'Taksit güncellendi'
        });
    } catch (error) {
        console.error('Error updating installment:', error);
        res.status(500).json({
            success: false,
            message: 'Taksit güncellenirken hata oluştu'
        });
    }
});

// File categories endpoint
router.get('/users/:userId/file-categories', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const categoriesResult = await pool.query(`
            SELECT 
                'education' as id,
                'Eğitim Belgeleri' as category_name,
                COUNT(*) as file_count
            FROM user_documents 
            WHERE user_id = $1 AND category = 'education'
            UNION ALL
            SELECT 
                'identity' as id,
                'Kimlik Belgeleri' as category_name,
                COUNT(*) as file_count
            FROM user_documents 
            WHERE user_id = $1 AND category = 'identity'
            UNION ALL
            SELECT 
                'language' as id,
                'Dil Sertifikaları' as category_name,
                COUNT(*) as file_count
            FROM user_documents 
            WHERE user_id = $1 AND category = 'language'
            UNION ALL
            SELECT 
                'other' as id,
                'Diğer Belgeler' as category_name,
                COUNT(*) as file_count
            FROM user_documents 
            WHERE user_id = $1 AND category = 'other'
        `, [userId]);
        
        res.json({
            success: true,
            categories: categoriesResult.rows
        });
    } catch (error) {
        console.error('Error fetching file categories:', error);
        res.status(500).json({
            success: false,
            message: 'Dosya kategorileri yüklenirken hata oluştu'
        });
    }
});

// File upload endpoint
router.post('/users/:userId/files/upload', upload.single('file'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { title, description } = req.body;
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Dosya bulunamadı'
            });
        }
        
        // Convert file buffer to Base64 for database storage
        const fileBuffer = req.file.buffer;
        const base64Data = fileBuffer.toString('base64');
        
        const fileResult = await pool.query(`
            INSERT INTO user_documents (user_id, title, original_filename, file_data, mime_type, file_size, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            userId, 
            title, 
            req.file.originalname, 
            base64Data,
            req.file.mimetype,
            req.file.size,
            description || ''
        ]);
        
        res.json({
            success: true,
            message: 'Dosya başarıyla yüklendi',
            document: fileResult.rows[0]
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({
            success: false,
            message: 'Dosya yüklenirken hata oluştu'
        });
    }
});

// Checklist endpoints
router.get('/users/:userId/checklist', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const checklistResult = await pool.query(`
            SELECT * FROM checklist_items 
            WHERE user_id = $1 
            ORDER BY created_at ASC
        `, [userId]);
        
        res.json({
            success: true,
            checklist: checklistResult.rows
        });
    } catch (error) {
        console.error('Error fetching checklist:', error);
        res.status(500).json({
            success: false,
            message: 'Kontrol listesi yüklenirken hata oluştu'
        });
    }
});

router.post('/users/:userId/checklist/initialize', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Default checklist items
        const defaultItems = [
            'Her okul için niyet mektubu hazırlandı ve sisteme yüklendi.',
            'CV düzenlendi ve sisteme yüklendi.',
            'Referans mektupları alındı ve sisteme yüklendi.',
            'Danışmanlık Ücreti ödendi.',
            'Vize evraklarının tam olduğu kontrol edildi.',
            'İlgili ülkede banka hesabı açıldı.',
            'İlgili ülkenin telefon hattı açıldı',
            'İlgili şehir kartı düzenlendi.',
            'Üniversite kabul mektubu Türkiyeye gönderildi.',
            'Dil yeterliliğini kanıtlayan sertifikalar sisteme yüklendi.',
            'Eğitim geçmişini kanıtlayan belgeler sisteme yüklendi.',
            'Finansal durumu kanıtlayan ve vize için gerekli olan belgeler sisteme yüklendi.',
            'Üniversite başvurusu için gerekli yazılı belgeler eklendi.',
            'Apostil ve çeviri gereken vize için gerekli belgeler sisteme yüklendi.'
        ];
        
        // Insert default items
        for (const item of defaultItems) {
            await pool.query(`
                INSERT INTO checklist_items (user_id, item_name, is_completed)
                VALUES ($1, $2, $3)
            `, [userId, item, false]);
        }
        
        res.json({
            success: true,
            message: 'Kontrol listesi başarıyla oluşturuldu'
        });
    } catch (error) {
        console.error('Error initializing checklist:', error);
        res.status(500).json({
            success: false,
            message: 'Kontrol listesi oluşturulurken hata oluştu'
        });
    }
});

router.put('/users/:userId/checklist/:itemId', async (req, res) => {
    try {
        const { userId, itemId } = req.params;
        const { is_completed } = req.body;
        
        await pool.query(`
            UPDATE checklist_items 
            SET is_completed = $1, completed_at = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND user_id = $4
        `, [is_completed, is_completed ? new Date() : null, itemId, userId]);
        
        res.json({
            success: true,
            message: 'Kontrol listesi güncellendi'
        });
    } catch (error) {
        console.error('Error updating checklist item:', error);
        res.status(500).json({
            success: false,
            message: 'Kontrol listesi güncellenirken hata oluştu'
        });
    }
});

// File download endpoint
router.get('/users/:userId/documents/:documentId/download', async (req, res) => {
    try {
        const { userId, documentId } = req.params;
        
        const documentResult = await pool.query(`
            SELECT file_data, mime_type, original_filename 
            FROM user_documents 
            WHERE id = $1 AND user_id = $2
        `, [documentId, userId]);
        
        if (documentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Dosya bulunamadı'
            });
        }
        
        const document = documentResult.rows[0];
        
        if (!document.file_data) {
            return res.status(404).json({
                success: false,
                message: 'Dosya verisi bulunamadı'
            });
        }
        
        // Convert base64 to buffer
        const buffer = Buffer.from(document.file_data, 'base64');
        
        // Set appropriate headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${document.original_filename}"`);
        res.setHeader('Content-Type', document.mime_type);
        res.setHeader('Content-Length', buffer.length);
        
        // Send the file buffer
        res.send(buffer);
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({
            success: false,
            message: 'Dosya indirilirken hata oluştu'
        });
    }
});

// File delete endpoint
router.delete('/users/:userId/documents/:documentId', async (req, res) => {
    try {
        const { userId, documentId } = req.params;
        
        const documentResult = await pool.query(`
            SELECT id FROM user_documents 
            WHERE id = $1 AND user_id = $2
        `, [documentId, userId]);
        
        if (documentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Dosya bulunamadı'
            });
        }
        
        // Delete from database (no file system cleanup needed for base64 storage)
        await pool.query('DELETE FROM user_documents WHERE id = $1', [documentId]);
        
        res.json({
            success: true,
            message: 'Dosya başarıyla silindi'
        });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({
            success: false,
            message: 'Dosya silinirken hata oluştu'
        });
    }
});

module.exports = router; 