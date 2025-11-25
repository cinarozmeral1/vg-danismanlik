/**
 * Yedekten Geri Yükleme Script'i
 * 
 * Bu script yedek dosyasından veritabanını geri yükler.
 * ⚠️ DİKKAT: Bu işlem mevcut verileri silecektir!
 * 
 * Kullanım:
 * node scripts/restore-from-backup.js path/to/backup.json
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

/**
 * Kullanıcıdan onay al
 */
function askConfirmation(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'evet' || answer.toLowerCase() === 'yes');
        });
    });
}

/**
 * Yedekten geri yükleme yap
 */
async function restoreFromBackup(backupFilePath, skipConfirmation = false) {
    try {
        console.log('🔄 Geri yükleme işlemi başlıyor...\n');
        
        // Dosya kontrolü
        if (!fs.existsSync(backupFilePath)) {
            throw new Error(`Yedek dosyası bulunamadı: ${backupFilePath}`);
        }

        // Yedek dosyasını oku
        console.log('📂 Yedek dosyası okunuyor...');
        const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
        
        console.log('\n📊 YEDEK DOSYASI BİLGİLERİ:');
        console.log(`  📅 Yedek tarihi: ${backupData.timestamp}`);
        console.log(`  🕒 Zaman dilimi: ${backupData.timezone || 'N/A'}`);
        console.log(`  📋 Toplam tablo: ${backupData.metadata?.totalTables || Object.keys(backupData.tables).length}`);
        console.log(`  📝 Toplam kayıt: ${backupData.metadata?.totalRecords || 0}`);
        console.log(`  📌 Versiyon: ${backupData.version || '1.0'}\n`);

        // Kullanıcıdan onay al
        if (!skipConfirmation) {
            console.log('⚠️  UYARI: Bu işlem mevcut verileri silecektir!');
            console.log('⚠️  Bu işlem geri alınamaz!\n');
            
            const confirmed = await askConfirmation('Devam etmek istediğinize emin misiniz? (EVET/hayır): ');
            
            if (!confirmed) {
                console.log('❌ İşlem iptal edildi.');
                return;
            }
            
            console.log('');
        }

        // Veritabanı bağlantısını test et
        await pool.query('SELECT NOW()');
        console.log('✅ Veritabanı bağlantısı başarılı\n');

        let totalRestored = 0;
        let totalFailed = 0;

        // Her tablo için geri yükleme yap
        const tables = Object.keys(backupData.tables);
        
        for (let i = 0; i < tables.length; i++) {
            const tableName = tables[i];
            const rows = backupData.tables[tableName];
            
            console.log(`[${i + 1}/${tables.length}] 🔄 ${tableName} geri yükleniyor...`);
            
            if (rows.error) {
                console.log(`  ⚠️ Atlandı (yedekte hata var: ${rows.error})\n`);
                totalFailed++;
                continue;
            }
            
            if (!Array.isArray(rows) || rows.length === 0) {
                console.log(`  ⚠️ Atlandı (veri yok)\n`);
                continue;
            }

            try {
                // Tabloyu temizle
                await pool.query(`TRUNCATE TABLE ${tableName} CASCADE`);
                console.log(`  🗑️ Tablo temizlendi`);
                
                // Kayıtları ekle
                let insertedCount = 0;
                for (const row of rows) {
                    try {
                        const columns = Object.keys(row);
                        const values = Object.values(row);
                        const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
                        
                        await pool.query(
                            `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
                            values
                        );
                        insertedCount++;
                    } catch (rowError) {
                        console.log(`    ⚠️ Satır eklenemedi: ${rowError.message}`);
                    }
                }
                
                console.log(`  ✅ ${insertedCount}/${rows.length} kayıt geri yüklendi\n`);
                totalRestored += insertedCount;
                
            } catch (tableError) {
                console.log(`  ❌ Hata: ${tableError.message}\n`);
                totalFailed++;
            }
        }

        // Sequence'leri güncelle (PostgreSQL için)
        console.log('🔄 Sequence\'ler güncelleniyor...');
        try {
            for (const tableName of tables) {
                const rows = backupData.tables[tableName];
                if (!Array.isArray(rows) || rows.length === 0) continue;
                
                // Primary key'i bul (genellikle 'id')
                if (rows[0].id !== undefined) {
                    await pool.query(`
                        SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), 
                        (SELECT MAX(id) FROM ${tableName}), true)
                    `);
                }
            }
            console.log('✅ Sequence\'ler güncellendi\n');
        } catch (seqError) {
            console.log('⚠️ Sequence güncellemesi başarısız:', seqError.message, '\n');
        }

        // Özet
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 GERİ YÜKLEME ÖZETİ');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Başarılı: ${tables.length - totalFailed} tablo`);
        console.log(`❌ Başarısız: ${totalFailed} tablo`);
        console.log(`📝 Toplam kayıt: ${totalRestored}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        console.log('✅ Geri yükleme işlemi tamamlandı!');
        
    } catch (error) {
        console.error('\n❌ GERİ YÜKLEME HATASI:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// Komut satırından çalıştırma
if (require.main === module) {
    const backupFile = process.argv[2];
    const skipConfirmation = process.argv.includes('--force');
    
    if (!backupFile) {
        console.error('❌ Kullanım: node restore-from-backup.js <backup-file.json> [--force]');
        console.error('\nÖrnek:');
        console.error('  node restore-from-backup.js backups/venture-global-backup-2024-11-25_03-00-00.json');
        console.error('  node restore-from-backup.js backup.json --force (onay istemeden)');
        process.exit(1);
    }

    restoreFromBackup(backupFile, skipConfirmation)
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Hata:', error);
            process.exit(1);
        });
}

module.exports = { restoreFromBackup };

