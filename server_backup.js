const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const https = require('https');
const fs = require('fs');
const helmet = require('helmet');
const expressLayouts = require('express-ejs-layouts');

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            frameSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://ventureglobal.com', 'https://www.ventureglobal.com']
        : true,
    credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public', {
    maxAge: '1y',
    etag: true
}));

// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
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

// Routes
app.get('/', (req, res) => {
    res.render('index', { title: 'Ana Sayfa' });
});

app.get('/services', (req, res) => {
    res.render('services', { title: 'Hizmetler' });
});

app.get('/universities', (req, res) => {
    res.render('universities', { title: 'Üniversiteler' });
});

app.get('/documents', (req, res) => {
    res.render('documents', { title: 'Belgeler' });
});

app.get('/contact', (req, res) => {
    res.render('contact', { title: 'İletişim' });
});

app.get('/assessment', (req, res) => {
    res.render('assessment', { title: 'Değerlendirme' });
});

app.get('/university/tum', (req, res) => {
    res.render('university-detail', { 
        title: 'Technical University of Munich',
        university: {
            name: 'Technical University of Munich',
            shortName: 'TUM',
            location: 'Münih, Almanya',
            logo: '/images/tum-logo.svg',
            description: 'Almanya\'nın en prestijli teknik üniversitelerinden biri. Mühendislik ve teknoloji alanlarında dünya çapında tanınır.',
            tuition: '2,000-6,000€/Yıl',
            programs: [
                'Yönetim ve Teknoloji (B.Sc.)',
                'Elektronik ve Veri Mühendisliği (B.Eng.)',
                'Havacılık Mühendisliği',
                'Biyomedikal Mühendisliği ve Tıbbi Fizik',
                'Biyomedikal Nörobilim',
                'Kimyasal Biyoteknoloji',
                'İnşaat Mühendisliği',
                'İletişim Mühendisliği',
                'Hesaplamalı Bilim ve Mühendislik',
                'Veri Mühendisliği ve Analitik',
                'Bilişim (Bilgisayar Bilimi ve Oyun Mühendisliği)',
                'Bilgi Sistemleri',
                'Biyoekonomi, Tarımsal Biyobilimler',
                'Arazi Yönetimi ve Coğrafi Bilimler',
                'Politika ve Teknoloji',
                'Tüketici Bilimi ve Spor Bilimi'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'Dünya sıralamasında ilk 50',
            qsRanking: '19 (Makine, Havacılık & Üretim Mühendisliği)',
            language: 'Almanca, İngilizce',
            applicationDeadline: '15 Temmuz (Kış dönemi), 15 Ocak (Yaz dönemi)',
            requirements: [
                'Lise diploması',
                'Almanca (Bölüme göre değişiklik gösterebilir)',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları'
            ]
        }
    });
});

app.get('/university/ctu', (req, res) => {
    res.render('university-detail', {
        title: 'Czech Technical University in Prague',
        university: {
            name: 'Czech Technical University in Prague',
            shortName: 'CTU',
            location: 'Prag, Çek Cumhuriyeti',
            logo: '/images/logos/ctu-logo.svg',
            description: 'Çekya\'nın en köklü ve prestijli teknik üniversitelerinden biri. Mühendislik, teknoloji ve mimarlık alanlarında Avrupa\'nın önde gelen kurumlarından.',
            tuition: '3,800€/Yıl',
            programs: [
                'Makine Mühendisliği',
                'Elektrik Mühendisliği',
                'Bilgisayar Bilimleri',
                'İnşaat Mühendisliği',
                'Mimarlık',
                'Biyomedikal Mühendislik',
                'Ulaşım Bilimleri',
                'Nükleer Bilimler ve Fizik Mühendisliği',
                'Bilişim Sistemleri',
                'Robotik',
                'Yapay Zeka',
                'Çevre Mühendisliği'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 432 (2024)',
            qsRanking: '151-200 (Elektrik & Elektronik Mühendisliği)',
            language: 'İngilizce, Çekçe',
            applicationDeadline: '31 Mart (Lisans), 30 Nisan (Yüksek Lisans)',
            requirements: [
                'Lise diploması',
                'İngilizce veya Çekçe yeterlilik belgesi',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu'
            ]
        }
    });
});

app.get('/university/charles', (req, res) => {
    res.render('university-detail', {
        title: 'Charles University',
        university: {
            name: 'Charles University',
            shortName: 'CUNI',
            location: 'Prag, Çek Cumhuriyeti',
            logo: '/images/logos/cuni-logo.svg',
            description: 'Orta Avrupa\'nın en eski ve en prestijli üniversitelerinden biri. Tıp, sosyal bilimler, beşeri bilimler ve doğa bilimleri alanlarında uluslararası üne sahiptir.',
            tuition: '4,000€/Yıl',
            programs: [
                'Tıp',
                'Diş Hekimliği',
                'Eczacılık',
                'Psikoloji',
                'Biyoloji',
                'Fizik',
                'Kimya',
                'Matematik',
                'Sosyoloji',
                'Felsefe',
                'Tarih',
                'Dil Bilimleri',
                'Ekonomi',
                'Uluslararası İlişkiler',
                'Hukuk',
                'Bilişim'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 248 (2024)',
            qsRanking: '201-250 (Yaşam Bilimleri & Tıp)',
            language: 'İngilizce, Çekçe',
            applicationDeadline: '30 Nisan (çoğu program için)',
            requirements: [
                'Lise diploması',
                'İngilizce veya Çekçe yeterlilik belgesi',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu',
                'Bazı bölümler için giriş sınavı'
            ]
        }
    });
});

// API Routes
app.post('/api/assessment', (req, res) => {
    const { educationLevel, country, program, budget } = req.body;
    
    // Input validation
    if (!educationLevel || !country || !program || !budget) {
        return res.status(400).json({
            success: false,
            error: 'Tüm alanlar zorunludur'
        });
    }
    
    // Sanitize inputs
    const sanitizedData = {
        educationLevel: String(educationLevel).trim(),
        country: String(country).trim(),
        program: String(program).trim(),
        budget: String(budget).trim()
    };
    
    // Burada kullanıcının verdiği bilgilere göre öneriler oluşturulacak
    const recommendations = generateRecommendations(
        sanitizedData.educationLevel, 
        sanitizedData.country, 
        sanitizedData.program, 
        sanitizedData.budget
    );
    
    res.json({
        success: true,
        recommendations: recommendations
    });
});

function generateRecommendations(educationLevel, country, program, budget) {
    // Basit öneri sistemi - gerçek uygulamada daha gelişmiş olacak
    const recommendations = {
        universities: [],
        languageSchools: [],
        documents: []
    };
    
    // Eğitim seviyesine göre üniversite önerileri
    if (educationLevel === 'bachelor') {
        recommendations.universities = [
            'Technical University of Munich, Germany',
            'Politecnico di Milano, Italy',
            'Charles University, Czech Republic',
            'University of Vienna, Austria'
        ];
    } else if (educationLevel === 'master') {
        recommendations.universities = [
            'Technical University of Dresden, Germany',
            'Sapienza University of Rome, Italy',
            'Brno University of Technology, Czech Republic',
            'University of Florence, Italy'
        ];
    }
    
    // Dil okulu önerileri
    recommendations.languageSchools = [
        'Goethe-Institut, Germany',
        'Alliance Française, France',
        'Instituto Cervantes, Spain',
        'British Council, UK'
    ];
    
    // Gerekli belgeler
    recommendations.documents = [
        'Pasaport kopyası',
        'Diploma ve transkript',
        'Dil yeterlilik belgesi (IELTS/TOEFL veya üniversite sınavı)',
        'Motivasyon mektubu',
        'Referans mektupları',
        'Finansal garanti belgesi'
    ];
    
    return recommendations;
}

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

// HTTPS Server (for development with self-signed certificate)
try {
    const httpsOptions = {
        key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
    };
    
    https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
        console.log(`Venture Global web sitesi HTTPS ${HTTPS_PORT} portunda çalışıyor`);
        console.log(`https://localhost:${HTTPS_PORT} adresinden erişebilirsiniz`);
    });
} catch (error) {
    console.log('HTTPS sertifikası bulunamadı. SSL sertifikalarını oluşturun.');
    console.log('HTTPS için ssl klasöründe key.pem ve cert.pem dosyaları oluşturun.');
    process.exit(1);
}
    res.render('university-detail', {
        title: 'Technical University of Dresden',
        university: {
            name: 'Technical University of Dresden',
            shortName: 'TUD',
            location: 'Dresden, Almanya',
            logo: '/images/logos/tud-logo.svg',
            description: 'Saksonya\'nın en büyük ve en prestijli üniversitesi. Mühendislik, tıp ve doğa bilimleri alanlarında güçlü programlar sunar.',
            tuition: '1,500€/Yıl',
            programs: [
                'Makine Mühendisliği',
                'Elektrik Mühendisliği',
                'Bilgisayar Mühendisliği',
                'İnşaat Mühendisliği',
                'Endüstri Mühendisliği',
                'Tıp',
                'Diş Hekimliği',
                'Eczacılık',
                'Fizik',
                'Kimya',
                'Biyoloji',
                'Matematik',
                'Ekonomi',
                'İşletme',
                'Psikoloji',
                'Eğitim Bilimleri'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 201-250 (2024)',
            qsRanking: '151-200 (Makine Mühendisliği)',
            language: 'Almanca, İngilizce',
            applicationDeadline: '15 Temmuz (Kış dönemi), 15 Ocak (Yaz dönemi)',
            requirements: [
                'Lise diploması (Abitur veya eşdeğeri)',
                'Almanca yeterlilik belgesi (DSH-2 veya TestDaF 4)',
                'İngilizce programlar için IELTS 6.5 veya TOEFL 90',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu',
                'Bazı bölümler için giriş sınavı'
            ]
        }
    });
});

app.get('/university/polimi', (req, res) => {
    res.render('university-detail', {
        title: 'Politecnico di Milano',
        university: {
            name: 'Politecnico di Milano',
            shortName: 'POLIMI',
            location: 'Milano, İtalya',
            logo: '/images/logos/polimi-logo.svg',
            description: 'İtalya\'nın en prestijli teknik üniversitesi. Mühendislik, mimarlık ve tasarım alanlarında dünya çapında tanınır.',
            tuition: '3,500€/Yıl',
            programs: [
                'Mimarlık',
                'Endüstriyel Tasarım',
                'Makine Mühendisliği',
                'Elektrik Mühendisliği',
                'Bilgisayar Mühendisliği',
                'İnşaat Mühendisliği',
                'Uçak Mühendisliği',
                'Uzay Mühendisliği',
                'Kimya Mühendisliği',
                'Biyomedikal Mühendisliği',
                'Enerji Mühendisliği',
                'Çevre Mühendisliği',
                'Yönetim Mühendisliği',
                'Matematik Mühendisliği',
                'Fizik Mühendisliği',
                'İnşaat ve Çevre Mühendisliği'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 123 (2024)',
            qsRanking: '5 (Sanat & Tasarım)',
            language: 'İtalyanca, İngilizce',
            applicationDeadline: '30 Nisan (çoğu program için)',
            requirements: [
                'Lise diploması',
                'İtalyanca yeterlilik belgesi (B2 seviyesi)',
                'İngilizce programlar için IELTS 6.0 veya TOEFL 80',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu',
                'Portfolio (tasarım bölümleri için)',
                'Giriş sınavı (bazı bölümler için)'
            ]
        }
    });
});

app.get('/university/sapienza', (req, res) => {
    res.render('university-detail', {
        title: 'Sapienza University of Rome',
        university: {
            name: 'Sapienza University of Rome',
            shortName: 'SAPIENZA',
            location: 'Roma, İtalya',
            logo: '/images/logos/sapienza-logo.svg',
            description: 'Roma\'nın en eski ve prestijli üniversitesi. Tıp, hukuk, sosyal bilimler ve beşeri bilimler alanlarında güçlü.',
            tuition: '2,800€/Yıl',
            programs: [
                'Tıp',
                'Diş Hekimliği',
                'Eczacılık',
                'Hukuk',
                'Ekonomi',
                'İşletme',
                'Psikoloji',
                'Sosyoloji',
                'Felsefe',
                'Tarih',
                'Arkeoloji',
                'Klasik Filoloji',
                'Dil Bilimleri',
                'Fizik',
                'Kimya',
                'Biyoloji',
                'Matematik',
                'Mühendislik',
                'Mimarlık',
                'Veterinerlik'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 134 (2024)',
            qsRanking: '44 (Klasikler & Antik Tarih)',
            language: 'İtalyanca, İngilizce',
            applicationDeadline: '30 Nisan (çoğu program için)',
            requirements: [
                'Lise diploması',
                'İtalyanca yeterlilik belgesi (B2 seviyesi)',
                'İngilizce programlar için IELTS 6.0 veya TOEFL 80',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu',
                'Giriş sınavı (tıp, diş hekimliği, mimarlık için)'
            ]
        }
    });
});

app.get('/university/unifi', (req, res) => {
    res.render('university-detail', {
        title: 'University of Florence',
        university: {
            name: 'University of Florence',
            shortName: 'UNIFI',
            location: 'Floransa, İtalya',
            logo: '/images/logos/unifi-logo.svg',
            description: 'Rönesans şehrinin prestijli üniversitesi. Sanat, beşeri bilimler, sosyal bilimler ve doğa bilimleri alanlarında güçlü.',
            tuition: '2,500€/Yıl',
            programs: [
                'Sanat Tarihi',
                'Mimarlık',
                'Tasarım',
                'Müzik',
                'Tiyatro',
                'Psikoloji',
                'Sosyoloji',
                'Felsefe',
                'Tarih',
                'Arkeoloji',
                'Dil Bilimleri',
                'Edebiyat',
                'Ekonomi',
                'İşletme',
                'Hukuk',
                'Tıp',
                'Eczacılık',
                'Fizik',
                'Kimya',
                'Biyoloji',
                'Matematik',
                'Mühendislik'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 451-500 (2024)',
            qsRanking: '51-100 (Sanat & Tasarım)',
            language: 'İtalyanca, İngilizce',
            applicationDeadline: '30 Nisan (çoğu program için)',
            requirements: [
                'Lise diploması',
                'İtalyanca yeterlilik belgesi (B2 seviyesi)',
                'İngilizce programlar için IELTS 6.0 veya TOEFL 80',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu',
                'Portfolio (sanat ve tasarım bölümleri için)',
                'Giriş sınavı (bazı bölümler için)'
            ]
        }
    });
});

app.get('/university/vut', (req, res) => {
    res.render('university-detail', {
        title: 'Brno University of Technology',
        university: {
            name: 'Brno University of Technology',
            shortName: 'VUT',
            location: 'Brno, Çek Cumhuriyeti',
            logo: '/images/logos/vut-logo.svg',
            description: 'Çek Cumhuriyeti\'nin en büyük teknik üniversitesi. Mühendislik ve teknoloji alanlarında güçlü programlar sunar.',
            tuition: '3,200€/Yıl',
            programs: [
                'Makine Mühendisliği',
                'Elektrik Mühendisliği',
                'Bilgisayar Mühendisliği',
                'İnşaat Mühendisliği',
                'Kimya Mühendisliği',
                'Endüstriyel Tasarım',
                'Mimarlık',
                'Uçak Mühendisliği',
                'Enerji Mühendisliği',
                'Çevre Mühendisliği',
                'Biyomedikal Mühendisliği',
                'Malzeme Mühendisliği',
                'Yönetim Mühendisliği',
                'Fizik Mühendisliği',
                'Matematik Mühendisliği',
                'İnşaat ve Çevre Mühendisliği'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 801-1000 (2024)',
            qsRanking: '401-450 (Makine Mühendisliği)',
            language: 'Çekçe, İngilizce',
            applicationDeadline: '30 Nisan (çoğu program için)',
            requirements: [
                'Lise diploması',
                'Çekçe yeterlilik belgesi (B2 seviyesi)',
                'İngilizce programlar için IELTS 6.0 veya TOEFL 80',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu',
                'Giriş sınavı (bazı bölümler için)'
            ]
        }
    });
});

app.get('/university/vsb', (req, res) => {
    res.render('university-detail', {
        title: 'VSB Technical University of Ostrava',
        university: {
            name: 'VSB Technical University of Ostrava',
            shortName: 'VSB',
            location: 'Ostrava, Çek Cumhuriyeti',
            logo: '/images/logos/vsb-logo.svg',
            description: 'Moravya-Silezya bölgesinin prestijli teknik üniversitesi. Mühendislik ve teknoloji alanlarında güçlü.',
            tuition: '3,500€/Yıl',
            programs: [
                'Makine Mühendisliği',
                'Elektrik Mühendisliği',
                'Bilgisayar Mühendisliği',
                'İnşaat Mühendisliği',
                'Kimya Mühendisliği',
                'Endüstriyel Tasarım',
                'Mimarlık',
                'Uçak Mühendisliği',
                'Enerji Mühendisliği',
                'Çevre Mühendisliği',
                'Biyomedikal Mühendisliği',
                'Malzeme Mühendisliği',
                'Yönetim Mühendisliği',
                'Fizik Mühendisliği',
                'Matematik Mühendisliği',
                'İnşaat ve Çevre Mühendisliği'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 1001+ (2024)',
            qsRanking: '32 (Sanat & Beşeri Bilimler)',
            language: 'Çekçe, İngilizce',
            applicationDeadline: '30 Nisan (çoğu program için)',
            requirements: [
                'Lise diploması',
                'Çekçe yeterlilik belgesi (B2 seviyesi)',
                'İngilizce programlar için IELTS 6.0 veya TOEFL 80',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu',
                'Giriş sınavı (bazı bölümler için)'
            ]
        }
    });
});

app.get('/university/univie', (req, res) => {
    res.render('university-detail', {
        title: 'University of Vienna',
        university: {
            name: 'University of Vienna',
            shortName: 'UNIVIE',
            location: 'Viyana, Avusturya',
            logo: '/images/logos/univie-logo.svg',
            description: 'Avusturya\'nın en eski ve prestijli üniversitesi. Tıp, işletme, sosyal bilimler ve doğa bilimleri alanlarında güçlü.',
            tuition: '1,500€/Yıl',
            programs: [
                'Tıp',
                'Diş Hekimliği',
                'Eczacılık',
                'Ekonomi',
                'İşletme',
                'Hukuk',
                'Psikoloji',
                'Sosyoloji',
                'Felsefe',
                'Tarih',
                'Arkeoloji',
                'Dil Bilimleri',
                'Edebiyat',
                'Fizik',
                'Kimya',
                'Biyoloji',
                'Matematik',
                'Bilgisayar Bilimi',
                'Eğitim Bilimleri',
                'Veterinerlik'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 151 (2024)',
            qsRanking: '251-300 (Kimya Mühendisliği)',
            language: 'Almanca, İngilizce',
            applicationDeadline: '5 Eylül (Kış dönemi), 5 Şubat (Yaz dönemi)',
            requirements: [
                'Lise diploması',
                'Almanca yeterlilik belgesi (B2 seviyesi)',
                'İngilizce programlar için IELTS 6.0 veya TOEFL 80',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu',
                'Giriş sınavı (tıp, diş hekimliği için)'
            ]
        }
    });
});

app.get('/university/vscht', (req, res) => {
    res.render('university-detail', {
        title: 'University of Chemistry and Technology, Prague',
        university: {
            name: 'University of Chemistry and Technology, Prague',
            shortName: 'VSCHT',
            location: 'Prag, Çek Cumhuriyeti',
            logo: '/images/logos/vscht-logo.png',
            description: 'Çekya\'nın önde gelen kimya ve teknoloji üniversitesi. Kimya, biyoteknoloji ve mühendislik alanlarında uzmanlaşmış.',
            tuition: '3,500€/Yıl',
            programs: [
                'Kimya Mühendisliği',
                'Biyoteknoloji',
                'Gıda Teknolojisi',
                'Çevre Teknolojisi',
                'Malzeme Bilimi',
                'Enerji Teknolojisi',
                'Fiziksel Kimya',
                'Analitik Kimya',
                'Organik Kimya',
                'İnorganik Kimya',
                'Biyokimya',
                'Mikrobiyoloji',
                'Endüstriyel Kimya',
                'Petrol Teknolojisi',
                'Polimer Teknolojisi',
                'Nano Teknolojisi'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 451-500 (2024)',
            qsRanking: '201-250 (Elektrik & Elektronik Mühendisliği)',
            language: 'Çekçe, İngilizce',
            applicationDeadline: '30 Nisan (çoğu program için)',
            requirements: [
                'Lise diploması',
                'Çekçe yeterlilik belgesi (B2 seviyesi)',
                'İngilizce programlar için IELTS 6.0 veya TOEFL 80',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu',
                'Giriş sınavı (bazı bölümler için)'
            ]
        }
    });
});

app.get('/university/metropolitan', (req, res) => {
    res.render('university-detail', {
        title: 'Metropolitan University of Prague',
        university: {
            name: 'Metropolitan University of Prague',
            shortName: 'MUP',
            location: 'Prag, Çek Cumhuriyeti',
            logo: '/images/metropolitan-logo.png',
            description: 'Uluslararası ilişkiler, hukuk ve işletme alanlarında güçlü programlar sunan modern bir üniversite.',
            tuition: '3,000€/Yıl',
            programs: [
                'Uluslararası İlişkiler',
                'Avrupa Çalışmaları',
                'Hukuk',
                'İşletme',
                'Ekonomi',
                'Pazarlama',
                'Finans',
                'İnsan Kaynakları',
                'Turizm Yönetimi',
                'Medya ve İletişim',
                'Sosyoloji',
                'Siyaset Bilimi',
                'Tarih',
                'Dil Bilimleri',
                'Çeviri ve Tercümanlık',
                'Kültürel Çalışmalar'
            ],
            levels: ['Lisans', 'Yüksek Lisans'],
            ranking: 'QS Dünya Sıralaması: 1201+ (2024)',
            qsRanking: '1201+ (Genel)',
            language: 'Çekçe, İngilizce',
            applicationDeadline: '30 Nisan (çoğu program için)',
            requirements: [
                'Lise diploması',
                'Çekçe yeterlilik belgesi (B2 seviyesi)',
                'İngilizce programlar için IELTS 6.0 veya TOEFL 80',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu'
            ]
        }
    });
});

app.get('/university/czu', (req, res) => {
    res.render('university-detail', {
        title: 'Czech University of Life Sciences Prague',
        university: {
            name: 'Czech University of Life Sciences Prague',
            shortName: 'CZU',
            location: 'Prag, Çek Cumhuriyeti',
            logo: '/images/czu-logo.png',
            description: 'Tarım, çevre bilimleri ve işletme alanlarında uzmanlaşmış, yenilikçi bir üniversite.',
            tuition: '2,500€/Yıl',
            programs: [
                'Tarım',
                'Zootekni',
                'Çevre Bilimleri',
                'Ormancılık',
                'Bahçe Bitkileri',
                'Gıda Güvenliği',
                'Sürdürülebilir Kalkınma',
                'İşletme',
                'Ekonomi',
                'Pazarlama',
                'Finans',
                'Turizm',
                'Kırsal Kalkınma',
                'Doğal Kaynak Yönetimi',
                'Biyoteknoloji',
                'Hayvan Sağlığı'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 801-1000 (2024)',
            qsRanking: '251-300 (Tarım & Ormancılık)',
            language: 'Çekçe, İngilizce',
            applicationDeadline: '30 Nisan (çoğu program için)',
            requirements: [
                'Lise diploması',
                'Çekçe yeterlilik belgesi (B2 seviyesi)',
                'İngilizce programlar için IELTS 6.0 veya TOEFL 80',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu'
            ]
        }
    });
});

app.get('/university/manchester', (req, res) => {
    res.render('university-detail', {
        title: 'Manchester University',
        university: {
            name: 'Manchester University',
            shortName: 'UOM',
            location: 'Manchester, İngiltere',
            logo: '/images/manchester-logo.png',
            description: 'İngiltere\'nin en büyük ve prestijli üniversitelerinden biri. Bilim, mühendislik ve işletme alanlarında güçlü.',
            tuition: '9,250£/Yıl',
            programs: [
                'Mühendislik',
                'Bilgisayar Bilimi',
                'Fizik',
                'Kimya',
                'Biyoloji',
                'Matematik',
                'Tıp',
                'Diş Hekimliği',
                'Eczacılık',
                'Hemşirelik',
                'Psikoloji',
                'Ekonomi',
                'İşletme',
                'Hukuk',
                'Sosyoloji',
                'Politika',
                'Tarih',
                'Edebiyat',
                'Dil Bilimleri',
                'Müzik',
                'Mimarlık'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 32 (2024)',
            qsRanking: '22 (Hemşirelik)',
            language: 'İngilizce',
            applicationDeadline: '15 Ocak (UCAS başvuru tarihi)',
            requirements: [
                'Lise diploması (A-Levels veya eşdeğeri)',
                'İngilizce yeterlilik belgesi (IELTS 6.5-7.0)',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'UCAS başvuru formu',
                'Giriş sınavı (bazı bölümler için)',
                'Portfolio (sanat ve tasarım bölümleri için)'
            ]
        }
    });
});

app.get('/university/masaryk', (req, res) => {
    res.render('university-detail', {
        title: 'Masaryk University',
        university: {
            name: 'Masaryk University',
            shortName: 'MUNI',
            location: 'Brno, Çek Cumhuriyeti',
            logo: '/images/masaryk-logo.png',
            description: 'Çekya\'nın en büyük ikinci üniversitesi. Tıp, fen ve sosyal bilimler alanlarında öne çıkar.',
            tuition: '3,000€/Yıl',
            programs: [
                'Tıp',
                'Diş Hekimliği',
                'Eczacılık',
                'Veterinerlik',
                'Psikoloji',
                'Sosyoloji',
                'Politika',
                'Ekonomi',
                'İşletme',
                'Hukuk',
                'Fizik',
                'Kimya',
                'Biyoloji',
                'Matematik',
                'Bilgisayar Bilimi',
                'Eğitim Bilimleri',
                'Dil Bilimleri',
                'Tarih',
                'Felsefe',
                'Arkeoloji'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 601-650 (2024)',
            qsRanking: '401-450 (Yaşam Bilimleri & Tıp)',
            language: 'Çekçe, İngilizce',
            applicationDeadline: '30 Nisan (çoğu program için)',
            requirements: [
                'Lise diploması',
                'Çekçe yeterlilik belgesi (B2 seviyesi)',
                'İngilizce programlar için IELTS 6.0 veya TOEFL 80',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu',
                'Giriş sınavı (tıp, diş hekimliği için)'
            ]
        }
    });
});

app.get('/university/unyp', (req, res) => {
    res.render('university-detail', {
        title: 'University of New York in Prague',
        university: {
            name: 'University of New York in Prague',
            shortName: 'UNYP',
            location: 'Prag, Çek Cumhuriyeti',
            logo: '/images/unyp-logo.png',
            description: 'Amerikan tarzı eğitim sunan, işletme, psikoloji ve iletişim alanlarında öne çıkan bir üniversite.',
            tuition: '6,000€/Yıl',
            programs: [
                'İşletme Yönetimi',
                'Uluslararası İşletme',
                'Pazarlama',
                'Finans',
                'Psikoloji',
                'İletişim',
                'Medya Çalışmaları',
                'Gazetecilik',
                'Halkla İlişkiler',
                'Reklamcılık',
                'Dijital Medya',
                'Sosyal Medya',
                'İnsan Kaynakları',
                'Turizm Yönetimi',
                'Olay Yönetimi',
                'Spor Yönetimi'
            ],
            levels: ['Lisans', 'Yüksek Lisans'],
            ranking: 'QS Dünya Sıralaması: Yok',
            qsRanking: 'Yok',
            language: 'İngilizce',
            applicationDeadline: 'Rolling admission (sürekli başvuru)',
            requirements: [
                'Lise diploması',
                'İngilizce yeterlilik belgesi (IELTS 6.0 veya TOEFL 80)',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu',
                'Mülakat (bazı bölümler için)'
            ]
        }
    });
});

app.get('/university/bologna', (req, res) => {
    res.render('university-detail', {
        title: 'University of Bologna',
        university: {
            name: 'University of Bologna',
            shortName: 'UNIBO',
            location: 'Bologna, İtalya',
            logo: '/images/bologna-logo.png',
            description: 'Dünyanın en eski üniversitelerinden biri. Sanat, hukuk, fen ve mühendislik alanlarında zengin programlar sunar.',
            tuition: '3,000€/Yıl',
            programs: [
                'Hukuk',
                'Ekonomi',
                'İşletme',
                'Tıp',
                'Diş Hekimliği',
                'Eczacılık',
                'Psikoloji',
                'Sosyoloji',
                'Felsefe',
                'Tarih',
                'Arkeoloji',
                'Klasik Filoloji',
                'Dil Bilimleri',
                'Edebiyat',
                'Sanat Tarihi',
                'Müzik',
                'Mimarlık',
                'Mühendislik',
                'Fizik',
                'Kimya',
                'Biyoloji',
                'Matematik',
                'Bilgisayar Bilimi'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 154 (2024)',
            qsRanking: '21 (Klasikler & Antik Tarih)',
            language: 'İtalyanca, İngilizce',
            applicationDeadline: '30 Nisan (çoğu program için)',
            requirements: [
                'Lise diploması',
                'İtalyanca yeterlilik belgesi (B2 seviyesi)',
                'İngilizce programlar için IELTS 6.0 veya TOEFL 80',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu',
                'Giriş sınavı (tıp, diş hekimliği, mimarlık için)'
            ]
        }
    });
});

app.get('/university/pecs', (req, res) => {
    res.render('university-detail', {
        title: 'University of Pecs',
        university: {
            name: 'University of Pecs',
            shortName: 'PTE',
            location: 'Pecs, Macaristan',
            logo: '/images/pecs-logo.png',
            description: 'Macaristan\'ın en eski üniversitesi. Tıp, sanat ve işletme alanlarında güçlü programlara sahip.',
            tuition: '4,000€/Yıl',
            programs: [
                'Tıp',
                'Diş Hekimliği',
                'Eczacılık',
                'Hemşirelik',
                'Fizyoterapi',
                'Psikoloji',
                'Sosyoloji',
                'Ekonomi',
                'İşletme',
                'Hukuk',
                'Politika',
                'Tarih',
                'Arkeoloji',
                'Dil Bilimleri',
                'Edebiyat',
                'Sanat Tarihi',
                'Müzik',
                'Tiyatro',
                'Fizik',
                'Kimya',
                'Biyoloji',
                'Matematik'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 801-1000 (2024)',
            qsRanking: '451-500 (Tıp)',
            language: 'Macarca, İngilizce',
            applicationDeadline: '30 Nisan (çoğu program için)',
            requirements: [
                'Lise diploması',
                'Macarca yeterlilik belgesi (B2 seviyesi)',
                'İngilizce programlar için IELTS 6.0 veya TOEFL 80',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu',
                'Giriş sınavı (tıp, diş hekimliği için)'
            ]
        }
    });
});

app.get('/university/warsaw', (req, res) => {
    res.render('university-detail', {
        title: 'University of Warsaw',
        university: {
            name: 'University of Warsaw',
            shortName: 'UW',
            location: 'Varşova, Polonya',
            logo: '/images/warsaw-logo.png',
            description: 'Polonya\'nın en büyük üniversitesi. Fen, sanat ve işletme alanlarında zengin programlar sunar.',
            tuition: '2,500€/Yıl',
            programs: [
                'Fizik',
                'Kimya',
                'Biyoloji',
                'Matematik',
                'Bilgisayar Bilimi',
                'Psikoloji',
                'Sosyoloji',
                'Politika',
                'Ekonomi',
                'İşletme',
                'Hukuk',
                'Tarih',
                'Arkeoloji',
                'Dil Bilimleri',
                'Edebiyat',
                'Felsefe',
                'Sanat Tarihi',
                'Müzik',
                'Tiyatro',
                'Gazetecilik',
                'Uluslararası İlişkiler'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 301-350 (2024)',
            qsRanking: '101-150 (Dilbilim)',
            language: 'Lehçe, İngilizce',
            applicationDeadline: '30 Nisan (çoğu program için)',
            requirements: [
                'Lise diploması',
                'Lehçe yeterlilik belgesi (B2 seviyesi)',
                'İngilizce programlar için IELTS 6.0 veya TOEFL 80',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu',
                'Giriş sınavı (bazı bölümler için)'
            ]
        }
    });
});

app.get('/university/wut', (req, res) => {
    res.render('university-detail', {
        title: 'Warsaw University of Technology',
        university: {
            name: 'Warsaw University of Technology',
            shortName: 'WUT',
            location: 'Varşova, Polonya',
            logo: '/images/wut-logo.png',
            description: 'Polonya\'nın en iyi teknik üniversitelerinden biri. Mühendislik ve teknoloji alanlarında öne çıkar.',
            tuition: '2,800€/Yıl',
            programs: [
                'Makine Mühendisliği',
                'Elektrik Mühendisliği',
                'Bilgisayar Mühendisliği',
                'İnşaat Mühendisliği',
                'Kimya Mühendisliği',
                'Endüstriyel Tasarım',
                'Mimarlık',
                'Uçak Mühendisliği',
                'Enerji Mühendisliği',
                'Çevre Mühendisliği',
                'Biyomedikal Mühendisliği',
                'Malzeme Mühendisliği',
                'Yönetim Mühendisliği',
                'Fizik Mühendisliği',
                'Matematik Mühendisliği',
                'İnşaat ve Çevre Mühendisliği'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 501-510 (2024)',
            qsRanking: '201-250 (Elektrik & Elektronik Mühendisliği)',
            language: 'Lehçe, İngilizce',
            applicationDeadline: '30 Nisan (çoğu program için)',
            requirements: [
                'Lise diploması',
                'Lehçe yeterlilik belgesi (B2 seviyesi)',
                'İngilizce programlar için IELTS 6.0 veya TOEFL 80',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'Online başvuru formu',
                'Giriş sınavı (bazı bölümler için)'
            ]
        }
    });
});

app.get('/university/stirling', (req, res) => {
    res.render('university-detail', {
        title: 'University of Stirling',
        university: {
            name: 'University of Stirling',
            shortName: 'STIRLING',
            location: 'Stirling, İskoçya',
            logo: '/images/stirling-logo.png',
            description: 'İskoçya\'nın önde gelen üniversitelerinden biri. Sosyal bilimler, fen ve işletme alanlarında güçlüdür.',
            tuition: '7,000£/Yıl',
            programs: [
                'Spor Bilimleri',
                'Psikoloji',
                'Sosyoloji',
                'Politika',
                'Ekonomi',
                'İşletme',
                'Finans',
                'Pazarlama',
                'Turizm',
                'Eğitim',
                'Gazetecilik',
                'Medya Çalışmaları',
                'Fizik',
                'Kimya',
                'Biyoloji',
                'Matematik',
                'Bilgisayar Bilimi',
                'Çevre Bilimleri',
                'Tarih',
                'Dil Bilimleri',
                'Edebiyat',
                'Felsefe'
            ],
            levels: ['Lisans', 'Yüksek Lisans', 'Doktora'],
            ranking: 'QS Dünya Sıralaması: 501-510 (2024)',
            qsRanking: '51-100 (Spor Bilimleri)',
            language: 'İngilizce',
            applicationDeadline: '15 Ocak (UCAS başvuru tarihi)',
            requirements: [
                'Lise diploması (A-Levels veya eşdeğeri)',
                'İngilizce yeterlilik belgesi (IELTS 6.0-6.5)',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'UCAS başvuru formu',
                'Giriş sınavı (bazı bölümler için)'
            ]
        }
    });
});

app.get('/university/winchester', (req, res) => {
    res.render('university-detail', {
        title: 'University of Winchester',
        university: {
            name: 'University of Winchester',
            shortName: 'WINCHESTER',
            location: 'Winchester, İngiltere',
            logo: '/images/winchester-logo.png',
            description: 'İngiltere\'nin köklü üniversitelerinden biri. Sanat, eğitim ve sosyal bilimler alanlarında öne çıkar.',
            tuition: '9,250£/Yıl',
            programs: [
                'Eğitim',
                'Öğretmenlik',
                'Psikoloji',
                'Sosyoloji',
                'Politika',
                'Tarih',
                'Arkeoloji',
                'Dil Bilimleri',
                'Edebiyat',
                'İngiliz Dili ve Edebiyatı',
                'Yaratıcı Yazarlık',
                'Gazetecilik',
                'Medya Çalışmaları',
                'Müzik',
                'Tiyatro',
                'Sanat Tarihi',
                'Felsefe',
                'Din Çalışmaları',
                'Sosyal Hizmet',
                'Kriminoloji',
                'Uluslararası İlişkiler'
            ],
            levels: ['Lisans', 'Yüksek Lisans'],
            ranking: 'QS Dünya Sıralaması: 801-1000 (2024)',
            qsRanking: '801-1000 (Genel)',
            language: 'İngilizce',
            applicationDeadline: '15 Ocak (UCAS başvuru tarihi)',
            requirements: [
                'Lise diploması (A-Levels veya eşdeğeri)',
                'İngilizce yeterlilik belgesi (IELTS 6.0-6.5)',
                'Motivasyon mektubu',
                'CV',
                'Referans mektupları',
                'UCAS başvuru formu',
                'Portfolio (sanat bölümleri için)',
                'Mülakat (bazı bölümler için)'
            ]
        }
    });
}); 