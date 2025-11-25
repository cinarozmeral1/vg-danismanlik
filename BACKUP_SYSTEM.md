# 🔐 Venture Global - Otomatik Yedekleme Sistemi

## 📋 Genel Bakış

Bu yedekleme sistemi, Venture Global veritabanınızı **günlük otomatik** olarak FTP sunucusuna yedekler.

### ✨ Özellikler

- ✅ **Günlük Otomatik Yedekleme** - Her gün saat 03:00'te (UTC)
- ✅ **FTP/SFTP Desteği** - Güvenli dosya transferi
- ✅ **Otomatik Temizlik** - 30 günden eski yedekleri siler
- ✅ **Email Bildirimleri** - Başarı/hata durumunda email gönderir
- ✅ **Dinamik Tablo Algılama** - Yeni tablolar otomatik yedeklenir
- ✅ **Sadece Okuma** - Veritabanına hiçbir değişiklik yapmaz
- ✅ **Frontend'den Bağımsız** - Kozmetik değişikliklerden etkilenmez

---

## 🚀 Kurulum

### 1. Gerekli Paketler

Tüm gerekli paketler zaten `package.json`'da mevcut:
```bash
npm install
```

### 2. Environment Variables Ayarlama

Vercel Dashboard → Settings → Environment Variables bölümünden aşağıdaki değişkenleri ekleyin:

#### FTP Sunucu Ayarları
```env
FTP_HOST=ftp.your-server.com
FTP_PORT=21
FTP_USER=your-username
FTP_PASSWORD=your-password
FTP_SECURE=false
FTP_BACKUP_DIR=/venture-global-backups
FTP_AUTO_CLEANUP=true
```

**Not:** FTPS (güvenli FTP) kullanıyorsanız `FTP_SECURE=true` yapın ve `FTP_PORT=990` ayarlayın.

#### Güvenlik
```env
CRON_SECRET=güçlü-random-key-buraya-yazın
```

**Önemli:** `CRON_SECRET`'ı güçlü bir key ile değiştirin. Örnek:
```bash
# Terminal'de random key oluşturmak için:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Email Bildirimleri (Opsiyonel)
```env
EMAIL_NOTIFICATIONS=true
ADMIN_EMAIL=admin@ventureglobal.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_SECURE=false
```

### 3. Vercel'e Deploy

```bash
vercel --prod
```

Deploy sonrası cron job otomatik olarak aktif olur.

---

## 📅 Çalışma Zamanı

**Varsayılan:** Her gün saat **03:00 UTC** (Türkiye saati: 06:00)

### Zamanı Değiştirmek İsterseniz

`vercel.json` dosyasındaki cron schedule'ı düzenleyin:

```json
"crons": [
  {
    "path": "/api/cron/backup-database",
    "schedule": "0 3 * * *"
  }
]
```

**Cron Format:**
```
┌───────────── dakika (0 - 59)
│ ┌───────────── saat (0 - 23)
│ │ ┌───────────── ayın günü (1 - 31)
│ │ │ ┌───────────── ay (1 - 12)
│ │ │ │ ┌───────────── haftanın günü (0 - 6) (0 = Pazar)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

**Örnekler:**
- `0 3 * * *` - Her gün saat 03:00
- `0 */6 * * *` - Her 6 saatte bir
- `0 2 * * 0` - Her Pazar saat 02:00
- `0 1 1 * *` - Her ayın 1'inde saat 01:00

---

## 🧪 Test Etme

### 1. Manuel Yedekleme (Local)

```bash
# Environment variables'ları ayarladıktan sonra:
node scripts/backup-to-ftp.js
```

### 2. Cron Endpoint'i Test Etme

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/backup-database
```

### 3. Email Ayarlarını Test Etme

```bash
node -e "require('./services/backupNotificationService').testEmailConfiguration()"
```

---

## 📂 Yedek Dosya Formatı

### Dosya Adı
```
venture-global-backup-2024-11-25_03-00-00.json
```

### İçerik Yapısı
```json
{
  "timestamp": "2024-11-25_03-00-00",
  "timezone": "Europe/Istanbul",
  "version": "1.0",
  "database": "venture-global-db",
  "tables": {
    "users": [
      { "id": 1, "first_name": "Ahmet", ... }
    ],
    "applications": [...],
    "documents": [...],
    ...
  },
  "metadata": {
    "totalTables": 9,
    "totalRecords": 1543
  }
}
```

---

## 🔄 Yedekten Geri Yükleme

### 1. Yedek Dosyasını İndirin

FTP sunucunuzdan yedek dosyasını indirin.

### 2. Geri Yükleme Script'i Oluşturun

`scripts/restore-from-backup.js` dosyası:

```javascript
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function restoreFromBackup(backupFilePath) {
    try {
        console.log('🔄 Geri yükleme başlıyor...');
        
        // Yedek dosyasını oku
        const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
        
        console.log(`📅 Yedek tarihi: ${backupData.timestamp}`);
        console.log(`📊 Toplam tablo: ${backupData.metadata.totalTables}`);
        
        // Her tablo için
        for (const [tableName, rows] of Object.entries(backupData.tables)) {
            if (rows.error) {
                console.log(`⚠️ ${tableName}: Atlandi (hata var)`);
                continue;
            }
            
            console.log(`🔄 ${tableName} geri yükleniyor...`);
            
            // Tabloyu temizle (dikkatli!)
            await pool.query(`TRUNCATE TABLE ${tableName} CASCADE`);
            
            // Kayıtları ekle
            for (const row of rows) {
                const columns = Object.keys(row).join(', ');
                const values = Object.values(row);
                const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
                
                await pool.query(
                    `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`,
                    values
                );
            }
            
            console.log(`✅ ${tableName}: ${rows.length} kayıt geri yüklendi`);
        }
        
        console.log('✅ Geri yükleme tamamlandı!');
        
    } catch (error) {
        console.error('❌ Geri yükleme hatası:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Kullanım
const backupFile = process.argv[2];
if (!backupFile) {
    console.error('Kullanım: node restore-from-backup.js <backup-file.json>');
    process.exit(1);
}

restoreFromBackup(backupFile);
```

### 3. Geri Yükleme Yapın

```bash
node scripts/restore-from-backup.js path/to/backup.json
```

**⚠️ UYARI:** Bu işlem mevcut verileri silecektir!

---

## 🗑️ Eski Yedekleri Temizleme

Otomatik temizlik aktif (`FTP_AUTO_CLEANUP=true`) ise, 30 günden eski yedekler otomatik silinir.

### Manuel Temizlik

FTP sunucunuza bağlanıp eski dosyaları manuel silebilirsiniz:

```bash
# FTP ile bağlan
ftp ftp.your-server.com

# Backup klasörüne git
cd /venture-global-backups

# Eski dosyaları sil
delete venture-global-backup-2024-10-01_03-00-00.json
```

---

## 📊 Yedekleme İstatistikleri

Her yedekleme sonrası konsola özet bilgi yazdırılır:

```
📊 YEDEKLEME ÖZETİ:
  ✅ Durum: Başarılı
  📅 Tarih: 2024-11-25_03-00-00
  📋 Tablo sayısı: 9
  📝 Toplam kayıt: 1543
  💾 Dosya boyutu: 2.34 MB
  📁 Dosya adı: venture-global-backup-2024-11-25_03-00-00.json
```

---

## 🔧 Sorun Giderme

### Problem: Cron job çalışmıyor

**Çözüm:**
1. Vercel Dashboard → Deployments → Logs kontrol edin
2. `vercel.json`'da cron ayarlarının doğru olduğundan emin olun
3. Deploy tekrar yapın: `vercel --prod`

### Problem: FTP bağlantı hatası

**Çözüm:**
1. FTP bilgilerini kontrol edin (host, user, password, port)
2. FTP sunucusunun aktif olduğundan emin olun
3. Güvenlik duvarı ayarlarını kontrol edin
4. Manuel test yapın: `node scripts/backup-to-ftp.js`

### Problem: Email gönderilmiyor

**Çözüm:**
1. Email ayarlarını kontrol edin
2. Gmail kullanıyorsanız "App Password" oluşturun
3. Email test edin:
   ```bash
   node -e "require('./services/backupNotificationService').testEmailConfiguration()"
   ```

### Problem: Belirli tablolar yedeklenmiyor

**Çözüm:**
Tablolar otomatik algılanır. Eğer bir tablo yedeklenmiyorsa:
1. Tablonun `public` schema'da olduğundan emin olun
2. Veritabanı kullanıcısının tabloya READ yetkisi olduğundan emin olun

---

## 🔐 Güvenlik Notları

1. **Environment Variables'ı sakın commit etmeyin**
   - `.env` dosyası `.gitignore`'da olmalı
   - Sadece Vercel Dashboard'dan ekleyin

2. **CRON_SECRET güçlü olmalı**
   - Minimum 32 karakter
   - Random generated key kullanın

3. **FTP Şifresi Güvenliği**
   - Güçlü şifre kullanın
   - Mümkünse FTPS (güvenli FTP) kullanın

4. **Yedek Dosyalarına Erişim**
   - FTP sunucusunda güvenli bir klasör kullanın
   - Erişim izinlerini sınırlayın

---

## 📝 Changelog

### v1.0 (2024-11-25)
- ✅ İlk versiyon
- ✅ Günlük otomatik yedekleme
- ✅ FTP/SFTP desteği
- ✅ Email bildirimleri
- ✅ Otomatik eski yedek temizleme
- ✅ Dinamik tablo algılama

---

## 🤝 Destek

Sorularınız için:
- **Email:** admin@ventureglobal.com
- **Dokümantasyon:** Bu dosya
- **Logs:** Vercel Dashboard → Deployments → Logs

---

## 📄 Lisans

Bu sistem Venture Global projesi için özel olarak geliştirilmiştir.

---

**Son Güncelleme:** 25 Kasım 2024

