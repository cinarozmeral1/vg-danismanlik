# 🚀 Yedekleme Sistemi - Hızlı Başlangıç

## 5 Dakikada Kurulum

### 1️⃣ FTP Bilgilerinizi Hazırlayın

Elinizde olması gerekenler:
- FTP sunucu adresi (örn: `ftp.example.com`)
- FTP kullanıcı adı
- FTP şifresi
- FTP port (genellikle `21`)

### 2️⃣ Vercel Environment Variables Ekleyin

**Vercel Dashboard** → **Settings** → **Environment Variables**

Aşağıdaki değişkenleri ekleyin:

```env
FTP_HOST=ftp.your-server.com
FTP_PORT=21
FTP_USER=your-username
FTP_PASSWORD=your-password
FTP_SECURE=false
FTP_BACKUP_DIR=/venture-global-backups
FTP_AUTO_CLEANUP=true
CRON_SECRET=buraya-güçlü-random-key-yazın
```

**CRON_SECRET nasıl oluşturulur?**
Terminal'de:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3️⃣ Deploy Edin

```bash
vercel --prod
```

### 4️⃣ Test Edin

**Manuel yedekleme yapın:**
```bash
npm run backup
```

veya

```bash
node scripts/backup-to-ftp.js
```

**Başarılı çıktı:**
```
🔄 FTP yedekleme başlıyor...
📊 Yedeklenecek tablo sayısı: 9
  ✅ users: 15 kayıt yedeklendi
  ✅ applications: 8 kayıt yedeklendi
  ...
📤 Dosya FTP'ye yükleniyor...
✅ Yedek FTP'ye yüklendi: venture-global-backup-2024-11-25_03-00-00.json
```

### 5️⃣ Otomatik Yedekleme Aktif! ✅

Artık her gün saat **03:00 UTC** (Türkiye: 06:00) otomatik yedekleme yapılacak.

---

## ⚙️ İsteğe Bağlı: Email Bildirimleri

Yedekleme başarılı/başarısız olduğunda email almak için:

```env
EMAIL_NOTIFICATIONS=true
ADMIN_EMAIL=admin@ventureglobal.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_SECURE=false
```

**Gmail App Password nasıl alınır?**
1. Google Hesabım → Güvenlik
2. 2 Adımlı Doğrulama'yı aç
3. Uygulama şifreleri → Yeni şifre oluştur

---

## 🔄 Yedekten Geri Yükleme

```bash
# 1. Yedek dosyasını indirin (FTP sunucunuzdan)
# 2. Geri yükleyin:
npm run backup:restore path/to/backup.json
```

veya

```bash
node scripts/restore-from-backup.js backup.json
```

⚠️ **DİKKAT:** Bu işlem mevcut verileri silecektir!

---

## 📊 Cron Job'u İzleme

**Vercel Dashboard** → **Deployments** → **Functions** → **Logs**

Burada her gün 03:00'te çalışan yedekleme loglarını görebilirsiniz.

---

## 🧪 Manuel Test (Cron Endpoint)

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/backup-database
```

---

## 📁 Yedek Dosyası Nerede?

FTP sunucunuzda:
```
/venture-global-backups/
  ├── venture-global-backup-2024-11-25_03-00-00.json
  ├── venture-global-backup-2024-11-26_03-00-00.json
  └── ...
```

**30 günden eski yedekler otomatik silinir.**

---

## ❓ Sorun mu Yaşıyorsunuz?

### FTP bağlantı hatası
✅ FTP bilgilerini kontrol edin  
✅ FTP sunucusunun aktif olduğundan emin olun  
✅ Port numarasını kontrol edin (genellikle 21)

### Cron job çalışmıyor
✅ `vercel.json` dosyasını kontrol edin  
✅ Deploy tekrar yapın: `vercel --prod`  
✅ Vercel Dashboard'dan cron logs kontrol edin

### Email gönderilmiyor
✅ Gmail kullanıyorsanız App Password oluşturun  
✅ Email ayarlarını test edin:
```bash
npm run backup:test-email
```

---

## 📚 Detaylı Dokümantasyon

Daha fazla bilgi için: **[BACKUP_SYSTEM.md](BACKUP_SYSTEM.md)**

---

## ✅ Tamamdır!

Artık veritabanınız **her gün otomatik olarak yedekleniyor**. 🎉

Herhangi bir sorun olursa email bildirimi alacaksınız (email aktifse).

