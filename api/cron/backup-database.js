/**
 * Vercel Cron Job - Otomatik Veritabanı Yedekleme
 * 
 * Bu endpoint Vercel tarafından günlük otomatik olarak çağrılır.
 * Manuel test için: curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/backup-database
 */

const { backupToFTP } = require('../../scripts/backup-to-ftp');
const { sendBackupNotification } = require('../../services/backupNotificationService');

module.exports = async (req, res) => {
    // Güvenlik: Sadece Vercel Cron'dan gelen istekleri kabul et
    const authHeader = req.headers.authorization;
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (!authHeader || authHeader !== expectedAuth) {
        console.log('❌ Unauthorized cron request');
        return res.status(401).json({ 
            success: false,
            error: 'Unauthorized' 
        });
    }

    console.log('🚀 Cron job başlatıldı:', new Date().toISOString());

    try {
        // FTP yedekleme yap
        const result = await backupToFTP();
        
        // Başarı bildirimi gönder (email varsa)
        if (process.env.EMAIL_NOTIFICATIONS === 'true') {
            try {
                await sendBackupNotification(true, result);
                console.log('📧 Başarı bildirimi gönderildi');
            } catch (emailError) {
                console.log('⚠️ Email gönderilemedi:', emailError.message);
            }
        }

        // Başarılı yanıt
        res.status(200).json({
            success: true,
            message: 'Yedekleme başarıyla tamamlandı',
            timestamp: result.timestamp,
            stats: result.stats
        });

    } catch (error) {
        console.error('❌ Cron job hatası:', error);
        
        // Hata bildirimi gönder (email varsa)
        if (process.env.EMAIL_NOTIFICATIONS === 'true') {
            try {
                await sendBackupNotification(false, {
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
                console.log('📧 Hata bildirimi gönderildi');
            } catch (emailError) {
                console.log('⚠️ Email gönderilemedi:', emailError.message);
            }
        }

        // Hata yanıtı
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

