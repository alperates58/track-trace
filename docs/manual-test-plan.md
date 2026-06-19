# Manuel Test Planı - Track & Trace Aggregation Sistemi

Bu dokümanda, "Track & Trace Aggregation / Koli-Palet Yönetim Sistemi" projesindeki kritik kullanıcı akışlarını test etmek için kullanılacak adım adım manuel doğrulama yönergeleri yer almaktadır.

---

## 1. Kullanıcı Giriş (Login) Testi
* **Amaç:** JWT tabanlı kimlik doğrulama akışının çalıştığını doğrulamak.
* **Adımlar:**
  1. `https://track.alperates.com.tr` (veya lokalde `http://localhost:5173`) adresini tarayıcıda açın.
  2. Kullanıcı adı olarak `.env` dosyasında belirlediğiniz admin kullanıcısını girin (Varsayılan: `admin`).
  3. Geçersiz bir şifre girerek **Giriş Yap** butonuna tıklayın.
     * *Beklenen Sonuç:* "Geçersiz kullanıcı adı veya şifre" uyarı mesajı görünmelidir.
  4. Doğru admin şifresini girip tekrar **Giriş Yap** butonuna tıklayın.
     * *Beklenen Sonuç:* Dashboard sayfasına başarıyla yönlendirilmelisiniz. Tarayıcı local storage alanında `tt_token` ve `tt_user` değerlerinin oluştuğunu doğrulayın.

---

## 2. Sipariş Oluşturma Testi
* **Amaç:** Yeni bir Aggregation siparişi oluşturmak.
* **Adımlar:**
  1. Sol menüden **Sipariş Yönetimi** sayfasına gidin.
  2. Sağ üstteki **+ Yeni Sipariş** butonuna tıklayın.
  3. Form alanlarını doldurun:
     * **Sipariş No:** Benzersiz bir numara (Örn: `WO-2026-001`)
     * **Firma / Müşteri:** Örn: `Lider Kozmetik`
     * **GTIN:** 14 haneli benzersiz GTIN (Örn: `04601234567890`)
     * **Stok Kodu:** Örn: `ST-9923`
     * **Stok İsmi:** Örn: `Sprey Deodorant 150ml`
     * **Miktar (Adet):** Toplam üretilecek ürün miktarı (Örn: `100`)
     * **Koli İçi Adet:** Her kolide olacak ürün adeti (Örn: `20`)
     * **Palet İçi Koli:** Her palette olacak koli adeti (Örn: `5`)
  4. **Kaydet** butonuna tıklayın.
     * *Beklenen Sonuç:* Siparişin "Draft" (Taslak) durumunda listeye eklendiğini görün.

---

## 3. Toplu Kod Yükleme Testleri (TXT & XLSX)

### A. TXT Kod Yükleme
* **Amaç:** Rusya Kozmetik standartlarında GS1 DataMatrix içeren TXT dosyasını yüklemek.
* **Adımlar:**
  1. Daha önce oluşturduğunuz siparişin satırındaki **İşlemler -> Kod Yükle** seçeneğine tıklayın.
  2. Bilgisayarınızdan satır bazlı DataMatrix kodları içeren bir `.txt` dosyası seçin.
  3. **Yükle** butonuna tıklayın.
     * *Beklenen Sonuç:* Dosyadaki geçerli ve geçersiz kod sayıları özetlenmeli, valid olanlar PostgreSQL'e saniyeler içinde yazılmalıdır.

### B. Excel (XLSX) Kod Yükleme
* **Amaç:** Excel formatında hazırlanan kod listesini sorunsuz yüklemek.
* **Geliştirilen Toleranslar:** Başlık satırı otomatik atlanır, boş satırlar hata olarak sayılmaz, sayısal görünen uzun barkodlar bilimsel gösterime (4.6E+13) dönüşmeden string olarak korunur.
* **Adımlar:**
  1. Başka bir taslak sipariş seçin.
  2. **Kod Yükle** penceresinden bir `.xlsx` dosyası yükleyin.
  3. Dosyada ilk satırda header ("Barkod", "GTIN" vb.) olmasına dikkat edin. Bazı hücreleri sayısal, bazılarını text olarak formatlayın.
     * *Beklenen Sonuç:* Excel içerisindeki kodlar hatasız parse edilmeli; bilimsel gösterim hatası olmadan ve boş satırlar geçersiz sayılmadan PostgreSQL'e aktarılmalıdır.

---

## 4. Barkod Okutma ve Koli Kapatma (Scan) Testi
* **Amaç:** Operatörün barkod okutma akışını, sesli/görsel uyarıları ve otomatik koli kapanmasını test etmek.
* **Adımlar:**
  1. Sipariş Yönetimi sayfasından siparişinizi **Aktifleştir** (Activate) butonuyla aktif üretime alın.
  2. Sol menüden **Ürün Okutma (Scan)** sayfasına gidin.
  3. Aktif siparişi listeden seçin.
  4. Sayfada herhangi bir yere odaklanıp barkod okuyucuyla (veya elle girerek) geçerli bir ürün DataMatrix barkodu okutun.
     * *Beklenen Sonuç:* Başarılı bip sesi gelmeli, ekran yeşil flaş yapmalı, okutulan ürün koli listesinde görünmelidir.
  5. Aynı barkodu tekrar okutun.
     * *Beklenen Sonuç:* Hata/Buzzer sesi gelmeli, ekran kırmızı flaş yapmalı ve "Bu barkod zaten okutulmuş!" uyarısı çıkmalıdır.
  6. Koli içi adet sınırına (Örn: 20) ulaşana kadar okutmaya devam edin.
     * *Beklenen Sonuç:* 20. barkod okutulduğunda sistem koli hedefine ulaşmalı, otomatik olarak koliyi kapatıp yeni bir **SSCC** kodu üretmeli ve sıradaki koliye geçiş yapmalıdır.

---

## 5. Koli & Palet Etiket İndirme Testleri (Yeni Blob Metodu)
* **Amaç:** PDF etiketlerin pop-up engelleyicilere takılmadan tarayıcıya indirilmesini test etmek.

### A. Koli PDF İndirme
1. Sol menüden **Koli Yönetimi** sayfasına gidin.
2. Listelenen kolilerden birinin yanındaki **Detay** butonuna tıklayın.
3. Detay panelindeki **PDF Etiketi İndir** butonuna tıklayın.
   * *Beklenen Sonuç:* Tarayıcıda yeni boş bir sayfa/sekme açılmaya çalışılmamalıdır. Doğrudan `koli_etiketi_[ID].pdf` isimli PDF dosyası bilgisayarınıza inmelidir.

### B. Palet PDF İndirme
1. Sol menüden **Palet Yönetimi** sayfasına gidin.
2. Bir palet detayına girip **PDF Etiketi İndir** butonuna tıklayın.
   * *Beklenen Sonuç:* Palet etiketi pop-up engeline takılmadan doğrudan `palet_etiketi_[ID].pdf` olarak indirilmelidir.

---

## 6. Standart DataMatrix Üretici (Yeni Sayfa) Testi
* **Amaç:** Yeni eklenen DataMatrix Üretici sayfasının kare formatta PDF/ZIP çıktılarını doğrulamak.
* **Adımlar:**
  1. Sol menüden **DataMatrix Üretici** sayfasına tıklayın.
  2. Sürükle-bırak alanına satır bazlı barkod içeren bir `.txt` dosyası bırakın.
     * *Beklenen Sonuç:* "Analiz Sonuçları" panelinde toplam, geçerli ve hatalı satır sayıları görünmeli, varsa hatalı satırlar listelenmelidir. Sağ panelde ilk barkodun **kare** önizleme resmi görünmelidir.
  3. Çıktı Formatı olarak **PDF Tablosu** seçin, ızgara ayarlarını `1x1` yapın.
  4. **PDF Şablonu İndir** butonuna tıklayın.
     * *Beklenen Sonuç:* İnen PDF dosyasındaki her sayfanın ve barkodun **tam kare** olduğunu doğrulayın (1x1 dahil).
  5. Çıktı Formatını **Bireysel PNG'ler (ZIP)** olarak değiştirip **ZIP formatında PNG'leri İndir** butonuna tıklayın.
     * *Beklenen Sonuç:* İnen ZIP dosyası arşivden çıkarıldığında içinde `dm_000001.png` gibi adlandırılmış kare PNG resimleri yer almalıdır.

---

## 7. API Sağlık (/health) Testi
* **Amaç:** Backend API'nin ve veritabanı bağlantısının canlı olduğunu teyit etmek.
* **Adımlar:**
  1. Tarayıcıdan `https://track-api.alperates.com.tr/health` (veya lokalde `/health`) adresine gidin.
     * *Beklenen Sonuç:* HTTP 200 OK durum koduyla birlikte aşağıdaki JSON dönmelidir:
       ```json
       {
         "status": "Healthy",
         "database": "Healthy",
         "timestamp": "..."
       }
       ```

---

## 8. Sipariş Yönetimi (Premium UI) ve Kod Sayfalama Testi
* **Amaç:** Yenilenen Sipariş Yönetimi ekranının, DataGrid tablo yapısının, sağ açılır (Drawer) panelin ve Dapper tabanlı kod sayfalamasının çalıştığını teyit etmek.
* **Adımlar:**
  1. Sol menüden **Sipariş Yönetimi** sayfasına gidin.
  2. Sayfanın en üstünde "Toplam Sipariş, Aktif Sipariş (Bu Sayfa), Tamamlanan (Bu Sayfa), Ortalama Tamamlanma" özet kartlarının doğru verileri gösterdiğini kontrol edin.
  3. Siparişler tablosunda (DataGrid) "İş Emri No" sütununun göründüğünden ve GTIN ibaresinin kaldırıldığından emin olun.
  4. Tablodaki herhangi bir sipariş satırına veya en sağdaki **Detay** butonuna tıklayın.
     * *Beklenen Sonuç:* Ekranın sağından pürüzsüz bir animasyonla **Sipariş Detayı (Drawer)** paneli açılmalıdır. Arka plan hafifçe karararak (Overlay) dikkati panele çekmelidir.
  5. Paneldeki **Özet** sekmesinde siparişe ait ilerleme çubuğu, hedefler, koli içi ve açıklama bilgilerinin göründüğünü teyit edin.
  6. Paneldeki **Kodlar** sekmesine tıklayın.
     * *Beklenen Sonuç:* Eğer siparişe ait barkodlar varsa, bunlar 50'şerli (Server-side) sayfalama ile listelenmelidir.
  7. Kodlar sekmesindeki **Arama** çubuğuna mevcut bir kodun (veya Seri No'nun) son birkaç hanesini girip **Ara** butonuna basın.
     * *Beklenen Sonuç:* Dapper endpoint `/api/orders/{id}/product-codes` aranarak sadece eşleşen sonuçları getirmeli ve arama oldukça hızlı sonuçlanmalıdır.
  8. Sağ üstteki çarpı (`X`) veya arka plan (Overlay) boşluğuna tıklayarak Drawer panelini kapatın.

---

## 9. Hata Durumunda İzlenecek Adımlar & Loglar
Eğer yukardaki adımlardan herhangi birinde hata alınırsa veya indirme işlemleri gerçekleşmezse:
1. **Tarayıcı Konsolu (Console):** `F12 -> Console` sekmesine basarak kırmızı renkli hata loglarını kontrol edin (CORS hataları, TypeError vb.).
2. **Network Sekmesi:** `F12 -> Network` sekmesinden başarısız olan (kırmızı yanan) HTTP isteklerini inceleyin. İstek detayındaki `Response` sekmesi hatanın backend'deki gerçek sebebini gösterir.
3. **Sunucu Logları (Coolify / Docker):**
   * Canlı sunucuda Coolify arayüzüne girin.
   * `track-trace` projesinin altındaki `api` servisini seçin.
   * **Logs** sekmesine tıklayarak .NET uygulamasının console çıktılarını ve Serilog hata kayıtlarını inceleyin.
   * PostgreSQL bağlantı hataları veya dosya okuma izin hataları doğrudan burada görüntülenecektir.
