# Vercel Postgres Kurulum Rehberi

## 🚀 Vercel Postgres Ekleme

### 1. Vercel Dashboard'da Postgres Ekleme
1. [Vercel Dashboard](https://vercel.com/dashboard) açın
2. Projenizi seçin: `veture-global-website`
3. **Storage** sekmesine gidin
4. **Create Database** butonuna tıklayın
5. **Postgres** seçin
6. Database adı: `venture-global-db`
7. Region seçin (EU Central 1 önerilen)

### 2. Environment Variables Ekleme
Vercel Dashboard > Settings > Environment Variables:

```
DATABASE_URL=postgresql://username:password@host:port/database
POSTGRES_CA_CERT=-----BEGIN CERTIFICATE-----...
POSTGRES_CLIENT_KEY=-----BEGIN PRIVATE KEY-----...
POSTGRES_CLIENT_CERT=-----BEGIN CERTIFICATE-----...
```

### 3. Database Schema Import
```bash
# Vercel Postgres'e schema import
psql $DATABASE_URL < database/schema.sql
```

### 4. Test Etme
```bash
# Local test
npm run dev

# Production deploy
vercel --prod
```

## 🔧 Gerekli Ayarlar

### Connection Pooling
- Max connections: 20
- Idle timeout: 30s
- Connection timeout: 2s

### SSL Configuration
- Production'da SSL zorunlu
- Self-signed certificate desteği
- Client certificate authentication

## 📊 Monitoring
- Vercel Dashboard > Storage > Postgres
- Connection sayısı
- Query performance
- Storage usage

## 🚨 Troubleshooting

### Connection Error
```bash
# SSL hatası için
export PGSSLMODE=require
```

### Timeout Error
```bash
# Connection timeout artır
export PGCONNECT_TIMEOUT=10
```

## 💰 Pricing
- **Hobby**: $20/month (256MB, 1 database)
- **Pro**: $40/month (1GB, 10 databases)
- **Enterprise**: Custom pricing

## 🔗 Useful Links
- [Vercel Postgres Docs](https://vercel.com/docs/storage/vercel-postgres)
- [Connection String Format](https://www.postgresql.org/docs/current/libpq-connect.html)
- [SSL Configuration](https://www.postgresql.org/docs/current/libpq-ssl.html)
