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
 * POST /wizard/submit - Submit wizard and save recommendation WITHOUT auth
 * Used for Google OAuth flow where user registers after completing wizard
 */
router.post('/submit', async (req, res) => {
    try {
        const studentData = req.body || {};
        console.log('📝 Saving wizard submission (no auth)');
        
        // Set defaults
        studentData.education_level = studentData.education_level || 'bachelor';
        studentData.english_level = studentData.english_level || 'B1';
        studentData.interests = studentData.interests || [];
        studentData.country_preferences = studentData.country_preferences || ['Czech Republic', 'Italy'];
        
        // Quick AI analysis
        let aiResult;
        try {
            aiResult = await analyzeStudentProfile(studentData);
        } catch (err) {
            console.log('AI failed, using fallback');
            aiResult = {
                success: true,
                data: {
                    prep_school_needed: ['A1', 'A2', 'B1'].includes(studentData.english_level),
                    recommendation_1: {
                        university_name: 'Charles University',
                        program_name: 'Lisans Programı',
                        country: studentData.country_preferences[0] || 'Czech Republic',
                        city: 'Prague',
                        tuition: '5000 EUR',
                        why_this_university: 'Avrupa\'nın en köklü üniversitelerinden biri.',
                        why_this_program: 'İlgi alanlarınıza uygun.',
                        country_info: 'Uygun fiyatlı eğitim.',
                        city_info: 'Öğrenci dostu şehir.',
                        career_prospects: 'Geniş kariyer fırsatları.'
                    },
                    recommendation_2: {
                        university_name: 'University of Bologna',
                        program_name: 'Lisans Programı',
                        country: studentData.country_preferences[1] || 'Italy',
                        city: 'Bologna',
                        tuition: '3000 EUR',
                        why_this_university: 'Dünyanın en eski üniversitesi.',
                        why_this_program: 'Kapsamlı programlar.',
                        country_info: 'Zengin kültür.',
                        city_info: 'Canlı öğrenci hayatı.',
                        career_prospects: 'AB fırsatları.'
                    }
                }
            };
        }
        
        // Full recommendation data for ai_reasoning column
        const hasCanadianDiploma = studentData.canadian_diploma === 'yes' || studentData.has_canadian_diploma === true;
        const fullRecommendationData = JSON.stringify({
            recommendation_1: aiResult.data.recommendation_1,
            recommendation_2: aiResult.data.recommendation_2,
            prep_school_needed: aiResult.data.prep_school_needed,
            prep_school_suggestion: aiResult.data.prep_school_suggestion,
            has_canadian_diploma: hasCanadianDiploma,
            wcep_advantage_summary: hasCanadianDiploma ? 
                'Tebrikler! 🍁 WCEP ortaklığımız kapsamında aldığınız Kanada lise diploması, Avrupa üniversitelerinde size büyük avantajlar sağlıyor.' : null,
            comparison: aiResult.data.comparison || 'Her iki üniversite de profilinize uygun seçeneklerdir.',
            overall_advice: aiResult.data.overall_advice || 'Venture Global danışmanlarınız detaylı bilgi için size yardımcı olacaktır.'
        });
        
        // Save recommendation WITHOUT user_id (will be linked later via Google OAuth)
        const saveResult = await pool.query(`
            INSERT INTO ai_recommendations (
                user_id,
                education_level,
                english_level,
                english_exam_type,
                english_exam_score,
                interests,
                country_preferences,
                budget_range,
                prep_school_needed,
                recommended_country,
                recommended_city,
                recommended_tuition,
                ai_reasoning
            ) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
        `, [
            studentData.education_level,
            studentData.english_level,
            studentData.english_exam_type || null,
            studentData.english_exam_score || null,
            studentData.interests,
            studentData.country_preferences,
            studentData.budget_range || null,
            aiResult.data.prep_school_needed || false,
            aiResult.data.recommendation_1?.country || 'Czech Republic',
            aiResult.data.recommendation_1?.city || 'Prague',
            aiResult.data.recommendation_1?.tuition || '5000 EUR',
            fullRecommendationData
        ]);
        
        const recommendationId = saveResult.rows[0].id;
        console.log('✅ Saved recommendation:', recommendationId);
        
        res.json({
            success: true,
            recommendation_id: recommendationId,
            id: recommendationId,
            data: aiResult.data
        });
        
    } catch (error) {
        console.error('Submit error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /wizard/analyze - Analyze student profile (requires auth)
 * ASLA HATA VERMEZ - Her durumda öneri döner
 */
router.post('/analyze', isAuthenticated, async (req, res) => {
    const userId = req.user?.id;
    let studentData = {};
    
    try {
        studentData = req.body || {};
        
        console.log('📊 Analyzing student profile for user:', userId);
        console.log('📋 Education level:', studentData.education_level);
        console.log('📋 English level:', studentData.english_level);
        console.log('📋 English exam:', studentData.english_exam_type, studentData.english_exam_score);
        console.log('📋 Interests:', studentData.interests?.join(', ') || 'None');
        console.log('📋 Country preferences:', studentData.country_preferences?.join(', ') || 'None');
        
        // Validate required fields - set defaults if missing
        if (!studentData.education_level) {
            studentData.education_level = 'bachelor';
            console.log('⚠️ education_level missing, defaulting to bachelor');
        }
        if (!studentData.english_level) {
            studentData.english_level = 'B1';
            console.log('⚠️ english_level missing, defaulting to B1');
        }
        
        // Ensure arrays exist
        studentData.interests = studentData.interests || [];
        studentData.country_preferences = studentData.country_preferences || ['Czech Republic', 'Italy'];
        
        // Analyze with AI (always returns result, never throws)
        console.log('🤖 Starting AI analysis...');
        let aiResult;
        try {
            aiResult = await analyzeStudentProfile(studentData);
        } catch (aiError) {
            console.error('❌ AI analysis threw error:', aiError.message);
            // Manual fallback if analyzeStudentProfile somehow fails
            aiResult = {
                success: true,
                data: {
                    prep_school_needed: ['A1', 'A2', 'B1'].includes(studentData.english_level),
                    recommendation_1: {
                        university_name: 'Charles University (CUNI)',
                        program_name: studentData.education_level === 'master' ? 'Yüksek Lisans Programı' : 'Lisans Programı',
                        country: studentData.country_preferences[0] || 'Czech Republic',
                        city: 'Prague',
                        tuition: '5000 EUR',
                        why_this_university: 'Avrupa\'nın en köklü üniversitelerinden biri.',
                        why_this_program: 'İlgi alanlarınıza uygun bir program.',
                        country_info: 'Kaliteli ve uygun fiyatlı eğitim imkanı.',
                        city_info: 'Öğrenci dostu bir şehir.',
                        career_prospects: 'Geniş kariyer fırsatları.'
                    },
                    recommendation_2: {
                        university_name: 'University of Bologna',
                        program_name: studentData.education_level === 'master' ? 'Yüksek Lisans Programı' : 'Lisans Programı',
                        country: studentData.country_preferences[1] || 'Italy',
                        city: 'Bologna',
                        tuition: '3000 EUR',
                        why_this_university: 'Dünyanın en eski üniversitesi.',
                        why_this_program: 'Kapsamlı eğitim programları.',
                        country_info: 'Zengin kültür ve uygun maliyetler.',
                        city_info: 'Canlı öğrenci hayatı.',
                        career_prospects: 'AB genelinde fırsatlar.'
                    },
                    is_fallback: true
                }
            };
        }
        
        // Ensure we always have a valid result
        if (!aiResult || !aiResult.success || !aiResult.data) {
            console.log('⚠️ AI result invalid, using emergency fallback');
            aiResult = {
                success: true,
                data: {
                    prep_school_needed: false,
                    recommendation_1: {
                        university_name: 'Charles University (CUNI)',
                        program_name: 'Lisans Programı',
                        country: 'Czech Republic',
                        city: 'Prague',
                        tuition: '5000 EUR',
                        why_this_university: 'Köklü ve prestijli bir üniversite.',
                        why_this_program: 'Geniş program yelpazesi.',
                        country_info: 'Uygun fiyatlı eğitim.',
                        city_info: 'Güzel ve tarihi şehir.',
                        career_prospects: 'İyi kariyer imkanları.'
                    },
                    is_fallback: true
                }
            };
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
            console.log('⚠️ Using fallback recommendation system');
        }
        
        // Save to database - with error handling
        let savedRecommendation = { id: null };
        try {
            savedRecommendation = await saveRecommendation(userId, studentData, aiResult);
            console.log('✅ Recommendation saved with ID:', savedRecommendation.id);
        } catch (saveError) {
            console.error('⚠️ Failed to save recommendation:', saveError.message);
            // Continue anyway - user still gets their result
        }
        
        res.json({
            success: true,
            message: 'Analiz tamamlandı',
            data: {
                recommendation_id: savedRecommendation?.id || null,
                ...aiResult.data
            }
        });
        
    } catch (error) {
        // EN DIŞ CATCH - Bu noktaya hiç gelinmemeli ama güvenlik için
        console.error('❌ CRITICAL: Outer catch triggered:', error.message);
        console.error('Stack:', error.stack);
        
        // Yine de bir sonuç dön - ASLA HATA GÖSTERİLMEZ
        res.json({
            success: true,
            message: 'Analiz tamamlandı',
            data: {
                recommendation_id: null,
                prep_school_needed: false,
                recommendation_1: {
                    university_name: 'Charles University (CUNI)',
                    program_name: studentData?.education_level === 'master' ? 'Yüksek Lisans Programı' : 'Lisans Programı',
                    country: 'Czech Republic',
                    city: 'Prague',
                    tuition: '5000 EUR',
                    why_this_university: 'Avrupa\'nın en köklü üniversitelerinden biri olan Charles University, uluslararası öğrenciler için mükemmel bir seçimdir.',
                    why_this_program: 'Bu program, ilgi alanlarınıza uygun kapsamlı bir eğitim sunmaktadır.',
                    country_info: 'Çek Cumhuriyeti, Avrupa\'nın kalbinde uygun fiyatlı ve kaliteli eğitim sunan bir ülkedir.',
                    city_info: 'Prag, öğrenci dostu yaşam maliyetleri ve zengin kültürel hayatıyla öne çıkar.',
                    career_prospects: 'Mezuniyet sonrası Avrupa genelinde geniş kariyer fırsatları bulunmaktadır.'
                },
                recommendation_2: {
                    university_name: 'University of Bologna',
                    program_name: studentData?.education_level === 'master' ? 'Yüksek Lisans Programı' : 'Lisans Programı',
                    country: 'Italy',
                    city: 'Bologna',
                    tuition: '3000 EUR',
                    why_this_university: 'Dünyanın en eski üniversitesi.',
                    why_this_program: 'Kapsamlı eğitim programları.',
                    country_info: 'Zengin kültür ve uygun eğitim maliyetleri.',
                    city_info: 'Canlı öğrenci hayatı.',
                    career_prospects: 'AB genelinde kariyer fırsatları.'
                },
                is_fallback: true
            }
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

