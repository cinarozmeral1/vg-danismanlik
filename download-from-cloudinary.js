const fs = require('fs');
const path = require('path');
const https = require('https');

const cloudinaryUrls = JSON.parse(fs.readFileSync('cloudinary-urls.json', 'utf8'));
const baseDir = path.join(__dirname, 'public', 'images', 'login-carousel');

async function downloadFile(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

async function downloadAll() {
    for (const [group, images] of Object.entries(cloudinaryUrls)) {
        const groupDir = path.join(baseDir, group);
        if (!fs.existsSync(groupDir)) {
            fs.mkdirSync(groupDir, { recursive: true });
        }
        
        console.log(`📥 ${group}: ${images.length} görsel indiriliyor...`);
        
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            // Sıra numarasıyla dosya adı oluştur (01_, 02_, ...)
            const orderPrefix = String(i + 1).padStart(2, '0');
            const newFilename = `${orderPrefix}_${img.filename}`;
            const filepath = path.join(groupDir, newFilename);
            
            try {
                await downloadFile(img.url, filepath);
                console.log(`   ✅ ${newFilename}`);
            } catch (err) {
                console.log(`   ❌ ${img.filename}: ${err.message}`);
            }
        }
    }
    
    console.log('\n✅ Tüm görseller indirildi!');
}

downloadAll();
































