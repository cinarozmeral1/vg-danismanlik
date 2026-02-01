const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Professional Email Signature HTML
const getEmailSignature = () => {
    return `
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0 0 15px 0; color: #333; font-style: italic; font-weight: 500;">Kind Regards,</p>
            
            <p style="margin: 0 0 3px 0; color: #1a365d; font-weight: bold; font-size: 16px; font-style: italic;">Çınar Özmeral</p>
            <p style="margin: 0 0 3px 0; color: #1a365d; font-weight: bold; font-style: italic;">Senior Consultant</p>
            <p style="margin: 0 0 15px 0; color: #1a365d; font-weight: bold; font-style: italic;">Vg Consultancy</p>
            
            <p style="margin: 0 0 3px 0;">
                <a href="https://vgdanismanlik.com" style="color: #2563eb; text-decoration: underline; font-weight: bold; font-style: italic;">vgdanismanlik.com</a>
            </p>
            <p style="margin: 0 0 3px 0; color: #1a365d; font-weight: bold; font-style: italic;">CZ: +420 776 791 541</p>
            <p style="margin: 0 0 20px 0; color: #1a365d; font-weight: bold; font-style: italic;">TR: +90 539 927 30 08</p>
            
            <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 15px;">
                <tr>
                    <td style="vertical-align: middle; padding-right: 15px;">
                        <img src="https://vgdanismanlik.com/images/logos/venture-global-logo.png" alt="Venture Global" style="height: 80px; width: auto;">
                    </td>
                    <td style="vertical-align: middle;">
                        <p style="margin: 0; color: #1e40af; font-size: 18px; font-weight: bold;">VENTURE GLOBAL <sup style="font-size: 10px;">®</sup></p>
                        <p style="margin: 0; color: #3b82f6; font-size: 14px; font-weight: 600;">YURT DIŞI EĞİTİM</p>
                        <p style="margin: 0; color: #3b82f6; font-size: 14px; font-weight: 600;">DANIŞMANLIĞI</p>
                    </td>
                </tr>
            </table>
        </div>
    `;
};

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
                        
                        ${getEmailSignature()}
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
                        
                        ${getEmailSignature()}
                    </div>
                </div>
            `
        }
    };
    
    const content = emailContent[language] || emailContent.tr;
    
    const mailOptions = {
        from: `"Venture Global" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
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
                        
                        ${getEmailSignature()}
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
                        
                        ${getEmailSignature()}
                    </div>
                </div>
            `
        }
    };
    
    const content = emailContent[language] || emailContent.tr;
    
    const mailOptions = {
        from: `"Venture Global" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
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

// Send application creation email
const sendApplicationCreationEmail = async (email, firstName, lastName, universityName, programName, language = 'tr') => {
    console.log('📧 Sending application creation email:', {
        email, firstName, lastName, universityName, programName, language
    });
    
    const emailContent = {
        tr: {
            subject: 'Venture Global - Başvurunuz Oluşturuldu',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">Venture Global</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Başvuru Oluşturuldu</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Merhaba ${firstName} ${lastName},</h2>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            Başvurunuz başarıyla oluşturulmuştur. Şu anda beklemede durumundadır ve değerlendirilmektedir.
                        </p>
                        
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0078D7;">
                            <h3 style="color: #333; margin-top: 0;">Başvuru Bilgileri</h3>
                            <p style="margin: 10px 0;"><strong>Üniversite:</strong> ${universityName}</p>
                            <p style="margin: 10px 0;"><strong>Program:</strong> ${programName}</p>
                            <p style="margin: 10px 0;"><strong>Durum:</strong> 
                                <span style="background: #ffc107; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                                    Beklemede
                                </span>
                            </p>
                        </div>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            Başvurunuz değerlendirildikten sonra size e-posta ile bilgi verilecektir. 
                            Herhangi bir sorunuz olursa bizimle iletişime geçebilirsiniz.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://veture-global-website.vercel.app/user/dashboard" style="background: #0078D7; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                Başvurularımı Görüntüle
                            </a>
                        </div>
                        
                        ${getEmailSignature()}
                    </div>
                </div>
            `
        },
        en: {
            subject: 'Venture Global - Your Application Has Been Created',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">Venture Global</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Application Created</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Hello ${firstName} ${lastName},</h2>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            Your application has been successfully created and is currently pending review.
                        </p>
                        
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0078D7;">
                            <h3 style="color: #333; margin-top: 0;">Application Details</h3>
                            <p style="margin: 10px 0;"><strong>University:</strong> ${universityName}</p>
                            <p style="margin: 10px 0;"><strong>Program:</strong> ${programName}</p>
                            <p style="margin: 10px 0;"><strong>Status:</strong> 
                                <span style="background: #ffc107; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                                    Pending
                                </span>
                            </p>
                        </div>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            You will be notified via email once your application has been reviewed. 
                            If you have any questions, please feel free to contact us.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://veture-global-website.vercel.app/user/dashboard" style="background: #0078D7; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                View My Applications
                            </a>
                        </div>
                        
                        ${getEmailSignature()}
                    </div>
                </div>
            `
        }
    };
    
    const content = emailContent[language] || emailContent.tr;
    
    const mailOptions = {
        from: `"Venture Global" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
        to: email,
        subject: content.subject,
        html: content.html
    };
    
    try {
        console.log('📧 Email credentials check:');
        console.log('   EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
        console.log('   EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'NOT SET');
        
        await transporter.sendMail(mailOptions);
        console.log(`✅ Application creation email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Application creation email sending failed:', error);
        console.error('   Error code:', error.code);
        console.error('   Error message:', error.message);
        console.error('   Error response:', error.response);
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
                        
                        
                        ${getEmailSignature()}
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
                        
                        
                        ${getEmailSignature()}
                    </div>
                </div>
            `
        }
    };
    
    const content = emailContent[language] || emailContent.tr;
    
    const mailOptions = {
        from: `"Venture Global" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
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

// Send partner verification email
const sendPartnerVerificationEmail = async (email, name, verificationToken, language = 'tr') => {
    // Get correct URL for verification - always use production URL for partner emails
    // since partners need a stable URL that won't change between deployments
    let baseUrl = 'https://vgdanismanlik.com';
    
    // For development/testing, use localhost
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
        baseUrl = 'http://localhost:3000';
    }
    
    const verificationUrl = `${baseUrl}/api/auth/verify-partner-email?token=${verificationToken}`;
    
    console.log('📧 Email Service - Partner Verification Email Details:');
    console.log('   To:', email);
    console.log('   Name:', name);
    console.log('   Token:', verificationToken);
    console.log('   Verification URL:', verificationUrl);
    
    const emailContent = {
        tr: {
            subject: 'Venture Global - Partner Hesabı Doğrulama',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">Venture Global</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Partner Hesabı Aktivasyonu</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Merhaba ${name},</h2>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            Venture Global partner programına davet edildiniz. Hesabınızı aktifleştirmek ve şifrenizi belirlemek için aşağıdaki butona tıklayın:
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verificationUrl}" style="background: #2c3e50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                Hesabımı Aktifleştir
                            </a>
                        </div>
                        
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2c3e50;">
                            <h3 style="color: #333; margin-top: 0; font-size: 16px;">Partner Olarak Neler Yapabilirsiniz?</h3>
                            <ul style="color: #666; line-height: 1.8; padding-left: 20px;">
                                <li>Getirdiğiniz öğrencileri takip edin</li>
                                <li>Kazançlarınızı görüntüleyin</li>
                                <li>Ödeme durumlarını kontrol edin</li>
                            </ul>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            Bu e-postayı siz talep etmediyseniz, lütfen dikkate almayın.
                        </p>
                        
                        ${getEmailSignature()}
                    </div>
                </div>
            `
        },
        en: {
            subject: 'Venture Global - Partner Account Verification',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">Venture Global</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Partner Account Activation</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Hello ${name},</h2>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            You have been invited to join the Venture Global partner program. Click the button below to activate your account and set your password:
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verificationUrl}" style="background: #2c3e50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                Activate My Account
                            </a>
                        </div>
                        
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2c3e50;">
                            <h3 style="color: #333; margin-top: 0; font-size: 16px;">What Can You Do As A Partner?</h3>
                            <ul style="color: #666; line-height: 1.8; padding-left: 20px;">
                                <li>Track your referred students</li>
                                <li>View your earnings</li>
                                <li>Check payment statuses</li>
                            </ul>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            If you didn't request this email, please ignore it.
                        </p>
                        
                        ${getEmailSignature()}
                    </div>
                </div>
            `
        }
    };
    
    const content = emailContent[language] || emailContent.tr;
    
    const mailOptions = {
        from: `"Venture Global" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
        to: email,
        subject: content.subject,
        html: content.html
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Partner verification email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Partner verification email sending failed:', error);
        console.error('   Error code:', error.code);
        console.error('   Error message:', error.message);
        return false;
    }
};

// Send visa application email
const sendVisaApplicationEmail = async (user, country, consulateCity, status) => {
    console.log('📧 Sending visa application email to:', user.email);
    
    const countryNames = {
        'Germany': 'Almanya',
        'Czech Republic': 'Çek Cumhuriyeti',
        'Italy': 'İtalya',
        'Austria': 'Avusturya',
        'UK': 'İngiltere',
        'Poland': 'Polonya',
        'Hungary': 'Macaristan',
        'Netherlands': 'Hollanda'
    };
    
    const statusMessages = {
        'created': 'Oluşturuldu',
        'pending': 'Beklemede',
        'approved': 'KABUL EDİLDİ',
        'rejected': 'Reddedildi'
    };
    
    const statusColors = {
        'created': '#17a2b8',
        'pending': '#ffc107',
        'approved': '#28a745',
        'rejected': '#dc3545'
    };
    
    const subject = `Vize Başvurunuz - ${countryNames[country] || country} - ${statusMessages[status] || status}`;
    
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">Venture Global</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Vize Başvuru Bildirimi</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <h2 style="color: #333; margin-bottom: 20px;">Sayın ${user.first_name} ${user.last_name},</h2>
                
                <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                    <strong>${countryNames[country] || country}</strong> için <strong>${consulateCity}</strong> konsolosluğuna yaptığınız vize başvurunuz ile ilgili güncelleme:
                </p>
                
                <div style="background: ${statusColors[status] || '#17a2b8'}; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
                    <h3 style="margin: 0; font-size: 22px;">Başvuru Durumu: ${statusMessages[status]?.toUpperCase() || status.toUpperCase()}</h3>
                </div>
                
                ${status === 'approved' ? `
                    <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <p style="color: #155724; margin: 0;">
                            🎉 <strong>Tebrikler!</strong> Vize başvurunuz onaylandı. Sonraki adımlar için sizinle iletişime geçeceğiz.
                        </p>
                    </div>
                ` : ''}
                
                ${status === 'rejected' ? `
                    <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <p style="color: #721c24; margin: 0;">
                            Maalesef vize başvurunuz reddedildi. Detaylı bilgi için danışmanınızla iletişime geçin.
                        </p>
                    </div>
                ` : ''}
                
                <p style="color: #666; line-height: 1.6;">
                    Herhangi bir sorunuz varsa bizimle iletişime geçmekten çekinmeyin.
                </p>
                
                <div style="text-align: center; margin-bottom: 20px;">
                    <a href="https://vgdanismanlik.com/login" style="background: #0078D7; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                        Hesabıma Git
                    </a>
                </div>
                
                ${getEmailSignature()}
            </div>
        </div>
    `;
    
    try {
        const result = await transporter.sendMail({
            from: `"Venture Global" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
            to: user.email,
            subject: subject,
            html: html
        });
        
        console.log('✅ Visa application email sent successfully to:', user.email);
        return true;
    } catch (error) {
        console.error('❌ Visa application email sending failed:', error);
        console.error('   Error code:', error.code);
        console.error('   Error message:', error.message);
        return false;
    }
};

module.exports = {
    transporter,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendApplicationCreationEmail,
    sendApplicationStatusEmail,
    sendPartnerVerificationEmail,
    sendVisaApplicationEmail,
    generateVerificationToken,
    generateResetToken
}; 