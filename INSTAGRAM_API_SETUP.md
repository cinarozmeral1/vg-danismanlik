# 📸 Instagram API Kurulum Rehberi

Bu rehber, web sitenizde gerçek Instagram paylaşımlarınızı göstermek için Instagram API'sini nasıl kuracağınızı açıklar.

## 🔧 Adım 1: Facebook Developer Hesabı Oluşturma

1. [Facebook Developers](https://developers.facebook.com/) sitesine gidin
2. "Get Started" butonuna tıklayın
3. Facebook hesabınızla giriş yapın
4. Developer hesabınızı oluşturun

## 📱 Adım 2: Instagram Business Hesabı

1. Instagram hesabınızı **Business** hesabına çevirin:
   - Instagram uygulamasında → Profil → Ayarlar → Hesap Türü → Business'e Geç
2. Facebook sayfanızı Instagram hesabınızla bağlayın

## 🛠️ Adım 3: Facebook App Oluşturma

1. [Facebook Developers](https://developers.facebook.com/) → "My Apps" → "Create App"
2. App türü olarak **"Business"** seçin
3. App adı: "Venture Global Website"
4. App Contact Email: ventureglobaldanisma@gmail.com
5. App Purpose: "Other" seçin

## 🔑 Adım 4: Instagram Basic Display API Ekleme

1. Oluşturduğunuz app'e gidin
2. Sol menüden **"Add Product"** → **"Instagram Basic Display"** → **"Set Up"**
3. **"Create New App"** seçin

## ⚙️ Adım 5: App Ayarları

### Basic Settings:
- **App Domains**: `localhost:4000` (geliştirme için)
- **Privacy Policy URL**: `https://ventureglobal.com/privacy`
- **Terms of Service URL**: `https://ventureglobal.com/terms`

### Instagram Basic Display:
- **Valid OAuth Redirect URIs**: 
  - `http://localhost:4000/auth/instagram/callback` (geliştirme)
  - `https://ventureglobal.com/auth/instagram/callback` (production)

## 🔐 Adım 6: Access Token Alma

### Yöntem 1: Graph API Explorer (Kolay)
1. [Graph API Explorer](https://developers.facebook.com/tools/explorer/) gidin
2. App'inizi seçin
3. **"Get Token"** → **"Get User Access Token"**
4. İzinler: `instagram_basic`, `instagram_manage_insights`
5. Token'ı kopyalayın

### Yöntem 2: Uzun Ömürlü Token (Önerilen)
1. Kısa süreli token'ı alın (yukarıdaki yöntemle)
2. Aşağıdaki URL'yi kullanarak uzun ömürlü token alın:
```
https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=SHORT_LIVED_TOKEN
```

## 📝 Adım 7: Environment Variables

`.env` dosyanıza aşağıdaki bilgileri ekleyin:

```env
# Instagram API Configuration
INSTAGRAM_ACCESS_TOKEN=your-long-lived-access-token-here
INSTAGRAM_USER_ID=your-instagram-user-id-here
```

### User ID Bulma:
1. [Graph API Explorer](https://developers.facebook.com/tools/explorer/) gidin
2. Token'ınızı girin
3. `me` endpoint'ini çağırın
4. Response'da `id` değerini kopyalayın

## 🚀 Adım 8: Test Etme

1. Server'ı yeniden başlatın:
```bash
NODE_ENV=development PORT=4000 node server.js
```

2. Tarayıcıda test edin:
```
http://localhost:4000/about-us
```

3. API endpoint'ini test edin:
```
http://localhost:4000/api/instagram/posts
```

## 🔄 Adım 9: Otomatik Token Yenileme

Instagram token'ları 60 günde bir süresi doluyor. Otomatik yenileme için:

1. Server'da cron job oluşturun
2. Token yenileme endpoint'i ekleyin
3. Yeni token'ı veritabanında güncelleyin

## 📊 API Limitleri

- **Günlük Limit**: 200 istek/gün
- **Saatlik Limit**: 25 istek/saat
- **Token Süresi**: 60 gün (uzun ömürlü)
- **Sayfa Başına Post**: 25 post (maksimum)
- **Toplam Post**: Sınırsız (tüm postlar çekilir)

## 🛡️ Güvenlik

- Access token'ları asla client-side'da kullanmayın
- Token'ları environment variable'da saklayın
- Production'da HTTPS kullanın

## 🆘 Sorun Giderme

### Yaygın Hatalar:

1. **"Invalid Access Token"**
   - Token'ın süresi dolmuş olabilir
   - Yeni token alın

2. **"User not found"**
   - User ID yanlış olabilir
   - Instagram hesabının business hesabı olduğundan emin olun

3. **"App not approved"**
   - App'iniz henüz onaylanmamış
   - Test kullanıcıları ekleyin

## 📞 Destek

Sorun yaşarsanız:
- [Facebook Developer Support](https://developers.facebook.com/support/)
- [Instagram API Documentation](https://developers.facebook.com/docs/instagram-api)

---

## 🎯 Yeni Özellikler

### 📱 Tüm Postları Göster
- **Pagination**: Tüm Instagram postlarınız otomatik olarak çekilir
- **Sayfalama**: İlk 12 post gösterilir, "Daha Fazla Göster" ile devam edilir
- **Lazy Loading**: Resimler ihtiyaç duyulduğunda yüklenir
- **Responsive**: Mobil ve desktop uyumlu tasarım

### 🔄 Otomatik Güncelleme
- Instagram'da yeni post paylaştığınızda otomatik olarak web sitesinde görünür
- Tüm postlar gerçek zamanlı olarak çekilir
- API limitlerini aşmamak için akıllı sayfalama sistemi

**Not**: Bu kurulum tamamlandıktan sonra, Instagram hesabınızda paylaştığınız **TÜM** postlar otomatik olarak web sitenizde görünecektir! 🎉
