const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const crypto = require('crypto');
const calendarService = require('../services/calendarService');
const zoomService = require('../services/zoomService');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { createContact } = require('../services/contactService');

const publicApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: { success: false, message: 'Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.' }
});

const bookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Çok fazla randevu denemesi. Lütfen daha sonra tekrar deneyin.' }
});

const emailUser = (process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com').trim().replace(/\\n/g, '').replace(/\n/g, '');
const emailPass = (process.env.EMAIL_PASS || '').trim().replace(/\\n/g, '').replace(/\n/g, '');
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass },
    tls: { rejectUnauthorized: false }
});

const ADMIN_EMAIL = 'info@vgdanismanlik.com';

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function parsePhone(phone) {
    if (!phone) return { code: '', number: '' };
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('90') && digits.length >= 12) {
        const num = digits.substring(2);
        return { code: '+90', number: num.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4') };
    }
    if (digits.startsWith('1') && digits.length >= 11) {
        return { code: '+1', number: digits.substring(1).replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') };
    }
    if (digits.startsWith('44') && digits.length >= 12) {
        return { code: '+44', number: digits.substring(2).replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3') };
    }
    if (digits.startsWith('49') && digits.length >= 11) {
        return { code: '+49', number: digits.substring(2) };
    }
    const cleaned = phone.replace(/\s+/g, ' ').trim();
    const match = cleaned.match(/^(\+\d{1,3})\s+(.+)$/);
    if (match) return { code: match[1], number: match[2] };
    return { code: '', number: cleaned };
}

function formatPhoneHtml(phone) {
    if (!phone) return '<span style="color: #9ca3af;">Belirtilmedi</span>';
    const p = parsePhone(phone);
    if (p.code) {
        return `<span style="display:inline-block;background:#e5e7eb;color:#374151;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:600;vertical-align:middle;">${p.code}</span>&nbsp;<span style="font-weight:600;">${escapeHtml(p.number)}</span>`;
    }
    return `<span style="font-weight:600;">${escapeHtml(p.number)}</span>`;
}

function requireSuperAdmin(req, res, next) {
    if (!res.locals.isLoggedIn || !res.locals.isAdmin || !res.locals.isSuperAdmin) {
        return res.status(401).json({ success: false, message: 'Yetkiniz yok.' });
    }
    next();
}

(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS appointments (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                email VARCHAR(255) NOT NULL,
                target_country VARCHAR(100) NOT NULL,
                field_of_interest VARCHAR(100) NOT NULL,
                education_level VARCHAR(100) NOT NULL,
                grade VARCHAR(10),
                budget VARCHAR(50),
                notes TEXT,
                appointment_date DATE NOT NULL,
                czech_time VARCHAR(10) NOT NULL,
                turkey_time VARCHAR(10) NOT NULL,
                start_utc TIMESTAMPTZ NOT NULL,
                end_utc TIMESTAMPTZ NOT NULL,
                calendar_event_id TEXT,
                ip_address VARCHAR(50),
                status VARCHAR(20) DEFAULT 'confirmed',
                zoom_link TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);

        try {
            await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS zoom_link TEXT`);
        } catch (e) { /* column already exists */ }

        try {
            await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS zoom_reminder_sent BOOLEAN DEFAULT false`);
        } catch (e) { /* column already exists */ }

        try {
            await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS meeting_type VARCHAR(20) DEFAULT 'student'`);
        } catch (e) { /* column already exists */ }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS appointment_verifications (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                code VARCHAR(6) NOT NULL,
                verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS appointment_ip_limits (
                id SERIAL PRIMARY KEY,
                ip_address VARCHAR(50) NOT NULL,
                attempt_count INTEGER DEFAULT 1,
                first_attempt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Appointment tables ensured');
    } catch (e) {
        console.error('Appointment tables error:', e.message);
    }
})();

const getEmailSignature = () => `
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

const emailWrapper = (content) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
    @media (prefers-color-scheme: dark) {
        .email-body { background-color: #1a1a2e !important; }
        .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
        .email-text { color: #e0e0e0 !important; }
        .email-muted { color: #a0a0b0 !important; }
        .info-box { background-color: #1a2744 !important; border-color: #005A9E !important; }
    }
</style>
</head>
<body style="margin: 0; padding: 0;">
<div class="email-body" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
    <div style="background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 700;">VG Danışmanlık</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Yurt Dışı Eğitim Danışmanlığı</p>
    </div>
    <div class="email-card" style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        ${content}
        ${getEmailSignature()}
    </div>
    <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">Bu e-posta VG Danışmanlık randevu sistemi tarafından gönderilmiştir.</p>
        <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} VG Danışmanlık. Tüm hakları saklıdır.</p>
    </div>
</div>
</body>
</html>`;

function generateICSForStudent(apt) {
    const uid = apt.calendar_event_id || calendarService.generateUID();
    const startDate = new Date(apt.start_utc);
    const endDate = new Date(apt.end_utc);

    return calendarService.buildICSString({
        uid: uid + '-student',
        title: 'VG Danışmanlık - Eğitim Danışmanlığı Görüşmesi',
        description: `Hedef Ülke: ${apt.target_country}\nİlgi Alanı: ${apt.field_of_interest}\n\nDeğişiklik veya iptal için WhatsApp: +90 539 927 30 08`,
        startDate,
        endDate,
        location: apt.zoom_link || 'Online - Link ayrıca gönderilecektir',
        organizerEmail: 'info@vgdanismanlik.com'
    });
}

async function checkIPLimit(ip) {
    try {
        await pool.query(`DELETE FROM appointment_ip_limits WHERE first_attempt < NOW() - INTERVAL '24 hours'`);
        const result = await pool.query(`SELECT * FROM appointment_ip_limits WHERE ip_address = $1`, [ip]);
        if (result.rows.length === 0) {
            await pool.query(`INSERT INTO appointment_ip_limits (ip_address) VALUES ($1)`, [ip]);
            return true;
        }
        if (result.rows[0].attempt_count >= 3) return false;
        await pool.query(`UPDATE appointment_ip_limits SET attempt_count = attempt_count + 1 WHERE ip_address = $1`, [ip]);
        return true;
    } catch (e) {
        console.error('IP limit check error:', e.message);
        return true;
    }
}

router.get('/available-dates', publicApiLimiter, async (req, res) => {
    try {
        const start = new Date();
        start.setDate(start.getDate() + 1);
        const end = new Date();
        end.setMonth(end.getMonth() + 3);
        const dates = await calendarService.getAvailableDates(start, end);

        const bookedResult = await pool.query(
            `SELECT appointment_date, start_utc, end_utc FROM appointments WHERE appointment_date >= $1 AND appointment_date <= $2 AND status != 'cancelled'`,
            [start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
        );
        const bookedByDate = {};
        for (const row of bookedResult.rows) {
            const d = new Date(row.appointment_date).toISOString().split('T')[0];
            if (!bookedByDate[d]) bookedByDate[d] = [];
            bookedByDate[d].push(row);
        }

        const filteredDates = dates.map(d => {
            const booked = bookedByDate[d.date] || [];
            if (booked.length === 0) return d;
            const remainingSlots = d.slotsAvailable - booked.length;
            if (remainingSlots <= 0) return null;
            return { ...d, slotsAvailable: remainingSlots };
        }).filter(Boolean);

        res.json({ success: true, dates: filteredDates });
    } catch (error) {
        console.error('Available dates error:', error);
        res.json({ success: true, dates: [] });
    }
});

router.get('/available-slots/:date', publicApiLimiter, async (req, res) => {
    try {
        const dateStr = req.params.date;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return res.status(400).json({ success: false, message: 'Invalid date format' });
        }
        let slots = await calendarService.getSlotsForDate(dateStr);

        const bookedResult = await pool.query(
            `SELECT start_utc, end_utc FROM appointments WHERE appointment_date::text = $1 AND status != 'cancelled'`,
            [dateStr]
        );
        const bookedSlots = bookedResult.rows;

        const SLOT_BLOCK_MS = 60 * 60 * 1000;
        if (bookedSlots.length > 0) {
            slots = slots.filter(slot => {
                const slotStart = new Date(slot.startUTC).getTime();
                const slotBlockEnd = slotStart + SLOT_BLOCK_MS;
                return !bookedSlots.some(booked => {
                    const bookedStart = new Date(booked.start_utc).getTime();
                    const bookedBlockEnd = bookedStart + SLOT_BLOCK_MS;
                    return bookedStart < slotBlockEnd && bookedBlockEnd > slotStart;
                });
            });
        }

        const date = new Date(dateStr);
        if (date.getDay() === 0) {
            if (bookedSlots.length >= 1) {
                slots = [];
            } else if (slots.length > 0) {
                slots = [slots[0]];
            }
        }

        res.json({ success: true, slots });
    } catch (error) {
        console.error('Available slots error:', error);
        res.json({ success: true, slots: [] });
    }
});

router.post('/send-verification', async (req, res) => {
    try {
        const { email, fullName } = req.body;
        if (!email || !fullName) {
            return res.status(400).json({ success: false, message: 'E-posta ve ad soyad gereklidir.' });
        }

        const ip = req.headers['x-forwarded-for'] || req.ip;
        const ipOk = await checkIPLimit(ip);
        if (!ipOk) {
            return res.status(429).json({ success: false, message: 'Çok fazla deneme yaptınız. 24 saat sonra tekrar deneyin.' });
        }

        const recent = await pool.query(
            `SELECT id FROM appointment_verifications WHERE email = $1 AND created_at > NOW() - INTERVAL '60 seconds'`,
            [email]
        );
        if (recent.rows.length > 0) {
            return res.status(429).json({ success: false, message: 'Lütfen 1 dakika bekleyip tekrar deneyin.' });
        }

        await pool.query(`DELETE FROM appointment_verifications WHERE email = $1`, [email]);

        const code = String(Math.floor(100000 + Math.random() * 900000));
        await pool.query(
            `INSERT INTO appointment_verifications (email, code) VALUES ($1, $2)`,
            [email, code]
        );

        const firstName = fullName.split(' ')[0];
        await transporter.sendMail({
            from: `"VG Danışmanlık" <${emailUser}>`,
            to: email,
            subject: 'VG Danışmanlık - Randevu Doğrulama Kodu',
            html: emailWrapper(`
                <h2 class="email-text" style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">Merhaba ${firstName},</h2>
                <p class="email-muted" style="color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
                    Randevu talebiniz için doğrulama kodunuz aşağıdadır:
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <div style="display: inline-block; background: #f0f7ff; border: 2px solid #005A9E; border-radius: 12px; padding: 20px 40px;">
                        <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #005A9E;">${code}</span>
                    </div>
                </div>
                <p class="email-muted" style="color: #6b7280; font-size: 14px; text-align: center;">
                    Bu kod 10 dakika içinde geçerliliğini yitirecektir.
                </p>
                <p style="color: #9ca3af; font-size: 13px; margin-top: 25px;">
                    Bu kodu siz talep etmediyseniz, lütfen bu e-postayı dikkate almayın.
                </p>
            `)
        });

        res.json({ success: true, message: 'Doğrulama kodu gönderildi.' });
    } catch (error) {
        console.error('Verification send error:', error);
        res.status(500).json({ success: false, message: 'Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin.' });
    }
});

router.post('/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            return res.status(400).json({ success: false, message: 'E-posta ve kod gereklidir.' });
        }
        const result = await pool.query(
            `SELECT * FROM appointment_verifications WHERE email = $1 AND created_at > NOW() - INTERVAL '10 minutes' ORDER BY created_at DESC LIMIT 1`,
            [email]
        );
        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Doğrulama kodu bulunamadı. Yeni kod talep edin.' });
        }
        if (result.rows[0].code !== code.trim()) {
            return res.status(400).json({ success: false, message: 'Yanlış doğrulama kodu.' });
        }
        await pool.query(`UPDATE appointment_verifications SET verified = TRUE WHERE id = $1`, [result.rows[0].id]);
        res.json({ success: true, message: 'E-posta doğrulandı.' });
    } catch (error) {
        console.error('Verify code error:', error);
        res.status(500).json({ success: false, message: 'Doğrulama sırasında hata oluştu.' });
    }
});

router.post('/create-fast', bookingLimiter, async (req, res) => {
    try {
        if (!res.locals.isLoggedIn || !res.locals.currentUser) {
            return res.status(401).json({ success: false, message: 'Giriş yapmanız gerekmektedir.' });
        }

        const user = res.locals.currentUser;
        const { date, timeSlot } = req.body;

        if (!date || !timeSlot) {
            return res.status(400).json({ success: false, message: 'Tarih ve saat seçimi zorunludur.' });
        }

        const activeAppts = await pool.query(
            `SELECT COUNT(*) as cnt FROM appointments WHERE email = $1 AND status != 'cancelled' AND appointment_date >= CURRENT_DATE`,
            [user.email]
        );
        if (parseInt(activeAppts.rows[0].cnt) >= 2) {
            return res.status(429).json({ success: false, message: 'En fazla 2 aktif randevunuz olabilir. Mevcut randevularınızı kontrol edin.' });
        }

        const ip = req.headers['x-forwarded-for'] || req.ip;
        const slotParts = timeSlot.split('|');
        const czechTime = slotParts[0];
        const turkeyTime = slotParts[1];
        const startUTC = slotParts[2];
        const endUTC = slotParts[3];

        const conflictCheck = await pool.query(
            `SELECT id FROM appointments WHERE appointment_date = $1 AND status != 'cancelled' AND start_utc = $2`,
            [date, startUTC]
        );
        if (conflictCheck.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Bu saat dilimi az önce başka biri tarafından alındı. Lütfen farklı bir saat seçin.' });
        }

        const fullName = (user.first_name || '') + ' ' + (user.last_name || '');
        const phone = user.phone || '';
        const email = user.email;

        let calendarEventId = null;
        try {
            const description = [
                `Ad Soyad: ${fullName}`,
                `Telefon: ${phone}`,
                `E-posta: ${email}`,
                `(Kayıtlı Öğrenci - Hızlı Randevu)`
            ].filter(Boolean).join('\n');

            calendarEventId = await calendarService.createEvent({
                title: `VG Randevu - ${fullName} (Kayıtlı)`,
                description,
                startDate: new Date(startUTC),
                endDate: new Date(endUTC),
                attendeeEmail: email,
                attendeeName: fullName
            });
        } catch (calError) {
            console.error('Calendar event creation failed:', calError.message);
        }

        let zoomLink = null;
        let zoomMeetingId = null;
        try {
            if (zoomService.isConfigured()) {
                const meeting = await zoomService.createZoomMeeting({
                    topic: `VG Danışmanlık - ${fullName}`,
                    startTime: startUTC,
                    duration: 30,
                    agenda: `Danışmanlık görüşmesi: ${fullName} (Kayıtlı Öğrenci)`
                });
                zoomLink = meeting.join_url;
                zoomMeetingId = meeting.meeting_id ? String(meeting.meeting_id) : null;
                console.log('Zoom meeting created:', meeting.join_url);
            }
        } catch (zoomError) {
            console.error('Zoom meeting creation failed:', zoomError.message);
        }

        const result = await pool.query(
            `INSERT INTO appointments (
                full_name, phone, email, target_country, field_of_interest,
                education_level, grade, budget, notes,
                appointment_date, czech_time, turkey_time,
                start_utc, end_utc, calendar_event_id, ip_address, status, zoom_link, zoom_meeting_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'confirmed',$17,$18)
            RETURNING *`,
            [fullName, phone, email, 'Kayıtlı Öğrenci', 'Genel Danışmanlık',
             'Kayıtlı Öğrenci', null, null, 'Hızlı randevu (kayıtlı öğrenci)',
             date, czechTime, turkeyTime, startUTC, endUTC,
             calendarEventId || null, ip, zoomLink, zoomMeetingId]
        );

        const appointment = result.rows[0];

        await Promise.all([
            sendConfirmationEmail(appointment).catch(e => console.error('Confirmation email failed:', e.message)),
            sendAdminNotificationEmail(appointment).catch(e => console.error('Admin notification failed:', e.message))
        ]);

        res.json({ success: true, message: 'Randevunuz başarıyla oluşturuldu!', appointment: { id: appointment.id, date, turkeyTime } });
    } catch (error) {
        console.error('Create fast appointment error:', error);
        res.status(500).json({ success: false, message: 'Randevu oluşturulamadı. Lütfen tekrar deneyin.' });
    }
});

router.post('/create', bookingLimiter, async (req, res) => {
    try {
        const {
            fullName, phone, email, targetCountry, fieldOfInterest,
            educationLevel, grade, budget, notes, date, timeSlot, honeypot
        } = req.body;

        if (honeypot) {
            return res.status(200).json({ success: true, message: 'Randevunuz oluşturuldu.' });
        }

        if (!fullName || !phone || !email || !targetCountry || !fieldOfInterest || !educationLevel || !date || !timeSlot) {
            return res.status(400).json({ success: false, message: 'Tüm zorunlu alanları doldurun.' });
        }

        const phoneClean = phone.replace(/\D/g, '');
        if (phoneClean.length < 10) {
            return res.status(400).json({ success: false, message: 'Geçerli bir telefon numarası girin.' });
        }

        const verifyResult = await pool.query(
            `SELECT * FROM appointment_verifications WHERE email = $1 AND verified = TRUE AND created_at > NOW() - INTERVAL '15 minutes' ORDER BY created_at DESC LIMIT 1`,
            [email]
        );
        if (verifyResult.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'E-posta adresinizi doğrulayın.' });
        }

        const recentBooking = await pool.query(
            `SELECT id FROM appointments
             WHERE (email = $1 OR phone = $2)
             AND status != 'cancelled'
             AND created_at > NOW() - INTERVAL '7 days'`,
            [email, phone]
        );
        if (recentBooking.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Son 7 gün içinde zaten bir randevunuz bulunmaktadır. Değişiklik için WhatsApp üzerinden bize ulaşabilirsiniz.'
            });
        }

        const ip = req.headers['x-forwarded-for'] || req.ip;

        const slotParts = timeSlot.split('|');
        const czechTime = slotParts[0];
        const turkeyTime = slotParts[1];
        const startUTC = slotParts[2];
        const endUTC = slotParts[3];

        const conflictCheck = await pool.query(
            `SELECT id FROM appointments WHERE appointment_date = $1 AND status != 'cancelled' AND start_utc = $2`,
            [date, startUTC]
        );
        if (conflictCheck.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Bu saat dilimi az önce başka biri tarafından alındı. Lütfen farklı bir saat seçin.' });
        }

        const appointmentStart = new Date(startUTC);
        const appointmentEnd = new Date(endUTC);

        let calendarEventId = null;
        try {
            const description = [
                `Ad Soyad: ${fullName}`,
                `Telefon (WhatsApp): ${phone}`,
                `E-posta: ${email}`,
                `Hedef Ülke: ${targetCountry}`,
                `İlgi Alanı: ${fieldOfInterest}`,
                `Eğitim: ${educationLevel}${grade ? ' - ' + grade + '. Sınıf' : ''}`,
                budget ? `Bütçe: ${budget}` : '',
                notes ? `Not: ${notes}` : ''
            ].filter(Boolean).join('\n');

            calendarEventId = await calendarService.createEvent({
                title: `VG Randevu - ${fullName}`,
                description,
                startDate: appointmentStart,
                endDate: appointmentEnd,
                attendeeEmail: email,
                attendeeName: fullName
            });
            console.log('Calendar event created with ID:', calendarEventId);
        } catch (calError) {
            console.error('Calendar event creation failed:', calError.message, calError.stack);
        }

        let zoomLink = null;
        let zoomMeetingId = null;
        try {
            if (zoomService.isConfigured()) {
                const meeting = await zoomService.createZoomMeeting({
                    topic: `VG Danışmanlık - ${fullName}`,
                    startTime: startUTC,
                    duration: 30,
                    agenda: `Danışmanlık görüşmesi: ${fullName} - ${targetCountry} / ${fieldOfInterest}`
                });
                zoomLink = meeting.join_url;
                zoomMeetingId = meeting.meeting_id ? String(meeting.meeting_id) : null;
                console.log('Zoom meeting created:', meeting.join_url);
            }
        } catch (zoomError) {
            console.error('Zoom meeting creation failed:', zoomError.message);
        }

        const result = await pool.query(
            `INSERT INTO appointments (
                full_name, phone, email, target_country, field_of_interest,
                education_level, grade, budget, notes,
                appointment_date, czech_time, turkey_time,
                start_utc, end_utc, calendar_event_id, ip_address, status, zoom_link, zoom_meeting_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'confirmed',$17,$18)
            RETURNING *`,
            [fullName, phone, email, targetCountry, fieldOfInterest,
             educationLevel, grade || null, budget || null, notes || null,
             date, czechTime, turkeyTime, startUTC, endUTC,
             calendarEventId || null, ip, zoomLink, zoomMeetingId]
        );

        await pool.query(`DELETE FROM appointment_verifications WHERE email = $1`, [email]);

        const appointment = result.rows[0];

        await Promise.all([
            sendConfirmationEmail(appointment).catch(e => console.error('Confirmation email failed:', e.message)),
            sendAdminNotificationEmail(appointment).catch(e => console.error('Admin notification failed:', e.message))
        ]);

        if (phone) {
            createContact(fullName, phone, email, 'student')
                .then(uid => { if (uid) console.log('Appointment contact saved to iCloud:', uid); })
                .catch(err => console.error('Appointment iCloud contact failed:', err.message));
        }

        res.json({ success: true, message: 'Randevunuz başarıyla oluşturuldu!', appointment: { id: appointment.id, date, turkeyTime } });
    } catch (error) {
        console.error('Create appointment error:', error);
        res.status(500).json({ success: false, message: 'Randevu oluşturulamadı. Lütfen tekrar deneyin.' });
    }
});

async function sendConfirmationEmail(apt) {
    try {
        const dateFormatted = new Date(apt.appointment_date).toLocaleDateString('tr-TR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const icsContent = generateICSForStudent(apt);

        await transporter.sendMail({
            from: `"VG Danışmanlık" <${emailUser}>`,
            to: apt.email,
            subject: `VG Danışmanlık - Randevu Onayı (${dateFormatted})`,
            html: emailWrapper(`
                <h2 class="email-text" style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">Randevunuz Onaylandı</h2>
                <p class="email-muted" style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
                    Merhaba <strong>${escapeHtml(apt.full_name)}</strong>, randevunuz başarıyla oluşturulmuştur.
                </p>
                <div class="info-box" style="background: #f0f7ff; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid #005A9E;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Tarih</td><td style="padding: 8px 0; font-weight: 600; color: #1a1a1a;">${dateFormatted}</td></tr>
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Saat (TR)</td><td style="padding: 8px 0; font-weight: 700; color: #005A9E; font-size: 20px;">${apt.turkey_time}</td></tr>
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Süre</td><td style="padding: 8px 0; color: #1a1a1a;">30 Dakika</td></tr>
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Hedef Ülke</td><td style="padding: 8px 0; color: #1a1a1a;">${escapeHtml(apt.target_country)}</td></tr>
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">İlgi Alanı</td><td style="padding: 8px 0; color: #1a1a1a;">${escapeHtml(apt.field_of_interest)}</td></tr>
                    </table>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <p style="color: #4b5563; font-size: 14px; margin-bottom: 15px;">Randevunuzu takviminize ekleyin:</p>
                    <a href="https://vgdanismanlik.com/api/appointments/calendar-download/${apt.id}" 
                       style="display: inline-block; background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                        Takvime Ekle
                    </a>
                </div>
                <div style="background: #f0f7ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0; color: #003d6b; font-size: 14px;">
                        <strong>Önemli:</strong> Toplantı linki randevu saatinizden önce ayrıca e-posta ile gönderilecektir. Randevunuzu iptal etmek veya değiştirmek için WhatsApp üzerinden bize ulaşın.
                    </p>
                </div>
                <div style="text-align: center; margin-top: 25px;">
                    <a href="https://wa.me/905399273008" style="display: inline-block; background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                        WhatsApp'tan Yazın
                    </a>
                </div>
            `),
            attachments: [{
                filename: 'randevu.ics',
                content: icsContent,
                contentType: 'text/calendar; charset=utf-8; method=PUBLISH'
            }]
        });
        console.log('Confirmation email sent to:', apt.email);
    } catch (err) {
        console.error('Confirmation email error:', err.message);
    }
}

async function sendAdminNotificationEmail(apt) {
    try {
        const dateFormatted = new Date(apt.appointment_date).toLocaleDateString('tr-TR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        await transporter.sendMail({
            from: `"VG Danışmanlık Randevu" <${emailUser}>`,
            to: ADMIN_EMAIL,
            subject: `Yeni Randevu: ${apt.full_name} - ${dateFormatted} ${apt.turkey_time}`,
            html: emailWrapper(`
                <h2 class="email-text" style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">Yeni Randevu Talebi</h2>
                <p class="email-muted" style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
                    Yeni bir danışmanlık randevusu oluşturuldu ve <strong>iCloud takviminize otomatik olarak eklendi</strong>.
                </p>
                <div class="info-box" style="background: #f0f7ff; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid #005A9E;">
                    <h3 style="margin: 0 0 16px 0; color: #005A9E; font-size: 16px;">Öğrenci Bilgileri</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">Ad Soyad</td><td style="padding: 8px 0; font-weight: 600; color: #1a1a1a;">${escapeHtml(apt.full_name)}</td></tr>
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">WhatsApp</td><td style="padding: 8px 0;">${apt.phone ? `<a href="https://wa.me/${apt.phone.replace(/\D/g, '')}" style="color: #25D366; text-decoration: none;">${formatPhoneHtml(apt.phone)}</a>` : '<span style="color: #9ca3af;">Belirtilmedi</span>'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">E-posta</td><td style="padding: 8px 0;"><a href="mailto:${escapeHtml(apt.email)}" style="color: #005A9E; text-decoration: none;">${escapeHtml(apt.email)}</a></td></tr>
                    </table>
                </div>
                <div class="info-box" style="background: #f0f7ff; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid #005A9E;">
                    <h3 style="margin: 0 0 16px 0; color: #005A9E; font-size: 16px;">Randevu Detayları</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">Tarih</td><td style="padding: 8px 0; font-weight: 600; color: #1a1a1a;">${dateFormatted}</td></tr>
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Saat (TR)</td><td style="padding: 8px 0; font-weight: 700; color: #005A9E; font-size: 18px;">${apt.turkey_time}</td></tr>
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Saat (CZ)</td><td style="padding: 8px 0; color: #1a1a1a;">${apt.czech_time}</td></tr>
                    </table>
                </div>
                <div class="info-box" style="background: #f0f7ff; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid #005A9E;">
                    <h3 style="margin: 0 0 16px 0; color: #005A9E; font-size: 16px;">Danışmanlık Detayları</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">Hedef Ülke</td><td style="padding: 8px 0; font-weight: 600; color: #1a1a1a;">${escapeHtml(apt.target_country)}</td></tr>
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">İlgi Alanı</td><td style="padding: 8px 0; color: #1a1a1a;">${escapeHtml(apt.field_of_interest)}</td></tr>
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Eğitim Seviyesi</td><td style="padding: 8px 0; color: #1a1a1a;">${escapeHtml(apt.education_level)}${apt.grade ? ' - ' + escapeHtml(apt.grade) + '. Sınıf' : ''}</td></tr>
                        ${apt.budget ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Bütçe Aralığı</td><td style="padding: 8px 0; color: #1a1a1a;">${escapeHtml(apt.budget)}</td></tr>` : ''}
                        ${apt.notes ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Notlar</td><td style="padding: 8px 0; color: #1a1a1a;">${escapeHtml(apt.notes)}</td></tr>` : ''}
                    </table>
                </div>
                ${apt.calendar_event_id ? `
                <div style="background: #f0f7ff; border-radius: 8px; padding: 12px 16px; margin: 20px 0;">
                    <p style="margin: 0; color: #005A9E; font-size: 14px;">iCloud takvimine başarıyla eklendi (ID: ${apt.calendar_event_id})</p>
                </div>` : `
                <div style="background: #fce8e8; border-radius: 8px; padding: 12px 16px; margin: 20px 0;">
                    <p style="margin: 0; color: #991b1b; font-size: 14px;">iCloud takvim kaydı oluşturulamadı - lütfen manuel olarak ekleyin.</p>
                </div>`}
                <div style="text-align: center; margin-top: 25px;">
                    <a href="https://vgdanismanlik.com/admin/appointments" style="display: inline-block; background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                        Admin Panelinde Görüntüle
                    </a>
                </div>
            `)
        });
        console.log('Admin notification email sent to:', ADMIN_EMAIL);
    } catch (err) {
        console.error('Admin notification email error:', err.message);
    }
}

router.get('/calendar-download/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id < 1) return res.status(400).send('Invalid ID');
        const result = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Not found');
        }
        const apt = result.rows[0];
        const icsContent = generateICSForStudent(apt);
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="vg-randevu-${id}.ics"`);
        res.send(icsContent);
    } catch (error) {
        console.error('Calendar download error:', error);
        res.status(500).send('Error');
    }
});

async function sendZoomInvitationEmail(apt) {
    try {
        const isPro = apt.meeting_type === 'professional';
        const dateFormatted = new Date(apt.appointment_date).toLocaleDateString('tr-TR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const icsContent = generateICSForStudent(apt);
        const greeting = isPro
            ? `Sayın <strong>${escapeHtml(apt.full_name)}</strong>, görüşmeniz için toplantı linki oluşturuldu.`
            : `Merhaba <strong>${escapeHtml(apt.full_name)}</strong>, danışmanlık görüşmeniz için toplantı linki oluşturuldu.`;

        await transporter.sendMail({
            from: `"VG Danışmanlık" <${emailUser}>`,
            to: apt.email,
            subject: `VG Danışmanlık - Toplantı Davetiniz (${dateFormatted})`,
            html: emailWrapper(`
                <h2 class="email-text" style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">Toplantı Linkiniz Hazır</h2>
                <p class="email-muted" style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
                    ${greeting}
                </p>
                <div class="info-box" style="background: #f0f7ff; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid #005A9E;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Tarih</td><td style="padding: 8px 0; font-weight: 600; color: #1a1a1a;">${dateFormatted}</td></tr>
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Saat (TR)</td><td style="padding: 8px 0; font-weight: 700; color: #005A9E; font-size: 20px;">${apt.turkey_time}</td></tr>
                        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Süre</td><td style="padding: 8px 0; color: #1a1a1a;">30 Dakika</td></tr>
                    </table>
                </div>
                <div style="text-align: center; margin: 35px 0;">
                    <a href="${apt.zoom_link}" 
                       style="display: inline-block; background: linear-gradient(135deg, #2D8CFF 0%, #0B5CFF 100%); color: white; padding: 18px 40px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 17px; box-shadow: 0 4px 15px rgba(45, 140, 255, 0.35);">
                        Zoom Toplantısına Katıl
                    </a>
                </div>
                <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
                    <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">Toplantı linki:</p>
                    <a href="${apt.zoom_link}" style="color: #005A9E; font-size: 14px; word-break: break-all;">${apt.zoom_link}</a>
                </div>
                <div style="text-align: center; margin: 20px 0;">
                    <a href="https://vgdanismanlik.com/api/appointments/calendar-download/${apt.id}" 
                       style="display: inline-block; background: #f0f7ff; color: #005A9E; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; border: 1px solid #005A9E;">
                        Takvime Ekle
                    </a>
                </div>
                <div style="background: #f0f7ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0; color: #003d6b; font-size: 14px;">
                        <strong>İpuçları:</strong><br>
                        &bull; Toplantıya 5 dakika erken katılmanızı öneririz.<br>
                        &bull; Bilgisayarınızda veya telefonunuzda Zoom uygulamasının yüklü olduğundan emin olun.<br>
                        &bull; Sessiz bir ortamda olmanız görüşmenin verimliliğini artıracaktır.
                    </p>
                </div>
                <div style="text-align: center; margin-top: 25px;">
                    <a href="https://wa.me/905399273008" style="display: inline-block; background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                        Sorularınız İçin WhatsApp
                    </a>
                </div>
            `),
            attachments: [{
                filename: 'randevu.ics',
                content: icsContent,
                contentType: 'text/calendar; charset=utf-8; method=PUBLISH'
            }]
        });
        console.log('Zoom invitation email sent to:', apt.email);
        return true;
    } catch (err) {
        console.error('Zoom invitation email error:', err.message);
        return false;
    }
}

router.post('/zoom-link', requireSuperAdmin, async (req, res) => {
    try {
        const { appointmentId, zoomLink } = req.body;
        if (!appointmentId || !Number.isInteger(Number(appointmentId)) || Number(appointmentId) < 1) {
            return res.status(400).json({ success: false, message: 'Geçersiz randevu ID.' });
        }
        if (!zoomLink) {
            return res.status(400).json({ success: false, message: 'Randevu ID ve Zoom linki gereklidir.' });
        }

        await pool.query('UPDATE appointments SET zoom_link = $1 WHERE id = $2', [zoomLink, appointmentId]);

        const result = await pool.query('SELECT * FROM appointments WHERE id = $1', [appointmentId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Randevu bulunamadı.' });
        }

        res.json({ success: true, message: 'Zoom linki kaydedildi.' });
    } catch (error) {
        console.error('Zoom link save error:', error);
        res.status(500).json({ success: false, message: 'Zoom linki kaydedilemedi.' });
    }
});

router.post('/send-zoom-invite', requireSuperAdmin, async (req, res) => {
    try {
        const { appointmentId } = req.body;
        if (!appointmentId || !Number.isInteger(Number(appointmentId)) || Number(appointmentId) < 1) {
            return res.status(400).json({ success: false, message: 'Geçersiz randevu ID.' });
        }
        const result = await pool.query('SELECT * FROM appointments WHERE id = $1', [appointmentId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Randevu bulunamadı.' });
        }
        const apt = result.rows[0];
        if (!apt.zoom_link) {
            return res.status(400).json({ success: false, message: 'Önce Zoom linki ekleyin.' });
        }

        const sent = await sendZoomInvitationEmail(apt);
        if (sent) {
            res.json({ success: true, message: 'Zoom davet maili gönderildi.' });
        } else {
            res.status(500).json({ success: false, message: 'Mail gönderilemedi.' });
        }
    } catch (error) {
        console.error('Send zoom invite error:', error);
        res.status(500).json({ success: false, message: 'Davet gönderilemedi.' });
    }
});

async function sendSatisfactionEmail(apt) {
    try {
        const isPro = apt.meeting_type === 'professional';
        const dateFormatted = new Date(apt.appointment_date).toLocaleDateString('tr-TR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const firstName = apt.full_name.split(' ')[0];

        const title = isPro
            ? `Teşekkür Ederiz, Sayın ${escapeHtml(apt.full_name)}!`
            : `Teşekkür Ederiz, ${escapeHtml(firstName)}!`;
        const bodyText = isPro
            ? `<strong>${dateFormatted}</strong> tarihindeki görüşmemizi tamamladık. Sizinle görüşmekten memnuniyet duyduk.`
            : `<strong>${dateFormatted}</strong> tarihindeki danışmanlık mülakatımızı tamamladık. Sizinle görüşmekten büyük memnuniyet duyduk.`;
        const memnunMsg = isPro
            ? encodeURIComponent('Merhaba, görüşme çok verimli geçti. Teşekkür ederim!')
            : encodeURIComponent('Merhaba, mülakatım çok verimli geçti. Teşekkür ederim!');
        const geriMsg = isPro
            ? encodeURIComponent('Merhaba, görüşmeyle ilgili geri bildirimim var.')
            : encodeURIComponent('Merhaba, mülakatımla ilgili geri bildirimim var.');

        const nextStepsHtml = isPro
            ? `<div class="info-box" style="background: #f0f7ff; border-radius: 12px; padding: 20px; margin: 24px 0;">
                    <p style="margin: 0 0 8px 0; color: #005A9E; font-weight: 600; font-size: 15px;">İletişim</p>
                    <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.8;">
                        Herhangi bir sorunuz veya ek görüşme talebiniz için bizimle WhatsApp üzerinden iletişime geçebilirsiniz.
                    </p>
                </div>`
            : `<div class="info-box" style="background: #f0f7ff; border-radius: 12px; padding: 20px; margin: 24px 0;">
                    <p style="margin: 0 0 8px 0; color: #005A9E; font-weight: 600; font-size: 15px;">Sonraki Adımlar</p>
                    <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.8;">
                        <li>Görüşmede belirlenen yol haritanıza göre gerekli belgeleri hazırlayın.</li>
                        <li>Sorularınız için WhatsApp üzerinden bize her zaman ulaşabilirsiniz.</li>
                        <li>Başvuru süreciniz hakkında sizi düzenli olarak bilgilendireceğiz.</li>
                    </ul>
                </div>`;

        await transporter.sendMail({
            from: `"VG Danışmanlık" <${emailUser}>`,
            to: apt.email,
            subject: `VG Danışmanlık - Görüşmemiz Nasıldı?`,
            html: emailWrapper(`
                <h2 class="email-text" style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">${title}</h2>
                <p class="email-muted" style="color: #4b5563; line-height: 1.7; margin-bottom: 20px;">
                    ${bodyText}
                </p>
                <div class="info-box" style="background: #f0f7ff; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #005A9E; text-align: center;">
                    <p style="margin: 0 0 12px 0; color: #005A9E; font-size: 16px; font-weight: 600;">Görüşmemiz işinize yaradı mı?</p>
                    <p style="margin: 0; color: #4b5563; font-size: 14px;">Geri bildiriminiz bizim için çok değerli. Hizmetimizi sürekli geliştirmek istiyoruz.</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                        <tr>
                            <td style="padding: 0 6px;">
                                <a href="https://wa.me/905399273008?text=${memnunMsg}" 
                                   style="display: inline-block; background: linear-gradient(135deg, #005A9E, #003d6b); color: white; padding: 14px 24px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px;">
                                    Çok Memnunum
                                </a>
                            </td>
                            <td style="padding: 0 6px;">
                                <a href="https://wa.me/905399273008?text=${geriMsg}" 
                                   style="display: inline-block; background: #f0f7ff; color: #005A9E; padding: 14px 24px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; border: 2px solid #005A9E;">
                                    Geri Bildirimim Var
                                </a>
                            </td>
                        </tr>
                    </table>
                </div>
                ${nextStepsHtml}
                <div style="text-align: center; margin-top: 25px;">
                    <a href="https://wa.me/905399273008" style="display: inline-block; background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                        WhatsApp'tan Yazın
                    </a>
                </div>
            `)
        });
        console.log('Satisfaction email sent to:', apt.email);
        return true;
    } catch (err) {
        console.error('Satisfaction email error:', err.message);
        return false;
    }
}

function requireSuperAdminOrCron(req, res, next) {
    if (res.locals.isLoggedIn && res.locals.isAdmin && res.locals.isSuperAdmin) return next();
    const cronSecret = process.env.CRON_SECRET;
    const provided = req.query.secret || req.headers['x-cron-secret'] || (req.headers['authorization'] || '').replace('Bearer ', '');
    if (cronSecret && provided === cronSecret) return next();
    return res.status(401).json({ success: false, message: 'Yetkiniz yok.' });
}

router.post('/send-test-emails', requireSuperAdminOrCron, async (req, res) => {
    try {
        const testApt = {
            id: 0,
            full_name: 'Test Öğrenci',
            phone: '+90 539 927 30 08',
            email: ADMIN_EMAIL,
            target_country: 'Çekya',
            field_of_interest: 'Tıp',
            education_level: 'Lise Öğrencisi',
            grade: '12',
            budget: '10.000-20.000€',
            notes: 'Bu bir test randevusudur.',
            appointment_date: new Date().toISOString().split('T')[0],
            czech_time: '18:00',
            turkey_time: '20:00',
            start_utc: new Date().toISOString(),
            end_utc: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            calendar_event_id: 'test-event-id-123',
            zoom_link: 'https://zoom.us/j/1234567890',
            status: 'confirmed',
            created_at: new Date().toISOString()
        };

        const results = [];

        try {
            await sendConfirmationEmail(testApt);
            results.push('OK - Onay maili gonderildi');
        } catch (e) { results.push('HATA - Onay maili: ' + e.message); }

        try {
            await sendAdminNotificationEmail(testApt);
            results.push('OK - Admin bilgilendirme maili gonderildi');
        } catch (e) { results.push('HATA - Admin maili: ' + e.message); }

        try {
            await sendZoomInvitationEmail(testApt);
            results.push('OK - Zoom davet maili gonderildi');
        } catch (e) { results.push('HATA - Zoom maili: ' + e.message); }

        try {
            await sendSatisfactionEmail(testApt);
            results.push('OK - Memnuniyet maili gonderildi');
        } catch (e) { results.push('HATA - Memnuniyet maili: ' + e.message); }

        try {
            const code = '123456';
            const firstName = 'Test';
            await transporter.sendMail({
                from: `"VG Danışmanlık" <${emailUser}>`,
                to: ADMIN_EMAIL,
                subject: 'VG Danışmanlık - Test Doğrulama Kodu',
                html: emailWrapper(`
                    <h2 class="email-text" style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">Merhaba ${firstName},</h2>
                    <p class="email-muted" style="color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
                        Randevu talebiniz için doğrulama kodunuz aşağıdadır:
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <div style="display: inline-block; background: #f0f7ff; border: 2px solid #005A9E; border-radius: 12px; padding: 20px 40px;">
                            <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #005A9E;">${code}</span>
                        </div>
                    </div>
                    <p class="email-muted" style="color: #6b7280; font-size: 14px; text-align: center;">
                        Bu kod 10 dakika içinde geçerliliğini yitirecektir.
                    </p>
                `)
            });
            results.push('OK - Dogrulama kodu maili gonderildi');
        } catch (e) { results.push('HATA - Dogrulama maili: ' + e.message); }

        // --- Profesyonel Gorusme Test Mailleri ---
        const proTestApt = {
            id: 0,
            full_name: 'Test Profesyonel Katılımcı',
            phone: '+90 539 927 30 08',
            email: ADMIN_EMAIL,
            target_country: 'Profesyonel',
            field_of_interest: 'Profesyonel Görüşme',
            education_level: 'Profesyonel',
            notes: 'Bu bir test profesyonel görüşmesidir.',
            appointment_date: new Date().toISOString().split('T')[0],
            czech_time: '18:00',
            turkey_time: '20:00',
            start_utc: new Date().toISOString(),
            end_utc: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            calendar_event_id: 'test-event-pro-123',
            zoom_link: 'https://zoom.us/j/9876543210',
            status: 'confirmed',
            meeting_type: 'professional',
            created_at: new Date().toISOString()
        };

        try {
            await sendZoomInvitationEmail(proTestApt);
            results.push('OK - PRO Zoom davet maili gonderildi');
        } catch (e) { results.push('HATA - PRO Zoom maili: ' + e.message); }

        try {
            await sendSatisfactionEmail(proTestApt);
            results.push('OK - PRO Memnuniyet maili gonderildi');
        } catch (e) { results.push('HATA - PRO Memnuniyet maili: ' + e.message); }

        // --- Randevu Düzenleme Test Mailleri ---
        try {
            const getEditSignature = () => `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;"><p style="margin: 0 0 15px 0; color: #333; font-style: italic; font-weight: 500;">Kind Regards,</p><p style="margin: 0 0 3px 0;"><a href="https://vgdanismanlik.com" style="color: #2563eb; text-decoration: underline; font-weight: bold; font-style: italic;">vgdanismanlik.com</a></p><p style="margin: 0 0 3px 0; color: #1a365d; font-weight: bold; font-style: italic;">CZ: +420 776 791 541</p><p style="margin: 0 0 20px 0; color: #1a365d; font-weight: bold; font-style: italic;">TR: +90 539 927 30 08</p><table cellpadding="0" cellspacing="0" border="0" style="margin-top: 15px;"><tr><td style="vertical-align: middle; padding-right: 15px;"><img src="https://vgdanismanlik.com/images/logos/01-1%20copy.png" alt="VG Danışmanlık" style="height: 80px; width: auto;"></td><td style="vertical-align: middle;"><p style="margin: 0; color: #1e40af; font-size: 18px; font-weight: bold;">VG DANIŞMANLIK</p><p style="margin: 0; color: #3b82f6; font-size: 14px; font-weight: 600;">YURT DIŞI EĞİTİM</p></td></tr></table></div>`;
            const editEmailWrapper = (content) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light dark"><style>@media (prefers-color-scheme: dark) { .email-body { background-color: #1a1a2e !important; } .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; } .email-text { color: #e0e0e0 !important; } .email-muted { color: #a0a0b0 !important; } .info-box { background-color: #1a2744 !important; } }</style></head><body style="margin: 0; padding: 0;"><div class="email-body" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;"><div style="background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;"><h1 style="margin: 0; font-size: 24px; font-weight: 700;">VG Danışmanlık</h1><p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Yurt Dışı Eğitim Danışmanlığı</p></div><div class="email-card" style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">${content}${getEditSignature()}</div></div></body></html>`;

            // Test 1: Date/time change email
            await transporter.sendMail({
                from: `"VG Danışmanlık" <${emailUser}>`,
                to: ADMIN_EMAIL,
                subject: 'VG Danışmanlık - [TEST] Randevu Tarihi Değişikliği',
                html: editEmailWrapper(`
                    <h2 class="email-text" style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">
                        <i style="color: #f59e0b;">⚠</i> Randevu Tarih/Saat Değişikliği
                    </h2>
                    <p class="email-muted" style="color: #4b5563; line-height: 1.7; margin-bottom: 20px;">
                        Merhaba <strong>Test</strong>, randevunuzun tarih ve/veya saati güncellenmiştir.
                    </p>
                    <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0 0 8px 0; color: #92400e; font-weight: 700; font-size: 13px; text-transform: uppercase;">Eski Tarih/Saat</p>
                        <p style="margin: 0; color: #92400e; font-size: 15px; text-decoration: line-through;">15 Mart 2026 Pazar — 20:00 (TSİ)</p>
                    </div>
                    <div style="background: #d1fae5; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #059669;">
                        <p style="margin: 0 0 8px 0; color: #065f46; font-weight: 700; font-size: 13px; text-transform: uppercase;">Yeni Tarih/Saat</p>
                        <p style="margin: 0; color: #065f46; font-size: 18px; font-weight: 700;">18 Mart 2026 Çarşamba — 21:00 (TSİ)</p>
                    </div>
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="https://zoom.us/j/1234567890" style="display: inline-block; background: linear-gradient(135deg, #2D8CFF, #0B5CFF); color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px;">Zoom Toplantısına Katıl</a>
                    </div>
                    <div style="background: #f0f7ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
                        <p style="margin: 0; color: #003d6b; font-size: 14px;">
                            <strong>Not:</strong> Toplantı linki görüşmeden 30 dakika önce ayrıca e-posta ile gönderilecektir. Değişiklikle ilgili sorularınız için bizimle iletişime geçebilirsiniz.
                        </p>
                    </div>
                    <div style="text-align: center; margin-top: 25px;">
                        <a href="https://wa.me/905399273008" style="display: inline-block; background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">WhatsApp ile İletişim</a>
                    </div>
                `)
            });
            results.push('OK - Tarih degisikligi test maili gonderildi');

            // Test 2: Details change email
            await transporter.sendMail({
                from: `"VG Danışmanlık" <${emailUser}>`,
                to: ADMIN_EMAIL,
                subject: 'VG Danışmanlık - [TEST] Randevu Bilgileri Güncellendi',
                html: editEmailWrapper(`
                    <h2 class="email-text" style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">
                        Randevu Bilgileri Güncellendi
                    </h2>
                    <p class="email-muted" style="color: #4b5563; line-height: 1.7; margin-bottom: 20px;">
                        Merhaba <strong>Test</strong>, randevunuza ait bazı bilgiler güncellenmiştir.
                    </p>
                    <div style="background: #f0f7ff; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid #005A9E;">
                        <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px;">Güncellenen Alanlar</p>
                        <p style="margin: 0; color: #005A9E; font-weight: 700;">Hedef Ülke, Not</p>
                    </div>
                    <div style="background: #f0f7ff; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid #005A9E;">
                        <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;">Tarih</td><td style="padding: 8px 0; font-weight: 600; color: #1a1a1a;">15 Mart 2026 Pazar</td></tr>
                            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Saat</td><td style="padding: 8px 0; font-weight: 700; color: #005A9E; font-size: 18px;">20:00 (TSİ)</td></tr>
                        </table>
                    </div>
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="https://zoom.us/j/1234567890" style="display: inline-block; background: linear-gradient(135deg, #2D8CFF, #0B5CFF); color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px;">Zoom Toplantısına Katıl</a>
                    </div>
                    <div style="text-align: center; margin-top: 25px;">
                        <a href="https://wa.me/905399273008" style="display: inline-block; background: linear-gradient(135deg, #005A9E 0%, #003d6b 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">WhatsApp ile İletişim</a>
                    </div>
                `)
            });
            results.push('OK - Bilgi guncelleme test maili gonderildi');
        } catch (e) {
            results.push('HATA - Edit test mailleri: ' + e.message);
        }

        res.json({ success: true, message: 'Test mailleri gönderildi', results });
    } catch (error) {
        console.error('Test emails error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
