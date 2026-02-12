const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

async function fix() {
    // Manchester - çalışan logo
    await pool.query(`
        UPDATE universities 
        SET logo_url = '/images/uk-logos/manchester.png'
        WHERE name = 'University of Manchester' AND country = 'UK'
    `);
    console.log('✅ Manchester logo updated to local file');
    
    // Diğerleri için Google Favicon (128px) - en azından bir şeyler görünsün
    const others = [
        { name: 'University of Edinburgh', domain: 'ed.ac.uk' },
        { name: "King's College London", domain: 'kcl.ac.uk' },
        { name: 'University of Winchester', domain: 'winchester.ac.uk' }
    ];
    
    for (const uni of others) {
        await pool.query(`
            UPDATE universities 
            SET logo_url = $1
            WHERE name = $2 AND country = 'UK'
        `, [`https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${uni.domain}&size=128`, uni.name]);
        console.log(`✅ ${uni.name} - Google Favicon`);
    }
    
    await pool.end();
    console.log('\nDone!');
}

fix();






















