/**
 * Vercel Cron Job - Profil Tamamlama Hatırlatıcısı
 * 
 * Kayıt tarihinden 24 saat geçmiş, profil bilgileri eksik olan öğrencilere
 * hatırlatma e-postası gönderir. Her öğrenciye yalnızca bir kez gönderilir.
 * 
 * TEST MODU: ?test=true ile çağrıldığında SADECE info@vgdanismanlik.com'a gönderir,
 * gerçek öğrencilere asla mail göndermez.
 * 
 * Çalışma sıklığı: Her 6 saatte bir (vercel.json cron config)
 */

const { Pool } = require('pg');
const { sendProfileReminderEmail } = require('../../services/emailService');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
    // Security check
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const authHeader = req.headers.authorization;
    const isAuthorized = authHeader === `Bearer ${process.env.CRON_SECRET}` || 
                         req.query.secret === process.env.CRON_SECRET;
    const isTestMode = req.query.test === 'true';
    
    if (!isVercelCron && !isAuthorized && !isTestMode) {
        console.log('❌ Unauthorized cron request');
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    console.log('🚀 Profile reminder cron started:', new Date().toISOString());
    console.log('🔧 Mode:', isTestMode ? 'TEST (only info@vgdanismanlik.com)' : 'PRODUCTION');

    try {
        // Find users with incomplete profiles
        const result = await pool.query(`
            SELECT u.id, u.first_name, u.last_name, u.email, u.created_at,
                   u.tc_number, u.phone, u.birth_date, u.current_school, u.home_address,
                   (SELECT COUNT(*) FROM guardians g WHERE g.user_id = u.id) as guardian_count
            FROM users u
            WHERE u.is_admin = false
              AND u.profile_reminder_sent = false
              AND u.created_at < NOW() - INTERVAL '24 hours'
              AND (
                  u.first_name IS NULL OR u.first_name = '' OR
                  u.last_name IS NULL OR u.last_name = '' OR
                  u.tc_number IS NULL OR u.tc_number = '' OR
                  u.phone IS NULL OR u.phone = '' OR
                  u.birth_date IS NULL OR
                  u.current_school IS NULL OR u.current_school = '' OR
                  u.home_address IS NULL OR u.home_address = '' OR
                  (SELECT COUNT(*) FROM guardians g WHERE g.user_id = u.id) < 2
              )
            ORDER BY u.created_at ASC
            LIMIT 50
        `);

        const users = result.rows;
        console.log(`📊 Found ${users.length} users with incomplete profiles`);

        // ════════════════════════════════════════════════════════════════
        // TEST MODE: Only send to info@vgdanismanlik.com, never to real users
        // ════════════════════════════════════════════════════════════════
        if (isTestMode) {
            const testUser = users[0] || { first_name: 'Test', last_name: 'Kullanıcı' };
            console.log(`📧 [TEST] Sending ONLY to info@vgdanismanlik.com (sample user: ${testUser.email || 'N/A'})`);
            
            const emailSent = await sendProfileReminderEmail({
                ...testUser,
                email: 'info@vgdanismanlik.com'
            });

            return res.status(200).json({
                success: true,
                mode: 'TEST',
                message: 'Test email sent ONLY to info@vgdanismanlik.com. No real users were emailed.',
                email_sent: emailSent,
                eligible_users: users.length
            });
        }

        // ════════════════════════════════════════════════════════════════
        // PRODUCTION MODE: Send to actual users
        // ════════════════════════════════════════════════════════════════
        let sentCount = 0;
        let failCount = 0;

        for (const user of users) {
            try {
                const emailSent = await sendProfileReminderEmail(user);
                
                if (emailSent) {
                    await pool.query(
                        'UPDATE users SET profile_reminder_sent = true WHERE id = $1',
                        [user.id]
                    );
                    sentCount++;
                    console.log(`✅ Reminder sent to ${user.email}`);
                } else {
                    failCount++;
                    console.log(`❌ Failed to send reminder to ${user.email}`);
                }

                // Small delay between emails to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err) {
                failCount++;
                console.error(`❌ Error processing user ${user.id}:`, err.message);
            }
        }

        const summary = {
            success: true,
            mode: 'PRODUCTION',
            timestamp: new Date().toISOString(),
            total_found: users.length,
            sent: sentCount,
            failed: failCount
        };

        console.log('📊 Profile reminder summary:', summary);
        return res.status(200).json(summary);

    } catch (error) {
        console.error('❌ Profile reminder cron error:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};
