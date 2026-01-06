// AI Service for Student Wizard - Groq (Primary) + Gemini (Fallback)
// Bu servis Venture Global partner üniversiteleri ve bölümleri kullanarak AI tabanlı öneriler üretir
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// API Endpoints
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

/**
 * Analyze student profile and generate university recommendation
 * Uses Groq (primary) -> Gemini (fallback) -> Rule-based (last resort)
 */
async function analyzeStudentProfile(studentData) {
    // Get universities and departments from database FIRST (needed for both AI and fallback)
    let universities = [];
    try {
        universities = await getUniversitiesWithDepartments();
        console.log(`📊 Found ${universities.length} universities with departments for analysis`);
    } catch (dbError) {
        console.error('Database error:', dbError.message);
    }
    
    if (universities.length === 0) {
        console.warn('⚠️ No universities found, using fallback with defaults');
        return generateFallbackRecommendation(studentData, []);
    }
    
    try {
        const prepSchools = await getPrepSchools();
        
        // Build the prompt
        const prompt = buildAnalysisPrompt(studentData, universities, prepSchools);
        
        // Try AI APIs: Groq first, then Gemini
        let response = null;
        
        // Try Groq API first (faster and more reliable)
        try {
            response = await callGroqAPI(prompt);
            if (response) {
                console.log('✅ AI response from Groq');
            }
        } catch (groqError) {
            console.warn('⚠️ Groq API failed:', groqError.message);
        }
        
        // If Groq fails, try Gemini
        if (!response) {
            try {
                response = await callGeminiAPI(prompt);
                if (response) {
                    console.log('✅ AI response from Gemini');
                }
            } catch (geminiError) {
                console.warn('⚠️ Gemini API failed:', geminiError.message);
            }
        }
        
        if (!response) {
            console.warn('⚠️ All AI APIs failed, using intelligent fallback');
            return generateFallbackRecommendation(studentData, universities);
        }
        
        // Parse and return the response
        return parseAIResponse(response, studentData, universities);
        
    } catch (error) {
        console.error('AI analysis error:', error);
        // Fallback to rule-based recommendation WITH REAL UNIVERSITY DATA
        return generateFallbackRecommendation(studentData, universities);
    }
}

/**
 * Get universities with their departments from database (using university_departments table)
 */
async function getUniversitiesWithDepartments() {
    try {
        const result = await pool.query(`
            SELECT 
                u.id,
                u.name,
                u.country,
                u.city,
                u.tuition_fee_min,
                u.tuition_fee_max,
                u.description,
                u.world_ranking,
                u.is_partner,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', d.id,
                            'name_tr', d.name_tr,
                            'name_en', d.name_en,
                            'price', d.price,
                            'currency', d.currency,
                            'program_type', CASE 
                                WHEN d.name_tr LIKE '%Yüksek Lisans%' OR d.name_tr LIKE '%Master%' THEN 'master'
                                WHEN d.name_tr LIKE '%Lisans%' OR d.name_tr LIKE '%Bachelor%' THEN 'bachelor'
                                WHEN d.name_tr LIKE '%Hazırlık%' OR d.name_tr LIKE '%Prep%' OR d.name_tr LIKE '%Foundation%' THEN 'prep'
                                ELSE 'other'
                            END
                        )
                    ) FILTER (WHERE d.id IS NOT NULL AND d.is_active = true),
                    '[]'
                ) as departments
            FROM universities u
            LEFT JOIN university_departments d ON u.id = d.university_id
            WHERE u.is_active = true
            GROUP BY u.id
            ORDER BY u.is_partner DESC, u.world_ranking ASC NULLS LAST, u.name
        `);
        
        // Filter departments by education level for each university
        return result.rows.map(uni => ({
            ...uni,
            bachelor_programs: uni.departments.filter(d => d.program_type === 'bachelor'),
            master_programs: uni.departments.filter(d => d.program_type === 'master'),
            prep_programs: uni.departments.filter(d => d.program_type === 'prep'),
            total_programs: uni.departments.length
        }));
    } catch (error) {
        console.error('Error fetching universities with departments:', error);
        return [];
    }
}

/**
 * Get prep schools from database
 */
async function getPrepSchools() {
    try {
        const result = await pool.query(`
            SELECT DISTINCT ON (name) * FROM prep_schools WHERE is_active = true ORDER BY name, country
        `);
        return result.rows;
    } catch (error) {
        console.error('Error fetching prep schools:', error);
        return getDefaultPrepSchools();
    }
}

/**
 * Default prep schools if database query fails
 */
function getDefaultPrepSchools() {
    return [
        { name: 'Universita per Stranieri di Perugia', country: 'Italy', city: 'Perugia', prep_type: 'language', estimated_cost: '3.000-5.000 EUR' },
        { name: 'Politecnico Milano Foundation Year', country: 'Italy', city: 'Milan', prep_type: 'academic', estimated_cost: '8.000-12.000 EUR' },
        { name: 'Charles University Language Center', country: 'Czech Republic', city: 'Prague', prep_type: 'language', estimated_cost: '4.000-6.000 EUR' },
        { name: 'Studienkolleg', country: 'Germany', city: 'Various', prep_type: 'academic', estimated_cost: '0-500 EUR' },
        { name: 'Goethe Institut', country: 'Germany', city: 'Various', prep_type: 'language', estimated_cost: '3.000-6.000 EUR' },
        { name: 'Kaplan International Pathways', country: 'UK', city: 'Various', prep_type: 'both', estimated_cost: '15.000-20.000 GBP' }
    ];
}

/**
 * Build the analysis prompt for Gemini with REAL partner data
 */
function buildAnalysisPrompt(studentData, universities, prepSchools) {
    const countryNames = {
        'Germany': 'Almanya',
        'Czech Republic': 'Çek Cumhuriyeti',
        'Italy': 'İtalya',
        'Austria': 'Avusturya',
        'UK': 'İngiltere',
        'Poland': 'Polonya',
        'Hungary': 'Macaristan'
    };

    const educationLevel = studentData.education_level === 'bachelor' ? 'Lisans' : 'Yüksek Lisans';
    const programFilter = studentData.education_level === 'bachelor' ? 'bachelor' : 'master';
    
    // Build student profile section
    let studentProfile = `
## ÖĞRENCİ PROFİLİ

**Hedef Eğitim Seviyesi:** ${educationLevel}
**İngilizce Seviyesi:** ${studentData.english_level}
**İngilizce Sınav:** ${studentData.english_exam_type || 'Henüz yok'} ${studentData.english_exam_score ? `(${studentData.english_exam_score} puan)` : ''}
`;

    if (studentData.education_level === 'bachelor') {
        studentProfile += `
**Lise Not Ortalaması:** ${studentData.high_school_gpa}/100
**Matematik Seviyesi:** ${getMathLevelText(studentData.math_level)}
**Lise Aktiviteleri:** ${studentData.high_school_activities?.join(', ') || 'Belirtilmedi'}
`;
    } else {
        studentProfile += `
**Lisans Bölümü:** ${studentData.bachelor_field || 'Belirtilmedi'}
**Lisans Notu (GPA):** ${studentData.bachelor_gpa || 'Belirtilmedi'}/4.0
**Üniversite Türü:** ${studentData.bachelor_university_type || 'Belirtilmedi'}
**İş Deneyimi:** ${studentData.work_experience || 'Belirtilmedi'}
**Lisans Aktiviteleri:** ${studentData.bachelor_activities?.join(', ') || 'Belirtilmedi'}
`;
    }

    studentProfile += `
**İlgi Alanları:** ${studentData.interests?.join(', ') || 'Belirtilmedi'}
**Ülke Tercihleri (Sıralı):** ${studentData.country_preferences?.map((c, i) => `${i+1}. ${countryNames[c] || c}`).join(', ') || 'Belirtilmedi'}
**Bütçe Aralığı:** ${studentData.budget_range}
**Ek Notlar:** ${studentData.additional_notes || 'Yok'}
`;

    // Build universities and programs section - ONLY include relevant programs based on education level
    const preferredCountries = studentData.country_preferences || [];
    
    // Sort universities by preference
    const sortedUniversities = [...universities].sort((a, b) => {
        const aPreference = preferredCountries.indexOf(a.country);
        const bPreference = preferredCountries.indexOf(b.country);
        if (aPreference !== -1 && bPreference === -1) return -1;
        if (aPreference === -1 && bPreference !== -1) return 1;
        if (aPreference !== -1 && bPreference !== -1) return aPreference - bPreference;
        return 0;
    });
    
    // Format universities with their programs
    let universitiesSection = `\n## VENTURE GLOBAL PARTNER ÜNİVERSİTELERİ VE ${educationLevel.toUpperCase()} PROGRAMLARI\n\n`;
    universitiesSection += `Aşağıdaki üniversiteler Venture Global'ın resmi partnerleridir. SADECE bu listeden öneri yapmalısın.\n\n`;
    
    let uniCount = 0;
    for (const uni of sortedUniversities) {
        const programs = programFilter === 'bachelor' ? uni.bachelor_programs : uni.master_programs;
        
        if (programs.length === 0) continue;
        
        universitiesSection += `### ${uni.name} (${uni.country}, ${uni.city})\n`;
        if (uni.world_ranking) universitiesSection += `Dünya Sıralaması: ${uni.world_ranking}\n`;
        universitiesSection += `${educationLevel} Programları:\n`;
        
        programs.slice(0, 15).forEach(prog => {
            const price = prog.price ? `${prog.price} EUR` : 'Fiyat değişken';
            universitiesSection += `- ${prog.name_tr} (${price})\n`;
        });
        
        if (programs.length > 15) {
            universitiesSection += `... ve ${programs.length - 15} program daha\n`;
        }
        
        universitiesSection += '\n';
        uniCount++;
        
        if (uniCount >= 20) break; // Limit to 20 universities to keep prompt manageable
    }

    // Prep schools section
    let prepSchoolsSection = `\n## HAZIRLIK OKULLARI\n\n`;
    prepSchools.forEach(prep => {
        prepSchoolsSection += `- ${prep.name} (${prep.country}${prep.city ? ', ' + prep.city : ''}) - ${prep.prep_type} - ${prep.estimated_cost || 'Fiyat değişken'}\n`;
    });

    return `Sen Venture Global için çalışan deneyimli bir eğitim danışmanısın. Aşağıdaki öğrenci profiline göre en uygun üniversite ve program önerisi yapacaksın.

ÖNEMLİ: Sadece verilen PARTNER ÜNİVERSİTELERİ listesinden öneri yapmalısın. Listede olmayan üniversite önerme!

${studentProfile}

${universitiesSection}

${prepSchoolsSection}

## HAZIRLIK GEREKSİNİM KRİTERLERİ
- İngilizce A1-A2: Kesinlikle dil hazırlığı gerekli
- İngilizce B1: Muhtemelen dil hazırlığı gerekli (üniversite gereksinimlerine bağlı)
- İngilizce B2+ ve sınav skoru yok: Belki gerekli, sınav gerekebilir
- IELTS < 5.5 veya TOEFL < 70: Dil hazırlığı gerekli
- Lise notu < 60/100: Akademik hazırlık (Foundation) önerilir

## GÖREV
Öğrenciye partner listesindeki üniversitelerden İKİ farklı öneri sun. Her öneri için detaylı ve kapsamlı bilgi ver.

SADECE aşağıdaki JSON formatında yanıt ver, başka açıklama ekleme:

{
    "prep_school_needed": true/false,
    "prep_school_type": "language" | "academic" | "both" | null,
    "prep_school_name": "Hazırlık okulu adı veya null",
    "prep_school_reason": "Neden hazırlık gerekli/gerekli değil - en az 2 cümle detaylı açıklama",
    
    "recommendation_1": {
        "university_name": "Birinci öneri üniversite adı (PARTNER LİSTESİNDEN)",
        "program_name": "Önerilen bölüm/program adı (LİSTEDEN)",
        "country": "Ülke adı (İngilizce - Germany, Italy, Czech Republic vb.)",
        "city": "Şehir adı",
        "tuition": "Yıllık ücret (EUR cinsinden, programdan al)",
        "why_this_university": "Bu üniversitenin neden önerildiğine dair EN AZ 4-5 cümlelik detaylı açıklama. Üniversitenin güçlü yönleri, akademik kalitesi, öğrenciye uygunluğu.",
        "why_this_program": "Bu programın/bölümün neden uygun olduğuna dair EN AZ 3-4 cümlelik açıklama. Öğrencinin ilgi alanlarıyla eşleşme.",
        "country_info": "Bu ülkede eğitim almanın avantajları hakkında EN AZ 4-5 cümlelik kapsamlı bilgi. Eğitim sistemi, dil, vize süreci, çalışma izni.",
        "city_info": "Şehir hakkında EN AZ 4-5 cümlelik detaylı bilgi. Yaşam maliyeti (kira, yemek, ulaşım yaklaşık fiyatları), öğrenci hayatı, iklim.",
        "career_prospects": "Mezuniyet sonrası kariyer fırsatları hakkında EN AZ 3-4 cümlelik bilgi."
    },
    
    "recommendation_2": {
        "university_name": "İkinci öneri üniversite adı (FARKLI BİR ÜNİVERSİTE - PARTNER LİSTESİNDEN)",
        "program_name": "Önerilen bölüm/program adı (LİSTEDEN)",
        "country": "Ülke adı (İngilizce)",
        "city": "Şehir adı",
        "tuition": "Yıllık ücret",
        "why_this_university": "Bu üniversitenin neden alternatif olarak önerildiğine dair EN AZ 4-5 cümlelik detaylı açıklama.",
        "why_this_program": "Bu programın neden uygun olduğuna dair EN AZ 3-4 cümlelik açıklama.",
        "country_info": "Bu ülkede eğitim almanın avantajları hakkında EN AZ 4-5 cümlelik kapsamlı bilgi.",
        "city_info": "Şehir hakkında EN AZ 4-5 cümlelik detaylı bilgi.",
        "career_prospects": "Mezuniyet sonrası kariyer fırsatları hakkında EN AZ 3-4 cümlelik bilgi."
    },
    
    "comparison": "İki öneri arasındaki farkları ve hangisinin hangi durumda daha uygun olacağını açıklayan EN AZ 3-4 cümlelik karşılaştırma.",
    
    "overall_advice": "Öğrenciye genel tavsiyeler - EN AZ 3-4 cümle. Başvuru süreci, hazırlık önerileri, dikkat edilmesi gerekenler."
}

KURALLAR:
1. SADECE JSON formatında yanıt ver
2. İki öneri FARKLI üniversitelerden olsun
3. Mümkünse öğrencinin tercih ettiği ülkelerden öner
4. Tüm açıklamalar Türkçe olsun
5. Fiyatlar listeden alınsın ve EUR cinsinden olsun
6. İlgi alanlarına uygun programlar öner`;
}

/**
 * Get math level text
 */
function getMathLevelText(level) {
    const levels = {
        1: 'Zorlanıyorum',
        2: 'İdare eder',
        3: 'Seviyorum, başarılıyım',
        4: 'Çok iyi, yarışmalara katıldım'
    };
    return levels[level] || 'Belirtilmedi';
}

/**
 * Call Groq API (Primary AI - Fast and Free)
 * Model: llama-3.3-70b-versatile (very capable)
 */
async function callGroqAPI(prompt) {
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
        console.log('ℹ️ GROQ_API_KEY not configured, skipping Groq');
        throw new Error('GROQ_API_KEY is not configured');
    }

    console.log('🤖 Calling Groq API (Llama 3.3 70B)...');

    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: 'Sen Venture Global için çalışan deneyimli bir eğitim danışmanısın. Türk öğrencilere yurt dışı eğitim konusunda yardımcı oluyorsun. Yanıtlarını her zaman Türkçe ver ve SADECE JSON formatında yanıt ver.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 4096,
                top_p: 0.95
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Groq API error:', response.status, errorData);
            throw new Error(`Groq API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content || null;
        
        if (!responseText) {
            console.error('❌ Empty response from Groq');
            return null;
        }
        
        console.log('✅ Groq API response received (' + responseText.length + ' chars)');
        return responseText;
    } catch (error) {
        console.error('❌ Groq API call failed:', error.message);
        throw error;
    }
}

/**
 * Call Gemini API (Fallback AI)
 */
async function callGeminiAPI(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        console.log('ℹ️ GEMINI_API_KEY not configured, skipping Gemini');
        throw new Error('GEMINI_API_KEY is not configured');
    }

    console.log('🤖 Calling Gemini API (fallback)...');

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 4096
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Gemini API error:', response.status);
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        
        if (!responseText) {
            console.error('❌ Empty response from Gemini');
            return null;
        }
        
        console.log('✅ Gemini API response received');
        return responseText;
    } catch (error) {
        console.error('❌ Gemini API call failed:', error.message);
        throw error;
    }
}

/**
 * Parse AI response (works for both Groq and Gemini)
 */
function parseAIResponse(responseText, studentData, universities) {
    try {
        // Extract JSON from response
        let jsonStr = responseText;
        
        // Try to find JSON in the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }
        
        const parsed = JSON.parse(jsonStr);
        
        console.log('✅ Successfully parsed AI response');
        
        // New format with two recommendations
        return {
            success: true,
            data: {
                prep_school_needed: parsed.prep_school_needed || false,
                prep_school_type: parsed.prep_school_type || null,
                prep_school_suggestion: parsed.prep_school_name ? 
                    `${parsed.prep_school_name}: ${parsed.prep_school_reason}` : 
                    (parsed.prep_school_reason || null),
                
                // First recommendation (primary)
                recommendation_1: parsed.recommendation_1 || {
                    university_name: parsed.recommended_university_name,
                    program_name: parsed.recommended_program_name,
                    country: parsed.recommended_country,
                    city: parsed.recommended_city,
                    tuition: parsed.estimated_tuition,
                    why_this_university: parsed.reasoning,
                    why_this_program: '',
                    country_info: '',
                    city_info: parsed.city_info,
                    career_prospects: parsed.career_prospects
                },
                
                // Second recommendation (alternative)
                recommendation_2: parsed.recommendation_2 || null,
                
                // Comparison and advice
                comparison: parsed.comparison || '',
                overall_advice: parsed.overall_advice || '',
                
                // Legacy fields for backwards compatibility
                recommended_university_name: parsed.recommendation_1?.university_name || parsed.recommended_university_name,
                recommended_program_name: parsed.recommendation_1?.program_name || parsed.recommended_program_name,
                recommended_country: parsed.recommendation_1?.country || parsed.recommended_country,
                recommended_city: parsed.recommendation_1?.city || parsed.recommended_city,
                recommended_tuition: parsed.recommendation_1?.tuition || parsed.estimated_tuition,
                ai_reasoning: parsed.recommendation_1?.why_this_university || parsed.reasoning
            }
        };
    } catch (error) {
        console.error('❌ Error parsing AI response:', error.message);
        console.log('Raw response (first 500 chars):', responseText?.substring(0, 500));
        return generateFallbackRecommendation(studentData, universities);
    }
}

/**
 * Generate fallback recommendation when AI fails - using REAL university data
 */
function generateFallbackRecommendation(studentData, universities = []) {
    console.log('⚠️ Using fallback recommendation system');
    
    // Determine if prep is needed
    const englishLevel = studentData.english_level;
    const needsPrep = ['A1', 'A2', 'B1'].includes(englishLevel);
    const needsAcademicPrep = studentData.high_school_gpa && studentData.high_school_gpa < 60;
    
    // Get preferred countries
    const preferredCountries = studentData.country_preferences || ['Czech Republic', 'Italy'];
    const programFilter = studentData.education_level === 'bachelor' ? 'bachelor' : 'master';
    
    // Find suitable universities from real data
    let primaryUni = null;
    let secondaryUni = null;
    let primaryProgram = null;
    let secondaryProgram = null;
    
    // Match interest to program names - PRIMARY/SECONDARY KEYWORD SYSTEM
    // Primary keywords get higher priority (score 10), secondary keywords get lower (score 5)
    const interestKeywords = {
        'engineering': {
            primary: ['Mühendislik', 'Engineering', 'Mechanical', 'Civil', 'Electrical'],
            secondary: ['Elektrik', 'Makine', 'İnşaat', 'Mekatronik', 'Otomotiv', 'Havacılık', 'Aerospace', 'Enerji', 'Energy']
        },
        'business': {
            primary: ['İşletme', 'Business', 'MBA', 'Management', 'Yönetim'],
            secondary: ['Ekonomi', 'Economics', 'Finance', 'Finans', 'Pazarlama', 'Marketing', 'Muhasebe', 'Accounting', 'Girişimcilik', 'Entrepreneurship']
        },
        'medicine': {
            primary: ['Tıp', 'Medicine', 'Medical', 'Cerrahi', 'Surgery'],
            secondary: ['Diş', 'Dental', 'Dentistry', 'Eczacı', 'Pharmacy', 'Sağlık', 'Health', 'Hemşirelik', 'Nursing', 'Veteriner', 'Veterinary']
        },
        'computer_science': {
            primary: ['Bilgisayar', 'Computer', 'Yazılım', 'Software', 'Bilişim', 'Informatics'],
            secondary: ['AI', 'Yapay Zeka', 'Data', 'Veri', 'Siber', 'Cyber', 'Programming', 'Algoritma']
        },
        'architecture': {
            primary: ['Mimarlık', 'Architecture', 'Architectural'],
            secondary: ['İç Mimarlık', 'Interior', 'Şehir', 'Urban', 'Planlama', 'Planning', 'Peyzaj', 'Landscape', 'Tasarım', 'Design']
        },
        'law': {
            primary: ['Hukuk', 'Law', 'Legal'],
            secondary: ['Adalet', 'Justice', 'Kriminoloji', 'Criminology', 'Uluslararası Hukuk', 'International Law']
        },
        'natural_sciences': {
            primary: ['Fizik', 'Physics', 'Kimya', 'Chemistry', 'Biyoloji', 'Biology'],
            secondary: ['Matematik', 'Mathematics', 'Astronomi', 'Astronomy', 'Jeoloji', 'Geology', 'Çevre', 'Environment']
        },
        'social_sciences': {
            primary: ['Psikoloji', 'Psychology', 'Sosyoloji', 'Sociology'],
            secondary: ['Antropoloji', 'Anthropology', 'İletişim', 'Communication', 'Gazetecilik', 'Journalism', 'Siyaset', 'Political', 'Uluslararası İlişkiler', 'International Relations']
        },
        'arts': {
            primary: ['Sanat', 'Art', 'Müzik', 'Music'],
            secondary: ['Görsel', 'Visual', 'Tiyatro', 'Theatre', 'Sinema', 'Film', 'Grafik', 'Graphic', 'Moda', 'Fashion']
        },
        'media': {
            primary: ['Medya', 'Media', 'Gazetecilik', 'Journalism'],
            secondary: ['İletişim', 'Communication', 'Dijital', 'Digital', 'Reklamcılık', 'Advertising', 'Halkla İlişkiler', 'Public Relations']
        }
    };
    
    const interests = studentData.interests || ['engineering'];
    
    // Get primary and secondary keywords separately
    const primaryKeywords = interests.flatMap(i => interestKeywords[i]?.primary || []);
    const secondaryKeywords = interests.flatMap(i => interestKeywords[i]?.secondary || []);
    
    // Score function for program matching
    const getMatchScore = (program) => {
        const name = ((program.name_tr || '') + ' ' + (program.name_en || '')).toLowerCase();
        let score = 0;
        
        // Primary keyword match = 10 points
        for (const kw of primaryKeywords) {
            if (name.includes(kw.toLowerCase())) {
                score += 10;
            }
        }
        
        // Secondary keyword match = 5 points
        for (const kw of secondaryKeywords) {
            if (name.includes(kw.toLowerCase())) {
                score += 5;
            }
        }
        
        return score;
    };
    
    // Filter universities by preferred countries
    const filteredUnis = universities.length > 0 
        ? universities.filter(u => {
            const programs = programFilter === 'bachelor' ? u.bachelor_programs : u.master_programs;
            return programs && programs.length > 0;
        }).sort((a, b) => {
            const aIdx = preferredCountries.indexOf(a.country);
            const bIdx = preferredCountries.indexOf(b.country);
            if (aIdx >= 0 && bIdx < 0) return -1;
            if (aIdx < 0 && bIdx >= 0) return 1;
            if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
            return (a.world_ranking || 9999) - (b.world_ranking || 9999);
        })
        : [];
    
    // Find matching programs - SCORE-BASED SYSTEM
    // First pass: Find best matching programs based on score
    let allCandidates = [];
    
    for (const uni of filteredUnis) {
        const programs = programFilter === 'bachelor' ? uni.bachelor_programs : uni.master_programs;
        
        for (const program of programs) {
            const score = getMatchScore(program);
            if (score > 0) {
                allCandidates.push({ uni, program, score });
            }
        }
    }
    
    // Sort by score (highest first), then by country preference
    allCandidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aIdx = preferredCountries.indexOf(a.uni.country);
        const bIdx = preferredCountries.indexOf(b.uni.country);
        if (aIdx >= 0 && bIdx < 0) return -1;
        if (aIdx < 0 && bIdx >= 0) return 1;
        return 0;
    });
    
    // Pick top 2 from different universities
    for (const candidate of allCandidates) {
        if (!primaryUni) {
            primaryUni = candidate.uni;
            primaryProgram = candidate.program;
        } else if (!secondaryUni && candidate.uni.id !== primaryUni.id) {
            secondaryUni = candidate.uni;
            secondaryProgram = candidate.program;
            break;
        }
    }
    
    // Second pass: If no match found, pick any program from preferred country universities
    if (!primaryUni || !secondaryUni) {
        for (const uni of filteredUnis) {
            const programs = programFilter === 'bachelor' ? uni.bachelor_programs : uni.master_programs;
            if (programs.length === 0) continue;
            
            // Skip if this university was already selected
            if (primaryUni && uni.id === primaryUni.id) continue;
            if (secondaryUni && uni.id === secondaryUni.id) continue;
            
            const firstProgram = programs[0];
            
            if (!primaryUni) {
                primaryUni = uni;
                primaryProgram = firstProgram;
            } else if (!secondaryUni) {
                secondaryUni = uni;
                secondaryProgram = firstProgram;
                break;
            }
        }
    }
    
    // Default fallback data if database is empty
    const defaultData = {
        primary: {
            university: 'Charles University (CUNI)',
            program: studentData.education_level === 'bachelor' ? 'Bilgisayar Bilimleri (Lisans)' : 'Bilgisayar Bilimleri (Yüksek Lisans)',
            country: 'Czech Republic',
            city: 'Prague',
            tuition: '5000 EUR'
        },
        secondary: {
            university: 'University of Bologna',
            program: studentData.education_level === 'bachelor' ? 'Mühendislik (Lisans)' : 'Mühendislik (Yüksek Lisans)',
            country: 'Italy',
            city: 'Bologna',
            tuition: '3000 EUR'
        }
    };
    
    // Use database data or defaults
    const uni1Name = primaryUni?.name || defaultData.primary.university;
    const uni1Country = primaryUni?.country || defaultData.primary.country;
    const uni1City = primaryUni?.city || defaultData.primary.city;
    const prog1Name = primaryProgram?.name_tr || defaultData.primary.program;
    const prog1Price = primaryProgram?.price ? `${primaryProgram.price} EUR` : defaultData.primary.tuition;
    
    const uni2Name = secondaryUni?.name || defaultData.secondary.university;
    const uni2Country = secondaryUni?.country || defaultData.secondary.country;
    const uni2City = secondaryUni?.city || defaultData.secondary.city;
    const prog2Name = secondaryProgram?.name_tr || defaultData.secondary.program;
    const prog2Price = secondaryProgram?.price ? `${secondaryProgram.price} EUR` : defaultData.secondary.tuition;
    
    // Prep school selection based on country
    const prepSchools = {
        'Czech Republic': 'Charles University Language Center',
        'Italy': 'Universita per Stranieri di Perugia',
        'Germany': 'Studienkolleg',
        'Austria': 'University of Vienna Prep',
        'UK': 'Kaplan International Pathways',
        'Poland': 'Warsaw University Prep Course',
        'Hungary': 'Budapest Prep Academy'
    };
    
    const prepSchool = prepSchools[uni1Country] || 'Charles University Language Center';
    
    return {
        success: true,
        data: {
            prep_school_needed: needsPrep || needsAcademicPrep,
            prep_school_type: needsPrep && needsAcademicPrep ? 'both' : (needsPrep ? 'language' : (needsAcademicPrep ? 'academic' : null)),
            prep_school_suggestion: (needsPrep || needsAcademicPrep) ? 
                `${prepSchool} - ${needsPrep ? 'İngilizce seviyenizi geliştirmek için dil hazırlığı öneriyoruz.' : ''} ${needsAcademicPrep ? 'Akademik hazırlık programı da faydalı olabilir.' : ''}` : null,
            
            recommendation_1: {
                university_name: uni1Name,
                program_name: prog1Name,
                country: uni1Country,
                city: uni1City,
                tuition: prog1Price,
                why_this_university: `${uni1Name}, ${uni1Country}'de uluslararası öğrenciler için popüler bir seçimdir. Venture Global'ın resmi partneri olan bu üniversite, kaliteli eğitim ve geniş destek hizmetleri sunmaktadır. ${primaryUni?.world_ranking ? `Dünya sıralamasında ${primaryUni.world_ranking}. sırada yer almaktadır.` : ''} Akademik programları ve araştırma olanakları ile öne çıkmaktadır.`,
                why_this_program: `${prog1Name} programı, ilgi alanlarınız (${interests.join(', ')}) göz önüne alınarak seçilmiştir. Bu program hem teorik bilgi hem de pratik deneyim kazandırmaktadır. Mezuniyet sonrası geniş kariyer fırsatları sunmaktadır.`,
                country_info: `${uni1Country}, Avrupa'da eğitim almak isteyen Türk öğrenciler için popüler bir destinasyondur. Eğitim kalitesi yüksek ve yaşam maliyetleri görece makuldür. Schengen bölgesinde olması seyahat kolaylığı sağlamaktadır. Mezuniyet sonrası çalışma izni alma imkanları mevcuttur.`,
                city_info: `${uni1City}, öğrenci dostu bir şehirdir. Aylık yaşam maliyeti yaklaşık 600-1000 EUR arasındadır (kira dahil). Toplu taşıma gelişmiştir ve öğrenci indirimleri mevcuttur. Zengin kültürel hayatı ve aktif sosyal ortamıyla öne çıkmaktadır.`,
                career_prospects: `${prog1Name} mezunları için geniş iş olanakları bulunmaktadır. Avrupa genelinde geçerli diploma ile farklı ülkelerde de iş bulma şansınız yüksektir. Ortalama başlangıç maaşları 30.000-50.000 EUR arasındadır.`
            },
            
            recommendation_2: {
                university_name: uni2Name,
                program_name: prog2Name,
                country: uni2Country,
                city: uni2City,
                tuition: prog2Price,
                why_this_university: `${uni2Name}, alternatif olarak değerlendirilebilecek güçlü bir seçenektir. ${uni2Country}'nin prestijli üniversitelerinden biri olup, uluslararası tanınırlığı yüksektir. Venture Global'ın partneri olarak öğrencilere kapsamlı destek sağlamaktadır.`,
                why_this_program: `Bu üniversitedeki ${prog2Name} programı da ilgi alanlarınıza uygundur. Farklı bir perspektif ve akademik yaklaşım sunmaktadır. Erasmus değişim programları ile diğer Avrupa ülkelerinde de deneyim kazanabilirsiniz.`,
                country_info: `${uni2Country}, Avrupa'nın merkezinde konumuyla stratejik bir avantaj sunar. Eğitim sistemi köklü ve uluslararası standartlardadır. Yaşam maliyetleri ve eğitim ücretleri makul seviyelerdedir.`,
                city_info: `${uni2City}, tarihi dokusu ve modern yaşamı bir arada sunan canlı bir şehirdir. Aylık yaşam maliyeti yaklaşık 500-900 EUR arasındadır. Öğrenci toplulukları aktiftir ve sosyalleşme olanakları boldur.`,
                career_prospects: `${uni2Country}'de mezuniyet sonrası çalışma olanakları mevcuttur. Avrupa genelinde geçerli diploma ile farklı ülkelerde de iş bulma şansınız yüksektir. Özellikle uluslararası şirketlerde fırsatlar artmaktadır.`
            },
            
            comparison: `İlk önerimiz (${uni1Name}) tercih ettiğiniz ülkeler arasında olması nedeniyle öne çıkmaktadır. İkinci önerimiz (${uni2Name}) ise farklı bir alternatif sunarak seçeneklerinizi genişletmektedir. Bütçeniz ve kariyer hedeflerinize göre her iki seçenek de değerlendirilebilir.`,
            
            overall_advice: `Başvuru sürecine en az 6 ay önceden başlamanızı öneririz. ${needsPrep ? 'Öncelikle İngilizce seviyenizi geliştirmeniz önemlidir.' : ''} Gerekli belgeleri (transkript, dil sertifikası, motivasyon mektubu) önceden hazırlayın. Her iki üniversiteye de başvuru yaparak şansınızı artırabilirsiniz. Venture Global danışmanlarınız tüm süreçte size yardımcı olacaktır.`,
            
            // Legacy fields
            recommended_university_name: uni1Name,
            recommended_program_name: prog1Name,
            recommended_country: uni1Country,
            recommended_city: uni1City,
            recommended_tuition: prog1Price,
            ai_reasoning: `İngilizce seviyeniz (${englishLevel}) ve tercih ettiğiniz ülkeler (${preferredCountries.join(', ')}) dikkate alınarak bu öneri yapılmıştır.`,
            is_fallback: true
        }
    };
}

/**
 * Save recommendation to database
 */
async function saveRecommendation(userId, studentData, aiResult) {
    try {
        // Tüm detaylı öneri verisini JSON olarak sakla
        const fullRecommendationData = JSON.stringify({
            recommendation_1: aiResult.data.recommendation_1,
            recommendation_2: aiResult.data.recommendation_2,
            comparison: aiResult.data.comparison,
            overall_advice: aiResult.data.overall_advice,
            prep_school_needed: aiResult.data.prep_school_needed,
            prep_school_suggestion: aiResult.data.prep_school_suggestion
        });
        
        const result = await pool.query(`
            INSERT INTO ai_recommendations (
                user_id,
                education_level,
                english_level,
                english_exam_type,
                english_exam_score,
                high_school_gpa,
                math_level,
                high_school_activities,
                bachelor_field,
                bachelor_gpa,
                bachelor_university_type,
                work_experience,
                bachelor_activities,
                interests,
                country_preferences,
                budget_range,
                additional_notes,
                prep_school_needed,
                prep_school_type,
                prep_school_suggestion,
                recommended_university_id,
                recommended_country,
                recommended_city,
                recommended_tuition,
                ai_reasoning
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
            RETURNING *
        `, [
            userId,
            studentData.education_level,
            studentData.english_level,
            studentData.english_exam_type,
            studentData.english_exam_score,
            studentData.high_school_gpa,
            studentData.math_level,
            studentData.high_school_activities,
            studentData.bachelor_field,
            studentData.bachelor_gpa,
            studentData.bachelor_university_type,
            studentData.work_experience,
            studentData.bachelor_activities,
            studentData.interests,
            studentData.country_preferences,
            studentData.budget_range,
            studentData.additional_notes,
            aiResult.data.prep_school_needed,
            aiResult.data.prep_school_type,
            aiResult.data.prep_school_suggestion,
            aiResult.data.recommended_university_id,
            aiResult.data.recommendation_1?.country || aiResult.data.recommended_country,
            aiResult.data.recommendation_1?.city || aiResult.data.recommended_city,
            aiResult.data.recommendation_1?.tuition || aiResult.data.recommended_tuition,
            fullRecommendationData  // Tüm detaylı veriyi JSON olarak sakla
        ]);
        
        return result.rows[0];
    } catch (error) {
        console.error('Error saving recommendation:', error);
        throw error;
    }
}

/**
 * Get user's latest recommendation
 */
async function getUserRecommendation(userId) {
    try {
        const result = await pool.query(`
            SELECT * FROM ai_recommendations 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT 1
        `, [userId]);
        
        if (result.rows.length === 0) return null;
        
        const rec = result.rows[0];
        
        // ai_reasoning JSON ise parse et ve detaylı verileri ekle
        if (rec.ai_reasoning) {
            try {
                const fullData = JSON.parse(rec.ai_reasoning);
                rec.recommendation_1 = fullData.recommendation_1;
                rec.recommendation_2 = fullData.recommendation_2;
                rec.comparison = fullData.comparison;
                rec.overall_advice = fullData.overall_advice;
            } catch (e) {
                // JSON değilse eski format - ai_reasoning düz metin olarak kalır
                console.log('ai_reasoning is not JSON, using as plain text');
            }
        }
        
        return rec;
    } catch (error) {
        console.error('Error getting user recommendation:', error);
        return null;
    }
}

/**
 * Get all recommendations (for admin)
 */
async function getAllRecommendations(limit = 50) {
    try {
        const result = await pool.query(`
            SELECT 
                r.*,
                u.first_name,
                u.last_name,
                u.email
            FROM ai_recommendations r
            JOIN users u ON r.user_id = u.id
            ORDER BY r.created_at DESC
            LIMIT $1
        `, [limit]);
        
        return result.rows;
    } catch (error) {
        console.error('Error getting all recommendations:', error);
        return [];
    }
}

/**
 * Get recommendation statistics
 */
async function getRecommendationStats() {
    try {
        const totalResult = await pool.query('SELECT COUNT(*) FROM ai_recommendations');
        const thisMonthResult = await pool.query(`
            SELECT COUNT(*) FROM ai_recommendations 
            WHERE created_at >= date_trunc('month', CURRENT_DATE)
        `);
        // Hazırlık gereken UNIQUE öğrenci sayısı (aynı öğrenciye birden fazla öneri yapılsa bile 1 sayılır)
        const prepNeededResult = await pool.query(`
            SELECT COUNT(DISTINCT user_id) FROM ai_recommendations WHERE prep_school_needed = true
        `);
        
        return {
            total: parseInt(totalResult.rows[0].count),
            thisMonth: parseInt(thisMonthResult.rows[0].count),
            prepSchoolNeeded: parseInt(prepNeededResult.rows[0].count)
        };
    } catch (error) {
        console.error('Error getting recommendation stats:', error);
        return { total: 0, thisMonth: 0, prepSchoolNeeded: 0 };
    }
}

module.exports = {
    analyzeStudentProfile,
    saveRecommendation,
    getUserRecommendation,
    getAllRecommendations,
    getRecommendationStats,
    getPrepSchools
};
