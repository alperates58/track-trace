# Track Trace - Rusya Kozmetik Aggregation / Koli-Palet Yönetim Sistemi

Bu sistem; GS1 DataMatrix ürün barkodlarını koli ve palet seviyesinde ilişkilendirmek, SSCC barkod etiketleri üretmek ve ürün hareketlerini izlemek için geliştirilmiş MVP odaklı Track & Trace uygulamasıdır.

Sistem bir WMS değildir. Ürün bazlı serialization, aggregation ve sevkiyat izlenebilirliği için tasarlanmıştır.

---

## Proje Bilgileri

```text
Proje adı: track-trace
GitHub repo: track-trace
Frontend domain: https://track.alperates.com.tr
API domain: https://track-api.alperates.com.tr
Database: PostgreSQL 16
Backend: .NET 8 Minimal API + Dapper
Frontend: React + Vite + TypeScript
Deploy: Coolify Docker Compose
```

---

## Proje Yapısı

```text
/track-trace
  /backend
    /src
      /TrackTrace.Api
      /TrackTrace.Application
      /TrackTrace.Domain
      /TrackTrace.Infrastructure
  /frontend
  /docker
  /docs
  .github/workflows/ci.yml
  .env.example
  .gitignore
  docker-compose.example.yml
  docker-compose.coolify.yml
  README.md
```

---

## Production Deploy Yöntemi

Bu proje production ortamında **GitHub + Coolify** üzerinden deploy edilir.

Local kurulum zorunlu değildir.

Akış:

```text
1. Kod GitHub repo'ya push edilir.
2. Coolify GitHub repo'yu kaynak olarak kullanır.
3. Build pack olarak Docker Compose seçilir.
4. Compose dosyası docker-compose.coolify.yml olarak ayarlanır.
5. Environment değişkenleri Coolify UI üzerinden girilir.
6. Deploy Coolify üzerinden yapılır.
7. Güncellemeler GitHub push + Coolify redeploy ile alınır.
```

---

## Coolify Resource Ayarları

Coolify’da yeni resource oluştururken:

```text
New Resource: Public/Private Git Repository
Repository: track-trace
Branch: main
Build Pack: Docker Compose
Compose File: docker-compose.coolify.yml
```

Host port açılmamalıdır. Trafik Traefik / Coolify proxy üzerinden yönetilir.

---

## Domainler

```text
Frontend:
https://track.alperates.com.tr

API:
https://track-api.alperates.com.tr
```

DNS kayıtları deploy ve router testlerinden sonra eklenmelidir.

Önerilen DNS kayıtları:

```text
A track      178.105.53.132 DNS only
A track-api  178.105.53.132 DNS only
```

---

## Coolify Environment Değişkenleri

Coolify UI içinde aşağıdaki environment değişkenleri tanımlanmalıdır.

Gerçek secret, şifre veya token değerleri GitHub’a yazılmamalıdır.

```text
DB_USER=postgres
DB_PASSWORD=<set-in-coolify>
JWT_SECRET=<set-in-coolify-min-32-chars>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<set-in-coolify>
APP_VERSION=v0.1.0-mvp
BUILD_DATE=2026-06-16
GIT_COMMIT_SHA=<set-by-build-or-manual>
FRONTEND_URL=https://track.alperates.com.tr
VITE_API_BASE_URL=https://track-api.alperates.com.tr
```

Notlar:

```text
DB_PASSWORD gerçek PostgreSQL şifresidir.
JWT_SECRET minimum 32 karakter olmalıdır.
ADMIN_PASSWORD ilk admin kullanıcısı için başlangıç şifresidir.
Bu değerler sadece Coolify UI içinde saklanmalıdır.
```

---

## Container ve Volume İsimleri

```text
API container: track_trace_api
Frontend container: track_trace_frontend
DB container: track_trace_db
DB volume: track_trace_pgdata
Database adı: track_trace
Docker network: coolify external
```

---

## Coolify / Traefik Kuralları

`docker-compose.coolify.yml` şu kurallara uygun olmalıdır:

```text
Host port açılmayacak.
Entrypoint isimleri sadece http ve https olacak.
web / websecure kullanılmayacak.
HTTPS router middleware sadece crowdsec@file olacak.
HTTP router middleware redirect + crowdsec@file olacak.
Router service açıkça yazılacak.
DB public açılmayacak.
coolify external network kullanılacak.
```

Beklenen router isimleri:

```text
track-trace-frontend
track-trace-frontend-http
track-trace-api
track-trace-api-http
```

Beklenen middleware isimleri:

```text
track-trace-frontend-https-redirect
track-trace-api-https-redirect
```

---

## İlk Deploy Sonrası Testler

Sunucuda veya kendi bilgisayarında test:

```bash
curl -I https://track.alperates.com.tr
curl -I https://track-api.alperates.com.tr/health
```

Beklenen sonuçlar:

```text
Frontend: 200, 301, 302 veya 307/308 olabilir.
API /health: 200 beklenir.
401 auth isteyen endpointlerde normaldir.
404 router yok demektir.
502 backend cevap vermiyor demektir.
503 backend/middleware sorunu olabilir.
```

---

## API Endpoint Özeti

```text
GET  /health
POST /api/auth/login

GET  /api/dashboard/summary

GET  /api/orders
POST /api/orders
GET  /api/orders/{id}
PUT  /api/orders/{id}
POST /api/orders/{id}/activate
POST /api/orders/{id}/complete
POST /api/orders/{id}/cancel
POST /api/orders/{id}/import-codes

POST /api/scan/product

GET  /api/cartons
GET  /api/cartons/{id}
GET  /api/cartons/{id}/items
POST /api/cartons/{id}/print
GET  /api/cartons/{id}/label.pdf
GET  /api/cartons/{id}/label.zpl

GET  /api/pallets
POST /api/pallets
GET  /api/pallets/{id}
POST /api/pallets/{id}/add-carton
POST /api/pallets/{id}/close
GET  /api/pallets/{id}/label.pdf
GET  /api/pallets/{id}/label.zpl

GET  /api/barcodes/search?code=

GET  /api/print-jobs

GET  /api/system/info
GET  /api/system/health
```

---

## Barkod Import Formatı

TXT veya CSV dosyasında her satır bir ürün barkodu olmalıdır.

Örnek:

```text
0104630477370359215-zOwm GS 93NdhB
0104630477370359215-ABC12 GS 93XyZ9
```

Kurallar:

```text
RawCode ham haliyle saklanır.
GTIN mümkünse AI 01 sonrasındaki 14 hane olarak ayrıştırılır.
SerialNo mümkünse AI 21 sonrasından ayrıştırılır.
Parse başarısız olsa bile RawCode boş değilse kayıt korunabilir.
```

---

## Scan Akışı

```text
1. Operatör aktif siparişi seçer.
2. Barkod okuyucu klavye gibi çalışır.
3. Barkod API’ye gönderilir.
4. Sistem barkodun siparişte olup olmadığını kontrol eder.
5. Daha önce okutulmuşsa hata döner.
6. Açık koli yoksa yeni koli oluşturulur.
7. Ürün aktif koliye eklenir.
8. Koli hedef adede ulaşınca otomatik kapatılır.
9. PDF/ZPL etiket üretilebilir hale gelir.
```

---

## Etiket Çıktıları

Sistem koli ve palet için iki format destekler:

```text
PDF
ZPL
```

PDF etiketler tarayıcıdan indirilebilir.  
ZPL çıktısı Zebra yazıcılar için raw text olarak üretilebilir.

---

## Güvenlik Notları

```text
Secret değerleri GitHub'a yazılmamalıdır.
.env dosyası commit edilmemelidir.
.env.example sadece placeholder içermelidir.
JWT secret minimum 32 karakter olmalıdır.
Admin şifresi Coolify environment üzerinden girilmelidir.
Swagger production ortamında açık kalmamalıdır.
API token URL query parametresinde taşınmamalıdır.
```

---

## GitHub İlk Push

```bash
git init
git add .
git commit -m "Initial MVP"
git branch -M main
git remote add origin <github-repo-url>
git push -u origin main
```

---

## Güncelleme

Yeni kod değişiklikleri GitHub’a push edilir.

```bash
git add .
git commit -m "Update"
git push
```

Deploy, redeploy ve rollback işlemleri Coolify üzerinden yapılır.

Uygulama içinden Docker restart, git pull veya deploy yapılmaz.

---

## Rollback

Coolify içinde:

```text
Resource → Deployments → Önceki başarılı deployment → Rollback
```

---

## Monitoring

İlk deploy sonrası Uptime Kuma’ya şu kontroller eklenebilir:

```text
https://track.alperates.com.tr
https://track-api.alperates.com.tr/health
```

---

## Production Kontrol Listesi

```text
[ ] GitHub repo private/public kararı verildi
[ ] docker-compose.coolify.yml kontrol edildi
[ ] Secret değerleri GitHub'a yazılmadı
[ ] Coolify environment değerleri girildi
[ ] track.alperates.com.tr router test edildi
[ ] track-api.alperates.com.tr /health test edildi
[ ] DNS kayıtları en son eklendi
[ ] İlk admin login test edildi
[ ] Uptime Kuma monitor eklendi
[ ] CloudBeaver DB connection gerekirse eklendi
```