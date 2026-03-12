const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Cloudinary yapılandırması
cloudinary.config({
    cloud_name: 'dkhe6tjqo',
    api_key: '373479217921793',
    api_secret: 'GWf3lT2-xcUUPAAGRLMyT3ieyvY'
});

const carouselDir = path.join(__dirname, 'public', 'images', 'login-carousel');

async function uploadAllImages() {
    const results = {};
    
    // Tüm grup klasörlerini al
    const groups = fs.readdirSync(carouselDir)
        .filter(item => {
            const itemPath = path.join(carouselDir, item);
            return fs.statSync(itemPath).isDirectory() && item.startsWith('group-');
        })
        .sort();
    
    console.log(`📁 ${groups.length} grup bulundu\n`);
    
    for (const group of groups) {
        const groupPath = path.join(carouselDir, group);
        const files = fs.readdirSync(groupPath)
            .filter(file => /\.(jpg|jpeg|png)$/i.test(file))
            .sort();
        
        if (files.length === 0) {
            console.log(`⚠️  ${group}: Boş klasör, atlanıyor`);
            continue;
        }
        
        console.log(`📤 ${group}: ${files.length} görsel yükleniyor...`);
        results[group] = [];
        
        for (const file of files) {
            const filePath = path.join(groupPath, file);
            
            try {
                const result = await cloudinary.uploader.upload(filePath, {
                    folder: `login-carousel/${group}`,
                    public_id: path.parse(file).name,
                    overwrite: true,
                    quality: 'auto:best',
                    fetch_format: 'auto'
                });
                
                results[group].push({
                    filename: file,
                    url: result.secure_url,
                    public_id: result.public_id
                });
                
                console.log(`   ✅ ${file}`);
            } catch (error) {
                console.log(`   ❌ ${file}: ${error.message}`);
            }
        }
    }
    
    // Sonuçları JSON dosyasına kaydet
    const outputPath = path.join(__dirname, 'cloudinary-urls.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    
    console.log(`\n✅ Tamamlandı! URL'ler cloudinary-urls.json dosyasına kaydedildi.`);
    
    // Toplam istatistik
    let totalImages = 0;
    Object.values(results).forEach(group => totalImages += group.length);
    console.log(`📊 Toplam: ${Object.keys(results).length} grup, ${totalImages} görsel yüklendi`);
}

uploadAllImages().catch(console.error);



































