const { Client } = require('basic-ftp');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

/**
 * FTP Yedekleme Sistemi
 * 
 * Bu script veritabanındaki tüm verileri JSON formatında yedekler.
 * - Sadece READ işlemi yapar, veritabanına hiçbir değişiklik yapmaz
 * - Günlük otomatik yedekleme yapar
 * - Eski yedekleri otomatik temizler (30 gün)
 * - FTP/SFTP sunucusuna güvenli şekilde yükler
 */

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

/**
 * Tüm veritabanı tablolarını listeler
 * Frontend/kozmetik değişikliklerden bağımsız çalışır
 */
async function getAllTables() {
    try {
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);
        return result.rows.map(row => row.table_name);
    } catch (error) {
        console.error('❌ Tablo listesi alınamadı:', error.message);
        // Fallback: Bilinen tablolar
        return ['users', 'applications', 'documents', 'admins', 'services', 
                'installments', 'notes', 'checklist_items', 'user_documents', 'student_stories'];
    }
}

/**
 * FTP'ye yedekleme yapar
 */
async function backupToFTP() {
    const client = new Client();
    client.ftp.verbose = false; // Debug için true yapabilirsiniz
    
    let tempPath = null;
    
    try {
        console.log('🔄 FTP yedekleme başlıyor...');
        console.log('📅 Zaman:', DateTime.now().setZone('Europe/Istanbul').toISO());
        
        const timestamp = DateTime.now().setZone('Europe/Istanbul').toFormat('yyyy-MM-dd_HH-mm-ss');
        
        // Otomatik olarak tüm tabloları al
        const tables = await getAllTables();
        console.log(`📊 Yedeklenecek tablo sayısı: ${tables.length}`);
        
        const backupData = {
            timestamp,
            timezone: 'Europe/Istanbul',
            version: '1.0',
            database: 'venture-global-db',
            tables: {},
            metadata: {
                totalTables: tables.length,
                totalRecords: 0
            }
        };

        // Her tabloyu yedekle (SADECE READ)
        for (const table of tables) {
            try {
                const result = await pool.query(`SELECT * FROM ${table}`);
                backupData.tables[table] = result.rows;
                backupData.metadata.totalRecords += result.rows.length;
                console.log(`  ✅ ${table}: ${result.rows.length} kayıt yedeklendi`);
            } catch (error) {
                console.log(`  ⚠️ ${table}: Yedeklenemedi (${error.message})`);
                backupData.tables[table] = { error: error.message };
            }
        }

        // Geçici dosya oluştur
        const backupFilename = `venture-global-backup-${timestamp}.json`;
        tempPath = path.join('/tmp', backupFilename);
        fs.writeFileSync(tempPath, JSON.stringify(backupData, null, 2));
        
        const fileSize = (fs.statSync(tempPath).size / 1024 / 1024).toFixed(2);
        console.log(`💾 Yedek dosyası oluşturuldu: ${fileSize} MB`);

        // FTP'ye bağlan
        console.log('🔌 FTP sunucusuna bağlanılıyor...');
        await client.access({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            port: parseInt(process.env.FTP_PORT || '21'),
            secure: process.env.FTP_SECURE === 'true', // FTPS için
            secureOptions: { rejectUnauthorized: false }
        });
        
        // Passive mode kullan (InfinityFree için gerekli)
        client.ftp.verbose = true;
        
        console.log('✅ FTP bağlantısı başarılı');

        // Backup klasörünü oluştur (yoksa)
        const backupDir = process.env.FTP_BACKUP_DIR || '/venture-global-backups';
        await client.ensureDir(backupDir);
        
        // Dosyayı yükle
        console.log('📤 Dosya FTP\'ye yükleniyor...');
        await client.uploadFrom(tempPath, `${backupDir}/${backupFilename}`);
        console.log(`✅ Yedek FTP'ye yüklendi: ${backupFilename}`);

        // Eski yedekleri temizle (30 günden eski)
        if (process.env.FTP_AUTO_CLEANUP === 'true') {
            console.log('🗑️ Eski yedekler kontrol ediliyor...');
            try {
                const files = await client.list(backupDir);
                const thirtyDaysAgo = DateTime.now().minus({ days: 30 });
                let deletedCount = 0;
                
                for (const file of files) {
                    if (file.name.startsWith('venture-global-backup-') && file.name.endsWith('.json')) {
                        try {
                            // Dosya adından tarihi çıkar
                            const dateStr = file.name
                                .replace('venture-global-backup-', '')
                                .replace('.json', '');
                            const fileDate = DateTime.fromFormat(dateStr, 'yyyy-MM-dd_HH-mm-ss');
                            
                            if (fileDate < thirtyDaysAgo) {
                                await client.remove(`${backupDir}/${file.name}`);
                                deletedCount++;
                                console.log(`  🗑️ Silindi: ${file.name}`);
                            }
                        } catch (parseError) {
                            // Tarih parse edilemezse atla
                            continue;
                        }
                    }
                }
                
                if (deletedCount > 0) {
                    console.log(`✅ ${deletedCount} eski yedek temizlendi`);
                } else {
                    console.log('✅ Temizlenecek eski yedek yok');
                }
            } catch (cleanupError) {
                console.log('⚠️ Eski yedekler temizlenemedi:', cleanupError.message);
            }
        }

        // Özet bilgi
        const summary = {
            success: true,
            timestamp,
            filename: backupFilename,
            stats: {
                totalTables: backupData.metadata.totalTables,
                totalRecords: backupData.metadata.totalRecords,
                fileSize: `${fileSize} MB`
            }
        };

        console.log('\n📊 YEDEKLEME ÖZETİ:');
        console.log('  ✅ Durum: Başarılı');
        console.log(`  📅 Tarih: ${timestamp}`);
        console.log(`  📋 Tablo sayısı: ${summary.stats.totalTables}`);
        console.log(`  📝 Toplam kayıt: ${summary.stats.totalRecords}`);
        console.log(`  💾 Dosya boyutu: ${summary.stats.fileSize}`);
        console.log(`  📁 Dosya adı: ${backupFilename}\n`);

        return summary;

    } catch (error) {
        console.error('\n❌ YEDEKLEME HATASI:', error.message);
        throw error;
    } finally {
        // Temizlik
        client.close();
        
        if (tempPath && fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
            console.log('🧹 Geçici dosya temizlendi');
        }
        
        await pool.end();
    }
}

// Manuel çalıştırma için
if (require.main === module) {
    backupToFTP()
        .then(() => {
            console.log('✅ Yedekleme işlemi tamamlandı!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Yedekleme başarısız:', error);
            process.exit(1);
        });
}

module.exports = { backupToFTP };

