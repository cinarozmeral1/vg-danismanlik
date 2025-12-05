# Stripe Ödeme Sistemi Kurulum ve Test Rehberi

## 📋 İçindekiler
1. [Genel Bakış](#genel-bakış)
2. [Kurulum Adımları](#kurulum-adımları)
3. [Stripe Yapılandırması](#stripe-yapılandırması)
4. [Test Modu Kullanımı](#test-modu-kullanımı)
5. [Üretim Ortamına Geçiş](#üretim-ortamına-geçiş)
6. [Güvenlik Kontrolleri](#güvenlik-kontrolleri)
7. [Sorun Giderme](#sorun-giderme)

## 🎯 Genel Bakış

Bu sistem, öğrencilerin danışmanlık hizmetlerini kredi kartıyla ödeyebilmelerini sağlar:

### Özellikler
- ✅ Stripe ile güvenli kredi kartı ödemeleri
- ✅ Çoklu para birimi desteği (TRY, EUR, USD)
- ✅ Taksitli ödeme desteği
- ✅ Otomatik ödeme durumu güncelleme (Webhook)
- ✅ Wise transfer takibi
- ✅ 3D Secure desteği
- ✅ Admin panel entegrasyonu

## 🚀 Kurulum Adımları

### 1. Veritabanı Migrasyonu

Veritabanı değişikliklerini uygulayın:

```bash
node database/run_payment_migration.js
```

Bu işlem:
- `services` tablosuna ödeme alanlarını ekler
- `payment_logs` tablosunu oluşturur
- Gerekli indeksleri ekler

### 2. Stripe Hesabı Oluşturma

1. [Stripe Dashboard](https://dashboard.stripe.com/register) üzerinden hesap oluşturun
2. Test modunda başlayın (otomatik aktiftir)
3. API anahtarlarınızı alın

### 3. Environment Variables Ayarlama

`.env` dosyanıza aşağıdaki değerleri ekleyin:

```env
# Stripe Test Mode Keys (Test için)
STRIPE_SECRET_KEY=sk_test_your_test_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Live Mode Keys (Canlıya geçerken değiştirin)
# STRIPE_SECRET_KEY=sk_live_your_live_secret_key
# STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
# STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret
```

#### API Anahtarlarını Bulma:

1. Stripe Dashboard → [API Keys](https://dashboard.stripe.com/test/apikeys)
2. **Publishable key** ve **Secret key**'i kopyalayın
3. Test modunda `sk_test_` ve `pk_test_` ile başlarlar

### 4. Webhook Yapılandırması

#### Geliştirme Ortamı (Local)

Stripe CLI kullanarak local webhook test edin:

```bash
# Stripe CLI yükleyin
brew install stripe/stripe-cli/stripe

# Stripe'a giriş yapın
stripe login

# Webhook'u local sunucuya yönlendirin
stripe listen --forward-to http://localhost:4000/webhook/stripe
```

CLI size bir `webhook secret` verecek, bunu `.env` dosyasına ekleyin.

#### Production Ortamı

1. Stripe Dashboard → [Webhooks](https://dashboard.stripe.com/test/webhooks)
2. "Add endpoint" tıklayın
3. URL: `https://yourdomain.com/webhook/stripe`
4. Dinlenecek eventler:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `payment_intent.processing`
   - `payment_intent.requires_action`
5. Webhook secret'ı kopyalayıp `.env` dosyasına ekleyin

## 🧪 Test Modu Kullanımı

### Test Kartları

Stripe test modunda kullanabileceğiniz kartlar:

#### ✅ Başarılı Ödeme
```
Kart No: 4242 4242 4242 4242
Tarih: Gelecekteki herhangi bir tarih (örn: 12/25)
CVC: Herhangi 3 rakam (örn: 123)
```

#### ❌ Başarısız Ödeme
```
Kart No: 4000 0000 0000 0002
Tarih: Gelecekteki herhangi bir tarih
CVC: Herhangi 3 rakam
```

#### 🔐 3D Secure Gerektiren
```
Kart No: 4000 0027 6000 3184
Tarih: Gelecekteki herhangi bir tarih
CVC: Herhangi 3 rakam
```

[Tüm test kartları listesi](https://stripe.com/docs/testing#cards)

### Test Senaryoları

#### Senaryo 1: Başarılı Ödeme Akışı

1. Admin olarak giriş yapın
2. Bir öğrenciye hizmet ekleyin:
   - Hizmet: "Kabul Öncesi Danışmanlık"
   - Tutar: 500
   - Para Birimi: EUR
3. Öğrenci olarak giriş yapın
4. "Hizmetler & Ödemeler" sayfasına gidin
5. "Ödeme Yap" butonuna tıklayın
6. Test kartı bilgilerini girin (4242 4242 4242 4242)
7. "Ödemeyi Tamamla" butonuna tıklayın
8. Başarılı ödeme mesajını görün
9. Admin panelinde ödeme durumunu kontrol edin

#### Senaryo 2: Taksitli Ödeme

1. Admin panelinde taksitli hizmet oluşturun
2. Öğrenci portalında her taksiti ayrı ayrı ödeyin
3. Tüm taksitler ödenince hizmetin "Ödendi" olarak işaretlendiğini görün

#### Senaryo 3: Wise Transfer Takibi

1. Ödeme tamamlandıktan sonra admin paneline gidin
2. Ödenen hizmeti bulun
3. "Wise'a Transferi" butonuna tıklayın
4. Transfer notları ekleyin
5. Hizmetin "Wise'a Transfer Edildi" rozeti aldığını görün

### Test Komutları

Ödeme loglarını görmek için:

```sql
SELECT * FROM payment_logs ORDER BY created_at DESC LIMIT 10;
```

Ödenmemiş hizmetleri görmek için:

```sql
SELECT * FROM services WHERE is_paid = false;
```

Wise'a transfer bekleyen ödemeleri görmek için:

```sql
SELECT * FROM services WHERE is_paid = true AND wise_transferred = false;
```

## 🔒 Güvenlik Kontrolleri

### ✅ Uygulanan Güvenlik Önlemleri

1. **Webhook İmza Doğrulama**
   - Her webhook isteği Stripe imzası ile doğrulanır
   - Sahte webhook istekleri reddedilir

2. **Kimlik Doğrulama**
   - Tüm ödeme endpoint'leri `authenticateUser` middleware kullanır
   - Kullanıcı sadece kendi hizmetlerini ödeyebilir

3. **HTTPS Zorunluluğu**
   - Production'da tüm istekler HTTPS üzerinden yapılır
   - Helmet.js ile güvenlik başlıkları eklenir

4. **Hassas Veri Koruması**
   - Kart bilgileri asla sunucuda saklanmaz
   - Stripe Elements ile doğrudan Stripe'a gönderilir
   - PCI DSS uyumlu

5. **SQL Injection Koruması**
   - Parametrize sorgular kullanılır
   - Pool.query ile güvenli veri tabanı erişimi

### 🔍 Güvenlik Testi Checklist

- [ ] Webhook imza doğrulaması çalışıyor mu?
- [ ] Başka kullanıcının hizmetini ödemeye çalışıldığında hata veriyor mu?
- [ ] SSL sertifikası geçerli mi?
- [ ] API anahtarları `.env` dosyasında güvenli mi?
- [ ] `.env` dosyası `.gitignore`'a eklenmiş mi?
- [ ] Rate limiting aktif mi?
- [ ] CORS yapılandırması doğru mu?

## 🌐 Üretim Ortamına Geçiş

### 1. Stripe Live Mode'a Geçiş

1. Stripe Dashboard'da "Activate account" yapın
2. İş bilgilerinizi tamamlayın
3. Banka hesabı bilgilerini ekleyin (Wise)
4. Live API anahtarlarını alın

### 2. Environment Variables Güncelleme

```env
# Live keys ile değiştirin
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### 3. Webhook Endpoint Güncelleme

1. Production URL'inizi Stripe'a ekleyin
2. Webhook secret'ı güncelleyin
3. Event'lerin geldiğini test edin

### 4. Son Kontroller

- [ ] Test modundan live moda geçildi
- [ ] Webhook production URL'ine yönlendiriliyor
- [ ] SSL sertifikası aktif
- [ ] Gerçek bir ödeme testi yapıldı (küçük tutar)
- [ ] Admin panelinde ödeme görünüyor
- [ ] Webhook event'leri log'lanıyor

## 🐛 Sorun Giderme

### Problem: "Stripe is not configured" Hatası

**Çözüm:**
```bash
# .env dosyasında STRIPE_SECRET_KEY kontrol edin
echo $STRIPE_SECRET_KEY

# Sunucuyu yeniden başlatın
npm start
```

### Problem: Webhook Event'leri Gelmiyor

**Çözüm:**
1. Webhook URL'in doğru olduğunu kontrol edin
2. Stripe Dashboard → Webhooks → Event history kontrol edin
3. Webhook secret doğru mu kontrol edin
4. Local test için Stripe CLI kullanın:
   ```bash
   stripe listen --forward-to http://localhost:4000/webhook/stripe
   ```

### Problem: Ödeme Başarılı Ama Veritabanında Güncellenmedi

**Çözüm:**
1. `payment_logs` tablosunu kontrol edin:
   ```sql
   SELECT * FROM payment_logs WHERE stripe_event_type = 'payment_intent.succeeded' ORDER BY created_at DESC LIMIT 5;
   ```
2. Webhook event'lerinde hata var mı kontrol edin
3. Server log'larını inceleyin

### Problem: "Invalid API Key" Hatası

**Çözüm:**
- Test modunda `sk_test_` ile başlayan anahtarı kullanın
- Live modda `sk_live_` ile başlayan anahtarı kullanın
- API anahtarlarının doğru kopyalandığından emin olun

## 📊 Monitoring ve Logs

### Stripe Dashboard

- [Payments](https://dashboard.stripe.com/test/payments) - Tüm ödemeler
- [Events](https://dashboard.stripe.com/test/events) - Webhook event'leri
- [Logs](https://dashboard.stripe.com/test/logs) - API istekleri

### Database Logs

```sql
-- Son 10 ödeme event'i
SELECT 
    pl.*,
    s.service_name,
    u.email
FROM payment_logs pl
LEFT JOIN services s ON pl.service_id = s.id
LEFT JOIN users u ON pl.user_id = u.id
ORDER BY pl.created_at DESC
LIMIT 10;

-- Başarısız ödemeler
SELECT * FROM payment_logs 
WHERE status = 'failed' OR error_message IS NOT NULL
ORDER BY created_at DESC;
```

## 📞 Destek

### Dokümantasyon
- [Stripe API Docs](https://stripe.com/docs/api)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Webhook Documentation](https://stripe.com/docs/webhooks)

### İletişim
- Stripe Destek: support@stripe.com
- Technical Issues: [GitHub Issues](your-repo-url)

---

## ✨ Başarılı Implementasyon!

Tüm adımları takip ettiyseniz, sisteminiz artık:
- ✅ Öğrencilerden güvenli kredi kartı ödemeleri alabiliyor
- ✅ Otomatik olarak ödeme durumlarını güncelliyor
- ✅ Wise transfer takibi yapabiliyor
- ✅ Admin panelinden tüm ödemeleri yönetebiliyor

**Test modunda bol bol test yapın, canlıya geçmeden önce tüm senaryoları deneyin!** 🚀

