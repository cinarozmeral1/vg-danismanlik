# 📥 Yedeklere Erişim Rehberi

Bu rehber, Venture Global yedeklerine nasıl erişeceğinizi ve yedekleri nasıl yöneteceğinizi açıklar.

## 🎯 Yedeklere Erişim Yöntemleri

### 1. Admin Panel Üzerinden (Önerilen) ⭐

**En kolay ve en güvenli yöntem:**

1. **Admin Paneline Giriş Yapın**
   - `/admin/dashboard` adresine gidin
   - Admin hesabınızla giriş yapın

2. **Yedekler Sayfasına Gidin**
   - Sol menüden **"Yedekler"** seçeneğine tıklayın
   - Veya direkt `/admin/backups` adresine gidin

3. **Yedekleri Görüntüleyin**
   - Tüm yedekler listelenir
   - Her yedek için:
     - Dosya adı
     - Boyut (MB)
     - Oluşturulma tarihi
     - İndirme butonu

4. **Yedek İndirin**
   - İstediğiniz yedeğin yanındaki **"İndir"** butonuna tıklayın
   - Yedek ZIP formatında bilgisayarınıza indirilir

5. **Manuel Yedek Oluşturun**
   - **"Yeni Yedek Al"** butonuna tıklayın
   - Yedekleme arka planda başlar
   - Birkaç dakika sonra yeni yedek listede görünür

### 2. FTP Sunucu Üzerinden

**Doğrudan FTP erişimi:**

1. **FTP İstemcisi Kullanın**
   - FileZilla, WinSCP, Cyberduck gibi bir FTP istemcisi kurun
   
2. **FTP Bağlantı Bilgileri**
   - **Host:** `.env` dosyanızdaki `FTP_HOST`
   - **Port:** `.env` dosyanızdaki `FTP_PORT` (varsayılan: 21)
   - **Kullanıcı Adı:** `.env` dosyanızdaki `FTP_USER`
   - **Şifre:** `.env` dosyanızdaki `FTP_PASSWORD`

3. **Bağlanın ve Yedekleri Bulun**
   - FTP'ye bağlandıktan sonra
   - `/backups` klasörüne gidin (veya `FTP_REMOTE_PATH` içinde belirttiğiniz klasör)
   - Tüm yedek dosyaları burada olacak
   - Dosya adı formatı: `venture-global-backup-YYYY-MM-DD-HH-MM-SS.zip`

### 3. Komut Satırından (SSH/FTP)

**Terminal üzerinden:**

```bash
# FTP bağlantısı (interaktif)
ftp ftp.example.com

# Veya sftp (secure)
sftp ftp.example.com

# Dosyaları listeleyin
ls /backups

# Yedek indirin
get /backups/venture-global-backup-2024-01-15-02-00-00.zip
```

## 📂 Yedek Dosya Yapısı

Her yedek bir ZIP dosyasıdır ve şu içeriği barındırır:

```
venture-global-backup-YYYY-MM-DD-HH-MM-SS.zip
├── database_backup.sql        # PostgreSQL veritabanı yedeği
├── backup_metadata.json       # Yedek bilgileri (tarih, versiyon, vs.)
└── files/                     # Tüm dosyalar
    ├── public/
    │   ├── uploads/          # Yüklenen dosyalar
    │   └── images/           # Görseller
    ├── config/               # Konfigürasyon dosyaları
    ├── routes/               # Route dosyaları
    ├── views/                # EJS template'ler
    ├── middleware/           # Middleware dosyaları
    ├── services/             # Servis dosyaları
    ├── locales/              # Dil dosyaları
    ├── database/             # Database script'leri
    ├── package.json          # Bağımlılıklar
    └── server.js             # Ana server dosyası
```

## 🔓 Yedek İçeriğini Açma

### 1. ZIP Dosyasını Açma

**Windows:**
- ZIP dosyasına sağ tıklayın → "Extract All" (Tümünü Çıkar)

**Mac:**
- ZIP dosyasına çift tıklayın (otomatik açılır)

**Linux/Terminal:**
```bash
unzip venture-global-backup-2024-01-15-02-00-00.zip
```

### 2. Veritabanı Yedeğini İnceleme

```bash
# SQL dosyasını görüntüle
cat database_backup.sql

# Veya düzenleyici ile aç
nano database_backup.sql
# veya
code database_backup.sql
```

### 3. Dosyaları İnceleme

```bash
# Dosya yapısını görüntüle
ls -la files/

# Belirli bir klasöre bak
ls -la files/public/uploads/
```

## 🔄 Yedek Geri Yükleme

### Veritabanını Geri Yükleme

**⚠️ DİKKAT: Mevcut veritabanı silinecek ve yerine yedek konulacak!**

```bash
# 1. ZIP'i açın
unzip venture-global-backup-YYYY-MM-DD-HH-MM-SS.zip

# 2. Veritabanını geri yükleyin
psql $DATABASE_URL < database_backup.sql

# Veya Node.js ile:
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync('database_backup.sql', 'utf8');
pool.query(sql).then(() => {
  console.log('✅ Database restored successfully');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
"
```

### Dosyaları Geri Yükleme

```bash
# 1. ZIP'i açın
unzip venture-global-backup-YYYY-MM-DD-HH-MM-SS.zip

# 2. Dosyaları proje klasörüne kopyalayın
cp -r files/public/uploads/* /path/to/project/public/uploads/
cp -r files/public/images/* /path/to/project/public/images/
cp -r files/config/* /path/to/project/config/
# ... diğer klasörler için tekrarlayın
```

## 📊 Yedek Yönetimi

### Yedek Saklama Süresi

- **Otomatik:** 30 gün (varsayılan)
- **Değiştirmek için:** `.env` dosyasında `BACKUP_KEEP_DAYS=30` değerini değiştirin

### Yedeklerin Otomatik Silinmesi

- 30 günden eski yedekler otomatik olarak silinir
- Bu sadece FTP sunucusundaki yedekler için geçerlidir
- Yerel yedekler (eğer varsa) ayrıca temizlenir

### Yedekleri Yedekleme

**Önemli yedekleri başka bir yere de kaydetmeniz önerilir:**

1. **Yedeklerinizi indirin**
2. **Başka bir konuma kopyalayın:**
   - Bulut depolama (Google Drive, Dropbox, OneDrive)
   - Harici disk
   - Başka bir sunucu

## 🔐 Güvenlik

### Yedeklerin Güvenliği

- ✅ Yedekler sıkıştırılmış formatda (ZIP)
- ✅ FTP şifreleri environment variables'da saklanır
- ✅ Admin-only erişim (web arayüzü)
- ✅ Güvenli FTP bağlantısı (FTPS) desteklenir

### Öneriler

1. **Düzenli Kontrol:** Yedeklerinizin düzenli olarak oluşturulduğunu kontrol edin
2. **Test:** Ara sıra yedeklerinizi geri yükleyerek test edin
3. **Yedekleme:** Önemli yedekleri birden fazla yerde saklayın
4. **Şifreleme:** Çok hassas veriler için yedekleri şifreleyin

## ❓ Sık Sorulan Sorular

### Yedekler nerede saklanıyor?

FTP sunucunuzda `/backups` klasöründe (veya `FTP_REMOTE_PATH` içinde belirttiğiniz klasörde).

### Yedekler ne sıklıkla oluşturuluyor?

Otomatik olarak her gün saat 02:00'de (Türkiye saati).

### Yedek boyutu ne kadar?

Yedek boyutu veritabanı ve dosya boyutuna bağlıdır. Genellikle 5-50 MB arası değişir.

### Yedek indirme işlemi ne kadar sürer?

Yedek boyutuna ve internet hızınıza bağlıdır. Ortalama 10-50 MB'lık bir yedek 1-5 dakika içinde indirilir.

### FTP bağlantısı başarısız oluyor, ne yapmalıyım?

1. FTP bilgilerini kontrol edin (`.env` dosyası)
2. FTP sunucusunun erişilebilir olduğunu kontrol edin
3. Firewall ayarlarını kontrol edin
4. Port numarasını kontrol edin (21, 22, vs.)

## 📞 Destek

Sorun yaşarsanız:

1. **Logları kontrol edin:** Server console loglarını inceleyin
2. **FTP bağlantısını test edin:** FTP istemcisi ile manuel bağlanmayı deneyin
3. **Environment variables'ı kontrol edin:** `.env` dosyasındaki FTP bilgilerini doğrulayın

## 🎯 Hızlı Başlangıç

1. Admin paneline giriş yapın
2. `/admin/backups` sayfasına gidin
3. Yedekleri görüntüleyin ve indirin
4. İhtiyacınız olursa "Yeni Yedek Al" butonuna tıklayın

**Hepsi bu kadar!** 🎉
