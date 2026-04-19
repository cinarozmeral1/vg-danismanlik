
require('dotenv').config();
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { createContact } = require('../services/contactService');

function generateUniversitySlug(name, city, country) {
    return [name, city, country]
        .filter(Boolean)
        .join('-')
        .toLowerCase()
        .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ş/g, 's')
        .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
        .replace(/é/g, 'e').replace(/è/g, 'e').replace(/ë/g, 'e')
        .replace(/á/g, 'a').replace(/à/g, 'a').replace(/ä/g, 'a')
        .replace(/ú/g, 'u').replace(/ů/g, 'u').replace(/ó/g, 'o')
        .replace(/ő/g, 'o').replace(/ř/g, 'r').replace(/ž/g, 'z')
        .replace(/ý/g, 'y').replace(/ě/g, 'e').replace(/š/g, 's')
        .replace(/č/g, 'c').replace(/ň/g, 'n').replace(/ď/g, 'd')
        .replace(/ť/g, 't').replace(/í/g, 'i').replace(/ł/g, 'l')
        .replace(/ą/g, 'a').replace(/ę/g, 'e').replace(/ź/g, 'z')
        .replace(/ś/g, 's').replace(/ć/g, 'c').replace(/ń/g, 'n')
        .replace(/ż/g, 'z').replace(/'|'/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Admin sayfalarında footer'ı gizlemek için flag
router.use((req, res, next) => {
    res.locals.isAdminPage = true;
    next();
});

// ==================== SECURITY: BLANKET ADMIN AUTH ====================
// This middleware protects ALL admin routes. No admin endpoint can be
// accessed without a valid admin session. GET page requests redirect
// to /login; API requests receive 401 JSON.
router.use((req, res, next) => {
    if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
        // GET requests for pages → redirect to login
        if (req.method === 'GET' && !req.xhr && !(req.headers.accept || '').includes('application/json')) {
            return res.redirect('/login');
        }
        // API requests (POST/PUT/DELETE/JSON) → 401 JSON
        return res.status(401).json({ success: false, message: 'Admin authentication required' });
    }
    next();
});
// ==================== END BLANKET ADMIN AUTH ====================

function requireSuperAdminPage(req, res, next) {
    if (!res.locals.isSuperAdmin) {
        if (req.method === 'GET' && !req.xhr && !(req.headers.accept || '').includes('application/json')) {
            return res.redirect('/admin/dashboard');
        }
        return res.status(403).json({ success: false, message: 'Bu isleme yetkiniz yok.' });
    }
    next();
}

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendApplicationCreationEmail, sendApplicationStatusEmail, sendPartnerVerificationEmail, sendVisaApplicationEmail, generateVerificationToken, sendPartnerPaymentEmail, sendPartnerNewStudentEmail, sendPartnerNewEarningEmail, sendReviewRequestEmail } = require('../services/emailService');
const { generateContractPDF, generateContractNumber } = require('../services/contractService');
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
            console.log('Note: file_path column update skipped (may already be TEXT)');
        });

        // Add file_data column if not exists
        await pool.query(`
            ALTER TABLE user_documents 
            ADD COLUMN IF NOT EXISTS file_data TEXT
        `).catch(err => {
            console.log('Note: file_data column already exists or could not be added');
        });

        // Make file_path nullable (needed for file_data based storage)
        await pool.query(`
            ALTER TABLE user_documents 
            ALTER COLUMN file_path DROP NOT NULL
        `).catch(err => {
            console.log('Note: file_path already nullable');
        });

        // Ensure uploaded_at column exists (some tables have created_at, some have uploaded_at)
        await pool.query(`
            ALTER TABLE user_documents 
            ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `).catch(err => {
            console.log('Note: uploaded_at column already exists');
        });

        // Standardize active_class values for existing students
        await pool.query(`
            UPDATE users SET active_class = '11' WHERE active_class IS NOT NULL AND LOWER(TRIM(active_class)) IN ('11', '11.', '11. sinif', '11. sınıf', '11.sinif', '11.sınıf')
        `).catch(err => console.log('Note: active_class 11 standardization skipped'));
        await pool.query(`
            UPDATE users SET active_class = '12' WHERE active_class IS NOT NULL AND LOWER(TRIM(active_class)) IN ('12', '12.', '12. sinif', '12. sınıf', '12.sinif', '12.sınıf')
        `).catch(err => console.log('Note: active_class 12 standardization skipped'));
        await pool.query(`
            UPDATE users SET active_class = 'Mezun' WHERE active_class IS NOT NULL AND LOWER(TRIM(active_class)) IN ('mezun', 'graduate', 'graduated')
        `).catch(err => console.log('Note: active_class Mezun standardization skipped'));

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
        
        // Fix incorrect country values for universities
        await pool.query(`UPDATE universities SET country = 'Czech Republic' WHERE LOWER(name) LIKE '%charles%' AND country != 'Czech Republic'`).catch(() => {});
        await pool.query(`UPDATE universities SET city = 'Prague' WHERE LOWER(name) LIKE '%charles%' AND city != 'Prague'`).catch(() => {});
        await pool.query(`UPDATE universities SET country = 'Italy' WHERE LOWER(name) LIKE '%bologna%' AND country != 'Italy'`).catch(() => {});
        await pool.query(`UPDATE universities SET city = 'Bologna' WHERE LOWER(name) LIKE '%bologna%' AND city != 'Bologna'`).catch(() => {});
        await pool.query(`UPDATE universities SET country = 'Italy' WHERE LOWER(name) LIKE '%padua%' AND country != 'Italy'`).catch(() => {});
        await pool.query(`UPDATE universities SET country = 'Italy' WHERE LOWER(name) LIKE '%padova%' AND country != 'Italy'`).catch(() => {});
        await pool.query(`UPDATE universities SET country = 'Italy' WHERE LOWER(name) LIKE '%politecnico%milan%' AND country != 'Italy'`).catch(() => {});
        await pool.query(`UPDATE universities SET country = 'Italy' WHERE LOWER(name) LIKE '%sapienza%' AND country != 'Italy'`).catch(() => {});
        await pool.query(`UPDATE universities SET country = 'Germany' WHERE LOWER(name) LIKE '%munich%' OR LOWER(name) LIKE '%münchen%' AND country != 'Germany'`).catch(() => {});
        await pool.query(`UPDATE universities SET country = 'Austria' WHERE LOWER(name) LIKE '%vienna%' OR LOWER(name) LIKE '%wien%' AND country != 'Austria'`).catch(() => {});
        await pool.query(`UPDATE universities SET country = 'Hungary' WHERE LOWER(name) LIKE '%pecs%' OR LOWER(name) LIKE '%pécs%' AND country != 'Hungary'`).catch(() => {});
        await pool.query(`UPDATE universities SET country = 'Hungary' WHERE LOWER(name) LIKE '%budapest%' AND country != 'Hungary'`).catch(() => {});
        await pool.query(`UPDATE universities SET country = 'Poland' WHERE LOWER(name) LIKE '%warsaw%' AND country != 'Poland'`).catch(() => {});
        await pool.query(`UPDATE universities SET country = 'Czech Republic' WHERE LOWER(name) LIKE '%czech%' AND country != 'Czech Republic'`).catch(() => {});
        console.log('✅ University country data fixed');

        // Fix broken AI recommendations where fallback assigned wrong countries
        try {
            // Fix recommendations where Charles University has wrong country in ai_reasoning JSON
            await pool.query(`
                UPDATE ai_recommendations 
                SET ai_reasoning = regexp_replace(
                    regexp_replace(
                        ai_reasoning,
                        '"university_name"\\s*:\\s*"Charles University[^"]*"\\s*,\\s*"program_name"\\s*:\\s*"[^"]*"\\s*,\\s*"country"\\s*:\\s*"(?!Czech Republic)[^"]*"',
                        regexp_replace(
                            substring(ai_reasoning from '"university_name"\\s*:\\s*"Charles University[^"]*"\\s*,\\s*"program_name"\\s*:\\s*"[^"]*"\\s*,\\s*"country"\\s*:\\s*"[^"]*"'),
                            '"country"\\s*:\\s*"[^"]*"',
                            '"country": "Czech Republic"'
                        )
                    ),
                    '"university_name"\\s*:\\s*"University of Bologna[^"]*"\\s*,\\s*"program_name"\\s*:\\s*"[^"]*"\\s*,\\s*"country"\\s*:\\s*"(?!Italy)[^"]*"',
                    regexp_replace(
                        substring(ai_reasoning from '"university_name"\\s*:\\s*"University of Bologna[^"]*"\\s*,\\s*"program_name"\\s*:\\s*"[^"]*"\\s*,\\s*"country"\\s*:\\s*"[^"]*"'),
                        '"country"\\s*:\\s*"[^"]*"',
                        '"country": "Italy"'
                    )
                )
                WHERE ai_reasoning LIKE '%Charles University%' OR ai_reasoning LIKE '%Bologna%'
            `).catch(() => {});
            console.log('✅ AI recommendations country data fix attempted via regex');
        } catch (regexErr) {
            console.log('ℹ️ Regex fix not supported, trying JSON approach');
        }

        // Simpler approach: fix via application-level JSON parsing
        try {
            const brokenRecs = await pool.query(`
                SELECT id, ai_reasoning FROM ai_recommendations 
                WHERE ai_reasoning IS NOT NULL 
                AND (ai_reasoning LIKE '%Charles University%' OR ai_reasoning LIKE '%Bologna%')
            `);
            
            for (const rec of brokenRecs.rows) {
                try {
                    const data = JSON.parse(rec.ai_reasoning);
                    let changed = false;
                    
                    if (data.recommendation_1) {
                        if (data.recommendation_1.university_name && 
                            data.recommendation_1.university_name.toLowerCase().includes('charles') && 
                            data.recommendation_1.country !== 'Czech Republic') {
                            data.recommendation_1.country = 'Czech Republic';
                            data.recommendation_1.city = 'Prague';
                            changed = true;
                        }
                        if (data.recommendation_1.university_name && 
                            data.recommendation_1.university_name.toLowerCase().includes('bologna') && 
                            data.recommendation_1.country !== 'Italy') {
                            data.recommendation_1.country = 'Italy';
                            data.recommendation_1.city = 'Bologna';
                            changed = true;
                        }
                    }
                    
                    if (data.recommendation_2) {
                        if (data.recommendation_2.university_name && 
                            data.recommendation_2.university_name.toLowerCase().includes('charles') && 
                            data.recommendation_2.country !== 'Czech Republic') {
                            data.recommendation_2.country = 'Czech Republic';
                            data.recommendation_2.city = 'Prague';
                            changed = true;
                        }
                        if (data.recommendation_2.university_name && 
                            data.recommendation_2.university_name.toLowerCase().includes('bologna') && 
                            data.recommendation_2.country !== 'Italy') {
                            data.recommendation_2.country = 'Italy';
                            data.recommendation_2.city = 'Bologna';
                            changed = true;
                        }
                    }
                    
                    if (changed) {
                        await pool.query(
                            'UPDATE ai_recommendations SET ai_reasoning = $1 WHERE id = $2',
                            [JSON.stringify(data), rec.id]
                        );
                        console.log(`✅ Fixed AI recommendation #${rec.id} country data`);
                    }
                } catch (parseErr) {
                    // Skip non-JSON ai_reasoning entries
                }
            }
            console.log('✅ AI recommendations country data fixed via JSON parsing');
        } catch (jsonFixErr) {
            console.log('ℹ️ AI recommendations fix skipped:', jsonFixErr.message);
        }

        // Create gallery tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS gallery_topics (
                id SERIAL PRIMARY KEY,
                title VARCHAR(300) NOT NULL,
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS gallery_images (
                id SERIAL PRIMARY KEY,
                topic_id INTEGER REFERENCES gallery_topics(id) ON DELETE CASCADE,
                image_url TEXT NOT NULL,
                caption TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Gallery tables ensured');

        // Create school_partnership_rules table for tiered pricing (e.g., ESE)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS school_partnership_rules (
                id SERIAL PRIMARY KEY,
                school_name VARCHAR(300) NOT NULL,
                service_keyword VARCHAR(200) NOT NULL,
                tier_threshold INTEGER NOT NULL DEFAULT 3,
                tier_1_amount DECIMAL(10,2) NOT NULL,
                tier_2_amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
                reset_period VARCHAR(20) NOT NULL DEFAULT 'yearly',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create predefined_services table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS predefined_services (
                id SERIAL PRIMARY KEY,
                service_name VARCHAR(200) NOT NULL,
                service_type VARCHAR(50) NOT NULL DEFAULT 'consultancy',
                description TEXT,
                default_amount DECIMAL(10,2),
                currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
                is_customizable BOOLEAN DEFAULT TRUE,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Insert ESE partnership rule if not exists
        const eseExists = await pool.query(
            `SELECT id FROM school_partnership_rules WHERE service_keyword = 'ESE Komisyon' LIMIT 1`
        );
        if (eseExists.rows.length === 0) {
            await pool.query(`
                INSERT INTO school_partnership_rules (school_name, service_keyword, tier_threshold, tier_1_amount, tier_2_amount, currency, reset_period)
                VALUES ('European School of Economics', 'ESE Komisyon', 3, 3300.00, 4400.00, 'EUR', 'yearly')
            `);
            console.log('✅ ESE partnership rule created');
        }
        
        // Insert ESE predefined service if not exists
        const eseServiceExists = await pool.query(
            `SELECT id FROM predefined_services WHERE service_name = 'ESE Komisyon' LIMIT 1`
        );
        if (eseServiceExists.rows.length === 0) {
            await pool.query(`
                INSERT INTO predefined_services (service_name, service_type, description, default_amount, currency, is_customizable, is_active)
                VALUES ('ESE Komisyon', 'school_partnership', 'European School of Economics - Öğrenci başına komisyon geliri (ilk 3 öğrenci: 3.300€, 4. öğrenciden itibaren: 4.400€, yıllık sıfırlanır)', 3300.00, 'EUR', false, true)
            `);
            console.log('✅ ESE predefined service created');
        }
        
        console.log('✅ School partnership tables ensured');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS appointments (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                email VARCHAR(255) NOT NULL,
                target_country VARCHAR(100) NOT NULL,
                field_of_interest VARCHAR(100) NOT NULL,
                education_level VARCHAR(100) NOT NULL,
                grade VARCHAR(10),
                budget VARCHAR(50),
                notes TEXT,
                appointment_date DATE NOT NULL,
                czech_time VARCHAR(10) NOT NULL,
                turkey_time VARCHAR(10) NOT NULL,
                start_utc TIMESTAMPTZ NOT NULL,
                end_utc TIMESTAMPTZ NOT NULL,
                calendar_event_id TEXT,
                ip_address VARCHAR(50),
                status VARCHAR(20) DEFAULT 'confirmed',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Appointments table ensured');

        // Add student_status column to users table
        try {
            await pool.query(`
                ALTER TABLE users
                ADD COLUMN student_status VARCHAR(20) DEFAULT 'pending'
            `);
            console.log('✅ Added student_status column to users table');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('ℹ️ student_status column already exists');
                try {
                    await pool.query(`ALTER TABLE users ALTER COLUMN student_status SET DEFAULT 'pending'`);
                    console.log('✅ student_status default updated to pending');
                } catch (defErr) {
                    console.error('❌ Error updating student_status default:', defErr.message);
                }
            } else {
                console.error('❌ Error adding student_status:', error.message);
            }
        }

        // Backfill: paid → active, not paid → pending (only for rows still on default)
        try {
            await pool.query(`
                UPDATE users u SET student_status = 'pending'
                WHERE (u.is_admin = false OR u.is_admin IS NULL)
                  AND u.student_status = 'active'
                  AND NOT EXISTS (
                      SELECT 1 FROM services s
                      WHERE s.user_id = u.id AND s.is_paid = true
                  )
            `);
        } catch (e) { /* ignore if services table missing */ }

        // Add IBAN columns to partners table
        try {
            await pool.query(`ALTER TABLE partners ADD COLUMN IF NOT EXISTS iban VARCHAR(34)`);
            await pool.query(`ALTER TABLE partners ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(200)`);
        } catch (e) { /* columns may already exist */ }

        // One-time migration: Replace "Venture Global" with "VG Danışmanlık" in blog content
        try {
            const checkResult = await pool.query(`SELECT COUNT(*) FROM blog_posts WHERE content_tr LIKE '%Venture Global%'`);
            if (parseInt(checkResult.rows[0].count) > 0) {
                await pool.query(`
                    UPDATE blog_posts 
                    SET content_tr = REPLACE(content_tr, 'Venture Global', 'VG Danışmanlık'),
                        content_en = REPLACE(content_en, 'Venture Global', 'VG Danışmanlık'),
                        keywords = REPLACE(keywords, 'Venture Global', 'VG Danışmanlık'),
                        updated_at = CURRENT_TIMESTAMP
                `);
                console.log('✅ Blog posts migrated: Venture Global → VG Danışmanlık');
            }
        } catch (e) { console.log('Blog migration skipped:', e.message); }

        // One-time migration: Replace em-dashes (—), en-dashes (–) and
        // mid-sentence " - " (space-hyphen-space) with a colon (": ") in
        // blog titles, content, excerpts and meta. Dashes used as sentence
        // separators are a classic AI-writing tell, and the user prefers
        // colon-style headings ("Giriş: ..." rather than "Giriş - ...").
        // We only target dashes WITH SURROUNDING SPACES so legitimate
        // compound words (e.g. "in-class", year ranges "2024-2025",
        // hyphenated names) are left alone.
        try {
            const dashCheck = await pool.query(`
                SELECT COUNT(*) FROM blog_posts
                WHERE title_tr ~ '([—–―]| - )' OR title_en ~ '([—–―]| - )'
                   OR content_tr ~ '([—–―]| - )' OR content_en ~ '([—–―]| - )'
                   OR excerpt_tr ~ '([—–―]| - )' OR excerpt_en ~ '([—–―]| - )'
                   OR meta_description_tr ~ '([—–―]| - )' OR meta_description_en ~ '([—–―]| - )'
            `);
            if (parseInt(dashCheck.rows[0].count) > 0) {
                const dashFields = [
                    'title_tr', 'title_en',
                    'content_tr', 'content_en',
                    'excerpt_tr', 'excerpt_en',
                    'meta_description_tr', 'meta_description_en'
                ];
                // 1) " — ", " – ", " ― " → ": "
                // 2) " - " (space-hyphen-space) → ": "
                // 3) collapse "::" doubles and double spaces
                const setClauses = dashFields.map(f =>
                    `${f} = regexp_replace(
                        regexp_replace(
                            regexp_replace(
                                regexp_replace(COALESCE(${f}, ''), '\\s*[—–―]\\s*', ': ', 'g'),
                                '\\s+-\\s+', ': ', 'g'
                            ),
                            ':\\s*:', ':', 'g'
                        ),
                        '[ \\t]{2,}', ' ', 'g'
                    )`
                ).join(',\n                        ');
                await pool.query(`
                    UPDATE blog_posts
                    SET ${setClauses},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE title_tr ~ '([—–―]| - )' OR title_en ~ '([—–―]| - )'
                       OR content_tr ~ '([—–―]| - )' OR content_en ~ '([—–―]| - )'
                       OR excerpt_tr ~ '([—–―]| - )' OR excerpt_en ~ '([—–―]| - )'
                       OR meta_description_tr ~ '([—–―]| - )' OR meta_description_en ~ '([—–―]| - )'
                `);
                console.log('✅ Blog posts cleaned: long dashes and " - " separators replaced with ":"');
            }
        } catch (e) { console.log('Blog em-dash migration skipped:', e.message); }

        console.log('✅ Tables ensured to exist');
    } catch (error) {
        console.error('❌ Error ensuring tables:', error.message);
    }
}

// Call this once when the module loads
console.log('🚀 Starting ensureTablesExist...');
const tablesReady = ensureTablesExist().then(() => {
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
        // Check if tables exist first - sadece adminleri hariç tut
        const usersResult = await pool.query(`
            SELECT COUNT(*) as count FROM users 
            WHERE is_admin = false OR is_admin IS NULL
        `);
        let applicationCount = 0;
        let universityCount = 0;
        let partnerCount = 0;
        
        let approvedApplicationCount = 0;
        try {
            const applicationsResult = await pool.query("SELECT COUNT(*) as count FROM applications WHERE status = 'pending'");
            applicationCount = parseInt(applicationsResult.rows[0].count);
            
            const approvedResult = await pool.query("SELECT COUNT(*) as count FROM applications WHERE status = 'approved'");
            approvedApplicationCount = parseInt(approvedResult.rows[0].count);
        } catch (error) {
            console.log('ℹ️ Applications table not found, using 0');
        }
        
        try {
            const universitiesResult = await pool.query('SELECT COUNT(*) as count FROM universities WHERE is_active = true');
            universityCount = parseInt(universitiesResult.rows[0].count);
        } catch (error) {
            console.log('ℹ️ Universities table not found, using 0');
        }
        
        try {
            const partnersResult = await pool.query('SELECT COUNT(*) as count FROM partners');
            partnerCount = parseInt(partnersResult.rows[0].count);
        } catch (error) {
            console.log('ℹ️ Partners table not found, using 0');
        }
        
        let aiRecommendationCount = 0;
        try {
            const aiResult = await pool.query('SELECT COUNT(*) as count FROM ai_recommendations r JOIN users u ON r.user_id = u.id');
            aiRecommendationCount = parseInt(aiResult.rows[0].count);
        } catch (error) {
            console.log('ℹ️ ai_recommendations table not found, using 0');
        }
        
        return {
            userCount: parseInt(usersResult.rows[0].count),
            applicationCount: applicationCount,
            pendingApplicationCount: applicationCount,
            approvedApplicationCount: approvedApplicationCount,
            universityCount: universityCount,
            partnerCount: partnerCount,
            aiRecommendationCount: aiRecommendationCount
        };
    } catch (error) {
        console.error('Error getting admin sidebar counts:', error);
        return { userCount: 0, applicationCount: 0, universityCount: 0, partnerCount: 0, aiRecommendationCount: 0 };
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

        // Calculate percentage changes (last 30 days vs previous 30 days)
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        // User percentage change
        let userPercentChange = 0;
        try {
            const recentUsersResult = await pool.query(
                'SELECT COUNT(*) FROM users WHERE created_at >= $1',
                [thirtyDaysAgo]
            );
            const previousUsersResult = await pool.query(
                'SELECT COUNT(*) FROM users WHERE created_at >= $1 AND created_at < $2',
                [sixtyDaysAgo, thirtyDaysAgo]
            );
            const recentUsers = parseInt(recentUsersResult.rows[0].count) || 0;
            const previousUsers = parseInt(previousUsersResult.rows[0].count) || 0;
            
            if (previousUsers > 0) {
                userPercentChange = Math.round(((recentUsers - previousUsers) / previousUsers) * 100);
            } else if (recentUsers > 0) {
                userPercentChange = 100;
            }
        } catch (error) {
            console.log('Error calculating user percentage:', error.message);
        }

        // Application percentage change
        let applicationPercentChange = 0;
        let pendingPercentChange = 0;
        let approvedPercentChange = 0;
        try {
            const recentAppsResult = await pool.query(
                'SELECT COUNT(*) FROM applications WHERE created_at >= $1',
                [thirtyDaysAgo]
            );
            const previousAppsResult = await pool.query(
                'SELECT COUNT(*) FROM applications WHERE created_at >= $1 AND created_at < $2',
                [sixtyDaysAgo, thirtyDaysAgo]
            );
            const recentApps = parseInt(recentAppsResult.rows[0].count) || 0;
            const previousApps = parseInt(previousAppsResult.rows[0].count) || 0;
            
            if (previousApps > 0) {
                applicationPercentChange = Math.round(((recentApps - previousApps) / previousApps) * 100);
            } else if (recentApps > 0) {
                applicationPercentChange = 100;
            }

            // Pending applications change
            const recentPendingResult = await pool.query(
                "SELECT COUNT(*) FROM applications WHERE status = 'pending' AND created_at >= $1",
                [thirtyDaysAgo]
            );
            const previousPendingResult = await pool.query(
                "SELECT COUNT(*) FROM applications WHERE status = 'pending' AND created_at >= $1 AND created_at < $2",
                [sixtyDaysAgo, thirtyDaysAgo]
            );
            const recentPending = parseInt(recentPendingResult.rows[0].count) || 0;
            const previousPending = parseInt(previousPendingResult.rows[0].count) || 0;
            
            if (previousPending > 0) {
                pendingPercentChange = Math.round(((recentPending - previousPending) / previousPending) * 100);
            } else if (recentPending > 0) {
                pendingPercentChange = 100;
            }

            // Approved applications change
            const recentApprovedResult = await pool.query(
                "SELECT COUNT(*) FROM applications WHERE status = 'approved' AND created_at >= $1",
                [thirtyDaysAgo]
            );
            const previousApprovedResult = await pool.query(
                "SELECT COUNT(*) FROM applications WHERE status = 'approved' AND created_at >= $1 AND created_at < $2",
                [sixtyDaysAgo, thirtyDaysAgo]
            );
            const recentApproved = parseInt(recentApprovedResult.rows[0].count) || 0;
            const previousApproved = parseInt(previousApprovedResult.rows[0].count) || 0;
            
            if (previousApproved > 0) {
                approvedPercentChange = Math.round(((recentApproved - previousApproved) / previousApproved) * 100);
            } else if (recentApproved > 0) {
                approvedPercentChange = 100;
            }
        } catch (error) {
            console.log('Error calculating application percentages:', error.message);
        }

        // Get financial data (receivables - unpaid services)
        let receivablesData = {
            totalAmount: 0,
            services: []
        };
        
        try {
            const receivablesQuery = await pool.query(`
                SELECT 
                    s.id,
                    s.service_name,
                    s.amount,
                    s.currency,
                    s.due_date,
                    s.created_at,
                    u.id as user_id,
                    u.first_name,
                    u.last_name,
                    u.email
                FROM services s
                JOIN users u ON s.user_id = u.id
                WHERE s.is_paid = false
                ORDER BY s.due_date ASC NULLS LAST, s.created_at DESC
            `);
            
            receivablesData.services = receivablesQuery.rows;
            receivablesData.totalAmount = receivablesQuery.rows.reduce((sum, service) => {
                // Convert all to EUR for now (can be enhanced later)
                return sum + parseFloat(service.amount || 0);
            }, 0);
        } catch (error) {
            console.log('ℹ️ Services table not found or error fetching receivables:', error.message);
        }

        // Get revenue data (paid services in last 30 days)
        let revenueData = {
            totalAmount: 0,
            services: []
        };
        
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const revenueQuery = await pool.query(`
                SELECT 
                    s.id,
                    s.service_name,
                    s.amount,
                    s.currency,
                    s.payment_date,
                    s.created_at,
                    u.id as user_id,
                    u.first_name,
                    u.last_name,
                    u.email
                FROM services s
                JOIN users u ON s.user_id = u.id
                WHERE s.is_paid = true 
                AND s.payment_date >= $1
                ORDER BY s.payment_date DESC
            `, [thirtyDaysAgo.toISOString().split('T')[0]]);
            
            revenueData.services = revenueQuery.rows;
            revenueData.totalAmount = revenueQuery.rows.reduce((sum, service) => {
                return sum + parseFloat(service.amount || 0);
            }, 0);
        } catch (error) {
            console.log('ℹ️ Services table not found or error fetching revenue:', error.message);
        }

        // Get sidebar counts
        const sidebarCounts = await getAdminSidebarCounts();

        res.render('admin/dashboard', {
            title: 'Admin Panel',
            activePage: 'dashboard',
            users: usersResult.rows,
            applications: applications,
            receivablesData: receivablesData,
            revenueData: revenueData,
            stats: {
                totalUsers: sidebarCounts.userCount,
                totalApplications: sidebarCounts.applicationCount,
                totalUniversities: sidebarCounts.universityCount
            },
            percentChanges: {
                users: userPercentChange,
                applications: applicationPercentChange,
                pending: pendingPercentChange,
                approved: approvedPercentChange
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
        await tablesReady;

        // Try with student_status column; fall back if column doesn't exist yet
        let usersResult;
        try {
            usersResult = await pool.query(
                `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.english_level, 
                        u.tc_number, u.active_class, u.current_school, u.created_at, u.is_admin,
                        COALESCE(u.student_status, 'pending') as student_status,
                        string_agg(DISTINCT g.full_name, ', ') as guardian_names,
                        bool_or(s.is_paid = true AND s.service_name ILIKE '%Kabul Oncesi%') as kabul_oncesi_paid,
                        bool_or(s.is_paid = true AND s.service_name ILIKE '%Kabul Sonrasi%') as kabul_sonrasi_paid,
                        bool_or(s.is_paid = true AND (s.service_name ILIKE '%11%' OR s.service_name ILIKE '%Hazirlik%')) as hazirlik_paid,
                        bool_or(s.is_paid = true) as has_any_paid_service
                 FROM users u
                 LEFT JOIN guardians g ON g.user_id = u.id
                 LEFT JOIN services s ON s.user_id = u.id
                 WHERE u.is_admin = false OR u.is_admin IS NULL
                 GROUP BY u.id
                 ORDER BY u.created_at DESC`
            );
        } catch (colErr) {
            console.warn('student_status column may not exist yet, falling back:', colErr.message);
            usersResult = await pool.query(
                `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.english_level, 
                        u.tc_number, u.active_class, u.current_school, u.created_at, u.is_admin,
                        CASE WHEN bool_or(s.is_paid = true) THEN 'active' ELSE 'pending' END as student_status,
                        string_agg(DISTINCT g.full_name, ', ') as guardian_names,
                        bool_or(s.is_paid = true AND s.service_name ILIKE '%Kabul Oncesi%') as kabul_oncesi_paid,
                        bool_or(s.is_paid = true AND s.service_name ILIKE '%Kabul Sonrasi%') as kabul_sonrasi_paid,
                        bool_or(s.is_paid = true AND (s.service_name ILIKE '%11%' OR s.service_name ILIKE '%Hazirlik%')) as hazirlik_paid,
                        bool_or(s.is_paid = true) as has_any_paid_service
                 FROM users u
                 LEFT JOIN guardians g ON g.user_id = u.id
                 LEFT JOIN services s ON s.user_id = u.id
                 WHERE u.is_admin = false OR u.is_admin IS NULL
                 GROUP BY u.id
                 ORDER BY u.created_at DESC`
            );
        }

        const activeCount = usersResult.rows.filter(u => u.student_status === 'active').length;
        const pendingCount = usersResult.rows.filter(u => u.student_status === 'pending').length;
        const negativeCount = usersResult.rows.filter(u => u.student_status === 'negative').length;

        const sidebarCounts = await getAdminSidebarCounts();

        res.render('admin/users', {
            title: 'Öğrenciler - Admin Panel',
            activePage: 'users',
            users: usersResult.rows,
            activeCount,
            pendingCount,
            negativeCount,
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update student status (active / pending / negative)
router.post('/users/:id/status', async (req, res) => {
    try {
        await tablesReady;
        const { id } = req.params;
        const { status } = req.body;
        const validStatuses = ['active', 'pending', 'negative'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Geçersiz durum' });
        }
        try {
            await pool.query('UPDATE users SET student_status = $1 WHERE id = $2', [status, id]);
        } catch (colErr) {
            // Column might not exist yet — create it and retry
            console.warn('student_status UPDATE failed, creating column:', colErr.message);
            await pool.query(`ALTER TABLE users ADD COLUMN student_status VARCHAR(20) DEFAULT 'pending'`).catch(() => {});
            await pool.query('UPDATE users SET student_status = $1 WHERE id = $2', [status, id]);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Update student status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Admin applications page route
router.get('/applications', async (req, res) => {
    try {
        // Get all users for the modal (exclude admins - they are not students)
        const usersResult = await pool.query(
            'SELECT id, first_name, last_name, email, phone, created_at FROM users WHERE is_admin = false OR is_admin IS NULL ORDER BY first_name, last_name'
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
                    a.country
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

        // Get visa applications
        let visaApplications = [];
        try {
            const visaResult = await pool.query(`
                SELECT 
                    va.*,
                    u.first_name,
                    u.last_name,
                    u.email
                FROM visa_applications va
                JOIN users u ON va.user_id = u.id
                ORDER BY va.created_at DESC
            `);
            visaApplications = visaResult.rows;
            
            // Get appointments for each visa application
            for (let visa of visaApplications) {
                const appointmentsResult = await pool.query(
                    'SELECT * FROM visa_appointments WHERE visa_application_id = $1 ORDER BY appointment_date ASC',
                    [visa.id]
                );
                visa.appointments = appointmentsResult.rows;
            }
        } catch (error) {
            console.log('ℹ️ Visa applications table not found or error:', error.message);
        }

        // Get sidebar counts
        const sidebarCounts = await getAdminSidebarCounts();

        res.render('admin/applications', {
            title: 'Başvurular - Admin Panel',
            activePage: 'applications',
            applications: applications,
            visaApplications: visaApplications,
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
        // Get all users for student selection (exclude admins - they are not students)
        const usersResult = await pool.query(
            'SELECT id, first_name, last_name, email, phone, english_level, created_at FROM users WHERE is_admin = false OR is_admin IS NULL ORDER BY first_name, last_name'
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

// Get user guardians information (from guardians table)
router.get('/users/:id/guardians', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'SELECT * FROM guardians WHERE user_id = $1 ORDER BY sort_order ASC, created_at ASC',
            [id]
        );
        
        res.json({
            success: true,
            guardians: result.rows
        });
    } catch (error) {
        console.error('Get guardians error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Save all guardians (bulk upsert) for a user - Admin
router.put('/users/:id/guardians', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { guardians } = req.body;
        
        if (!guardians || !Array.isArray(guardians)) {
            return res.status(400).json({ success: false, message: 'Geçersiz veli verisi.' });
        }

        await client.query('BEGIN');

        // Mevcut velilerin telefonlarini al (yeni veli tespiti icin)
        const existingGuardians = await client.query(
            'SELECT phone, icloud_contact_uid FROM guardians WHERE user_id = $1',
            [id]
        );
        const existingPhones = new Set(
            existingGuardians.rows.map(g => g.phone).filter(Boolean)
        );

        // Delete existing guardians for this user
        await client.query('DELETE FROM guardians WHERE user_id = $1', [id]);

        // Insert all guardians
        for (const g of guardians) {
            if (!g.full_name || g.full_name.trim() === '') continue;
            
            await client.query(`
                INSERT INTO guardians (user_id, full_name, relationship, tc_number, phone, email, address, is_required, sort_order)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                id,
                g.full_name.trim(),
                g.relationship || 'Diger',
                g.tc_number || null,
                g.phone || null,
                g.email || null,
                g.address || null,
                g.is_required || false,
                g.sort_order || 0
            ]);
        }

        await client.query('COMMIT');

        // Fetch updated guardians
        const result = await client.query(
            'SELECT * FROM guardians WHERE user_id = $1 ORDER BY sort_order ASC',
            [id]
        );

        // Yeni eklenen velileri iCloud rehberine kaydet
        for (const g of result.rows) {
            if (!g.phone || existingPhones.has(g.phone)) continue;
            createContact(g.full_name, g.phone, g.email, 'guardian')
                .then(uid => {
                    if (uid) {
                        pool.query('UPDATE guardians SET icloud_contact_uid = $1 WHERE id = $2', [uid, g.id])
                            .catch(err => console.error('Guardian iCloud UID save failed:', err.message));
                    }
                })
                .catch(err => console.error('Guardian iCloud contact failed:', err.message));
        }

        res.json({
            success: true,
            message: 'Veli bilgileri başarıyla güncellendi',
            guardians: result.rows
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update guardians error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        client.release();
    }
});

// Get all users (API) - Adminleri hariç tut
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, first_name, last_name, email, phone, english_level, created_at, is_admin 
             FROM users 
             WHERE is_admin = false OR is_admin IS NULL
             ORDER BY created_at DESC`
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
        await tablesReady;
        const { id } = req.params;
        
        const userResult = await pool.query(
            `SELECT id, first_name, last_name, email, phone, english_level, 
                    high_school_graduation_date, birth_date, gpa, tc_number,
                    passport_type, passport_number, desired_country, active_class,
                    current_school, home_address,
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

        // Get guardians
        let guardians = [];
        try {
            const guardiansResult = await pool.query(
                'SELECT * FROM guardians WHERE user_id = $1 ORDER BY sort_order ASC, created_at ASC',
                [id]
            );
            guardians = guardiansResult.rows;
        } catch (e) {
            console.log('Guardians fetch skipped:', e.message);
        }

        // Get sidebar counts
        const sidebarCounts = await getAdminSidebarCounts();

        res.render('admin/student-details', {
            title: `${user.first_name} ${user.last_name} - Öğrenci Detayları`,
            activePage: 'users',
            user: user,
            guardians: guardians,
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
            gpa,
            tc_number,
            passport_number,
            passport_type,
            desired_country,
            active_class,
            current_school,
            home_address
        } = req.body;

        // Allow any passport type text input
        const passportTypeFinal = passport_type;

        const result = await pool.query(
            `UPDATE users SET 
                first_name = $1,
                last_name = $2,
                email = $3,
                phone = $4,
                english_level = $5,
                birth_date = $6,
                high_school_graduation_date = $7,
                gpa = $8,
                tc_number = $9,
                passport_number = $10,
                passport_type = $11,
                desired_country = $12,
                active_class = $13,
                current_school = $14,
                home_address = $15,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $16 RETURNING *`,
            [
                first_name,
                last_name,
                email,
                phone,
                english_level,
                birth_date,
                high_school_graduation_date,
                gpa || null,
                tc_number,
                passport_number,
                passportTypeFinal,
                desired_country,
                active_class,
                current_school || null,
                home_address || null,
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

        // Send email notification to student
        const user = userResult.rows[0];
        try {
            await sendApplicationCreationEmail(
                user.email,
                user.first_name,
                user.last_name,
                university,
                program,
                'tr' // Default to Turkish
            );
            console.log(`📧 Application creation email sent to ${user.email}`);
        } catch (emailError) {
            console.error('❌ Failed to send application creation email:', emailError);
            // Don't fail the request if email fails
        }

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

// Update application fee status
router.put('/applications/:id/fee-status', async (req, res) => {
    try {
        const { id } = req.params;
        const { application_fee_paid } = req.body;

        console.log(`📝 Updating application ${id} fee status to:`, application_fee_paid);

        const payment_date = application_fee_paid ? new Date().toISOString() : null;

        const result = await pool.query(
            'UPDATE applications SET application_fee_paid = $1, application_fee_payment_date = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [application_fee_paid, payment_date, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        res.json({ 
            success: true, 
            message: application_fee_paid ? 'Başvuru ücreti ödendi olarak işaretlendi' : 'Başvuru ücreti ödenmedi olarak işaretlendi',
            application: result.rows[0]
        });
    } catch (error) {
        console.error('Update application fee status error:', error);
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

        // Send Google Review request only on approval (not rejection)
        if (status === 'approved') {
            try {
                await sendReviewRequestEmail(application.email, application.first_name, 'acceptance');
                console.log(`Review request email sent to ${application.email} after approval`);
            } catch (reviewErr) {
                console.error('Review request email error:', reviewErr.message);
            }
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
            count: universities.rows.length,
            activePage: 'universities'
        });
    } catch (error) {
        console.error('❌ Simple universities page error:', error);
        res.render('admin/universities-simple', {
            title: 'Universities List - Venture Global',
            universities: [],
            count: 0,
            activePage: 'universities',
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
                    COALESCE(u.sort_order, 9999) as sort_order,
                    COUNT(ud.id) as department_count
                FROM universities u
                LEFT JOIN university_departments ud ON u.id = ud.university_id AND ud.is_active = true
                GROUP BY u.id, u.name, u.name_en, u.country, u.city, u.logo_url, u.world_ranking, u.is_active, u.is_featured, u.created_at, u.sort_order
                ORDER BY COALESCE(u.sort_order, 9999) ASC, u.is_featured DESC, u.name ASC
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
        
        // Get sidebar counts
        const sidebarCounts = await getAdminSidebarCounts();
        
        // Extract unique countries for filter dropdown
        const countries = [...new Set(universities.map(u => u.country).filter(Boolean))].sort();
        
        res.render('admin/universities', {
            title: 'Universities Management',
            universities: universities,
            countries: countries,
            user: fakeUser,
            activePage: 'universities',
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Get universities error:', error);
        res.status(500).render('admin/universities', {
            title: 'Universities Management',
            universities: [],
            countries: [],
            user: req.user,
            activePage: 'universities',
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
        
        // Get university details with departments (ordered by sort_order)
        const universityResult = await pool.query(`
            SELECT 
                u.*,
                COALESCE(
                    (
                        SELECT json_agg(dept_ordered ORDER BY dept_ordered->>'sort_order')
                        FROM (
                            SELECT json_build_object(
                                'id', ud.id,
                                'name_tr', ud.name_tr,
                                'name_en', ud.name_en,
                                'price', ud.price,
                                'sort_order', COALESCE(ud.sort_order, 9999)
                            ) as dept_ordered
                            FROM university_departments ud 
                            WHERE ud.university_id = u.id AND ud.is_active = true
                            ORDER BY COALESCE(ud.sort_order, 9999) ASC
                        ) sub
                    ),
                    '[]'::json
                ) as departments
            FROM universities u
            WHERE u.id = $1
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


// Reorder universities (MUST be before :id route)
router.put('/universities/reorder', async (req, res) => {
    try {
        const { order } = req.body;
        
        console.log('📝 Reorder universities request:', order);
        
        if (!order || !Array.isArray(order) || order.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Geçersiz sıralama verisi'
            });
        }
        
        // Check if sort_order column exists, if not add it
        try {
            await pool.query(`
                ALTER TABLE universities 
                ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0
            `);
            console.log('✅ sort_order column checked/added');
        } catch (alterError) {
            console.log('⚠️ Column might already exist:', alterError.message);
        }
        
        // Update sort_order for each university
        for (let i = 0; i < order.length; i++) {
            const universityId = order[i];
            const sortOrder = i + 1;
            
            await pool.query(
                'UPDATE universities SET sort_order = $1 WHERE id = $2',
                [sortOrder, universityId]
            );
        }
        
        console.log('✅ Universities reordered successfully');
        
        res.json({
            success: true,
            message: 'Sıralama başarıyla kaydedildi',
            count: order.length
        });
    } catch (error) {
        console.error('❌ Reorder universities error:', error);
        res.status(500).json({
            success: false,
            message: 'Sıralama kaydedilirken hata oluştu: ' + error.message
        });
    }
});


// Update university with logo upload support
router.put('/universities/:id', async (req, res) => {
    console.log('🔴 HIT: /universities/:id route with id:', req.params.id);
    console.log('🔴 Full URL:', req.originalUrl);
    console.log('🔴 Body keys:', Object.keys(req.body));
    try {
        const { id } = req.params;
        const name = req.body.name;
        const country = req.body.country;
        const city = req.body.city;
        const logo_url = req.body.logo_url;
        const description = req.body.description;
        const requirements = req.body.requirements;
        const world_ranking = req.body.world_ranking;
        const application_deadline = req.body.application_deadline;
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
        const deadlineValue = application_deadline && application_deadline !== '' ? application_deadline : null;
        const updatedSlug = generateUniversitySlug(name, city, country);
        const result = await pool.query(`
            UPDATE universities SET 
                name = $1, country = $2, city = $3, logo_url = $4, 
                description = $5, requirements = $6,
                world_ranking = $7, application_deadline = $8,
                slug = $9,
                is_active = true, 
                is_featured = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = $10 RETURNING *
        `, [
            name, country, city, finalLogoUrl, description, requirements,
            worldRanking, deadlineValue, updatedSlug, id
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
                
                // Add new departments with sort_order
                for (let i = 0; i < departments.length; i++) {
                    const dept = departments[i];
                    if (dept.name_tr && dept.name_en) {
                        const sortOrder = dept.sort_order || (i + 1);
                        await pool.query(
                            `INSERT INTO university_departments (university_id, name_tr, name_en, price, currency, sort_order) 
                             VALUES ($1, $2, $3, $4, $5, $6)`,
                            [
                                id,
                                dept.name_tr,
                                dept.name_en,
                                dept.price ? parseFloat(dept.price) : null,
                                'EUR',
                                sortOrder
                            ]
                        );
                        console.log(`✅ Department updated: ${dept.name_tr} (sort_order: ${sortOrder})`);
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
        const { sendApplicationCreationEmail, sendApplicationStatusEmail } = require('../services/emailService');
        
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

router.post('/test-review-email', requireSuperAdminPage, async (req, res) => {
    try {
        const result = await sendReviewRequestEmail('info@vgdanismanlik.com', 'Ahmet', 'meeting');
        res.json({ success: true, message: 'Review test email sent to info@vgdanismanlik.com', result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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
            application_deadline,
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
        const deadlineValue = application_deadline && application_deadline !== '' ? application_deadline : null;
        const generatedSlug = generateUniversitySlug(name, city, country);
        const universityResult = await pool.query(
            `INSERT INTO universities (
                name, country, city, logo_url, world_ranking, 
                description, requirements, application_deadline,
                slug, is_active, is_featured,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
            [
                name,
                country,
                city,
                logo_url || null,
                world_ranking ? parseInt(world_ranking) : null,
                description || null,
                requirements || null,
                deadlineValue,
                generatedSlug
            ]
        );

        const university = universityResult.rows[0];
        console.log('✅ University created:', university);

        // Add departments if provided (with sort_order support)
        if (departments && typeof departments === 'object') {
            console.log('📝 Adding departments:', departments);
            const deptEntries = Object.entries(departments);
            for (let i = 0; i < deptEntries.length; i++) {
                const [key, dept] = deptEntries[i];
                if (dept.name_tr && dept.name_en) {
                    const sortOrder = dept.sort_order || (i + 1);
                    await pool.query(
                        `INSERT INTO university_departments (university_id, name_tr, name_en, price, currency, sort_order) 
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [
                            university.id,
                            dept.name_tr,
                            dept.name_en,
                            dept.price ? parseFloat(dept.price) : null,
                            'EUR',
                            sortOrder
                        ]
                    );
                    console.log(`✅ Department added: ${dept.name_tr} (sort_order: ${sortOrder})`);
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
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_filename)}`);
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
    try {
        const { id } = req.params;
        const { service_name, amount, currency, due_date, payment_date, is_paid, notes } = req.body;
        
        console.log('Adding service:', { 
            id, service_name, amount, currency, due_date, payment_date, is_paid, notes 
        });
        
        // Insert service
        const serviceResult = await pool.query(
            `INSERT INTO services (user_id, service_name, amount, currency, due_date, payment_date, is_paid, notes) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
                id,
                service_name,
                amount,
                currency,
                due_date || null,
                payment_date || null,
                Boolean(is_paid),
                notes || null
            ]
        );
        
        const service = serviceResult.rows[0];
        console.log('Service created:', service);
        
        res.json({
            success: true,
            message: 'Hizmet başarıyla eklendi',
            service: service
        });
        
    } catch (error) {
        console.error('Add service error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + error.message 
        });
    }
});

// Update service
router.put('/users/:id/services/:serviceId', async (req, res) => {
    try {
        const { id, serviceId } = req.params;
        const { service_name, amount, currency, due_date, payment_date, is_paid, notes } = req.body;
        
        const result = await pool.query(
            `UPDATE services SET service_name = $1, amount = $2, currency = $3, due_date = $4, payment_date = $5, is_paid = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
             WHERE id = $8 AND user_id = $9 RETURNING *`,
            [
                service_name,
                amount,
                currency,
                due_date || null,
                payment_date || null,
                Boolean(is_paid),
                notes || null,
                serviceId,
                id
            ]
         );
        
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Hizmet bulunamadı'
            });
        }
        
        res.json({
            success: true,
            message: 'Hizmet başarıyla güncellendi',
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
        
        // Delete service
        const result = await pool.query(
            'DELETE FROM services WHERE id = $1 AND user_id = $2 RETURNING id',
            [serviceId, id]
         );
        
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Hizmet bulunamadı'
            });
        }
        
        res.json({
            success: true,
            message: 'Hizmet başarıyla silindi'
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

// Calculate school partnership price (tiered pricing like ESE)
router.get('/api/school-partnership-price', async (req, res) => {
    try {
        const { service_keyword } = req.query;
        if (!service_keyword) {
            return res.status(400).json({ success: false, message: 'service_keyword required' });
        }
        
        // Get partnership rule
        const ruleResult = await pool.query(
            'SELECT * FROM school_partnership_rules WHERE service_keyword = $1 AND is_active = true LIMIT 1',
            [service_keyword]
        );
        
        if (ruleResult.rows.length === 0) {
            return res.json({ success: true, amount: null, message: 'No rule found' });
        }
        
        const rule = ruleResult.rows[0];
        
        // Count students with this service in the current year
        const currentYear = new Date().getFullYear();
        const countResult = await pool.query(
            `SELECT COUNT(DISTINCT user_id) as student_count 
             FROM services 
             WHERE service_name = $1 
             AND EXTRACT(YEAR FROM created_at) = $2`,
            [service_keyword, currentYear]
        );
        
        const currentCount = parseInt(countResult.rows[0].student_count) || 0;
        const amount = currentCount < rule.tier_threshold ? parseFloat(rule.tier_1_amount) : parseFloat(rule.tier_2_amount);
        
        res.json({
            success: true,
            amount: amount,
            currency: rule.currency,
            currentCount: currentCount,
            tierThreshold: rule.tier_threshold,
            tier: currentCount < rule.tier_threshold ? 1 : 2,
            schoolName: rule.school_name,
            message: currentCount < rule.tier_threshold 
                ? `${currentCount}/${rule.tier_threshold} öğrenci (Kademe 1: ${rule.tier_1_amount} ${rule.currency})`
                : `${currentCount} öğrenci (Kademe 2: ${rule.tier_2_amount} ${rule.currency})`
        });
    } catch (error) {
        console.error('School partnership price error:', error);
        res.json({ success: true, amount: null, message: 'Fiyat hesaplanamadı' });
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
        
        const serviceName = predefinedService.service_name;
        let serviceCurrency = currency || predefinedService.currency;
        
        // Auto-calculate amount for school partnerships (tiered pricing)
        let serviceAmount = amount || predefinedService.default_amount || 0;
        if (predefinedService.service_type === 'school_partnership') {
            try {
                const ruleResult = await pool.query(
                    'SELECT * FROM school_partnership_rules WHERE service_keyword = $1 AND is_active = true LIMIT 1',
                    [serviceName]
                );
                if (ruleResult.rows.length > 0) {
                    const rule = ruleResult.rows[0];
                    const currentYear = new Date().getFullYear();
                    const countResult = await pool.query(
                        `SELECT COUNT(DISTINCT user_id) as student_count FROM services WHERE service_name = $1 AND EXTRACT(YEAR FROM created_at) = $2`,
                        [serviceName, currentYear]
                    );
                    const currentCount = parseInt(countResult.rows[0].student_count) || 0;
                    serviceAmount = currentCount < rule.tier_threshold ? parseFloat(rule.tier_1_amount) : parseFloat(rule.tier_2_amount);
                    serviceCurrency = rule.currency;
                    console.log(`📊 School partnership pricing: ${serviceName}, count=${currentCount}, threshold=${rule.tier_threshold}, amount=${serviceAmount}`);
                }
            } catch (e) {
                console.log('School partnership pricing fallback:', e.message);
            }
        }
        
        console.log('Adding service from predefined:', { id, serviceName, serviceAmount, serviceCurrency });
        
        const result = await pool.query(
            `INSERT INTO services (user_id, service_name, amount, currency, due_date, payment_date, is_paid, has_installments) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [id, serviceName, serviceAmount, serviceCurrency, due_date || null, payment_date || null, is_paid || false, has_installments || false]
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
        
        // First, discover the actual columns in user_documents table
        const colCheck = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'user_documents'
        `);
        const cols = colCheck.rows.map(r => r.column_name);
        console.log('user_documents columns:', cols);
        
        const hasUploadedAt = cols.includes('uploaded_at');
        const hasCreatedAt = cols.includes('created_at');
        const hasMimeType = cols.includes('mime_type');
        
        const tsCol = hasUploadedAt ? 'uploaded_at' : (hasCreatedAt ? 'created_at' : null);
        const tsSelect = tsCol ? `, ${tsCol} as created_at` : '';
        const orderBy = tsCol ? `ORDER BY ${tsCol} DESC` : 'ORDER BY id DESC';
        const mimeSelect = hasMimeType ? ', mime_type' : '';
        
        const result = await pool.query(
            `SELECT id, title, description, category, file_size${mimeSelect},
                original_filename${tsSelect}
            FROM user_documents 
            WHERE user_id = $1
            ${orderBy}`, [id]);
        
        res.json({
            success: true,
            documents: result.rows
        });
    } catch (error) {
        console.error('Get user documents error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// Download user document for admin
router.get('/users/:id/documents/:docId/download', async (req, res) => {
    try {
        const { id, docId } = req.params;
        
        const result = await pool.query(
            'SELECT file_data, file_path, mime_type, original_filename, title FROM user_documents WHERE id = $1 AND user_id = $2',
            [docId, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }
        
        const document = result.rows[0];
        
        if (!document.file_data && !document.file_path) {
            return res.status(404).json({ success: false, message: 'Dosya verisi bulunamadı' });
        }
        
        let fileBuffer;
        if (document.file_data) {
            fileBuffer = Buffer.from(document.file_data, 'base64');
        } else if (document.file_path && document.file_path.startsWith('data:')) {
            const base64Data = document.file_path.split(',')[1];
            fileBuffer = Buffer.from(base64Data, 'base64');
        } else {
            return res.status(404).json({ success: false, message: 'Dosya verisi okunamadı' });
        }
        
        res.setHeader('Content-Type', document.mime_type || 'application/octet-stream');
        const ext = (document.mime_type === 'application/pdf') ? '.pdf' : '';
        const downloadName = document.title
            ? `${document.title}${ext}`
            : (document.original_filename || `dosya${ext}`);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
        res.setHeader('Content-Length', fileBuffer.length);
        res.send(fileBuffer);
    } catch (error) {
        console.error('Download user document error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
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

// Generate contract PDF for a student
router.post('/users/:userId/generate-contract', async (req, res) => {
    try {
        const { userId } = req.params;
        const { targetPeriod } = req.body;

        // Validate period is provided
        if (!targetPeriod || !targetPeriod.match(/^\d{4}-\d{4}$/)) {
            return res.status(400).json({ success: false, message: 'Lütfen hedef dönemi seçin (örn: 2026-2027)' });
        }

        console.log('📄 Generating contract for user:', userId, 'period:', targetPeriod);

        // Ensure target_period column exists
        try {
            await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS target_period VARCHAR(20)`);
        } catch (e) { /* ignore */ }

        // Persist the selected period on the user record
        await pool.query(`UPDATE users SET target_period = $1 WHERE id = $2`, [targetPeriod, userId]);
        
        // 1. Get student info
        const userResult = await pool.query(
            `SELECT id, first_name, last_name, email, phone, english_level, 
                    high_school_graduation_date, birth_date, gpa, tc_number,
                    passport_type, passport_number, desired_country, active_class,
                    current_school, home_address, target_period
             FROM users WHERE id = $1`,
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Öğrenci bulunamadı' });
        }
        
        const user = userResult.rows[0];
        
        // 1b. Get guardians
        let guardians = [];
        try {
            const guardiansResult = await pool.query(
                'SELECT * FROM guardians WHERE user_id = $1 ORDER BY sort_order ASC',
                [userId]
            );
            guardians = guardiansResult.rows;
        } catch (err) {
            console.log('ℹ️ No guardians found:', err.message);
        }
        
        // 2. Get applications
        let applications = [];
        try {
            const appResult = await pool.query(
                `SELECT id, university_name, program_name, country, status 
                 FROM applications WHERE user_id = $1 
                 ORDER BY created_at DESC`,
                [userId]
            );
            applications = appResult.rows;
        } catch (err) {
            console.log('ℹ️ No applications found:', err.message);
        }
        
        // 3. Get services with installments
        let services = [];
        try {
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
            services = servicesResult.rows;
        } catch (err) {
            console.log('ℹ️ No services found:', err.message);
        }
        
        // 4. Generate PDF
        const pdfBuffer = await generateContractPDF({
            user,
            applications,
            services,
            guardians,
            targetPeriod
        });
        
        console.log('✅ Contract PDF generated, size:', pdfBuffer.length);
        
        // 5. Convert to Base64 and save to user_documents
        const base64Data = pdfBuffer.toString('base64');
        const contractNo = generateContractNumber(userId);
        const fileName = `Sozlesme_${user.first_name}_${user.last_name}_${contractNo}.pdf`;
        const title = `Danışmanlık Sözleşmesi - ${contractNo}`;
        
        const docResult = await pool.query(`
            INSERT INTO user_documents (user_id, title, category, description, file_data, file_path, original_filename, file_size, mime_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, title, original_filename, file_size
        `, [
            userId,
            title,
            'other',
            `${user.first_name} ${user.last_name} için otomatik oluşturulan danışmanlık sözleşmesi`,
            base64Data,
            '',
            fileName,
            pdfBuffer.length,
            'application/pdf'
        ]);
        
        console.log('✅ Contract saved to user_documents:', docResult.rows[0].id);
        
        res.json({
            success: true,
            message: 'Sözleşme başarıyla oluşturuldu!',
            document: docResult.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Contract generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Sözleşme oluşturulurken hata oluştu: ' + error.message
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

// File download endpoint (handled by earlier route definition)

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

// ===== FINANCIAL API ENDPOINTS =====

// Helper function to calculate date range based on period
const getDateRange = (period) => {
    const now = new Date();
    let startDate = new Date();
    
    switch(period) {
        case '7days':
            startDate.setDate(now.getDate() - 7);
            break;
        case '30days':
            startDate.setDate(now.getDate() - 30);
            break;
        case '90days':
            startDate.setDate(now.getDate() - 90);
            break;
        case '1year':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
        case 'all':
        default:
            startDate = new Date('2020-01-01'); // Very old date for "all time"
            break;
    }
    
    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0]
    };
};

// Helper function to convert currency (simplified - can be enhanced with real API)
const convertCurrency = (amount, fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return parseFloat(amount);
    
    // Simplified conversion rates (should use real API in production)
    const rates = {
        'EUR': { 'USD': 1.10, 'TRY': 35.0 },
        'USD': { 'EUR': 0.91, 'TRY': 32.0 },
        'TRY': { 'EUR': 0.029, 'USD': 0.031 }
    };
    
    if (rates[fromCurrency] && rates[fromCurrency][toCurrency]) {
        return parseFloat(amount) * rates[fromCurrency][toCurrency];
    }
    
    return parseFloat(amount); // Fallback to original amount
};

// Get universities for selection in application forms (API endpoint)
// Accessible at /api/admin/universities-for-selection (due to /api/admin mount in server.js)
router.get('/universities-for-selection', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, country, city FROM universities ORDER BY country, name'
        );
        res.json({ 
            success: true, 
            universities: result.rows 
        });
    } catch (error) {
        console.error('Universities fetch error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get financial data with filters (API endpoint)
router.get('/api/financial-data', async (req, res) => {
    try {
        const { period = '30days', type = 'revenue' } = req.query;
        
        const dateRange = getDateRange(period);
        let query;
        let params = [];
        
        if (type === 'expenses') {
            // Partner earnings/commissions (expenses)
            query = `
                SELECT 
                    pe.id,
                    pe.amount,
                    pe.currency,
                    pe.is_paid,
                    pe.payment_date,
                    pe.notes,
                    pe.created_at,
                    u.id as user_id,
                    u.first_name as student_first_name,
                    u.last_name as student_last_name,
                    p.id as partner_id,
                    COALESCE(p.first_name || ' ' || p.last_name, 'Partner') as partner_name
                FROM partner_earnings pe
                LEFT JOIN users u ON pe.user_id = u.id
                LEFT JOIN partners p ON pe.partner_id = p.id
            `;
            
            if (period !== 'all') {
                query += ` WHERE COALESCE(pe.payment_date, pe.created_at::date) >= $1`;
                params.push(dateRange.startDate);
            }
            
            query += ' ORDER BY COALESCE(pe.payment_date, pe.created_at) DESC';
        } else if (type === 'receivables') {
            // Unpaid services - show all currencies
            query = `
                SELECT 
                    s.id,
                    s.service_name,
                    s.amount,
                    s.currency,
                    s.due_date,
                    s.created_at,
                    u.id as user_id,
                    u.first_name,
                    u.last_name,
                    u.email
                FROM services s
                JOIN users u ON s.user_id = u.id
                WHERE s.is_paid = false
                ORDER BY s.due_date ASC NULLS LAST, s.created_at DESC
            `;
        } else {
            // Paid services (revenue) - show all currencies
            query = `
                SELECT 
                    s.id,
                    s.service_name,
                    s.amount,
                    s.currency,
                    s.payment_date,
                    s.created_at,
                    u.id as user_id,
                    u.first_name,
                    u.last_name,
                    u.email
                FROM services s
                JOIN users u ON s.user_id = u.id
                WHERE s.is_paid = true
            `;
            
            if (period !== 'all') {
                query += ' AND s.payment_date >= $1';
                params.push(dateRange.startDate);
            }
            
            query += ' ORDER BY s.payment_date DESC';
        }
        
        const result = await pool.query(query, params);
        
        // Group totals by currency (no conversion, show each currency separately)
        const totalsByCurrency = {};
        const services = result.rows.map(service => {
            const currency = service.currency || 'EUR';
            if (!totalsByCurrency[currency]) {
                totalsByCurrency[currency] = 0;
            }
            totalsByCurrency[currency] += parseFloat(service.amount || 0);
            
            return {
                ...service,
                converted_amount: parseFloat(service.amount).toFixed(2),
                display_currency: currency
            };
        });
        
        // Format totals by currency
        const totalAmounts = Object.keys(totalsByCurrency).map(currency => ({
            currency: currency,
            amount: totalsByCurrency[currency].toFixed(2)
        }));
        
        res.json({
            success: true,
            data: {
                services: services,
                totalsByCurrency: totalAmounts,
                period: period,
                count: services.length
            }
        });
    } catch (error) {
        console.error('Financial data API error:', error);
        res.status(500).json({
            success: false,
            message: 'Financial data fetch error: ' + error.message
        });
    }
});

// Get monthly/weekly comparison data
router.get('/api/financial-comparison', async (req, res) => {
    try {
        const { type = 'monthly' } = req.query;
        
        let query;
        if (type === 'monthly') {
            // Last 12 months - show all currencies separately
            query = `
                SELECT 
                    DATE_TRUNC('month', payment_date) as period,
                    COUNT(*) as count,
                    SUM(amount) as total,
                    currency
                FROM services
                WHERE is_paid = true 
                AND payment_date >= NOW() - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', payment_date), currency
                ORDER BY period ASC, currency ASC
            `;
        } else {
            // Last 12 weeks - show all currencies separately
            query = `
                SELECT 
                    DATE_TRUNC('week', payment_date) as period,
                    COUNT(*) as count,
                    SUM(amount) as total,
                    currency
                FROM services
                WHERE is_paid = true 
                AND payment_date >= NOW() - INTERVAL '12 weeks'
                GROUP BY DATE_TRUNC('week', payment_date), currency
                ORDER BY period ASC, currency ASC
            `;
        }
        
        const result = await pool.query(query);
        
        // Process data - keep currencies separate (no conversion)
        const comparisonData = result.rows.map(row => ({
            period: row.period.toISOString().split('T')[0],
            count: parseInt(row.count),
            total: parseFloat(row.total || 0).toFixed(2),
            currency: row.currency || 'EUR'
        }));
        
        res.json({
            success: true,
            data: comparisonData,
            type: type
        });
    } catch (error) {
        console.error('Financial comparison API error:', error);
        res.status(500).json({
            success: false,
            message: 'Financial comparison error: ' + error.message
        });
    }
});

// Get net profit (revenue - expenses) - by currency
router.get('/api/net-profit', async (req, res) => {
    try {
        const { period = 'all' } = req.query;
        
        const dateRange = getDateRange(period);
        
        // Get total revenue by currency
        let revenueQuery = `
            SELECT SUM(amount) as total, currency
            FROM services
            WHERE is_paid = true
        `;
        const revenueParams = [];
        
        if (period !== 'all') {
            revenueQuery += ' AND payment_date >= $1';
            revenueParams.push(dateRange.startDate);
        }
        
        revenueQuery += ' GROUP BY currency';
        
        const revenueResult = await pool.query(revenueQuery, revenueParams);
        
        // Get total receivables by currency
        let receivablesQuery = `
            SELECT SUM(amount) as total, currency
            FROM services
            WHERE is_paid = false
            GROUP BY currency
        `;
        
        const receivablesResult = await pool.query(receivablesQuery);
        
        // Get total expenses (partner earnings/commissions) by currency
        let expensesQuery = `
            SELECT SUM(amount) as total, currency
            FROM partner_earnings
        `;
        const expensesParams = [];
        
        if (period !== 'all') {
            expensesQuery += ' WHERE COALESCE(payment_date, created_at::date) >= $1';
            expensesParams.push(dateRange.startDate);
        }
        
        expensesQuery += ' GROUP BY currency';
        
        let expensesResult;
        try {
            expensesResult = await pool.query(expensesQuery, expensesParams);
        } catch (e) {
            expensesResult = { rows: [] };
        }
        
        // Group by currency (no conversion)
        const revenueByCurrency = {};
        const receivablesByCurrency = {};
        const expensesByCurrency = {};
        
        revenueResult.rows.forEach(row => {
            revenueByCurrency[row.currency || 'EUR'] = parseFloat(row.total || 0);
        });
        
        receivablesResult.rows.forEach(row => {
            receivablesByCurrency[row.currency || 'EUR'] = parseFloat(row.total || 0);
        });
        
        expensesResult.rows.forEach(row => {
            expensesByCurrency[row.currency || 'EUR'] = parseFloat(row.total || 0);
        });
        
        // Calculate net profit for each currency: Revenue - Expenses
        const allCurrencies = new Set([
            ...Object.keys(revenueByCurrency),
            ...Object.keys(receivablesByCurrency),
            ...Object.keys(expensesByCurrency)
        ]);
        
        const profitByCurrency = Array.from(allCurrencies).map(currency => ({
            currency: currency,
            revenue: parseFloat((revenueByCurrency[currency] || 0).toFixed(2)),
            receivables: parseFloat((receivablesByCurrency[currency] || 0).toFixed(2)),
            expenses: parseFloat((expensesByCurrency[currency] || 0).toFixed(2)),
            netProfit: parseFloat(((revenueByCurrency[currency] || 0) - (expensesByCurrency[currency] || 0)).toFixed(2))
        }));
        
        res.json({
            success: true,
            data: {
                byCurrency: profitByCurrency,
                period: period
            }
        });
    } catch (error) {
        console.error('Net profit API error:', error);
        res.status(500).json({
            success: false,
            message: 'Net profit calculation error: ' + error.message
        });
    }
});

// Student-based profitability (per-student income, expense, net profit)
router.get('/api/student-profitability', async (req, res) => {
    try {
        const { period = 'all' } = req.query;
        const dateRange = getDateRange(period);
        
        // Revenue per student (from services, is_paid=true), optionally filtered by period
        let revenueQuery = `
            SELECT s.user_id, 
                   SUM(s.amount) as total_revenue,
                   s.currency
            FROM services s
            WHERE s.is_paid = true
        `;
        const revenueParams = [];
        if (period !== 'all') {
            revenueQuery += ` AND s.payment_date >= $1`;
            revenueParams.push(dateRange.startDate);
        }
        revenueQuery += ` GROUP BY s.user_id, s.currency`;
        
        // Expenses per student (from partner_earnings), NOT filtered by period
        const expenseQuery = `
            SELECT pe.user_id,
                   SUM(pe.amount) as total_expense,
                   pe.currency
            FROM partner_earnings pe
            GROUP BY pe.user_id, pe.currency
        `;
        
        let revenueResult, expenseResult;
        try {
            revenueResult = await pool.query(revenueQuery, revenueParams);
        } catch (e) {
            revenueResult = { rows: [] };
        }
        try {
            expenseResult = await pool.query(expenseQuery);
        } catch (e) {
            expenseResult = { rows: [] };
        }
        
        // Gather all user IDs that have either revenue or expenses
        const userIds = new Set();
        revenueResult.rows.forEach(r => userIds.add(r.user_id));
        expenseResult.rows.forEach(r => userIds.add(r.user_id));
        
        if (userIds.size === 0) {
            return res.json({
                success: true,
                data: { students: [], totals: { revenue: {}, expenses: {}, netProfit: {} } }
            });
        }
        
        // Get user names
        const usersResult = await pool.query(
            `SELECT id, first_name, last_name FROM users WHERE id = ANY($1)`,
            [Array.from(userIds)]
        );
        const usersMap = {};
        usersResult.rows.forEach(u => { usersMap[u.id] = u; });
        
        // Build per-student data grouped by currency
        const studentData = {};
        
        revenueResult.rows.forEach(r => {
            const key = r.user_id;
            if (!studentData[key]) studentData[key] = { revenues: {}, expenses: {} };
            const cur = r.currency || 'EUR';
            studentData[key].revenues[cur] = (studentData[key].revenues[cur] || 0) + parseFloat(r.total_revenue);
        });
        
        expenseResult.rows.forEach(r => {
            const key = r.user_id;
            if (!studentData[key]) studentData[key] = { revenues: {}, expenses: {} };
            const cur = r.currency || 'EUR';
            studentData[key].expenses[cur] = (studentData[key].expenses[cur] || 0) + parseFloat(r.total_expense);
        });
        
        // Build response array
        const students = Object.keys(studentData).map(userId => {
            const user = usersMap[userId] || { first_name: 'Bilinmeyen', last_name: '' };
            const data = studentData[userId];
            const allCurrencies = new Set([...Object.keys(data.revenues), ...Object.keys(data.expenses)]);
            
            const byCurrency = Array.from(allCurrencies).map(cur => ({
                currency: cur,
                revenue: parseFloat((data.revenues[cur] || 0).toFixed(2)),
                expense: parseFloat((data.expenses[cur] || 0).toFixed(2)),
                netProfit: parseFloat(((data.revenues[cur] || 0) - (data.expenses[cur] || 0)).toFixed(2))
            }));
            
            return {
                user_id: parseInt(userId),
                first_name: user.first_name,
                last_name: user.last_name,
                byCurrency: byCurrency
            };
        }).sort((a, b) => {
            const aTotal = a.byCurrency.reduce((s, c) => s + c.netProfit, 0);
            const bTotal = b.byCurrency.reduce((s, c) => s + c.netProfit, 0);
            return bTotal - aTotal;
        });
        
        // Calculate totals per currency
        const totalRevenue = {};
        const totalExpenses = {};
        const totalNetProfit = {};
        
        students.forEach(s => {
            s.byCurrency.forEach(c => {
                totalRevenue[c.currency] = (totalRevenue[c.currency] || 0) + c.revenue;
                totalExpenses[c.currency] = (totalExpenses[c.currency] || 0) + c.expense;
                totalNetProfit[c.currency] = (totalNetProfit[c.currency] || 0) + c.netProfit;
            });
        });
        
        res.json({
            success: true,
            data: {
                students: students,
                totals: {
                    revenue: totalRevenue,
                    expenses: totalExpenses,
                    netProfit: totalNetProfit
                },
                period: period,
                studentCount: students.length
            }
        });
    } catch (error) {
        console.error('Student profitability API error:', error);
        res.status(500).json({
            success: false,
            message: 'Student profitability error: ' + error.message
        });
    }
});

// Export financial data as CSV
router.get('/api/financial-export', async (req, res) => {
    try {
        const { period = '30days', type = 'revenue' } = req.query;
        
        // Get data using same logic as financial-data endpoint - all currencies
        const dateRange = getDateRange(period);
        let query;
        let params = [];
        
        if (type === 'receivables') {
            query = `
                SELECT 
                    u.first_name || ' ' || u.last_name as student_name,
                    u.email,
                    s.service_name,
                    s.amount,
                    s.currency,
                    s.due_date,
                    s.created_at
                FROM services s
                JOIN users u ON s.user_id = u.id
                WHERE s.is_paid = false
                ORDER BY s.due_date ASC NULLS LAST, s.created_at DESC
            `;
        } else {
            query = `
                SELECT 
                    u.first_name || ' ' || u.last_name as student_name,
                    u.email,
                    s.service_name,
                    s.amount,
                    s.currency,
                    s.payment_date,
                    s.created_at
                FROM services s
                JOIN users u ON s.user_id = u.id
                WHERE s.is_paid = true
            `;
            
            if (period !== 'all') {
                query += ' AND s.payment_date >= $1';
                params.push(dateRange.startDate);
            }
            
            query += ' ORDER BY s.payment_date DESC';
        }
        
        const result = await pool.query(query, params);
        
        // Generate CSV
        const headers = type === 'receivables' 
            ? ['Öğrenci Adı', 'E-posta', 'Hizmet', 'Tutar', 'Para Birimi', 'Vade Tarihi', 'Oluşturulma Tarihi']
            : ['Öğrenci Adı', 'E-posta', 'Hizmet', 'Tutar', 'Para Birimi', 'Ödeme Tarihi', 'Oluşturulma Tarihi'];
        
        let csv = headers.join(',') + '\n';
        
        result.rows.forEach(row => {
            const dateField = type === 'receivables' ? row.due_date : row.payment_date;
            csv += [
                `"${row.student_name || ''}"`,
                `"${row.email || ''}"`,
                `"${row.service_name || ''}"`,
                row.amount || '0',
                row.currency || 'EUR',
                dateField ? new Date(dateField).toLocaleDateString('tr-TR') : '',
                row.created_at ? new Date(row.created_at).toLocaleDateString('tr-TR') : ''
            ].join(',') + '\n';
        });
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="financial-${type}-${period}-${Date.now()}.csv"`);
        res.send('\ufeff' + csv); // BOM for UTF-8 Excel compatibility
    } catch (error) {
        console.error('Financial export error:', error);
        res.status(500).json({
            success: false,
            message: 'Export error: ' + error.message
        });
    }
});

// =====================================================
// PAYMENT & WISE TRANSFER ENDPOINTS
// =====================================================

// Get all payments pending Wise transfer
router.get('/payments/pending-wise-transfer', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                s.*,
                u.first_name,
                u.last_name,
                u.email
            FROM services s
            JOIN users u ON s.user_id = u.id
            WHERE s.is_paid = true 
              AND s.wise_transferred = false
            ORDER BY s.payment_date DESC
        `);

        // Calculate total amount
        const totalAmount = result.rows.reduce((sum, service) => {
            return sum + parseFloat(service.paid_amount || service.amount || 0);
        }, 0);

        res.json({
            success: true,
            payments: result.rows,
            totalAmount: totalAmount,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Get pending Wise transfers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Mark service as transferred to Wise
router.post('/payments/:id/mark-transferred', async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const result = await pool.query(
            `UPDATE services 
             SET wise_transferred = true,
                 wise_transfer_date = CURRENT_DATE,
                 wise_transfer_notes = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [notes || null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        console.log(`✅ Service ${id} marked as transferred to Wise`);

        res.json({
            success: true,
            message: 'Wise transferi başarıyla işaretlendi',
            service: result.rows[0]
        });
    } catch (error) {
        console.error('Mark Wise transferred error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Bulk mark services as transferred to Wise
router.post('/payments/bulk-mark-transferred', async (req, res) => {
    try {
        const { serviceIds, notes } = req.body;

        if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Service IDs are required'
            });
        }

        const result = await pool.query(
            `UPDATE services 
             SET wise_transferred = true,
                 wise_transfer_date = CURRENT_DATE,
                 wise_transfer_notes = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ANY($2::int[])
             RETURNING id`,
            [notes || null, serviceIds]
        );

        console.log(`✅ ${result.rowCount} services marked as transferred to Wise`);

        res.json({
            success: true,
            message: `${result.rowCount} hizmet Wise transferi olarak işaretlendi`,
            count: result.rowCount
        });
    } catch (error) {
        console.error('Bulk mark Wise transferred error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get payment statistics
router.get('/payments/statistics', async (req, res) => {
    try {
        // Total unpaid services
        const unpaidResult = await pool.query(`
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(amount), 0) as total
            FROM services
            WHERE is_paid = false
        `);

        // Total paid but not transferred
        const pendingTransferResult = await pool.query(`
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(COALESCE(paid_amount, amount)), 0) as total
            FROM services
            WHERE is_paid = true AND wise_transferred = false
        `);

        // Total transferred to Wise
        const transferredResult = await pool.query(`
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(COALESCE(paid_amount, amount)), 0) as total
            FROM services
            WHERE is_paid = true AND wise_transferred = true
        `);

        // Recent payments (last 30 days)
        const recentPaymentsResult = await pool.query(`
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(COALESCE(paid_amount, amount)), 0) as total
            FROM services
            WHERE is_paid = true 
              AND payment_date >= CURRENT_DATE - INTERVAL '30 days'
        `);

        res.json({
            success: true,
            statistics: {
                unpaid: {
                    count: parseInt(unpaidResult.rows[0].count),
                    total: parseFloat(unpaidResult.rows[0].total)
                },
                pendingTransfer: {
                    count: parseInt(pendingTransferResult.rows[0].count),
                    total: parseFloat(pendingTransferResult.rows[0].total)
                },
                transferred: {
                    count: parseInt(transferredResult.rows[0].count),
                    total: parseFloat(transferredResult.rows[0].total)
                },
                recentPayments: {
                    count: parseInt(recentPaymentsResult.rows[0].count),
                    total: parseFloat(recentPaymentsResult.rows[0].total)
                }
            }
        });
    } catch (error) {
        console.error('Get payment statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// =====================================================
// PARTNER MANAGEMENT ROUTES
// =====================================================

// Get partners list page
router.get('/partners', async (req, res) => {
    try {
        await tablesReady;
        const sidebarCounts = await getAdminSidebarCounts();
        
        // Get all partners with correct counts using subqueries (multi-partner support)
        const partnersResult = await pool.query(`
            SELECT 
                p.*,
                (
                    SELECT COUNT(DISTINCT student_id) 
                    FROM student_partners 
                    WHERE partner_id = p.id
                ) as student_count,
                (SELECT COALESCE(SUM(amount), 0) FROM partner_earnings WHERE partner_id = p.id) as total_earnings,
                (SELECT COALESCE(SUM(CASE WHEN is_paid = true THEN amount ELSE 0 END), 0) FROM partner_earnings WHERE partner_id = p.id) as paid_earnings,
                (SELECT COALESCE(SUM(CASE WHEN is_paid = false THEN amount ELSE 0 END), 0) FROM partner_earnings WHERE partner_id = p.id) as pending_earnings
            FROM partners p
            ORDER BY p.created_at DESC
        `);
        
        res.render('admin/partners', {
            title: 'Partnerler - Admin Panel',
            activePage: 'partners',
            partners: partnersResult.rows,
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Get partners error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get partners list API
router.get('/api/partners', async (req, res) => {
    try {
        await tablesReady;
        const result = await pool.query(`
            SELECT 
                p.*,
                (
                    SELECT COUNT(DISTINCT student_id) 
                    FROM student_partners 
                    WHERE partner_id = p.id
                ) as student_count,
                (SELECT COALESCE(SUM(CASE WHEN is_paid = true THEN amount ELSE 0 END), 0) FROM partner_earnings WHERE partner_id = p.id) as paid_earnings,
                (SELECT COALESCE(SUM(CASE WHEN is_paid = false THEN amount ELSE 0 END), 0) FROM partner_earnings WHERE partner_id = p.id) as pending_earnings
            FROM partners p
            ORDER BY p.created_at DESC
        `);
        
        res.json({
            success: true,
            partners: result.rows
        });
    } catch (error) {
        console.error('Get partners API error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get students assigned to a specific partner (with earnings summary)
router.get('/partners/:id/students', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.active_class, 
                   u.desired_country, u.current_school, u.created_at,
                   COALESCE((SELECT SUM(pe.amount) FROM partner_earnings pe WHERE pe.user_id = u.id AND pe.partner_id = $1), 0) as total_earning,
                   COALESCE((SELECT SUM(pe.amount) FROM partner_earnings pe WHERE pe.user_id = u.id AND pe.partner_id = $1 AND pe.is_paid = true), 0) as paid_earning,
                   COALESCE((SELECT SUM(pe.amount) FROM partner_earnings pe WHERE pe.user_id = u.id AND pe.partner_id = $1 AND pe.is_paid = false), 0) as pending_earning,
                   COALESCE((SELECT pe.currency FROM partner_earnings pe WHERE pe.user_id = u.id AND pe.partner_id = $1 LIMIT 1), 'EUR') as earning_currency
            FROM users u
            INNER JOIN student_partners sp ON u.id = sp.student_id
            WHERE sp.partner_id = $1
            ORDER BY u.first_name ASC, u.last_name ASC
        `, [id]);

        res.json({ success: true, students: result.rows });
    } catch (error) {
        console.error('Get partner students error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add new partner
router.post('/partners', async (req, res) => {
    try {
        const { first_name, last_name, email, company_name, phone, language = 'tr' } = req.body;
        
        if (!first_name || !last_name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Ad, soyad ve e-posta adresi gerekli'
            });
        }
        
        // Check if partner already exists
        const existingPartner = await pool.query(
            'SELECT id FROM partners WHERE email = $1',
            [email]
        );
        
        if (existingPartner.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Bu e-posta adresi ile kayıtlı bir partner zaten var'
            });
        }
        
        // Generate verification token
        const verificationToken = generateVerificationToken();
        
        // Insert partner
        const result = await pool.query(`
            INSERT INTO partners (first_name, last_name, email, company_name, phone, verification_token, email_verified, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, false, true)
            RETURNING id, first_name, last_name, email, company_name, phone
        `, [first_name, last_name, email, company_name || null, phone || null, verificationToken]);
        
        const partner = result.rows[0];
        
        // Send verification email
        await sendPartnerVerificationEmail(email, first_name, verificationToken, language);
        
        res.status(201).json({
            success: true,
            message: 'Partner başarıyla eklendi. Doğrulama e-postası gönderildi.',
            partner
        });
        
    } catch (error) {
        console.error('Add partner error:', error);
        res.status(500).json({ success: false, message: 'Partner eklenirken hata oluştu: ' + error.message });
    }
});

// Update partner
router.put('/partners/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, company_name, phone, is_active } = req.body;
        
        const result = await pool.query(`
            UPDATE partners 
            SET first_name = COALESCE($1, first_name),
                last_name = COALESCE($2, last_name),
                company_name = COALESCE($3, company_name),
                phone = COALESCE($4, phone),
                is_active = COALESCE($5, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
            RETURNING *
        `, [first_name, last_name, company_name, phone, is_active, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Partner bulunamadı'
            });
        }
        
        res.json({
            success: true,
            message: 'Partner başarıyla güncellendi',
            partner: result.rows[0]
        });
        
    } catch (error) {
        console.error('Update partner error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete partner
router.delete('/partners/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // First, remove partner_id from associated users
        await pool.query('UPDATE users SET partner_id = NULL WHERE partner_id = $1', [id]);
        
        // Delete partner earnings
        await pool.query('DELETE FROM partner_earnings WHERE partner_id = $1', [id]);
        
        // Delete partner
        const result = await pool.query(
            'DELETE FROM partners WHERE id = $1 RETURNING first_name, last_name',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Partner bulunamadı'
            });
        }
        
        res.json({
            success: true,
            message: `${result.rows[0].first_name} ${result.rows[0].last_name} başarıyla silindi`
        });
        
    } catch (error) {
        console.error('Delete partner error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Resend partner verification email
router.post('/partners/:id/resend-verification', async (req, res) => {
    try {
        const { id } = req.params;
        const { language = 'tr' } = req.body;
        
        const partnerResult = await pool.query(
            'SELECT id, first_name, last_name, email, email_verified FROM partners WHERE id = $1',
            [id]
        );
        
        if (partnerResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Partner bulunamadı'
            });
        }
        
        const partner = partnerResult.rows[0];
        
        if (partner.email_verified) {
            return res.status(400).json({
                success: false,
                message: 'Bu partner zaten doğrulanmış'
            });
        }
        
        // Generate new verification token
        const newToken = generateVerificationToken();
        
        await pool.query(
            'UPDATE partners SET verification_token = $1 WHERE id = $2',
            [newToken, id]
        );
        
        // Send verification email
        await sendPartnerVerificationEmail(partner.email, partner.first_name, newToken, language);
        
        res.json({
            success: true,
            message: 'Doğrulama e-postası tekrar gönderildi'
        });
        
    } catch (error) {
        console.error('Resend partner verification error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =====================================================
// STUDENT-PARTNER ASSIGNMENT ROUTES
// =====================================================

// Assign partner to student
router.put('/users/:id/partner', async (req, res) => {
    try {
        const { id } = req.params;
        const { partner_id } = req.body;
        
        // Validate partner exists (if partner_id is provided)
        if (partner_id) {
            const partnerCheck = await pool.query(
                'SELECT id, first_name, last_name FROM partners WHERE id = $1',
                [partner_id]
            );
            
            if (partnerCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Partner bulunamadı'
                });
            }
        }
        
        // Update user's partner_id
        const result = await pool.query(
            'UPDATE users SET partner_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING first_name, last_name, partner_id',
            [partner_id || null, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Öğrenci bulunamadı'
            });
        }
        
        const message = partner_id 
            ? 'Partner başarıyla atandı' 
            : 'Partner ataması kaldırıldı';
        
        res.json({
            success: true,
            message,
            user: result.rows[0]
        });
        
    } catch (error) {
        console.error('Assign partner error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Assign partner to student (multi-partner support via student_partners table)
router.post('/users/:id/partners', async (req, res) => {
    try {
        const { id } = req.params;
        const { partner_id } = req.body;
        
        if (!partner_id) {
            return res.status(400).json({
                success: false,
                message: 'Partner ID gerekli'
            });
        }
        
        // Validate partner exists
        const partnerCheck = await pool.query(
            'SELECT id, first_name, last_name FROM partners WHERE id = $1',
            [partner_id]
        );
        
        if (partnerCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Partner bulunamadı'
            });
        }
        
        // Insert into student_partners table (multi-partner support)
        await pool.query(`
            INSERT INTO student_partners (student_id, partner_id)
            VALUES ($1, $2)
            ON CONFLICT (student_id, partner_id) DO NOTHING
        `, [id, partner_id]);

        // Send email notification to partner
        try {
            const partnerInfo = await pool.query('SELECT email, first_name, last_name FROM partners WHERE id = $1', [partner_id]);
            const studentInfo = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [id]);
            if (partnerInfo.rows.length > 0 && studentInfo.rows.length > 0) {
                const p = partnerInfo.rows[0];
                const s = studentInfo.rows[0];
                sendPartnerNewStudentEmail(p.email, `${p.first_name} ${p.last_name}`, `${s.first_name} ${s.last_name}`);
            }
        } catch (emailErr) {
            console.error('Partner new student email failed (non-blocking):', emailErr.message);
        }
        
        res.json({
            success: true,
            message: 'Partner başarıyla atandı',
            partner: partnerCheck.rows[0]
        });
        
    } catch (error) {
        console.error('Assign partner (multi) error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Remove partner assignment from student
router.delete('/users/:id/partners/:partnerId', async (req, res) => {
    try {
        const { id, partnerId } = req.params;
        
        // Delete from student_partners table
        const result = await pool.query(`
            DELETE FROM student_partners 
            WHERE student_id = $1 AND partner_id = $2
            RETURNING id
        `, [id, partnerId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Atama bulunamadı'
            });
        }
        
        res.json({
            success: true,
            message: 'Partner ataması kaldırıldı'
        });
        
    } catch (error) {
        console.error('Remove partner assignment error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get student's partner info (with multi-partner support)
router.get('/users/:id/partner', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get user's legacy partner info
        const userResult = await pool.query(`
            SELECT 
                u.partner_id,
                p.first_name as partner_first_name,
                p.last_name as partner_last_name,
                p.email as partner_email,
                p.company_name as partner_company
            FROM users u
            LEFT JOIN partners p ON u.partner_id = p.id
            WHERE u.id = $1
        `, [id]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Öğrenci bulunamadı'
            });
        }
        
        const user = userResult.rows[0];
        
        // Get all assigned partners from student_partners table (multi-partner support)
        let assignedPartnerIds = [];
        try {
            const assignedPartnersResult = await pool.query(`
                SELECT partner_id FROM student_partners WHERE student_id = $1
            `, [id]);
            assignedPartnerIds = assignedPartnersResult.rows.map(row => row.partner_id);
        } catch (e) {
            // Table might not exist yet, fallback to legacy
            console.log('student_partners table not found, using legacy partner_id');
        }
        
        // Fallback to legacy partner_id if no multi-partner assignments
        if (assignedPartnerIds.length === 0 && user.partner_id) {
            assignedPartnerIds = [user.partner_id];
        }
        
        // Get all earnings for this student
        const earningsResult = await pool.query(`
            SELECT 
                pe.id,
                pe.amount,
                pe.currency,
                pe.earning_date,
                pe.is_paid,
                pe.payment_date,
                pe.notes,
                pe.partner_id,
                CONCAT(p.first_name, ' ', p.last_name) as partner_name
            FROM partner_earnings pe
            JOIN partners p ON pe.partner_id = p.id
            WHERE pe.user_id = $1
            ORDER BY pe.earning_date DESC
        `, [id]);
        
        res.json({
            success: true,
            has_partner: assignedPartnerIds.length > 0,
            assigned_partner_ids: assignedPartnerIds,
            partner: user.partner_id ? {
                id: user.partner_id,
                name: `${user.partner_first_name} ${user.partner_last_name}`,
                email: user.partner_email,
                company_name: user.partner_company
            } : null,
            earnings: earningsResult.rows
        });
        
    } catch (error) {
        console.error('Get student partner error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =====================================================
// PARTNER EARNINGS ROUTES
// =====================================================

// Add earning for a student-partner
router.post('/partner-earnings', async (req, res) => {
    try {
        const { partner_id, user_id, amount, currency, earning_date, is_paid, notes } = req.body;
        
        if (!partner_id || !user_id || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Partner, öğrenci ve tutar gerekli'
            });
        }
        
        // Verify partner and user exist
        const partnerCheck = await pool.query('SELECT id FROM partners WHERE id = $1', [partner_id]);
        const userCheck = await pool.query('SELECT id, partner_id FROM users WHERE id = $1', [user_id]);
        
        if (partnerCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Partner bulunamadı' });
        }
        
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Öğrenci bulunamadı' });
        }
        
        // Insert earning
        const earningCurrency = currency || 'EUR';
        const result = await pool.query(`
            INSERT INTO partner_earnings (partner_id, user_id, amount, currency, earning_date, is_paid, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [partner_id, user_id, amount, earningCurrency, earning_date || new Date().toISOString().split('T')[0], is_paid || false, notes || null]);
        
        // Also update user's partner_id if not set
        if (!userCheck.rows[0].partner_id) {
            await pool.query('UPDATE users SET partner_id = $1 WHERE id = $2', [partner_id, user_id]);
        }

        // Send email notification to partner
        try {
            const partnerInfo = await pool.query('SELECT email, first_name, last_name FROM partners WHERE id = $1', [partner_id]);
            const studentInfo = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [user_id]);
            if (partnerInfo.rows.length > 0 && studentInfo.rows.length > 0) {
                const p = partnerInfo.rows[0];
                const s = studentInfo.rows[0];
                sendPartnerNewEarningEmail(p.email, `${p.first_name} ${p.last_name}`, `${s.first_name} ${s.last_name}`, amount, earningCurrency);
            }
        } catch (emailErr) {
            console.error('Partner earning email failed (non-blocking):', emailErr.message);
        }
        
        res.status(201).json({
            success: true,
            message: 'Kazanç kaydı başarıyla oluşturuldu',
            earning: result.rows[0]
        });
        
    } catch (error) {
        console.error('Add partner earning error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// Update partner earning
router.put('/partner-earnings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, currency, earning_date, is_paid, payment_date, notes } = req.body;

        // Check previous state to detect paid status change
        const prevResult = await pool.query('SELECT is_paid, partner_id, user_id, amount, currency FROM partner_earnings WHERE id = $1', [id]);
        if (prevResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Kazanç kaydı bulunamadı' });
        }
        const prevEarning = prevResult.rows[0];
        
        const updateFields = [];
        const updateValues = [];
        let paramIdx = 1;

        if (amount !== undefined) { updateFields.push(`amount = $${paramIdx++}`); updateValues.push(amount); }
        if (currency !== undefined) { updateFields.push(`currency = $${paramIdx++}`); updateValues.push(currency); }
        if (earning_date !== undefined) { updateFields.push(`earning_date = $${paramIdx++}`); updateValues.push(earning_date); }
        if (is_paid !== undefined) { updateFields.push(`is_paid = $${paramIdx++}`); updateValues.push(is_paid); }
        if (payment_date !== undefined || is_paid !== undefined) { updateFields.push(`payment_date = $${paramIdx++}`); updateValues.push(payment_date || null); }
        if (notes !== undefined) { updateFields.push(`notes = $${paramIdx++}`); updateValues.push(notes); }
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(id);

        const result = await pool.query(
            `UPDATE partner_earnings SET ${updateFields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
            updateValues
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Kazanç kaydı bulunamadı' });
        }

        // Send payment email if status changed to paid
        const updatedEarning = result.rows[0];
        if (is_paid === true && !prevEarning.is_paid) {
            try {
                const partnerInfo = await pool.query('SELECT email, first_name, last_name FROM partners WHERE id = $1', [updatedEarning.partner_id]);
                const studentInfo = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [updatedEarning.user_id]);
                if (partnerInfo.rows.length > 0 && studentInfo.rows.length > 0) {
                    const p = partnerInfo.rows[0];
                    const s = studentInfo.rows[0];
                    sendPartnerPaymentEmail(p.email, `${p.first_name} ${p.last_name}`, `${s.first_name} ${s.last_name}`, updatedEarning.amount, updatedEarning.currency);
                }
            } catch (emailErr) {
                console.error('Partner payment email failed (non-blocking):', emailErr.message);
            }
        }
        
        res.json({
            success: true,
            message: 'Kazanç kaydı başarıyla güncellendi',
            earning: updatedEarning
        });
        
    } catch (error) {
        console.error('Update partner earning error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete partner earning
router.delete('/partner-earnings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'DELETE FROM partner_earnings WHERE id = $1 RETURNING id',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Kazanç kaydı bulunamadı'
            });
        }
        
        res.json({
            success: true,
            message: 'Kazanç kaydı başarıyla silindi'
        });
        
    } catch (error) {
        console.error('Delete partner earning error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all partner earnings (for admin dashboard)
router.get('/api/partner-earnings', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                pe.*,
                CONCAT(p.first_name, ' ', p.last_name) as partner_name,
                p.company_name as partner_company,
                u.first_name,
                u.last_name
            FROM partner_earnings pe
            JOIN partners p ON pe.partner_id = p.id
            JOIN users u ON pe.user_id = u.id
            ORDER BY pe.created_at DESC
        `);
        
        res.json({
            success: true,
            earnings: result.rows
        });
        
    } catch (error) {
        console.error('Get all partner earnings error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==================== VISA APPLICATIONS API ====================

// Create visa application
router.post('/visa-applications', async (req, res) => {
    try {
        const { user_id, country, consulate_city, status, notes, appointments } = req.body;
        
        // Create visa application
        const result = await pool.query(
            `INSERT INTO visa_applications (user_id, country, consulate_city, status, notes)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [user_id, country, consulate_city, status || 'pending', notes]
        );
        
        const visaApplicationId = result.rows[0].id;
        
        // Add appointments
        if (appointments && appointments.length > 0) {
            for (const aptDate of appointments) {
                if (aptDate) {
                    await pool.query(
                        `INSERT INTO visa_appointments (visa_application_id, appointment_date)
                         VALUES ($1, $2)`,
                        [visaApplicationId, aptDate]
                    );
                }
            }
        }
        
        // Get user info for email
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [user_id]);
        const user = userResult.rows[0];
        
        // Send email notification
        if (user && user.email) {
            try {
                await sendVisaApplicationEmail(user, country, consulate_city, 'created');
            } catch (emailError) {
                console.error('Email sending failed:', emailError);
            }
        }
        
        res.json({ success: true, message: 'Vize başvurusu oluşturuldu', data: result.rows[0] });
        
    } catch (error) {
        console.error('Create visa application error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get single visa application
router.get('/visa-applications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            `SELECT va.*, u.first_name, u.last_name, u.email
             FROM visa_applications va
             JOIN users u ON va.user_id = u.id
             WHERE va.id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Vize başvurusu bulunamadı' });
        }
        
        const visa = result.rows[0];
        
        // Get appointments
        const appointmentsResult = await pool.query(
            'SELECT * FROM visa_appointments WHERE visa_application_id = $1 ORDER BY appointment_date ASC',
            [id]
        );
        visa.appointments = appointmentsResult.rows;
        
        res.json({ success: true, data: visa });
        
    } catch (error) {
        console.error('Get visa application error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update visa application
router.put('/visa-applications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, country, consulate_city, status, notes, appointments } = req.body;
        
        // Get old status for email comparison
        const oldResult = await pool.query('SELECT * FROM visa_applications WHERE id = $1', [id]);
        const oldStatus = oldResult.rows[0]?.status;
        
        // Update visa application
        await pool.query(
            `UPDATE visa_applications 
             SET user_id = $1, country = $2, consulate_city = $3, status = $4, notes = $5, updated_at = NOW()
             WHERE id = $6`,
            [user_id, country, consulate_city, status, notes, id]
        );
        
        // Delete old appointments and add new ones
        await pool.query('DELETE FROM visa_appointments WHERE visa_application_id = $1', [id]);
        
        if (appointments && appointments.length > 0) {
            for (const aptDate of appointments) {
                if (aptDate) {
                    await pool.query(
                        `INSERT INTO visa_appointments (visa_application_id, appointment_date)
                         VALUES ($1, $2)`,
                        [id, aptDate]
                    );
                }
            }
        }
        
        // Send email if status changed
        if (oldStatus && oldStatus !== status) {
            const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [user_id]);
            const user = userResult.rows[0];
            
            if (user && user.email) {
                try {
                    await sendVisaApplicationEmail(user, country, consulate_city, status);
                } catch (emailError) {
                    console.error('Email sending failed:', emailError);
                }
            }
        }
        
        res.json({ success: true, message: 'Vize başvurusu güncellendi' });
        
    } catch (error) {
        console.error('Update visa application error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update visa application status
router.put('/visa-applications/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        // Get visa application info
        const visaResult = await pool.query(
            `SELECT va.*, u.first_name, u.last_name, u.email
             FROM visa_applications va
             JOIN users u ON va.user_id = u.id
             WHERE va.id = $1`,
            [id]
        );
        
        if (visaResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Vize başvurusu bulunamadı' });
        }
        
        const visa = visaResult.rows[0];
        
        // Update status
        await pool.query(
            'UPDATE visa_applications SET status = $1, updated_at = NOW() WHERE id = $2',
            [status, id]
        );
        
        // Send email notification
        try {
            await sendVisaApplicationEmail(visa, visa.country, visa.consulate_city, status);
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
        }
        
        res.json({ success: true, message: 'Vize başvurusu durumu güncellendi' });
        
    } catch (error) {
        console.error('Update visa status error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete visa application
router.delete('/visa-applications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Delete appointments first (cascade should handle this, but just in case)
        await pool.query('DELETE FROM visa_appointments WHERE visa_application_id = $1', [id]);
        
        // Delete visa application
        await pool.query('DELETE FROM visa_applications WHERE id = $1', [id]);
        
        res.json({ success: true, message: 'Vize başvurusu silindi' });
        
    } catch (error) {
        console.error('Delete visa application error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== GALERİ YÖNETİMİ ====================

// Cloudinary configuration for gallery
const cloudinary = require('cloudinary').v2;
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dkhe6tjqo',
    api_key: process.env.CLOUDINARY_API_KEY || '373479217921793',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'GWf3lT2-xcUUPAAGRLMyT3ieyvY'
});

const galleryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Sadece resim dosyaları yüklenebilir (JPEG, PNG, GIF, WebP)'));
        }
    }
});

// Gallery Admin Page
router.get('/gallery', requireSuperAdminPage, async (req, res) => {
    try {
        const topics = await pool.query(`
            SELECT gt.*, 
                   COUNT(gi.id) as image_count
            FROM gallery_topics gt
            LEFT JOIN gallery_images gi ON gt.id = gi.topic_id
            GROUP BY gt.id
            ORDER BY gt.sort_order ASC, gt.created_at DESC
        `);
        
        const images = await pool.query(`
            SELECT * FROM gallery_images ORDER BY topic_id, sort_order ASC, created_at DESC
        `);
        
        const imagesByTopic = {};
        images.rows.forEach(img => {
            if (!imagesByTopic[img.topic_id]) imagesByTopic[img.topic_id] = [];
            imagesByTopic[img.topic_id].push(img);
        });
        
        const sidebarCounts = await getAdminSidebarCounts();
        
        res.render('admin/gallery', {
            title: 'Galeri Yönetimi',
            activePage: 'gallery',
            topics: topics.rows,
            imagesByTopic: imagesByTopic,
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Gallery page error:', error);
        res.status(500).send('Galeri sayfası yüklenirken hata oluştu');
    }
});

// Create Gallery Topic
router.post('/gallery/topics', requireSuperAdminPage, async (req, res) => {
    try {
        const { title } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Başlık gerekli' });
        }
        
        const maxOrder = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM gallery_topics');
        const nextOrder = maxOrder.rows[0].next_order;
        
        const result = await pool.query(
            'INSERT INTO gallery_topics (title, sort_order) VALUES ($1, $2) RETURNING *',
            [title.trim(), nextOrder]
        );
        
        res.json({ success: true, topic: result.rows[0] });
    } catch (error) {
        console.error('Create topic error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update Gallery Topic
router.put('/gallery/topics/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, is_active } = req.body;
        
        const updates = [];
        const params = [];
        let paramIdx = 1;
        
        if (title !== undefined) {
            updates.push(`title = $${paramIdx++}`);
            params.push(title.trim());
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramIdx++}`);
            params.push(is_active);
        }
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        
        params.push(id);
        
        const result = await pool.query(
            `UPDATE gallery_topics SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
            params
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Konu bulunamadı' });
        }
        
        res.json({ success: true, topic: result.rows[0] });
    } catch (error) {
        console.error('Update topic error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete Gallery Topic
router.delete('/gallery/topics/:id', requireSuperAdminPage, async (req, res) => {
    try {
        const { id } = req.params;
        
        const images = await pool.query('SELECT image_url FROM gallery_images WHERE topic_id = $1', [id]);
        for (const img of images.rows) {
            try {
                const urlParts = img.image_url.split('/');
                const publicId = 'gallery/' + urlParts[urlParts.length - 1].split('.')[0];
                await cloudinary.uploader.destroy(publicId);
            } catch (e) {}
        }
        
        await pool.query('DELETE FROM gallery_topics WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete topic error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Generate Cloudinary upload signature (browser uploads directly to Cloudinary)
router.get('/gallery/upload-signature', requireSuperAdminPage, async (req, res) => {
    try {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const params = {
            timestamp: timestamp,
            folder: 'gallery',
            transformation: 'w_1920,c_limit'
        };
        const signature = cloudinary.utils.api_sign_request(params, 
            process.env.CLOUDINARY_API_SECRET || 'GWf3lT2-xcUUPAAGRLMyT3ieyvY'
        );
        res.json({
            success: true,
            signature: signature,
            timestamp: timestamp,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'dkhe6tjqo',
            apiKey: process.env.CLOUDINARY_API_KEY || '373479217921793'
        });
    } catch (error) {
        console.error('Signature error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Save Cloudinary image URL to database (after browser uploads directly)
router.post('/gallery/images', requireSuperAdminPage, async (req, res) => {
    try {
        const { topic_id, image_url, caption } = req.body;
        
        if (!image_url) {
            return res.status(400).json({ success: false, message: 'Görsel URL gerekli' });
        }
        if (!topic_id) {
            return res.status(400).json({ success: false, message: 'Konu ID gerekli' });
        }
        
        const maxOrder = await pool.query(
            'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM gallery_images WHERE topic_id = $1',
            [topic_id]
        );
        
        const result = await pool.query(
            'INSERT INTO gallery_images (topic_id, image_url, caption, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
            [topic_id, image_url, caption || null, maxOrder.rows[0].next_order]
        );
        
        res.json({ success: true, image: result.rows[0] });
    } catch (error) {
        console.error('Save image error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update Gallery Image Caption
router.put('/gallery/images/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { caption } = req.body;
        
        const result = await pool.query(
            'UPDATE gallery_images SET caption = $1 WHERE id = $2 RETURNING *',
            [caption || null, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Görsel bulunamadı' });
        }
        
        res.json({ success: true, image: result.rows[0] });
    } catch (error) {
        console.error('Update image error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete Gallery Image
router.delete('/gallery/images/:id', requireSuperAdminPage, async (req, res) => {
    try {
        const { id } = req.params;
        
        const image = await pool.query('SELECT image_url FROM gallery_images WHERE id = $1', [id]);
        if (image.rows.length > 0) {
            try {
                const urlParts = image.rows[0].image_url.split('/');
                const filenameWithExt = urlParts[urlParts.length - 1];
                const publicId = 'gallery/' + filenameWithExt.split('.')[0];
                await cloudinary.uploader.destroy(publicId);
            } catch (e) {}
        }
        
        await pool.query('DELETE FROM gallery_images WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Reorder Gallery Images within a topic
router.put('/gallery/images-reorder', async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) {
            return res.status(400).json({ success: false, message: 'Geçersiz sıralama verisi' });
        }
        
        for (let i = 0; i < order.length; i++) {
            await pool.query('UPDATE gallery_images SET sort_order = $1 WHERE id = $2', [i, order[i]]);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Reorder images error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Reorder Gallery Topics
router.put('/gallery/topics-reorder', async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) {
            return res.status(400).json({ success: false, message: 'Geçersiz sıralama verisi' });
        }
        
        for (let i = 0; i < order.length; i++) {
            await pool.query('UPDATE gallery_topics SET sort_order = $1 WHERE id = $2', [i, order[i]]);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Reorder topics error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== CO-ADMIN YÖNETİMİ ====================

// Adminler sayfası (sadece super admin erişebilir)
router.get('/admins', async (req, res) => {
    try {
        // Super admin kontrolü
        if (!res.locals.isSuperAdmin) {
            return res.redirect('/admin/dashboard');
        }
        
        // Co-adminleri getir (is_admin=true olan ve super admin e-postası olmayan)
        const superAdminEmail = 'cinarozmeral1@gmail.com';
        const coAdminsResult = await pool.query(`
            SELECT id, first_name, last_name, email, created_at
            FROM users
            WHERE is_admin = true AND email != $1
            ORDER BY created_at DESC
        `, [superAdminEmail]);
        
        const sidebarCounts = await getAdminSidebarCounts();
        
        res.render('admin/admins', {
            title: 'Adminler',
            activePage: 'admins',
            coAdmins: coAdminsResult.rows,
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Admins page error:', error);
        res.status(500).send('Sayfa yüklenirken hata oluştu');
    }
});

// Yeni co-admin oluştur
router.post('/api/admins', async (req, res) => {
    try {
        // Super admin kontrolü
        if (!res.locals.isSuperAdmin) {
            return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok' });
        }
        
        const { first_name, last_name, email, password } = req.body;
        
        if (!first_name || !last_name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Tüm alanlar zorunludur' });
        }
        
        // E-posta kontrolü
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Bu e-posta adresi zaten kullanılıyor' });
        }
        
        // Şifreyi hashle
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Co-admin oluştur
        const result = await pool.query(`
            INSERT INTO users (first_name, last_name, email, password, is_admin, created_at)
            VALUES ($1, $2, $3, $4, true, NOW())
            RETURNING id, first_name, last_name, email, created_at
        `, [first_name, last_name, email, hashedPassword]);
        
        res.json({ success: true, admin: result.rows[0] });
    } catch (error) {
        console.error('Create co-admin error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Co-admin güncelle
router.put('/api/admins/:id', async (req, res) => {
    try {
        // Super admin kontrolü
        if (!res.locals.isSuperAdmin) {
            return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok' });
        }
        
        const { id } = req.params;
        const { first_name, last_name, email, password } = req.body;
        
        if (!first_name || !last_name || !email) {
            return res.status(400).json({ success: false, message: 'Ad, soyad ve e-posta zorunludur' });
        }
        
        // Co-admin kontrolü (super admin güncellenemez)
        const superAdminEmail = 'cinarozmeral1@gmail.com';
        const adminCheck = await pool.query('SELECT email FROM users WHERE id = $1', [id]);
        if (adminCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Admin bulunamadı' });
        }
        if (adminCheck.rows[0].email === superAdminEmail) {
            return res.status(403).json({ success: false, message: 'Super admin güncellenemez' });
        }
        
        // E-posta kontrolü (başka birinde kullanılıyor mu?)
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Bu e-posta adresi zaten kullanılıyor' });
        }
        
        let result;
        if (password && password.length >= 6) {
            // Şifre ile güncelle
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash(password, 10);
            result = await pool.query(`
                UPDATE users SET first_name = $1, last_name = $2, email = $3, password = $4
                WHERE id = $5
                RETURNING id, first_name, last_name, email
            `, [first_name, last_name, email, hashedPassword, id]);
        } else {
            // Şifresiz güncelle
            result = await pool.query(`
                UPDATE users SET first_name = $1, last_name = $2, email = $3
                WHERE id = $4
                RETURNING id, first_name, last_name, email
            `, [first_name, last_name, email, id]);
        }
        
        res.json({ success: true, admin: result.rows[0] });
    } catch (error) {
        console.error('Update co-admin error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Co-admin sil
router.delete('/api/admins/:id', async (req, res) => {
    try {
        // Super admin kontrolü
        if (!res.locals.isSuperAdmin) {
            return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok' });
        }
        
        const { id } = req.params;
        
        // Co-admin kontrolü (super admin silinemez)
        const superAdminEmail = 'cinarozmeral1@gmail.com';
        const adminCheck = await pool.query('SELECT email FROM users WHERE id = $1', [id]);
        if (adminCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Admin bulunamadı' });
        }
        if (adminCheck.rows[0].email === superAdminEmail) {
            return res.status(403).json({ success: false, message: 'Super admin silinemez' });
        }
        
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Delete co-admin error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Test email notification endpoint (Super Admin only)
router.post('/api/test-email-notification', async (req, res) => {
    try {
        if (!req.session?.user?.is_super_admin) {
            return res.status(403).json({ success: false, message: 'Super admin only' });
        }
        
        const { sendNewStudentNotificationEmail } = require('../services/emailService');
        const { method = 'email' } = req.body;
        
        const testStudent = {
            first_name: 'Test',
            last_name: method === 'google' ? 'Google Kayıt' : 'Manuel Kayıt',
            email: method === 'google' ? 'test.google@example.com' : 'test.manuel@example.com',
            phone: '+90 555 000 0000'
        };
        
        const result = await sendNewStudentNotificationEmail(testStudent, method === 'google' ? 'google' : 'email');
        
        res.json({
            success: result,
            message: result 
                ? `Test email (${method}) başarıyla gönderildi!` 
                : `Test email (${method}) gönderilemedi. Logları kontrol edin.`
        });
    } catch (error) {
        console.error('Test email error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== APPOINTMENTS ADMIN ====================
router.get('/appointments', requireSuperAdminPage, async (req, res) => {
    try {
        const sidebarCounts = await getAdminSidebarCounts();
        const appointments = await pool.query(
            `SELECT * FROM appointments ORDER BY appointment_date DESC, turkey_time DESC`
        );
        res.render('admin/appointments', {
            title: 'Randevular',
            activePage: 'appointments',
            appointments: appointments.rows,
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Appointments page error:', error);
        res.status(500).send('Randevular sayfası yüklenirken hata oluştu');
    }
});

router.post('/appointments/:id/delete', requireSuperAdminPage, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Randevu bulunamadı.' });
        }
        const apt = result.rows[0];

        // Delete Zoom meeting
        if (apt.zoom_meeting_id) {
            try {
                const zoomService = require('../services/zoomService');
                if (zoomService.isConfigured()) {
                    await zoomService.deleteZoomMeeting(apt.zoom_meeting_id);
                    console.log('✅ Zoom meeting deleted:', apt.zoom_meeting_id);
                }
            } catch (zErr) { console.error('Zoom delete failed (non-blocking):', zErr.message); }
        }

        // Delete iCloud calendar event
        if (apt.calendar_event_id) {
            try {
                const calendarService = require('../services/calendarService');
                await calendarService.deleteEvent(apt.calendar_event_id);
            } catch (cErr) { console.error('iCloud delete failed (non-blocking):', cErr.message); }
        }

        await pool.query('DELETE FROM appointments WHERE id = $1', [id]);
        console.log('Appointment deleted:', id, apt.full_name);
        res.json({ success: true });
    } catch (error) {
        console.error('Appointment delete error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/appointments/:id/status', requireSuperAdminPage, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['confirmed', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Geçersiz durum' });
        }
        const oldResult = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);
        await pool.query('UPDATE appointments SET status = $1 WHERE id = $2', [status, id]);

        // When cancelled, remove Zoom meeting and iCloud event
        if (status === 'cancelled' && oldResult.rows.length > 0 && oldResult.rows[0].status !== 'cancelled') {
            const apt = oldResult.rows[0];
            if (apt.zoom_meeting_id) {
                try {
                    const zoomService = require('../services/zoomService');
                    if (zoomService.isConfigured()) {
                        await zoomService.deleteZoomMeeting(apt.zoom_meeting_id);
                        console.log('✅ Zoom meeting cancelled:', apt.zoom_meeting_id);
                    }
                } catch (zErr) { console.error('Zoom cancel-delete failed (non-blocking):', zErr.message); }
            }
            if (apt.calendar_event_id) {
                try {
                    const calendarService = require('../services/calendarService');
                    await calendarService.deleteEvent(apt.calendar_event_id);
                } catch (cErr) { console.error('iCloud cancel-delete failed (non-blocking):', cErr.message); }
            }
        }

        if (status === 'completed' && oldResult.rows.length > 0 && oldResult.rows[0].status !== 'completed') {
            const apt = oldResult.rows[0];
            try {
                const { sendReviewRequestEmail } = require('../services/emailService');
                await sendReviewRequestEmail(apt.email, apt.full_name.split(' ')[0], 'meeting');
                console.log('Review request email sent to:', apt.email);
            } catch (emailErr) {
                console.error('Review email error:', emailErr.message);
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Appointment status error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== ADMIN APPOINTMENT EDIT ====================
router.put('/appointments/:id/edit', requireSuperAdminPage, async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, email, phone, notes, date, timeSlot, target_country, field_of_interest, education_level } = req.body;

        const oldResult = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);
        if (oldResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Randevu bulunamadı.' });
        }
        const old = oldResult.rows[0];

        const dateChanged = date && timeSlot && (date !== old.appointment_date.toISOString().split('T')[0] || timeSlot !== `${old.czech_time}|${old.turkey_time}|${old.start_utc.toISOString()}|${old.end_utc.toISOString()}`);

        let newDate = old.appointment_date;
        let newCzechTime = old.czech_time;
        let newTurkeyTime = old.turkey_time;
        let newStartUTC = old.start_utc;
        let newEndUTC = old.end_utc;

        if (dateChanged && timeSlot) {
            const slotParts = timeSlot.split('|');
            newCzechTime = slotParts[0];
            newTurkeyTime = slotParts[1];
            newStartUTC = slotParts[2];
            newEndUTC = slotParts[3];
            newDate = date;

            const conflictCheck = await pool.query(
                `SELECT id FROM appointments WHERE appointment_date = $1 AND status != 'cancelled' AND start_utc = $2 AND id != $3`,
                [newDate, newStartUTC, id]
            );
            if (conflictCheck.rows.length > 0) {
                return res.status(409).json({ success: false, message: 'Bu saat dilimi dolu. Farklı bir saat seçin.' });
            }
        }

        const newFullName = full_name || old.full_name;
        const newEmail = email || old.email;
        const newPhone = phone !== undefined ? phone : old.phone;
        const newNotes = notes !== undefined ? notes : old.notes;
        const newCountry = target_country !== undefined ? target_country : old.target_country;
        const newField = field_of_interest !== undefined ? field_of_interest : old.field_of_interest;
        const newEducation = education_level !== undefined ? education_level : old.education_level;

        await pool.query(`
            UPDATE appointments SET
                full_name = $1, email = $2, phone = $3, notes = $4,
                appointment_date = $5, czech_time = $6, turkey_time = $7,
                start_utc = $8, end_utc = $9,
                target_country = $10, field_of_interest = $11, education_level = $12,
                zoom_reminder_sent = CASE WHEN $5::date != $13::date OR $8::timestamptz != $14::timestamptz THEN false ELSE zoom_reminder_sent END
            WHERE id = $15
        `, [newFullName, newEmail, newPhone, newNotes,
            newDate, newCzechTime, newTurkeyTime, newStartUTC, newEndUTC,
            newCountry, newField, newEducation,
            old.appointment_date, old.start_utc, id]);

        const calendarService = require('../services/calendarService');
        const zoomService = require('../services/zoomService');

        if (dateChanged && old.calendar_event_id) {
            try {
                const isPro = old.meeting_type === 'professional';
                const eventTitle = isPro ? `VG Görüşme - ${newFullName}` : `VG Randevu - ${newFullName}`;
                await calendarService.updateEvent(old.calendar_event_id, {
                    title: eventTitle,
                    description: `Ad Soyad: ${newFullName}\nE-posta: ${newEmail}\nTelefon: ${newPhone || '-'}\n${newNotes ? 'Not: ' + newNotes : ''}`,
                    startDate: new Date(newStartUTC),
                    endDate: new Date(newEndUTC),
                    attendeeEmail: newEmail,
                    attendeeName: newFullName
                });
                console.log('iCloud event updated for appointment:', id);
            } catch (calErr) {
                console.error('iCloud event update failed:', calErr.message);
            }
        }

        if (dateChanged && old.zoom_meeting_id && zoomService.isConfigured()) {
            try {
                await zoomService.updateZoomMeeting(old.zoom_meeting_id, {
                    topic: old.meeting_type === 'professional' ? `VG Danışmanlık - Görüşme - ${newFullName}` : `VG Danışmanlık - ${newFullName}`,
                    startTime: newStartUTC,
                    duration: 30
                });
                console.log('Zoom meeting updated for appointment:', id);
            } catch (zoomErr) {
                console.error('Zoom meeting update failed:', zoomErr.message);
                if (zoomService.isConfigured()) {
                    try {
                        const newMeeting = await zoomService.createZoomMeeting({
                            topic: old.meeting_type === 'professional' ? `VG Danışmanlık - Görüşme - ${newFullName}` : `VG Danışmanlık - ${newFullName}`,
                            startTime: newStartUTC,
                            duration: 30
                        });
                        await pool.query('UPDATE appointments SET zoom_link = $1, zoom_meeting_id = $2 WHERE id = $3',
                            [newMeeting.join_url, String(newMeeting.meeting_id), id]);
                        console.log('New Zoom meeting created after update failure:', newMeeting.join_url);
                    } catch (newZoomErr) {
                        console.error('New Zoom meeting creation also failed:', newZoomErr.message);
                    }
                }
            }
        }

        // Send notification email
        try {
            const nodemailer = require('nodemailer');
            const emailUser = (process.env.EMAIL_USER || '').trim().replace(/\\n/g, '').replace(/\n/g, '');
            const emailPass = (process.env.EMAIL_PASS || '').trim().replace(/\\n/g, '').replace(/\n/g, '');
            if (emailUser && emailPass) {
                const mailer = nodemailer.createTransport({ service: 'gmail', auth: { user: emailUser, pass: emailPass }, tls: { rejectUnauthorized: false } });
                const getEmailSignature = () => `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;"><p style="margin: 0 0 15px 0; color: #333; font-style: italic; font-weight: 500;">Kind Regards,</p><p style="margin: 0 0 3px 0;"><a href="https://vgdanismanlik.com" style="color: #2563eb; text-decoration: underline; font-weight: bold; font-style: italic;">vgdanismanlik.com</a></p><p style="margin: 0 0 3px 0; color: #1a365d; font-weight: bold; font-style: italic;">CZ: +420 776 791 541</p><p style="margin: 0 0 20px 0; color: #1a365d; font-weight: bold; font-style: italic;">TR: +90 539 927 30 08</p><table cellpadding="0" cellspacing="0" border="0" style="margin-top: 15px;"><tr><td style="vertical-align: middle; padding-right: 15px;"><img src="https://vgdanismanlik.com/images/logos/01-1%20copy.png" alt="VG Danışmanlık" style="height: 80px; width: auto;"></td><td style="vertical-align: middle;"><p style="margin: 0; color: #1e40af; font-size: 18px; font-weight: bold;">VG DANIŞMANLIK</p><p style="margin: 0; color: #3b82f6; font-size: 14px; font-weight: 600;">YURT DIŞI EĞİTİM</p></td></tr></table></div>`;
                const emailWrapper = (content) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light dark"><style>@media (prefers-color-scheme: dark) { .email-body { background-color: #1a1a2e !important; } .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; } .email-text { color: #e0e0e0 !important; } .email-muted { color: #a0a0b0 !important; } .info-box { background-color: #1a2744 !important; } }</style></head><body style="margin: 0; padding: 0;"><div class="email-body" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;"><div style="background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;"><h1 style="margin: 0; font-size: 24px; font-weight: 700;">VG Danışmanlık</h1><p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Yurt Dışı Eğitim Danışmanlığı</p></div><div class="email-card" style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">${content}${getEmailSignature()}</div></div></body></html>`;

                const firstName = newFullName.split(' ')[0];
                const isPro = old.meeting_type === 'professional';
                const updatedApt = (await pool.query('SELECT * FROM appointments WHERE id = $1', [id])).rows[0];
                const currentZoomLink = updatedApt ? updatedApt.zoom_link : old.zoom_link;

                if (dateChanged) {
                    const oldDateFormatted = new Date(old.appointment_date).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    const newDateFormatted = new Date(newDate).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

                    await mailer.sendMail({
                        from: `"VG Danışmanlık" <${emailUser}>`,
                        to: newEmail,
                        subject: `VG Danışmanlık - ${isPro ? 'Görüşme' : 'Randevu'} Tarihi Değişikliği`,
                        html: emailWrapper(`
                            <h2 class="email-text" style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">
                                <i style="color: #f59e0b;">⚠</i> ${isPro ? 'Görüşme' : 'Randevu'} Tarih/Saat Değişikliği
                            </h2>
                            <p class="email-muted" style="color: #4b5563; line-height: 1.7; margin-bottom: 20px;">
                                ${isPro ? 'Sayın' : 'Merhaba'} <strong>${firstName}</strong>, ${isPro ? 'görüşmenizin' : 'randevunuzun'} tarih ve/veya saati güncellenmiştir.
                            </p>
                            <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                                <p style="margin: 0 0 8px 0; color: #92400e; font-weight: 700; font-size: 13px; text-transform: uppercase;">Eski Tarih/Saat</p>
                                <p style="margin: 0; color: #92400e; font-size: 15px; text-decoration: line-through;">${oldDateFormatted} — ${old.turkey_time} (TSİ)</p>
                            </div>
                            <div style="background: #d1fae5; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #059669;">
                                <p style="margin: 0 0 8px 0; color: #065f46; font-weight: 700; font-size: 13px; text-transform: uppercase;">Yeni Tarih/Saat</p>
                                <p style="margin: 0; color: #065f46; font-size: 18px; font-weight: 700;">${newDateFormatted} — ${newTurkeyTime} (TSİ)</p>
                            </div>
                            ${currentZoomLink ? `<div style="text-align: center; margin: 25px 0;"><a href="${currentZoomLink}" style="display: inline-block; background: linear-gradient(135deg, #2D8CFF, #0B5CFF); color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px;">Zoom Toplantısına Katıl</a></div>` : ''}
                            <div style="background: #f0f7ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
                                <p style="margin: 0; color: #003d6b; font-size: 14px;">
                                    <strong>Not:</strong> Toplantı linki görüşmeden 30 dakika önce ayrıca e-posta ile gönderilecektir. Değişiklikle ilgili sorularınız için bizimle iletişime geçebilirsiniz.
                                </p>
                            </div>
                            <div style="text-align: center; margin-top: 25px;">
                                <a href="https://wa.me/905399273008" style="display: inline-block; background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">WhatsApp ile İletişim</a>
                            </div>
                        `)
                    });
                    console.log('Date change email sent to:', newEmail);
                } else {
                    const changes = [];
                    if (full_name && full_name !== old.full_name) changes.push('İsim');
                    if (email && email !== old.email) changes.push('E-posta');
                    if (phone !== undefined && phone !== old.phone) changes.push('Telefon');
                    if (notes !== undefined && notes !== old.notes) changes.push('Not');
                    if (target_country !== undefined && target_country !== old.target_country) changes.push('Hedef Ülke');

                    if (changes.length > 0) {
                        const dateFormatted = new Date(old.appointment_date).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                        await mailer.sendMail({
                            from: `"VG Danışmanlık" <${emailUser}>`,
                            to: newEmail,
                            subject: `VG Danışmanlık - ${isPro ? 'Görüşme' : 'Randevu'} Bilgileri Güncellendi`,
                            html: emailWrapper(`
                                <h2 class="email-text" style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">
                                    ${isPro ? 'Görüşme' : 'Randevu'} Bilgileri Güncellendi
                                </h2>
                                <p class="email-muted" style="color: #4b5563; line-height: 1.7; margin-bottom: 20px;">
                                    ${isPro ? 'Sayın' : 'Merhaba'} <strong>${firstName}</strong>, ${isPro ? 'görüşmenize' : 'randevunuza'} ait bazı bilgiler güncellenmiştir.
                                </p>
                                <div style="background: #f0f7ff; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid #005A9E;">
                                    <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px;">Güncellenen Alanlar</p>
                                    <p style="margin: 0; color: #005A9E; font-weight: 700;">${changes.join(', ')}</p>
                                </div>
                                <div style="background: #f0f7ff; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid #005A9E;">
                                    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;">Tarih</td><td style="padding: 8px 0; font-weight: 600; color: #1a1a1a;">${dateFormatted}</td></tr>
                                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Saat</td><td style="padding: 8px 0; font-weight: 700; color: #005A9E; font-size: 18px;">${old.turkey_time} (TSİ)</td></tr>
                                    </table>
                                </div>
                                ${currentZoomLink ? `<div style="text-align: center; margin: 20px 0;"><a href="${currentZoomLink}" style="display: inline-block; background: linear-gradient(135deg, #2D8CFF, #0B5CFF); color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px;">Zoom Toplantısına Katıl</a></div>` : ''}
                                <div style="text-align: center; margin-top: 25px;">
                                    <a href="https://wa.me/905399273008" style="display: inline-block; background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">WhatsApp ile İletişim</a>
                                </div>
                            `)
                        });
                        console.log('Details change email sent to:', newEmail);
                    }
                }
            }
        } catch (mailErr) {
            console.error('Edit appointment email error:', mailErr.message);
        }

        res.json({ success: true, message: 'Randevu başarıyla güncellendi.' });
    } catch (error) {
        console.error('Edit appointment error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get single appointment details
router.get('/appointments/:id/details', requireSuperAdminPage, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Randevu bulunamadı.' });
        }
        res.json({ success: true, appointment: result.rows[0] });
    } catch (error) {
        console.error('Get appointment details error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== ADMIN APPOINTMENT CREATION ====================
router.get('/appointments/create', requireSuperAdminPage, async (req, res) => {
    try {
        const sidebarCounts = await getAdminSidebarCounts();
        res.render('admin/appointment-create', {
            title: 'Yeni Randevu Oluştur',
            activePage: 'appointments',
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Appointment create page error:', error);
        res.status(500).send('Sayfa yüklenirken hata oluştu');
    }
});

router.get('/api/students-search', requireSuperAdminPage, async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (q.length < 2) {
            return res.json({ success: true, students: [] });
        }
        const result = await pool.query(`
            SELECT id, first_name, last_name, email, phone, desired_country, active_class
            FROM users 
            WHERE (is_admin = false OR is_admin IS NULL)
            AND (
                LOWER(first_name || ' ' || last_name) LIKE LOWER($1)
                OR LOWER(email) LIKE LOWER($1)
                OR phone LIKE $1
            )
            ORDER BY first_name, last_name
            LIMIT 15
        `, [`%${q}%`]);
        res.json({ success: true, students: result.rows });
    } catch (error) {
        console.error('Student search error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/appointments/create', requireSuperAdminPage, async (req, res) => {
    try {
        const { meetingType, studentId, fullName, phone, email, targetCountry, fieldOfInterest, educationLevel, grade, notes, date, timeSlot } = req.body;
        const isPro = meetingType === 'professional';

        if (!fullName || !email || !date || !timeSlot) {
            return res.status(400).json({ success: false, message: 'Zorunlu alanları doldurun.' });
        }

        const slotParts = timeSlot.split('|');
        const czechTime = slotParts[0];
        const turkeyTime = slotParts[1];
        const startUTC = slotParts[2];
        const endUTC = slotParts[3];

        const conflictCheck = await pool.query(
            `SELECT id FROM appointments WHERE appointment_date = $1 AND status != 'cancelled' AND start_utc = $2`,
            [date, startUTC]
        );
        if (conflictCheck.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Bu saat dilimi dolu. Farklı bir saat seçin.' });
        }

        const calendarService = require('../services/calendarService');
        const zoomService = require('../services/zoomService');

        const eventTitle = isPro ? `VG Görüşme - ${fullName}` : `VG Randevu - ${fullName} (Admin)`;
        const eventDesc = isPro
            ? `Katılımcı: ${fullName}\nE-posta: ${email}\nTelefon: ${phone || '-'}\n${notes ? 'Not: ' + notes : ''}\n(Profesyonel Görüşme)`
            : `Ad Soyad: ${fullName}\nTelefon: ${phone || '-'}\nE-posta: ${email}\nHedef Ülke: ${targetCountry || '-'}\nİlgi Alanı: ${fieldOfInterest || '-'}\n(Admin tarafından oluşturuldu)`;

        let calendarEventId = null;
        try {
            calendarEventId = await calendarService.createEvent({
                title: eventTitle,
                description: eventDesc,
                startDate: new Date(startUTC),
                endDate: new Date(endUTC),
                attendeeEmail: email,
                attendeeName: fullName
            });
        } catch (calError) {
            console.error('Calendar event creation failed:', calError.message);
        }

        let zoomLink = null;
        let zoomMeetingId = null;
        try {
            if (zoomService.isConfigured()) {
                const meeting = await zoomService.createZoomMeeting({
                    topic: isPro ? `VG Danışmanlık - Görüşme - ${fullName}` : `VG Danışmanlık - ${fullName}`,
                    startTime: startUTC,
                    duration: 30,
                    agenda: isPro ? `Profesyonel görüşme: ${fullName}` : `Danışmanlık görüşmesi: ${fullName} - ${targetCountry || 'Genel'}`
                });
                zoomLink = meeting.join_url;
                zoomMeetingId = meeting.meeting_id ? String(meeting.meeting_id) : null;
            }
        } catch (zoomError) {
            console.error('Zoom meeting creation failed:', zoomError.message);
        }

        const result = await pool.query(
            `INSERT INTO appointments (
                full_name, phone, email, target_country, field_of_interest,
                education_level, grade, budget, notes,
                appointment_date, czech_time, turkey_time,
                start_utc, end_utc, calendar_event_id, ip_address, status, zoom_link, zoom_meeting_id, meeting_type
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'confirmed',$17,$18,$19)
            RETURNING *`,
            [fullName, phone || '', email,
             isPro ? 'Profesyonel' : (targetCountry || 'Admin'),
             isPro ? 'Profesyonel Görüşme' : (fieldOfInterest || 'Genel Danışmanlık'),
             isPro ? 'Profesyonel' : (educationLevel || 'Belirtilmedi'),
             grade || null, null, notes || (isPro ? 'Profesyonel görüşme' : 'Admin tarafından oluşturuldu'),
             date, czechTime, turkeyTime, startUTC, endUTC,
             calendarEventId || null, 'admin', zoomLink, zoomMeetingId, isPro ? 'professional' : 'student']
        );

        const appointment = result.rows[0];

        try {
            const nodemailer = require('nodemailer');
            const emailUserEnv = (process.env.EMAIL_USER || '').trim();
            const emailPassEnv = (process.env.EMAIL_PASS || '').trim();
            if (emailUserEnv && emailPassEnv) {
                const mailer = nodemailer.createTransport({ service: 'gmail', auth: { user: emailUserEnv, pass: emailPassEnv }, tls: { rejectUnauthorized: false } });
                const dateFormatted = new Date(date).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

                const getEmailSignature = () => `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;"><p style="margin: 0 0 15px 0; color: #333; font-style: italic; font-weight: 500;">Kind Regards,</p><p style="margin: 0 0 3px 0;"><a href="https://vgdanismanlik.com" style="color: #2563eb; text-decoration: underline; font-weight: bold; font-style: italic;">vgdanismanlik.com</a></p><p style="margin: 0 0 3px 0; color: #1a365d; font-weight: bold; font-style: italic;">CZ: +420 776 791 541</p><p style="margin: 0 0 20px 0; color: #1a365d; font-weight: bold; font-style: italic;">TR: +90 539 927 30 08</p><table cellpadding="0" cellspacing="0" border="0" style="margin-top: 15px;"><tr><td style="vertical-align: middle; padding-right: 15px;"><img src="https://vgdanismanlik.com/images/logos/01-1%20copy.png" alt="VG Danışmanlık" style="height: 80px; width: auto;"></td><td style="vertical-align: middle;"><p style="margin: 0; color: #1e40af; font-size: 18px; font-weight: bold;">VG DANIŞMANLIK</p><p style="margin: 0; color: #3b82f6; font-size: 14px; font-weight: 600;">YURT DIŞI EĞİTİM</p></td></tr></table></div>`;
                const emailWrapper = (content) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><style>@media (prefers-color-scheme: dark) { .email-body { background-color: #1a1a2e !important; } .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; } .email-text { color: #e0e0e0 !important; } .email-muted { color: #a0a0b0 !important; } .info-box { background-color: #1a2744 !important; border-color: #005A9E !important; } }</style></head><body style="margin: 0; padding: 0;"><div class="email-body" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;"><div style="background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;"><h1 style="margin: 0; font-size: 24px; font-weight: 700;">VG Danışmanlık</h1><p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Yurt Dışı Eğitim Danışmanlığı</p></div><div class="email-card" style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">${content}${getEmailSignature()}</div></div></body></html>`;

                if (isPro) {
                    await mailer.sendMail({
                        from: `"VG Danışmanlık" <${emailUserEnv}>`,
                        to: email,
                        subject: `VG Danışmanlık - Görüşme Onayı (${dateFormatted})`,
                        html: emailWrapper(`
                            <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">Görüşmeniz Onaylandı</h2>
                            <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
                                Sayın <strong>${fullName}</strong>, görüşmeniz başarıyla planlanmıştır. Detaylar aşağıdadır.
                            </p>
                            <div style="background: #f0f7ff; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #005A9E;">
                                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                                    <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;">Tarih</td><td style="padding: 8px 0; font-weight: 600; color: #1a1a1a;">${dateFormatted}</td></tr>
                                    <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Saat (TR)</td><td style="padding: 8px 0; font-weight: 700; color: #005A9E; font-size: 20px;">${turkeyTime}</td></tr>
                                    <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Süre</td><td style="padding: 8px 0; color: #1a1a1a;">30 Dakika</td></tr>
                                </table>
                            </div>
                            ${zoomLink ? `<div style="text-align: center; margin: 25px 0;"><a href="${zoomLink}" style="display: inline-block; background: linear-gradient(135deg, #2D8CFF, #0B5CFF); color: white; padding: 16px 36px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 15px rgba(45,140,255,0.3);">Zoom Toplantısına Katıl</a></div>` : ''}
                            <div style="background: #f0f7ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
                                <p style="margin: 0; color: #003d6b; font-size: 14px;">
                                    <strong>Bilgilendirme:</strong> Toplantı linki görüşmeden 30 dakika önce ayrıca e-posta ile gönderilecektir. Herhangi bir değişiklik için bizimle iletişime geçebilirsiniz.
                                </p>
                            </div>
                            <div style="text-align: center; margin-top: 25px;">
                                <a href="https://wa.me/905399273008" style="display: inline-block; background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                                    WhatsApp ile İletişim
                                </a>
                            </div>
                        `)
                    });
                } else {
                    await mailer.sendMail({
                        from: `"VG Danışmanlık" <${emailUserEnv}>`,
                        to: email,
                        subject: `VG Danışmanlık - Randevu Onayı (${dateFormatted})`,
                        html: emailWrapper(`
                            <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">Randevunuz Onaylandı</h2>
                            <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
                                Merhaba <strong>${fullName}</strong>, danışmanlık görüşmeniz planlandı.
                            </p>
                            <div style="background: #f0f7ff; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #005A9E;">
                                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                                    <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;">Tarih</td><td style="padding: 8px 0; font-weight: 600; color: #1a1a1a;">${dateFormatted}</td></tr>
                                    <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Saat</td><td style="padding: 8px 0; font-weight: 600; color: #1a1a1a;">${turkeyTime} (Türkiye Saati)</td></tr>
                                    <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Süre</td><td style="padding: 8px 0; color: #1a1a1a;">30 Dakika</td></tr>
                                </table>
                            </div>
                            ${zoomLink ? `<div style="text-align: center; margin: 20px 0;"><a href="${zoomLink}" style="display: inline-block; background: linear-gradient(135deg, #2D8CFF, #0B5CFF); color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px;">Zoom Toplantısına Katıl</a></div>` : ''}
                            <p style="color: #6b7280; font-size: 14px; text-align: center;">Toplantı linki görüşmeden 30 dakika önce ayrıca e-posta ile gönderilecektir.</p>
                        `)
                    });
                }
            }
        } catch (mailErr) {
            console.error('Admin appointment confirmation mail error:', mailErr.message);
        }

        if (phone && !isPro) {
            createContact(fullName, phone, email, 'student')
                .then(uid => { if (uid) console.log('Admin appointment contact saved to iCloud:', uid); })
                .catch(err => console.error('Admin appointment iCloud contact failed:', err.message));
        }

        res.json({ success: true, message: isPro ? 'Görüşme başarıyla oluşturuldu.' : 'Randevu başarıyla oluşturuldu.', appointment: { id: appointment.id } });
    } catch (error) {
        console.error('Admin appointment create error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;