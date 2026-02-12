// Final Fix - Clearbit Logo API + World Rankings
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

// Clearbit Logo API her zaman çalışır
const updates = [
    {
        name: 'University of Manchester',
        logo_url: 'https://logo.clearbit.com/manchester.ac.uk',
        world_ranking: 27
    },
    {
        name: 'University of Westminster',
        logo_url: 'https://logo.clearbit.com/westminster.ac.uk',
        world_ranking: 601  // QS 2024
    },
    {
        name: 'Regent\'s University London',
        logo_url: 'https://logo.clearbit.com/regents.ac.uk',
        world_ranking: null // Sıralamada yok (özel küçük üniversite)
    },
    {
        name: 'University of Winchester',
        logo_url: 'https://logo.clearbit.com/winchester.ac.uk',
        world_ranking: 1001 // QS 2024
    },
    {
        name: 'Cardiff University',
        logo_url: 'https://logo.clearbit.com/cardiff.ac.uk',
        world_ranking: 154
    },
    {
        name: 'London School of Economics and Political Science (LSE)',
        logo_url: 'https://logo.clearbit.com/lse.ac.uk',
        world_ranking: 45
    },
    {
        name: 'University of Edinburgh',
        logo_url: 'https://logo.clearbit.com/ed.ac.uk',
        world_ranking: 22
    },
    {
        name: 'King\'s College London',
        logo_url: 'https://logo.clearbit.com/kcl.ac.uk',
        world_ranking: 40
    },
    {
        name: 'University of Sussex',
        logo_url: 'https://logo.clearbit.com/sussex.ac.uk',
        world_ranking: 218
    }
];

async function fix() {
    console.log('🔧 Logo ve Sıralama Düzeltiliyor...\n');
    
    try {
        for (const uni of updates) {
            console.log(`📝 ${uni.name}`);
            console.log(`   Logo: ${uni.logo_url}`);
            console.log(`   Sıralama: ${uni.world_ranking || 'Yok'}`);
            
            await pool.query(`
                UPDATE universities 
                SET logo_url = $1, 
                    world_ranking = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE name = $3 AND country = 'UK'
            `, [uni.logo_url, uni.world_ranking, uni.name]);
            
            console.log('   ✅ OK\n');
        }
        
        console.log('✅ Tamamlandı!');
        
    } catch (error) {
        console.error('❌ Hata:', error);
    } finally {
        await pool.end();
    }
}

fix();






















