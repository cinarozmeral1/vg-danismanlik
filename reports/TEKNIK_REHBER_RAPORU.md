# VG Danışmanlık — Teknik Rehber Raporu
**Hazırlayan:** AI Kod Analizi  
**Tarih:** Nisan 2026  
**Hedef Kitle:** Yeniden yazım yapacak yazılım ekibi  
**Gizlilik:** Dahili kullanım

---

## İçindekiler

1. [Genel Mimari](#1-genel-mimari)
2. [Teknoloji Yığını](#2-teknoloji-yığını)
3. [Veritabanı Yapısı](#3-veritabanı-yapısı)
4. [Kimlik Doğrulama ve Yetkilendirme](#4-kimlik-doğrulama-ve-yetkilendirme)
5. [Modül Haritası — Route'lar](#5-modül-haritası--routelar)
   - 5.1 Auth Rotaları
   - 5.2 Kullanıcı (Öğrenci) Rotaları
   - 5.3 Admin Rotaları
   - 5.4 Partner Rotaları
   - 5.5 Randevu Rotaları
   - 5.6 Blog Rotaları
   - 5.7 Öğrenci Sihirbazı Rotaları
   - 5.8 Stripe Webhook
6. [Servisler (Entegrasyonlar)](#6-servisler-entegrasyonlar)
7. [E-posta Sistemi — Kim, Ne Zaman, Kime](#7-e-posta-sistemi--kim-ne-zaman-kime)
8. [Randevu ve Takvim Sistemi](#8-randevu-ve-takvim-sistemi)
9. [Blog ve Yapay Zeka İçerik Üretimi](#9-blog-ve-yapay-zeka-içerik-üretimi)
10. [Ödeme Sistemi](#10-ödeme-sistemi)
11. [Sözleşme (PDF) Üretimi](#11-sözleşme-pdf-üretimi)
12. [Admin Paneli — Tam Yetki Haritası](#12-admin-paneli--tam-yetki-haritası)
13. [Partner Sistemi](#13-partner-sistemi)
14. [Otomatik Görevler (Cron Jobs)](#14-otomatik-görevler-cron-jobs)
15. [Çok Dilli Destek (i18n)](#15-çok-dilli-destek-i18n)
16. [Ortam Değişkenleri](#16-ortam-değişkenleri)
17. [Deployment (Vercel)](#17-deployment-vercel)
18. [Sayfa ve Şablon Kataloğu](#18-sayfa-ve-şablon-kataloğu)
19. [Güvenlik Notları ve Teknik Borç](#19-güvenlik-notları-ve-teknik-borç)
20. [Yeniden Yazım için Öneriler](#20-yeniden-yazım-için-öneriler)

---

## 1. Genel Mimari

Bu uygulama, **server-side rendering** (SSR) tabanlı bir **Node.js / Express** web uygulamasıdır. Şablonlar **EJS** motoru ile oluşturulur ve kullanıcıya doğrudan HTML gönderilir. İstemci tarafında ayrı bir SPA (React/Vue/Angular vb.) **yoktur** — tüm iş mantığı sunucu tarafındadır.

```
[Tarayıcı / İstemci]
       │
       │ HTTPS (Vercel Edge)
       ▼
[Vercel Serverless — server.js (Express)]
       │
       ├──► [PostgreSQL — Neon/Supabase veya benzeri]
       ├──► [Gmail SMTP — Nodemailer]
       ├──► [Google OAuth 2.0]
       ├──► [Groq API — Yapay Zeka Blog]
       ├──► [Gemini API — AI Öneriler]
       ├──► [Zoom Server-to-Server OAuth]
       ├──► [Apple iCloud CalDAV — Takvim]
       ├──► [Apple iCloud CardDAV — Rehber]
       ├──► [Cloudinary — Galeri/Görseller]
       ├──► [Stripe — Ödeme]
       ├──► [GoPay — Çek Cumhuriyeti Ödemeleri]
       └──► [FTP Sunucu — Veritabanı Yedekleri]
```

**Sunucu:** Tek bir `server.js` dosyası tüm route'ları ve middleware'i yönetir. Route'ların bir kısmı `routes/` klasöründeki ayrı dosyalara delege edilmiş olsa da `server.js` içinde de doğrudan tanımlı çok sayıda endpoint bulunmaktadır (özellikle SEO sayfaları, üniversite listeleri, iletişim formları).

---

## 2. Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Çalışma Ortamı** | Node.js |
| **Web Framework** | Express.js |
| **Şablon Motoru** | EJS + express-ejs-layouts |
| **Veritabanı** | PostgreSQL (`pg` kütüphanesi ile ham SQL) |
| **Kimlik Doğrulama** | JWT (`jsonwebtoken`) + bcrypt |
| **Sosyal Giriş** | Google OAuth 2.0 (`google-auth-library`) |
| **E-posta** | Nodemailer (Gmail SMTP) |
| **Dosya Yükleme** | Multer (lokal) + Cloudinary (galeri görselleri) |
| **Ödeme** | Stripe (global) + GoPay (Çekya) |
| **Takvim** | Apple iCloud CalDAV (`tsdav`) |
| **Rehber** | Apple iCloud CardDAV (`tsdav`) |
| **Video Toplantı** | Zoom Server-to-Server OAuth API |
| **Yapay Zeka (Blog)** | Groq API (OpenAI uyumlu, LLaMA modelleri) |
| **Yapay Zeka (Öneri)** | Groq + Gemini API |
| **PDF Üretimi** | PDFKit + pdf-lib + @pdf-lib/fontkit |
| **Deployment** | Vercel (Serverless + Edge) |
| **Güvenlik** | Helmet, CORS, express-rate-limit |

---

## 3. Veritabanı Yapısı

Uygulama **PostgreSQL** kullanmaktadır. Mongoose (MongoDB) veya başka bir ORM **yoktur**; tüm sorgular ham SQL (`pg.Pool`) ile yazılmıştır. Tablo şemaları `database/` klasöründeki migration dosyalarında ve bazı route dosyalarının içindeki `CREATE TABLE IF NOT EXISTS` bloklarında tanımlıdır.

### Başlıca Tablolar

| Tablo | Açıklama |
|-------|----------|
| `users` | Tüm öğrenci/kullanıcı kayıtları. `is_admin`, `admin_role`, `is_verified`, `email_verified` alanları içerir |
| `admins` | Eski admin tablosu (legacy); `userInfo` middleware her ikisine de bakabilir |
| `applications` | Öğrenci üniversite başvuruları; durum, ücret, belge alanları |
| `universities` | Üniversite içerikleri (çok dilli, sıralama, logo) |
| `programs` | Üniversiteye bağlı bölüm/program kayıtları |
| `blog_posts` | Blog makaleleri (TR/EN ikili dil alanları, SEO metadata) |
| `blog_topic_history` | Hangi bölüm/üniversite kombinasyonunun blog için kullanıldığı |
| `appointments` | Randevu kayıtları (tarih, saat, isim, e-posta, Zoom linki vb.) |
| `appointment_verifications` | 6 haneli e-posta doğrulama kodları (randevu için) |
| `ip_rate_limits` | IP başına randevu oluşturma throttle verileri |
| `services` | Tanımlı hizmetler (ücret, taksit sayısı vb.) |
| `user_services` | Öğrenciye atanmış hizmet kayıtları |
| `installments` | Taksit ödeme planları ve durumları |
| `payments` | Stripe ödeme kayıtları |
| `partners` | Partner şirket kayıtları |
| `partner_earnings` | Partner komisyon/kazanç takibi |
| `guardians` | Veli bilgileri (öğrenciye bağlı) |
| `visa_applications` | Vize başvuru takibi |
| `wizard_recommendations` | AI öğrenci sihirbazı sonuçları |
| `file_categories` | Belge kategorileri |
| `user_files` | Yüklenen öğrenci belgeleri |
| `student_checklists` | Öğrenci görev/adım listesi |
| `gallery_topics` | Cloudinary galeri konuları |
| `gallery_images` | Cloudinary galeri görselleri |
| `notifications` | Kullanıcı bildirimleri |
| `wise_transfers` | Wise para transferi takip kayıtları |

> **Not:** Tam şema için `database/` klasöründeki migration dosyalarını ve `routes/appointments.js` içindeki inline `CREATE TABLE` bloklarını inceleyiniz.

---

## 4. Kimlik Doğrulama ve Yetkilendirme

### 4.1 Kullanıcı Tipleri

| Tip | Nasıl Belirleniyor |
|-----|--------------------|
| **Öğrenci (user)** | `users.is_admin = false` |
| **Co-Admin** | `users.is_admin = true`, `users.admin_role = 'co_admin'` |
| **Super Admin** | `users.is_admin = true`, `users.admin_role = 'super_admin'` |
| **Partner** | Ayrı `partners` tablosu, ayrı `partnerToken` cookie'si |

### 4.2 JWT Akışı

1. Giriş yapıldığında sunucu bir **JWT token** üretir (`JWT_SECRET` ile imzalanır)
2. Token HTTP-only cookie olarak tarayıcıya set edilir:
   - Öğrenci: `userToken` cookie
   - Admin: `userToken` cookie (aynı cookie, `is_admin` flag JWT payload'unda)
   - Partner: `partnerToken` cookie
3. Her istekte `userInfoMiddleware`:
   - `userToken` cookie'sini decode eder
   - `users` tablosundan güncel kullanıcı bilgisini çeker
   - `res.locals.user`, `res.locals.isLoggedIn`, `res.locals.isAdmin`, `res.locals.isSuperAdmin` değerlerini set eder
4. Route düzeyinde `middleware/auth.js`'den şu guard fonksiyonları kullanılır:
   - `authenticateUser` — sadece giriş yapmış kullanıcı
   - `authenticateAdmin` — admin veya super admin
   - `authenticateSuperAdmin` — yalnızca super admin
   - `authenticatePartner` — yalnızca partner

### 4.3 Google OAuth Akışı

```
Kullanıcı "Google ile Giriş Yap" tıklar
       │
       ▼
GET /api/auth/google/redirect
→ Kullanıcıyı Google'a yönlendirir (state cookie set edilir)
       │
       ▼
Google → GET /api/auth/google/callback
→ Kod ile access token alınır
→ Kullanıcı e-postası Google'dan çekilir
→ E-posta zaten kayıtlıysa: JWT üretilir, giriş yapılır
→ E-posta yeni ise: /complete-google-registration sayfasına yönlendirilir
       │
       ▼ (Yeni kullanıcı)
POST /api/auth/complete-google-registration
→ İsim, telefon, doğum tarihi tamamlanır
→ Kullanıcı kaydedilir
→ info@vgdanismanlik.com'a "yeni öğrenci" bildirimi gönderilir
→ JWT set edilir, dashboard'a yönlendirilir
```

### 4.4 E-posta/Şifre Kayıt Akışı

```
POST /api/auth/register
→ Şifre bcrypt ile hash'lenir
→ users tablosuna kaydedilir (is_verified: false)
→ E-posta doğrulama linki gönderilir
       │
       ▼
GET /api/auth/verify-email?token=...
→ Token doğrulanır
→ users.is_verified = true yapılır
→ /verification-success sayfasına yönlendirilir
```

### 4.5 Şifre Sıfırlama

```
POST /api/auth/forgot-password
→ E-postaya sıfırlama linki gönderilir (JWT token içerir, 1 saat geçerli)
       │
       ▼
POST /api/auth/reset-password
→ Token doğrulanır
→ Yeni şifre hash'lenerek kaydedilir
```

---

## 5. Modül Haritası — Route'lar

### 5.1 Auth Rotaları (`/api/auth/...`)

| Metod | Endpoint | Ne Yapar |
|-------|----------|---------|
| GET | `/api/auth/google/redirect` | Google OAuth başlatır |
| GET | `/api/auth/google/callback` | Google OAuth tamamlar, JWT set eder |
| POST | `/api/auth/complete-google-registration` | Google kullanıcısı profil tamamlama |
| POST | `/api/auth/google` | Google token doğrulama (mobil/API) |
| POST | `/api/auth/register` | E-posta/şifre ile yeni kayıt |
| POST | `/api/auth/resend-verification` | Doğrulama e-postasını yeniden gönderir |
| GET | `/api/auth/verify-email` | E-posta doğrulama linkini işler |
| POST | `/api/auth/forgot-password` | Şifre sıfırlama e-postası gönderir |
| POST | `/api/auth/login` | JSON login, JWT cookie set eder |
| POST | `/api/auth/reset-password` | Yeni şifreyi kaydeder |
| POST | `/api/auth/logout` | userToken cookie'yi temizler |
| POST | `/api/auth/partner-logout` | partnerToken cookie'yi temizler |
| POST | `/api/auth/partner-login` | Partner girişi |
| GET | `/api/auth/verify-partner-email` | Partner e-posta doğrulama linki |
| POST | `/api/auth/partner-setup-password` | Partner ilk şifre belirleme |

### 5.2 Kullanıcı (Öğrenci) Rotaları (`/user/...` ve `/api/user/...`)

Tüm endpoint'ler `authenticateUser` ile korunmaktadır.

| Kategori | Başlıca Endpoint'ler |
|----------|---------------------|
| **Dashboard** | `GET /user/dashboard` — öğrenci ana sayfası |
| **Profil** | `GET /user/profile`, `PUT /user/profile` — profil görüntüleme ve güncelleme |
| **Başvurular** | `GET /user/applications` — başvuru listesi |
| **Belgeler** | `GET /user/files`, `POST /user/files/upload`, `DELETE /user/files/:id` |
| **Hizmetler** | `GET /user/services` — atanmış hizmetler |
| **Randevular** | `GET /user/appointments` — kendi randevuları |
| **Ayarlar** | `GET /user/settings`, `PUT /user/settings` — bildirim, gizlilik ayarları |
| **Şifre** | `POST /api/user/change-password` |
| **Hesap** | `POST /api/user/freeze-account`, `DELETE /api/user/delete-account` |
| **Ödeme** | `GET /api/user/payment-config` — Stripe public key |
| **Taksit** | `POST /api/user/create-payment-intent`, `GET /api/user/installment-details/:id` |
| **Veli** | `POST /api/user/save-guardian` |

### 5.3 Admin Rotaları (`/admin/...` ve `/api/admin/...`)

Admin paneline erişim için `is_admin = true` gereklidir. Bazı sayfalar için `super_admin` rolü zorunludur.

| Kategori | Başlıca Endpoint'ler | Yetki |
|----------|---------------------|-------|
| **Dashboard** | `GET /admin/dashboard` | Admin |
| **Kullanıcılar** | `GET /admin/users`, `/admin/users/:id`, `PUT /api/admin/users/:id`, `DELETE /api/admin/users/:id` | Admin |
| **Öğrenci Detay** | `GET /admin/student-details/:id` | Admin |
| **Başvurular** | `GET /admin/applications`, `POST /api/admin/applications`, `PUT /api/admin/applications/:id` | Admin |
| **Üniversiteler** | `GET /admin/universities`, `POST /api/admin/universities`, `PUT /api/admin/universities/:id`, `DELETE /api/admin/universities/:id` | Admin |
| **Programlar** | `POST /api/admin/programs`, `PUT /api/admin/programs/:id`, `DELETE /api/admin/programs/:id` | Admin |
| **Hizmetler** | `GET /admin/services`, `POST /api/admin/services`, `PUT /api/admin/services/:id` | Admin |
| **Partnerler** | `GET /admin/partners`, `POST /api/admin/partners`, partner kayıt/bildirim/bağlama | Admin |
| **Vize** | `GET /admin/visa-applications`, CRUD endpoint'leri | Admin |
| **Finansal** | `GET /api/admin/financial-data`, `/financial-comparison`, `/net-profit`, `/student-profitability`, export | Super Admin |
| **Yedekleme** | `GET /admin/backups`, `POST /api/admin/backups/trigger` | Super Admin |
| **Wise Transferler** | `GET /api/admin/wise-transfers`, `POST /api/admin/wise-transfers/:id/mark-transferred` | Super Admin |
| **Galeri** | `GET /admin/gallery`, Cloudinary görsel yükleme/silme | Super Admin |
| **AI Öneriler** | `GET /admin/ai-recommendations` | Super Admin |
| **Admin Yönetimi** | `GET /api/admin/admins`, `POST /api/admin/admins`, güncelleme/silme | Super Admin |
| **Randevular** | `GET /admin/appointments`, oluşturma/düzenleme/silme | Super Admin |
| **Sözleşme** | `POST /api/admin/generate-contract/:userId` | Admin |
| **Test E-posta** | `POST /api/admin/test-email` | Super Admin |

### 5.4 Partner Rotaları (`/partner/...`)

| Metod | Endpoint | Ne Yapar |
|-------|----------|---------|
| GET | `/partner/dashboard` | Partner ana sayfası (HTML) |
| GET | `/partner/settings` | Partner ayarları (HTML) |
| GET | `/partner/api/students` | Bağlı öğrenci listesi (JSON) |
| GET | `/partner/api/earnings` | Komisyon/kazanç listesi (JSON) |
| PUT | `/partner/api/profile` | Profil güncelleme (JSON) |
| POST | `/partner/api/change-password` | Şifre değiştirme (JSON) |

### 5.5 Randevu Rotaları (`/api/appointments/...`)

| Metod | Endpoint | Yetki | Ne Yapar |
|-------|----------|-------|---------|
| GET | `/api/appointments/available-dates` | Herkese açık | iCloud + DB verisiyle müsait günleri döner |
| GET | `/api/appointments/available-slots/:date` | Herkese açık | Belirtilen gün için saat dilimlerini döner |
| POST | `/api/appointments/send-verification` | Herkese açık | 6 haneli kod e-postayla gönderilir |
| POST | `/api/appointments/verify-code` | Herkese açık | Kodu doğrular, oturum işaretler |
| POST | `/api/appointments/create-fast` | Herkese açık (rate-limited) | Randevuyu oluşturur |
| POST | `/api/appointments/create` | Herkese açık (rate-limited) | Alternatif oluşturma endpoint'i |
| GET | `/api/appointments/calendar-download/:id` | Herkese açık | ICS takvim dosyası indirir |
| POST | `/api/appointments/zoom-link` | Super Admin | Zoom linki set eder veya oluşturur |
| POST | `/api/appointments/send-zoom-invite` | Super Admin | Zoom davetini e-postayla gönderir |
| POST | `/api/appointments/send-test-emails` | Super Admin / Cron | Test e-postası gönderir |

### 5.6 Blog Rotaları (`/blog/...`)

| Metod | Endpoint | Ne Yapar |
|-------|----------|---------|
| GET | `/blog` | Blog listesi (sayfalanmış) |
| GET | `/blog/:slug` | Makale detayı (TR/EN dile göre) |
| GET | `/blog/preview/:id` | Admin draft önizleme |
| POST | `/blog/generate` | Manuel AI üretimi (yetkilendirme sorunu var — bkz. §19) |

### 5.7 Öğrenci Sihirbazı Rotaları

| Metod | Endpoint | Ne Yapar |
|-------|----------|---------|
| GET | `/student-wizard` | Sihirbaz sayfası (HTML) |
| GET | `/api/wizard/universities` | Filtrelenmiş üniversite listesi |
| GET | `/api/wizard/prep-programs` | Hazırlık programları |
| POST | `/api/wizard/submit` | Sihirbaz formunu kaydeder |
| POST | `/api/wizard/analyze` | AI analizi çalıştırır (giriş gerektirir) |
| GET | `/api/wizard/my-recommendation` | Kendi öneri sonucu |

### 5.8 Stripe Webhook (`/webhook/stripe`)

| Metod | Endpoint | Ne Yapar |
|-------|----------|---------|
| POST | `/webhook/stripe` | Stripe imzasını doğrular, ödeme durumunu DB'ye yazar |

> **Kritik:** Bu route `bodyParser.json()` middleware'inden **önce** tanımlanmıştır. Stripe webhook'u ham (raw) body gerektirir.

---

## 6. Servisler (Entegrasyonlar)

### `services/emailService.js`

Tüm e-posta gönderimi bu servis üzerinden geçer. Gmail SMTP kullanılır (`EMAIL_USER`, `EMAIL_PASS` env değişkenleri). `nodemailer.createTransport()` ile bir `transporter` nesnesi oluşturulur ve tüm uygulama boyunca tekrar kullanılır.

**Dışa aktarılan fonksiyonlar:**

| Fonksiyon | Açıklama |
|-----------|----------|
| `sendVerificationEmail(email, token)` | E-posta doğrulama linki gönderir |
| `sendPasswordResetEmail(email, token)` | Şifre sıfırlama linki gönderir |
| `sendApplicationCreatedEmail(user, application)` | Başvuru oluşturuldu bildirimi |
| `sendApplicationStatusEmail(user, application)` | Başvuru durum değişikliği bildirimi |
| `sendPartnerVerificationEmail(partner, token)` | Partner e-posta doğrulama linki |
| `sendVisaEmail(...)` | Vize başvurusu bilgilendirme e-postası |
| `sendProfileReminderEmail(user)` | Profili tamamlanmamış öğrenciye hatırlatma |
| `sendNewStudentNotificationEmail(user)` | info@'a yeni öğrenci bildirimi |

---

### `services/blogAIService.js`

**Groq API** kullanılarak otomatik blog içeriği üretir.

**Çalışma mantığı:**
1. PostgreSQL'den gerçek bir üniversite bölümü seçer (Lisans, ülke rotasyonu ile)
2. `blog_topic_history` tablosunu kontrol ederek yakın zamanda kullanılan kombinasyonları atlar
3. Groq'a Türkçe + İngilizce blog makalesi üretmesi için prompt gönderir
4. Üretilen HTML içeriği `blog_posts` tablosuna kaydeder
5. Kullanılan kombinasyonu `blog_topic_history`'e ekler

---

### `services/calendarService.js`

**Apple iCloud CalDAV** entegrasyonu.

| Fonksiyon | Açıklama |
|-----------|----------|
| `fetchBusyTimes(date)` | Belirli tarih için iCloud'dan meşgul zamanları çeker |
| `getAvailableSlots(date, busyTimes)` | Meşgul zamanları dışarak serbest slotları hesaplar |
| `createCalendarEvent(appointmentData)` | iCloud'da yeni randevu etkinliği oluşturur (ICS formatı) |
| `updateCalendarEvent(uid, appointmentData)` | Mevcut etkinliği günceller |
| `deleteCalendarEvent(uid)` | Etkinliği siler |
| `buildICSString(data)` | Ham ICS string üretir (öğrenciye indirme için) |

**Teknik:** `tsdav` kütüphanesi ile `ICLOUD_EMAIL` + `ICLOUD_APP_PASSWORD` kullanılır. Hedef takvim, display adı `"vg"` içeren ilk takvimdir.

---

### `services/zoomService.js`

**Zoom Server-to-Server OAuth** entegrasyonu.

| Fonksiyon | Açıklama |
|-----------|----------|
| `getAccessToken()` | `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` ile token alır |
| `createMeeting(appointmentData)` | Planlanmış toplantı oluşturur (host'tan önce katılım açık, bekleme odası aktif) |
| `updateMeeting(meetingId, data)` | Mevcut toplantıyı günceller |
| `deleteMeeting(meetingId)` | Toplantıyı siler |

---

### `services/contractService.js`

**PDFKit + pdf-lib** ile sözleşme belgesi üretir.

**Çalışma mantığı:**
1. `public/templates/Venture Antetli_2026-3.pdf` antetli kağıt şablonunu yükler
2. `@pdf-lib/fontkit` ile Türkçe karakter desteği sağlar
3. Öğrenci bilgileri, hizmet detayları ve sözleşme metnini PDF üzerine yerleştirir
4. `public/images/signature.png` imzasını ekler
5. Benzersiz sözleşme numarası üretir (`generateContractNumber`)
6. Tarayıcıya indirmek için binary PDF döner

---

### `services/contactService.js`

**Apple iCloud CardDAV** entegrasyonu. Öğrenci ve veli bilgilerinden vCard oluşturarak iCloud rehberine ekler.

---

### `services/geminiService.js`

Hem **Groq** hem de **Google Gemini API** kullanarak öğrenci sihirbazı için kapsamlı AI üniversite önerisi üretir. Öğrencinin başvuru tercihlerini, notlarını ve bütçesini analiz eder.

---

### `services/backupNotificationService.js`

Veritabanı yedekleme işleminin başarılı veya başarısız olması durumunda e-posta bildirimi gönderir.

---

## 7. E-posta Sistemi — Kim, Ne Zaman, Kime

Bu bölüm, uygulamada gerçekleşen **her e-posta tetikleyicisini** listeler.

### 7.1 Kullanıcı Kayıt ve Giriş E-postaları

| Tetikleyici | Gönderen | Alıcı | İçerik |
|-------------|----------|-------|--------|
| `POST /api/auth/register` başarılı | `EMAIL_USER` (Gmail) | Kayıt olan kullanıcı | E-posta doğrulama linki |
| `POST /api/auth/resend-verification` | `EMAIL_USER` | Kullanıcı | Yeni doğrulama linki |
| `POST /api/auth/forgot-password` | `EMAIL_USER` | Kullanıcı | Şifre sıfırlama linki (1 saat geçerli) |
| Google OAuth ile yeni kayıt | `EMAIL_USER` | `info@vgdanismanlik.com` | "Yeni öğrenci kaydoldu" bildirimi |
| Normal kayıt (emailService) | `EMAIL_USER` | `info@vgdanismanlik.com` | "Yeni öğrenci kaydoldu" bildirimi |

### 7.2 Başvuru E-postaları

| Tetikleyici | Gönderen | Alıcı | İçerik |
|-------------|----------|-------|--------|
| Admin yeni başvuru oluşturur | `EMAIL_USER` | Öğrenci | "Başvurunuz oluşturuldu" bildirimi |
| Admin başvuru durumunu günceller | `EMAIL_USER` | Öğrenci | Yeni başvuru durumu bilgisi |

### 7.3 Randevu E-postaları

| Tetikleyici | Gönderen | Alıcı | İçerik |
|-------------|----------|-------|--------|
| `POST /api/appointments/send-verification` | `EMAIL_USER` | Randevu talep eden kişi | 6 haneli doğrulama kodu |
| `POST /api/appointments/create` — başarılı | `EMAIL_USER` | Randevu eden kişi | Randevu onay bilgisi + ICS indirme linki |
| `POST /api/appointments/create` — başarılı | `EMAIL_USER` | `info@vgdanismanlik.com` | Yeni randevu bildirimi |
| `POST /api/appointments/send-zoom-invite` (admin) | `EMAIL_USER` | Randevu sahibi | Zoom toplantı linki ve detayları |
| Cron: `zoom-reminder` (her 10 dakika) | `EMAIL_USER` | Yaklaşan randevu sahibi | "30 dakika sonra toplantınız var" hatırlatması |

### 7.4 Partner E-postaları

| Tetikleyici | Gönderen | Alıcı | İçerik |
|-------------|----------|-------|--------|
| Admin yeni partner oluşturur | `EMAIL_USER` | Partner e-postası | Hesap aktivasyon/doğrulama linki |
| Admin "doğrulama yeniden gönder" tıklar | `EMAIL_USER` | Partner e-postası | Yeni doğrulama linki |
| `GET /api/auth/verify-partner-email` | — | — | Hesabı aktive eder, şifre kurulum sayfasına yönlendirir |

### 7.5 İletişim Formu E-postaları (`server.js` içinde)

| Tetikleyici | Gönderen | Alıcı | İçerik |
|-------------|----------|-------|--------|
| `POST /contact` (iletişim formu) | `EMAIL_USER` | `EMAIL_USER` veya yapılandırılmış adres | Gelen form içeriği (isim, e-posta, mesaj) |
| `POST /assessment` (ön değerlendirme formu) | `EMAIL_USER` | `EMAIL_USER` | Ön değerlendirme formu verileri |
| `POST /career` (kariyer başvurusu) | `EMAIL_USER` | `EMAIL_USER` | CV ve başvuru bilgileri |

### 7.6 Sistem / Cron E-postaları

| Tetikleyici | Gönderen | Alıcı | İçerik |
|-------------|----------|-------|--------|
| Cron: `profile-reminder` (her 6 saatte) | `EMAIL_USER` | Profili eksik öğrenciler | "Profilinizi tamamlayın" hatırlatması |
| Cron: `backup-database` (günlük 03:00 UTC) | `EMAIL_USER` | Admin e-postası | Yedekleme başarılı/başarısız bildirimi |

### 7.7 Vize E-postaları

| Tetikleyici | Gönderen | Alıcı | İçerik |
|-------------|----------|-------|--------|
| Admin vize başvurusu günceller | `EMAIL_USER` | Öğrenci | Vize başvuru durum bildirimi |

---

## 8. Randevu ve Takvim Sistemi

### 8.1 Müsait Gün/Saat Hesaplama

```
1. İstemci GET /api/appointments/available-dates çağırır
2. calendarService.fetchBusyTimes() → iCloud CalDAV'dan meşgul zamanlar
3. appointments tablosundan "confirmed" durumundaki kayıtlar çekilir
4. İki kaynak birleştirilir → boş günler hesaplanır → yanıt döner

5. İstemci GET /api/appointments/available-slots/:date çağırır
6. O gün için meşgul zamanlar (aynı mantıkla) hesaplanır
7. Önceden tanımlı çalışma saatleri aralığından meşgul slotlar çıkarılır
8. Kalan serbest slotlar döner (örn. 10:00, 10:30, 11:00 ...)
```

### 8.2 Randevu Oluşturma Akışı

```
1. E-posta girişi → POST /api/appointments/send-verification
   → DB'ye doğrulama kodu ve IP kaydedilir
   → Kullanıcıya 6 haneli kod e-postayla gönderilir

2. Kod girişi → POST /api/appointments/verify-code
   → Kod ve e-posta eşleşmesi doğrulanır
   → Oturuma/cookie'ye "verified" işareti eklenir

3. Form doldurma → POST /api/appointments/create-fast
   → Rate limiting kontrol edilir (IP bazlı)
   → appointments tablosuna kayıt eklenir
   → iCloud CalDAV'da etkinlik oluşturulur
   → Zoom toplantısı oluşturulabilir (isteğe bağlı)
   → Öğrenciye onay e-postası gönderilir
   → info@'a bildirim e-postası gönderilir

4. ICS indirme → GET /api/appointments/calendar-download/:id
   → calendarService.buildICSString() ile takvim dosyası üretilir
   → Kullanıcı tarayıcısına .ics dosyası indirilir
```

### 8.3 Admin Randevu Yönetimi

- Admin panelinden randevu oluşturabilir, düzenleyebilir veya silebilir
- Super Admin, Zoom linki ekleyebilir (`POST /api/appointments/zoom-link`)
- Zoom daveti manuel olarak gönderilebilir (`POST /api/appointments/send-zoom-invite`)

---

## 9. Blog ve Yapay Zeka İçerik Üretimi

### 9.1 Blog Okuma

- `GET /blog` → `blog_posts` tablosundan sayfalanmış liste
- `GET /blog/:slug` → Tekil makale, mevcut dile göre (`currentLanguage`) TR veya EN içerik gösterilir
- SEO: Her makalede JSON-LD yapılandırılmış veri, canonical URL, Open Graph meta etiketleri

### 9.2 Otomatik AI Blog Üretimi

**Tetiklenme:** Vercel cron job her 3 günde bir çalışır (`GET /api/cron/generate-blog`)

```
blogAIService.generateBlogPost() çalışır:

1. SELECT universities JOIN programs → lisans programı ve üniversite seçilir
   (Ülke rotasyonu: Çekya, Slovakya, Macaristan, Polonya, vb.)

2. blog_topic_history kontrol edilir
   → Yakın zamanda kullanılan department_id atlanır (tekrar önlenir)

3. Groq API'ye istek:
   Prompt: "Bu üniversite ve bölüm için hem Türkçe hem İngilizce detaylı blog makalesi yaz"
   Model: LLaMA 3.x veya benzeri Groq modeli
   Çıktı: HTML formatlı makale metni (başlık, slug, özet, içerik, meta açıklama)

4. blog_posts tablosuna INSERT:
   - title_tr, title_en
   - content_tr, content_en
   - slug (URL dostu)
   - meta_description_tr, meta_description_en
   - university_id, program_id referansları
   - published_at = NOW()

5. blog_topic_history tablosuna kullanılan kombinasyon eklenir
```

---

## 10. Ödeme Sistemi

### 10.1 Stripe

**Desteklenen para birimleri:** TRY, EUR, USD

**Akış:**
1. Admin öğrenciye bir `user_service` veya `installment` atar
2. Öğrenci `POST /api/user/create-payment-intent` ile ödeme niyeti oluşturur
3. Stripe `PaymentIntent` döner; client_secret frontend'e gönderilir
4. Kullanıcı tarayıcıda Stripe Elements ile ödemeyi tamamlar
5. Stripe, `POST /webhook/stripe` endpoint'ine webhook event gönderir
6. `routes/stripe-webhook.js` imzayı doğrular ve DB'yi günceller:
   - `payments.status = 'completed'`
   - `installments.status = 'paid'`

### 10.2 GoPay

`config/gopay.js` mevcut ve env değişkenleriyle yapılandırılmış (`GOPAY_GOID` vb.). Çek Cumhuriyeti pazarı için alternatif ödeme altyapısı. Mevcut kod entegrasyonu `config` dosyası düzeyinde var, route/service desteği sınırlı görünmekte.

---

## 11. Sözleşme (PDF) Üretimi

**Tetikleyici:** Admin panelinden `POST /api/admin/generate-contract/:userId`

```
contractService.generateContract(user, serviceData) çalışır:

1. public/templates/Venture Antetli_2026-3.pdf şablonu yüklenir
2. pdf-lib ile mevcut PDF üzerine metin katmanı eklenir
3. Eklenen alanlar:
   - Öğrenci adı, doğum tarihi, TC kimlik/pasaport
   - Veli bilgileri (varsa)
   - Hizmet detayları, ücret, ödeme planı
   - Tarih ve sözleşme numarası
4. public/images/signature.png imzası PDF'e eklenir
5. generateContractNumber() ile benzersiz numara üretilir (örn. VG-2026-00123)
6. Tamamlanan PDF binary olarak döner → tarayıcıda indirilir
```

---

## 12. Admin Paneli — Tam Yetki Haritası

Admin paneline `/admin` URL'sinden erişilir. Tüm admin sayfaları `views/admin/layout.ejs` şablonunu kullanır ve sidebar navigasyonu içerir.

### 12.1 Öğrenci Yönetimi

- **Kullanıcı listesi:** Tüm öğrenciler, arama/filtreleme, sayfalama
- **Öğrenci detay:** Profil bilgileri, belgeler, başvurular, hizmetler, taksitler, veliler, notlar
- **Profil düzenleme:** Tüm kullanıcı alanlarını düzenleyebilir
- **Admin yapma/kaldırma:** `is_admin` flag'ini değiştirebilir
- **Hesap dondurma/silme:** `PUT /api/admin/users/:id/status`
- **Kontakt oluşturma:** iCloud rehberine öğrenciyi ekleyebilir

### 12.2 Başvuru Yönetimi

- Yeni başvuru oluşturma (öğrenci ve üniversite seçimi)
- Başvuru durumu güncelleme (pending → reviewing → accepted/rejected)
- Başvuru ücreti girme
- Başvuruya not ekleme
- Başvuru e-posta bildirimi tetikleme

### 12.3 Üniversite ve Program Yönetimi

- Üniversite ekleme/düzenleme/silme
- Sıralama (drag-drop reorder)
- Logo yükleme (Cloudinary veya lokal)
- Program (bölüm) ekleme/düzenleme/silme
- Çok dilli içerik (TR + EN)

### 12.4 Finansal Yönetim (Super Admin)

- Toplam gelir, gider, net kâr dashboard'u
- Öğrenci bazlı kârlılık analizi
- Dönemsel karşılaştırma grafikleri
- Excel/CSV export
- Wise transfer takibi (bekleyen → tamamlandı)

### 12.5 Partner Yönetimi

- Partner kaydı oluşturma
- Doğrulama e-postası gönderme
- Partner-öğrenci bağlama
- Komisyon/kazanç takibi

### 12.6 Randevu Yönetimi (Super Admin)

- Tüm randevuları görüntüleme
- Admin tarafından randevu oluşturma
- Randevu düzenleme/iptal etme
- Zoom linki ekleme
- Zoom daveti e-postayla gönderme

### 12.7 İçerik Yönetimi

- Cloudinary galeri (konu ve görsel CRUD)
- AI öneriler listesi (wizard sonuçları)
- Blog yönetimi (dolaylı — cron üretir)

### 12.8 Sistem Araçları (Super Admin)

- Veritabanı yedekleme tetikleme
- Yedek listesi görüntüleme
- Test e-postası gönderme
- Admin kullanıcı yönetimi (ekle/düzenle/sil)

---

## 13. Partner Sistemi

Partnerler, öğrenci yönlendiren aracı kurumlardır.

### Yaşam Döngüsü

```
1. Admin /admin/partners panelinden yeni partner oluşturur
   (şirket adı, yetkili kişi, e-posta, komisyon oranı)
2. E-posta doğrulama linki partner e-postasına gönderilir
3. Partner linke tıklar → /api/auth/verify-partner-email
4. /partner-setup-password sayfasına yönlendirilir, şifre belirlenir
5. Partner /partner/login ile giriş yapar
6. Partner dashboard'u açılır:
   - Bağlı öğrenci listesi
   - Komisyon/kazanç özeti
   - Profil ayarları
```

**Partner Mikrosite Desteği:** Bazı partnerler için özel landing page'ler mevcuttur:
- WCEP: `views/partners/wcep.ejs`
- MedCzech: `views/partners/medczech.ejs`
- Kanpus: `views/partners/kanpus.ejs`

---

## 14. Otomatik Görevler (Cron Jobs)

Tüm cron job'lar Vercel Serverless Functions olarak çalışır. Zamanlamalar `vercel.json`'da tanımlıdır.

| Dosya | Zamanlama | Ne Yapar |
|-------|-----------|---------|
| `api/cron/generate-blog.js` | Her 3 günde bir, 09:00 UTC | `blogAIService.generateBlogPost()` çağırır |
| `api/cron/backup-database.js` | Her gün 03:00 UTC | PostgreSQL dump alır, FTP'ye gönderir, e-posta bildirim gönderir |
| `api/cron/profile-reminder.js` | Her 6 saatte bir | Profili eksik öğrencilere hatırlatma e-postası gönderir |
| `api/cron/zoom-reminder.js` | Her 10 dakikada bir | 30 dakika içinde Zoom toplantısı olan randevu sahiplerine e-posta gönderir |

**Güvenlik:** Cron endpoint'leri `CRON_SECRET` env değişkeni ile korunmaktadır. Vercel bu secret'ı otomatik Authorization header olarak gönderir.

---

## 15. Çok Dilli Destek (i18n)

| Dil | Dosya |
|-----|-------|
| Türkçe | `locales/tr.js` |
| İngilizce | `locales/en.js` |

**Çalışma mantığı:**
1. `middleware/language.js` her istekte çalışır
2. Önce URL query param: `?lang=en`
3. Sonra `lang` cookie değeri
4. Bulunamazsa varsayılan: `tr`
5. `res.locals.currentLanguage` ve `res.locals.t` (çeviri fonksiyonu) set edilir
6. EJS şablonlarında `<%= t('nav.home') %>` şeklinde kullanılır

**Dil dosyası içeriği:**
- Navigasyon, buton, hata mesajları
- Ülke adları
- Kimlik doğrulama mesajları
- Servis açıklamaları
- Yüzlerce çeviri anahtarı

---

## 16. Ortam Değişkenleri

Tüm hassas bilgiler `.env` dosyasında veya Vercel dashboard'undaki ortam değişkenlerinde saklanır. Uygulama aşağıdaki değişkenleri kullanır:

### Veritabanı
| Değişken | Açıklama |
|----------|----------|
| `DATABASE_URL` | PostgreSQL bağlantı URL'si (uygulama ana) |
| `POSTGRES_URL` | Alternatif Postgres URL (migration script'leri için) |

### Uygulama
| Değişken | Açıklama |
|----------|----------|
| `NODE_ENV` | `production` veya `development` |
| `PORT` | Lokal sunucu portu (varsayılan: 4000) |
| `BASE_URL` | Sitenin tam URL'si (örn. `https://ventureglobal.com`) |
| `JWT_SECRET` | JWT imzalama anahtarı |
| `VERCEL` | Vercel ortamında `1` değerini alır |

### E-posta
| Değişken | Açıklama |
|----------|----------|
| `EMAIL_USER` | Gmail adresi (Nodemailer) |
| `EMAIL_PASS` | Gmail uygulama şifresi |

### Google
| Değişken | Açıklama |
|----------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |

### Yapay Zeka
| Değişken | Açıklama |
|----------|----------|
| `GROQ_API_KEY` | Groq API anahtarı (blog + AI öneriler) |
| `GEMINI_API_KEY` | Google Gemini API anahtarı |

### Ödeme
| Değişken | Açıklama |
|----------|----------|
| `STRIPE_SECRET_KEY` | Stripe gizli anahtar |
| `STRIPE_PUBLISHABLE_KEY` | Stripe yayın anahtarı (frontend) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook imza doğrulama |
| `GOPAY_GOID` | GoPay merchant ID |
| `GOPAY_CLIENT_ID` | GoPay Client ID |
| `GOPAY_CLIENT_SECRET` | GoPay Client Secret |
| `GOPAY_ENVIRONMENT` | `production` veya `sandbox` |

### Zoom
| Değişken | Açıklama |
|----------|----------|
| `ZOOM_ACCOUNT_ID` | Zoom hesap ID |
| `ZOOM_CLIENT_ID` | Zoom Server-to-Server Client ID |
| `ZOOM_CLIENT_SECRET` | Zoom Server-to-Server Client Secret |

### iCloud
| Değişken | Açıklama |
|----------|----------|
| `ICLOUD_EMAIL` | iCloud Apple ID e-postası |
| `ICLOUD_APP_PASSWORD` | iCloud uygulama şifresi (2FA bypass) |

### Cloudinary
| Değişken | Açıklama |
|----------|----------|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary bulut adı |
| `CLOUDINARY_API_KEY` | Cloudinary API anahtarı |
| `CLOUDINARY_API_SECRET` | Cloudinary API gizli anahtarı |

### Yedekleme
| Değişken | Açıklama |
|----------|----------|
| `FTP_HOST` | FTP sunucu adresi |
| `FTP_USER` | FTP kullanıcı adı |
| `FTP_PASSWORD` | FTP şifresi |
| `FTP_BACKUP_DIR` | FTP'deki hedef dizin |
| `FTP_AUTO_CLEANUP` | `true` ise eski yedekler otomatik silinir |
| `EMAIL_NOTIFICATIONS` | `true` ise yedekleme bildirimleri gönderilir |

### Sistem
| Değişken | Açıklama |
|----------|----------|
| `CRON_SECRET` | Cron endpoint güvenlik anahtarı |

---

## 17. Deployment (Vercel)

**`vercel.json` özeti:**

```json
{
  "builds": [
    { "src": "server.js", "use": "@vercel/node" },
    { "src": "api/cron/*.js", "use": "@vercel/node" },
    { "src": "public/**", "use": "@vercel/static" }
  ],
  "crons": [
    { "path": "/api/cron/generate-blog",    "schedule": "0 9 */3 * *" },
    { "path": "/api/cron/backup-database",  "schedule": "0 3 * * *" },
    { "path": "/api/cron/profile-reminder", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/zoom-reminder",    "schedule": "*/10 * * * *" }
  ],
  "env": { "NODE_ENV": "production" }
}
```

**Deployment komutları:**
- `npm run deploy` → Staging/preview deploy
- `npm run deploy:prod` → Production deploy (`--prod` flag ile)

**Routing:** Vercel'in route yapılandırması tüm istekleri önce statik dosyalara, ardından `server.js`'e yönlendirir. Cache header: `no-store`.

---

## 18. Sayfa ve Şablon Kataloğu

### Genel (Herkese Açık)

| Şablon | URL | Açıklama |
|--------|-----|----------|
| `index.ejs` | `/` | Ana sayfa |
| `services.ejs` | `/services` | Hizmetler sayfası |
| `about-us.ejs` | `/about` | Hakkımızda |
| `contact.ejs` | `/contact` | İletişim formu |
| `terms.ejs` | `/terms` | Kullanım koşulları |
| `career.ejs` | `/career` | Kariyer sayfası |
| `media.ejs` | `/media` | Medya/basın |
| `gallery.ejs` | `/gallery` | Fotoğraf galerisi |
| `universities.ejs` | `/universities` | Üniversite listesi |
| `university-detail.ejs` | `/university/:slug` | Üniversite detayı |
| `student-wizard.ejs` | `/student-wizard` | AI üniversite öneri sihirbazı |
| `seo/yurtdisi-egitim-danismanligi.ejs` | `/yurtdisi-egitim-danismanligi` | SEO landing page |
| `student-life-*.ejs` | `/student-life/...` | Öğrenci yaşamı içerikleri |

### Kimlik Doğrulama

| Şablon | URL | Açıklama |
|--------|-----|----------|
| `login.ejs` | `/login` | Giriş sayfası |
| `register.ejs` | `/register` | Kayıt sayfası |
| `complete-google-registration.ejs` | `/complete-google-registration` | Google sonrası profil tamamlama |
| `forgot-password.ejs` | `/forgot-password` | Şifre sıfırlama talebi |
| `reset-password.ejs` | `/reset-password` | Yeni şifre belirleme |
| `verification-success.ejs` | `/verification-success` | E-posta doğrulama başarılı |
| `verification-error.ejs` | `/verification-error` | E-posta doğrulama hatası |

### Öğrenci Paneli

| Şablon | URL | Açıklama |
|--------|-----|----------|
| `user/dashboard.ejs` | `/user/dashboard` | Öğrenci ana sayfası |
| `user/applications.ejs` | `/user/applications` | Başvurularım |
| `user/appointments.ejs` | `/user/appointments` | Randevularım |
| `user/services.ejs` | `/user/services` | Hizmetlerim ve ödemeler |
| `user/files.ejs` | `/user/files` | Belgelerim |
| `user/settings.ejs` | `/user/settings` | Hesap ayarları |

### Admin Paneli

| Şablon | URL | Açıklama |
|--------|-----|----------|
| `admin/dashboard.ejs` | `/admin/dashboard` | Admin ana sayfası |
| `admin/users.ejs` | `/admin/users` | Öğrenci listesi |
| `admin/student-details.ejs` | `/admin/student-details/:id` | Öğrenci detay |
| `admin/applications.ejs` | `/admin/applications` | Başvuru yönetimi |
| `admin/universities-simple.ejs` | `/admin/universities` | Üniversite yönetimi |
| `admin/partners.ejs` | `/admin/partners` | Partner yönetimi |
| `admin/appointments.ejs` | `/admin/appointments` | Randevu yönetimi |
| `admin/appointment-create.ejs` | `/admin/appointments/create` | Yeni randevu |
| `admin/backups.ejs` | `/admin/backups` | Yedek yönetimi |
| `admin/gallery.ejs` | `/admin/gallery` | Galeri yönetimi |
| `admin/ai-recommendations.ejs` | `/admin/ai-recommendations` | AI öneri sonuçları |
| `admin/admins.ejs` | `/admin/admins` | Admin kullanıcı yönetimi |

### Partner Paneli

| Şablon | URL | Açıklama |
|--------|-----|----------|
| `partner-login.ejs` | `/partner/login` | Partner giriş |
| `partner-setup-password.ejs` | `/partner-setup-password` | İlk şifre kurulumu |
| `partner/dashboard.ejs` | `/partner/dashboard` | Partner ana sayfası |
| `partner/settings.ejs` | `/partner/settings` | Partner ayarları |

### Blog

| Şablon | URL | Açıklama |
|--------|-----|----------|
| `blog/index.ejs` | `/blog` | Blog listesi |
| `blog/article.ejs` | `/blog/:slug` | Makale detayı |

### Hata Sayfaları

| Şablon | Açıklama |
|--------|----------|
| `404.ejs` | Sayfa bulunamadı |
| `error.ejs` | Genel sunucu hatası |

---

## 19. Güvenlik Notları ve Teknik Borç

> Bu bölüm, yeniden yazım ekibinin **öncelikli olarak düzeltmesi gereken** konuları listeler.

### Kritik Güvenlik Sorunları

1. **Kaynak kodda hardcoded credentials:**
   - `services/emailService.js` içinde Gmail şifresine fallback değer var
   - `config/database.js` içinde PostgreSQL bağlantı URL'sine fallback değer var
   - Repo paylaşılırsa bu bilgiler açığa çıkar
   - **Çözüm:** Tüm credentials yalnızca env değişkenlerinden okunmalı; fallback değer olmamalı

2. **JWT_SECRET fallback:**
   - `middleware/auth.js` içinde `JWT_SECRET` env yoksa hardcoded bir fallback değer kullanılıyor
   - **Çözüm:** Env yoksa uygulama başlatılmamalı (hard fail)

3. **`POST /blog/generate` yetkilendirme sorunu:**
   - Route `req.user.role === 'admin'` kontrol ediyor
   - Ancak bu router'a `authenticateUser` middleware eklenmemiş
   - `req.user` seti olmadığı için kontrol her zaman false dönebilir veya crash oluşabilir
   - **Çözüm:** Router başında `authenticateAdmin` middleware eklenmeli

### Teknik Borç

4. **`routes/admin.js` çok büyük (~7000 satır):**
   - Aynı path için birden fazla route tanımı var (Express ilkini kullanır, geri kalanı dead code)
   - **Çözüm:** Admin rotaları kategoriye göre ayrı dosyalara bölünmeli

5. **`server.js` içinde inline route'lar:**
   - Onlarca endpoint doğrudan `server.js`'te tanımlanmış
   - **Çözüm:** Tümü `routes/` altında uygun modüllere taşınmalı

6. **ORM yok — ham SQL:**
   - SQL injection riski manuel parametrize sorgu kullanımına bağlı
   - Migration sistemi düzensiz (kısmen `database/`, kısmen inline `CREATE TABLE`)
   - **Çözüm:** Prisma, Drizzle veya Knex.js gibi bir query builder/ORM kullanılabilir

7. **İki admin tablosu:**
   - `users` (is_admin flag) ve `admins` (legacy) tablosu birlikte kullanılıyor
   - **Çözüm:** Tek tablo, role-based system

8. **`server.js` sonunda iki ayrı 404 handler:**
   - İkinci handler ilkini gölgeler
   - **Çözüm:** Tek 404 handler

9. **Rate limiting eksikliği:**
   - Sadece randevu endpoint'lerinde rate limiting var
   - Auth endpoint'leri (login, register) için de uygulanmalı

---

## 20. Yeniden Yazım için Öneriler

Bu bölüm, sıfırdan yazacak bir ekibe mimari öneriler sunmaktadır.

### Mimari Önerisi

```
[Next.js App Router veya Remix]
       │
       ├── /app (frontend pages)
       ├── /app/api (backend API routes)
       └── /lib (services, db, utils)
```

Veya backend/frontend ayrımı istiyorsanız:

```
[React/Next.js Frontend] ←→ [Node.js/Express veya Fastify API]
                                        │
                                [PostgreSQL + Prisma ORM]
```

### Öncelikli Modüller

1. **Auth sistemi** — NextAuth.js veya benzeri (Google OAuth, email/şifre, JWT)
2. **Kullanıcı/Admin paneli** — Role-based access control (RBAC)
3. **Randevu sistemi** — CalDAV, Zoom, email entegrasyonu
4. **Blog** — Groq AI entegrasyonu, ikidilli içerik
5. **Ödeme** — Stripe entegrasyonu
6. **E-posta** — Resend veya nodemailer (şablonlu)
7. **Dosya yönetimi** — Cloudinary (zaten var, devam edilebilir)
8. **Cron jobs** — Vercel Cron veya Upstash QStash

### Veritabanı Önerisi

- **ORM:** Prisma (TypeScript ile mükemmel uyum)
- **Migration:** Prisma Migrate
- **PostgreSQL:** Mevcut Neon/Supabase devam edebilir

### Alınması Gereken Envanter

Yeniden yazım başlamadan ekibin edinmesi gereken bilgiler:

- [ ] Tüm env değişken değerleri (production)
- [ ] PostgreSQL dump (tam şema + data)
- [ ] Cloudinary hesap erişimi
- [ ] Google OAuth credentials
- [ ] Stripe API keys + webhook secret
- [ ] Zoom API credentials
- [ ] iCloud app password (CalDAV/CardDAV)
- [ ] Groq + Gemini API keys
- [ ] Vercel project access
- [ ] FTP yedekleme bilgileri
- [ ] Domain / DNS yönetimi

---

*Bu rapor, /Users/cinarozmeral/Downloads/Veture Global WEBSITE kaynak kodu analiz edilerek hazırlanmıştır. Son güncelleme: Nisan 2026.*
