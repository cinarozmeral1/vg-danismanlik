#!/usr/bin/env node
require('dotenv').config();
const path = require('path');
const nodemailer = require('nodemailer');

const emailUser = (process.env.EMAIL_USER || 'ventureglobaldanisma@gmail.com').trim().replace(/\\n/g, '').replace(/\n/g, '');
const emailPass = (process.env.EMAIL_PASS || 'msdu gdlm cbfq tttc').trim().replace(/\\n/g, '').replace(/\n/g, '');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass },
    tls: { rejectUnauthorized: false },
});

const FROM = 'VG Danışmanlık <ventureglobaldanisma@gmail.com>';
const TO   = 'info@vgdanismanlik.com';

const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f5f7fb;color:#222;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:30px 0;">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);">

      <tr><td style="background:linear-gradient(135deg,#1e40af 0%,#2563eb 100%);padding:30px 40px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
          Google Ads — DSA Blog Kampanyası Hazır
        </h1>
        <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;">
          306 makale için tek tıkla import edilen kampanya dosyaları
        </p>
      </td></tr>

      <tr><td style="padding:30px 40px;">

        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
          Merhaba,<br><br>
          Bu mailde Google Ads'e yükleyeceğiniz <strong>2 dosya</strong> ek olarak gönderilmiştir.
          Aşağıdaki adımları sırayla takip ederek <strong>15 dakikada</strong> 306 blog makalenizi
          reklamla canlıya alabilirsiniz.
        </p>

        <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:16px 20px;border-radius:6px;margin:20px 0;">
          <p style="margin:0;font-size:14px;color:#1e40af;font-weight:600;">EKLER</p>
          <ul style="margin:8px 0 0;padding-left:20px;color:#1e40af;font-size:14px;line-height:1.6;">
            <li><strong>blog-page-feed.csv</strong> — 306 makale URL'i (ülke/alan/seviye etiketli)</li>
            <li><strong>dsa-blog-campaign.csv</strong> — Komple kampanya: ad group + reklam + 6 sitelink + 6 callout + 15 negatif KW</li>
          </ul>
        </div>

        <h2 style="margin:30px 0 12px;font-size:18px;color:#111827;">Kurulum (3 adım, 15 dk)</h2>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
          <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:18px 20px;">
            <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">ADIM 1 · 5 DK</div>
            <div style="font-size:16px;font-weight:600;color:#111827;margin-bottom:8px;">Page Feed yükle</div>
            <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#374151;">
              <li>Google Ads → <strong>Tools & Settings → Setup → Business data</strong></li>
              <li>Üstte <strong>+</strong> butonu → <strong>Page feed</strong></li>
              <li>Feed name: <code style="background:#fff;padding:2px 6px;border-radius:4px;border:1px solid #e5e7eb;">Blog Articles - 306 URLs</code></li>
              <li><strong>blog-page-feed.csv</strong> dosyasını yükle → Apply</li>
            </ol>
          </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
          <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:18px 20px;">
            <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">ADIM 2 · 5 DK</div>
            <div style="font-size:16px;font-weight:600;color:#111827;margin-bottom:8px;">Google Ads Editor'ü indir</div>
            <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#374151;">
              <li>İndir: <a href="https://ads.google.com/intl/tr_tr/home/tools/ads-editor/" style="color:#2563eb;">ads.google.com/intl/tr_tr/home/tools/ads-editor</a></li>
              <li>Yükledikten sonra Google hesabınızla giriş yapın → Veture hesabınızı seçin</li>
              <li><strong>Get recent changes</strong> ile mevcut kampanyaları indirin</li>
            </ol>
          </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
          <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:18px 20px;">
            <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">ADIM 3 · 5 DK</div>
            <div style="font-size:16px;font-weight:600;color:#111827;margin-bottom:8px;">Kampanyayı import et</div>
            <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#374151;">
              <li>Editor'de üst menü <strong>Account → Import → From file</strong></li>
              <li><strong>dsa-blog-campaign.csv</strong> dosyasını seçin</li>
              <li>Önizlemeyi inceleyin (1 kampanya, 1 ad group, 1 reklam, 6 sitelink, 6 callout, 15 negatif KW görünmeli)</li>
              <li>Sağ üstten <strong>Post Changes</strong> → onaylayın</li>
              <li>5 dakika içinde Google Ads paneline yansıyacak</li>
            </ol>
          </td></tr>
        </table>

        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:6px;margin:30px 0 20px;">
          <p style="margin:0 0 8px;font-size:14px;color:#92400e;font-weight:600;">⚡ Neden bu yöntem?</p>
          <p style="margin:0;font-size:13px;color:#78350f;line-height:1.6;">
            306 makaleyi tek tek el ile reklam yapmak <strong>imkânsız</strong>. Dynamic Search Ads (DSA)
            sayfalarınızı otomatik tarar, kullanıcı arama yaptığında <strong>sayfa başlığını otomatik üretir</strong>.
            Tek bir kampanya 306 makalenin hepsini eş zamanlı reklamlar.
          </p>
        </div>

        <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:16px 20px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 8px;font-size:14px;color:#065f46;font-weight:600;">📈 Beklenen sonuç (200 TL/gün × 30 gün)</p>
          <ul style="margin:0;padding-left:20px;font-size:13px;color:#064e3b;line-height:1.7;">
            <li>Aylık <strong>~6.500 tıklama</strong> (makale başı 21 tıklama)</li>
            <li>Yeni makale Google index'ine girmesi: <strong>4 hafta → 2 gün</strong></li>
            <li>Form başvurusu (%1 dönüşüm): <strong>~65/ay</strong></li>
          </ul>
        </div>

        <p style="margin:30px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
          Takıldığınız bir adım olursa veya import sırasında uyarı alırsanız ekran görüntüsü
          gönderin, hemen çözeriz. Bu kampanya canlı olduktan sonra İspanya, Fransa ve
          mevcut yüksek performanslı ad group'ların yeni varyantlarına geçeceğiz.
        </p>

      </td></tr>

      <tr><td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">
          VG DANIŞMANLIK YURT DIŞI EĞİTİM<br>
          vgdanismanlik.com · info@vgdanismanlik.com
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>
`;

async function main() {
    console.log('Sending email...');
    const result = await transporter.sendMail({
        from: FROM,
        to: TO,
        subject: 'Google Ads — DSA Blog Kampanyası (2 dosya, 15 dk kurulum)',
        html,
        attachments: [
            {
                filename: 'blog-page-feed.csv',
                path: path.join(__dirname, '..', 'reports', 'google-ads', 'blog-page-feed.csv'),
            },
            {
                filename: 'dsa-blog-campaign.csv',
                path: path.join(__dirname, '..', 'reports', 'google-ads', 'dsa-blog-campaign.csv'),
            },
        ],
    });
    console.log('✓ Sent:', result.messageId);
    console.log('  To:  ', TO);
    console.log('  From:', emailUser);
}

main().catch(err => {
    console.error('✗ Failed:', err.message);
    process.exit(1);
});
