const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const ZOOM_ACCOUNT_ID = (process.env.ZOOM_ACCOUNT_ID || '').trim();
const ZOOM_CLIENT_ID = (process.env.ZOOM_CLIENT_ID || '').trim();
const ZOOM_CLIENT_SECRET = (process.env.ZOOM_CLIENT_SECRET || '').trim();

let cachedToken = null;
let tokenExpiresAt = 0;

async function getZoomToken() {
    if (cachedToken && Date.now() < tokenExpiresAt - 60000) return cachedToken;
    if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
        throw new Error('Zoom credentials not configured');
    }
    const creds = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');
    const resp = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`
    });
    if (!resp.ok) throw new Error(`Zoom OAuth failed: ${resp.status}`);
    const data = await resp.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000);
    return cachedToken;
}

async function getPastMeeting(meetingId) {
    const token = await getZoomToken();
    const resp = await fetch(`https://api.zoom.us/v2/past_meetings/${meetingId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) {
        if (resp.status === 404 || resp.status === 400) return null;
        return null;
    }
    return await resp.json();
}

async function sendReviewEmail(email, firstName) {
    const nodemailer = require('nodemailer');
    const emailUser = (process.env.EMAIL_USER || '').trim();
    const emailPass = (process.env.EMAIL_PASS || '').trim();
    if (!emailUser || !emailPass) return false;

    const mailer = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: emailUser, pass: emailPass },
        tls: { rejectUnauthorized: false }
    });

    const czReviewUrl = 'https://g.page/r/CRz-bfL0IjttEBM/review';
    const trReviewUrl = 'https://g.page/r/CcdwdU_f8l7lEBM/review';

    const signature = `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;"><p style="margin: 0 0 15px 0; color: #333; font-style: italic; font-weight: 500;">Kind Regards,</p><p style="margin: 0 0 3px 0;"><a href="https://vgdanismanlik.com" style="color: #2563eb; text-decoration: underline; font-weight: bold; font-style: italic;">vgdanismanlik.com</a></p><p style="margin: 0 0 3px 0; color: #1a365d; font-weight: bold; font-style: italic;">CZ: +420 776 791 541</p><p style="margin: 0 0 20px 0; color: #1a365d; font-weight: bold; font-style: italic;">TR: +90 539 927 30 08</p><table cellpadding="0" cellspacing="0" border="0" style="margin-top: 15px;"><tr><td style="vertical-align: middle; padding-right: 15px;"><img src="https://vgdanismanlik.com/images/logos/01-1%20copy.png" alt="VG Danışmanlık" style="height: 80px; width: auto;"></td><td style="vertical-align: middle;"><p style="margin: 0; color: #1e40af; font-size: 18px; font-weight: bold;">VG DANIŞMANLIK</p><p style="margin: 0; color: #3b82f6; font-size: 14px; font-weight: 600;">YURT DIŞI EĞİTİM</p></td></tr></table></div>`;

    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"></head><body style="margin:0;padding:0;background-color:#f0f4f8;"><div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background-color:#f0f4f8;">
        <div style="background:linear-gradient(135deg,#005A9E,#003d6b);padding:30px 20px;text-align:center;border-radius:8px 8px 0 0;">
            <div style="display:inline-block;background-color:#ffffff;border-radius:50%;padding:10px;margin-bottom:12px;"><img src="https://vgdanismanlik.com/images/logos/01-1%20copy.png" alt="VG Danışmanlık" style="height:55px;width:auto;display:block;"></div>
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:bold;">VG Danışmanlık</h1>
            <p style="color:#e0e8f0;margin:8px 0 0 0;font-size:14px;">Yurt Dışı Eğitim Danışmanlığı</p>
        </div>
        <div style="background-color:#ffffff;padding:30px;border-radius:0 0 8px 8px;">
            <h2 style="color:#1a1a1a;margin:0 0 16px 0;font-size:20px;">Görüşmemiz Nasıldı?</h2>
            <p style="color:#333;line-height:1.7;font-size:15px;">Merhaba <strong>${firstName}</strong>,</p>
            <p style="color:#444;line-height:1.7;font-size:15px;">Danışmanlık görüşmemizin sizin için faydalı olduğunu umuyoruz. Deneyiminizi Google üzerinden paylaşabilirsiniz:</p>
            <div style="text-align:center;margin:30px 0;">
                <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                    <tr><td style="padding:0 8px;"><a href="${czReviewUrl}" style="display:inline-block;background:linear-gradient(135deg,#fbbc04,#f59e0b);color:#1a1a1a;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">Google'da Değerlendir</a></td></tr>
                    <tr><td style="height:8px;"></td></tr>
                    <tr><td style="text-align:center;"><span style="color:#999;font-size:13px;">Çekya ofisimiz için</span></td></tr>
                    <tr><td style="height:16px;"></td></tr>
                    <tr><td style="padding:0 8px;"><a href="${trReviewUrl}" style="display:inline-block;background:linear-gradient(135deg,#fbbc04,#f59e0b);color:#1a1a1a;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">Google'da Değerlendir</a></td></tr>
                    <tr><td style="height:8px;"></td></tr>
                    <tr><td style="text-align:center;"><span style="color:#999;font-size:13px;">Türkiye ofisimiz için</span></td></tr>
                </table>
            </div>
            <p style="color:#777;font-size:13px;line-height:1.6;text-align:center;margin-top:24px;">Her iki ofisimiz için de yorum yazarsanız çok seviniriz!</p>
            ${signature}
        </div>
        <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px;"><p style="margin:0;">© ${new Date().getFullYear()} VG Danışmanlık</p></div>
    </div></body></html>`;

    await mailer.sendMail({
        from: `"VG Danışmanlık" <${emailUser}>`,
        to: email,
        subject: 'VG Danışmanlık - Görüşmemiz Nasıldı?',
        html
    });
    return true;
}

module.exports = async (req, res) => {
    const isVercelCron = !!req.headers['x-vercel-cron'];
    const CRON_SECRET = process.env.CRON_SECRET;
    const providedSecret = req.query.secret || req.headers['x-cron-secret'] || req.headers['authorization']?.replace('Bearer ', '');
    const isAuthorized = isVercelCron || (CRON_SECRET && providedSecret === CRON_SECRET);

    if (req.method === 'GET' && !providedSecret && !isVercelCron) {
        return res.status(200).json({ success: true, message: 'Zoom meeting check cron is active', timestamp: new Date().toISOString() });
    }

    if (!isAuthorized) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        // Ensure review_email_sent column exists
        await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS review_email_sent BOOLEAN DEFAULT false`).catch(() => {});

        // Find confirmed appointments with Zoom that were scheduled to have ended by now
        // (end_utc in the past) and haven't been auto-completed yet
        const result = await pool.query(`
            SELECT * FROM appointments 
            WHERE status = 'confirmed' 
            AND zoom_meeting_id IS NOT NULL 
            AND zoom_meeting_id != ''
            AND end_utc < NOW() - INTERVAL '5 minutes'
            AND end_utc > NOW() - INTERVAL '24 hours'
        `);

        const completed = [];
        const skipped = [];
        const failed = [];

        for (const apt of result.rows) {
            try {
                const pastMeeting = await getPastMeeting(apt.zoom_meeting_id);
                
                if (!pastMeeting) {
                    skipped.push({ id: apt.id, name: apt.full_name, reason: 'no past meeting data' });
                    continue;
                }

                // Check if meeting lasted more than 10 minutes
                const durationMinutes = pastMeeting.duration || 0;
                
                if (durationMinutes < 10) {
                    skipped.push({ id: apt.id, name: apt.full_name, reason: `duration only ${durationMinutes}min` });
                    continue;
                }

                // Mark as completed
                await pool.query('UPDATE appointments SET status = $1 WHERE id = $2', ['completed', apt.id]);

                // Send review email
                try {
                    const firstName = apt.full_name.split(' ')[0];
                    await sendReviewEmail(apt.email, firstName);
                    await pool.query('UPDATE appointments SET review_email_sent = true WHERE id = $1', [apt.id]);
                    completed.push({ id: apt.id, name: apt.full_name, email: apt.email, duration: durationMinutes });
                } catch (emailErr) {
                    completed.push({ id: apt.id, name: apt.full_name, duration: durationMinutes, emailError: emailErr.message });
                }

            } catch (err) {
                failed.push({ id: apt.id, name: apt.full_name, error: err.message });
            }
        }

        res.status(200).json({
            success: true,
            checked: result.rows.length,
            completed: completed.length,
            skipped: skipped.length,
            failed: failed.length,
            details: { completed, skipped, failed },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Zoom meeting check cron error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
