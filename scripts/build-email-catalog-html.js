const fs = require('fs');
const path = require('path');

const logoPath = path.resolve(__dirname, '../public/images/logos/01-1 copy.png');
const logoB64 = fs.readFileSync(logoPath).toString('base64');
const LOGO_URL = `data:image/png;base64,${logoB64}`;

function signature() {
    return `<div style="margin-top:30px;padding-top:15px;border-top:1px solid #e0e0e0;">
        <p style="margin:0 0 10px;color:#333;font-style:italic;font-weight:500;">Kind Regards,</p>
        <p style="margin:0 0 3px;"><a href="https://vgdanismanlik.com" style="color:#2563eb;text-decoration:underline;font-weight:bold;font-style:italic;">vgdanismanlik.com</a></p>
        <p style="margin:0 0 3px;color:#1a365d;font-weight:bold;font-style:italic;">CZ: +420 776 791 541</p>
        <p style="margin:0 0 15px;color:#1a365d;font-weight:bold;font-style:italic;">TR: +90 539 927 30 08</p>
        <table cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="vertical-align:middle;padding-right:12px;"><img src="${LOGO_URL}" alt="VG Danışmanlık" style="height:60px;width:auto;"></td>
            <td style="vertical-align:middle;">
                <p style="margin:0;color:#1e40af;font-size:15px;font-weight:bold;">VG DANIŞMANLIK <sup style="font-size:8px;">®</sup></p>
                <p style="margin:0;color:#3b82f6;font-size:12px;font-weight:600;">YURT DIŞI EĞİTİM</p>
            </td>
        </tr></table>
    </div>`;
}

function emailCard(subject, to, body) {
    return `<div style="background:linear-gradient(135deg,#005A9E 0%,#003d6b 100%);color:#fff;padding:20px;text-align:center;border-radius:10px 10px 0 0;">
        <h2 style="margin:0;font-size:18px;font-weight:700;">VG Danışmanlık</h2>
        <p style="margin:5px 0 0;opacity:0.9;font-size:12px;">Yurt Dışı Eğitim Danışmanlığı</p>
    </div>
    <div style="background:#fff;padding:20px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;border-top:none;">
        <div style="margin-bottom:12px;padding:8px 12px;background:#f0f7ff;border-radius:6px;font-size:11px;">
            <strong>Konu:</strong> ${subject}<br>
            <strong>Alıcı:</strong> ${to}
        </div>
        ${body}
        ${signature()}
    </div>`;
}

function simpleCard(subject, to, body) {
    return `<div style="background:linear-gradient(135deg,#0078D7 0%,#005A9E 100%);color:#fff;padding:20px;text-align:center;border-radius:10px 10px 0 0;">
        <h2 style="margin:0;font-size:18px;font-weight:700;">VG Danışmanlık</h2>
        <p style="margin:5px 0 0;opacity:0.9;font-size:12px;">İç Bildirim</p>
    </div>
    <div style="background:#f8f9fa;padding:20px;border-radius:0 0 10px 10px;">
        <div style="margin-bottom:12px;padding:8px 12px;background:#e8f4fd;border-radius:6px;font-size:11px;">
            <strong>Konu:</strong> ${subject}<br>
            <strong>Alıcı:</strong> ${to}
        </div>
        ${body}
        <p style="color:#999;font-size:11px;text-align:center;margin-top:20px;">VG Danışmanlık - Avrupa Üniversite ve Dil Okulu Danışmanlığı</p>
    </div>`;
}

const emails = [
    {
        category: 'ÖĞRENCİ MAİLLERİ',
        items: [
            {
                title: '1. E-posta Doğrulama',
                subject: 'VG Danışmanlık - E-posta Doğrulama',
                to: 'Öğrenci (kayıt olan)',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">E-posta Adresinizi Doğrulayın</h3>
                    <p style="color:#4b5563;font-size:13px;">Merhaba <strong>Ahmet</strong>,</p>
                    <p style="color:#4b5563;font-size:13px;">VG Danışmanlık hesabınızı aktifleştirmek için aşağıdaki butona tıklayın:</p>
                    <div style="text-align:center;margin:20px 0;"><a href="#" style="display:inline-block;background:linear-gradient(135deg,#005A9E,#003d6b);color:#fff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:700;">E-postamı Doğrula</a></div>
                    <p style="color:#9ca3af;font-size:11px;text-align:center;">Bu link 24 saat içinde geçerliliğini yitirecektir.</p>`
            },
            {
                title: '2. Şifre Sıfırlama',
                subject: 'VG Danışmanlık - Şifre Sıfırlama',
                to: 'Öğrenci',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">Şifre Sıfırlama Talebi</h3>
                    <p style="color:#4b5563;font-size:13px;">Merhaba <strong>Ahmet</strong>,</p>
                    <p style="color:#4b5563;font-size:13px;">Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:</p>
                    <div style="text-align:center;margin:20px 0;"><a href="#" style="display:inline-block;background:linear-gradient(135deg,#005A9E,#003d6b);color:#fff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:700;">Şifremi Sıfırla</a></div>`
            },
            {
                title: '3. Başvuru Oluşturuldu',
                subject: 'VG Danışmanlık - Başvurunuz Oluşturuldu',
                to: 'Öğrenci',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">Başvurunuz Oluşturuldu!</h3>
                    <p style="color:#4b5563;font-size:13px;">Merhaba <strong>Ahmet</strong>,</p>
                    <p style="color:#4b5563;font-size:13px;">Charles University - Bilgisayar Bilimleri programına başvurunuz başarıyla oluşturulmuştur.</p>
                    <div style="background:#f0f7ff;border-radius:8px;padding:15px;margin:15px 0;border-left:3px solid #005A9E;">
                        <p style="margin:4px 0;font-size:12px;"><strong>Üniversite:</strong> Charles University</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Program:</strong> Bilgisayar Bilimleri</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Durum:</strong> <span style="color:#f59e0b;font-weight:600;">Beklemede</span></p>
                    </div>`
            },
            {
                title: '4. Başvuru Durumu Güncellendi',
                subject: 'VG Danışmanlık - Başvuru Durumu Güncellendi: Onaylandı',
                to: 'Öğrenci',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">Başvuru Durumu Güncellendi</h3>
                    <p style="color:#4b5563;font-size:13px;">Merhaba <strong>Ahmet</strong>,</p>
                    <p style="color:#4b5563;font-size:13px;">Charles University başvurunuzun durumu güncellendi.</p>
                    <div style="background:#ecfdf5;border-radius:8px;padding:15px;margin:15px 0;border-left:3px solid #10b981;">
                        <p style="margin:0;font-size:14px;font-weight:600;color:#065f46;">✅ Onaylandı</p>
                    </div>`
            },
            {
                title: '5. Vize Başvuru Durumu',
                subject: 'Vize Başvurunuz - Çekya - KABUL EDİLDİ',
                to: 'Öğrenci',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">Vize Başvuru Durumu</h3>
                    <p style="color:#4b5563;font-size:13px;">Merhaba <strong>Ahmet</strong>,</p>
                    <p style="color:#4b5563;font-size:13px;">Çekya vize başvurunuzla ilgili güncelleme:</p>
                    <div style="background:#ecfdf5;border-radius:8px;padding:15px;margin:15px 0;border-left:3px solid #10b981;">
                        <p style="margin:0;font-size:14px;font-weight:600;color:#065f46;">🎉 KABUL EDİLDİ</p>
                    </div>`
            },
            {
                title: '6. Profil Tamamlama Hatırlatıcısı',
                subject: '⚠️ VG Danışmanlık - Profil Bilgilerinizi Tamamlayın',
                to: 'Öğrenci (eksik profil)',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">Profilinizi Tamamlayın</h3>
                    <p style="color:#4b5563;font-size:13px;">Merhaba <strong>Ahmet</strong>,</p>
                    <p style="color:#4b5563;font-size:13px;">Hesabınızdaki bazı bilgiler eksik. Başvuru sürecinizi hızlandırmak için profilinizi tamamlayın.</p>
                    <div style="background:#fffbeb;border-radius:8px;padding:15px;margin:15px 0;border-left:3px solid #f59e0b;">
                        <p style="margin:0;font-size:12px;color:#92400e;"><strong>Eksik:</strong> Veli bilgileri, pasaport numarası</p>
                    </div>
                    <div style="text-align:center;margin:20px 0;"><a href="#" style="display:inline-block;background:linear-gradient(135deg,#005A9E,#003d6b);color:#fff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:700;">Profilimi Tamamla</a></div>`
            }
        ]
    },
    {
        category: 'RANDEVU MAİLLERİ',
        items: [
            {
                title: '7. Randevu Doğrulama Kodu',
                subject: 'VG Danışmanlık - Randevu Doğrulama Kodu',
                to: 'Randevu alan kişi',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">Randevu Doğrulama Kodu</h3>
                    <p style="color:#4b5563;font-size:13px;">Merhaba,</p>
                    <p style="color:#4b5563;font-size:13px;">Randevu oluşturmak için doğrulama kodunuz:</p>
                    <div style="text-align:center;margin:20px 0;background:#f0f7ff;padding:20px;border-radius:10px;">
                        <span style="font-size:32px;font-weight:800;color:#005A9E;letter-spacing:8px;">4 8 2 7 1 5</span>
                    </div>
                    <p style="color:#9ca3af;font-size:11px;text-align:center;">Bu kod 10 dakika içinde geçerliliğini yitirecektir.</p>`
            },
            {
                title: '8. Randevu Onayı',
                subject: 'VG Danışmanlık - Randevu Onayı (7 Nisan 2026 Salı)',
                to: 'Randevu alan kişi (öğrenci / kayıtsız)',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">Randevunuz Onaylandı</h3>
                    <p style="color:#4b5563;font-size:13px;">Merhaba <strong>Ahmet</strong>, randevunuz başarıyla oluşturulmuştur.</p>
                    <div style="background:#f0f7ff;border-radius:8px;padding:15px;margin:15px 0;border-left:3px solid #005A9E;">
                        <p style="margin:4px 0;font-size:12px;"><strong>Tarih:</strong> 7 Nisan 2026, Salı</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Saat (TR):</strong> <span style="color:#005A9E;font-weight:700;font-size:16px;">14:00</span></p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Süre:</strong> 30 Dakika</p>
                    </div>
                    <div style="text-align:center;margin:20px 0;"><a href="#" style="display:inline-block;background:linear-gradient(135deg,#2D8CFF,#0B5CFF);color:#fff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:700;">Zoom Toplantısına Katıl</a></div>`
            },
            {
                title: '9. Zoom Toplantı Daveti',
                subject: 'VG Danışmanlık - Toplantı Davetiniz (7 Nisan 2026 Salı)',
                to: 'Randevu katılımcısı',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">Toplantı Davetiniz</h3>
                    <p style="color:#4b5563;font-size:13px;">Merhaba <strong>Ahmet</strong>,</p>
                    <p style="color:#4b5563;font-size:13px;">Danışmanlık görüşmeniz için Zoom linkiniz hazır.</p>
                    <div style="background:#f0f7ff;border-radius:8px;padding:15px;margin:15px 0;border-left:3px solid #005A9E;">
                        <p style="margin:4px 0;font-size:12px;"><strong>Tarih:</strong> 7 Nisan 2026, Salı</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Saat:</strong> 14:00 (Türkiye Saati)</p>
                    </div>
                    <div style="text-align:center;margin:20px 0;"><a href="#" style="display:inline-block;background:linear-gradient(135deg,#2D8CFF,#0B5CFF);color:#fff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:700;">Toplantıya Katıl</a></div>`
            },
            {
                title: '10. Zoom 30dk Hatırlatma (Cron)',
                subject: 'VG Danışmanlık - Görüşmeniz 30 Dakika İçinde Başlıyor!',
                to: 'Randevu katılımcısı',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">Merhaba Ahmet,</h3>
                    <p style="color:#4b5563;font-size:13px;">Danışmanlık görüşmeniz <strong>30 dakika içinde</strong> başlıyor.</p>
                    <div style="background:#f0f7ff;border-radius:8px;padding:15px;margin:15px 0;border-left:3px solid #005A9E;">
                        <p style="margin:4px 0;font-size:12px;"><strong>Tarih:</strong> 7 Nisan 2026, Salı</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Saat:</strong> 14:00 (Türkiye Saati)</p>
                    </div>
                    <div style="text-align:center;margin:20px 0;"><a href="#" style="display:inline-block;background:linear-gradient(135deg,#2D8CFF,#0B5CFF);color:#fff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:700;">Toplantıya Katıl</a></div>
                    <div style="background:#fffbeb;border-radius:8px;padding:12px;margin:15px 0;border-left:3px solid #f59e0b;">
                        <p style="margin:0;color:#92400e;font-size:11px;"><strong>Hatırlatma:</strong> Lütfen toplantıya zamanında katılın. Ses ve kameranızın çalıştığından emin olun.</p>
                    </div>`
            },
            {
                title: '11. Görüşme Memnuniyet / Geri Bildirim',
                subject: 'VG Danışmanlık - Görüşmemiz Nasıldı?',
                to: 'Randevu katılımcısı (görüşme sonrası)',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">Görüşmemiz Nasıldı?</h3>
                    <p style="color:#4b5563;font-size:13px;">Merhaba <strong>Ahmet</strong>,</p>
                    <p style="color:#4b5563;font-size:13px;">Danışmanlık görüşmemizin sizin için faydalı olduğunu umuyoruz. Deneyiminizi Google üzerinden paylaşabilirsiniz:</p>
                    <div style="text-align:center;margin:20px 0;"><a href="#" style="display:inline-block;background:#fbbc04;color:#1a1a1a;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:700;">⭐ Google'da Değerlendir</a></div>`
            },
            {
                title: '12. Randevu Tarih/Saat Değişikliği',
                subject: 'VG Danışmanlık - Randevu Tarihi Değişikliği',
                to: 'Randevu sahibi',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">Randevu Tarihi Değişikliği</h3>
                    <p style="color:#4b5563;font-size:13px;">Merhaba <strong>Ahmet</strong>,</p>
                    <p style="color:#4b5563;font-size:13px;">Randevunuzun tarihi güncellenmiştir.</p>
                    <div style="background:#fef2f2;border-radius:8px;padding:12px;margin:10px 0;border-left:3px solid #ef4444;">
                        <p style="margin:0;font-size:12px;"><strong>Eski:</strong> 5 Nisan 2026 - 10:00</p>
                    </div>
                    <div style="background:#ecfdf5;border-radius:8px;padding:12px;margin:10px 0;border-left:3px solid #10b981;">
                        <p style="margin:0;font-size:12px;"><strong>Yeni:</strong> 7 Nisan 2026 - 14:00</p>
                    </div>`
            },
            {
                title: '13. Randevu Bilgileri Güncellendi',
                subject: 'VG Danışmanlık - Randevu Bilgileri Güncellendi',
                to: 'Randevu sahibi',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">Randevu Bilgileri Güncellendi</h3>
                    <p style="color:#4b5563;font-size:13px;">Merhaba <strong>Ahmet</strong>,</p>
                    <p style="color:#4b5563;font-size:13px;">Randevunuzla ilgili bazı bilgiler güncellenmiştir. Güncel detaylar:</p>
                    <div style="background:#f0f7ff;border-radius:8px;padding:15px;margin:15px 0;border-left:3px solid #005A9E;">
                        <p style="margin:4px 0;font-size:12px;"><strong>Tarih:</strong> 7 Nisan 2026, Salı</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Saat:</strong> 14:00 (Türkiye Saati)</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Hedef Ülke:</strong> Çekya</p>
                    </div>`
            }
        ]
    },
    {
        category: 'PARTNER MAİLLERİ',
        items: [
            {
                title: '14. Partner Hesabı Doğrulama',
                subject: 'VG Danışmanlık - Partner Hesabı Doğrulama',
                to: 'Partner',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">Partner Hesabı Doğrulama</h3>
                    <p style="color:#4b5563;font-size:13px;">Merhaba <strong>Nursima</strong>,</p>
                    <p style="color:#4b5563;font-size:13px;">VG Danışmanlık partner hesabınız oluşturulmuştur. Hesabınızı aktifleştirmek için aşağıdaki butona tıklayın:</p>
                    <div style="text-align:center;margin:20px 0;"><a href="#" style="display:inline-block;background:linear-gradient(135deg,#005A9E,#003d6b);color:#fff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:700;">Hesabımı Aktifleştir</a></div>`
            },
            {
                title: '15. Partner - Yeni Öğrenci Atandı',
                subject: 'VG Danışmanlık - Yeni Öğrenci Atandı',
                to: 'Partner',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">Yeni Öğrenci Atandı</h3>
                    <p style="color:#4b5563;font-size:13px;">Merhaba <strong>Nursima</strong>,</p>
                    <p style="color:#4b5563;font-size:13px;">Hesabınıza yeni bir öğrenci atanmıştır.</p>
                    <div style="background:#f0f7ff;border-radius:8px;padding:15px;margin:15px 0;border-left:3px solid #005A9E;">
                        <p style="margin:4px 0;font-size:12px;"><strong>Öğrenci:</strong> Ahmet Yılmaz</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>E-posta:</strong> ahmet@example.com</p>
                    </div>`
            },
            {
                title: '16. Partner - Yeni Kazanç Tanımlandı',
                subject: 'VG Danışmanlık - Yeni Kazanç Tanımlandı',
                to: 'Partner',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">Yeni Kazanç Tanımlandı</h3>
                    <p style="color:#4b5563;font-size:13px;">Merhaba <strong>Nursima</strong>,</p>
                    <p style="color:#4b5563;font-size:13px;">Hesabınıza yeni bir kazanç tanımlanmıştır.</p>
                    <div style="background:#ecfdf5;border-radius:8px;padding:15px;margin:15px 0;border-left:3px solid #10b981;">
                        <p style="margin:4px 0;font-size:12px;"><strong>Öğrenci:</strong> Ahmet Yılmaz</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Tutar:</strong> <span style="font-weight:700;color:#065f46;">150 EUR</span></p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Açıklama:</strong> Kabul sonrası komisyon</p>
                    </div>`
            },
            {
                title: '17. Partner - Komisyon Ödemesi Tamamlandı',
                subject: 'VG Danışmanlık - Komisyon Ödemeniz Tamamlandı',
                to: 'Partner',
                body: `<h3 style="color:#1a1a1a;font-size:16px;">Komisyon Ödemeniz Tamamlandı</h3>
                    <p style="color:#4b5563;font-size:13px;">Merhaba <strong>Nursima</strong>,</p>
                    <p style="color:#4b5563;font-size:13px;">Komisyon ödemeniz hesabınıza aktarılmıştır.</p>
                    <div style="background:#ecfdf5;border-radius:8px;padding:15px;margin:15px 0;border-left:3px solid #10b981;">
                        <p style="margin:4px 0;font-size:12px;"><strong>Öğrenci:</strong> Ahmet Yılmaz</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Tutar:</strong> <span style="font-weight:700;color:#065f46;">150 EUR</span></p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Ödeme Tarihi:</strong> 6 Nisan 2026</p>
                    </div>`
            }
        ]
    },
    {
        category: 'İÇ BİLDİRİM MAİLLERİ (Admine Giden)',
        items: [
            {
                title: '18. Yeni Öğrenci Kaydı Bildirimi',
                subject: '🆕 Yeni Öğrenci Kaydı - Ahmet Yılmaz (E-posta Kayıt)',
                to: 'info@vgdanismanlik.com (Admin)',
                isSimple: true,
                body: `<h3 style="color:#333;font-size:15px;">Yeni Öğrenci Kaydı</h3>
                    <div style="background:#fff;padding:15px;border-radius:8px;border-left:3px solid #0078D7;">
                        <p style="margin:4px 0;font-size:12px;"><strong>Ad Soyad:</strong> Ahmet Yılmaz</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>E-posta:</strong> ahmet@example.com</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Telefon:</strong> +905551234567</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Kayıt Yöntemi:</strong> E-posta</p>
                    </div>`
            },
            {
                title: '19. Yeni Randevu Bildirimi',
                subject: 'Yeni Randevu: Ahmet Yılmaz - 7 Nisan 2026 14:00',
                to: 'Admin (ADMIN_EMAIL)',
                isSimple: true,
                body: `<h3 style="color:#333;font-size:15px;">Yeni Randevu Geldi!</h3>
                    <div style="background:#fff;padding:15px;border-radius:8px;border-left:3px solid #0078D7;">
                        <p style="margin:4px 0;font-size:12px;"><strong>Ad Soyad:</strong> Ahmet Yılmaz</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Tarih:</strong> 7 Nisan 2026 Salı</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Saat:</strong> 14:00 (TR) / 13:00 (CZ)</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Hedef Ülke:</strong> Çekya</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Alan:</strong> Tıp</p>
                    </div>`
            },
            {
                title: '20. İletişim Formu Bildirimi',
                subject: 'Yeni İletişim Formu - VG Danışmanlık',
                to: 'Admin (EMAIL_USER)',
                isSimple: true,
                body: `<h3 style="color:#333;font-size:15px;">Yeni İletişim Formu Geldi!</h3>
                    <div style="background:#fff;padding:15px;border-radius:8px;border-left:3px solid #0078D7;">
                        <p style="margin:4px 0;font-size:12px;"><strong>Ad Soyad:</strong> Mehmet Kaya</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>E-posta:</strong> mehmet@example.com</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Telefon:</strong> +905559876543</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Mesaj:</strong></p>
                        <div style="background:#f8f9fa;padding:10px;border-radius:5px;font-size:12px;">Almanya'da tıp okumak istiyorum, detaylı bilgi alabilir miyim?</div>
                    </div>`
            },
            {
                title: '21. Eğitim Değerlendirme Formu Bildirimi',
                subject: 'Yeni Eğitim Değerlendirme Formu - VG Danışmanlık',
                to: 'Admin (EMAIL_USER)',
                isSimple: true,
                body: `<h3 style="color:#333;font-size:15px;">Yeni Eğitim Değerlendirme Formu</h3>
                    <div style="background:#fff;padding:15px;border-radius:8px;border-left:3px solid #0078D7;">
                        <p style="margin:4px 0;font-size:12px;"><strong>Ad Soyad:</strong> Elif Demir</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>E-posta:</strong> elif@example.com</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Hedef Ülke:</strong> İtalya</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Alan:</strong> Mimarlık</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Not Ortalaması:</strong> 85/100</p>
                    </div>`
            },
            {
                title: '22. Kariyer Başvurusu Bildirimi',
                subject: 'Yeni Kariyer Başvurusu - Can Özkan',
                to: 'info@vgdanismanlik.com',
                isSimple: true,
                body: `<h3 style="color:#333;font-size:15px;">Yeni Kariyer Başvurusu</h3>
                    <div style="background:#fff;padding:15px;border-radius:8px;border-left:3px solid #0078D7;">
                        <p style="margin:4px 0;font-size:12px;"><strong>Ad Soyad:</strong> Can Özkan</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>E-posta:</strong> can@example.com</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Telefon:</strong> +905321234567</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Şehir:</strong> İstanbul</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>Pozisyon:</strong> Bölge Temsilcisi</p>
                        <p style="margin:4px 0;font-size:12px;"><strong>CV:</strong> 📎 cv-can-ozkan.pdf (ekte)</p>
                    </div>`
            }
        ]
    }
];

let html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>VG Danışmanlık - E-posta Şablonları Kataloğu</title>
<style>
    @page { margin: 15mm; size: A4; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1a1a1a; background: #f5f5f5; }
    .cover { text-align: center; padding: 80px 20px; page-break-after: always; }
    .cover img { height: 100px; margin-bottom: 20px; }
    .cover h1 { font-size: 28px; color: #005A9E; margin: 0 0 10px; }
    .cover h2 { font-size: 18px; color: #666; font-weight: 400; margin: 0 0 30px; }
    .cover .date { color: #999; font-size: 14px; }
    .category { background: linear-gradient(135deg, #005A9E, #003d6b); color: #fff; padding: 15px 25px; border-radius: 10px; margin: 30px 0 15px; font-size: 16px; font-weight: 700; page-break-after: avoid; }
    .email-block { margin: 0 0 25px; page-break-inside: avoid; }
    .email-title { font-size: 14px; font-weight: 700; color: #005A9E; margin: 0 0 8px; padding: 8px 0; border-bottom: 2px solid #005A9E; }
    .email-preview { border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .toc { page-break-after: always; }
    .toc h2 { color: #005A9E; font-size: 20px; margin-bottom: 15px; }
    .toc-item { padding: 6px 0; font-size: 13px; border-bottom: 1px solid #eee; }
    .toc-cat { font-weight: 700; color: #005A9E; margin-top: 12px; font-size: 14px; }
</style>
</head>
<body>

<div class="cover">
    <img src="${LOGO_URL}" alt="VG Danışmanlık">
    <h1>VG Danışmanlık</h1>
    <h2>E-posta Şablonları Kataloğu</h2>
    <p class="date">Hazırlanma Tarihi: ${new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    <p style="color:#888;font-size:13px;margin-top:10px;">Sistemdeki tüm otomatik e-postaların örnek görünümleri</p>
    <p style="color:#aaa;font-size:12px;margin-top:40px;">Toplam ${emails.reduce((s, c) => s + c.items.length, 0)} e-posta şablonu</p>
</div>

<div class="toc">
    <h2>İçindekiler</h2>
`;

let num = 0;
for (const cat of emails) {
    html += `<p class="toc-cat">${cat.category}</p>`;
    for (const item of cat.items) {
        num++;
        html += `<div class="toc-item">${item.title} — <span style="color:#666;">${item.to}</span></div>`;
    }
}

html += `</div>`;

for (const cat of emails) {
    html += `<div class="category">${cat.category}</div>`;
    for (const item of cat.items) {
        const card = item.isSimple
            ? simpleCard(item.subject, item.to, item.body)
            : emailCard(item.subject, item.to, item.body);
        html += `<div class="email-block">
            <p class="email-title">${item.title}</p>
            <div class="email-preview">${card}</div>
        </div>`;
    }
}

html += `
<div style="text-align:center;padding:30px;color:#999;font-size:12px;border-top:1px solid #ddd;margin-top:30px;">
    <p>© ${new Date().getFullYear()} VG Danışmanlık. Tüm hakları saklıdır.</p>
    <p>Bu doküman VG Danışmanlık web sitesi e-posta sisteminin görsel referansıdır.</p>
</div>
</body></html>`;

fs.writeFileSync('reports/email-catalog.html', html, 'utf-8');
console.log('Email catalog HTML generated: reports/email-catalog.html');
