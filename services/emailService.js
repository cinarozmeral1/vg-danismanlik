const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
    user: process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com',
    pass: process.env.EMAIL_PASS || 'msdu gdlm cbfq tttc'
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Test SMTP connection
const testSMTPConnection = async () => {
    try {
        console.log('🔍 Testing SMTP connection...');
        console.log('   EMAIL_USER:', process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com');
        console.log('   EMAIL_PASS:', process.env.EMAIL_PASS ? '***SET***' : 'NOT SET');
        
        await transporter.verify();
        console.log('✅ SMTP connection successful');
        return true;
    } catch (error) {
        console.error('❌ SMTP connection failed:', error);
        console.error('   Error code:', error.code);
        console.error('   Error message:', error.message);
        return false;
    }
};

// Test connection on startup
testSMTPConnection();

// Generate verification token
const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Generate reset token
const generateResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Send verification email
const sendVerificationEmail = async (email, firstName, verificationToken, language = 'tr') => {
    // Vercel'de doğru URL'i al
    let baseUrl;
    if (process.env.BASE_URL) {
        baseUrl = process.env.BASE_URL;
    } else if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        // Production URL
        baseUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    } else if (process.env.VERCEL_URL) {
        baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
        // Localhost fallback
        baseUrl = process.env.NODE_ENV === 'production'
            ? 'https://vgdanismanlik.com'
            : 'http://localhost:4000';
    }
    if (!baseUrl.includes('http')) {
        baseUrl = `https://${baseUrl}`;
    }
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
    
    console.log('📧 Email Service - Verification Email Details:');
    console.log('   To:', email);
    console.log('   Name:', firstName);
    console.log('   Token:', verificationToken);
    console.log('   Language:', language);
    console.log('   Verification URL:', verificationUrl);
    console.log('   EMAIL_USER:', process.env.EMAIL_USER);
    console.log('   EMAIL_PASS:', process.env.EMAIL_PASS ? '***SET***' : 'NOT SET');
    
    const emailContent = {
        tr: {
            subject: 'Venture Global - E-posta Doğrulama',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">Venture Global</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">E-posta Doğrulama</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Merhaba ${firstName},</h2>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            Venture Global hesabınızı doğrulamak için aşağıdaki butona tıklayın:
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verificationUrl}" style="background: #0078D7; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                E-posta Adresimi Doğrula
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            Bu e-postayı siz talep etmediyseniz, lütfen dikkate almayın.
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                        
                        <p style="color: #999; font-size: 12px; text-align: center;">
                            Venture Global - Avrupa Üniversite ve Dil Okulu Danışmanlığı
                        </p>
                    </div>
                </div>
            `
        },
        en: {
            subject: 'Venture Global - Email Verification',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">Venture Global</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Email Verification</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Hello ${firstName},</h2>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            Please click the button below to verify your Venture Global account:
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verificationUrl}" style="background: #0078D7; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                Verify My Email Address
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            If you didn't request this email, please ignore it.
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                        
                        <p style="color: #999; font-size: 12px; text-align: center;">
                            Venture Global - European University and Language School Consultancy
                        </p>
                    </div>
                </div>
            `
        }
    };
    
    const content = emailContent[language] || emailContent.tr;
    
    const mailOptions = {
        from: process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com',
        to: email,
        subject: content.subject,
        html: content.html
    };
    
    try {
        console.log('📧 Email credentials check:');
        console.log('   EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
        console.log('   EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'NOT SET');
        
        await transporter.sendMail(mailOptions);
        console.log(`✅ Verification email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        console.error('   Error code:', error.code);
        console.error('   Error message:', error.message);
        return false;
    }
};

// Send password reset email
const sendPasswordResetEmail = async (email, firstName, resetToken, language = 'tr') => {
    // Vercel'de doğru URL'i al
    let baseUrl;
    if (process.env.VERCEL_URL) {
        // Vercel'de çalışıyor - production URL kullan
        baseUrl = `https://veture-global-website.vercel.app`;
    } else if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        // Production URL
        baseUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    } else if (process.env.BASE_URL) {
        // Manuel ayarlanmış BASE_URL
        baseUrl = process.env.BASE_URL;
    } else {
        // Localhost fallback
        baseUrl = 'http://localhost:4000';
    }
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    
    const emailContent = {
        tr: {
            subject: 'Venture Global - Şifre Sıfırlama',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">Venture Global</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Şifre Sıfırlama</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Merhaba ${firstName},</h2>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            Şifrenizi sıfırlamak için aşağıdaki butona tıklayın. Bu link 1 saat geçerlidir.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background: #0078D7; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                Şifremi Sıfırla
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            Bu e-postayı siz talep etmediyseniz, lütfen dikkate almayın.
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                        
                        <p style="color: #999; font-size: 12px; text-align: center;">
                            Venture Global - Avrupa Üniversite ve Dil Okulu Danışmanlığı
                        </p>
                    </div>
                </div>
            `
        },
        en: {
            subject: 'Venture Global - Password Reset',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">Venture Global</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Password Reset</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Hello ${firstName},</h2>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            Click the button below to reset your password. This link is valid for 1 hour.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background: #0078D7; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                Reset My Password
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            If you didn't request this email, please ignore it.
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                        
                        <p style="color: #999; font-size: 12px; text-align: center;">
                            Venture Global - European University and Language School Consultancy
                        </p>
                    </div>
                </div>
            `
        }
    };
    
    const content = emailContent[language] || emailContent.tr;
    
    const mailOptions = {
        from: process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com',
        to: email,
        subject: content.subject,
        html: content.html
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Password reset email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        return false;
    }
};

// Send application status change email
const sendApplicationStatusEmail = async (email, firstName, lastName, universityName, programName, status, language = 'tr') => {
    console.log('📧 Sending application status email:', {
        email, firstName, lastName, universityName, programName, status, language
    });
    const statusTexts = {
        tr: {
            pending: 'Beklemede',
            approved: 'Onaylandı',
            rejected: 'Reddedildi'
        },
        en: {
            pending: 'Pending',
            approved: 'Approved',
            rejected: 'Rejected'
        }
    };
    
    const statusText = statusTexts[language]?.[status] || statusTexts.tr[status] || status;
    
    const emailContent = {
        tr: {
            subject: `Venture Global - Başvuru Durumu Güncellendi: ${statusText}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">Venture Global</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Başvuru Durumu Güncellendi</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Merhaba ${firstName} ${lastName},</h2>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            Başvurunuzun durumu güncellenmiştir. Detaylar aşağıdadır:
                        </p>
                        
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0078D7;">
                            <h3 style="color: #333; margin-top: 0;">Başvuru Bilgileri</h3>
                            <p style="margin: 10px 0;"><strong>Üniversite:</strong> ${universityName}</p>
                            <p style="margin: 10px 0;"><strong>Program:</strong> ${programName}</p>
                            <p style="margin: 10px 0;"><strong>Durum:</strong> 
                                <span style="background: ${status === 'approved' ? '#28a745' : status === 'rejected' ? '#dc3545' : '#ffc107'}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                                    ${statusText}
                                </span>
                            </p>
                        </div>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            ${status === 'approved' ? 
                                'Tebrikler! Başvurunuz onaylanmıştır. Size en kısa sürede dönüş yapacağız.' :
                                status === 'rejected' ? 
                                'Üzgünüz, başvurunuz reddedilmiştir. Detaylı bilgi için bizimle iletişime geçebilirsiniz.' :
                                'Başvurunuz değerlendirilmektedir. Sonuç hakkında size bilgi verilecektir.'
                            }
                        </p>
                        
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                        
                        <p style="color: #999; font-size: 12px; text-align: center;">
                            Venture Global - Avrupa Üniversite ve Dil Okulu Danışmanlığı
                        </p>
                    </div>
                </div>
            `
        },
        en: {
            subject: `Venture Global - Application Status Updated: ${statusText}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">Venture Global</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Application Status Updated</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Hello ${firstName} ${lastName},</h2>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            Your application status has been updated. Details are below:
                        </p>
                        
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0078D7;">
                            <h3 style="color: #333; margin-top: 0;">Application Details</h3>
                            <p style="margin: 10px 0;"><strong>University:</strong> ${universityName}</p>
                            <p style="margin: 10px 0;"><strong>Program:</strong> ${programName}</p>
                            <p style="margin: 10px 0;"><strong>Status:</strong> 
                                <span style="background: ${status === 'approved' ? '#28a745' : status === 'rejected' ? '#dc3545' : '#ffc107'}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                                    ${statusText}
                                </span>
                            </p>
                        </div>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            ${status === 'approved' ? 
                                'Congratulations! Your application has been approved. We will contact you soon.' :
                                status === 'rejected' ? 
                                'We are sorry, your application has been rejected. You can contact us for detailed information.' :
                                'Your application is being reviewed. You will be informed about the result.'
                            }
                        </p>
                        
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                        
                        <p style="color: #999; font-size: 12px; text-align: center;">
                            Venture Global - European University and Language School Consultancy
                        </p>
                    </div>
                </div>
            `
        }
    };
    
    const content = emailContent[language] || emailContent.tr;
    
    const mailOptions = {
        from: process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com',
        to: email,
        subject: content.subject,
        html: content.html
    };
    
    try {
        console.log('📧 Email credentials check:');
        console.log('   EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
        console.log('   EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'NOT SET');
        
        await transporter.sendMail(mailOptions);
        console.log(`✅ Application status email sent to ${email} for status: ${status}`);
        return true;
    } catch (error) {
        console.error('❌ Status email sending failed:', error);
        console.error('   Error code:', error.code);
        console.error('   Error message:', error.message);
        console.error('   Error response:', error.response);
        return false;
    }
};

module.exports = {
    transporter,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendApplicationStatusEmail,
    generateVerificationToken,
    generateResetToken
}; 