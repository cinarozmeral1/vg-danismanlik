/**
 * Yedekleme Bildirim Servisi
 * 
 * Yedekleme işlemi başarılı veya başarısız olduğunda
 * admin email adresine bildirim gönderir.
 */

const nodemailer = require('nodemailer');

// Email transporter oluştur
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Yedekleme bildirimi gönder
 * @param {boolean} success - Yedekleme başarılı mı?
 * @param {object} details - Yedekleme detayları
 */
async function sendBackupNotification(success, details) {
    // Email kapalıysa veya ayarlanmamışsa atla
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('⚠️ Email ayarları yapılmamış, bildirim atlanıyor');
        return;
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@ventureglobal.com';
    
    const subject = success 
        ? '✅ Venture Global - Yedekleme Başarılı' 
        : '❌ Venture Global - Yedekleme HATASI!';
    
    let html;
    
    if (success) {
        html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #28a745; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
                    .stat { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #28a745; }
                    .stat-label { font-weight: bold; color: #666; }
                    .stat-value { font-size: 18px; color: #28a745; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>✅ Yedekleme Başarılı</h2>
                    </div>
                    <div class="content">
                        <p>Venture Global veritabanı başarıyla yedeklendi.</p>
                        
                        <div class="stat">
                            <div class="stat-label">📅 Tarih ve Saat</div>
                            <div class="stat-value">${details.timestamp}</div>
                        </div>
                        
                        <div class="stat">
                            <div class="stat-label">📁 Dosya Adı</div>
                            <div class="stat-value">${details.filename || 'N/A'}</div>
                        </div>
                        
                        <div class="stat">
                            <div class="stat-label">📊 Toplam Tablo</div>
                            <div class="stat-value">${details.stats?.totalTables || 0}</div>
                        </div>
                        
                        <div class="stat">
                            <div class="stat-label">📝 Toplam Kayıt</div>
                            <div class="stat-value">${details.stats?.totalRecords || 0}</div>
                        </div>
                        
                        <div class="stat">
                            <div class="stat-label">💾 Dosya Boyutu</div>
                            <div class="stat-value">${details.stats?.fileSize || 'N/A'}</div>
                        </div>
                        
                        <p style="margin-top: 20px; color: #666;">
                            Yedek dosyası FTP sunucusuna başarıyla yüklendi.
                            30 günden eski yedekler otomatik olarak temizlendi.
                        </p>
                    </div>
                    <div class="footer">
                        <p>Bu otomatik bir bildirimdir. Venture Global Yedekleme Sistemi</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    } else {
        html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
                    .error-box { background: #fff3cd; border-left: 4px solid #dc3545; padding: 15px; margin: 15px 0; }
                    .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 5px; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>❌ Yedekleme Hatası!</h2>
                    </div>
                    <div class="content">
                        <p><strong>Venture Global veritabanı yedeklemesi başarısız oldu.</strong></p>
                        
                        <div class="error-box">
                            <strong>Hata Detayı:</strong><br>
                            ${details.error}
                        </div>
                        
                        <p><strong>Tarih:</strong> ${details.timestamp}</p>
                        
                        <div class="warning">
                            <strong>⚠️ Acil Müdahale Gerekli</strong><br>
                            Lütfen FTP sunucusu bağlantısını ve environment variables'ları kontrol edin.
                            <ul>
                                <li>FTP_HOST</li>
                                <li>FTP_USER</li>
                                <li>FTP_PASSWORD</li>
                                <li>DATABASE_URL</li>
                            </ul>
                        </div>
                        
                        <p style="color: #666;">
                            Sorunu çözdükten sonra manuel yedekleme için:<br>
                            <code>node scripts/backup-to-ftp.js</code>
                        </p>
                    </div>
                    <div class="footer">
                        <p>Bu otomatik bir bildirimdir. Venture Global Yedekleme Sistemi</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    try {
        await transporter.sendMail({
            from: `"Venture Global Backup" <${process.env.EMAIL_USER}>`,
            to: adminEmail,
            subject,
            html
        });
        
        console.log(`✅ Email gönderildi: ${adminEmail}`);
    } catch (error) {
        console.error('❌ Email gönderilemedi:', error.message);
        throw error;
    }
}

/**
 * Email ayarlarını test et
 */
async function testEmailConfiguration() {
    try {
        await transporter.verify();
        console.log('✅ Email sunucusu bağlantısı başarılı');
        return true;
    } catch (error) {
        console.error('❌ Email sunucusu bağlantısı başarısız:', error.message);
        return false;
    }
}

module.exports = {
    sendBackupNotification,
    testEmailConfiguration
};

