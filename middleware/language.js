const tr = require('../locales/tr');
const en = require('../locales/en');

const locales = { tr, en };

// Dil middleware'i
const languageMiddleware = (req, res, next) => {
    // Query string'den veya cookie'den dil tercihini al
    const queryLanguage = req.query.lang;
    const cookieLanguage = req.cookies.language;
    const userLanguage = queryLanguage || cookieLanguage || 'tr';
    
    console.log('Language middleware - Query:', queryLanguage, 'Cookie:', cookieLanguage, 'Final:', userLanguage);
    
    // Desteklenen diller
    const supportedLanguages = ['tr', 'en'];
    
    // Geçerli dili kontrol et
    const currentLanguage = supportedLanguages.includes(userLanguage) ? userLanguage : 'tr';
    
    console.log('Current language set to:', currentLanguage);
    
    // Locale verilerini res.locals'a ekle
    res.locals.currentLanguage = currentLanguage;
    res.locals.locales = locales;
    res.locals.t = locales[currentLanguage];
    
    // Dil değiştirme fonksiyonu
    res.locals.changeLanguage = (lang) => {
        if (supportedLanguages.includes(lang)) {
            res.cookie('language', lang, { 
                maxAge: 365 * 24 * 60 * 60 * 1000, // 1 yıl
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });
            return true;
        }
        return false;
    };
    
    next();
};

module.exports = languageMiddleware; 