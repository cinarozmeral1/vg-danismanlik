const pool = require('../config/database');

async function checkApplications() {
    try {
        console.log('📋 Checking applications...');
        
        const result = await pool.query(`
            SELECT id, user_id, university_name, program_name, status, created_at 
            FROM applications 
            ORDER BY created_at DESC
        `);
        
        console.log('✅ Applications found:', result.rows.length);
        console.log('\n📊 Applications list:');
        result.rows.forEach((app, index) => {
            console.log(`${index + 1}. ID: ${app.id}, Status: ${app.status}, University: ${app.university_name}, Program: ${app.program_name}`);
        });
        
        const pendingCount = result.rows.filter(app => app.status === 'pending').length;
        console.log(`\n⏳ Pending applications: ${pendingCount}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkApplications();
