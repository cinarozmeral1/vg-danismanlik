# 🚀 Vercel Deployment Guide - Venture Global Website

Bu rehber, Venture Global web sitesini Vercel'da deploy etmek için gerekli adımları içerir.

## 📋 Gereksinimler

- [Vercel CLI](https://vercel.com/cli) yüklü olmalı
- [Git](https://git-scm.com/) yüklü olmalı
- [Node.js](https://nodejs.org/) 18+ yüklü olmalı

## 🔧 Vercel CLI Kurulumu

```bash
npm install -g vercel
```

## 📁 Proje Hazırlığı

### 1. Vercel Konfigürasyonu
Proje zaten `vercel.json` dosyası ile hazırlanmıştır.

### 2. Environment Variables
Vercel dashboard'da aşağıdaki environment variable'ları ekleyin:

```env
NODE_ENV=production
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email
EMAIL_PASS=your_email_password
```

## 🚀 Deployment Adımları

### 1. Vercel'e Giriş
```bash
vercel login
```

### 2. Proje Deploy Etme
```bash
# Proje dizininde
vercel

# Veya production için
vercel --prod
```

### 3. Environment Variables Ekleme
```bash
vercel env add DATABASE_URL
vercel env add JWT_SECRET
vercel env add EMAIL_USER
vercel env add EMAIL_PASS
```

## 🌐 Domain Konfigürasyonu

### 1. Custom Domain Ekleme
Vercel dashboard'da:
1. Proje seçin
2. Settings > Domains
3. Custom domain ekleyin

### 2. DNS Ayarları
Domain sağlayıcınızda:
- Type: CNAME
- Name: @
- Value: cname.vercel-dns.com

## 🔒 SSL ve Security

- Vercel otomatik olarak SSL sertifikası sağlar
- HTTPS zorunlu hale getirilir
- Security headers otomatik olarak eklenir

## 📊 Monitoring ve Analytics

Vercel dashboard'da:
- Performance metrics
- Error tracking
- Real-time analytics
- Function logs

## 🚨 Önemli Notlar

### Database Bağlantısı
- PostgreSQL veritabanı production'da erişilebilir olmalı
- Connection string güvenli olmalı
- SSL bağlantısı önerilir

### File Uploads
- Vercel serverless functions için file upload limitleri var
- Büyük dosyalar için external storage (AWS S3, Cloudinary) önerilir

### Environment Variables
- Hassas bilgiler (API keys, passwords) environment variables olarak saklanmalı
- Production'da `.env` dosyası kullanılmamalı

## 🔄 Güncelleme

### 1. Code Güncelleme
```bash
git add .
git commit -m "Update message"
git push
```

### 2. Vercel'de Redeploy
```bash
vercel --prod
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - DATABASE_URL environment variable kontrol edin
   - Database'in public erişime açık olduğundan emin olun

2. **Build Error**
   - Node.js version kontrol edin (18+)
   - Dependencies yüklenmiş mi kontrol edin

3. **Function Timeout**
   - `vercel.json`'da `maxDuration` artırın
   - Database queries optimize edin

### Logs Kontrolü
```bash
vercel logs
```

## 📞 Destek

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Support](https://vercel.com/support)
- [Vercel Community](https://github.com/vercel/vercel/discussions)

## ✅ Deployment Checklist

- [ ] Vercel CLI yüklü
- [ ] vercel.json dosyası mevcut
- [ ] Environment variables eklendi
- [ ] Database bağlantısı test edildi
- [ ] SSL sertifikası aktif
- [ ] Custom domain eklendi
- [ ] Performance test edildi
- [ ] Error monitoring aktif

---

**Not:** Bu deployment sonrasında siteniz `https://your-domain.vercel.app` adresinde erişilebilir olacaktır.
