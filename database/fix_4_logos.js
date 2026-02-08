// 4 Üniversite için yüksek çözünürlüklü logolar
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

// Yüksek çözünürlüklü logolar
const updates = [
    {
        name: 'University of Manchester',
        logo_url: 'https://www.manchester.ac.uk/medialibrary/structure/logo-full-colour.png'
    },
    {
        name: 'University of Edinburgh',
        logo_url: 'https://www.ed.ac.uk/sites/default/files/atoms/files/uoe_main_logo.png'
    },
    {
        name: 'University of Winchester',
        logo_url: 'https://www.winchester.ac.uk/media/university-of-winchester/images/logos/UoW-logo.png'
    },
    {
        name: 'King\'s College London',
        logo_url: 'https://www.kcl.ac.uk/newsite-assets/images/brand/kcl-logo-red.png'
    }
];

async function fix() {
    console.log('🔧 4 Logo düzeltiliyor...\n');
    
    try {
        for (const uni of updates) {
            console.log(`📝 ${uni.name}`);
            
            await pool.query(`
                UPDATE universities 
                SET logo_url = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE name = $2 AND country = 'UK'
            `, [uni.logo_url, uni.name]);
            
            console.log('   ✅ OK');
        }
        
        console.log('\n✅ Tamamlandı!');
        
    } catch (error) {
        console.error('❌ Hata:', error);
    } finally {
        await pool.end();
    }
}

fix();


















