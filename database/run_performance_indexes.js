const pool = require('../config/database');

async function createPerformanceIndexes() {
    try {
        console.log('🚀 Creating performance indexes...');
        
        // Users table indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin)');
        console.log('✅ Users table indexes created');
        
        // Applications table indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_applications_user_status ON applications(user_id, status)');
        console.log('✅ Applications table indexes created');
        
        // Universities table indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_universities_country ON universities(country)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_universities_is_active ON universities(is_active)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_universities_is_featured ON universities(is_featured)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_universities_country_active ON universities(country, is_active)');
        console.log('✅ Universities table indexes created');
        
        // User documents table indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents(user_id)');
        console.log('✅ User documents table indexes created');
        
        // Services table indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_services_due_date ON services(due_date)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_services_is_paid ON services(is_paid)');
        console.log('✅ Services table indexes created');
        
        // Student checklist table indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_student_checklist_user_id ON student_checklist(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_student_checklist_is_completed ON student_checklist(is_completed)');
        console.log('✅ Student checklist table indexes created');
        
        // Notes table indexes (if table exists)
        try {
            await pool.query('CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_notes_priority ON notes(priority)');
            console.log('✅ Notes table indexes created');
        } catch (error) {
            console.log('ℹ️ Notes table not found, skipping notes indexes');
        }
        
        console.log('🎉 All performance indexes created successfully!');
        
    } catch (error) {
        console.error('❌ Error creating performance indexes:', error);
    } finally {
        await pool.end();
    }
}

createPerformanceIndexes();
