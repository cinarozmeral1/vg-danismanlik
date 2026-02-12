const pool = require('../config/database');

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Starting admin_role migration...');
        
        // Start transaction for safety
        await client.query('BEGIN');
        
        // Check if column already exists
        const checkColumn = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'admin_role'
        `);
        
        if (checkColumn.rows.length === 0) {
            // Add admin_role column
            console.log('📝 Adding admin_role column...');
            await client.query(`
                ALTER TABLE users ADD COLUMN admin_role VARCHAR(20) 
                CHECK (admin_role IN ('super_admin', 'co_admin'))
            `);
            console.log('✅ admin_role column added');
        } else {
            console.log('ℹ️ admin_role column already exists');
        }
        
        // Create index if not exists
        console.log('📝 Creating index...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_users_admin_role ON users(admin_role)');
        console.log('✅ Index created');
        
        // Update existing admin to super_admin
        console.log('📝 Updating existing admin to super_admin...');
        const updateResult = await client.query(`
            UPDATE users 
            SET admin_role = 'super_admin' 
            WHERE is_admin = true AND (admin_role IS NULL OR admin_role = '')
            RETURNING id, email, first_name, last_name
        `);
        
        if (updateResult.rows.length > 0) {
            console.log('✅ Updated admins to super_admin:');
            updateResult.rows.forEach(row => {
                console.log(`   - ${row.first_name} ${row.last_name} (${row.email})`);
            });
        } else {
            console.log('ℹ️ No admins needed updating (already set or none found)');
        }
        
        // Commit transaction
        await client.query('COMMIT');
        
        // Verify the migration
        console.log('\n📊 Verification:');
        const admins = await client.query(`
            SELECT id, first_name, last_name, email, is_admin, admin_role 
            FROM users 
            WHERE is_admin = true
            ORDER BY admin_role, id
        `);
        
        console.log('Current admins:');
        admins.rows.forEach(admin => {
            console.log(`   ID: ${admin.id}, ${admin.first_name} ${admin.last_name}, ${admin.email}, Role: ${admin.admin_role || 'NULL'}`);
        });
        
        console.log('\n✅ Migration completed successfully!');
        
    } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(err => {
    console.error('Migration error:', err);
    process.exit(1);
});














