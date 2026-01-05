// Student Wizard Routes
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const {
    analyzeStudentProfile,
    saveRecommendation,
    getUserRecommendation,
    getAllRecommendations,
    getRecommendationStats,
    getPrepSchools
} = require('../services/geminiService');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'venture-global-secret-key-2024';

// Helper to extract user from cookie token or header
async function getUserFromToken(req) {
    try {
        // Try multiple token sources: userToken cookie, adminToken cookie, or Authorization header
        const token = req.cookies?.userToken || 
                      req.cookies?.adminToken || 
                      req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            console.log('No token found in request');
            return null;
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const result = await pool.query(
            'SELECT id, first_name, last_name, email, is_admin, email_verified FROM users WHERE id = $1',
            [decoded.userId]
        );
        
        if (result.rows.length === 0) return null;
        return result.rows[0];
    } catch (error) {
        console.error('Token verification error:', error.message);
        return null;
    }
}

// Middleware to check if user is logged in as STUDENT (not admin)
async function isAuthenticated(req, res, next) {
    const user = await getUserFromToken(req);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Giriş yapmanız gerekiyor' });
    }
    // Admin'ler sihirbazı kullanamaz - sadece öğrenciler
    if (user.is_admin) {
        return res.status(403).json({ success: false, message: 'Admin hesapları sihirbazı kullanamaz. Lütfen öğrenci hesabıyla giriş yapın.' });
    }
    req.user = user;
    return next();
}

// Middleware to check if user is admin
async function isAdmin(req, res, next) {
    const user = await getUserFromToken(req);
    if (user && user.is_admin) {
        req.user = user;
        return next();
    }
    return res.status(403).json({ success: false, message: 'Yetkiniz yok' });
}

/**
 * GET /wizard - Render wizard page
 */
router.get('/', (req, res) => {
    res.render('student-wizard', {
        title: 'Öğrenci Sihirbazı - Venture Global',
        user: req.session?.user || null,
        activePage: 'wizard',
        layout: false
    });
});

/**
 * GET /wizard/check-auth - Check if user is authenticated as student (via cookie token)
 */
router.get('/check-auth', async (req, res) => {
    const user = await getUserFromToken(req);
    
    // Admin'ler öğrenci olarak sayılmaz
    const isStudent = user && !user.is_admin;
    
    res.json({
        authenticated: isStudent,
        is_admin: user?.is_admin || false,
        user: isStudent ? {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email
        } : null
    });
});

/**
 * GET /wizard/universities - Get available universities
 */
router.get('/universities', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id,
                u.name,
                u.country,
                u.city,
                u.tuition_fee_min,
                u.tuition_fee_max,
                COUNT(p.id) as program_count
            FROM universities u
            LEFT JOIN university_programs p ON u.id = p.university_id AND p.is_active = true
            WHERE u.is_active = true
            GROUP BY u.id
            ORDER BY u.country, u.name
        `);
        
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching universities:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
});

/**
 * GET /wizard/prep-schools - Get prep schools
 */
router.get('/prep-schools', async (req, res) => {
    try {
        const prepSchools = await getPrepSchools();
        res.json({ success: true, data: prepSchools });
    } catch (error) {
        console.error('Error fetching prep schools:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
});

/**
 * POST /wizard/analyze - Analyze student profile (requires auth)
 */
router.post('/analyze', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const studentData = req.body;
        
        console.log('📊 Analyzing student profile for user:', userId);
        console.log('📋 Education level:', studentData.education_level);
        console.log('📋 English level:', studentData.english_level);
        console.log('📋 Interests:', studentData.interests?.join(', ') || 'None');
        console.log('📋 Country preferences:', studentData.country_preferences?.join(', ') || 'None');
        
        // Validate required fields
        if (!studentData.education_level || !studentData.english_level) {
            console.log('❌ Validation failed: Missing education_level or english_level');
            return res.status(400).json({
                success: false,
                message: 'Eğitim seviyesi ve İngilizce seviyesi zorunludur'
            });
        }
        
        // Analyze with Gemini AI (falls back to rule-based if API unavailable)
        console.log('🤖 Starting AI analysis...');
        const aiResult = await analyzeStudentProfile(studentData);
        
        if (!aiResult.success) {
            console.log('❌ AI analysis returned unsuccessful result');
            return res.status(500).json({
                success: false,
                message: 'AI analizi başarısız oldu. Lütfen tekrar deneyin.'
            });
        }
        
        // Log recommendation summary
        console.log('✅ AI analysis successful');
        if (aiResult.data.recommendation_1) {
            console.log('📍 Rec 1:', aiResult.data.recommendation_1.university_name, '-', aiResult.data.recommendation_1.program_name);
        }
        if (aiResult.data.recommendation_2) {
            console.log('📍 Rec 2:', aiResult.data.recommendation_2.university_name, '-', aiResult.data.recommendation_2.program_name);
        }
        if (aiResult.data.is_fallback) {
            console.log('⚠️ Using fallback recommendation system (Gemini API may be unavailable)');
        }
        
        // Save to database
        const savedRecommendation = await saveRecommendation(userId, studentData, aiResult);
        
        console.log('✅ Recommendation saved with ID:', savedRecommendation.id);
        
        res.json({
            success: true,
            message: 'Analiz tamamlandı',
            data: {
                recommendation_id: savedRecommendation.id,
                ...aiResult.data
            }
        });
        
    } catch (error) {
        console.error('❌ Analysis error:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Analiz sırasında bir hata oluştu: ' + (error.message || 'Bilinmeyen hata')
        });
    }
});

/**
 * GET /wizard/my-recommendation - Get user's latest recommendation
 */
router.get('/my-recommendation', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const recommendation = await getUserRecommendation(userId);
        
        if (!recommendation) {
            return res.json({
                success: true,
                data: null,
                message: 'Henüz bir öneri bulunmuyor'
            });
        }
        
        res.json({
            success: true,
            data: recommendation
        });
        
    } catch (error) {
        console.error('Error fetching recommendation:', error);
        res.status(500).json({
            success: false,
            message: 'Sunucu hatası'
        });
    }
});

/**
 * GET /wizard/admin/recommendations - Get all recommendations (admin only)
 */
router.get('/admin/recommendations', isAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const recommendations = await getAllRecommendations(limit);
        
        res.json({
            success: true,
            data: recommendations
        });
        
    } catch (error) {
        console.error('Error fetching all recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Sunucu hatası'
        });
    }
});

/**
 * GET /wizard/admin/stats - Get recommendation statistics (admin only)
 */
router.get('/admin/stats', isAdmin, async (req, res) => {
    try {
        const stats = await getRecommendationStats();
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            message: 'Sunucu hatası'
        });
    }
});

/**
 * DELETE /wizard/my-recommendation - Delete user's recommendation (to retake)
 */
router.delete('/my-recommendation', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        
        await pool.query('DELETE FROM ai_recommendations WHERE user_id = $1', [userId]);
        
        res.json({
            success: true,
            message: 'Öneri silindi, yeniden değerlendirme yapabilirsiniz'
        });
        
    } catch (error) {
        console.error('Error deleting recommendation:', error);
        res.status(500).json({
            success: false,
            message: 'Sunucu hatası'
        });
    }
});

module.exports = router;

