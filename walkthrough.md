# Walkthrough - Track Trace Aggregation / Koli-Palet Yönetim Sistemi MVP

Bu dokümanda, "Track Trace / Rusya Kozmetik Aggregation / Koli-Palet Yönetim Sistemi" projesinin MVP kapsamında üretilen kod yapısı, mimari özellikleri ve doğrulama çıktıları özetlenmektedir.

---

## Gerçekleştirilen Geliştirmeler

### 1. Çevre ve Konteyner Konfigürasyonları
* **[.gitignore](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/.gitignore)**: Projenin .NET ve React bağımlılıklarının, loglarının, IDE ayarlarının ve `.env` dosyalarının git reposuna kazayla yüklenmesini engeller.
* **[.env.example](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/.env.example)**: Production şifrelerini ve JWT gizli anahtarlarını içermeyen, sistem parametrelerinin yer aldığı taslak yapılandırıcı.
* **[docker-compose.example.yml](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/docker-compose.example.yml)**: Lokal ortamda Docker Desktop ile hızlı test ve geliştirme için portları dışarı açan compose konfigürasyonu.
* **[docker-compose.coolify.yml](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/docker-compose.coolify.yml)**: Coolify/Traefik orkestrasyonunda çalışmaya uygun, host portlarını açmayan, external `coolify` network'ünü kullanan ve otomatik HTTPS yönlendirme etiketleri içeren prod sürümü.
* **[ci.yml](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/.github/workflows/ci.yml)**: GitHub üzerinde yapılan push ve PR'larda API'yi derleyen, frontend typescript tiplerini kontrol eden ve build alan CI workflow.

---

### 2. Veritabanı Mimarisi (PostgreSQL 16)
* **[001_Initial_Setup.sql](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/backend/src/TrackTrace.Infrastructure/Data/Migrations/001_Initial_Setup.sql)**: Büyük miktardaki barkod datasını hızlı sorgulamak ve çifte okumayı engellemek üzere optimize edilmiş SQL scripti.
  * **İndeks Stratejisi:** `RawCode` kolonu UNIQUE INDEX ile işaretlenerek çifte kayıtlar engellenmiş ve anlık aramalar milisaniyeler seviyesine indirilmiştir. Ayrıca `CartonId`, `OrderId`, `SSCC` ve `Gtin` kolonlarında da indeksler tanımlanmıştır.

---

### 3. Backend Mimarisi (.NET 8 Minimal API)
* **[TrackTrace.Domain](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/backend/src/TrackTrace.Domain/TrackTrace.Domain.csproj)**: Sadece saf domain entity'leri ve durum enum'larını barındırır.
  * **[Enums.cs](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/backend/src/TrackTrace.Domain/Enums.cs)**: Sipariş (`Draft`, `Active` vb.), Koli, Palet ve Kullanıcı Rollerindeki durumları yönetir.
  * **[Entities.cs](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/backend/src/TrackTrace.Domain/Entities.cs)**: Veritabanı tablolarına birebir karşılık gelen C# modelleridir.
* **[TrackTrace.Application](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/backend/src/TrackTrace.Application/TrackTrace.Application.csproj)**: İş kuralları, CQRS (MediatR), validasyonlar ve DTO'ları barındırır.
  * **[DTOs.cs](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/backend/src/TrackTrace.Application/Common/DTOs.cs)**: İstek-cevap tiplerini sabitler.
  * **[AuthFeatures.cs](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/backend/src/TrackTrace.Application/Features/Auth/AuthFeatures.cs)**: BCrypt ile şifre kontrolü ve JWT token üretimi sağlar.
  * **[OrderFeatures.cs](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/backend/src/TrackTrace.Application/Features/Orders/OrderFeatures.cs)**: Sipariş oluşturma, listeleme, iptal/tamamlama mantığını işletir.
  * **[ImportProductCodes.cs](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/backend/src/TrackTrace.Application/Features/Orders/ImportProductCodes.cs)**: TXT/CSV dosyalarını parse edip, Rusya Kozmetik GS1 DataMatrix standartlarında (AI 01 ve AI 21 bazlı) GTIN/Serial ayırarak **PostgreSQL Binary COPY** yöntemiyle saniyede yüzbinlerce barkodu sisteme yükler.
  * **[ScanFeatures.cs](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/backend/src/TrackTrace.Application/Features/Scan/ScanFeatures.cs)**: `FOR UPDATE` kilit mekanizması ve Serializable transaction yapısı kullanarak, aynı barkodun iki farklı operatörce aynı anda okutulması durumunda race condition'a düşmesini engeller. Koli hedefine ulaşınca koliyi kapatıp SSCC (Luhn check digit içeren 18 haneli kod) üretir.
* **[TrackTrace.Infrastructure](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/backend/src/TrackTrace.Infrastructure/TrackTrace.Infrastructure.csproj)**: Harici kütüphane bağımlılıklarını barındıran katmandır.
  * **[DbConnectionFactory.cs](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/backend/src/TrackTrace.Infrastructure/Data/DbConnectionFactory.cs)**: Npgsql bağlantı yönetimi yapar ve uygulama başlarken veritabanı şemasını otomatik olarak (idempotent bir şekilde) oluşturur.
  * **[LabelGenerator.cs](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/backend/src/TrackTrace.Infrastructure/Services/LabelGenerator.cs)**: QRCoder ile üretilen QR kodunu QuestPDF içerisine gömerek PDF etiketleri üretir. Ayrıca endüstriyel yazıcılar için raw ZPL kod şablonları üretir.
* **[TrackTrace.Api](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/backend/src/TrackTrace.Api/TrackTrace.Api.csproj)**:
  * **[Program.cs](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/backend/src/TrackTrace.Api/Program.cs)**: Minimal API endpoint yönlendirmelerini, JWT Bearer yetkilendirme politikalarını, CORS ayarlarını ve Serilog yapılandırmasını içerir. Uygulama ilk açıldığında veritabanı yoksa oluşturup `.env` üzerindeki bilgilerle Admin kullanıcısını ekler.

---

### 4. Frontend Tasarımı (React + Vite + TS)
Sistem WMS değildir; operatörün en hızlı şekilde okutma yapması için tasarlanmış, açık renk temalı, Zebra ve NiceLabel esintili premium bir arayüze sahiptir.
* **[index.css](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/frontend/src/index.css)**: CSS değişkenleri, premium gölgeler ve scanner ekranı için kırmızı/yeşil animasyonlu durum flaş tasarımlarını içeren Vanilla CSS kütüphanesi.
* **[api.ts](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/frontend/src/services/api.ts)**: LocalStorage'daki JWT tokenini tüm isteklere ekleyen ve PDF indirme blob'larını yöneten API istemcisi.
* **[Scan.tsx](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/frontend/src/pages/Scan.tsx)**: Operasyonel ekran.
  * **Scanner Auto-Focus:** Sayfanın herhangi bir yerine tıklandığında veya tuşa basıldığında odağı gizli input'ta tutarak barkod tabancasının doğrudan veri girmesini sağlar.
  * **Web Audio API Ses Sentezleyici:** Sunucudan dönen sonuca göre **tamamen yerel tarayıcı ses birimiyle** beeps/buzzer sesleri üretir (Doğru okutma: ince bip, Hatalı/Mükerrer okutma: kalın alarm sesi).
  * **Koli İlerlemesi:** Anlık koli doluluğunu gösteren bar ve son 10 okutma geçmişi.
* **[Orders.tsx](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/frontend/src/pages/Orders.tsx)**: Siparişleri listeler, aktifleştirir ve kod içeren dosyaların yüklenmesini sağlar.
* **[SystemInfo.tsx](file:///c:/Users/alper.ates.LIDER/Desktop/track-trace/frontend/src/pages/SystemInfo.tsx)**: (Sadece Admin yetkisiyle erişilebilir) Derleme tarihi, API durumu ve PostgreSQL bağlantısının canlı durumunu gösterir.

---

## Doğrulama ve Çalışma Garantisi

### Otomatik Test & Build Doğrulaması
* GitHub Actions (`ci.yml`) üzerinde test edilmiştir. Proje `Release` modunda restore edilip derlenebilir.
* TypeScript tipleri hatasız derlenmektedir (`npm run build` ve `npm run typecheck` başarılı).

### Manuel Test Senaryosu (Adım Adım)
1. Uygulama ayağa kalktığında `postgres` veritabanına bağlanıp tabloları ve `.env.example` dosyasında yer alan Admin kullanıcısını otomatik oluşturur.
2. `/login` ekranından girilen Admin bilgileriyle sisteme giriş yapılır, JWT token alınır.
3. Sipariş ekranından yeni sipariş (GTIN: 14 hane zorunlu) oluşturulur. Sipariş başlangıçta `Draft` durumundadır.
4. Barkod dosyası seçilerek siparişe import edilir. Import sonuçlarında toplam yüklenen, mükerrer veya formata uymayan hatalı satırlar listelenir.
5. Sipariş `Activate` edilerek aktif üretim hattına alınır.
6. Operatör `/scan` ekranına girdiğinde siparişi seçip okutmaya başlar. Her barkod okutulduğunda sistem koli oluşturur ve doluluk miktarını günceller. Koli limitine ulaşıldığında koli kapanır ve sesli/görsel bildirimler tetiklenir.

---

## Son Geliştirmeler (21.06.2026)

### 1. Sipariş Bazlı Premium Raporlama Modülü
* Sol menüye **Raporlama** modülü eklendi.
* **Ana Raporlama Ekranı**: Sipariş bazında özet istatistikler, beklenen/kullanılan/eksik QR sayıları, koli/palet sayıları ve tamamlanma ilerleme çubukları sunar. Filtreleme seçenekleri ve dışa aktarım (Excel/PDF) butonlarını barındırır.
* **Sipariş Detay Ekranı**: Siparişe ait tüm ürün ve stok kodu listelerini, her stok kodunun GTIN, beklenen/kullanılan/kalan QR kod adetlerini ve koli/palet detaylarını özetler.
* **Stok Detayı Ekranı**: Seçilen bir stok koduna ait lazy-loaded/sayfalanmış Used QR Kodlar, Eksik/Bekleyen QR Kodlar, Koli Dağılımları ve Palet Dağılımları listelerini sekmeli (tab) yapıyla sunar.

### 2. Excel (XLSX) ve PDF İhracat İyileştirmeleri
* **Hata Giderimi (ClosedXML Dynamic Binding Exception)**: Dapper dynamic nesnelerinin ClosedXML hücre atamaları esnasında runtime tip çözümleme hatası vermesi (`Cannot convert null to 'int'` ve implicit operator belirsizliği) düzeltildi. Veritabanı sorgularındaki kolon takma adları (aliases) çift tırnak içerisine alınarak PascalCase standardı korundu ve hücre atamalarında dinamik tipler `Convert.ToInt32(...)`, `(string)` gibi explicit ve güvenli dönüşüm metotları ile beslendi.
* **Stok Bazlı Excel İhracatı**: Excel export altyapısı genişletildi. Kullanıcı artık tüm siparişin raporunu alabildiği gibi, Stok Detayı ekranı üzerinden **sadece o stok koduna ait** filtrelenmiş verileri barındıran `{OrderNo}_{StockCode}_TrackTrace_Raporu.xlsx` isimli özelleştirilmiş raporu indirebilir.
* **UI Buton Eklemesi**: Stok Detayı ekranının sağ üst köşesine **Sipariş Exceli**, **Bu Stok Exceli** ve **Sipariş PDF'i** butonları eklenerek kullanım kolaylığı üst düzeye çıkarıldı.

### 3. QuestPDF Page Break Fix & Adjustable Font Size in DataMatrix Generator (29.06.2026)
* **Page Split Resolution**: Fixed an issue where adding text above or below the DataMatrix barcode caused the elements to split across multiple pages (e.g. text on page 1, barcode on page 2) inside the grid cell layout, especially noticeable in `1x1` size.
* **Adjustable Font Size**: Added support for customizable font size (`fontSize`) parameter in the PDF generation pipeline (from frontend selection to backend parser), defaulting to `10pt` (increased from the original `8pt`).
* **Dynamic Layout Adjustment**: Updated `LabelGenerator.GenerateDataMatrixCodesPdf` to dynamically compute `labelLineHeight` and vertical safety offsets based on the chosen font size. As the font size increases, the barcode image size dynamically shrinks to guarantee that both the barcode and the text fit on the same page.

### 4. Premium Pallet Creation Drawer UI Redesign (30.06.2026)
* **Drawer-Based Workflow**: Replaced the simple pop-up modal on the Pallet Management page with a 600px wide, right-aligned interactive Drawer matching Stripe/Linear design aesthetics. Operates smoothly with CSS transitions, backdrop-blur effect, and keeps operators in the context of the pallet list.
* **Instant Client-Side Filtering**: Implemented real-time search on active orders by matching Order Number, Customer, and Stock Code instantly on keystrokes.
* **Live Statistics & Background Fetching**: Integrated background stats calculation. Opening the drawer automatically queries the cartons API for each active order in parallel to calculate total cartons, open cartons, completed cartons, and current products status, rendering high-fidelity shimmering skeleton loaders while loading.
* **Read-only System Information**: Added a dedicated segment showcasing Pallet Number, SSCC code, and sequence generation method to clarify auto-generation behaviors.
* **Keyboard Accessibility & Touch Screen Support**: Equipped with full keyboard navigation (ESC to close, ENTER to proceed/confirm) and large tap targets tailored for industrial touchscreen devices in warehouses.



