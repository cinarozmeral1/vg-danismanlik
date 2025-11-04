# 🔄 Otomatik Günlük Yedekleme Sistemi

Venture Global web sitesi için otomatik günlük yedekleme sistemi. Bu sistem veritabanını ve tüm dosyaları yedekler, sıkıştırır ve FTP sunucusuna yükler.

## 📋 Özellikler

- ✅ **Otomatik Günlük Yedekleme**: Her gün saat 02:00'de otomatik yedekleme
- ✅ **PostgreSQL Veritabanı Yedeği**: Tüm tablolar ve veriler
- ✅ **Dosya Yedeği**: Uploads, images, config, routes, views ve diğer önemli dosyalar
- ✅ **ZIP Sıkıştırma**: Maksimum sıkıştırma ile disk alanı tasarrufu
- ✅ **FTP Yükleme**: Yedekler otomatik olarak FTP sunucusuna yüklenir
- ✅ **Otomatik Temizlik**: 30 günden eski yedekler otomatik silinir
- ✅ **Manuel Yedekleme**: Admin panelinden anlık yedekleme

## 🔧 Kurulum

### 1. Gerekli Paketler

Paketler zaten yüklü, eğer yoksa:

```bash
npm install basic-ftp archiver node-cron --save
```

### 2. Environment Variables

`.env` dosyanıza aşağıdaki değişkenleri ekleyin:

```env
# FTP Server Bilgileri
FTP_HOST=ftp.example.com
FTP_USER=your-ftp-username
FTP_PASSWORD=your-ftp-password
FTP_PORT=21
FTP_SECURE=false
FTP_REMOTE_PATH=/backups

# Yedekleme Seçenekleri
ENABLE_AUTO_BACKUP=true
USE_PG_DUMP=false
BACKUP_KEEP_DAYS=30
BACKUP_LOCAL_CLEANUP=true
```

### 3. FTP Sunucu Ayarları

FTP sunucunuzda:
- `/backups` klasörü oluşturun
- FTP kullanıcısına bu klasöre yazma izni verin

## 🚀 Kullanım

### Otomatik Yedekleme

Otomatik yedekleme varsayılan olarak etkindir ve her gün saat 02:00'de çalışır.

**Devre Dışı Bırakmak:**
```env
ENABLE_AUTO_BACKUP=false
```

**Saat Değiştirmek:**
`server.js` dosyasındaki cron schedule'ı düzenleyin:
```javascript
cron.schedule('0 2 * * *', ...) // Her gün 02:00
// Örnek: '0 3 * * *' = Her gün 03:00
```

### Manuel Yedekleme

#### Komut Satırından

```bash
node scripts/backup.js
```

veya npm script ile:

```bash
npm run backup
```

#### Admin Panel API Endpoint

```bash
POST /admin/api/backup/run
Authorization: Bearer <admin_token>
```

Admin panelinden buton ile de çalıştırabilirsiniz.

## 📁 Yedek Dosya Yapısı

Her yedek bir ZIP dosyası olarak oluşturulur:

```
venture-global-backup-YYYY-MM-DD-HH-MM-SS.zip
├── database_backup.sql        # PostgreSQL veritabanı yedeği
├── backup_metadata.json       # Yedek bilgileri
└── files/                     # Tüm dosyalar
    ├── public/
    │   ├── uploads/
    │   └── images/
    ├── config/
    ├── routes/
    ├── views/
    ├── middleware/
    └── ...
```

## 🔍 Yedek İçeriği

### Veritabanı Yedeği

- Tüm tablolar (structure + data)
- INSERT statements ile veri yedeği
- Transaction-safe (BEGIN/COMMIT)

### Dosya Yedeği

Aşağıdaki klasörler ve dosyalar yedeklenir:

- `public/uploads` - Yüklenen dosyalar
- `public/images` - Görseller
- `config` - Konfigürasyon dosyaları
- `routes` - Route dosyaları
- `views` - EJS template'ler
- `middleware` - Middleware dosyaları
- `services` - Servis dosyaları
- `locales` - Dil dosyaları
- `database` - Database script'leri
- `package.json` - Bağımlılıklar
- `server.js` - Ana server dosyası

## ⚙️ Konfigürasyon Seçenekleri

### `FTP_HOST`
FTP sunucu adresi (örn: `ftp.example.com`)

### `FTP_USER`
FTP kullanıcı adı

### `FTP_PASSWORD`
FTP şifresi

### `FTP_PORT`
FTP port numarası (varsayılan: 21)

### `FTP_SECURE`
FTPS kullanımı için `true` (varsayılan: `false`)

### `FTP_REMOTE_PATH`
FTP sunucusunda yedeklerin kaydedileceği klasör (varsayılan: `/backups`)

### `ENABLE_AUTO_BACKUP`
Otomatik yedeklemeyi aç/kapat (varsayılan: `true`)

### `USE_PG_DUMP`
`pg_dump` kullanımı için `true` (sistemde pg_dump yoksa `false` kalsın)

### `BACKUP_KEEP_DAYS`
Kaç gün yedek saklanacak (varsayılan: 30)

### `BACKUP_LOCAL_CLEANUP`
Yerel yedekleri temizle (varsayılan: `true`)

## 📊 Yedek Geri Yükleme

### Veritabanını Geri Yükleme

```bash
# ZIP'ten çıkar
unzip venture-global-backup-YYYY-MM-DD-HH-MM-SS.zip

# PostgreSQL'e import et
psql $DATABASE_URL < database_backup.sql
```

veya Node.js ile:

```bash
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync('database_backup.sql', 'utf8');
pool.query(sql).then(() => {
  console.log('Database restored');
  process.exit(0);
});
"
```

### Dosyaları Geri Yükleme

```bash
# ZIP'ten çıkar
unzip venture-global-backup-YYYY-MM-DD-HH-MM-SS.zip

# Dosyaları kopyala
cp -r files/* /path/to/project/
```

## 🔒 Güvenlik

- ✅ FTP şifreleri environment variables'da saklanır
- ✅ Yedekler sıkıştırılmış formatda saklanır
- ✅ Eski yedekler otomatik temizlenir
- ✅ Admin-only manuel yedekleme endpoint'i

## 🐛 Sorun Giderme

### FTP Bağlantı Hatası

```
❌ FTP yükleme hatası: connect ETIMEDOUT
```

**Çözüm:**
- FTP_HOST, FTP_USER, FTP_PASSWORD doğru mu kontrol edin
- FTP sunucusu erişilebilir mi kontrol edin
- Firewall ayarlarını kontrol edin

### Veritabanı Yedekleme Hatası

```
❌ Veritabanı yedeği hatası: connection refused
```

**Çözüm:**
- DATABASE_URL doğru mu kontrol edin
- Veritabanı erişilebilir mi kontrol edin
- SSL ayarlarını kontrol edin

### Disk Alanı Hatası

```
❌ Yedekleme hatası: ENOSPC: no space left on device
```

**Çözüm:**
- Disk alanını kontrol edin
- Eski yedekleri temizleyin
- BACKUP_LOCAL_CLEANUP=true ayarını kontrol edin

## 📝 Loglar

Yedekleme logları server console'unda görüntülenir:

```
🚀 Otomatik yedekleme başlatılıyor...
🗄️  Veritabanı yedeği alınıyor...
✅ SQL query ile veritabanı yedeği alındı
📁 Dosyalar yedekleniyor...
✅ Dosyalar yedeklendi
📦 Zip arşivi oluşturuluyor...
✅ Zip arşivi oluşturuldu: venture-global-backup-2024-01-15-02-00-00.zip (12.34 MB)
☁️  FTP sunucusuna yükleniyor...
  ✅ FTP bağlantısı kuruldu
  ✅ venture-global-backup-2024-01-15-02-00-00.zip FTP'ye yüklendi
🧹 Geçici dosyalar temizleniyor...
✅ Geçici dosyalar temizlendi
✅ Yedekleme tamamlandı!
⏱️  Süre: 45.23 saniye
```

## 🎯 Best Practices

1. **Düzenli Test**: Yedekleri düzenli olarak test edin
2. **Monitoring**: Yedekleme loglarını izleyin
3. **FTP Güvenliği**: FTPS kullanın (FTP_SECURE=true)
4. **Yedek Saklama**: Önemli yedekleri birden fazla yerde saklayın
5. **Disk Alanı**: FTP sunucusunda yeterli alan olduğundan emin olun

## 📞 Destek

Sorun yaşarsanız:
1. Logları kontrol edin
2. Environment variables'ları kontrol edin
3. FTP bağlantısını test edin
4. Veritabanı erişimini test edin
