const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
    cloud_name: 'dkhe6tjqo',
    api_key: '373479217921793',
    api_secret: 'GWf3lT2-xcUUPAAGRLMyT3ieyvY'
});

async function deleteAll() {
    console.log('🗑️  Cloudinary\'den tüm görseller siliniyor...\n');
    
    // cloudinary-urls.json'dan public_id'leri al
    const cloudinaryUrls = JSON.parse(fs.readFileSync('cloudinary-urls.json', 'utf8'));
    
    let totalDeleted = 0;
    
    for (const [group, images] of Object.entries(cloudinaryUrls)) {
        const publicIds = images.map(img => img.public_id);
        
        if (publicIds.length > 0) {
            try {
                const result = await cloudinary.api.delete_resources(publicIds);
                const deleted = Object.values(result.deleted).filter(v => v === 'deleted').length;
                totalDeleted += deleted;
                console.log(`✅ ${group}: ${deleted} görsel silindi`);
            } catch (err) {
                console.log(`❌ ${group}: ${err.message}`);
            }
        }
    }
    
    console.log(`\n✅ Toplam ${totalDeleted} görsel Cloudinary'den silindi!`);
}

deleteAll();
