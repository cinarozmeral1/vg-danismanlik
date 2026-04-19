const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Professional Email Signature HTML
const getEmailSignature = () => {
    return `
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0 0 15px 0; color: #333; font-style: italic; font-weight: 500;">Kind Regards,</p>
            
            <p style="margin: 0 0 3px 0;">
                <a href="https://vgdanismanlik.com" style="color: #2563eb; text-decoration: underline; font-weight: bold; font-style: italic;">vgdanismanlik.com</a>
            </p>
            <p style="margin: 0 0 3px 0; color: #1a365d; font-weight: bold; font-style: italic;">CZ: +420 776 791 541</p>
            <p style="margin: 0 0 20px 0; color: #1a365d; font-weight: bold; font-style: italic;">TR: +90 539 927 30 08</p>
            
            <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 15px;">
                <tr>
                    <td style="vertical-align: middle; padding-right: 15px;">
                        <img src="https://vgdanismanlik.com/images/logos/01-1%20copy.png" alt="VG Danışmanlık" style="height: 80px; width: auto;">
                    </td>
                    <td style="vertical-align: middle;">
                        <p style="margin: 0; color: #1e40af; font-size: 18px; font-weight: bold;">VG DANIŞMANLIK</p>
                        <p style="margin: 0; color: #3b82f6; font-size: 14px; font-weight: 600;">YURT DIŞI EĞİTİM</p>
                    </td>
                </tr>
            </table>
        </div>
    `;
};

// Email configuration - trim whitespace/newlines from credentials
const emailUser = (process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com').trim().replace(/\\n/g, '').replace(/\n/g, '');
const emailPass = (process.env.EMAIL_PASS || 'msdu gdlm cbfq tttc').trim().replace(/\\n/g, '').replace(/\n/g, '');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: emailUser,
        pass: emailPass
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Test SMTP connection
const testSMTPConnection = async () => {
    try {
        console.log('🔍 Testing SMTP connection...');
        console.log('   EMAIL_USER:', emailUser);
        console.log('   EMAIL_PASS:', emailPass ? `***SET*** (length: ${emailPass.length})` : 'NOT SET (using fallback)');
        
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
            subject: 'VG Danışmanlık - E-posta Doğrulama',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">VG Danışmanlık</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">E-posta Doğrulama</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Merhaba ${firstName},</h2>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            VG Danışmanlık hesabınızı doğrulamak için aşağıdaki butona tıklayın:
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
            subject: 'VG Danışmanlık - Email Verification',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">VG Danışmanlık</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Email Verification</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Hello ${firstName},</h2>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            Please click the button below to verify your VG Danışmanlık account:
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
        from: `"VG Danışmanlık" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
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
            subject: 'VG Danışmanlık - Şifre Sıfırlama',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">VG Danışmanlık</h1>
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
            subject: 'VG Danışmanlık - Password Reset',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">VG Danışmanlık</h1>
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
        from: `"VG Danışmanlık" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
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
            subject: 'VG Danışmanlık - Başvurunuz Oluşturuldu',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">VG Danışmanlık</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Başvuru Oluşturuldu</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Merhaba ${firstName},</h2>
                        
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
            subject: 'VG Danışmanlık - Your Application Has Been Created',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">VG Danışmanlık</h1>
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
        from: `"VG Danışmanlık" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
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
            subject: `VG Danışmanlık - Başvuru Durumu Güncellendi: ${statusText}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">VG Danışmanlık</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Başvuru Durumu Güncellendi</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Merhaba ${firstName},</h2>
                        
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
            subject: `VG Danışmanlık - Application Status Updated: ${statusText}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">VG Danışmanlık</h1>
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
        from: `"VG Danışmanlık" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
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
            subject: 'VG Danışmanlık - Partner Hesabı Doğrulama',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">VG Danışmanlık</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Partner Hesabı Aktivasyonu</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Merhaba ${name.split(' ')[0]},</h2>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            VG Danışmanlık partner programına davet edildiniz. Hesabınızı aktifleştirmek ve şifrenizi belirlemek için aşağıdaki butona tıklayın:
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
            subject: 'VG Danışmanlık - Partner Account Verification',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">VG Danışmanlık</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Partner Account Activation</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Hello ${name},</h2>
                        
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            You have been invited to join the VG Danışmanlık partner program. Click the button below to activate your account and set your password:
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
        from: `"VG Danışmanlık" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
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
                <h1 style="margin: 0; font-size: 28px;">VG Danışmanlık</h1>
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
            from: `"VG Danışmanlık" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
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

// =====================================================
// PROFILE REMINDER EMAIL
// =====================================================
const sendProfileReminderEmail = async (user) => {
    const html = `
        <!DOCTYPE html>
        <html lang="tr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta name="color-scheme" content="light only">
            <meta name="supported-color-schemes" content="light only">
            <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]-->
            <style>
                :root { color-scheme: light only; supported-color-schemes: light only; }
                body, .email-bg, .email-card, .email-warning, .email-info-box { background-color: inherit !important; }
                [data-ogsc] .email-warning { background-color: #fff3cd !important; }
                [data-ogsc] .email-warning h3, [data-ogsc] .email-warning p { color: #1a1a1a !important; }
                [data-ogsc] .email-card { background-color: #ffffff !important; }
                [data-ogsc] .email-card p, [data-ogsc] .email-card h4, [data-ogsc] .email-card li { color: #333333 !important; }
                @media (prefers-color-scheme: dark) {
                    .email-bg { background-color: #f0f4f8 !important; }
                    .email-card { background-color: #ffffff !important; color: #333333 !important; }
                    .email-warning { background-color: #fff3cd !important; }
                    .email-warning h3, .email-warning p { color: #1a1a1a !important; }
                    .email-info-box { background-color: #f8f9fa !important; }
                    .email-info-box h4 { color: #333333 !important; }
                    .email-info-box li { color: #555555 !important; }
                    .dark-text { color: #333333 !important; }
                    .dark-text-light { color: #555555 !important; }
                    .dark-text-muted { color: #666666 !important; }
                    u + .body .email-bg { background-color: #f0f4f8 !important; }
                }
            </style>
        </head>
        <body class="body" style="margin: 0; padding: 0; background-color: #f0f4f8;">
        <div class="email-bg" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f0f4f8;">
            <div style="background: linear-gradient(135deg, #0056b3, #003d82); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <div style="display: inline-block; background-color: #ffffff; border-radius: 50%; padding: 10px; margin-bottom: 12px;">
                    <img src="https://vgdanismanlik.com/images/logos/01-1%20copy.png" alt="VG Danışmanlık" style="height: 55px; width: auto; display: block;">
                </div>
                <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: bold;">Profilinizi Tamamlayın</h1>
            </div>
            <div class="email-card" style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px;">
                <p class="dark-text" style="color: #333333; line-height: 1.6; font-size: 16px;">
                    Merhaba <strong>${user.first_name || 'Değerli Öğrencimiz'}</strong>,
                </p>
                
                <p class="dark-text" style="color: #333333; line-height: 1.6;">
                    VG Danışmanlık ailesine hoş geldiniz!
                </p>
                
                <!--[if mso]><table width="100%" cellpadding="20" cellspacing="0" style="background-color:#fff3cd;border:2px solid #ffc107;border-radius:8px;"><tr><td><![endif]-->
                <div class="email-warning" style="background-color: #fff3cd; border: 2px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #1a1a1a; margin: 0 0 10px 0; font-weight: bold;">
                        <span style="font-size: 20px;">⚠️</span> <span style="color: #1a1a1a;">Profil Bilgileriniz Eksik</span>
                    </h3>
                    <p style="color: #1a1a1a; margin: 0; line-height: 1.5;">
                        Danışmanlık hizmetlerimizden tam olarak faydalanabilmeniz için lütfen profil bilgilerinizi ve veli bilgilerinizi tamamlayın.
                    </p>
                </div>
                <!--[if mso]></td></tr></table><![endif]-->

                <div class="email-info-box" style="background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h4 class="dark-text" style="color: #333333; margin: 0 0 10px 0;">Tamamlamanız Gereken Bilgiler:</h4>
                    <ul class="dark-text-light" style="color: #555555; line-height: 2; padding-left: 20px;">
                        <li style="color: #555555;">Kişisel Bilgiler (Ad, Soyad, TC Kimlik No, Telefon)</li>
                        <li style="color: #555555;">Doğum Tarihi ve Pasaport Bilgileri</li>
                        <li style="color: #555555;">Aktif Olarak Okuduğu Okul</li>
                        <li style="color: #555555;">Ev Adresi</li>
                        <li style="color: #555555;">Veli Bilgileri (Anne ve Baba - en az 2 zorunlu)</li>
                    </ul>
                </div>

                <div style="text-align: center; margin: 25px 0;">
                    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="https://vgdanismanlik.com/user/dashboard" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="17%" strokecolor="#003d82" fillcolor="#0056b3"><center style="color:#ffffff;font-family:Arial;font-size:16px;font-weight:bold;">Profilimi Tamamla</center></v:roundrect><![endif]-->
                    <!--[if !mso]><!-->
                    <a href="https://vgdanismanlik.com/user/dashboard" style="background-color: #0056b3; background: linear-gradient(135deg, #0056b3, #003d82); color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
                        Profilimi Tamamla
                    </a>
                    <!--<![endif]-->
                </div>
                
                <p class="dark-text-muted" style="color: #666666; line-height: 1.6; font-size: 14px;">
                    Profil bilgileriniz, sözleşme oluşturma ve başvuru süreçleri için kritik öneme sahiptir.
                    Herhangi bir sorunuz varsa bizimle iletişime geçmekten çekinmeyin.
                </p>
                
                ${getEmailSignature()}
            </div>
        </div>
        </body>
        </html>
    `;
    
    try {
        const result = await transporter.sendMail({
            from: `"VG Danışmanlık" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
            to: user.email,
            subject: '⚠️ VG Danışmanlık - Profil Bilgilerinizi Tamamlayın',
            html: html
        });
        
        console.log('✅ Profile reminder email sent successfully to:', user.email);
        return true;
    } catch (error) {
        console.error('❌ Profile reminder email sending failed:', error);
        return false;
    }
};

// Send new student registration notification to admin
const sendNewStudentNotificationEmail = async (student, registrationMethod = 'email') => {
    const methodLabels = {
        'email': 'Manuel Kayıt (E-posta)',
        'google': 'Google ile Kayıt',
        'google_redirect': 'Google ile Kayıt (Redirect)'
    };
    const methodLabel = methodLabels[registrationMethod] || registrationMethod;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #0056b3 0%, #004494 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">Yeni Öğrenci Kaydı</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">VG Danışmanlık</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <h2 style="color: #333; margin-bottom: 20px;">Yeni bir öğrenci kaydoldu!</h2>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #e0e0e0;">
                        <td style="padding: 10px 0; font-weight: bold; color: #555; width: 40%;">Ad Soyad:</td>
                        <td style="padding: 10px 0; color: #333;">${student.first_name || ''} ${student.last_name || ''}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e0e0e0;">
                        <td style="padding: 10px 0; font-weight: bold; color: #555;">E-posta:</td>
                        <td style="padding: 10px 0; color: #333;">${student.email || '-'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e0e0e0;">
                        <td style="padding: 10px 0; font-weight: bold; color: #555;">Telefon:</td>
                        <td style="padding: 10px 0; color: #333;">${student.phone || '-'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e0e0e0;">
                        <td style="padding: 10px 0; font-weight: bold; color: #555;">Kayıt Yöntemi:</td>
                        <td style="padding: 10px 0; color: #333;">${methodLabel}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; font-weight: bold; color: #555;">Tarih:</td>
                        <td style="padding: 10px 0; color: #333;">${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</td>
                    </tr>
                </table>
                
                <div style="margin-top: 25px; text-align: center;">
                    <a href="https://vgdanismanlik.com/admin/dashboard" style="display: inline-block; background: #0056b3; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                        Admin Panelde Görüntüle (Giriş Gerekli)
                    </a>
                </div>
            </div>
            ${getEmailSignature()}
        </div>
    `;

    try {
        console.log('📧 Attempting to send new student notification email...');
        console.log('   From:', emailUser);
        console.log('   To: info@vgdanismanlik.com');
        console.log('   Student:', student.email);
        
        const result = await transporter.sendMail({
            from: `"VG Danışmanlık" <${emailUser}>`,
            to: 'info@vgdanismanlik.com',
            subject: `🆕 Yeni Öğrenci Kaydı - ${student.first_name || ''} ${student.last_name || ''} (${methodLabel})`,
            html: html
        });
        console.log('✅ New student notification email sent to info@vgdanismanlik.com for:', student.email);
        console.log('   Message ID:', result.messageId);
        return true;
    } catch (error) {
        console.error('❌ New student notification email failed:', error.message);
        console.error('   Error code:', error.code);
        console.error('   Error response:', error.response);
        console.error('   Full error:', JSON.stringify(error, null, 2));
        return false;
    }
};

// Send partner payment completed email
const sendPartnerPaymentEmail = async (partnerEmail, partnerName, studentName, amount, currency) => {
    console.log(`📧 Sending partner payment email to: ${partnerEmail}`);

    const mailOptions = {
        from: `"VG Danışmanlık" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
        to: partnerEmail,
        subject: `VG Danışmanlık - Komisyon Ödemeniz Tamamlandı`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">VG Danışmanlık</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Partner Ödeme Bildirimi</p>
                </div>

                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #333; margin-bottom: 20px;">Merhaba ${partnerName.split(' ')[0]},</h2>

                    <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                        Komisyon ödemeniz hesabınıza gönderilmiştir.
                    </p>

                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #198754;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #666;">Öğrenci:</td>
                                <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">${studentName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #666;">Ödeme Tutarı:</td>
                                <td style="padding: 8px 0; color: #198754; font-weight: bold; font-size: 18px; text-align: right;">${parseFloat(amount).toFixed(2)} ${currency}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #666;">Tarih:</td>
                                <td style="padding: 8px 0; color: #333; text-align: right;">${new Date().toLocaleDateString('tr-TR')}</td>
                            </tr>
                        </table>
                    </div>

                    <div style="text-align: center; margin: 25px 0;">
                        <a href="https://vgdanismanlik.com/partner/dashboard" style="background: #005A9E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Partner Panelini Görüntüle
                        </a>
                    </div>

                    ${getEmailSignature()}
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Partner payment email sent to ${partnerEmail}`);
        return true;
    } catch (error) {
        console.error('❌ Partner payment email failed:', error.message);
        return false;
    }
};

// Send partner new student assigned email
const sendPartnerNewStudentEmail = async (partnerEmail, partnerName, studentName) => {
    console.log(`📧 Sending partner new student email to: ${partnerEmail}`);

    const mailOptions = {
        from: `"VG Danışmanlık" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
        to: partnerEmail,
        subject: `VG Danışmanlık - Yeni Öğrenci Atandı`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">VG Danışmanlık</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Yeni Öğrenci Bildirimi</p>
                </div>

                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #333; margin-bottom: 20px;">Merhaba ${partnerName.split(' ')[0]},</h2>

                    <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                        Size yeni bir öğrenci atandı.
                    </p>

                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #005A9E;">
                        <h3 style="color: #333; margin-top: 0; font-size: 16px;">
                            <i style="color: #005A9E;">&#128100;</i> ${studentName}
                        </h3>
                        <p style="color: #666; margin: 0;">Bu öğrenci sizin partner hesabınıza atanmıştır. Detayları partner panelinizden takip edebilirsiniz.</p>
                    </div>

                    <div style="text-align: center; margin: 25px 0;">
                        <a href="https://vgdanismanlik.com/partner/dashboard" style="background: #005A9E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Partner Panelini Görüntüle
                        </a>
                    </div>

                    ${getEmailSignature()}
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Partner new student email sent to ${partnerEmail}`);
        return true;
    } catch (error) {
        console.error('❌ Partner new student email failed:', error.message);
        return false;
    }
};

// Send partner new earning assigned email
const sendPartnerNewEarningEmail = async (partnerEmail, partnerName, studentName, amount, currency) => {
    console.log(`📧 Sending partner new earning email to: ${partnerEmail}`);

    const mailOptions = {
        from: `"VG Danışmanlık" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
        to: partnerEmail,
        subject: `VG Danışmanlık - Yeni Kazanç Tanımlandı`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">VG Danışmanlık</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Kazanç Bildirimi</p>
                </div>

                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #333; margin-bottom: 20px;">Merhaba ${partnerName.split(' ')[0]},</h2>

                    <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                        Hesabınıza yeni bir kazanç tanımlanmıştır.
                    </p>

                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f0ad4e;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #666;">Öğrenci:</td>
                                <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">${studentName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #666;">Kazanç Tutarı:</td>
                                <td style="padding: 8px 0; color: #f0ad4e; font-weight: bold; font-size: 18px; text-align: right;">${parseFloat(amount).toFixed(2)} ${currency}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #666;">Durum:</td>
                                <td style="padding: 8px 0; text-align: right;"><span style="background: #fff3cd; color: #856404; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">Ödeme Bekliyor</span></td>
                            </tr>
                        </table>
                    </div>

                    <p style="color: #666; font-size: 14px;">
                        Ödeme yapıldığında ayrıca bilgilendirileceksiniz.
                    </p>

                    <div style="text-align: center; margin: 25px 0;">
                        <a href="https://vgdanismanlik.com/partner/dashboard" style="background: #005A9E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Partner Panelini Görüntüle
                        </a>
                    </div>

                    ${getEmailSignature()}
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Partner new earning email sent to ${partnerEmail}`);
        return true;
    } catch (error) {
        console.error('❌ Partner new earning email failed:', error.message);
        return false;
    }
};

// =====================================================
// GOOGLE REVIEW REQUEST EMAIL (Post-meeting & Post-acceptance)
// =====================================================
const sendReviewRequestEmail = async (email, firstName, type = 'meeting') => {
    const czReviewUrl = 'https://g.page/r/CRz-bfL0IjttEBM/review';
    const trReviewUrl = 'https://g.page/r/CcdwdU_f8l7lEBM/review';

    const isAcceptance = type === 'acceptance';
    const subject = isAcceptance ? 'VG Danışmanlık - Deneyiminizi Paylaşın' : 'VG Danışmanlık - Görüşmemiz Nasıldı?';
    const subtitle = isAcceptance ? 'Deneyiminizi Paylaşın' : 'Görüşme Geri Bildirimi';
    const intro = isAcceptance
        ? 'Üniversiteye kabul sürecinizde yanınızda olduğumuz için çok mutluyuz! Deneyiminizi diğer öğrencilerle paylaşarak onlara da ilham verebilirsiniz.'
        : 'Danışmanlık görüşmemizin sizin için faydalı olduğunu umuyoruz. Deneyiminizi Google üzerinden paylaşabilirsiniz.';

    const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #0078D7 0%, #005A9E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">VG Danışmanlık</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">${subtitle}</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Merhaba ${firstName},</h2>
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            ${intro}
                        </p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${czReviewUrl}" style="background: #0078D7; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                Google'da Değerlendir (Çekya)
                            </a>
                        </div>
                        <div style="text-align: center; margin: 20px 0;">
                            <a href="${trReviewUrl}" style="background: #0078D7; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                Google'da Değerlendir (Türkiye)
                            </a>
                        </div>
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            Her iki ofisimiz için de yorum yazarsanız çok seviniriz!
                        </p>
                        ${getEmailSignature()}
                    </div>
                </div>
    `;

    try {
        await transporter.sendMail({
            from: `"VG Danışmanlık" <${process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com'}>`,
            to: email,
            subject: subject,
            html: html
        });
        console.log(`Review request email (${type}) sent to: ${email}`);
        return true;
    } catch (error) {
        console.error(`Review request email failed for ${email}:`, error.message);
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
    sendProfileReminderEmail,
    sendNewStudentNotificationEmail,
    sendPartnerPaymentEmail,
    sendPartnerNewStudentEmail,
    sendPartnerNewEarningEmail,
    sendReviewRequestEmail,
    generateVerificationToken,
    generateResetToken
};