const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass }
});

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getEmailSignature() {
    return `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;"><p style="margin: 0 0 15px 0; color: #333; font-style: italic; font-weight: 500;">Kind Regards,</p><p style="margin: 0 0 3px 0;"><a href="https://vgdanismanlik.com" style="color: #2563eb; text-decoration: underline; font-weight: bold; font-style: italic;">vgdanismanlik.com</a></p><p style="margin: 0 0 3px 0; color: #1a365d; font-weight: bold; font-style: italic;">CZ: +420 776 791 541</p><p style="margin: 0 0 20px 0; color: #1a365d; font-weight: bold; font-style: italic;">TR: +90 539 927 30 08</p><table cellpadding="0" cellspacing="0" border="0" style="margin-top: 15px;"><tr><td style="vertical-align: middle; padding-right: 15px;"><img src="https://vgdanismanlik.com/images/logos/venture-global-logo.png" alt="Venture Global" style="height: 80px; width: auto;"></td><td style="vertical-align: middle;"><p style="margin: 0; color: #1e40af; font-size: 18px; font-weight: bold;">VENTURE GLOBAL <sup style="font-size: 10px;">&reg;</sup></p><p style="margin: 0; color: #3b82f6; font-size: 14px; font-weight: 600;">YURT DIŞI EĞİTİM</p><p style="margin: 0; color: #3b82f6; font-size: 14px; font-weight: 600;">DANIŞMANLIĞI</p></td></tr></table></div>`;
}

function emailWrapper(content) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><style>@media (prefers-color-scheme: dark) { .email-body { background-color: #1a1a2e !important; } .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; } .email-text { color: #e0e0e0 !important; } .email-muted { color: #a0a0b0 !important; } .info-box { background-color: #1a2744 !important; border-color: #005A9E !important; } }</style></head><body style="margin: 0; padding: 0;"><div class="email-body" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;"><div style="background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;"><h1 style="margin: 0; font-size: 24px; font-weight: 700;">VG Danışmanlık</h1><p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Yurt Dışı Eğitim Danışmanlığı</p></div><div class="email-card" style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">${content}${getEmailSignature()}</div></div></body></html>`;
}

async function sendZoomReminderEmail(apt) {
    const isPro = apt.meeting_type === 'professional';
    const dateFormatted = new Date(apt.appointment_date).toLocaleDateString('tr-TR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const firstName = escapeHtml(apt.full_name.split(' ')[0]);
    const greeting = isPro
        ? `Sayın ${escapeHtml(apt.full_name)},`
        : `Merhaba ${firstName},`;
    const bodyText = isPro
        ? 'Görüşmeniz <strong>30 dakika içinde</strong> başlıyor. Aşağıdaki bilgilerle toplantıya katılabilirsiniz.'
        : 'Danışmanlık görüşmeniz <strong>30 dakika içinde</strong> başlıyor. Aşağıdaki bilgilerle toplantıya katılabilirsiniz.';

    await transporter.sendMail({
        from: `"VG Danışmanlık" <${emailUser}>`,
        to: apt.email,
        subject: `VG Danışmanlık - Görüşmeniz 30 Dakika İçinde Başlıyor!`,
        html: emailWrapper(`
            <h2 class="email-text" style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">${greeting}</h2>
            <p class="email-muted" style="color: #4b5563; line-height: 1.7; margin-bottom: 20px;">
                ${bodyText}
            </p>
            <div class="info-box" style="background: #f0f7ff; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #005A9E;">
                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                    <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;">Tarih</td><td style="padding: 8px 0; font-weight: 600; color: #1a1a1a;">${dateFormatted}</td></tr>
                    <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Saat</td><td style="padding: 8px 0; font-weight: 600; color: #1a1a1a;">${apt.turkey_time} (Türkiye Saati)</td></tr>
                    <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Süre</td><td style="padding: 8px 0; color: #1a1a1a;">30 Dakika</td></tr>
                </table>
            </div>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${apt.zoom_link}" style="display: inline-block; background: linear-gradient(135deg, #2D8CFF, #0B5CFF); color: white; padding: 16px 40px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px;">
                    Toplantıya Katıl
                </a>
            </div>
            <p style="text-align: center; color: #6b7280; font-size: 13px; margin-top: 10px;">
                Bağlantı açılmazsa: <a href="${apt.zoom_link}" style="color: #005A9E; word-break: break-all;">${apt.zoom_link}</a>
            </p>
            <div class="info-box" style="background: #fffbeb; border-radius: 12px; padding: 16px; margin: 24px 0; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                    <strong>Hatırlatma:</strong> Lütfen toplantıya zamanında katılın. Ses ve kameranızın çalıştığından emin olun.
                </p>
            </div>
        `)
    });
}

module.exports = async (req, res) => {
    const isVercelCron = !!req.headers['x-vercel-cron'];
    const CRON_SECRET = process.env.CRON_SECRET;
    const providedSecret = req.query.secret || req.headers['x-cron-secret'] || req.headers['authorization']?.replace('Bearer ', '');
    const isAuthorized = isVercelCron || (CRON_SECRET && providedSecret === CRON_SECRET);

    if (req.method === 'GET' && !providedSecret && !isVercelCron) {
        return res.status(200).json({ success: true, message: 'Zoom reminder cron is active', timestamp: new Date().toISOString() });
    }

    if (!isAuthorized) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS zoom_reminder_sent BOOLEAN DEFAULT false`).catch(() => {});

        const now = new Date();
        const from = new Date(now.getTime() + 10 * 60 * 1000);
        const to = new Date(now.getTime() + 35 * 60 * 1000);

        const result = await pool.query(`
            SELECT * FROM appointments 
            WHERE status = 'confirmed' 
            AND zoom_link IS NOT NULL 
            AND zoom_link != ''
            AND (zoom_reminder_sent IS NULL OR zoom_reminder_sent = false)
            AND start_utc >= $1 
            AND start_utc <= $2
        `, [from.toISOString(), to.toISOString()]);

        const sent = [];
        const failed = [];

        for (const apt of result.rows) {
            try {
                await sendZoomReminderEmail(apt);
                await pool.query('UPDATE appointments SET zoom_reminder_sent = true WHERE id = $1', [apt.id]);
                sent.push({ id: apt.id, name: apt.full_name, email: apt.email });
            } catch (err) {
                failed.push({ id: apt.id, name: apt.full_name, error: err.message });
            }
        }

        res.status(200).json({
            success: true,
            checked: result.rows.length,
            sent: sent.length,
            failed: failed.length,
            details: { sent, failed },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Zoom reminder cron error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
