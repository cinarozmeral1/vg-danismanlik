#!/usr/bin/env node

/**
 * Venture Global - Otomatik Günlük Yedekleme Sistemi
 * 
 * Bu script:
 * 1. PostgreSQL veritabanını yedekler
 * 2. Tüm dosyaları yedekler (uploads, config, vs.)
 * 3. Her şeyi bir zip dosyasına sıkıştırır
 * 4. FTP sunucusuna yükler
 * 5. Eski yedekleri temizler (30 günden eski)
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { Client } = require('basic-ftp');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
    // Backup directories
    BACKUP_DIR: path.join(__dirname, '..', 'backups'),
    TEMP_DIR: path.join(__dirname, '..', 'backups', 'temp'),
    
    // Files/Directories to backup
    FILES_TO_BACKUP: [
        'public/uploads',
        'public/images',
        'config',
        'routes',
        'views',
        'middleware',
        'services',
        'locales',
        'database',
        'package.json',
        'package-lock.json',
        'server.js',
        'vercel.json'
    ],
    
    // FTP Configuration (from environment variables)
    FTP: {
        host: process.env.FTP_HOST || '',
        user: process.env.FTP_USER || '',
        password: process.env.FTP_PASSWORD || '',
        secure: process.env.FTP_SECURE === 'true', // FTPS support
        port: parseInt(process.env.FTP_PORT || '21'),
        remotePath: process.env.FTP_REMOTE_PATH || '/backups'
    },
    
    // Database backup options
    DATABASE: {
        connectionString: process.env.DATABASE_URL || '',
        usePgDump: process.env.USE_PG_DUMP === 'true', // Try to use pg_dump if available
        backupFormat: 'sql' // 'sql' or 'custom'
    },
    
    // Cleanup options
    CLEANUP: {
        keepDays: parseInt(process.env.BACKUP_KEEP_DAYS || '30'), // Keep backups for 30 days
        localCleanup: process.env.BACKUP_LOCAL_CLEANUP !== 'false' // Clean local backups after upload
    }
};

// Ensure backup directories exist
function ensureDirectories() {
    if (!fs.existsSync(CONFIG.BACKUP_DIR)) {
        fs.mkdirSync(CONFIG.BACKUP_DIR, { recursive: true });
    }
    if (!fs.existsSync(CONFIG.TEMP_DIR)) {
        fs.mkdirSync(CONFIG.TEMP_DIR, { recursive: true });
    }
}

// Get timestamp for backup filename
function getBackupFilename() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    return `venture-global-backup-${dateStr}-${timeStr}.zip`;
}

// Backup PostgreSQL database
async function backupDatabase() {
    console.log('🗄️  Veritabanı yedeği alınıyor...');
    
    const backupFilePath = path.join(CONFIG.TEMP_DIR, 'database_backup.sql');
    
    try {
        // Try pg_dump first if available and enabled
        if (CONFIG.DATABASE.usePgDump) {
            try {
                const connectionString = CONFIG.DATABASE.connectionString;
                // Parse connection string
                const dbUrl = new URL(connectionString.replace('postgresql://', 'http://'));
                
                let pgDumpCmd = `pg_dump`;
                if (dbUrl.hostname) pgDumpCmd += ` -h ${dbUrl.hostname}`;
                if (dbUrl.port) pgDumpCmd += ` -p ${dbUrl.port}`;
                if (dbUrl.username) pgDumpCmd += ` -U ${dbUrl.username}`;
                if (dbUrl.pathname) pgDumpCmd += ` -d ${dbUrl.pathname.replace('/', '')}`;
                pgDumpCmd += ` -f ${backupFilePath}`;
                
                // Set password via environment
                if (dbUrl.password) {
                    process.env.PGPASSWORD = dbUrl.password;
                }
                
                await execAsync(pgDumpCmd);
                console.log('✅ pg_dump ile veritabanı yedeği alındı');
                return backupFilePath;
            } catch (error) {
                console.log('⚠️  pg_dump kullanılamadı, SQL query ile yedek alınıyor...');
            }
        }
        
        // Fallback: Use SQL queries to backup all tables
        const pool = new Pool({
            connectionString: CONFIG.DATABASE.connectionString,
            ssl: { rejectUnauthorized: false }
        });
        
        const client = await pool.connect();
        
        try {
            let sqlBackup = `-- Venture Global Database Backup\n`;
            sqlBackup += `-- Generated: ${new Date().toISOString()}\n\n`;
            sqlBackup += `BEGIN;\n\n`;
            
            // Get all tables
            const tablesResult = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            `);
            
            const tables = tablesResult.rows.map(row => row.table_name);
            
            for (const table of tables) {
                console.log(`  📋 ${table} tablosu yedekleniyor...`);
                
                // Get table structure (CREATE TABLE)
                const createTableResult = await client.query(`
                    SELECT 
                        'CREATE TABLE IF NOT EXISTS ' || quote_ident(table_name) || ' (' || 
                        string_agg(
                            quote_ident(column_name) || ' ' || data_type ||
                            CASE 
                                WHEN character_maximum_length IS NOT NULL 
                                THEN '(' || character_maximum_length || ')'
                                ELSE ''
                            END ||
                            CASE 
                                WHEN is_nullable = 'NO' THEN ' NOT NULL'
                                ELSE ''
                            END,
                            ', '
                        ) || ');'
                    FROM information_schema.columns
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                    GROUP BY table_name
                `, [table]);
                
                if (createTableResult.rows.length > 0) {
                    sqlBackup += `\n-- Table: ${table}\n`;
                    sqlBackup += `DROP TABLE IF EXISTS ${table} CASCADE;\n`;
                    // Note: Simple CREATE TABLE won't include all constraints, but will work for data backup
                    
                    // Get all data
                    const dataResult = await client.query(`SELECT * FROM ${table}`);
                    
                    if (dataResult.rows.length > 0) {
                        // Generate INSERT statements
                        const columns = Object.keys(dataResult.rows[0]);
                        const columnNames = columns.map(col => `"${col}"`).join(', ');
                        
                        sqlBackup += `\n-- Data for table: ${table}\n`;
                        sqlBackup += `INSERT INTO ${table} (${columnNames}) VALUES\n`;
                        
                        const values = dataResult.rows.map((row, index) => {
                            const rowValues = columns.map(col => {
                                const value = row[col];
                                if (value === null) return 'NULL';
                                if (typeof value === 'string') {
                                    return `'${value.replace(/'/g, "''")}'`;
                                }
                                if (value instanceof Date) {
                                    return `'${value.toISOString()}'`;
                                }
                                return value;
                            }).join(', ');
                            return `(${rowValues})${index < dataResult.rows.length - 1 ? ',' : ''}`;
                        }).join('\n');
                        
                        sqlBackup += values + ';\n';
                    }
                }
            }
            
            sqlBackup += `\nCOMMIT;\n`;
            
            fs.writeFileSync(backupFilePath, sqlBackup, 'utf8');
            console.log('✅ SQL query ile veritabanı yedeği alındı');
            
        } finally {
            client.release();
            await pool.end();
        }
        
        return backupFilePath;
        
    } catch (error) {
        console.error('❌ Veritabanı yedeği hatası:', error.message);
        throw error;
    }
}

// Backup files and directories
async function backupFiles() {
    console.log('📁 Dosyalar yedekleniyor...');
    
    const backupBaseDir = path.join(CONFIG.TEMP_DIR, 'files');
    if (!fs.existsSync(backupBaseDir)) {
        fs.mkdirSync(backupBaseDir, { recursive: true });
    }
    
    const projectRoot = path.join(__dirname, '..');
    
    for (const item of CONFIG.FILES_TO_BACKUP) {
        const sourcePath = path.join(projectRoot, item);
        const destPath = path.join(backupBaseDir, item);
        
        if (!fs.existsSync(sourcePath)) {
            console.log(`  ⚠️  ${item} bulunamadı, atlanıyor...`);
            continue;
        }
        
        console.log(`  📂 ${item} kopyalanıyor...`);
        
        const stat = fs.statSync(sourcePath);
        
        if (stat.isDirectory()) {
            // Copy directory recursively
            copyDirectoryRecursive(sourcePath, destPath);
        } else {
            // Copy file
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            fs.copyFileSync(sourcePath, destPath);
        }
    }
    
    console.log('✅ Dosyalar yedeklendi');
    return backupBaseDir;
}

// Helper: Copy directory recursively
function copyDirectoryRecursive(source, destination) {
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }
    
    const entries = fs.readdirSync(source, { withFileTypes: true });
    
    for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);
        
        if (entry.isDirectory()) {
            copyDirectoryRecursive(sourcePath, destPath);
        } else {
            fs.copyFileSync(sourcePath, destPath);
        }
    }
}

// Create zip archive
async function createZipArchive(databaseBackup, filesBackup) {
    console.log('📦 Zip arşivi oluşturuluyor...');
    
    const zipFilename = getBackupFilename();
    const zipPath = path.join(CONFIG.BACKUP_DIR, zipFilename);
    
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });
        
        output.on('close', () => {
            const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
            console.log(`✅ Zip arşivi oluşturuldu: ${zipFilename} (${sizeMB} MB)`);
            resolve(zipPath);
        });
        
        archive.on('error', (err) => {
            reject(err);
        });
        
        archive.pipe(output);
        
        // Add database backup
        if (fs.existsSync(databaseBackup)) {
            archive.file(databaseBackup, { name: 'database_backup.sql' });
        }
        
        // Add files
        if (fs.existsSync(filesBackup)) {
            archive.directory(filesBackup, 'files');
        }
        
        // Add metadata
        const metadata = {
            backup_date: new Date().toISOString(),
            version: '1.0.0',
            database_type: 'PostgreSQL',
            backup_type: 'full'
        };
        archive.append(JSON.stringify(metadata, null, 2), { name: 'backup_metadata.json' });
        
        archive.finalize();
    });
}

// Upload to FTP server
async function uploadToFTP(zipPath) {
    console.log('☁️  FTP sunucusuna yükleniyor...');
    
    if (!CONFIG.FTP.host || !CONFIG.FTP.user || !CONFIG.FTP.password) {
        console.log('⚠️  FTP bilgileri eksik, FTP yükleme atlanıyor...');
        return;
    }
    
    const client = new Client();
    const zipFilename = path.basename(zipPath);
    
    try {
        await client.access({
            host: CONFIG.FTP.host,
            user: CONFIG.FTP.user,
            password: CONFIG.FTP.password,
            secure: CONFIG.FTP.secure,
            port: CONFIG.FTP.port
        });
        
        console.log('  ✅ FTP bağlantısı kuruldu');
        
        // Ensure remote directory exists
        try {
            await client.ensureDir(CONFIG.FTP.remotePath);
        } catch (error) {
            console.log('  ⚠️  Remote dizin oluşturulamadı, devam ediliyor...');
        }
        
        // Upload file
        await client.uploadFrom(zipPath, path.join(CONFIG.FTP.remotePath, zipFilename));
        console.log(`  ✅ ${zipFilename} FTP'ye yüklendi`);
        
        // List remote files for cleanup
        const remoteFiles = await client.list(CONFIG.FTP.remotePath);
        const backupFiles = remoteFiles.filter(file => file.name.startsWith('venture-global-backup-'));
        
        // Cleanup old backups (keep only last 30 days)
        const now = new Date();
        const keepDate = new Date(now);
        keepDate.setDate(keepDate.getDate() - CONFIG.CLEANUP.keepDays);
        
        for (const file of backupFiles) {
            if (file.modifiedAt && file.modifiedAt < keepDate) {
                try {
                    await client.remove(path.join(CONFIG.FTP.remotePath, file.name));
                    console.log(`  🗑️  Eski yedek silindi: ${file.name}`);
                } catch (error) {
                    console.log(`  ⚠️  Yedek silinemedi: ${file.name}`);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ FTP yükleme hatası:', error.message);
        throw error;
    } finally {
        client.close();
    }
}

// Cleanup local temporary files
function cleanupTempFiles() {
    console.log('🧹 Geçici dosyalar temizleniyor...');
    
    if (fs.existsSync(CONFIG.TEMP_DIR)) {
        fs.rmSync(CONFIG.TEMP_DIR, { recursive: true, force: true });
        console.log('✅ Geçici dosyalar temizlendi');
    }
    
    // Cleanup local backups if enabled
    if (CONFIG.CLEANUP.localCleanup) {
        const files = fs.readdirSync(CONFIG.BACKUP_DIR);
        const now = new Date();
        const keepDate = new Date(now);
        keepDate.setDate(keepDate.getDate() - CONFIG.CLEANUP.keepDays);
        
        for (const file of files) {
            if (file.startsWith('venture-global-backup-') && file.endsWith('.zip')) {
                const filePath = path.join(CONFIG.BACKUP_DIR, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime < keepDate) {
                    fs.unlinkSync(filePath);
                    console.log(`  🗑️  Eski yerel yedek silindi: ${file}`);
                }
            }
        }
    }
}

// Main backup function
async function runBackup() {
    const startTime = new Date();
    console.log('🚀 Otomatik yedekleme başlatılıyor...');
    console.log(`📅 Tarih: ${startTime.toLocaleString('tr-TR')}\n`);
    
    try {
        // Ensure directories exist
        ensureDirectories();
        
        // Step 1: Backup database
        const databaseBackup = await backupDatabase();
        
        // Step 2: Backup files
        const filesBackup = await backupFiles();
        
        // Step 3: Create zip archive
        const zipPath = await createZipArchive(databaseBackup, filesBackup);
        
        // Step 4: Upload to FTP
        await uploadToFTP(zipPath);
        
        // Step 5: Cleanup
        cleanupTempFiles();
        
        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log('\n✅ Yedekleme tamamlandı!');
        console.log(`⏱️  Süre: ${duration} saniye`);
        console.log(`📦 Yedek dosyası: ${path.basename(zipPath)}`);
        
    } catch (error) {
        console.error('\n❌ Yedekleme hatası:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runBackup().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runBackup, CONFIG };
