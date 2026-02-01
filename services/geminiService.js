// AI Service for Student Wizard - Groq (Primary) + Gemini (Fallback)
// Bu servis Venture Global partner üniversiteleri ve bölümleri kullanarak GERÇEK AI tabanlı öneriler üretir
// NOT: Fallback sistemi KALDIRILDI - sadece gerçek AI kullanılır
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// API Endpoints
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

/**
 * Analyze student profile and generate university recommendation
 * Uses ONLY real AI: Groq (primary) -> Gemini (fallback)
 * NO rule-based fallback - AI must work or return error
 */
async function analyzeStudentProfile(studentData) {
    console.log('🤖 Starting REAL AI analysis (no fallback)...');
    
    // Get universities and departments from database
    let universities = [];
    try {
        universities = await getUniversitiesWithDepartments();
        console.log(`📊 Found ${universities.length} universities with departments for analysis`);
    } catch (dbError) {
        console.error('❌ Database error:', dbError.message);
        throw new Error('Veritabanına bağlanılamadı. Lütfen daha sonra tekrar deneyin.');
    }
    
    if (universities.length === 0) {
        throw new Error('Sistemde üniversite bulunamadı. Lütfen yönetici ile iletişime geçin.');
    }
    
        const prepSchools = await getPrepSchools();
        
        // Build the prompt
        const prompt = buildAnalysisPrompt(studentData, universities, prepSchools);
        
    // Try AI APIs with retries: Groq first, then Gemini
        let response = null;
    let lastError = null;
        
        // Try Groq API first (faster and more reliable)
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`🤖 Groq API attempt ${attempt}/${MAX_RETRIES}...`);
            response = await callGroqAPI(prompt);
            if (response) {
                console.log('✅ AI response from Groq');
                break;
            }
        } catch (groqError) {
            lastError = groqError;
            console.warn(`⚠️ Groq API attempt ${attempt} failed:`, groqError.message);
            if (attempt < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        }
        }
        
    // If Groq fails, try Gemini with retries
        if (!response) {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`🤖 Gemini API attempt ${attempt}/${MAX_RETRIES}...`);
                response = await callGeminiAPI(prompt);
                if (response) {
                    console.log('✅ AI response from Gemini');
                    break;
                }
            } catch (geminiError) {
                lastError = geminiError;
                console.warn(`⚠️ Gemini API attempt ${attempt} failed:`, geminiError.message);
                if (attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                }
            }
            }
        }
        
    // NO FALLBACK - AI must work
        if (!response) {
        console.error('❌ All AI APIs failed after retries');
        throw new Error('Yapay zeka servisi şu anda kullanılamıyor. Lütfen birkaç dakika sonra tekrar deneyin.');
        }
        
    // Parse and validate the response
    const result = parseAIResponse(response, studentData, universities);
        
    // Validate that AI response matches user's country preferences AND partner list
    const validatedResult = await validateAndFixCountries(result, studentData, universities);
    
    // Override prep school decision for Canadian diploma holders
    const finalResult = applyCanadianDiplomaRules(validatedResult, studentData);
    
    return finalResult;
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
        'Hungary': 'Macaristan',
        'Netherlands': 'Hollanda'
    };

    const educationLevel = studentData.education_level === 'bachelor' ? 'Lisans' : 'Yüksek Lisans';
    const programFilter = studentData.education_level === 'bachelor' ? 'bachelor' : 'master';
    const hasCanadianDiploma = studentData.canadian_diploma === 'yes';
    
    // Build student profile section
    let studentProfile = `
## ÖĞRENCİ PROFİLİ

**Hedef Eğitim Seviyesi:** ${educationLevel}
**Kanada Lise Diploması:** ${hasCanadianDiploma ? '✅ EVET - 12. sınıfta Kanada\'da lise diploması almış (WCEP veya benzeri program)' : '❌ HAYIR - Türk lise diploması'}
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

    // Kanada diploması avantajları bilgisi
    let canadianDiplomaSection = '';
    if (hasCanadianDiploma) {
        canadianDiplomaSection = `
## 🍁 KANADA LİSE DİPLOMASI AVANTAJLARI (ÖĞRENCİ BU DİPLOMAYA SAHİP!)

Bu öğrenci 12. sınıfı Kanada'da tamamlamış ve Kanada lise diploması almıştır. Bu diploma Avrupa'da büyük avantajlar sağlar:

### ÜLKE BAZLI MUAFİYETLER:
- **ALMANYA:** Studienkolleg (hazırlık yılı) ATLANIR! Direkt üniversiteye başvurabilir. Türk diploması ile en az 4 AP kursu gerekirken, Kanada diploması ile bu şart ortadan kalkar.
- **İNGİLTERE:** Foundation Year (hazırlık yılı) ATLANIR! Direkt lisans programlarına kabul edilir.
- **ÇEK CUMHURİYETİ:** Charles University Tıp ve Diş Hekimliği fakültelerine SINAVSIZ kabul imkanı! (2. Tıp Fakültesi)
- **AVUSTURYA:** Vorstudienlehrgang (hazırlık) muafiyeti. Direkt üniversite başvurusu.
- **İTALYA:** Türk diploması için gereken ek sınavlardan muafiyet. Daha kolay kabul süreci.
- **POLONYA:** Öncelikli değerlendirme ve hazırlık programı muafiyeti.
- **MACARİSTAN:** Direkt kabul imkanı, hazırlık şartı yok.
- **HOLLANDA:** Research University'ler (WO) için AP şartı KALKAR! University of Applied Sciences (HBO) ve Research University (WO) dahil TÜM üniversitelere direkt başvuru yapabilir.

⭐ WCEP (Worldwide Cultural Exchange Program) ortaklığımız sayesinde öğrencilerimiz Kanada'nın prestijli okullarında 12. sınıfı tamamlayarak bu avantajlardan yararlanmaktadır.

ÖNEMLİ: Bu öğrenci için önerilerde Kanada diploması avantajlarını MUTLAKA belirt!
`;
    }

    // Hollanda için Türk lise diploması kuralları (sadece Kanada diploması OLMAYANLAR için)
    let turkishDiplomaNetherlandsSection = '';
    if (!hasCanadianDiploma && studentData.country_preferences?.includes('Netherlands')) {
        turkishDiplomaNetherlandsSection = `
## 🇳🇱 HOLLANDA ÜNİVERSİTELERİ - TÜRK LİSE DİPLOMASI KURALLARI

Hollanda'da iki tür üniversite bulunmaktadır ve Türk lise diploması ile kabul şartları farklıdır:

### 1. UYGULAMALI BİLİMLER ÜNİVERSİTELERİ (HBO - Hogeschool / University of Applied Sciences)
✅ Türk lise diploması ile DOĞRUDAN KABUL EDİLİRSİNİZ!
- The Hague University of Applied Sciences
- Amsterdam University of Applied Sciences
- Ve diğer "University of Applied Sciences" isimleri içeren üniversiteler

### 2. ARAŞTIRMA ÜNİVERSİTELERİ (WO - Research University)
⚠️ Türk lise diploması için EK ŞARTLAR GEREKLİDİR:
- University of Amsterdam, Utrecht University, Leiden University, TU Delft, Radboud University, University of Groningen, VU Amsterdam gibi prestijli araştırma üniversiteleri
- Bu üniversitelere başvurabilmek için iki seçenek vardır:
  1. Lisede en az 4 AP (Advanced Placement) dersi almış olmak
  2. VEYA Hollanda'da bir University of Applied Sciences'ta 1 yıl eğitim almış olmak

⚠️ ÖNEMLİ: Bu öğrenci TÜRK LİSE DİPLOMASINA sahip. Hollanda'dan Research University önerirsen bu uyarıyı MUTLAKA belirt!
✅ University of Applied Sciences önerirsen bu uyarıya GEREK YOK, direkt kabul mümkün.
`;
    }

    return `Sen Venture Global için çalışan deneyimli bir eğitim danışmanısın. Aşağıdaki öğrenci profiline göre en uygun üniversite ve program önerisi yapacaksın.

⚠️ KRİTİK KURAL: ÖĞRENCİNİN TERCİH ETTİĞİ ÜLKELERDEN ÖNERİ YAP! 
Öğrenci "${studentData.country_preferences?.join(', ') || 'belirtmedi'}" ülkelerini tercih etmiş. 
İLK ÖNERİ MUTLAKA 1. TERCİH ÜLKESİNDEN, İKİNCİ ÖNERİ 2. TERCİH ÜLKESİNDEN OLMALIDIR!
Tercih edilen ülkeler dışından öneri YAPMA!

${canadianDiplomaSection}
${turkishDiplomaNetherlandsSection}

${studentProfile}

${universitiesSection}

${prepSchoolsSection}

## HAZIRLIK GEREKSİNİM KRİTERLERİ
- İngilizce A1-A2: Kesinlikle dil hazırlığı gerekli
- İngilizce B1: Muhtemelen dil hazırlığı gerekli (üniversite gereksinimlerine bağlı)
- İngilizce B2+ ve sınav skoru yok: Belki gerekli, sınav gerekebilir
- IELTS < 5.5 veya TOEFL < 70: Dil hazırlığı gerekli
- Lise notu < 60/100: Akademik hazırlık (Foundation) önerilir
${hasCanadianDiploma ? '- ⭐ KANADA DİPLOMASI VAR: Çoğu hazırlık programı muafiyeti mevcut!' : ''}

## GÖREV
Öğrenciye partner listesindeki üniversitelerden İKİ farklı öneri sun. Her öneri için detaylı ve kapsamlı bilgi ver.
${hasCanadianDiploma ? '⭐ Kanada diploması avantajlarını her öneride mutlaka vurgula!' : ''}

SADECE aşağıdaki JSON formatında yanıt ver, başka açıklama ekleme:

{
    "prep_school_needed": true/false,
    "prep_school_type": "language" | "academic" | "both" | null,
    "prep_school_name": "Hazırlık okulu adı veya null",
    "prep_school_reason": "Neden hazırlık gerekli/gerekli değil - en az 2 cümle detaylı açıklama",
    
    "recommendation_1": {
        "university_name": "Birinci öneri üniversite adı (PARTNER LİSTESİNDEN - 1. TERCİH ÜLKESİNDEN)",
        "program_name": "Önerilen bölüm/program adı (LİSTEDEN)",
        "country": "Ülke adı (İngilizce - ÖĞRENCİNİN 1. TERCİHİ: ${studentData.country_preferences?.[0] || 'Czech Republic'})",
        "city": "Şehir adı",
        "tuition": "Yıllık ücret (EUR cinsinden, programdan al)",
        "why_this_university": "Bu üniversitenin neden önerildiğine dair EN AZ 4-5 cümlelik detaylı açıklama. Üniversitenin güçlü yönleri, akademik kalitesi, öğrenciye uygunluğu.",
        "why_this_program": "Bu programın/bölümün neden uygun olduğuna dair EN AZ 3-4 cümlelik açıklama. Öğrencinin ilgi alanlarıyla eşleşme.",
        "country_info": "Bu ülkede eğitim almanın avantajları hakkında EN AZ 4-5 cümlelik kapsamlı bilgi. Eğitim sistemi, dil, vize süreci, çalışma izni.",
        "city_info": "Şehir hakkında EN AZ 4-5 cümlelik detaylı bilgi. Yaşam maliyeti (kira, yemek, ulaşım yaklaşık fiyatları), öğrenci hayatı, iklim.",
        "career_prospects": "Mezuniyet sonrası kariyer fırsatları hakkında EN AZ 3-4 cümlelik bilgi."${hasCanadianDiploma ? `,
        "canadian_diploma_advantage": "Bu ülkede Kanada lise diplomasının sağladığı AVANTAJLAR: muafiyetler, sınavsız kabul imkanları vb. EN AZ 3-4 cümle."` : ''}${!hasCanadianDiploma && studentData.country_preferences?.includes('Netherlands') ? `,
        "netherlands_diploma_warning": "EĞER bu öneri Hollanda'dan bir Research University (WO) ise: Türk lise diploması ile bu üniversiteye kabul için ek şartları açıkla (4 AP dersi veya 1 yıl HBO). EĞER University of Applied Sciences (HBO) ise bu alanı boş bırak veya 'Uygulamalı Bilimler Üniversitesi olduğu için Türk lise diploması ile doğrudan kabul edilebilirsiniz.' yaz."` : ''}
    },
    
    "recommendation_2": {
        "university_name": "İkinci öneri üniversite adı (FARKLI BİR ÜNİVERSİTE - 2. TERCİH ÜLKESİNDEN: ${studentData.country_preferences?.[1] || 'Italy'})",
        "program_name": "Önerilen bölüm/program adı (LİSTEDEN)",
        "country": "Ülke adı (ÖĞRENCİNİN 2. TERCİHİ: ${studentData.country_preferences?.[1] || 'Italy'})",
        "city": "Şehir adı",
        "tuition": "Yıllık ücret",
        "why_this_university": "Bu üniversitenin neden alternatif olarak önerildiğine dair EN AZ 4-5 cümlelik detaylı açıklama.",
        "why_this_program": "Bu programın neden uygun olduğuna dair EN AZ 3-4 cümlelik açıklama.",
        "country_info": "Bu ülkede eğitim almanın avantajları hakkında EN AZ 4-5 cümlelik kapsamlı bilgi.",
        "city_info": "Şehir hakkında EN AZ 4-5 cümlelik detaylı bilgi.",
        "career_prospects": "Mezuniyet sonrası kariyer fırsatları hakkında EN AZ 3-4 cümlelik bilgi."${hasCanadianDiploma ? `,
        "canadian_diploma_advantage": "Bu ülkede Kanada lise diplomasının sağladığı AVANTAJLAR: muafiyetler, sınavsız kabul imkanları vb. EN AZ 3-4 cümle."` : ''}${!hasCanadianDiploma && studentData.country_preferences?.includes('Netherlands') ? `,
        "netherlands_diploma_warning": "EĞER bu öneri Hollanda'dan bir Research University (WO) ise: Türk lise diploması ile bu üniversiteye kabul için ek şartları açıkla (4 AP dersi veya 1 yıl HBO). EĞER University of Applied Sciences (HBO) ise bu alanı boş bırak veya 'Uygulamalı Bilimler Üniversitesi olduğu için Türk lise diploması ile doğrudan kabul edilebilirsiniz.' yaz."` : ''}
    },
    
    "comparison": "İki öneri arasındaki farkları ve hangisinin hangi durumda daha uygun olacağını açıklayan EN AZ 3-4 cümlelik karşılaştırma.",
    
    "overall_advice": "Öğrenciye genel tavsiyeler - EN AZ 3-4 cümle. Başvuru süreci, hazırlık önerileri, dikkat edilmesi gerekenler."${hasCanadianDiploma ? `,
    
    "wcep_advantage_summary": "WCEP (Worldwide Cultural Exchange Program) ortaklığımız sayesinde Kanada lise diploması alan öğrencilerin Avrupa'daki avantajlarının özeti. Öğrenciyi tebrik et ve bu avantajdan yararlanmasını öner. EN AZ 3-4 cümle."` : ''}
}

KURALLAR:
1. SADECE JSON formatında yanıt ver
2. İki öneri FARKLI üniversitelerden olsun
3. ⚠️ KRİTİK: İLK ÖNERİ 1. TERCİH ÜLKESİNDEN (${studentData.country_preferences?.[0] || 'Czech Republic'}), İKİNCİ ÖNERİ 2. TERCİH ÜLKESİNDEN (${studentData.country_preferences?.[1] || 'Italy'}) OLMALI!
4. Tüm açıklamalar Türkçe olsun
5. Fiyatlar listeden alınsın ve EUR cinsinden olsun
6. İlgi alanlarına uygun programlar öner
${hasCanadianDiploma ? '7. ⭐ Kanada diploması avantajlarını her fırsatta vurgula ve WCEP ortaklığımızı öv!' : ''}
${!hasCanadianDiploma && studentData.country_preferences?.includes('Netherlands') ? '8. 🇳🇱 HOLLANDA: Research University (WO) önerirsen Türk diploma uyarısını MUTLAKA ekle! University of Applied Sciences (HBO) önerirsen uyarıya gerek yok.' : ''}`;
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
 * NO FALLBACK - throws error if parsing fails
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
        
        const hasCanadianDiploma = studentData.canadian_diploma === 'yes';
        
        // New format with two recommendations
        return {
            success: true,
            data: {
                prep_school_needed: parsed.prep_school_needed || false,
                prep_school_type: parsed.prep_school_type || null,
                prep_school_suggestion: parsed.prep_school_name ? 
                    `${parsed.prep_school_name}: ${parsed.prep_school_reason}` : 
                    (parsed.prep_school_reason || null),
                
                // Canadian diploma info
                has_canadian_diploma: hasCanadianDiploma,
                wcep_advantage_summary: parsed.wcep_advantage_summary || null,
                
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
                    career_prospects: parsed.career_prospects,
                    canadian_diploma_advantage: parsed.recommendation_1?.canadian_diploma_advantage || null
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
        // NO FALLBACK - throw error
        throw new Error('Yapay zeka yanıtı işlenemedi. Lütfen tekrar deneyin.');
    }
}

/**
 * Validate and fix AI recommendations
 * - Ensures universities are from our partner list
 * - Ensures countries match user preferences
 * - Handles both bachelor and master programs
 */
async function validateAndFixCountries(result, studentData, universities) {
    const preferredCountries = studentData.country_preferences || [];
    const educationLevel = studentData.education_level || 'bachelor';
    const partnerUnis = universities || [];
    
    if (preferredCountries.length === 0) {
        console.log('ℹ️ No country preferences specified, skipping validation');
        return result;
    }
    
    if (partnerUnis.length === 0) {
        console.warn('⚠️ No partner universities available for validation');
        return result;
    }
    
    console.log(`🔍 Validating recommendations for ${educationLevel} level`);
    console.log(`📍 Preferred countries: ${preferredCountries.join(', ')}`);
    
    // Normalize country names for comparison
    const normalizeCountry = (country) => {
        const countryMap = {
            'holland': 'Netherlands', 'hollanda': 'Netherlands', 'the netherlands': 'Netherlands',
            'çekya': 'Czech Republic', 'czechia': 'Czech Republic',
            'almanya': 'Germany', 'ingiltere': 'UK', 'england': 'UK', 'united kingdom': 'UK',
            'italya': 'Italy', 'avusturya': 'Austria', 'polonya': 'Poland', 'macaristan': 'Hungary'
        };
        return countryMap[country?.toLowerCase()] || country;
    };
    
    // Get programs based on education level
    const getPrograms = (uni) => {
        return educationLevel === 'master' ? (uni.master_programs || []) : (uni.bachelor_programs || []);
    };
    
    // Find matching partner university by name (fuzzy match)
    const findPartnerUni = (uniName) => {
        if (!uniName) return null;
        const nameLower = uniName.toLowerCase().trim();
        
        // Exact match first
        let match = partnerUnis.find(u => u.name.toLowerCase() === nameLower);
        if (match) return match;
        
        // Partial match
        match = partnerUnis.find(u => 
            u.name.toLowerCase().includes(nameLower) || 
            nameLower.includes(u.name.toLowerCase())
        );
        if (match) return match;
        
        // Word-based match (at least 2 significant words match)
        const words = nameLower.split(/\s+/).filter(w => w.length > 3);
        match = partnerUnis.find(u => {
            const uniWords = u.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const matchCount = words.filter(w => uniWords.some(uw => uw.includes(w) || w.includes(uw))).length;
            return matchCount >= 2;
        });
        
        return match || null;
    };
    
    // Find best university for a country
    const findBestUniversity = (targetCountry, excludeNames = [], interests = []) => {
        const normalizedCountry = normalizeCountry(targetCountry);
        
        // Filter universities by country and exclude already used ones
        let candidates = partnerUnis.filter(u => {
            const uniCountry = normalizeCountry(u.country);
            const hasPrograms = getPrograms(u).length > 0;
            const notExcluded = !excludeNames.includes(u.name);
            return uniCountry === normalizedCountry && hasPrograms && notExcluded;
        });
        
        if (candidates.length === 0) {
            console.warn(`⚠️ No partner universities found for ${normalizedCountry}`);
            return null;
        }
        
        // Sort by world ranking (if available) and featured status
        candidates.sort((a, b) => {
            if (a.is_featured && !b.is_featured) return -1;
            if (!a.is_featured && b.is_featured) return 1;
            return (a.world_ranking || 999) - (b.world_ranking || 999);
        });
        
        return candidates[0];
    };
    
    // Find best program based on student interests
    const findBestProgram = (uni, interests = []) => {
        const programs = getPrograms(uni);
        if (programs.length === 0) return null;
        
        if (interests.length > 0) {
            // Try to match interests
            const interestLower = interests.map(i => i.toLowerCase());
            const matched = programs.find(p => 
                interestLower.some(int => 
                    p.name_tr?.toLowerCase().includes(int) || 
                    p.name_en?.toLowerCase().includes(int)
                )
            );
            if (matched) return matched;
        }
        
        return programs[0];
    };
    
    // Update recommendation with valid partner university
    const updateRecommendation = (rec, validUni, program, reason = '') => {
        if (!validUni) return false;
        
        rec.university_name = validUni.name;
        rec.country = validUni.country;
        rec.city = validUni.city;
        
        if (program) {
            rec.program_name = program.name_tr || program.name_en || 'Program';
            rec.tuition = program.price ? `${program.price} EUR` : 'Değişken';
        }
        
        // Enhance the reasoning
        const ranking = validUni.world_ranking ? ` Dünya sıralamasında ${validUni.world_ranking}. sırada.` : '';
        rec.why_this_university = `${validUni.name}, Venture Global'ın resmi partner üniversitesidir.${ranking} ${rec.why_this_university || reason}`.trim();
        
        return true;
    };
    
    // Validate Recommendation 1
    if (result.data.recommendation_1) {
        const rec1 = result.data.recommendation_1;
        const rec1Country = normalizeCountry(rec1.country);
        const isCountryValid = preferredCountries.map(normalizeCountry).includes(rec1Country);
        const partnerMatch = findPartnerUni(rec1.university_name);
        
        if (!isCountryValid || !partnerMatch) {
            const reason = !isCountryValid 
                ? `Ülke tercihiniz (${preferredCountries[0]}) doğrultusunda öneri yapılmıştır.`
                : 'Partner üniversitelerimizden öneri yapılmıştır.';
            
            console.warn(`⚠️ Rec1: Country valid=${isCountryValid}, Partner match=${!!partnerMatch}`);
            
            const targetCountry = isCountryValid ? rec1Country : preferredCountries[0];
            const validUni = findBestUniversity(targetCountry, [], studentData.interests);
            const program = validUni ? findBestProgram(validUni, studentData.interests) : null;
            
            if (validUni) {
                updateRecommendation(rec1, validUni, program, reason);
                console.log(`✅ Rec1 fixed: ${validUni.name} (${validUni.country})`);
            }
        } else {
            console.log(`✅ Rec1 valid: ${rec1.university_name} (${rec1Country})`);
        }
    }
    
    // Validate Recommendation 2
    if (result.data.recommendation_2) {
        const rec2 = result.data.recommendation_2;
        const rec2Country = normalizeCountry(rec2.country);
        const rec1UniName = result.data.recommendation_1?.university_name;
        const isCountryValid = preferredCountries.map(normalizeCountry).includes(rec2Country);
        const partnerMatch = findPartnerUni(rec2.university_name);
        const isDuplicate = rec2.university_name === rec1UniName;
        
        if (!isCountryValid || !partnerMatch || isDuplicate) {
            const reason = isDuplicate 
                ? 'Alternatif bir partner üniversitemizden öneri yapılmıştır.'
                : !isCountryValid 
                    ? `Ülke tercihiniz doğrultusunda öneri yapılmıştır.`
                    : 'Partner üniversitelerimizden öneri yapılmıştır.';
            
            console.warn(`⚠️ Rec2: Country valid=${isCountryValid}, Partner match=${!!partnerMatch}, Duplicate=${isDuplicate}`);
            
            const targetCountry = preferredCountries[1] || preferredCountries[0];
            const validUni = findBestUniversity(targetCountry, [rec1UniName], studentData.interests);
            const program = validUni ? findBestProgram(validUni, studentData.interests) : null;
            
            if (validUni) {
                updateRecommendation(rec2, validUni, program, reason);
                console.log(`✅ Rec2 fixed: ${validUni.name} (${validUni.country})`);
            }
        } else {
            console.log(`✅ Rec2 valid: ${rec2.university_name} (${rec2Country})`);
        }
    }
    
    // Update legacy fields for compatibility
    if (result.data.recommendation_1) {
        result.data.recommended_country = result.data.recommendation_1.country;
        result.data.recommended_university_name = result.data.recommendation_1.university_name;
        result.data.recommended_program_name = result.data.recommendation_1.program_name;
        result.data.recommended_city = result.data.recommendation_1.city;
        result.data.recommended_tuition = result.data.recommendation_1.tuition;
    }
    
    return result;
}

/**
 * Apply Canadian diploma rules - override prep school decision
 * If student has Canadian diploma, prep school is NOT needed
 */
function applyCanadianDiplomaRules(result, studentData) {
    const hasCanadianDiploma = studentData.canadian_diploma === 'yes';
    
    if (!hasCanadianDiploma) {
        return result;
    }
    
    console.log('🍁 Applying Canadian diploma rules...');
    
    // FORCE prep_school_needed to false for Canadian diploma holders
    if (result.data.prep_school_needed === true) {
        console.log('⚠️ AI suggested prep school but student has Canadian diploma - OVERRIDING to false');
        result.data.prep_school_needed = false;
        result.data.prep_school_type = null;
        result.data.prep_school_suggestion = '🍁 Kanada lise diplomanız sayesinde hazırlık programlarından muafsınız! Bu büyük bir avantajdır.';
    }
    
    // Ensure Canadian diploma advantages are highlighted
    if (!result.data.wcep_advantage_summary) {
        result.data.wcep_advantage_summary = 'Tebrikler! 🍁 WCEP ortaklığımız kapsamında aldığınız Kanada lise diploması, Avrupa üniversitelerinde size büyük avantajlar sağlıyor. Hazırlık programlarından muafiyet, sınavsız kabul imkanları ve öncelikli değerlendirme gibi ayrıcalıklardan yararlanabilirsiniz.';
    }
    
    // Add Canadian diploma advantage info to recommendations if missing
    const canadianDiplomaAdvantages = {
        'Germany': 'Almanya\'da Studienkolleg (hazırlık yılı) atlanır! Direkt üniversiteye başvurabilirsiniz.',
        'UK': 'İngiltere\'de Foundation Year atlanır! Direkt lisans programlarına kabul edilirsiniz.',
        'Czech Republic': 'Charles University Tıp ve Diş Hekimliği fakültelerine sınavsız kabul imkanı!',
        'Austria': 'Vorstudienlehrgang muafiyeti! Direkt üniversite başvurusu yapabilirsiniz.',
        'Italy': 'Ek sınavlardan muafiyet ve hızlı kabul süreci.',
        'Poland': 'Öncelikli değerlendirme ve hazırlık muafiyeti.',
        'Hungary': 'Direkt kabul imkanı, hazırlık şartı yok.',
        'Netherlands': 'Hollanda\'da Research University\'ler için gereken AP şartı kalkar! Tüm üniversitelere direkt başvuru yapabilirsiniz.'
    };
    
    if (result.data.recommendation_1 && !result.data.recommendation_1.canadian_diploma_advantage) {
        const country = result.data.recommendation_1.country;
        result.data.recommendation_1.canadian_diploma_advantage = canadianDiplomaAdvantages[country] || 'Kanada lise diplomanız bu ülkede size avantaj sağlamaktadır.';
    }
    
    if (result.data.recommendation_2 && !result.data.recommendation_2.canadian_diploma_advantage) {
        const country = result.data.recommendation_2.country;
        result.data.recommendation_2.canadian_diploma_advantage = canadianDiplomaAdvantages[country] || 'Kanada lise diplomanız bu ülkede size avantaj sağlamaktadır.';
    }
    
    return result;
}

/**
 * Generate fallback recommendation when AI fails - using REAL university data
 */
function generateFallbackRecommendation(studentData, universities = []) {
    console.log('⚠️ Using fallback recommendation system');
    
    // Determine if prep is needed
    const englishLevel = studentData.english_level;
    const hasCanadianDiploma = studentData.canadian_diploma === 'yes';
    // Kanada diploması varsa hazırlık gerekliliği azalır
    const needsPrep = !hasCanadianDiploma && ['A1', 'A2', 'B1'].includes(englishLevel);
    const needsAcademicPrep = !hasCanadianDiploma && studentData.high_school_gpa && studentData.high_school_gpa < 60;
    
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
        'Hungary': 'Budapest Prep Academy',
        'Netherlands': 'Holland International Study Centre'
    };
    
    const prepSchool = prepSchools[uni1Country] || 'Charles University Language Center';
    
    // Kanada diploması avantaj bilgileri (ülke bazlı)
    const canadianDiplomaAdvantages = {
        'Germany': 'Almanya\'da Kanada lise diploması ile Studienkolleg (hazırlık yılı) atlanır! Türk diploması ile en az 4 AP kursu gerekirken, Kanada diploması ile direkt üniversiteye başvurabilirsiniz.',
        'UK': 'İngiltere\'de Kanada lise diploması ile Foundation Year (hazırlık yılı) atlanır! Direkt lisans programlarına kabul edilirsiniz.',
        'Czech Republic': 'Çek Cumhuriyeti\'nde Kanada lise diploması büyük avantaj sağlar! Charles University Tıp ve Diş Hekimliği fakültelerine sınavsız kabul imkanı (2. Tıp Fakültesi). Diğer fakültelerde de öncelikli değerlendirme.',
        'Austria': 'Avusturya\'da Kanada lise diploması ile Vorstudienlehrgang (hazırlık) muafiyeti! Direkt üniversite başvurusu yapabilirsiniz.',
        'Italy': 'İtalya\'da Kanada lise diploması ile Türk diploması için gereken ek sınavlardan muafiyet. Daha kolay ve hızlı kabul süreci.',
        'Poland': 'Polonya\'da Kanada lise diploması ile öncelikli değerlendirme ve hazırlık programı muafiyeti.',
        'Hungary': 'Macaristan\'da Kanada lise diploması ile direkt kabul imkanı, hazırlık şartı yok.',
        'Netherlands': 'Hollanda\'da Kanada lise diploması ile Research University\'ler (WO) için gereken AP şartı ortadan kalkar! University of Applied Sciences (HBO) ve Research University (WO) dahil TÜM üniversitelere direkt başvuru yapabilirsiniz. Türk lise diploması sahiplerine göre büyük avantaj!'
    };
    
    return {
        success: true,
        data: {
            prep_school_needed: needsPrep || needsAcademicPrep,
            prep_school_type: needsPrep && needsAcademicPrep ? 'both' : (needsPrep ? 'language' : (needsAcademicPrep ? 'academic' : null)),
            prep_school_suggestion: (needsPrep || needsAcademicPrep) ? 
                `${prepSchool} - ${needsPrep ? 'İngilizce seviyenizi geliştirmek için dil hazırlığı öneriyoruz.' : ''} ${needsAcademicPrep ? 'Akademik hazırlık programı da faydalı olabilir.' : ''}` : 
                (hasCanadianDiploma ? 'Kanada lise diplomanız sayesinde çoğu hazırlık programından muafsınız! 🎉' : null),
            
            // Kanada diploması bilgisi
            has_canadian_diploma: hasCanadianDiploma,
            wcep_advantage_summary: hasCanadianDiploma ? 
                `Tebrikler! 🍁 WCEP (Worldwide Cultural Exchange Program) ortaklığımız kapsamında aldığınız Kanada lise diploması, Avrupa üniversitelerinde size büyük avantajlar sağlıyor. Hazırlık programlarından muafiyet, sınavsız kabul imkanları ve öncelikli değerlendirme gibi ayrıcalıklardan yararlanabilirsiniz. Venture Global danışmanlarınız bu avantajları en iyi şekilde değerlendirmenize yardımcı olacaktır.` : null,
            
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
                career_prospects: `${prog1Name} mezunları için geniş iş olanakları bulunmaktadır. Avrupa genelinde geçerli diploma ile farklı ülkelerde de iş bulma şansınız yüksektir. Ortalama başlangıç maaşları 30.000-50.000 EUR arasındadır.`,
                canadian_diploma_advantage: hasCanadianDiploma ? canadianDiplomaAdvantages[uni1Country] || 'Kanada lise diplomanız bu ülkede size avantaj sağlamaktadır.' : null
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
                career_prospects: `${uni2Country}'de mezuniyet sonrası çalışma olanakları mevcuttur. Avrupa genelinde geçerli diploma ile farklı ülkelerde de iş bulma şansınız yüksektir. Özellikle uluslararası şirketlerde fırsatlar artmaktadır.`,
                canadian_diploma_advantage: hasCanadianDiploma ? canadianDiplomaAdvantages[uni2Country] || 'Kanada lise diplomanız bu ülkede size avantaj sağlamaktadır.' : null
            },
            
            comparison: `İlk önerimiz (${uni1Name}) tercih ettiğiniz ülkeler arasında olması nedeniyle öne çıkmaktadır. İkinci önerimiz (${uni2Name}) ise farklı bir alternatif sunarak seçeneklerinizi genişletmektedir. ${hasCanadianDiploma ? 'Her iki ülkede de Kanada lise diplomanız size önemli avantajlar sağlamaktadır!' : ''} Bütçeniz ve kariyer hedeflerinize göre her iki seçenek de değerlendirilebilir.`,
            
            overall_advice: `Başvuru sürecine en az 6 ay önceden başlamanızı öneririz. ${hasCanadianDiploma ? '🍁 Kanada lise diplomanız sayesinde hazırlık programlarından muaf olabilirsiniz - bu büyük bir avantaj!' : (needsPrep ? 'Öncelikle İngilizce seviyenizi geliştirmeniz önemlidir.' : '')} Gerekli belgeleri (transkript, dil sertifikası, motivasyon mektubu) önceden hazırlayın. Her iki üniversiteye de başvuru yaparak şansınızı artırabilirsiniz. Venture Global danışmanlarınız tüm süreçte size yardımcı olacaktır.`,
            
            // Legacy fields
            recommended_university_name: uni1Name,
            recommended_program_name: prog1Name,
            recommended_country: uni1Country,
            recommended_city: uni1City,
            recommended_tuition: prog1Price,
            ai_reasoning: `İngilizce seviyeniz (${englishLevel}) ve tercih ettiğiniz ülkeler (${preferredCountries.join(', ')}) dikkate alınarak bu öneri yapılmıştır.${hasCanadianDiploma ? ' Kanada lise diplomanız size önemli avantajlar sağlamaktadır!' : ''}`,
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
            prep_school_suggestion: aiResult.data.prep_school_suggestion,
            has_canadian_diploma: aiResult.data.has_canadian_diploma || (studentData.canadian_diploma === 'yes'),
            wcep_advantage_summary: aiResult.data.wcep_advantage_summary || null
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
                rec.has_canadian_diploma = fullData.has_canadian_diploma || false;
                rec.wcep_advantage_summary = fullData.wcep_advantage_summary || null;
            } catch (e) {
                // JSON değilse eski format - ai_reasoning düz metin olarak kalır
                console.log('ai_reasoning is not JSON, using as plain text');
                rec.has_canadian_diploma = false;
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
