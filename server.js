require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const https = require('https');
const fs = require('fs');
const helmet = require('helmet');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const languageMiddleware = require('./middleware/language');
const userInfoMiddleware = require('./middleware/userInfo');
const htmlMinifier = require('./middleware/minify');
const nodemailer = require('nodemailer');
const pool = require('./config/database');
const multer = require('multer');
const emailService = require('./services/emailService');

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'public/uploads';
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Allow image files and documents
        if (file.mimetype.startsWith('image/') || 
            file.mimetype === 'application/pdf' ||
            file.mimetype === 'application/msword' ||
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            cb(null, true);
        } else {
            cb(new Error('Desteklenmeyen dosya türü!'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
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

// File upload middleware for university logos
const logoUpload = multer({
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
            'image/svg+xml'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Logo için sadece resim dosyaları kabul edilir!'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Import new routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const guardianRoutes = require('./routes/guardians');

// Import authentication middleware
const { authenticateAdmin } = require('./middleware/auth');

// Import SEO middleware
const seoMiddleware = require('./middleware/seo');

const app = express();
const PORT = process.env.PORT || 4000;
const HTTPS_PORT = process.env.HTTPS_PORT || 4443;

// Vercel deployment için port kontrolü
const isVercel = process.env.VERCEL === '1';

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // CSP'yi devre dışı bırak
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xFrameOptions: { action: 'deny' }
}));

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://ventureglobal.com', 'https://www.ventureglobal.com']
        : ['http://localhost:4000', 'http://127.0.0.1:4000', 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(cookieParser());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// HTML minification middleware (production only) - DISABLED for popup
// app.use(htmlMinifier);

// Favicon routes (before static files)
app.get('/favicon.png', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', 'image/png');
    res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

app.get('/favicon.ico', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', 'image/x-icon');
    res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

// Static files with optimized caching
app.use(express.static('public', {
    maxAge: '1y',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        // Set cache headers based on file type
        if (path.endsWith('.css') || path.endsWith('.js')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png') || path.endsWith('.webp')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (path.endsWith('.svg') || path.endsWith('.ico')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

// Ek static dosya yönlendirmeleri
app.use('/css', express.static('public/css', {
    maxAge: '1y',
    etag: true,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));
app.use('/js', express.static('public/js', {
    maxAge: '1y',
    etag: true,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));
app.use('/images', express.static('public/images', {
    maxAge: '1y',
    etag: true,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));
app.use('/uploads', express.static('public/uploads', {
    maxAge: '7d',
    etag: true
}));
app.use('/uploads/logos', express.static('public/uploads/logos', {
    maxAge: '7d',
    etag: true
}));

// Static dosya route'ları
app.get('/css/:file', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'css', req.params.file);
    res.sendFile(filePath);
});

app.get('/js/:file', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'js', req.params.file);
    res.sendFile(filePath);
});

app.get('/images/:file', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'images', req.params.file);
    res.sendFile(filePath);
});

app.get('/favicon.svg', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'favicon.svg');
    res.sendFile(filePath);
});

// Dil middleware'ini ekle
app.use(languageMiddleware);

// Dil değiştirme endpoint'i
app.get('/change-language/:lang', (req, res) => {
    const { lang } = req.params;
    const supportedLanguages = ['tr', 'en'];
    
    if (supportedLanguages.includes(lang)) {
        res.cookie('language', lang, { 
            maxAge: 365 * 24 * 60 * 60 * 1000, // 1 yıl
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        console.log('Language changed to:', lang);
    }
    
    // Önceki sayfaya yönlendir
    const referer = req.get('Referer') || '/';
    res.redirect(referer);
});

// User info middleware'ini ekle
app.use(userInfoMiddleware);

// SEO middleware'ini ekle
app.use(seoMiddleware);

// Force HTTPS in production (only on Vercel)
if (process.env.NODE_ENV === 'production' && process.env.VERCEL === '1') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}

// View engine setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');

// User login route
app.post('/login', async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find user in users table
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const user = result.rows[0];

        // Check password
        const bcrypt = require('bcrypt');
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate user token
        const { generateUserToken } = require('./middleware/auth');
        const token = generateUserToken(user.id);

        // Set user token cookie
        res.cookie('userToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 30 days or 1 day
        });

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                is_admin: user.is_admin
            },
            token: token
        });

    } catch (error) {
        console.error('User login error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during login'
        });
    }
});

// Admin login route (before middleware)
app.post('/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find admin in users table
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1 AND is_admin = true',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin credentials'
            });
        }

        const admin = result.rows[0];

        // Check password
        const bcrypt = require('bcrypt');
        const isValidPassword = await bcrypt.compare(password, admin.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin credentials'
            });
        }

        // Generate user token (admin is also a user)
        const { generateUserToken } = require('./middleware/auth');
        const token = generateUserToken(admin.id);

        // Set user token cookie (admin is also a user)
        res.cookie('userToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            success: true,
            message: 'Admin login successful',
            admin: {
                id: admin.id,
                first_name: admin.first_name,
                last_name: admin.last_name,
                email: admin.email,
                role: admin.role
            },
            token: token
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during admin login'
        });
    }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/admin', adminRoutes);
app.use('/user', userRoutes);

// Scheduled cleanup for unverified users older than 72h since last login
app.post('/api/maintenance/delete-unverified', async (req, res) => {
  try {
    await pool.query(`DELETE FROM users 
      WHERE email_verified = 0 
        AND last_login_at IS NOT NULL 
        AND NOW() - last_login_at > INTERVAL '72 hours'`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add missing columns to users table (idempotent)
app.post('/api/maintenance/add-user-columns', async (req, res) => {
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS school VARCHAR(200);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS class_level VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS nationality VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS desired_country VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS active_class VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_number VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_type VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS schengen_visa_count INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS uk_visa_count INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS academic_exams TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS annual_budget DECIMAL(12,2);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
    `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.use('/admin/guardians', guardianRoutes);

// Public university routes (no authentication required)
app.get('/admin/universities/edit/:id', async (req, res) => {
    try {
        const universityId = req.params.id;

        // Get university details
        console.log('Fetching university for edit with ID:', universityId);
        
        const universityResult = await pool.query(`
            SELECT 
                u.*,
                0 as actual_program_count
            FROM universities u
            WHERE u.id = $1
        `, [universityId]);
        
        console.log('University query result:', universityResult.rows);

        if (universityResult.rows.length === 0) {
            return res.status(404).render('error', {
                title: 'Üniversite Bulunamadı',
                message: 'Aradığınız üniversite bulunamadı.'
            });
        }

        const university = universityResult.rows[0];

        // Get university departments
        const departmentsResult = await pool.query(`
            SELECT id, name_tr, name_en, price, currency
            FROM university_departments 
            WHERE university_id = $1 AND is_active = true
            ORDER BY name_tr ASC
        `, [universityId]);

        res.render('admin/university-edit', {
            title: `${university.name} Düzenle - Venture Global`,
            university: university,
            departments: departmentsResult.rows || []
        });
    } catch (error) {
        console.error('University edit error:', error);
        res.status(500).render('error', {
            title: 'Sunucu Hatası',
            message: 'Üniversite bilgileri yüklenirken bir hata oluştu.'
        });
    }
});

app.get('/c/:id', async (req, res) => {
    try {
        const universityId = req.params.id;

        // Get university details
        console.log('Fetching university with ID:', universityId);
        
        const universityResult = await pool.query(`
            SELECT 
                u.*,
                0 as actual_program_count
            FROM universities u
            WHERE u.id = $1
        `, [universityId]);
        
        console.log('University query result:', universityResult.rows);

        if (universityResult.rows.length === 0) {
            return res.status(404).render('error', {
                title: 'Üniversite Bulunamadı',
                message: 'Aradığınız üniversite bulunamadı.'
            });
        }

        const university = universityResult.rows[0];

        // Get university departments
        const departmentsResult = await pool.query(`
            SELECT id, name_tr, name_en, price, currency
            FROM university_departments 
            WHERE university_id = $1 AND is_active = true
            ORDER BY name_tr ASC
        `, [universityId]);

        // Get university programs (empty for now)
        const programsResult = { rows: [] };

        // Get university images (empty for now)
        const imagesResult = { rows: [] };

        // Set SEO metadata for university detail page
        res.locals.seoTitle = `${university.name} - ${university.country} | Venture Global`;
        res.locals.seoDescription = `${university.name} (${university.city}, ${university.country}) hakkında bilgiler, bölümler, programlar ve başvuru süreci. ${university.country} üniversite başvurunuzda profesyonel destek alın. Yurt dışı danışmanlık, yurt dışı eğitim danışmanlığı ve Avrupa eğitim danışmanlığı hizmetlerimiz.`;
        res.locals.seoKeywords = `${university.name.toLowerCase()}, ${university.country.toLowerCase()} üniversite, ${university.city.toLowerCase()} üniversite, ${university.country.toLowerCase()} eğitim, ${university.country.toLowerCase()} başvuru, yurt dışı danışmanlık, yurt dışı eğitim danışmanlığı`;
        res.locals.schemaType = 'CollegeOrUniversity';
        res.locals.ogType = 'article';
        if (university.logo_url) {
            res.locals.ogImage = res.locals.baseUrl + university.logo_url;
        }

        res.render('university-detail', {
            title: `${university.name} - Venture Global`,
            university: university,
            departments: departmentsResult.rows || [],
            programs: programsResult.rows || [],
            images: imagesResult.rows || []
        });
    } catch (error) {
        console.error('University detail error:', error);
        res.status(500).render('error', {
            title: 'Sunucu Hatası',
            message: 'Üniversite bilgileri yüklenirken bir hata oluştu.'
        });
    }
});

app.post('/universities/create', async (req, res) => {
    try {
        console.log('📝 Create University Request - Headers:', req.headers);
        console.log('📝 Create University Request - Body:', req.body);

        const {
            name,
            country,
            city,
            logo_url,
            world_ranking,
            description,
            requirements,
            departments
        } = req.body;

        if (!name || !country || !city) {
            return res.status(400).json({ 
                success: false, 
                message: 'Üniversite adı, ülke ve şehir alanları zorunludur.' 
            });
        }

        // Insert university
        const universityResult = await pool.query(`
            INSERT INTO universities (name, country, city, logo_url, world_ranking, description, requirements, is_active, is_featured, is_partner)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `, [name, country, city, logo_url, world_ranking, description, requirements, true, false, true]);

        const universityId = universityResult.rows[0].id;

        // Insert departments if provided
        if (departments && Array.isArray(departments)) {
            for (const dept of departments) {
                if (dept.name_tr && dept.price) {
                    await pool.query(`
                        INSERT INTO university_departments (university_id, name_tr, name_en, price, currency, is_active)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [universityId, dept.name_tr, dept.name_tr, dept.price, 'EUR', true]);
                }
            }
        }

        res.json({ 
            success: true, 
            message: 'Üniversite başarıyla eklendi!',
            universityId: universityId
        });
    } catch (error) {
        console.error('University creation error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Üniversite eklenirken hata oluştu: ' + error.message 
        });
    }
});

// Logout route
app.post('/logout', (req, res) => {
    // Clear both user and admin tokens with proper options
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
    
    console.log('Logout endpoint called - cookies cleared'); // Debug log
    
    res.json({
        success: true,
        message: 'Logout successful'
    });
});

// Dil değiştirme route'u
app.post('/change-language', (req, res) => {
    const { language } = req.body;
    
    // Desteklenen diller
    const supportedLanguages = ['tr', 'en'];
    
    if (supportedLanguages.includes(language)) {
        // Cookie'yi set et
        res.cookie('language', language, { 
            maxAge: 365 * 24 * 60 * 60 * 1000, // 1 yıl
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        
        console.log('Language changed to:', language); // Debug log
        
        res.json({ success: true, language });
    } else {
        res.status(400).json({ success: false, message: 'Invalid language' });
    }
});

// SEO Routes - robots.txt and sitemap.xml
app.get('/robots.txt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

app.get('/sitemap.xml', async (req, res) => {
    try {
        const baseUrl = res.locals.baseUrl || 'https://vgdanismanlik.com';
        
        // Get all universities from database
        let universities = [];
        try {
            const universitiesResult = await pool.query(`
                SELECT id, name, updated_at
                FROM universities 
                WHERE is_active = true
                ORDER BY updated_at DESC
            `);
            universities = universitiesResult.rows;
        } catch (dbError) {
            console.error('Database error fetching universities for sitemap:', dbError);
        }
        
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
    <!-- Homepage -->
    <url>
        <loc>${baseUrl}/</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
        <xhtml:link rel="alternate" hreflang="tr" href="${baseUrl}/change-language/tr"/>
        <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/change-language/en"/>
    </url>
    
    <!-- Services -->
    <url>
        <loc>${baseUrl}/services</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.9</priority>
        <xhtml:link rel="alternate" hreflang="tr" href="${baseUrl}/change-language/tr"/>
        <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/change-language/en"/>
    </url>
    
    <!-- About Us -->
    <url>
        <loc>${baseUrl}/about-us</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
        <xhtml:link rel="alternate" hreflang="tr" href="${baseUrl}/change-language/tr"/>
        <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/change-language/en"/>
    </url>
    
    <!-- Media -->
    <url>
        <loc>${baseUrl}/media</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
        <xhtml:link rel="alternate" hreflang="tr" href="${baseUrl}/change-language/tr"/>
        <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/change-language/en"/>
    </url>
    
    <!-- Universities -->
    <url>
        <loc>${baseUrl}/universities</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
        <xhtml:link rel="alternate" hreflang="tr" href="${baseUrl}/change-language/tr"/>
        <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/change-language/en"/>
    </url>
    
    <!-- Contact -->
    <url>
        <loc>${baseUrl}/contact</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
        <xhtml:link rel="alternate" hreflang="tr" href="${baseUrl}/change-language/tr"/>
        <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/change-language/en"/>
    </url>
    
    <!-- Student Life Pages -->
    <url>
        <loc>${baseUrl}/student-life/germany</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${baseUrl}/student-life/czech</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${baseUrl}/student-life/italy</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${baseUrl}/student-life/austria</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${baseUrl}/student-life/uk</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${baseUrl}/student-life/poland</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${baseUrl}/student-life/hungary</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>
    
    <!-- Partners -->
    <url>
        <loc>${baseUrl}/partners/wcep</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>${baseUrl}/partners/medczech</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>${baseUrl}/partners/bestschool</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>${baseUrl}/partners/kanpus</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>
    
    <!-- University Detail Pages -->
    ${universities.map(uni => {
        const lastmod = uni.updated_at 
            ? new Date(uni.updated_at).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
        return `    <url>
        <loc>${baseUrl}/university/${uni.id}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>`;
    }).join('\n')}
</urlset>`;
        
        res.setHeader('Content-Type', 'application/xml');
        res.send(sitemap);
    } catch (error) {
        console.error('Sitemap generation error:', error);
        res.status(500).send('Error generating sitemap');
    }
});

// Temel route'lar
app.get('/', async (req, res) => {
    try {
        // Set SEO metadata with competitive keywords
        res.locals.seoTitle = 'Venture Global | Yurt Dışı Danışmanlık - Yurt Dışı Eğitim Danışmanlığı | Avrupa Eğitim Danışmanlığı';
        res.locals.seoDescription = 'Venture Global: Yurt dışı danışmanlık, yurt dışı eğitim danışmanlığı, yurt dışı dil okulu danışmanlığı ve Avrupa eğitim danışmanlığı hizmetleri. Almanya, Çekya, İtalya, Avusturya, İngiltere, Polonya ve Macaristan\'da üniversite başvuru süreçlerinizde profesyonel danışmanlık. 50+ üniversite seçeneği ile hayallerinizi gerçeğe dönüştürün.';
        res.locals.seoKeywords = 'Venture Global, yurt dışı danışmanlık, yurt dışı eğitim danışmanlığı, yurt dışı dil okulu danışmanlığı, Avrupa eğitim danışmanlığı, üniversite danışmanlığı, yurtdışı üniversite başvurusu, Avrupa üniversite danışmanlığı, yurtdışı eğitim danışmanlığı, eğitim danışmanlığı, üniversite başvuru danışmanlığı, vize danışmanlığı, almanya üniversite, çekya üniversite, italya üniversite, avusturya üniversite, ingiltere üniversite, polonya üniversite, macaristan üniversite';
        res.locals.ogTitle = 'Venture Global - Yurt Dışı Danışmanlık ve Eğitim Danışmanlığı';
        res.locals.ogDescription = 'Yurt dışı danışmanlık, yurt dışı eğitim danışmanlığı, yurt dışı dil okulu danışmanlığı ve Avrupa eğitim danışmanlığı hizmetleri. Profesyonel üniversite başvuru danışmanlığı.';
        res.locals.ogType = 'website';
        
        res.render('index', {
            title: res.locals.t.nav.home
        });
    } catch (error) {
        console.error('Homepage error:', error);
        res.render('index', {
            title: res.locals.t.nav.home
        });
    }
});
app.get('/services', (req, res) => {
    res.locals.seoTitle = 'Hizmetlerimiz - Yurt Dışı Danışmanlık ve Eğitim Danışmanlığı | Venture Global (VG Danışmanlık)';
    res.locals.seoDescription = 'Venture Global (VG Danışmanlık) yurt dışı danışmanlık hizmetleri: Üniversite başvuru danışmanlığı, yurt dışı eğitim danışmanlığı, yurt dışı dil okulu danışmanlığı, vize işlemleri, konaklama desteği ve Avrupa eğitim danışmanlığı. Profesyonel eğitim danışmanlığı hizmetlerimiz hakkında bilgi alın.';
    res.locals.seoKeywords = 'venture global, vg danışmanlık, yurt dışı danışmanlık, yurt dışı eğitim danışmanlığı, yurt dışı dil okulu danışmanlığı, Avrupa eğitim danışmanlığı, üniversite başvuru danışmanlığı, vize işlemleri, dil okulu, konaklama, eğitim danışmanlığı hizmetleri, yurtdışı eğitim danışmanlığı, üniversite danışmanlığı';
    res.locals.ogTitle = 'Yurt Dışı Danışmanlık Hizmetleri - Venture Global (VG Danışmanlık)';
    res.locals.ogDescription = 'Venture Global (VG Danışmanlık) yurt dışı danışmanlık, yurt dışı eğitim danışmanlığı ve yurt dışı dil okulu danışmanlığı hizmetlerimiz. Profesyonel Avrupa eğitim danışmanlığı.';
    res.render('services', { title: res.locals.t.nav.services });
});

app.get('/about-us', (req, res) => {
    res.locals.seoTitle = 'Venture Global (VG Danışmanlık) Hakkında - Yurt Dışı Eğitim Danışmanlığı | Profesyonel Eğitim Danışmanlığı';
    res.locals.seoDescription = 'Venture Global (VG Danışmanlık) yurt dışı eğitim danışmanlığı firması. Yurt dışı danışmanlık, yurt dışı eğitim danışmanlığı, yurt dışı dil okulu danışmanlığı ve Avrupa eğitim danışmanlığı alanında 7 ülkede, 50+ üniversite seçeneği ile profesyonel danışmanlık hizmeti sunuyoruz.';
    res.locals.seoKeywords = 'Venture Global, vg danışmanlık, venture global danışmanlık, yurt dışı danışmanlık, yurt dışı eğitim danışmanlığı, yurt dışı dil okulu danışmanlığı, Avrupa eğitim danışmanlığı, eğitim danışmanlığı, yurtdışı eğitim, avrupa üniversite, eğitim danışmanlığı firması, venture global eğitim';
    res.locals.ogTitle = 'Venture Global (VG Danışmanlık) - Yurt Dışı Eğitim Danışmanlığı';
    res.locals.ogDescription = 'Venture Global (VG Danışmanlık) yurt dışı danışmanlık ve eğitim danışmanlığı firması. 7 ülkede profesyonel hizmet.';
    res.render('about-us', { title: res.locals.t.nav.aboutUs });
});

app.get('/media', (req, res) => {
    res.locals.seoTitle = 'Medyada Biz - Venture Global (VG Danışmanlık) | Instagram & LinkedIn';
    res.locals.seoDescription = 'Venture Global (VG Danışmanlık) sosyal medya paylaşımları. Instagram reels ve LinkedIn postlarımızı takip edin. Öğrenci hikayeleri, başarı hikayeleri ve daha fazlası.';
    res.locals.seoKeywords = 'Venture Global instagram, vg danışmanlık linkedin, venture global medya, yurt dışı eğitim instagram, öğrenci hikayeleri, başarı hikayeleri';
    res.locals.ogTitle = 'Medyada Biz - Venture Global | Sosyal Medya';
    res.locals.ogDescription = 'Instagram ve LinkedIn\'de paylaşımlarımızı takip edin.';
    res.render('media', { title: res.locals.t.nav.media || 'Medyada Biz' });
});

app.get('/partners/wcep', (req, res) => {
    res.render('partners/wcep', { title: 'WCEP - Venture Global' });
});

app.get('/partners/medczech', (req, res) => {
    res.render('partners/medczech', { title: 'MedCzech - Venture Global' });
});

app.get('/partners/bestschool', (req, res) => {
    res.render('partners/bestschool', { title: 'BestSchool.cz - Venture Global' });
});

app.get('/partners/kanpus', (req, res) => {
    res.render('partners/kanpus', { title: 'Kanpus - Venture Global' });
});


// Universities page route - Optimized
app.get('/universities', async (req, res) => {
    try {
        // Set SEO metadata with competitive keywords
        res.locals.seoTitle = 'Üniversiteler - Yurt Dışı Üniversite Başvurusu | Venture Global Eğitim Danışmanlığı';
        res.locals.seoDescription = 'Almanya, Çekya, İtalya, Avusturya, İngiltere, Polonya ve Macaristan\'daki prestijli üniversiteleri keşfedin. Yurt dışı danışmanlık, yurt dışı eğitim danışmanlığı ve Avrupa eğitim danışmanlığı hizmetlerimiz ile 50+ üniversite seçeneği. Size en uygun eğitim fırsatını bulun.';
        res.locals.seoKeywords = 'yurt dışı danışmanlık, yurt dışı eğitim danışmanlığı, Avrupa eğitim danışmanlığı, avrupa üniversiteleri, almanya üniversiteleri, çekya üniversiteleri, italya üniversiteleri, avusturya üniversiteleri, ingiltere üniversiteleri, polonya üniversiteleri, macaristan üniversiteleri, yurtdışı üniversite başvurusu';
        
        // Get all universities from database with optimized query
        const universitiesResult = await pool.query(`
            SELECT 
                u.id,
                u.name,
                u.name_en,
                u.country,
                u.city,
                u.logo_url,
                u.world_ranking,
                u.is_featured,
                u.created_at,
                COUNT(ud.id) as department_count
            FROM universities u
            LEFT JOIN university_departments ud ON u.id = ud.university_id AND ud.is_active = true
            WHERE u.is_active = true
            GROUP BY u.id, u.name, u.name_en, u.country, u.city, u.logo_url, u.world_ranking, u.is_featured, u.created_at
            ORDER BY u.is_featured DESC, u.name ASC
            LIMIT 50
        `);

        res.render('universities', {
            title: 'Üniversiteler - Venture Global',
            universities: universitiesResult.rows || []
        });
    } catch (error) {
        console.error('Universities page error:', error);
        // Fallback to empty array if database error
        res.render('universities', {
            title: 'Üniversiteler - Venture Global',
            universities: []
        });
    }
});

// University detail page route - Supports both numeric ID and slug (name-based lookup)
app.get('/university/:id', async (req, res) => {
    try {
        const universityParam = req.params.id;
        let universityResult;

        // Check if the parameter is a numeric ID or a slug
        const isNumericId = /^\d+$/.test(universityParam);
        
        console.log('Fetching university with param:', universityParam, 'isNumeric:', isNumericId);
        
        if (isNumericId) {
            // Query by numeric ID
            universityResult = await pool.query(`
                SELECT 
                    u.*,
                    0 as actual_program_count
                FROM universities u
                WHERE u.id = $1
            `, [universityParam]);
        } else {
            // Query by slug - search in name (case-insensitive, partial match)
            const slugMap = {
                'semmelweis': 'Semmelweis',
                'ctu': 'Czech Technical',
                'vse': 'VSE',
                'tum': 'Technical University of Munich',
                'univie': 'Vienna',
                'polimi': 'Politecnico di Milano',
                'charles': 'Charles University',
                'masaryk': 'Masaryk',
                'palacky': 'Palacky'
            };
            
            const searchTerm = slugMap[universityParam.toLowerCase()] || universityParam;
            
            universityResult = await pool.query(`
                SELECT 
                    u.*,
                    0 as actual_program_count
                FROM universities u
                WHERE LOWER(u.name) LIKE LOWER($1)
                LIMIT 1
            `, [`%${searchTerm}%`]);
        }
        
        console.log('University query result:', universityResult.rows);

        if (universityResult.rows.length === 0) {
            return res.status(404).render('error', {
                title: 'Üniversite Bulunamadı',
                message: 'Aradığınız üniversite bulunamadı.'
            });
        }

        const university = universityResult.rows[0];

        // Get university departments (use university.id from the found university)
        const departmentsResult = await pool.query(`
            SELECT id, name_tr, name_en, price, currency
            FROM university_departments 
            WHERE university_id = $1 AND is_active = true
            ORDER BY name_tr ASC
        `, [university.id]);

        // Get university programs (empty for now)
        const programsResult = { rows: [] };

        // Get university images (empty for now)
        const imagesResult = { rows: [] };

        // Set SEO metadata for university detail page
        res.locals.seoTitle = `${university.name} - ${university.country} | Venture Global`;
        res.locals.seoDescription = `${university.name} (${university.city}, ${university.country}) hakkında bilgiler, bölümler, programlar ve başvuru süreci. ${university.country} üniversite başvurunuzda profesyonel destek alın. Yurt dışı danışmanlık, yurt dışı eğitim danışmanlığı ve Avrupa eğitim danışmanlığı hizmetlerimiz.`;
        res.locals.seoKeywords = `${university.name.toLowerCase()}, ${university.country.toLowerCase()} üniversite, ${university.city.toLowerCase()} üniversite, ${university.country.toLowerCase()} eğitim, ${university.country.toLowerCase()} başvuru, yurt dışı danışmanlık, yurt dışı eğitim danışmanlığı`;
        res.locals.schemaType = 'CollegeOrUniversity';
        res.locals.ogType = 'article';
        if (university.logo_url) {
            res.locals.ogImage = res.locals.baseUrl + university.logo_url;
        }

        res.render('university-detail', {
            title: `${university.name} - Venture Global`,
            university: university,
            departments: departmentsResult.rows || [],
            programs: programsResult.rows || [],
            images: imagesResult.rows || []
        });
    } catch (error) {
        console.error('University detail error:', error);
        res.status(500).render('error', {
            title: 'Sunucu Hatası',
            message: 'Üniversite bilgileri yüklenirken bir hata oluştu.'
        });
    }
});

// Programs page route - Yeni tasarım
app.get('/programs', async (req, res) => {
    try {
        // Get all programs with university information
        const programsResult = await pool.query(`
            SELECT 
                up.id,
                up.name,
                up.name_en,
                up.level,
                up.field_of_study,
                up.duration_months,
                up.tuition_fee,
                up.currency,
                up.language,
                up.requirements,
                up.description,
                u.id AS university_id,
                u.name AS university_name,
                u.country AS university_country,
                u.city AS university_city,
                u.logo_url AS university_logo_url,
                u.world_ranking
            FROM university_programs up
            JOIN universities u ON u.id = up.university_id
            WHERE up.is_active = true
            ORDER BY u.world_ranking ASC, up.level ASC, up.name ASC
        `);

        res.render('programs', {
            title: 'Programlar - Venture Global',
            programs: programsResult.rows || [],
            layout: false
        });
    } catch (error) {
        console.error('Programs page error:', error);
        res.render('programs', {
            title: 'Programlar - Venture Global',
            programs: [],
            layout: false
        });
    }
});


// Authentication pages
app.get('/login', (req, res) => {
    res.render('login', { title: res.locals.t.auth.login.title });
});

app.get('/register', (req, res) => {
    res.render('register', { title: res.locals.t.auth.register.title });
});

app.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { title: res.locals.t.auth.forgotPassword.title });
});

// User dashboard route
app.get('/user/dashboard', async (req, res) => {
    try {
        // Check if user is logged in
        if (!res.locals.isLoggedIn || res.locals.isAdmin) {
            return res.redirect('/login');
        }

        // Get user data
        const result = await pool.query(
            'SELECT * FROM users WHERE id = $1',
            [res.locals.currentUser.id]
        );

        if (result.rows.length === 0) {
            return res.redirect('/login');
        }

        const user = result.rows[0];

        res.render('user/dashboard', { 
            title: 'User Dashboard',
            user: user,
            currentLanguage: res.locals.currentLanguage || 'tr',
            isLoggedIn: res.locals.isLoggedIn,
            currentUser: res.locals.currentUser,
            t: res.locals.t
        });
    } catch (error) {
        console.error('User dashboard error:', error);
        res.redirect('/login');
    }
});

// User applications route - handled by user routes

// Admin routes
app.get('/admin/dashboard', async (req, res) => {
    try {
        // Check if user is logged in and is admin
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            return res.redirect('/login');
        }

        console.log('Admin dashboard route accessed');
        console.log('isLoggedIn:', res.locals.isLoggedIn);
        console.log('isAdmin:', res.locals.isAdmin);

        // Get all users
        const usersResult = await pool.query(
            'SELECT id, first_name, last_name, email, phone, english_level, created_at, is_admin FROM users ORDER BY created_at DESC'
        );

        // Get all applications
        const applicationsResult = await pool.query(`
            SELECT a.*, u.first_name, u.last_name, u.email 
            FROM applications a 
            JOIN users u ON a.user_id = u.id 
            ORDER BY a.created_at DESC
        `);

        // Calculate statistics
        const totalUsers = usersResult.rows.length;
        const totalApplications = applicationsResult.rows.length;
        
        // Count applications by status
        const pendingApplications = applicationsResult.rows.filter(app => app.status === 'pending').length;
        const approvedApplications = applicationsResult.rows.filter(app => app.status === 'approved').length;
        const rejectedApplications = applicationsResult.rows.filter(app => app.status === 'rejected').length;

        // Calculate trends (this month vs last month)
        const now = new Date();
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        
        const thisMonthUsers = usersResult.rows.filter(user => new Date(user.created_at) >= thisMonth).length;
        const lastMonthUsers = usersResult.rows.filter(user => {
            const userDate = new Date(user.created_at);
            return userDate >= lastMonth && userDate < thisMonth;
        }).length;
        
        const thisMonthApplications = applicationsResult.rows.filter(app => new Date(app.created_at) >= thisMonth).length;
        const lastMonthApplications = applicationsResult.rows.filter(app => {
            const appDate = new Date(app.created_at);
            return appDate >= lastMonth && appDate < thisMonth;
        }).length;

        // Calculate percentage changes
        const userGrowthPercent = lastMonthUsers > 0 ? Math.round(((thisMonthUsers - lastMonthUsers) / lastMonthUsers) * 100) : 0;
        const applicationGrowthPercent = lastMonthApplications > 0 ? Math.round(((thisMonthApplications - lastMonthApplications) / lastMonthApplications) * 100) : 0;

        console.log('User is admin, fetching data...');
        console.log('Users fetched:', usersResult.rows.length);
        console.log('Applications fetched:', applicationsResult.rows.length);

        res.render('admin/dashboard', {
            title: 'Admin Panel',
            users: usersResult.rows,
            applications: applicationsResult.rows,
            stats: {
                totalUsers,
                totalApplications,
                pendingApplications,
                approvedApplications,
                rejectedApplications,
                userGrowthPercent,
                applicationGrowthPercent
            }
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/admin/users', async (req, res) => {
    try {
        // Check if user is logged in and is admin
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            return res.redirect('/login');
        }

        const usersResult = await pool.query(
            'SELECT id, first_name, last_name, email, phone, english_level, created_at, is_admin FROM users ORDER BY created_at DESC'
        );

        res.render('admin/users', {
            title: 'Öğrenciler - Admin Panel',
            users: usersResult.rows
        });
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Student details page
app.get('/admin/users/:id/details', async (req, res) => {
    try {
        // Check if user is logged in and is admin
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            return res.redirect('/login');
        }

        const { id } = req.params;
        
        const userResult = await pool.query(
            `SELECT id, first_name, last_name, email, phone, english_level, birth_date, 
                    school, class_level, country, city, address, nationality, tc_number,
                    passport_number, passport_type, schengen_visa_count, uk_visa_count,
                    academic_exams, annual_budget, created_at, is_admin
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

        res.render('admin/student-details', {
            title: `${user.first_name} ${user.last_name} - Öğrenci Detayları`,
            user: user,
            currentLanguage: res.locals.currentLanguage || 'tr',
            isLoggedIn: res.locals.isLoggedIn,
            currentUser: res.locals.currentUser,
            t: res.locals.t
        });
    } catch (error) {
        console.error('Student details error:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).render('error', { 
            title: 'Hata',
            message: `Öğrenci detayları yüklenirken bir hata oluştu: ${error.message}` 
        });
    }
});

app.get('/admin/applications', async (req, res) => {
    try {
        // Check if user is logged in and is admin
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            return res.redirect('/login');
        }

        const applicationsResult = await pool.query(`
            SELECT a.*, u.first_name, u.last_name, u.email 
            FROM applications a 
            JOIN users u ON a.user_id = u.id 
            ORDER BY a.created_at DESC
        `);

        // Get all users for modal with their application status
        const usersResult = await pool.query(`
            SELECT 
                u.id, u.first_name, u.last_name, u.email, u.phone, u.created_at, u.is_admin,
                a.status as application_status,
                a.id as application_id
            FROM users u
            LEFT JOIN applications a ON u.id = a.user_id
            ORDER BY u.first_name, u.last_name
        `);

        res.render('admin/applications', {
            title: 'Başvurular - Admin Panel',
            applications: applicationsResult.rows,
            users: usersResult.rows
        });
    } catch (error) {
        console.error('Admin applications error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/admin/applications/new', async (req, res) => {
    try {
        // Check if user is logged in and is admin
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            return res.redirect('/login');
        }

        // Get all users for selection
        const usersResult = await pool.query(
            'SELECT id, first_name, last_name, email, phone, english_level, created_at FROM users ORDER BY first_name, last_name'
        );

        res.render('admin/new-application', {
            title: 'Yeni Başvuru - Admin Panel',
            users: usersResult.rows
        });
    } catch (error) {
        console.error('Admin new application error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/admin/applications/:id/edit', async (req, res) => {
    try {
        // Check if user is logged in and is admin
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            return res.redirect('/login');
        }

        const { id } = req.params;
        
        // Get application details
        const applicationResult = await pool.query(`
            SELECT a.*, u.first_name, u.last_name, u.email 
            FROM applications a 
            JOIN users u ON a.user_id = u.id 
            WHERE a.id = $1
        `, [id]);
        
        if (applicationResult.rows.length === 0) {
            return res.status(404).render('error', {
                title: 'Başvuru Bulunamadı',
                message: 'Aradığınız başvuru bulunamadı.'
            });
        }

        res.render('admin/edit-application', {
            title: 'Başvuru Düzenle - Admin Panel',
            application: applicationResult.rows[0]
        });
    } catch (error) {
        console.error('Admin edit application error:', error);
        res.status(500).render('error', {
            title: 'Sunucu Hatası',
            message: 'Başvuru düzenleme sayfası yüklenirken bir hata oluştu.'
        });
    }
});

// Universities route
app.get('/admin/universities', async (req, res) => {
    try {
        console.log('Admin universities route accessed');
        console.log('res.locals.isLoggedIn:', res.locals.isLoggedIn);
        console.log('res.locals.isAdmin:', res.locals.isAdmin);
        
        // Check if user is logged in and is admin
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            console.log('User not logged in or not admin, redirecting to login');
            return res.redirect('/login');
        }

        console.log('User authenticated, querying database...');
        
        // Get all universities from database
        const universitiesResult = await pool.query(`
            SELECT 
                u.id,
                u.name,
                u.name_en,
                u.country,
                u.city,
                u.logo_url,
                u.website_url,
                u.tuition_fee,
                u.application_fee,
                u.world_ranking,
                u.is_active,
                u.is_featured,
                u.created_at,
                COUNT(up.id) as actual_program_count
            FROM universities u
            LEFT JOIN university_programs up ON u.id = up.university_id AND up.is_active = true
            GROUP BY u.id, u.name, u.name_en, u.country, u.city, u.logo_url, u.website_url, u.tuition_fee, u.application_fee, u.world_ranking, u.is_active, u.is_featured, u.created_at
            ORDER BY u.is_featured DESC, u.name ASC
        `);

        console.log('Database query successful, universities count:', universitiesResult.rows.length);
        console.log('First university:', universitiesResult.rows[0]);

        // Get sidebar counts for admin layout
        const [usersResult, applicationsResult] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM users'),
            pool.query('SELECT COUNT(*) as count FROM applications')
        ]);
        
        const sidebarCounts = {
            userCount: parseInt(usersResult.rows[0].count),
            applicationCount: parseInt(applicationsResult.rows[0].count),
            universityCount: universitiesResult.rows.length
        };

        res.render('admin/universities', {
            title: 'Üniversiteler - Admin Panel',
            activePage: 'universities',
            universities: universitiesResult.rows,
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Admin universities error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// New university route
app.get('/admin/universities/new', async (req, res) => {
    try {
        // Check if user is logged in and is admin
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            return res.redirect('/login');
        }

        // Get sidebar counts for admin layout
        const [usersResult, applicationsResult, universitiesResult] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM users'),
            pool.query('SELECT COUNT(*) as count FROM applications'),
            pool.query('SELECT COUNT(*) as count FROM universities WHERE is_active = true')
        ]);
        
        const sidebarCounts = {
            userCount: parseInt(usersResult.rows[0].count),
            applicationCount: parseInt(applicationsResult.rows[0].count),
            universityCount: parseInt(universitiesResult.rows[0].count)
        };

        res.render('admin/university-add', {
            title: 'Yeni Üniversite Ekle - Admin Panel',
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Admin new university error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});




// Admin: Program detail page -> redirect to edit (no separate detail view needed)
app.get('/admin/programs/:id', async (req, res) => {
    try {
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            return res.redirect('/login');
        }
        const programId = req.params.id;
        return res.redirect(`/admin/programs/${programId}/edit`);
    } catch (error) {
        console.error('Program detail redirect error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// API endpoint to add new program
app.post('/api/admin/programs', async (req, res) => {
    try {
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const {
            university_id, name, name_en, level, field_of_study, duration_months,
            tuition_fee, language, description, is_active
        } = req.body;

        // Validate required fields
        if (!university_id || !name || !level || !field_of_study || !duration_months || !language) {
            return res.status(400).json({
                success: false,
                message: 'Gerekli alanlar eksik',
                received: { university_id, name, level, field_of_study, duration_months, language }
            });
        }

        // Insert new program
        const result = await pool.query(`
            INSERT INTO university_programs (
                university_id, name, name_en, level, field_of_study, duration_months,
                tuition_fee, language, description, is_active, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
            RETURNING id
        `, [
            university_id, name, name_en || null, level, field_of_study, duration_months,
            tuition_fee || null, language, description || null, is_active === 'true'
        ]);

        // Update university program count
        await pool.query(`
            UPDATE universities 
            SET program_count = (
                SELECT COUNT(*) FROM university_programs 
                WHERE university_id = $1 AND is_active = true
            )
            WHERE id = $1
        `, [university_id]);

        res.json({ success: true, message: 'Program başarıyla eklendi', program_id: result.rows[0].id });
    } catch (error) {
        console.error('Program add API error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// API endpoint to delete program
app.delete('/api/admin/programs/:id', async (req, res) => {
    try {
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const programId = req.params.id;

        // Get university ID before deleting
        const programResult = await pool.query(
            'SELECT university_id FROM university_programs WHERE id = $1',
            [programId]
        );

        if (programResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Program bulunamadı' });
        }

        const universityId = programResult.rows[0].university_id;

        // Delete program
        await pool.query('DELETE FROM university_programs WHERE id = $1', [programId]);

        // Update university program count
        await pool.query(`
            UPDATE universities 
            SET program_count = (
                SELECT COUNT(*) FROM university_programs 
                WHERE university_id = $1 AND is_active = true
            )
            WHERE id = $1
        `, [universityId]);

        res.json({ success: true, message: 'Program başarıyla silindi' });
    } catch (error) {
        console.error('Program delete API error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Admin: Program edit page
app.get('/admin/programs/:id/edit', async (req, res) => {
    try {
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            return res.redirect('/login');
        }

        const programId = req.params.id;
        const programResult = await pool.query(`
            SELECT 
                up.id,
                up.university_id,
                up.name,
                up.name_en,
                up.level,
                up.field_of_study,
                up.duration_months,
                up.tuition_fee,
                up.currency,
                up.language,
                up.is_active,
                up.created_at,
                up.updated_at,
                u.name AS university_name
            FROM university_programs up
            JOIN universities u ON u.id = up.university_id
            WHERE up.id = $1
        `, [programId]);

        if (programResult.rows.length === 0) {
            return res.status(404).render('error', { title: 'Program Bulunamadı', message: 'Aradığınız program bulunamadı.' });
        }

        const program = programResult.rows[0];

        // Get sidebar counts for admin layout
        const [usersResult, applicationsResult, universitiesResult] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM users'),
            pool.query('SELECT COUNT(*) as count FROM applications'),
            pool.query('SELECT COUNT(*) as count FROM universities WHERE is_active = true')
        ]);
        
        const sidebarCounts = {
            userCount: parseInt(usersResult.rows[0].count),
            applicationCount: parseInt(applicationsResult.rows[0].count),
            universityCount: parseInt(universitiesResult.rows[0].count)
        };

        res.render('admin/program-edit', {
            title: `${program.name} - Program Düzenle - Admin Panel`,
            program,
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Program edit page error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Admin: Program update
app.put('/api/admin/programs/:id', async (req, res) => {
    try {

        
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const programId = req.params.id;

        const {
            university_id,
            name,
            name_en,
            level,
            field_of_study,
            duration_months,
            tuition_fee,
            currency,
            language,
            is_active
        } = req.body;

        if (!name || !level || !field_of_study || !duration_months || !language) {
            return res.status(400).json({
                success: false,
                message: 'Gerekli alanlar eksik',
                received: { name, level, field_of_study, duration_months, language }
            });
        }

        const updateResult = await pool.query(`
            UPDATE university_programs SET
                name = $1,
                name_en = $2,
                level = $3,
                field_of_study = $4,
                duration_months = $5,
                tuition_fee = $6,
                currency = $7,
                language = $8,
                is_active = $9,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $10
            RETURNING *
        `, [
            name,
            name_en || null,
            level,
            field_of_study,
            Number(duration_months),
            tuition_fee === '' || typeof tuition_fee === 'undefined' ? null : Number(tuition_fee),
            (currency && currency.trim()) || 'EUR',
            language,
            is_active === 'true' || is_active === true,
            programId
        ]);

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Program bulunamadı' });
        }

        const updatedProgram = updateResult.rows[0];



        res.json({ success: true, message: 'Program başarıyla güncellendi', program: updatedProgram });
    } catch (error) {
        console.error('Program update error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// University edit route
app.get('/admin/universities/:id/edit', async (req, res) => {
    try {
        // Check if user is logged in and is admin
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            return res.redirect('/login');
        }

        const universityId = req.params.id;

        // Get university details
        const universityResult = await pool.query(`
            SELECT * FROM universities WHERE id = $1
        `, [universityId]);

        if (universityResult.rows.length === 0) {
            return res.status(404).render('error', {
                title: 'Üniversite Bulunamadı',
                message: 'Aradığınız üniversite bulunamadı.'
            });
        }

        const university = universityResult.rows[0];

        // Get sidebar counts for admin layout
        const [usersResult, applicationsResult, universitiesResult] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM users'),
            pool.query('SELECT COUNT(*) as count FROM applications'),
            pool.query('SELECT COUNT(*) as count FROM universities WHERE is_active = true')
        ]);
        
        const sidebarCounts = {
            userCount: parseInt(usersResult.rows[0].count),
            applicationCount: parseInt(applicationsResult.rows[0].count),
            universityCount: parseInt(universitiesResult.rows[0].count)
        };

        res.render('admin/university-edit', {
            title: `${university.name} - Düzenle - Admin Panel`,
            university: university,
            ...sidebarCounts
        });
    } catch (error) {
        console.error('University edit error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});



// University program add route
app.get('/admin/universities/:id/programs/new', async (req, res) => {
    try {
        // Check if user is logged in and is admin
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            return res.redirect('/login');
        }

        const universityId = req.params.id;

        // Get university details
        const universityResult = await pool.query(`
            SELECT * FROM universities WHERE id = $1
        `, [universityId]);

        if (universityResult.rows.length === 0) {
            return res.status(404).render('error', {
                title: 'Üniversite Bulunamadı',
                message: 'Aradığınız üniversite bulunamadı.'
            });
        }

        const university = universityResult.rows[0];

        // Get sidebar counts for admin layout
        const [usersResult, applicationsResult, universitiesResult] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM users'),
            pool.query('SELECT COUNT(*) as count FROM applications'),
            pool.query('SELECT COUNT(*) as count FROM universities WHERE is_active = true')
        ]);
        
        const sidebarCounts = {
            userCount: parseInt(usersResult.rows[0].count),
            applicationCount: parseInt(applicationsResult.rows[0].count),
            universityCount: parseInt(universitiesResult.rows[0].count)
        };

        res.render('admin/program-add', {
            title: `${university.name} - Program Ekle - Admin Panel`,
            university: university,
            layout: 'layout',
            ...sidebarCounts
        });
    } catch (error) {
        console.error('Program add error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// University program add POST route
app.post('/admin/universities/:id/programs', async (req, res) => {
    try {
        // Check if user is logged in and is admin
        if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const universityId = req.params.id;
        
        // Parse form data manually since we're using FormData
        const formData = req.body;
        const name = formData.name;
        const name_en = formData.name_en;
        const degree_type = formData.degree_type;
        const duration_months = formData.duration_months;
        const application_fee = formData.application_fee;
        const language = formData.language;
        const start_date = formData.start_date;
        const description = formData.description;
        const description_en = formData.description_en;
        const requirements = formData.requirements;
        const requirements_en = formData.requirements_en;
        const application_deadline = formData.application_deadline;
        const is_active = formData.is_active;

        console.log('Form data received:', {
            name, degree_type, duration_months, language, is_active
        });

        // Validate required fields
        if (!name || !degree_type || !duration_months || !language) {
            return res.status(400).json({ 
                success: false, 
                message: 'Gerekli alanlar eksik',
                received: { name, degree_type, duration_months, language }
            });
        }

        // Insert new program
        const result = await pool.query(`
            INSERT INTO university_programs (
                university_id, name, name_en, degree_type, duration_months, 
                language, start_date, description, 
                description_en, requirements, requirements_en, application_deadline, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id
        `, [
            universityId, name, name_en || null, degree_type, duration_months,
            language, start_date || null, description || null,
            description_en || null, requirements || null, requirements_en || null, application_deadline || null, is_active === 'true'
        ]);

        // Update university program count
        await pool.query(`
            UPDATE universities 
            SET program_count = (
                SELECT COUNT(*) FROM university_programs 
                WHERE university_id = $1 AND is_active = true
            )
            WHERE id = $1
        `, [universityId]);

        res.json({ success: true, message: 'Program başarıyla eklendi', program_id: result.rows[0].id });
    } catch (error) {
        console.error('Program add POST error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});






// User files route
app.get('/user/files', async (req, res) => {
    try {
        if (!res.locals.isLoggedIn || res.locals.isAdmin) {
            return res.redirect('/login');
        }
        res.render('user/files', {
            title: 'Dosyalarım',
            currentLanguage: res.locals.currentLanguage || 'tr',
            isLoggedIn: res.locals.isLoggedIn,
            currentUser: res.locals.currentUser,
            t: res.locals.t
        });
    } catch (error) {
        console.error('Files error:', error);
        res.redirect('/login');
    }
});

// User settings route (Added)
app.get('/user/settings', async (req, res) => {
    try {
        if (!res.locals.isLoggedIn || res.locals.isAdmin) {
            return res.redirect('/login');
        }
        res.render('user/settings', {
            title: 'Ayarlar',
            currentLanguage: res.locals.currentLanguage || 'tr',
            isLoggedIn: res.locals.isLoggedIn,
            currentUser: res.locals.currentUser,
            t: res.locals.t
        });
    } catch (error) {
        console.error('Settings error:', error);
        res.redirect('/login');
    }
});

// Email verification route
app.get('/verify-email', async (req, res) => {
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
            'SELECT id, first_name, email FROM users WHERE verification_token = $1 AND email_verified = FALSE',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).render('verification-error', { 
                title: 'Doğrulama Hatası',
                message: language === 'tr' ? 'Geçersiz veya kullanılmış doğrulama tokeni' : 'Invalid or used verification token',
                language 
            });
        }

        const user = result.rows[0];

        // Update user as verified
        await pool.query(
            'UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE id = $1',
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

app.get('/contact', (req, res) => {
    res.render('contact', { title: res.locals.t.nav.contact });
});

app.get('/test-form', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-form.html'));
});
app.get('/assessment', (req, res) => {
    res.render('assessment', { title: res.locals.t.nav.assessment });
});

// Yurtdışında Öğrenci Olmak Route'ları
app.get('/student-life/germany', (req, res) => {
    res.render('student-life-germany', { 
        title: res.locals.t.studentLifePage.hero.germany.title,
        t: res.locals.t 
    });
});

app.get('/student-life/czech', (req, res) => {
    res.render('student-life-czech', { 
        title: res.locals.t.studentLifePage.hero.czech.title,
        t: res.locals.t 
    });
});

app.get('/student-life/italy', (req, res) => {
    res.render('student-life-italy', { 
        title: res.locals.t.studentLifePage.hero.italy.title,
        t: res.locals.t 
    });
});

app.get('/student-life/austria', (req, res) => {
    res.render('student-life-austria', { 
        title: res.locals.t.studentLifePage.hero.austria.title,
        t: res.locals.t 
    });
});

app.get('/student-life/uk', (req, res) => {
    res.render('student-life-uk', { 
        title: res.locals.t.studentLifePage.hero.uk.title,
        t: res.locals.t 
    });
});

app.get('/student-life/poland', (req, res) => {
    res.render('student-life-poland', { 
        title: res.locals.t.studentLifePage.hero.poland.title,
        t: res.locals.t 
    });
});

app.get('/student-life/hungary', (req, res) => {
    res.render('student-life-hungary', { 
        title: res.locals.t.studentLifePage.hero.hungary.title,
        t: res.locals.t 
    });
});

// Üniversite detay route'ları (örnek olarak sadece TUM, CTU, Charles, TUD ekliyorum, diğerlerini de aynı şekilde ekleyebilirsin)
app.get('/university/tum', (req, res) => {
    res.render('university-detail', { 
        title: 'Technical University of Munich',
        university: {
            name: 'Technical University of Munich',
            shortName: 'TUM',
            location: res.locals.t.universityLocations.munich,
            logo: '/images/logos/tum-logo.png',
            description: res.locals.t.universityDetailDescriptions.tum,
            tuition: res.locals.t.universityTuition.tum,
            programs: res.locals.t.universityPrograms.tum,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'Dünya sıralamasında ilk 50',
            qsRanking: '19 (Makine, Havacılık & Üretim Mühendisliği)',
            language: res.locals.t.studentLifePage.universityLanguages.germanEnglish,
            applicationDeadline: res.locals.t.universityDeadlines.tum,
            requirements: res.locals.t.universityRequirements.tum
        }
    });
});
const getUniversityLogo = (folder, fallback) => {
    // Basit çözüm: Doğrudan fallback'i döndür
    console.log(`Using fallback logo for ${folder}: ${fallback}`);
    return fallback;
};
// CTU
app.get('/university/ctu', (req, res) => {
    res.render('university-detail', {
        title: 'Czech Technical University in Prague',
        university: {
            name: 'Czech Technical University in Prague',
            shortName: 'CTU',
            location: res.locals.t.universityLocations.prague,
            logo: '/images/logos/ctu-logo.svg',
            description: res.locals.t.universityDetailDescriptions.ctu,
            tuition: res.locals.t.universityTuition.ctu,
            programs: res.locals.t.universityPrograms.ctu,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS Dünya Sıralaması: 432 (2024)',
            qsRanking: '151-200 (Elektrik & Elektronik Mühendisliği)',
            language: res.locals.t.studentLifePage.universityLanguages.englishCzech,
            applicationDeadline: res.locals.t.universityDeadlines.ctu,
            requirements: res.locals.t.universityRequirements.ctu
        }
    });
});
// Charles University
app.get('/university/charles', (req, res) => {
    res.render('university-detail', {
        title: 'Charles University',
        university: {
            name: 'Charles University',
            shortName: 'CUNI',
            location: res.locals.t.universityLocations.prague,
            logo: '/images/logos/cuni-logo.svg',
            description: res.locals.t.universityDetailDescriptions.charles,
            tuition: res.locals.t.universityTuition.charles,
            programs: res.locals.t.universityPrograms.charles,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS Dünya Sıralaması: 248 (2024)',
            qsRanking: '201-250 (Yaşam Bilimleri & Tıp)',
            language: res.locals.t.studentLifePage.universityLanguages.englishCzech,
            applicationDeadline: res.locals.t.universityDeadlines.charles,
            requirements: res.locals.t.universityRequirements.charles
        }
    });
});
// TUD
app.get('/university/tud', (req, res) => {
    res.render('university-detail', {
        title: 'Technical University of Dresden',
        university: {
            name: 'Technical University of Dresden',
            shortName: 'TUD',
            location: res.locals.t.universityLocations.dresden,
            logo: '/images/logos/tud-logo.jpg',
            description: res.locals.t.universityDetailDescriptions.tud,
            tuition: res.locals.t.universityTuition.tud,
            programs: res.locals.t.universityPrograms.ctu, // TUD için CTU programlarını kullanıyoruz
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS Dünya Sıralaması: 201-250 (2024)',
            qsRanking: '151-200 (Makine Mühendisliği)',
            language: res.locals.t.studentLifePage.universityLanguages.germanEnglish,
            applicationDeadline: res.locals.t.universityDeadlines.tud,
            requirements: res.locals.t.universityRequirements.tum // TUD için TUM gereksinimlerini kullanıyoruz
        }
    });
});

// Politecnico di Milano
app.get('/university/polimi', (req, res) => {
    res.render('university-detail', {
        title: 'Politecnico di Milano',
        university: {
            name: 'Politecnico di Milano',
            shortName: 'POLIMI',
            location: res.locals.t.universityLocations.milan,
            logo: '/images/logos/polimi-logo.png',
            description: res.locals.t.universityDetailDescriptions.polimi,
            tuition: res.locals.t.universityTuition.polimi,
            programs: res.locals.t.universityPrograms.tum, // Polimi için TUM programlarını kullanıyoruz
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS Dünya Sıralaması: 123 (2024)',
            qsRanking: '5 (Sanat & Tasarım)',
            language: res.locals.t.studentLifePage.universityLanguages.italianEnglish,
            applicationDeadline: res.locals.t.universityDeadlines.polimi,
            requirements: res.locals.t.universityRequirements.tum // Polimi için TUM gereksinimlerini kullanıyoruz
        }
    });
});
        // Sapienza University of Rome
app.get('/university/sapienza', (req, res) => {
    res.render('university-detail', {
        title: 'Sapienza University of Rome',
        university: {
            name: 'Sapienza University of Rome',
            shortName: 'Sapienza',
            location: res.locals.t.universityLocations.rome,
            logo: '/images/logos/sapienza-university-of-rome.png',
            description: res.locals.t.universityDetailDescriptions.sapienza,
            tuition: res.locals.t.universityTuition.sapienza,
            programs: res.locals.t.universityPrograms.sapienza,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS World Ranking: 189 (2024)',
            qsRanking: '10 (Art & Design)',
            language: res.locals.t.studentLifePage.universityLanguages.italianEnglish,
            applicationDeadline: res.locals.t.universityDeadlines.sapienza,
            requirements: res.locals.t.universityRequirements.sapienza
        }
    });
});
// University of Florence
app.get('/university/unifi', (req, res) => {
    res.render('university-detail', {
        title: 'University of Florence',
        university: {
            name: 'University of Florence',
            shortName: 'Unifi',
            location: res.locals.t.universityLocations.florence,
            logo: '/images/logos/unifi-logo.png',
            description: res.locals.t.universityDetailDescriptions.sapienza,
            tuition: res.locals.t.universityTuition.unifi,
            programs: res.locals.t.universityPrograms.sapienza,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS World Ranking: 200 (2024)',
            qsRanking: '11 (Art & Design)',
            language: res.locals.t.studentLifePage.universityLanguages.italianEnglish,
            applicationDeadline: res.locals.t.universityDeadlines.sapienza,
            requirements: res.locals.t.universityRequirements.unifi
        }
    });
});
// Brno University of Technology
app.get('/university/vut', (req, res) => {
    res.render('university-detail', {
        title: 'Brno University of Technology',
        university: {
            name: 'Brno University of Technology',
            shortName: 'BUT',
            location: res.locals.t.universityLocations.brno,
            logo: '/images/logos/vut-logo.png', // LOGOYA DOKUNMA
            description: res.locals.t.universityDetailDescriptions.vut,
            tuition: res.locals.t.universityTuition.vut,
            programs: res.locals.t.universityPrograms.vut,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS World Ranking: 401-450 (Mechanical Engineering)',
            qsRanking: 'Czech Republic\'s largest technical university',
            language: res.locals.t.studentLifePage.universityLanguages.englishCzech,
            applicationDeadline: res.locals.t.universityDeadlines.vut,
            requirements: res.locals.t.universityRequirements.vut
        }
    });
});
// University of Vienna
app.get('/university/univie', (req, res) => {
    res.render('university-detail', {
        title: 'University of Vienna',
        university: {
            name: 'University of Vienna',
            shortName: 'Univie',
            location: res.locals.t.universityLocations.vienna,
            logo: '/images/logos/univie-logo.png', // LOGOYA DOKUNMA
            description: res.locals.t.universityDetailDescriptions.univie,
            tuition: res.locals.t.universityTuition.univie,
            programs: res.locals.t.universityPrograms.univie,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS World Ranking: 132 (2025)',
            qsRanking: 'Top 50 Europe, Austria 2nd',
            language: res.locals.t.studentLifePage.universityLanguages.germanWithNotes,
            applicationDeadline: res.locals.t.universityDeadlines.univie,
            requirements: res.locals.t.universityRequirements.univie
        }
    });
});
// University of Chemistry and Technology, Prague (VSCHT)
app.get('/university/vscht', (req, res) => {
    res.render('university-detail', {
        title: 'University of Chemistry and Technology, Prague (VSCHT)',
        university: {
            name: 'University of Chemistry and Technology, Prague',
            shortName: 'VSCHT',
            location: res.locals.t.universityLocations.prague,
            logo: '/images/logos/vscht-logo.png', // LOGOYA DOKUNMA
            description: res.locals.t.universityDetailDescriptions.vscht,
            tuition: res.locals.t.universityTuition.vscht,
            programs: res.locals.t.universityPrograms.vscht,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS World Ranking: 570 (2025)',
            qsRanking: 'One of Central Europe\'s best in Chemistry and Technology',
            language: res.locals.t.studentLifePage.universityLanguages.englishCzech,
            applicationDeadline: res.locals.t.universityDeadlines.vscht,
            requirements: res.locals.t.universityRequirements.vscht
        }
    });
});
// Metropolitan University Prague
app.get('/university/metropolitan', (req, res) => {
    res.render('university-detail', {
        title: 'Metropolitan University Prague',
        university: {
            name: 'Metropolitan University Prague',
            shortName: 'MUP',
            location: res.locals.t.universityLocations.prague,
            logo: '/images/logos/metropolitan-logo.jpeg', // LOGOYA DOKUNMA
            description: res.locals.t.universityDetailDescriptions.metropolitan,
            tuition: res.locals.t.universityTuition.metropolitan,
            programs: res.locals.t.universityPrograms.metropolitan,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'One of Czech Republic\'s best private universities (not ranked in QS/THE)',
            qsRanking: 'Not available',
            language: res.locals.t.studentLifePage.universityLanguages.englishCzech,
            applicationDeadline: res.locals.t.universityDeadlines.metropolitan,
            requirements: res.locals.t.universityRequirements.metropolitan
        }
    });
});
// Czech University of Life Sciences Prague
app.get('/university/czu', (req, res) => {
    res.render('university-detail', {
        title: 'Czech University of Life Sciences Prague',
        university: {
            name: 'Czech University of Life Sciences Prague',
            shortName: 'CZU',
            location: res.locals.t.universityLocations.prague,
            logo: '/images/logos/czu-logo.png', // LOGOYA DOKUNMA
            description: res.locals.t.universityDetailDescriptions.czu,
            tuition: res.locals.t.universityTuition.czu,
            programs: res.locals.t.universityPrograms.czu,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS World Ranking: 761-770 (2026)',
            qsRanking: '66 (Agriculture & Forestry)',
            language: res.locals.t.studentLifePage.universityLanguages.englishCzech,
            applicationDeadline: res.locals.t.universityDeadlines.czu,
            requirements: res.locals.t.universityRequirements.czu
        }
    });
});
// University of Manchester
app.get('/university/manchester', (req, res) => {
    res.render('university-detail', {
        title: 'University of Manchester',
        university: {
            name: 'University of Manchester',
            shortName: 'Manchester',
            location: res.locals.t.universityLocations.manchester,
            logo: '/images/logos/manchester-logo.jpeg', // LOGOYA DOKUNMA
            description: res.locals.t.universityDetailDescriptions.manchester,
            tuition: res.locals.t.universityTuition.manchester,
            programs: res.locals.t.universityPrograms.manchester,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS World Ranking: 35 (2026)',
            qsRanking: 'UK 7th, Europe 11th',
            language: res.locals.t.studentLifePage.universityLanguages.englishOnly,
            applicationDeadline: res.locals.t.universityDeadlines.manchester,
            requirements: res.locals.t.universityRequirements.manchester
        }
    });
});
// Masaryk University
app.get('/university/masaryk', (req, res) => {
    res.render('university-detail', {
        title: 'Masaryk University',
        university: {
            name: 'Masaryk University',
            shortName: 'Masaryk',
            location: res.locals.t.universityLocations.brno,
            logo: '/images/logos/masaryk-logo.png', // LOGOYA DOKUNMA
            description: res.locals.t.universityDetailDescriptions.masaryk,
            tuition: res.locals.t.universityTuition.masaryk,
            programs: res.locals.t.universityPrograms.masaryk,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS World Ranking: 430 (2025)',
            qsRanking: 'Czech Republic 3rd, Sustainability: 214',
            language: res.locals.t.studentLifePage.universityLanguages.englishCzech,
            applicationDeadline: res.locals.t.universityDeadlines.masaryk,
            requirements: res.locals.t.universityRequirements.masaryk
        }
    });
});
// University of York
app.get('/university/unyp', (req, res) => {
    res.render('university-detail', {
        title: 'University of New York in Prague',
        university: {
            name: 'University of New York in Prague',
            shortName: 'UNYP',
            location: res.locals.t.universityLocations.prague,
            logo: '/images/logos/unyp-logo.png', // LOGOYA DOKUNMA
            description: res.locals.t.universityDetailDescriptions.unyp,
            tuition: res.locals.t.universityTuition.unyp,
            programs: res.locals.t.universityPrograms.unyp,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'One of Czech Republic\'s best private universities, World ranking: 4782 (uniRank 2024)',
            qsRanking: 'Not available',
            language: res.locals.t.studentLifePage.universityLanguages.englishOnly,
            applicationDeadline: res.locals.t.universityDeadlines.unyp,
            requirements: res.locals.t.universityRequirements.unyp
        }
    });
});
// Bologna University
app.get('/university/bologna', (req, res) => {
    res.render('university-detail', {
        title: 'University of Bologna',
        university: {
            name: 'University of Bologna',
            shortName: 'Bologna',
            location: res.locals.t.universityLocations.bologna,
            logo: '/images/logos/bologna-logo.png', // LOGOYA DOKUNMA
            description: res.locals.t.universityDetailDescriptions.bologna,
            tuition: res.locals.t.universityTuition.bologna,
            programs: res.locals.t.universityPrograms.bologna,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS World Ranking: 133 (2025)',
            qsRanking: 'Italy 1st, Europe Top 50',
            language: res.locals.t.studentLifePage.universityLanguages.italianWithPrograms,
            applicationDeadline: res.locals.t.universityDeadlines.bologna,
            requirements: res.locals.t.universityRequirements.bologna
        }
    });
});
// University of Warsaw
app.get('/university/warsaw', (req, res) => {
    res.render('university-detail', {
        title: 'University of Warsaw',
        university: {
            name: 'University of Warsaw',
            shortName: 'Warsaw',
            location: res.locals.t.universityLocations.warsaw,
            logo: '/images/logos/warsaw-logo.jpeg', // LOGOYA DOKUNMA
            description: res.locals.t.universityDetailDescriptions.warsaw,
            tuition: res.locals.t.universityTuition.warsaw,
            programs: res.locals.t.universityPrograms.warsaw,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS World Ranking: 262 (2025)',
            qsRanking: 'Poland 1st, Central Europe Top 5',
            language: res.locals.t.studentLifePage.universityLanguages.polishEnglish,
            applicationDeadline: res.locals.t.universityDeadlines.warsaw,
            requirements: res.locals.t.universityRequirements.warsaw
        }
    });
});
// University of Stirling
app.get('/university/stirling', (req, res) => {
    res.render('university-detail', {
        title: 'University of Stirling',
        university: {
            name: 'University of Stirling',
            shortName: 'Stirling',
            location: res.locals.t.universityLocations.stirling,
            logo: '/images/logos/stirling-logo.png', // LOGOYA DOKUNMA
            description: res.locals.t.universityDetailDescriptions.stirling,
            tuition: res.locals.t.universityTuition.stirling,
            programs: res.locals.t.universityPrograms.stirling,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS World Ranking: 452 (2025)',
            qsRanking: 'UK Top 50, World Top 500',
            language: res.locals.t.studentLifePage.universityLanguages.englishOnly,
            applicationDeadline: res.locals.t.universityDeadlines.stirling,
            requirements: res.locals.t.universityRequirements.stirling
        }
    });
});
// University of Winchester
app.get('/university/winchester', (req, res) => {
    res.render('university-detail', {
        title: 'University of Winchester',
        university: {
            name: 'University of Winchester',
            shortName: 'Winchester',
            location: res.locals.t.universityLocations.winchester,
            logo: '/images/logos/winchester-logo.png', // LOGOYA DOKUNMA
            description: res.locals.t.universityDetailDescriptions.winchester,
            tuition: res.locals.t.universityTuition.winchester,
            programs: res.locals.t.universityPrograms.winchester,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'Complete University Guide: 98. (2026), THE: 1201-1500 (2025)',
            qsRanking: 'UK Top 100',
            language: res.locals.t.studentLifePage.universityLanguages.englishOnly,
            applicationDeadline: res.locals.t.universityDeadlines.winchester,
            requirements: res.locals.t.universityRequirements.winchester
        }
    });
});

// Yeni üniversiteler
app.get('/university/bsbi', (req, res) => {
    res.render('university-detail', {
        title: 'Berlin School of Business and Innovation',
        university: {
            name: 'Berlin School of Business and Innovation',
            shortName: 'BSBI',
            location: res.locals.t.universityLocations.berlin,
            logo: '/images/logos/bsbi-logo.jpeg',
            description: res.locals.t.universityDetailDescriptions.bsbi,
            tuition: res.locals.t.universityTuition.bsbi,
            programs: res.locals.t.universityPrograms.bsbi,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'Modern business school',
            qsRanking: 'Private university',
            language: res.locals.t.studentLifePage.universityLanguages.englishOnly,
            applicationDeadline: res.locals.t.universityDeadlines.bsbi,
            requirements: res.locals.t.universityRequirements.bsbi
        }
    });
});

app.get('/university/vse', (req, res) => {
    res.render('university-detail', {
        title: 'University of Economics, Prague VSE',
        university: {
            name: 'University of Economics, Prague VSE',
            shortName: 'VSE',
            location: res.locals.t.universityLocations.prague,
            logo: '/images/logos/vse-logo.png',
            description: res.locals.t.universityDetailDescriptions.vse,
            tuition: res.locals.t.universityTuition.vse,
            programs: res.locals.t.universityPrograms.vse,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'Czech Republic\'s best economics university',
            qsRanking: 'Leading in Economics in Europe',
            language: res.locals.t.studentLifePage.universityLanguages.englishCzech,
            applicationDeadline: res.locals.t.universityDeadlines.vut,
            requirements: res.locals.t.universityRequirements.vse
        }
    });
});

app.get('/university/cattolica', (req, res) => {
    res.render('university-detail', {
        title: 'Università Cattolica del Sacro Cuore',
        university: {
            name: 'Università Cattolica del Sacro Cuore',
            shortName: 'Cattolica',
            location: res.locals.t.universityLocations.milan,
            logo: '/images/logos/cattolica-logo.png',
            description: res.locals.t.universityDetailDescriptions.sapienza,
            tuition: res.locals.t.universityTuition.cattolica,
            programs: res.locals.t.universityPrograms.cattolica,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'Italy\'s best private university',
            qsRanking: 'Top 500 in world rankings',
            language: res.locals.t.studentLifePage.universityLanguages.italianEnglish,
            applicationDeadline: res.locals.t.universityDeadlines.cattolica,
            requirements: res.locals.t.universityRequirements.cattolica
        }
    });
});

app.get('/university/siena', (req, res) => {
    res.render('university-detail', {
        title: 'University of Siena',
        university: {
            name: 'University of Siena',
            shortName: 'Siena',
            location: res.locals.t.universityLocations.siena,
            logo: '/images/logos/siena-logo.png',
            description: res.locals.t.universityDetailDescriptions.siena,
            tuition: res.locals.t.universityTuition.siena,
            programs: res.locals.t.universityPrograms.siena,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'One of Italy\'s oldest universities',
            qsRanking: 'Strong in Medicine',
            language: res.locals.t.studentLifePage.universityLanguages.italianEnglish,
            applicationDeadline: res.locals.t.universityDeadlines.cattolica,
            requirements: res.locals.t.universityRequirements.siena
        }
    });
});

app.get('/university/polito', (req, res) => {
    res.render('university-detail', {
        title: 'Politecnico di Torino',
        university: {
            name: 'Politecnico di Torino',
            shortName: 'Polito',
            location: res.locals.t.universityLocations.turin,
            logo: '/images/logos/polito-logo.png',
            description: res.locals.t.universityDetailDescriptions.sapienza,
            tuition: res.locals.t.universityTuition.polito,
            programs: res.locals.t.universityPrograms.polito,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'One of Italy\'s most prestigious technical universities',
            qsRanking: 'World-renowned in Engineering',
            language: res.locals.t.studentLifePage.universityLanguages.italianEnglish,
            applicationDeadline: res.locals.t.universityDeadlines.polito,
            requirements: res.locals.t.universityRequirements.polito
        }
    });
});

app.get('/university/padova', (req, res) => {
    res.render('university-detail', {
        title: 'University of Padova',
        university: {
            name: 'University of Padova',
            shortName: 'Padova',
            location: res.locals.t.universityLocations.padova,
            logo: '/images/logos/padova-logo.png',
            description: res.locals.t.universityDetailDescriptions.padova,
            tuition: res.locals.t.universityTuition.siena,
            programs: res.locals.t.universityPrograms.padova,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'One of Italy\'s oldest universities',
            qsRanking: 'World-renowned in Medicine',
            language: res.locals.t.studentLifePage.universityLanguages.italianEnglish,
            applicationDeadline: res.locals.t.universityDeadlines.cattolica,
            requirements: res.locals.t.universityRequirements.padova
        }
    });
});

// University of Pecs
app.get('/university/pecs', (req, res) => {
    res.render('university-detail', {
        title: 'University of Pecs',
        university: {
            name: 'University of Pecs',
            shortName: 'Pecs',
            location: res.locals.t.universityLocations.budapest,
            logo: '/images/logos/pecs-logo.png',
            description: res.locals.t.universityDetailDescriptions.pecs,
            tuition: res.locals.t.universityTuition.pecs,
            programs: res.locals.t.universityPrograms.pecs,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS World Ranking: 451-500 (Medicine)',
            qsRanking: 'Hungary\'s oldest university',
            language: res.locals.t.studentLifePage.universityLanguages.hungarianEnglish,
            applicationDeadline: res.locals.t.universityDeadlines.vsb,
            requirements: res.locals.t.universityRequirements.pecs
        }
    });
});

// VSB Technical University of Ostrava
app.get('/university/vsb', (req, res) => {
    res.render('university-detail', {
        title: 'VSB Technical University of Ostrava',
        university: {
            name: 'VSB Technical University of Ostrava',
            shortName: 'VSB',
            location: res.locals.t.universityLocations.ostrava,
            logo: '/images/logos/vsb-logo.png',
            description: res.locals.t.universityDetailDescriptions.vut,
            tuition: res.locals.t.universityTuition.vsb,
            programs: res.locals.t.universityPrograms.vsb,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS World Ranking: 1001+ (2024)',
            qsRanking: 'One of Czech Republic\'s largest technical universities',
            language: res.locals.t.studentLifePage.universityLanguages.englishCzech,
            applicationDeadline: res.locals.t.universityDeadlines.vut,
            requirements: res.locals.t.universityRequirements.vsb
        }
    });
});

// Warsaw University of Technology
app.get('/university/wut', (req, res) => {
    res.render('university-detail', {
        title: 'Warsaw University of Technology',
        university: {
            name: 'Warsaw University of Technology',
            shortName: 'WUT',
            location: res.locals.t.universityLocations.warsaw,
            logo: '/images/logos/wut-logo.png',
            description: res.locals.t.universityDetailDescriptions.wut,
            tuition: res.locals.t.universityTuition.wut,
            programs: res.locals.t.universityPrograms.wut,
            levels: [res.locals.t.universityLevels.bachelor, res.locals.t.universityLevels.master],
            ranking: 'QS World Ranking: 501-510 (2024)',
            qsRanking: '201-250 (Electrical & Electronic Engineering)',
            language: res.locals.t.studentLifePage.universityLanguages.polishEnglish,
            applicationDeadline: res.locals.t.universityDeadlines.vut,
            requirements: res.locals.t.universityRequirements.wut
        }
    });
});

// Form verilerini dile göre çeviren fonksiyon
const translateFormData = (formData, language) => {
    const tr = require('./locales/tr');
    const en = require('./locales/en');
    const locales = { tr, en };
    const t = locales[language] || locales.tr;
    
    // Ülke çevirileri
    const countryTranslations = {
        germany: { tr: 'Almanya', en: 'Germany' },
        austria: { tr: 'Avusturya', en: 'Austria' },
        uk: { tr: 'İngiltere', en: 'United Kingdom' },
        italy: { tr: 'İtalya', en: 'Italy' },
        czech: { tr: 'Çek Cumhuriyeti', en: 'Czech Republic' },
        poland: { tr: 'Polonya', en: 'Poland' },
        hungary: { tr: 'Macaristan', en: 'Hungary' }
    };
    
    // Program alanı çevirileri
    const programTranslations = {
        engineering: { tr: 'Mühendislik', en: 'Engineering' },
        business: { tr: 'İşletme/Ekonomi', en: 'Business/Economics' },
        medicine: { tr: 'Tıp', en: 'Medicine' },
        arts: { tr: 'Sanat/Tasarım', en: 'Arts/Design' },
        social: { tr: 'Sosyal Bilimler', en: 'Social Sciences' },
        natural: { tr: 'Doğa Bilimleri', en: 'Natural Sciences' },
        computer: { tr: 'Bilgisayar Bilimi', en: 'Computer Science' },
        language: { tr: 'Dil Eğitimi', en: 'Language Education' },
        other: { tr: 'Diğer', en: 'Other' }
    };
    
    // Eğitim seviyesi çevirileri
    const educationTranslations = {
        high_school: { tr: 'Lise Öğrencisi', en: 'High School Student' },
        high_school_graduate: { tr: 'Lise Mezunu', en: 'High School Graduate' },
        university_student: { tr: 'Üniversite Öğrencisi', en: 'University Student' },
        university_graduate: { tr: 'Üniversite Mezunu', en: 'University Graduate' },
        master_student: { tr: 'Yüksek Lisans Öğrencisi', en: 'Master\'s Student' },
        master_graduate: { tr: 'Yüksek Lisans Mezunu', en: 'Master\'s Graduate' },
        bachelor: { tr: 'Lisans (Bachelor)', en: 'Bachelor\'s Degree' },
        master: { tr: 'Yüksek Lisans (Master)', en: 'Master\'s Degree' },
        language: { tr: 'Dil Okulu', en: 'Language School' }
    };
    
    // Bütçe çevirileri ve sayısal değerler
    const budgetTranslations = {
        low: { 
            tr: '5,000 - 15,000 €', 
            en: '5,000 - 15,000 €',
            value: '5,000 - 15,000 €'
        },
        medium: { 
            tr: '15,000 - 30,000 €', 
            en: '15,000 - 30,000 €',
            value: '15,000 - 30,000 €'
        },
        high: { 
            tr: '30,000+ €', 
            en: '30,000+ €',
            value: '30,000+ €'
        }
    };
    
    return {
        ...formData,
        country: countryTranslations[formData.country]?.[language] || formData.country,
        program: programTranslations[formData.program]?.[language] || formData.program,
        educationLevel: educationTranslations[formData.educationLevel]?.[language] || formData.educationLevel,
        budget: budgetTranslations[formData.budget]?.[language] || formData.budget,
        budgetValue: budgetTranslations[formData.budget]?.value || formData.budget
    };
};

// İletişim formu e-posta gönderme fonksiyonu
const sendContactEmail = async (formData, language = 'tr') => {
    try {
        // Console'a yazdır
        console.log('=== YENİ İLETİŞİM FORMU ===');
        console.log('Tarih:', new Date().toLocaleString('tr-TR'));
        console.log('Dil:', language);
        console.log('Ad Soyad:', formData.firstName, formData.lastName);
        console.log('E-posta:', formData.email);
        console.log('Telefon:', formData.phone);
        console.log('Mesaj:', formData.message);
        console.log('================================');
        
        // EmailService'den transporter'ı kullan
        const transporter = emailService.transporter;
        
        const emailContent = {
            tr: {
                subject: 'Yeni İletişim Formu - Venture Global',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="margin: 0; font-size: 28px;">Venture Global</h1>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">Yeni İletişim Formu</p>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                            <h2 style="color: #333; margin-bottom: 20px;">Yeni İletişim Formu Geldi!</h2>
                            
                            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0078D7;">
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Ad Soyad:</strong> ${formData.firstName} ${formData.lastName}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>E-posta:</strong> ${formData.email}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Telefon:</strong> ${formData.phone || 'Belirtilmemiş'}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Mesaj:</strong></p>
                                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; white-space: pre-wrap; color: #333;">${formData.message}</div>
                            </div>
                            
                            <p style="color: #666; font-size: 14px; margin-top: 25px;">
                                Bu form ${new Date().toLocaleString('tr-TR')} tarihinde gönderilmiştir.
                            </p>
                            
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                            
                            <p style="color: #999; font-size: 12px; text-align: center;">
                                Venture Global - Avrupa Üniversite ve Dil Okulu Danışmanlığı
                            </p>
                        </div>
                    </div>
                `
            },
            en: {
                subject: 'New Contact Form - Venture Global',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="margin: 0; font-size: 28px;">Venture Global</h1>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">New Contact Form</p>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                            <h2 style="color: #333; margin-bottom: 20px;">New Contact Form Received!</h2>
                            
                            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0078D7;">
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Name:</strong> ${formData.firstName} ${formData.lastName}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Email:</strong> ${formData.email}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Phone:</strong> ${formData.phone || 'Not provided'}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Message:</strong></p>
                                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; white-space: pre-wrap; color: #333;">${formData.message}</div>
                            </div>
                            
                            <p style="color: #666; font-size: 14px; margin-top: 25px;">
                                This form was sent on ${new Date().toLocaleString('en-US')}.
                            </p>
                            
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                            
                            <p style="color: #999; font-size: 12px; text-align: center;">
                                Venture Global - European University and Language School Consultancy
                            </p>
                        </div>
                    </div>
                `
            }
        };
        
        const content = emailContent[language] || emailContent.tr;
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com',
            to: process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com',
            subject: content.subject,
            html: content.html
        };
        
        console.log('E-posta gönderiliyor...');
        const info = await transporter.sendMail(mailOptions);
        console.log('E-posta başarıyla gönderildi:', info.messageId);
        
        return true;
    } catch (error) {
        console.error('E-posta gönderme hatası:', error.message);
        return false;
    }
};

// E-posta gönderme fonksiyonu
const sendAssessmentEmail = async (formData, language = 'tr') => {
    try {
        // Form verilerini dile göre çevir
        const translatedData = translateFormData(formData, language);
        
        // Form verilerini dosyaya kaydet
        const assessmentData = {
            timestamp: new Date().toISOString(),
            language: language,
            ...translatedData
        };
        
        // assessments.json dosyasına ekle
        const filePath = './assessments.json';
        let assessments = [];
        
        if (fs.existsSync(filePath)) {
            assessments = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        
        assessments.push(assessmentData);
        fs.writeFileSync(filePath, JSON.stringify(assessments, null, 2));
        
        // Console'a yazdır
        console.log('=== YENİ DEĞERLENDİRME FORMU ===');
        console.log('Tarih:', new Date().toLocaleString('tr-TR'));
        console.log('Dil:', language);
        console.log('Ad Soyad:', translatedData.firstName, translatedData.lastName);
        console.log('E-posta:', translatedData.email);
        console.log('Telefon:', translatedData.phone);
        console.log('Eğitim Seviyesi:', translatedData.educationLevel);
        console.log('Tercih Ettiği Ülke:', translatedData.country);
        console.log('Program Alanı:', translatedData.program);
        console.log('Bütçe Aralığı:', translatedData.budget);
        console.log('================================');
        
        // EmailService'den transporter'ı kullan
        const transporter = emailService.transporter;
        
        const emailContent = {
            tr: {
                subject: 'Yeni Eğitim Değerlendirme Formu - Venture Global',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="margin: 0; font-size: 28px;">Venture Global</h1>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">Yeni Eğitim Değerlendirme Formu</p>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                            <h2 style="color: #333; margin-bottom: 20px;">Yeni Eğitim Değerlendirme Formu Geldi!</h2>
                            
                            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0078D7;">
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Ad Soyad:</strong> ${translatedData.firstName} ${translatedData.lastName}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>E-posta:</strong> ${translatedData.email}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Telefon:</strong> ${translatedData.phone}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Eğitim Seviyesi:</strong> ${translatedData.educationLevel}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Tercih Ettiği Ülke:</strong> ${translatedData.country}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Program Alanı:</strong> ${translatedData.program}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Bütçe Aralığı:</strong> ${translatedData.budget}</p>
                            </div>
                            
                            <p style="color: #666; font-size: 14px; margin-top: 25px;">
                                Bu form ${new Date().toLocaleString('tr-TR')} tarihinde gönderilmiştir.
                            </p>
                            
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                            
                            <p style="color: #999; font-size: 12px; text-align: center;">
                                Venture Global - Avrupa Üniversite ve Dil Okulu Danışmanlığı
                            </p>
                        </div>
                    </div>
                `
            },
            en: {
                subject: 'New Education Assessment Form - Venture Global',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="margin: 0; font-size: 28px;">Venture Global</h1>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">New Education Assessment Form</p>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                            <h2 style="color: #333; margin-bottom: 20px;">New Education Assessment Form Received!</h2>
                            
                            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0078D7;">
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Name:</strong> ${translatedData.firstName} ${translatedData.lastName}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Email:</strong> ${translatedData.email}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Phone:</strong> ${translatedData.phone}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Education Level:</strong> ${translatedData.educationLevel}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Preferred Country:</strong> ${translatedData.country}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Program Area:</strong> ${translatedData.program}</p>
                                <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0;"><strong>Budget Range:</strong> ${translatedData.budget}</p>
                            </div>
                            
                            <p style="color: #666; font-size: 14px; margin-top: 25px;">
                                This form was sent on ${new Date().toLocaleString('en-US')}.
                            </p>
                            
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                            
                            <p style="color: #999; font-size: 12px; text-align: center;">
                                Venture Global - European University and Language School Consultancy
                            </p>
                        </div>
                    </div>
                `
            }
        };
        
        const content = emailContent[language] || emailContent.tr;
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com',
            to: process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com',
            subject: content.subject,
            html: content.html
        };
        
        console.log('E-posta gönderiliyor...');
        const info = await transporter.sendMail(mailOptions);
        console.log('E-posta başarıyla gönderildi:', info.messageId);
        
        return true;
    } catch (error) {
        console.error('E-posta gönderme hatası:', error.message);
        return false;
    }
};

// İletişim formu API route'u
app.post('/api/contact', async (req, res) => {
    const { firstName, lastName, email, phone, message } = req.body;
    
    // Zorunlu alanları kontrol et
    if (!firstName || !lastName || !email || !message) {
        return res.status(400).json({
            success: false,
            error: 'Ad, soyad, e-posta ve mesaj alanları zorunludur'
        });
    }

    // Veri temizleme
    const sanitizedData = {
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        email: String(email).trim(),
        phone: phone ? String(phone).trim() : '',
        message: String(message).trim()
    };

    try {
        // Kullanıcının seçtiği dili al
        const userLanguage = req.cookies.language || 'tr';
        
        // E-posta gönder
        const emailSent = await sendContactEmail(sanitizedData, userLanguage);
        
        if (emailSent) {
            res.json({
                success: true,
                message: userLanguage === 'tr' 
                    ? 'Mesajınız başarıyla gönderildi ve e-posta ile bildirim gönderildi.'
                    : 'Your message has been sent successfully and a notification email has been sent.'
            });
        } else {
            res.json({
                success: true,
                message: userLanguage === 'tr'
                    ? 'Mesajınız alındı fakat e-posta gönderilemedi.'
                    : 'Your message has been received but the email could not be sent.'
            });
        }
    } catch (error) {
        console.error('Form işleme hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
    }
});

// API ve hata handler'ları
app.post('/api/assessment', async (req, res) => {
    const { firstName, lastName, email, phone, currentEducation, targetCountry, targetProgram, targetLevel, budget, educationLevel, country, program } = req.body;
    
    // Hem detaylı form hem de ana sayfa formu için alanları kontrol et
    const educationLevelValue = currentEducation || targetLevel || educationLevel;
    const countryValue = targetCountry || country;
    const programValue = targetProgram || program;
    
    // Zorunlu alanları kontrol et
    if (!firstName || !lastName || !email || !phone || !educationLevelValue || !countryValue || !programValue || !budget) {
        return res.status(400).json({
            success: false,
            error: 'Tüm alanlar zorunludur'
        });
    }

    // Veri temizleme
    const sanitizedData = {
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        email: String(email).trim(),
        phone: String(phone).trim(),
        educationLevel: String(educationLevelValue).trim(),
        country: String(countryValue).trim(),
        program: String(programValue).trim(),
        budget: String(budget).trim()
    };

    try {
        // Kullanıcının seçtiği dili al
        const userLanguage = req.cookies.language || 'tr';
        
        // E-posta gönder
        const emailSent = await sendAssessmentEmail(sanitizedData, userLanguage);
        
        if (emailSent) {
            res.json({
                success: true,
                message: userLanguage === 'tr' 
                    ? 'Değerlendirmeniz başarıyla alındı ve e-posta ile bildirim gönderildi.'
                    : 'Your assessment has been received successfully and a notification email has been sent.'
            });
        } else {
            res.json({
                success: true,
                message: userLanguage === 'tr'
                    ? 'Değerlendirmeniz alındı fakat e-posta gönderilemedi.'
                    : 'Your assessment has been received but the email could not be sent.'
            });
        }
    } catch (error) {
        console.error('Form işleme hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
    }
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Sunucu hatası'
    });
});
app.use((req, res) => {
    res.status(404).render('404', { title: 'Sayfa Bulunamadı' });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Sunucu hatası'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { title: 'Sayfa Bulunamadı' });
});

// Export logoUpload for use in routes
module.exports.logoUpload = logoUpload;

// Server başlatma - Vercel ve local için
if (isVercel) {
    // Vercel'da export edilir
    module.exports = app;
} else {
    // Local development için HTTP Server
    app.listen(PORT, () => {
        console.log(`Venture Global web sitesi HTTP ${PORT} portunda çalışıyor`);
        console.log(`http://localhost:${PORT} adresinden erişebilirsiniz`);
    });

    // Local development için HTTPS Server (self-signed certificate) - Geçici olarak devre dışı
    console.log('HTTPS modu geçici olarak devre dışı bırakıldı.');
} 