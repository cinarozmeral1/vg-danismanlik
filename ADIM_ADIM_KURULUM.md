# 🚀 Yedekleme Sistemi - Adım Adım Kurulum

## BAŞLAMADAN ÖNCE: FTP Kontrolü

### Seçenek A: FTP bilgilerim VAR ✅
Eğer elinizde şunlar varsa:
- FTP sunucu adresi (örn: ftp.example.com)
- FTP kullanıcı adı
- FTP şifresi

→ **ADIM 2A'ya geçin**

### Seçenek B: FTP bilgilerim YOK ❌
Hiç FTP sunucunuz yoksa veya bilgileriniz yoksa

→ **ADIM 2B'ye geçin** (önce FTP alacağız)

---

## ADIM 2A: FTP Bilgileri Var (Hızlı Yol)

### 1. Terminal'i açın ve proje klasörüne gidin:
```bash
cd "/Users/cinarozmeral/Downloads/Veture Global WEBSITE"
```

### 2. .env dosyası oluşturun:
```bash
cp env.example .env
```

### 3. .env dosyasını text editör ile açın:
```bash
open -e .env
```

### 4. Dosyanın EN ALTINA şunları ekleyin:

```bash
# ========================================
# YEDEKLEME SİSTEMİ AYARLARI
# ========================================

# FTP Sunucu Bilgileri (KENDİ BİLGİLERİNİZİ YAZIN)
FTP_HOST=ftp.your-server.com
FTP_PORT=21
FTP_USER=your-username
FTP_PASSWORD=your-password
FTP_SECURE=false
FTP_BACKUP_DIR=/venture-global-backups
FTP_AUTO_CLEANUP=true

# Güvenlik Anahtarı (DEĞİŞTİRMEYİN)
CRON_SECRET=231e826a66829bad99932c246736f9ff3fc19dec72e1325406ddfe3288b7a4f1

# Email Bildirimleri (Opsiyonel - şimdilik false bırakın)
EMAIL_NOTIFICATIONS=false
ADMIN_EMAIL=admin@ventureglobal.com
```

### 5. SADECE ŞU SATIRLARI DEĞİŞTİRİN:
```bash
FTP_HOST=buraya-ftp-adresinizi-yazin
FTP_USER=buraya-kullanici-adinizi-yazin
FTP_PASSWORD=buraya-sifrenizi-yazin
```

### 6. Dosyayı kaydedin ve kapatın (Cmd+S, Cmd+W)

### 7. Terminal'de test edin:
```bash
npm run backup
```

### 8. Başarılı mı?

**EVET ✅** → Harika! ADIM 3'e geçin (Vercel'e deploy)
**HAYIR ❌** → Hata mesajını bana gönderin, çözelim

---

## ADIM 2B: FTP Bilgileri Yok (Önce FTP Alalım)

### Ücretsiz FTP Seçenekleri:

#### Seçenek 1: 000webhost (En Kolay)
1. https://www.000webhost.com/ adresine gidin
2. "Sign Up Free" tıklayın
3. Ücretsiz hesap oluşturun
4. Email'inizi doğrulayın
5. "Create Website" → "Upload Your Website"
6. FTP bilgileri gösterilecek:
   - FTP Host
   - FTP Username
   - FTP Password
7. Bu bilgileri not edin → ADIM 2A'ya dönün

#### Seçenek 2: infinityfree (Alternatif)
1. https://infinityfree.net/ adresine gidin
2. Ücretsiz hesap oluşturun
3. FTP bilgilerini alın
4. ADIM 2A'ya dönün

#### Seçenek 3: Mevcut Hosting'iniz
Eğer bir hosting hizmetiniz varsa (Turhost, Natro vs):
1. Hosting panelinize girin (cPanel genellikle)
2. "FTP Accounts" veya "Dosya Yöneticisi" bölümüne gidin
3. FTP hesabı oluşturun veya mevcut bilgileri görüntüleyin
4. ADIM 2A'ya dönün

---

## ADIM 3: Vercel'e Deploy

Local test başarılıysa, şimdi Vercel'e yükleyelim:

### 1. Vercel Environment Variables'ları ekleyin:

**Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**

Şu değişkenleri AYNEN ekleyin:

| Name | Value |
|------|-------|
| FTP_HOST | (FTP sunucu adresiniz) |
| FTP_PORT | 21 |
| FTP_USER | (FTP kullanıcı adınız) |
| FTP_PASSWORD | (FTP şifreniz) |
| FTP_SECURE | false |
| FTP_BACKUP_DIR | /venture-global-backups |
| FTP_AUTO_CLEANUP | true |
| CRON_SECRET | 231e826a66829bad99932c246736f9ff3fc19dec72e1325406ddfe3288b7a4f1 |

**ÖNEMLİ:** Her biri ayrı satır olarak eklenecek!

### 2. Terminal'de deploy edin:
```bash
vercel --prod
```

### 3. Deploy tamamlandı mı?

**EVET ✅** → Tebrikler! ADIM 4'e geçin
**HAYIR ❌** → Hata mesajını gönderin

---

## ADIM 4: Doğrulama

### 1. FTP'ye bağlanın ve kontrol edin:

FileZilla veya başka FTP client ile:
- Host: (FTP adresiniz)
- Username: (Kullanıcı adınız)
- Password: (Şifreniz)

`/venture-global-backups/` klasöründe yedek dosyasını göreceksiniz:
```
venture-global-backup-2024-11-25_XX-XX-XX.json
```

### 2. Vercel Logs kontrol edin:

**Vercel Dashboard** → **Deployments** → **Functions** → **Logs**

Cron job loglarını göreceksiniz.

---

## ✅ TAMAMLANDI!

Artık her gün saat **03:00 UTC** (Türkiye: 06:00) otomatik yedekleme yapılacak.

### Manuel yedekleme:
```bash
npm run backup
```

### Yedekten geri yükleme:
```bash
npm run backup:restore path/to/backup.json
```

---

## ❓ Sorun mu Yaşıyorsunuz?

Her adımda takıldığınız yeri bana bildirin, birlikte çözelim!

Olası hatalar:
- **FTP connection failed** → FTP bilgilerini kontrol edin
- **Database error** → DATABASE_URL kontrol edin
- **Module not found** → `npm install` çalıştırın

