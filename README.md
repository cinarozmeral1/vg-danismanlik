# Venture Global - Avrupa Eğitim Danışmanlığı Web Sitesi

Venture Global, Avrupa'da üniversite ve dil okulu danışmanlığı hizmeti veren bir şirketin modern web sitesidir. Bu proje, kullanıcıların eğitim hedeflerine göre kişiye özel öneriler alabilecekleri interaktif bir platform sunar.

## 🚀 Özellikler

### Ana Özellikler
- **Kişiye Özel Değerlendirme**: Öğrencilerin eğitim durumuna göre öneriler
- **Üniversite Listesi**: Avrupa'nın prestijli üniversiteleri
- **Dil Okulu Seçenekleri**: Çeşitli ülkelerde dil eğitimi
- **Belge Danışmanlığı**: Başvuru sürecinde gerekli belgeler
- **İletişim Formu**: Kolay iletişim imkanı

### Teknik Özellikler
- **Responsive Tasarım**: Tüm cihazlarda uyumlu
- **Modern UI/UX**: Bootstrap 5 ve özel CSS
- **İnteraktif Formlar**: JavaScript ile dinamik işlevsellik
- **API Entegrasyonu**: Backend ile iletişim
- **SEO Optimizasyonu**: Arama motoru dostu
- **Vercel Postgres**: Cloud database entegrasyonu

## 🛠️ Teknolojiler

### Frontend
- **HTML5**: Semantik markup
- **CSS3**: Modern styling ve animasyonlar
- **JavaScript (ES6+)**: İnteraktif özellikler
- **Bootstrap 5**: Responsive framework
- **Font Awesome**: İkonlar

### Backend
- **Node.js**: Server-side JavaScript
- **Express.js**: Web framework
- **EJS**: Template engine
- **PostgreSQL**: Relational database
- **Vercel Postgres**: Cloud database service
- **Body Parser**: Form data parsing
- **CORS**: Cross-origin resource sharing

## 🗄️ Database (Vercel Postgres)

### Kurulum
```bash
# Vercel Dashboard'da Postgres database oluşturun
# Environment variables ekleyin:
# DATABASE_URL=postgresql://username:password@host:port/database

# Schema import
npm run migrate:vercel

# Database test
npm run db:test
```

### Özellikler
- **Connection Pooling**: 20 max connections
- **SSL Support**: Production'da zorunlu
- **Auto-scaling**: Vercel ile entegre
- **Backup**: Otomatik yedekleme

## 📁 Proje Yapısı

```
venture-global-website/
├── server.js                    # Ana server dosyası
├── package.json                 # Proje bağımlılıkları
├── README.md                   # Proje dokümantasyonu
├── VERCEL_POSTGRES_SETUP.md   # Vercel Postgres kurulum rehberi
├── config/
│   └── database.js             # Database konfigürasyonu
├── database/
│   ├── init.js                 # Database initialization
│   └── schema.sql              # Database schema
├── scripts/
│   └── migrate-to-vercel.js    # Vercel migration script
├── views/                      # EJS template dosyaları
│   ├── layout.ejs              # Ana layout
│   ├── index.ejs               # Ana sayfa
│   ├── services.ejs            # Hizmetler sayfası
│   ├── universities.ejs        # Üniversiteler sayfası
│   ├── documents.ejs           # Belgeler sayfası
│   ├── assessment.ejs          # Değerlendirme sayfası
│   └── contact.ejs             # İletişim sayfası
└── public/                     # Statik dosyalar
    ├── css/
    │   └── style.css           # Özel CSS stilleri
    ├── js/
    │   └── main.js             # Ana JavaScript dosyası
    └── images/                 # Görseller
```

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler
- Node.js (v14 veya üzeri)
- npm (Node Package Manager)
- Vercel CLI (opsiyonel)

### Kurulum Adımları

1. **Projeyi klonlayın**
```bash
git clone <repository-url>
cd venture-global-website
```

2. **Bağımlılıkları yükleyin**
```bash
npm install
```

3. **Vercel Postgres kurun**
```bash
# Vercel Dashboard'da Postgres database oluşturun
# Environment variables ekleyin
npm run migrate:vercel
```

4. **Uygulamayı başlatın**
```bash
# Geliştirme modu
npm run dev

# Prodüksiyon modu
npm start
```

5. **Tarayıcıda açın**
```
http://localhost:3000
```

## 🌐 Vercel Deployment

### Production Deploy
```bash
# Vercel'e deploy
vercel --prod

# Environment variables kontrol
vercel env ls
```

### Database Migration
```bash
# Vercel Postgres'e schema import
npm run migrate:vercel
```

## 📋 Sayfalar ve Özellikler

### 🏠 Ana Sayfa
- Hero section ile etkileyici giriş
- Kişiye özel değerlendirme formu
- Şirket istatistikleri
- Öne çıkan özellikler

### 🎓 Hizmetler
- Üniversite başvuru danışmanlığı
- Dil okulu yerleştirme
- Belge danışmanlığı
- Vize danışmanlığı
- Konaklama hizmetleri
- Ulaşım ve adaptasyon

### 🏛️ Üniversiteler
- Filtrelenebilir üniversite listesi
- Ülke, program ve seviye filtreleri
- Detaylı üniversite bilgileri
- Dil okulu seçenekleri

### 📄 Belgeler
- Kapsamlı belge listesi
- Accordion yapısında kategoriler
- Ülkeye özel gereksinimler
- Önemli notlar ve uyarılar

### 📝 Değerlendirme
- Detaylı değerlendirme formu
- Kişisel bilgiler
- Eğitim geçmişi
- Hedef eğitim bilgileri
- Dil becerileri
- Sonuç gösterimi

### 📞 İletişim
- İletişim formu
- Adres ve iletişim bilgileri
- Sosyal medya linkleri
- Sık sorulan sorular

## 🔧 API Endpoints

### POST /api/assessment
Kullanıcı değerlendirme formunu gönderir ve öneriler alır.

**Request Body:**
```json
{
  "educationLevel": "bachelor",
  "country": "germany",
  "program": "engineering",
  "budget": "medium"
}
```

**Response:**
```json
{
  "success": true,
  "recommendations": {
    "universities": ["University of Amsterdam", "Technical University of Munich"],
    "languageSchools": ["Goethe-Institut", "Alliance Française"],
    "documents": ["Pasaport kopyası", "Diploma ve transkript"]
  }
}
```

## 🎨 Tasarım Özellikleri

### Renk Paleti
- **Primary**: #007bff (Mavi)
- **Success**: #28a745 (Yeşil)
- **Info**: #17a2b8 (Açık Mavi)
- **Warning**: #ffc107 (Sarı)
- **Danger**: #dc3545 (Kırmızı)

### Tipografi
- **Font Family**: Segoe UI, Tahoma, Geneva, Verdana, sans-serif
- **Line Height**: 1.6
- **Font Weights**: 400, 500, 700

### Responsive Breakpoints
- **Mobile**: < 576px
- **Tablet**: 576px - 768px
- **Desktop**: > 768px

## 🔒 Güvenlik

- Form validation (client-side ve server-side)
- CORS koruması
- XSS koruması
- Input sanitization

## 📱 Responsive Tasarım

- Mobile-first yaklaşım
- Bootstrap 5 grid sistemi
- Esnek layout
- Touch-friendly butonlar

## 🚀 Performans

- Optimized CSS ve JavaScript
- Lazy loading
- Minified assets
- CDN kullanımı

## 🔧 Geliştirme

### Kod Standartları
- ESLint kullanımı
- Prettier formatting
- Semantic HTML
- BEM CSS metodolojisi

### Test
```bash
# Lint kontrolü
npm run lint

# Test çalıştırma
npm test
```

## 🔐 Otomatik Yedekleme Sistemi

✅ **Günlük otomatik veritabanı yedekleme aktif!**

Sistem her gün saat 03:00 UTC'de otomatik olarak tüm veritabanını yedekler ve FTP sunucusuna güvenli şekilde kaydeder.

### Özellikler
- ✅ Günlük otomatik yedekleme
- ✅ FTP/SFTP desteği
- ✅ Email bildirimleri
- ✅ Otomatik eski yedek temizleme (30 gün)
- ✅ Dinamik tablo algılama (yeni tablolar otomatik yedeklenir)
- ✅ Sadece okuma - veritabanına zarar vermez

### Kullanım

**Manuel yedekleme:**
```bash
node scripts/backup-to-ftp.js
```

**Yedekten geri yükleme:**
```bash
node scripts/restore-from-backup.js path/to/backup.json
```

**Detaylı dokümantasyon:** [BACKUP_SYSTEM.md](BACKUP_SYSTEM.md)

## 📈 Gelecek Özellikler

- [ ] Kullanıcı hesap sistemi
- [ ] Online ödeme entegrasyonu
- [ ] Canlı chat desteği
- [ ] Blog bölümü
- [ ] Başarı hikayeleri
- [ ] Video içerikler
- [ ] Çoklu dil desteği
- [ ] Admin paneli

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Push edin (`git push origin feature/AmazingFeature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakın.

## 📞 İletişim

**Venture Global**
- Website: [ventureglobal.com](https://ventureglobal.com)
- Email: info@ventureglobal.com
- Phone: +90 (212) 555 0123

## 🙏 Teşekkürler

- Bootstrap ekibine modern UI framework için
- Font Awesome ekibine ikonlar için
- Express.js ekibine web framework için
- Tüm açık kaynak topluluğuna

---

**Venture Global** - Avrupa'da eğitim hayalinizi gerçekleştirin! 🌍🎓 