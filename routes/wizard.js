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
            console.error('AI failed in submit route:', err.message);
            aiResult = await buildSmartFallback(studentData);
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
            console.error('Stack:', aiError.stack);
            
            // SMART FALLBACK: Use real university data from database
            aiResult = await buildSmartFallback(studentData);
        }
        
        // Ensure we always have a valid result
        if (!aiResult || !aiResult.success || !aiResult.data) {
            console.log('⚠️ AI result invalid, using smart fallback');
            aiResult = await buildSmartFallback(studentData);
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
        
        // SMART FALLBACK - Use real data from database
        const emergencyResult = await buildSmartFallback(studentData);
        res.json({
            success: true,
            message: 'Analiz tamamlandı',
            data: {
                recommendation_id: null,
                ...emergencyResult.data
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

/**
 * Build smart fallback recommendation using real university data from database
 */
async function buildSmartFallback(studentData) {
    try {
        const preferredCountries = studentData?.country_preferences || ['Czech Republic', 'Italy'];
        const educationLevel = studentData?.education_level || 'bachelor';
        const interests = studentData?.interests || [];
        
        // Query real universities from database, prioritizing preferred countries and partner universities
        const uniResult = await pool.query(`
            SELECT u.id, u.name, u.country, u.city, u.tuition_fee_min, u.tuition_fee_max, u.description, u.world_ranking, u.is_partner,
                   (SELECT json_agg(json_build_object('name_tr', d.name_tr, 'price', d.price, 'currency', d.currency))
                    FROM university_departments d WHERE d.university_id = u.id AND d.is_active = true LIMIT 5) as departments
            FROM universities u
            WHERE u.is_active = true
            ORDER BY 
                CASE WHEN u.country = ANY($1) THEN 0 ELSE 1 END,
                u.is_partner DESC,
                u.world_ranking ASC NULLS LAST,
                RANDOM()
            LIMIT 10
        `, [preferredCountries]);
        
        const universities = uniResult.rows;
        
        if (universities.length === 0) {
            console.error('❌ No universities found for smart fallback');
            return getHardcodedFallback(studentData);
        }
        
        // Pick best 2 universities from different countries if possible
        const uni1 = universities[0];
        const uni2 = universities.find(u => u.country !== uni1.country) || universities[1] || universities[0];
        
        const buildRecommendation = (uni) => {
            const deps = uni.departments || [];
            const firstDep = deps[0];
            const programName = firstDep?.name_tr || (educationLevel === 'master' ? 'Yüksek Lisans Programı' : 'Lisans Programı');
            const tuition = firstDep?.price ? `${firstDep.price} ${firstDep.currency || 'EUR'}` : 
                           (uni.tuition_fee_min ? `${uni.tuition_fee_min} EUR` : 'Fiyat değişken');
            
            const countryDescriptions = {
                'Czech Republic': 'Çek Cumhuriyeti, Avrupa\'nın kalbinde yer alan, uygun fiyatlı ve kaliteli eğitimiyle tanınan bir ülkedir. Yaşam maliyetleri Batı Avrupa\'ya kıyasla oldukça uygun olup, öğrencilere hem akademik hem de kültürel açıdan zengin bir deneyim sunar.',
                'Italy': 'İtalya, eğitim sistemi, kültürel zenginliği ve yaşam kalitesi ile öğrenciler için cazip bir ülkedir. İtalya\'da eğitim almak, öğrencilere uluslararası bir perspektif kazandırır ve iş fırsatlarını genişletir.',
                'Germany': 'Almanya, dünya standartlarında eğitim kalitesi ve güçlü ekonomisiyle öğrenciler için ideal bir destinasyondur. Birçok üniversitede düşük veya sıfır harç ücreti uygulanmaktadır.',
                'UK': 'İngiltere, dünyanın en prestijli üniversitelerine ev sahipliği yapmaktadır. İngilizce eğitim imkanı ve güçlü akademik gelenek, mezunlara küresel kariyer kapıları açar.',
                'Poland': 'Polonya, uygun maliyetli eğitim ve yaşam koşullarıyla Avrupa\'da öğrenci dostu bir ülkedir. AB üyeliği sayesinde mezunlara geniş kariyer fırsatları sunar.',
                'Austria': 'Avusturya, yüksek yaşam kalitesi ve güçlü akademik geleneğiyle tanınır. Almanca ve İngilizce program seçenekleri ile geniş bir eğitim yelpazesi sunar.',
                'Hungary': 'Macaristan, uygun fiyatlı eğitim ve yaşam maliyetleriyle Orta Avrupa\'da popüler bir öğrenci destinasyonudur.',
                'Netherlands': 'Hollanda, İngilizce eğitim programlarının yaygınlığı ve uluslararası ortamıyla öne çıkar.'
            };
            
            const cityDescriptions = {
                'Prague': 'Prag, tarihi dokusu, canlı öğrenci hayatı ve uygun yaşam maliyetleriyle Avrupa\'nın en popüler öğrenci şehirlerinden biridir. Şehir, zengin kültürel etkinlikler ve uluslararası bir atmosfer sunar.',
                'Milano': 'Milano, İtalya\'nın ekonomik ve moda başkenti olarak bilinir. Şehir, öğrenciler için birçok fırsat sunar ve yaşam maliyeti diğer Avrupa şehirlerine göre nispeten düşüktür.',
                'Bologna': 'Bologna, canlı öğrenci hayatı ve zengin tarihi mimarisiyle İtalya\'nın en öğrenci dostu şehirlerinden biridir.',
                'Rome': 'Roma, tarihi zenginlikleri ve kültürel yaşamıyla eşsiz bir öğrenci deneyimi sunar.',
                'Berlin': 'Berlin, dinamik kültür sahnesı, uygun yaşam maliyetleri ve uluslararası atmosferiyle öğrenciler için ideal bir şehirdir.',
                'Munich': 'Münih, güçlü ekonomisi ve yüksek yaşam kalitesiyle Almanya\'nın en cazip şehirlerinden biridir.',
                'London': 'Londra, dünyanın en kozmopolit şehirlerinden biri olarak sınırsız kariyer ve kültürel fırsatlar sunar.',
                'Vienna': 'Viyana, dünyanın en yaşanılabilir şehirlerinden biri olup, zengin kültürel mirası ve yüksek eğitim kalitesiyle öne çıkar.',
                'Warsaw': 'Varşova, hızla gelişen ekonomisi ve canlı öğrenci hayatıyla dikkat çeken bir Avrupa başkentidir.',
                'Budapest': 'Budapeşte, uygun yaşam maliyetleri ve zengin kültürel hayatıyla öğrenciler için cazip bir şehirdir.',
                'Coventry': 'Coventry, İngiltere\'nin merkezi konumunda yer alan, öğrenci dostu bir şehirdir.'
            };
            
            const countryInfo = countryDescriptions[uni.country] || `${uni.country}, uluslararası öğrencilere kaliteli eğitim fırsatları sunan bir ülkedir.`;
            const cityInfo = cityDescriptions[uni.city] || `${uni.city}, öğrenciler için zengin akademik ve kültürel deneyimler sunan bir şehirdir.`;
            
            const ranking = uni.world_ranking ? `, dünya sıralamasında ${uni.world_ranking}. sırada yer almaktadır` : '';
            const partnerNote = uni.is_partner ? ' Venture Global\'ın partner üniversitelerinden biri olması, başvuru sürecinde size özel avantajlar sağlar.' : '';
            
            return {
                university_name: uni.name,
                program_name: programName,
                country: uni.country,
                city: uni.city,
                tuition: tuition,
                why_this_university: `${uni.name}${ranking}. ${uni.description || 'Uluslararası öğrenciler için güçlü bir akademik ortam sunan köklü bir üniversitedir.'}${partnerNote}`,
                why_this_program: `${programName}, öğrencinin ilgi alanlarına ve kariyer hedeflerine uygun kapsamlı bir eğitim programıdır. Program, öğrencilere hem teorik bilgi hem de pratik beceriler kazandırmayı hedefler.`,
                country_info: countryInfo,
                city_info: cityInfo,
                career_prospects: `${uni.name} mezunları, ${uni.country} ve Avrupa genelinde geniş kariyer fırsatlarına sahiptir. Üniversitenin güçlü endüstri bağlantıları, staj ve iş bulma süreçlerinde önemli avantaj sağlar.`
            };
        };
        
        console.log(`✅ Smart fallback built with: ${uni1.name} (${uni1.country}) and ${uni2.name} (${uni2.country})`);
        
        return {
            success: true,
            data: {
                prep_school_needed: ['A1', 'A2', 'B1'].includes(studentData?.english_level),
                recommendation_1: buildRecommendation(uni1),
                recommendation_2: uni2.id !== uni1.id ? buildRecommendation(uni2) : null,
                is_fallback: true
            }
        };
    } catch (dbError) {
        console.error('❌ Smart fallback DB error:', dbError.message);
        return getHardcodedFallback(studentData);
    }
}

function getHardcodedFallback(studentData) {
    return {
        success: true,
        data: {
            prep_school_needed: ['A1', 'A2', 'B1'].includes(studentData?.english_level),
            recommendation_1: {
                university_name: 'Charles University (CUNI)',
                program_name: studentData?.education_level === 'master' ? 'Yüksek Lisans Programı' : 'Lisans Programı',
                country: 'Czech Republic',
                city: 'Prague',
                tuition: '5000 EUR',
                why_this_university: 'Charles University, 1348 yılında kurulan ve Orta Avrupa\'nın en eski üniversitesi olan köklü bir kurumdur. Dünya sıralamasında ilk 300 içinde yer alan üniversite, uluslararası öğrencilere İngilizce eğitim programları sunmaktadır.',
                why_this_program: 'Bu program, geniş bir müfredat yelpazesi ve güçlü akademik kadrosuyla öğrencilere kapsamlı bir eğitim deneyimi sunmaktadır.',
                country_info: 'Çek Cumhuriyeti, Avrupa\'nın kalbinde yer alan, uygun fiyatlı ve kaliteli eğitimiyle tanınan bir ülkedir. Yaşam maliyetleri Batı Avrupa\'ya kıyasla oldukça uygun olup, öğrencilere zengin bir kültürel deneyim sunar.',
                city_info: 'Prag, tarihi dokusu, canlı öğrenci hayatı ve uygun yaşam maliyetleriyle Avrupa\'nın en popüler öğrenci şehirlerinden biridir.',
                career_prospects: 'Mezuniyet sonrası Avrupa genelinde geniş kariyer fırsatları bulunmaktadır. Çek Cumhuriyeti\'nin güçlü ekonomisi ve AB üyeliği, mezunlara uluslararası kariyer kapıları açar.'
            },
            recommendation_2: {
                university_name: 'University of Bologna',
                program_name: studentData?.education_level === 'master' ? 'Yüksek Lisans Programı' : 'Lisans Programı',
                country: 'Italy',
                city: 'Bologna',
                tuition: '3000 EUR',
                why_this_university: 'University of Bologna, 1088 yılında kurulan dünyanın en eski üniversitesidir. Güçlü akademik geleneği ve uluslararası tanınırlığıyla öğrencilere üstün bir eğitim deneyimi sunar.',
                why_this_program: 'Program, kapsamlı müfredatı ve uygulama odaklı yaklaşımıyla öğrencileri iş dünyasına hazırlar.',
                country_info: 'İtalya, eğitim sistemi, kültürel zenginliği ve yaşam kalitesi ile öğrenciler için cazip bir ülkedir. Uygun eğitim ücretleri ve zengin burs imkanları mevcuttur.',
                city_info: 'Bologna, canlı öğrenci hayatı, leziz mutfağı ve zengin tarihi mimarisiyle İtalya\'nın en öğrenci dostu şehirlerinden biridir.',
                career_prospects: 'Bologna Üniversitesi mezunları, İtalya ve AB genelinde güçlü kariyer fırsatlarına sahiptir.'
            },
            is_fallback: true
        }
    };
}

module.exports = router;

