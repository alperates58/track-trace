# Track Trace Kurulum Prosedürü

Bu doküman, Track Trace uygulamasının aynı GitHub reposundan farklı domainlerde ve farklı sunucularda güvenli şekilde kurulması için standart prosedürü tanımlar.

Amaç, her deployment'ın birbirinden tamamen izole çalışmasını sağlamak ve mevcut çalışan kurulumları etkilemeden yeni instance'lar oluşturabilmektir.

---

## 1. Mimari

Her kurulum aynı repository ve aynı `docker-compose.coolify.yml` dosyasını kullanır.

Her deployment yalnızca kendi environment değişkenleriyle ayrışır.

Temel deployment değişkenleri:

```env
DEPLOYMENT_ID=ornek
FRONTEND_HOST=track.example.com
API_HOST=track-api.example.com
FRONTEND_URL=https://track.example.com
API_URL=https://track-api.example.com
```

### `DEPLOYMENT_ID` kuralları

`DEPLOYMENT_ID` her deployment için benzersiz olmalıdır.

Önerilen format:

```text
[a-z0-9-]
```

Örnekler:

```env
DEPLOYMENT_ID=prod
DEPLOYMENT_ID=test
DEPLOYMENT_ID=customer-a
DEPLOYMENT_ID=site-02
```

Aynı sunucuda çalışan iki deployment kesinlikle aynı `DEPLOYMENT_ID` değerini kullanmamalıdır.

---

## 2. GitHub Kaynağı

Kurulum GitHub repository üzerinden yapılmalıdır.

Önerilen ayarlar:

```text
Branch: main
Build Pack: Docker Compose
Compose File: /docker-compose.coolify.yml
```

Production kurulumlarında mümkün olduğunca sabit branch kullanılmalıdır:

```text
main
```

Deploy sırasında Coolify ilgili branch'in güncel commit'ini çeker ve image'ları yeniden build eder.

---

## 3. Coolify Application Oluşturma

Coolify üzerinde yeni bir **Application** oluşturulur.

Kaynak olarak public veya yetkilendirilmiş GitHub repository seçilir.

Application oluşturulduktan sonra:

```text
Build Pack = dockercompose
Docker Compose Location = /docker-compose.coolify.yml
```

olmalıdır.

### Önemli Coolify ayarı

Traefik label'larında `${VARIABLE}` interpolation kullanıldığı için aşağıdaki ayar kapatılmalıdır:

```text
is_container_label_escape_enabled = false
```

Bu ayar kapatılmazsa Traefik label'ları şu şekilde literal kalabilir:

```text
track-${DEPLOYMENT_ID}-api
Host(`${API_HOST}`)
```

ve uygulama `503` verebilir.

Doğru sonuç şu tipte olmalıdır:

```text
track-prod-api
Host(`track-api.example.com`)
```

---

## 4. Gerekli Environment Variables

Coolify Application environment alanına aşağıdaki değişkenler eklenmelidir.

### Deployment / Domain

```env
DEPLOYMENT_ID=ornek

FRONTEND_HOST=track.example.com
API_HOST=track-api.example.com

FRONTEND_URL=https://track.example.com
API_URL=https://track-api.example.com

Cors__AllowedOrigins__0=https://track.example.com
```

### Database

```env
DB_USER=...
DB_PASSWORD=...
```

### JWT

```env
JWT_SECRET=...
JWT_EXPIRY_HOURS=...
```

### Admin / Seed

```env
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
ADMIN_NAME=...
```

### Diğer

```env
MAX_UPLOAD_MB=...
APP_VERSION=...
BUILD_DATE=...
GIT_COMMIT_SHA=...
```

Repository veya dokümantasyon içine gerçek secret değerleri yazılmamalıdır.

---

## 5. DNS Kayıtları

Production domainleri uygulama deploy edilmeden önce doğru sunucuya yönlendirilmelidir.

Örnek:

```text
track.example.com
track-api.example.com
```

Her iki domain için A kaydı:

```text
A -> SUNUCU_PUBLIC_IP
```

DNS doğrulaması:

```bash
dig +short track.example.com
dig +short track-api.example.com
```

veya:

```bash
getent ahostsv4 track.example.com
getent ahostsv4 track-api.example.com
```

---

## 6. İlk Deploy Öncesi Kontrol

Deploy'dan önce aşağıdakiler doğrulanmalıdır:

```text
[ ] Git branch doğru
[ ] docker-compose.coolify.yml seçili
[ ] DEPLOYMENT_ID tanımlı
[ ] DEPLOYMENT_ID benzersiz
[ ] FRONTEND_HOST doğru
[ ] API_HOST doğru
[ ] FRONTEND_URL doğru
[ ] API_URL doğru
[ ] CORS origin doğru
[ ] DB secret'ları tanımlı
[ ] JWT secret tanımlı
[ ] Admin bilgileri tanımlı
[ ] Label escaping kapalı
[ ] DNS doğru sunucuya gidiyor
```

---

## 7. İlk Deploy

Coolify üzerinden application deploy edilir.

Deploy sonrası container kontrolü:

```bash
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
```

Beklenen servisler:

```text
db
api
frontend
```

API container'ı healthy olmalıdır.

---

## 8. Traefik İzolasyon Kontrolü

Her deployment kendi Traefik namespace'ine sahip olmalıdır.

Örnek:

```text
track-prod-api
track-prod-api-http
track-prod-frontend
track-prod-frontend-http
```

Kontrol:

```bash
for C in $(docker ps --format '{{.Names}}' | grep '<APPLICATION_UUID>'); do
  echo "--- $C ---"
  docker inspect "$C" \
    --format '{{json .Config.Labels}}' \
    | tr ',' '\n' \
    | grep -E 'traefik.http.routers|traefik.http.services'
done
```

Traefik label'larında `${DEPLOYMENT_ID}`, `${FRONTEND_HOST}` veya `${API_HOST}` literal olarak görünmemelidir.

Yanlış:

```text
track-${DEPLOYMENT_ID}-frontend
Host(`${FRONTEND_HOST}`)
```

Doğru:

```text
track-prod-frontend
Host(`track.example.com`)
```

---

## 9. PostgreSQL Volume

Compose tarafında logical volume:

```text
track_trace_pgdata
```

olarak kalabilir.

Coolify physical Docker volume adını kendi UUID'si ile normalize edebilir.

Örnek:

```text
<ApplicationUUID>_track-trace-pgdata
```

Bu normaldir.

### Kritik kural

Çalışan production volume hiçbir zaman:

```bash
docker volume rm
docker system prune --volumes
docker compose down -v
```

gibi komutlarla silinmemelidir.

---

## 10. Mevcut Kurulumu Yeni Generic Compose'a Geçirme

Mevcut çalışan deployment yeni generic compose'a geçirilecekse doğrudan redeploy yapılmamalıdır.

Önce:

1. DB backup alınır.
2. Backup doğrulanır.
3. `DEPLOYMENT_ID` eklenir.
4. Label escaping kapatılır.
5. Mevcut DB volume adı kaydedilir.
6. Sonra redeploy yapılır.

### DB backup

```bash
DB_CONTAINER="<db-container>"

BACKUP="/root/track-trace-before-redeploy-$(date +%Y%m%d-%H%M%S).dump"

docker exec "$DB_CONTAINER" sh -c '
  pg_dump \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -Fc
' > "$BACKUP"
```

Doğrulama:

```bash
docker run --rm \
  -v /root:/backup:ro \
  postgres:16-alpine \
  pg_restore -l "/backup/$(basename "$BACKUP")" \
  >/dev/null
```

Hash:

```bash
sha256sum "$BACKUP"
```

---

## 11. DB Sağlık Kontrolü

Deploy öncesi ve sonrası:

```bash
docker exec "<db-container>" sh -c '
  echo -n "DB_SIZE="
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc \
    "SELECT pg_size_pretty(pg_database_size(current_database()));"

  echo -n "TABLES="
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='\''public'\'';"
'
```

Production migration sırasında tablo sayısı ve DB büyüklüğü önceki sistemle karşılaştırılmalıdır.

---

## 12. Yeni Sunucuya Migration

Mevcut bir deployment başka sunucuya taşınacaksa önerilen sıra:

1. Yeni sunucuda GitHub-backed Application oluştur.
2. Geçici test domainleri kullan.
3. Benzersiz test `DEPLOYMENT_ID` ata.
4. Application'ı deploy et.
5. Frontend/API health testlerini yap.
6. Eski production DB'den dump al.
7. Yeni test DB'ye restore et.
8. Gerçek verilerle login testi yap.
9. Final cutover öncesi eski production yazılarını durdur.
10. Son bir fresh DB dump al.
11. Yeni DB'ye son dump'ı restore et.
12. Yeni Application environment'ını production domainlerine çevir.
13. Production `DEPLOYMENT_ID` değerini ata.
14. Eski deployment'ı durdur.
15. Yeni deployment'ı başlat.
16. Health, CORS, login ve DB kontrolü yap.
17. Eski DB / deployment'ı hemen silme; rollback için bir süre tut.

---

## 13. Test Deployment Kullanımı

Production çalışan bir sunucuda ikinci instance test edilecekse mutlaka farklı:

```text
DEPLOYMENT_ID
FRONTEND_HOST
API_HOST
```

kullanılmalıdır.

Örnek:

```env
DEPLOYMENT_ID=git-test
FRONTEND_HOST=track-git-test.example.com
API_HOST=track-api-git-test.example.com
FRONTEND_URL=https://track-git-test.example.com
API_URL=https://track-api-git-test.example.com
```

Aksi halde Traefik router isimleri çakışabilir.

---

## 14. Health Kontrolleri

Frontend:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  https://track.example.com/
```

API:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  https://track-api.example.com/health
```

Beklenen:

```text
200
200
```

---

## 15. CORS Kontrolü

```bash
curl -sSI -X OPTIONS \
  https://track-api.example.com/api/auth/login \
  -H "Origin: https://track.example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  | grep -Ei \
    'HTTP/|access-control-allow-origin|access-control-allow-credentials'
```

Beklenen:

```text
HTTP/2 204
access-control-allow-origin: https://track.example.com
access-control-allow-credentials: true
```

---

## 16. Deploy Sonrası Kontrol Listesi

```text
[ ] Frontend 200
[ ] API /health 200
[ ] API container healthy
[ ] DB container healthy
[ ] DB size beklenen seviyede
[ ] Table count doğru
[ ] Login başarılı
[ ] Gerçek kayıtlar görüntüleniyor
[ ] CORS doğru
[ ] Frontend doğru API domainine istek atıyor
[ ] Traefik router isimleri DEPLOYMENT_ID içeriyor
[ ] Traefik domain rule doğru
[ ] Mevcut diğer deployment'lar etkilenmedi
```

---

## 17. Standart Güncelleme Akışı

Normal production güncellemesi:

1. Kod değişikliği yapılır.
2. Testler çalıştırılır.
3. `main` branch'e commit/push yapılır.
4. Coolify Application üzerinde **Redeploy** yapılır.
5. Coolify GitHub `main` branch'in güncel commit'ini çeker.
6. API/frontend yeniden build edilir.
7. DB persistent volume korunur.
8. Health kontrolleri yapılır.

Kontrol:

```bash
docker ps -a \
  --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
```

Image tag / commit SHA yeni commit ile eşleşmelidir.

---

## 18. Rollback

Başarısız deployment durumunda:

- DB volume silinmez.
- Son doğrulanmış DB dump saklanır.
- Önceki image/commit gerektiğinde yeniden deploy edilir.
- Migration sırasında eski deployment hemen silinmez.
- DNS değişikliği gerekiyorsa geri alınabilir.
- Eski deployment yeniden başlatılabilir.

Database restore gerektiğinde yalnızca doğrulanmış dump kullanılmalıdır.

---

## 19. Güvenlik

Aşağıdaki bilgiler GitHub repository'ye commit edilmemelidir:

```text
DB_PASSWORD
JWT_SECRET
ADMIN_PASSWORD
Coolify API token
SSH private key
SMTP password
API keys
```

Secret'lar yalnızca Coolify Environment Variables veya uygun secret yönetim sistemi üzerinden tutulmalıdır.

Bir secret terminal loguna, chat'e veya public repository'ye yanlışlıkla yazıldıysa güvenli kabul edilmemeli ve rotate edilmelidir.

---

## 20. Yeni Deployment İçin Minimum Özet

Yeni bir instance kurarken minimum gerekli sıra:

```text
1. DNS oluştur
2. Coolify Application oluştur
3. GitHub main branch bağla
4. docker-compose.coolify.yml seç
5. is_container_label_escape_enabled=false yap
6. Unique DEPLOYMENT_ID ver
7. Domain env'lerini gir
8. DB / JWT / Admin secret'larını gir
9. Deploy et
10. Traefik interpolation kontrol et
11. DB kontrol et
12. Frontend/API health kontrol et
13. CORS kontrol et
14. Login testi yap
```

---

## 21. Önemli Tasarım İlkesi

Repository hiçbir deployment'a özel olmamalıdır.

`docker-compose.coolify.yml` içinde gerçek deployment domainleri hardcode edilmemelidir.

Deployment farkları yalnızca environment variables üzerinden yönetilmelidir.

Bu sayede aynı repository:

- farklı domainlerde,
- farklı sunucularda,
- aynı sunucuda birden fazla instance olarak

değişiklik gerektirmeden kullanılabilir.
