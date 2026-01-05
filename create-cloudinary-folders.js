const cloudinary = require('cloudinary').v2;

// Cloudinary yapılandırması
cloudinary.config({
    cloud_name: 'dkhe6tjqo',
    api_key: '373479217921793',
    api_secret: 'GWf3lT2-xcUUPAAGRLMyT3ieyvY'
});

async function createFolders() {
    console.log('🗂️  Cloudinary\'de 19 klasör oluşturuluyor...\n');
    
    for (let i = 1; i <= 19; i++) {
        const folderName = `login-carousel/group-${String(i).padStart(2, '0')}`;
        
        try {
            await cloudinary.api.create_folder(folderName);
            console.log(`✅ ${folderName} oluşturuldu`);
        } catch (error) {
            if (error.error && error.error.message && error.error.message.includes('already exists')) {
                console.log(`⚠️  ${folderName} zaten mevcut`);
            } else {
                console.log(`❌ ${folderName}: ${error.message || error.error?.message || 'Hata'}`);
            }
        }
    }
    
    console.log('\n✅ Tamamlandı! Şimdi görselleri bekliyor...');
}

createFolders().catch(console.error);


