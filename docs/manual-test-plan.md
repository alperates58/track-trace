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
* **Amaç:** Operatörün yenilenen Ürün Okutma Terminali ekranı akışını, odaklanma davranışlarını, sesli/görsel uyarıları, etiket indirme ve koli kapatma süreçlerini test etmek.
* **Adımlar:**
  1. Sol menüden veya Sipariş detayından yönlendirmeyle **Ürün Okutma (Scan)** sayfasına gidin.
  2. Sağ üstte API Bağlantı durumunun "Çevrimiçi" (yeşil) olduğunu ve giriş yapan "Operatör" adını doğrulayın.
  3. Üst panelden ilk dropdown yardımıyla aktif bir **Sipariş No** seçin.
     * *Beklenen Sonuç:* Siparişe ait müşteri adı sipariş no yanında görünmeli ve ikinci dropdown (Ürün/Stok/İş Emri) aktif hale gelmelidir.
  4. İkinci dropdown'dan okutulacak ürünü seçin (Format: Stok Kodu - Ürün Adı - İş Emri No - Okutulan/Hedef).
     * *Beklenen Sonuç:* Ürün seçildiği an, gizli okuma input'u otomatik olarak odak (focus) almalı ve üst paneldeki odak göstergesi **"Odak Aktif"** (yeşil) durumuna geçmelidir.
  5. Tarayıcıda başka bir yere tıklayarak odağı kaybettirin.
     * *Beklenen Sonuç:* Gösterge yanıp sönen turuncu/kırmızı renkle **"Odak Kayboldu / Tıkla veya F8 ile odakla"** uyarısı vermelidir. Klavye üzerinden **`F8`** tuşuna basın ve odağın anında geri geldiğini (`Odak Aktif` olduğunu) doğrulayın.
  6. Geçerli bir ürün DataMatrix barkodu okutun veya elle yazıp Enter'a basın.
     * *Beklenen Sonuç:* Tiz bir başarı sesi gelmeli, ekran yeşil renkte yanıp sönmeli ("BAŞARILI OKUMA" yazmalı) ve okutulan barkod ile Seri No bilgisi sağdaki "Okutma Geçmişi" listesine eklenmelidir.
  7. Aynı barkodu tekrar okutun (Mükerrer Okutma Testi).
     * *Beklenen Sonuç:* Kalın bir buzzer hata sesi gelmeli, ekran kırmızı renkte yanıp sönmeli ("HATALI OKUMA" yazmalı) ve "Bu ürün barkodu daha önce okutulmuş!" uyarısı çıkmalıdır.
  8. Farklı bir siparişin veya sisteme kayıtlı olmayan rastgele bir kodun okumasını yapın.
     * *Beklenen Sonuç:* Hata sesiyle birlikte ekranda "Sistemde kayıtlı olmayan ürün barkodu!" veya "Barkod bu siparişe ait değil!" hatası görünmelidir.
  9. Genel Sipariş İlerlemesi ve Aktif Koli İlerlemesi kartlarındaki adetlerin, progress barların ve yüzdelerin her başarılı okumada anlık olarak güncellendiğini doğrulayın.
  10. Koli içi adet hedefine (Örn: 20) ulaşana kadar okutmaya devam edin.
      * *Beklenen Sonuç:* Hedef sayıya (20/20) ulaşıldığında ekran mor/kehribar renge bürünerek **"KOLİ TAMAMLANDI"** uyarısı vermeli, aktif koli kapatılmalı ve son kapatılan koli bilgileri son koli kartında görünmelidir.
  11. Son Kapatılan Koli kartında beliren **PDF İndir** butonuna tıklayın.
      * *Beklenen Sonuç:* Pop-up engelleyicilerine takılmadan `carton_label_[KoliNo].pdf` dosyası doğrudan bilgisayara inmelidir.
  12. **ZPL Kopyala** butonuna tıklayın.
      * *Beklenen Sonuç:* Koliye ait ZPL şablonu işletim sistemi panosuna başarıyla kopyalanmalı ve kullanıcıya uyarı gösterilmelidir.
  13. Tarayıcı penceresini daraltarak mobil/tablet görünümünde sol terminal kartı ile sağ geçmiş listesinin alt alta düzgünce hizalandığını (responsive grid) doğrulayın.
  14. Sayfayı yenileyip (Refresh) tekrar sipariş ve ürün seçimi yapılabildiğini, odaklama ve okuma akışının kaldığı yerden devam ettiğini doğrulayın.

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
