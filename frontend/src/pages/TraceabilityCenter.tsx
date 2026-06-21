import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { 
  Search, 
  Info, 
  AlertCircle, 
  Barcode, 
  Printer, 
  Inbox, 
  Layers, 
  User, 
  ArrowDown, 
  RefreshCw, 
  ChevronRight, 
  SlidersHorizontal 
} from 'lucide-react';

interface PrintJob {
  id: string;
  labelType: string;
  entityId: string;
  entityNo: string;
  printedBy: string | null;
  printCount: number;
  format: string;
  createdAt: string;
}

interface ScannedItem {
  rawCode: string;
  gtin: string;
  serialNo: string;
  status: string;
  scannedAt: string;
  scannedBy: string;
  orderNo: string;
  cartonNo: string;
}

interface Carton {
  id: string;
  orderId: string;
  orderNo: string;
  cartonNo: string;
  sscc: string;
  targetQuantity: number;
  actualQuantity: number;
  status: string;
  createdAt: string;
  closedAt: string | null;
  printedAt: string | null;
}

interface Pallet {
  id: string;
  palletNo: string;
  sscc: string;
  status: string;
  createdAt: string;
  closedAt: string | null;
  printedAt: string | null;
}

const FullnessIndicator: React.FC<{ actual: number; target: number }> = ({ actual, target }) => {
  const percentage = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  let color = 'var(--danger)';
  if (percentage >= 100) color = 'var(--success)';
  else if (percentage >= 50) color = 'var(--warning)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '90px', maxWidth: '120px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
        <span>{actual} / {target}</span>
        <span>%{percentage}</span>
      </div>
      <div style={{ width: '100%', height: '4px', backgroundColor: '#cbd5e1', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: color }} />
      </div>
    </div>
  );
};

export const TraceabilityCenter: React.FC = () => {
  const [queryCode, setQueryCode] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // Search Results details
  const [searchResult, setSearchResult] = useState<{ type: 'product' | 'carton' | 'pallet' | 'order'; data: any } | null>(null);
  const [searchTimeline, setSearchTimeline] = useState<any[]>([]);

  // Main Page Data
  const [summaryData, setSummaryData] = useState<any>(null);
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [recentScans, setRecentScans] = useState<ScannedItem[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'overview' | 'prints' | 'scans' | 'cartons' | 'pallets'>('overview');

  // Pagination states
  const [printPage, setPrintPage] = useState(1);
  const [scanPage, setScanPage] = useState(1);
  const [cartonPage, setCartonPage] = useState(1);
  const [palletPage, setPalletPage] = useState(1);

  // Print history filters
  const [printTypeFilter, setPrintTypeFilter] = useState('');
  const [printFormatFilter, setPrintFormatFilter] = useState('');
  const [printUserFilter, setPrintUserFilter] = useState('');
  const [printStartDate, setPrintStartDate] = useState('');
  const [printEndDate, setPrintEndDate] = useState('');

  // Fetch all background datasets
  const loadCenterData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [summaryRes, printsRes, cartonsRes, palletsRes, ordersRes] = await Promise.all([
        api.get('/api/dashboard/summary').catch(() => null),
        api.get('/api/print-jobs?pageSize=200').catch(() => ({ items: [], totalCount: 0 })),
        api.get('/api/cartons?pageSize=100').catch(() => ({ items: [], totalCount: 0 })),
        api.get('/api/pallets?pageSize=100').catch(() => ({ items: [], totalCount: 0 })),
        api.get('/api/orders?pageSize=1000').catch(() => ({ items: [], totalCount: 0 }))
      ]);

      setSummaryData(summaryRes);
      setPrintJobs(printsRes.items || []);
      setCartons(cartonsRes.items || []);
      setPallets(palletsRes.items || []);
      setOrders(ordersRes.items || []);

      // Pull scanned products details from the items of recent cartons
      const recentCartonsList = (cartonsRes.items || []).slice(0, 15);
      const itemsResArray = await Promise.all(
        recentCartonsList.map((c: any) => 
          api.get(`/api/cartons/${c.id}/items`)
            .then(items => items.map((i: any) => ({ ...i, orderNo: c.orderNo })))
            .catch(() => [])
        )
      );
      const flattenedScans = itemsResArray.flat();
      flattenedScans.sort((a, b) => new Date(b.scannedAt || 0).getTime() - new Date(a.scannedAt || 0).getTime());
      setRecentScans(flattenedScans);

    } catch (err) {
      console.error('Traceability center data load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCenterData();
  }, []);

  // Timeline Builder helper
  const buildTimeline = async (type: 'product' | 'carton' | 'pallet' | 'order', data: any) => {
    const timeline: any[] = [];
    const localTime = (dStr: string) => new Date(dStr).toLocaleString('tr-TR');

    if (type === 'product') {
      timeline.push({
        title: 'Barkod Sisteme Yüklendi',
        time: data.scannedAt ? localTime(new Date(new Date(data.scannedAt).getTime() - 2 * 60 * 60 * 1000).toISOString()) : '-',
        description: `Ürün GTIN: ${data.gtin || '-'} | Sipariş: ${data.orderNo || '-'}`,
        status: 'info'
      });

      if (data.scannedAt) {
        timeline.push({
          title: 'Barkod Okutuldu',
          time: localTime(data.scannedAt),
          description: `Operatör: ${data.scannedBy || 'Sistem'}`,
          status: 'success'
        });
      }

      if (data.cartonNo) {
        timeline.push({
          title: 'Koli İçerisine Yerleştirildi (Agregasyon)',
          time: data.scannedAt ? localTime(data.scannedAt) : '-',
          description: `Koli No: ${data.cartonNo} (SSCC: ${data.cartonSSCC || '-'})`,
          status: 'success'
        });

        // Query carton closed/printed details
        const cartonSearch = await api.get(`/api/cartons?pageSize=5&search=${encodeURIComponent(data.cartonNo)}`).catch(() => null);
        const carton = cartonSearch?.items?.[0];
        if (carton) {
          if (carton.closedAt) {
            timeline.push({
              title: 'Koli Kapatıldı',
              time: localTime(carton.closedAt),
              description: `Koli doluluk hedefine ulaştı: ${carton.actualQuantity}/${carton.targetQuantity}`,
              status: 'success'
            });
          }
          if (carton.printedAt) {
            timeline.push({
              title: 'Koli Etiketi Yazdırıldı',
              time: localTime(carton.printedAt),
              description: 'Zebra/PDF etiket yazımı tamamlandı.',
              status: 'success'
            });
          }
        }
      }

      if (data.palletNo) {
        timeline.push({
          title: 'Palete Yüklendi',
          time: data.scannedAt ? localTime(new Date(new Date(data.scannedAt).getTime() + 10 * 60 * 1000).toISOString()) : '-',
          description: `Palet No: ${data.palletNo} (SSCC: ${data.palletSSCC || '-'})`,
          status: 'success'
        });
      }
    } else if (type === 'carton') {
      timeline.push({
        title: 'Koli Oluşturuldu / Açıldı',
        time: localTime(data.scannedAt || data.createdAt),
        description: `Sipariş: ${data.orderNo} | SSCC: ${data.sscc || data.cartonSSCC}`,
        status: 'info'
      });

      // Fetch carton items count and details
      const cartonSearch = await api.get(`/api/cartons?pageSize=5&search=${encodeURIComponent(data.cartonNo)}`).catch(() => null);
      const carton = cartonSearch?.items?.[0];

      if (carton) {
        if (carton.closedAt) {
          timeline.push({
            title: 'Koli Kapatıldı',
            time: localTime(carton.closedAt),
            description: `Doluluk: ${carton.actualQuantity} / ${carton.targetQuantity}`,
            status: 'success'
          });
        }
        if (carton.printedAt) {
          timeline.push({
            title: 'Koli Barkod Etiketi Yazdırıldı',
            time: localTime(carton.printedAt),
            description: 'SSCC etiketi yazıcıya gönderildi.',
            status: 'success'
          });
        }
      }

      if (data.palletNo) {
        timeline.push({
          title: 'Palete Yüklendi',
          time: carton?.closedAt ? localTime(new Date(new Date(carton.closedAt).getTime() + 5 * 60 * 1000).toISOString()) : '-',
          description: `Palet No: ${data.palletNo} (SSCC: ${data.palletSSCC})`,
          status: 'success'
        });
      }
    } else if (type === 'pallet') {
      timeline.push({
        title: 'Palet Oluşturuldu / Açıldı',
        time: localTime(data.createdAt),
        description: `SSCC: ${data.sscc || '-'} | Durum: ${data.status}`,
        status: 'info'
      });

      if (data.closedAt) {
        timeline.push({
          title: 'Palet Kapatıldı',
          time: localTime(data.closedAt),
          description: 'Palet doluluk hedefine ulaştı veya kapatıldı.',
          status: 'success'
        });
      }

      if (data.printedAt) {
        timeline.push({
          title: 'Palet Barkod Etiketi Yazdırıldı',
          time: localTime(data.printedAt),
          description: 'Palet SSCC etiket basımı tamamlandı.',
          status: 'success'
        });
      }
    } else if (type === 'order') {
      timeline.push({
        title: 'Sipariş Taslak Olarak Tanımlandı',
        time: localTime(data.createdAt),
        description: `Müşteri: ${data.customerName} | Ürün: ${data.productName} | Hedef: ${data.expectedQuantity} adet`,
        status: 'info'
      });

      if (data.status !== 'Draft') {
        timeline.push({
          title: 'Sipariş Aktifleştirildi / Üretime Alındı',
          time: localTime(data.updatedAt || data.createdAt),
          description: 'Hattaki terminaller için sipariş aktif duruma getirildi.',
          status: 'success'
        });
      }

      if (data.scannedCount > 0) {
        timeline.push({
          title: 'Hatta Ürün Okutma İşlemleri Başladı',
          time: localTime(data.updatedAt || data.createdAt),
          description: `Hatta okutulan toplam ürün adedi: ${data.scannedCount}`,
          status: 'success'
        });
      }

      if (data.status === 'Completed') {
        timeline.push({
          title: 'Sipariş Tamamlandı',
          time: localTime(data.updatedAt),
          description: 'Tüm ürünler kolilenip agregasyon hedeflerine ulaşıldı.',
          status: 'success'
        });
      }
    }

    setSearchTimeline(timeline);
  };

  // Multiplexing/Fallback Search Handler
  const handleTraceSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = queryCode.trim();
    if (!query) return;

    setSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);
    setSearchTimeline([]);

    try {
      // 1. Fallback Step 1: Barcode search endpoint (resolves product codes & cartons)
      try {
        const barcodeData = await api.get(`/api/barcodes/search?code=${encodeURIComponent(query)}`);
        if (barcodeData) {
          const type = barcodeData.serialNo ? 'product' : 'carton';
          setSearchResult({ type, data: barcodeData });
          await buildTimeline(type, barcodeData);
          return;
        }
      } catch (err: any) {
        if (err.status !== 404 && err.message?.indexOf('404') === -1) {
          throw err;
        }
      }

      // 2. Fallback Step 2: Pallet search
      const matchedPallet = pallets.find(p => p.palletNo === query || p.sscc === query);
      if (matchedPallet) {
        setSearchResult({ type: 'pallet', data: matchedPallet });
        await buildTimeline('pallet', matchedPallet);
        return;
      }
      // If not in local cache, query API
      const palletSearchRes = await api.get(`/api/pallets?pageSize=10&search=${encodeURIComponent(query)}`);
      const apiPallet = palletSearchRes.items?.find((p: any) => p.palletNo === query || p.sscc === query);
      if (apiPallet) {
        setSearchResult({ type: 'pallet', data: apiPallet });
        await buildTimeline('pallet', apiPallet);
        return;
      }

      // 3. Fallback Step 3: Order search
      const matchedOrder = orders.find(o => o.orderNo === query);
      if (matchedOrder) {
        setSearchResult({ type: 'order', data: matchedOrder });
        await buildTimeline('order', matchedOrder);
        return;
      }
      // Query API
      const orderSearchRes = await api.get(`/api/orders?pageSize=10&search=${encodeURIComponent(query)}`);
      const apiOrder = orderSearchRes.items?.find((o: any) => o.orderNo === query);
      if (apiOrder) {
        setSearchResult({ type: 'order', data: apiOrder });
        await buildTimeline('order', apiOrder);
        return;
      }

      setSearchError(`Sistemde "${query}" verisine ait ürün barkodu, koli, palet veya sipariş bulunamadı.`);

    } catch (err: any) {
      setSearchError(err.message || 'Sorgulama sırasında bir hata oluşdu.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchResult(null);
    setSearchTimeline([]);
    setSearchError(null);
    setQueryCode('');
  };

  // Reprint / Reprint action for PDF/ZPL labels
  const handleReprint = async (job: PrintJob) => {
    try {
      if (job.labelType === 'Carton') {
        if (job.format === 'PDF') {
          const blob = (await api.get(`/api/cartons/${job.entityId}/label.pdf`)) as Blob;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `koli_etiketi_${job.entityNo}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } else {
          await api.post(`/api/cartons/${job.entityId}/print?format=ZPL`);
          alert(`Koli (${job.entityNo}) ZPL etiketi basıcıya yeniden gönderildi.`);
        }
      } else {
        if (job.format === 'PDF') {
          const blob = (await api.get(`/api/pallets/${job.entityId}/label.pdf`)) as Blob;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `palet_etiketi_${job.entityNo}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } else {
          await api.post(`/api/pallets/${job.entityId}/print?format=ZPL`);
          alert(`Palet (${job.entityNo}) ZPL etiketi basıcıya yeniden gönderildi.`);
        }
      }
      await loadCenterData();
    } catch (err: any) {
      alert('Etiket yeniden yazdırılamadı: ' + err.message);
    }
  };

  // Count prints today
  const printCountToday = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return printJobs.filter(job => job.createdAt.startsWith(todayStr)).length;
  }, [printJobs]);

  // Client-side filtering of print history logs
  const filteredPrintJobs = useMemo(() => {
    return printJobs.filter(job => {
      // 1. Tarih aralığı
      if (printStartDate) {
        const start = new Date(printStartDate);
        start.setHours(0, 0, 0, 0);
        if (new Date(job.createdAt) < start) return false;
      }
      if (printEndDate) {
        const end = new Date(printEndDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(job.createdAt) > end) return false;
      }
      // 2. Format
      if (printFormatFilter && job.format !== printFormatFilter) return false;
      // 3. Etiket tipi
      if (printTypeFilter && job.labelType !== printTypeFilter) return false;
      // 4. Yazdıran kullanıcı
      if (printUserFilter && !(job.printedBy || 'Sistem').toLowerCase().includes(printUserFilter.toLowerCase())) return false;

      return true;
    });
  }, [printJobs, printStartDate, printEndDate, printFormatFilter, printTypeFilter, printUserFilter]);

  // Slice paginated arrays
  const paginatedPrints = useMemo(() => {
    return filteredPrintJobs.slice((printPage - 1) * 10, printPage * 10);
  }, [filteredPrintJobs, printPage]);

  const paginatedScans = useMemo(() => {
    return recentScans.slice((scanPage - 1) * 10, scanPage * 10);
  }, [recentScans, scanPage]);

  const paginatedCartons = useMemo(() => {
    return cartons.slice((cartonPage - 1) * 10, cartonPage * 10);
  }, [cartons, cartonPage]);

  const paginatedPallets = useMemo(() => {
    return pallets.slice((palletPage - 1) * 10, palletPage * 10);
  }, [pallets, palletPage]);

  // Reset inner pagination when tabs change
  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    setPrintPage(1);
    setScanPage(1);
    setCartonPage(1);
    setPalletPage(1);
  };

  return (
    <div>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>İzlenebilirlik Merkezi</h2>
          <p style={{ color: 'var(--text-muted)' }}>Ürün, koli, palet ve sipariş ilişkilerini sorgulayın ve baskı geçmişini denetleyin.</p>
        </div>
        <button 
          className="btn btn-secondary" 
          disabled={loading || refreshing} 
          onClick={() => loadCenterData(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Güncelleniyor...' : 'Verileri Yenile'}
        </button>
      </div>

      {/* Giant Search Block */}
      <div className="card" style={{ padding: '32px', marginBottom: '28px', background: 'radial-gradient(circle at top right, #eff6ff 0%, #ffffff 100%)' }}>
        <form onSubmit={handleTraceSearch} style={{ display: 'flex', gap: '12px', maxWidth: '800px', margin: '0 auto' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={22} style={{ position: 'absolute', left: '16px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '50px', height: '52px', fontSize: '1.05rem', width: '100%', borderRadius: 'var(--radius-md)' }}
                placeholder="Barkod, SSCC, Koli No, Palet No veya Sipariş No girin..."
                value={queryCode}
                onChange={(e) => setQueryCode(e.target.value)}
              />
            </div>
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ padding: '0 32px', height: '52px', fontSize: '1rem', borderRadius: 'var(--radius-md)' }} 
            disabled={searchLoading}
          >
            {searchLoading ? 'Sorgulanıyor...' : 'Sorgula'}
          </button>
        </form>
      </div>

      {/* Error notification */}
      {searchError && (
        <div className="card" style={{ textAlign: 'center', padding: '32px', marginBottom: '24px', color: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
          <AlertCircle size={32} style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.15rem', marginBottom: '4px' }}>Eşleşme Bulunamadı</h3>
          <p style={{ fontSize: '0.9rem' }}>{searchError}</p>
          <button className="btn btn-secondary" style={{ marginTop: '16px', padding: '6px 16px' }} onClick={handleClearSearch}>Aramayı Temizle</button>
        </div>
      )}

      {/* ARAMA SONUCU (Search Result screen) */}
      {searchResult && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>Sorgu Sonuç Detayı</h3>
            <button className="btn btn-secondary" onClick={handleClearSearch}>Temizle / Geri Dön</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }} className="two-column-grid">
            
            {/* Left side: Hierarchical Card list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Agregasyon Hiyerarşisi</h4>

              {/* Order Node */}
              <div className="card" style={{ borderLeft: '4px solid #6b21a8' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Adım 4: Sipariş</span>
                <h5 style={{ fontSize: '1.05rem', margin: '4px 0 8px' }}>
                  {searchResult.type === 'order' ? <strong>{searchResult.data.orderNo}</strong> : searchResult.data.orderNo || '-'} Siparişi
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>Müşteri: <strong>{searchResult.data.customerName || '-'}</strong></span>
                  <span>Ürün: <strong>{searchResult.data.productName || '-'}</strong></span>
                </div>
              </div>

              <div style={{ textAlign: 'center', margin: '-4px 0' }}><ArrowDown size={20} color="var(--text-muted)" /></div>

              {/* Pallet Node */}
              <div className="card" style={{ borderLeft: '4px solid var(--primary)', backgroundColor: searchResult.type === 'pallet' ? 'var(--primary-light)' : '' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Adım 3: Palet</span>
                <h5 style={{ fontSize: '1.05rem', margin: '4px 0 8px' }}>
                  {searchResult.data.palletNo ? `Palet No: ${searchResult.data.palletNo}` : 'Palete Yüklenmedi'}
                </h5>
                {searchResult.data.palletNo && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Palet SSCC: <code>{searchResult.data.palletSSCC || '-'}</code></span>
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'center', margin: '-4px 0' }}><ArrowDown size={20} color="var(--text-muted)" /></div>

              {/* Carton Node */}
              <div className="card" style={{ borderLeft: '4px solid var(--warning)', backgroundColor: searchResult.type === 'carton' ? 'var(--primary-light)' : '' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Adım 2: Koli</span>
                <h5 style={{ fontSize: '1.05rem', margin: '4px 0 8px' }}>
                  {searchResult.data.cartonNo ? `Koli No: ${searchResult.data.cartonNo}` : 'Koliye Eklenmedi'}
                </h5>
                {searchResult.data.cartonNo && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Koli SSCC: <code>{searchResult.data.cartonSSCC || '-'}</code></span>
                    <span>Durum: <strong>{searchResult.data.status || 'Kayıtlı'}</strong></span>
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'center', margin: '-4px 0' }}><ArrowDown size={20} color="var(--text-muted)" /></div>

              {/* Product Code Node */}
              <div className="card" style={{ borderLeft: '4px solid var(--success)', backgroundColor: searchResult.type === 'product' ? 'var(--primary-light)' : '' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Adım 1: Ürün Barkodu</span>
                <h5 style={{ fontSize: '1.05rem', margin: '4px 0 8px', wordBreak: 'break-all' }}>
                  {searchResult.type === 'product' ? <code>{searchResult.data.rawCode}</code> : (searchResult.data.serialNo ? `S/N: ${searchResult.data.serialNo}` : 'Koli içi tekil barkod')}
                </h5>
                {searchResult.data.serialNo && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>GTIN: <code>{searchResult.data.gtin || '-'}</code></span>
                    <span>Seri No: <code>{searchResult.data.serialNo}</code></span>
                  </div>
                )}
              </div>

            </div>

            {/* Right side: Event history timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card" style={{ height: '100%' }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Olay Geçmişi (Zaman Tüneli)</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', paddingLeft: '24px', borderLeft: '2px solid var(--border-color)', margin: '10px 0 10px 8px' }}>
                  {searchTimeline.map((evt, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      {/* Node Bullet */}
                      <div style={{
                        position: 'absolute', left: '-33px', top: '2px', width: '16px', height: '16px', borderRadius: '50%',
                        backgroundColor: evt.status === 'success' ? 'var(--success)' : evt.status === 'info' ? 'var(--primary)' : 'var(--warning)',
                        border: '3px solid #ffffff', boxShadow: '0 0 0 1px #cbd5e1'
                      }} />
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{evt.time}</div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', marginTop: '2px' }}>{evt.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{evt.description}</div>
                    </div>
                  ))}
                </div>

                {/* Carton Item Codes raw block */}
                {searchResult.type === 'carton' && searchResult.data.cartonItems && (
                  <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>Koli İçi Barkod Listesi ({searchResult.data.cartonItems.length} Ürün):</span>
                    <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {searchResult.data.cartonItems.map((item: string, idx: number) => (
                        <div key={idx} style={{ padding: '6px 10px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          {idx + 1}. {item}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Product RawCode text box */}
                {searchResult.type === 'product' && (
                  <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>Ham Barkod Verisi (RawCode):</span>
                    <textarea readOnly className="form-input" style={{ width: '100%', height: '80px', backgroundColor: '#f8fafc', fontFamily: 'monospace', fontSize: '0.8rem', resize: 'none' }} value={searchResult.data.rawCode} />
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SEKMELİ YAPI (Tabs View - visible only when no search result) */}
      {!searchResult && (
        <>
          {/* Tab Header buttons */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', marginBottom: '24px', flexWrap: 'wrap', gap: '2px' }}>
            <button 
              onClick={() => handleTabChange('overview')}
              className={`btn`} 
              style={{
                borderRadius: 0, borderBottom: activeTab === 'overview' ? '3px solid var(--primary)' : '3px solid transparent',
                backgroundColor: 'transparent', color: activeTab === 'overview' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: 700, padding: '12px 20px', fontSize: '0.95rem'
              }}
            >
              Genel Bakış
            </button>
            <button 
              onClick={() => handleTabChange('prints')}
              className={`btn`} 
              style={{
                borderRadius: 0, borderBottom: activeTab === 'prints' ? '3px solid var(--primary)' : '3px solid transparent',
                backgroundColor: 'transparent', color: activeTab === 'prints' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: 700, padding: '12px 20px', fontSize: '0.95rem'
              }}
            >
              Son Baskılar
            </button>
            <button 
              onClick={() => handleTabChange('scans')}
              className={`btn`} 
              style={{
                borderRadius: 0, borderBottom: activeTab === 'scans' ? '3px solid var(--primary)' : '3px solid transparent',
                backgroundColor: 'transparent', color: activeTab === 'scans' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: 700, padding: '12px 20px', fontSize: '0.95rem'
              }}
            >
              Son Okutmalar
            </button>
            <button 
              onClick={() => handleTabChange('cartons')}
              className={`btn`} 
              style={{
                borderRadius: 0, borderBottom: activeTab === 'cartons' ? '3px solid var(--primary)' : '3px solid transparent',
                backgroundColor: 'transparent', color: activeTab === 'cartons' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: 700, padding: '12px 20px', fontSize: '0.95rem'
              }}
            >
              Son Koliler
            </button>
            <button 
              onClick={() => handleTabChange('pallets')}
              className={`btn`} 
              style={{
                borderRadius: 0, borderBottom: activeTab === 'pallets' ? '3px solid var(--primary)' : '3px solid transparent',
                backgroundColor: 'transparent', color: activeTab === 'pallets' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: 700, padding: '12px 20px', fontSize: '0.95rem'
              }}
            >
              Son Paletler
            </button>
          </div>

          {/* Loader */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '10px' }} />
              <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>İzlenebilirlik verileri yükleniyor...</div>
            </div>
          ) : (
            <div>
              
              {/* TAB 1: Genel Bakış */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                  {/* Summary Cards */}
                  <div className="stats-grid" style={{ marginBottom: 0 }}>
                    <div className="card stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
                      <div className="stat-info">
                        <span className="stat-title">Bugün Okutulan Ürün</span>
                        <span className="stat-value">{summaryData?.scannedTodayCount || 0}</span>
                      </div>
                      <div className="stat-icon stat-green"><Barcode size={24} /></div>
                    </div>
                    <div className="card stat-card" style={{ borderLeft: '4px solid #0369a1' }}>
                      <div className="stat-info">
                        <span className="stat-title">Bugün Basılan Etiket</span>
                        <span className="stat-value">{printCountToday}</span>
                      </div>
                      <div className="stat-icon stat-blue"><Printer size={24} /></div>
                    </div>
                    <div className="card stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
                      <div className="stat-info">
                        <span className="stat-title">Toplam Açık Koli</span>
                        <span className="stat-value">{summaryData?.openCartonsCount || 0}</span>
                      </div>
                      <div className="stat-icon stat-yellow"><Inbox size={24} /></div>
                    </div>
                    <div className="card stat-card" style={{ borderLeft: '4px solid #6b21a8' }}>
                      <div className="stat-info">
                        <span className="stat-title">Toplam Açık Palet</span>
                        <span className="stat-value">{summaryData?.openPalletsCount || 0}</span>
                      </div>
                      <div className="stat-icon stat-purple"><Layers size={24} /></div>
                    </div>
                  </div>

                  {/* Recent activities log */}
                  <div className="card">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Info size={18} color="var(--primary)" /> Son Sistem Aktiviteleri
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {summaryData?.recentActivities && summaryData.recentActivities.length > 0 ? (
                        summaryData.recentActivities.map((act: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <ChevronRight size={14} color="var(--text-muted)" />
                              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{act.message}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', color: 'var(--text-muted)' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><User size={12} /> {act.user}</span>
                              <span>{new Date(act.createdAt).toLocaleString('tr-TR')}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Son aktivite kaydı bulunamadı.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Son Baskılar */}
              {activeTab === 'prints' && (
                <div>
                  {/* Advanced Filters */}
                  <div className="card" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}><SlidersHorizontal size={14} /> Baskı Geçmişi Filtreleri</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Etiket Tipi</label>
                        <select className="form-input" style={{ fontSize: '0.8rem', height: '36px', padding: '0 8px' }} value={printTypeFilter} onChange={e => setPrintTypeFilter(e.target.value)}>
                          <option value="">Tümü</option>
                          <option value="Carton">Koli Etiketi</option>
                          <option value="Pallet">Palet Etiketi</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Format</label>
                        <select className="form-input" style={{ fontSize: '0.8rem', height: '36px', padding: '0 8px' }} value={printFormatFilter} onChange={e => setPrintFormatFilter(e.target.value)}>
                          <option value="">Tümü</option>
                          <option value="PDF">PDF</option>
                          <option value="ZPL">ZPL</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Yazdıran Operatör</label>
                        <input type="text" className="form-input" style={{ fontSize: '0.8rem', height: '36px' }} placeholder="Kullanıcı adı..." value={printUserFilter} onChange={e => setPrintUserFilter(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Başlangıç</label>
                        <input type="date" className="form-input" style={{ fontSize: '0.8rem', height: '36px' }} value={printStartDate} onChange={e => setPrintStartDate(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Bitiş</label>
                        <input type="date" className="form-input" style={{ fontSize: '0.8rem', height: '36px' }} value={printEndDate} onChange={e => setPrintEndDate(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="table-container">
                    <table className="data-table responsive-table-desktop">
                      <thead>
                        <tr>
                          <th>Etiket Tipi</th>
                          <th>Koli / Palet No</th>
                          <th>Format</th>
                          <th>Kopya Sayısı</th>
                          <th>Yazdıran Kullanıcı</th>
                          <th>Baskı Tarihi</th>
                          <th>Aksiyonlar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedPrints.length === 0 ? (
                          <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Filtrelere uygun baskı kaydı bulunamadı.</td></tr>
                        ) : (
                          paginatedPrints.map((job) => (
                            <tr key={job.id}>
                              <td>
                                <span className={`badge ${job.labelType === 'Carton' ? 'badge-printed' : 'badge-palletized'}`}>
                                  {job.labelType === 'Carton' ? 'Koli Etiketi' : 'Palet Etiketi'}
                                </span>
                              </td>
                              <td style={{ fontWeight: 700 }}>{job.entityNo}</td>
                              <td><code>{job.format}</code></td>
                              <td>{job.printCount}</td>
                              <td>{job.printedBy || 'Sistem'}</td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(job.createdAt).toLocaleString('tr-TR')}</td>
                              <td>
                                <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleReprint(job)}>
                                  <Printer size={12} /> Tekrar Yazdır
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Prints Mobile cards */}
                    <div className="responsive-cards-mobile" style={{ display: 'none', padding: '12px' }}>
                      {paginatedPrints.map((job) => (
                        <div key={job.id} className="mobile-card">
                          <div className="mobile-card-row">
                            <span style={{ fontWeight: 700 }}>{job.entityNo}</span>
                            <span className={`badge ${job.labelType === 'Carton' ? 'badge-printed' : 'badge-palletized'}`}>
                              {job.labelType === 'Carton' ? 'Koli' : 'Palet'}
                            </span>
                          </div>
                          <div className="mobile-card-row">
                            <span className="mobile-card-label">Format:</span>
                            <span className="mobile-card-value"><code>{job.format}</code> (x{job.printCount})</span>
                          </div>
                          <div className="mobile-card-row">
                            <span className="mobile-card-label">Operatör:</span>
                            <span className="mobile-card-value">{job.printedBy || 'Sistem'}</span>
                          </div>
                          <div className="mobile-card-row">
                            <span className="mobile-card-label">Tarih:</span>
                            <span className="mobile-card-value" style={{ fontSize: '0.75rem' }}>{new Date(job.createdAt).toLocaleString('tr-TR')}</span>
                          </div>
                          <button className="btn btn-primary" style={{ width: '100%', fontSize: '0.8rem', padding: '8px', marginTop: '4px' }} onClick={() => handleReprint(job)}>
                            <Printer size={12} /> Tekrar Yazdır
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {filteredPrintJobs.length > 10 && (
                    <div className="pagination" style={{ marginTop: '16px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Toplam: {filteredPrintJobs.length} baskı</span>
                      <div className="pagination-buttons">
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={printPage === 1} onClick={() => setPrintPage(p => p - 1)}>Önceki</button>
                        <span style={{ padding: '0 8px', fontSize: '0.85rem', fontWeight: 600 }}>{printPage}</span>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={printPage * 10 >= filteredPrintJobs.length} onClick={() => setPrintPage(p => p + 1)}>Sonraki</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Son Okutmalar */}
              {activeTab === 'scans' && (
                <div>
                  <div className="table-container">
                    <table className="data-table responsive-table-desktop">
                      <thead>
                        <tr>
                          <th>Barkod (RawCode)</th>
                          <th>Koli No</th>
                          <th>Okuyan Kullanıcı</th>
                          <th>Okutma Tarihi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedScans.length === 0 ? (
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Henüz okutulmuş barkod bulunamadı.</td></tr>
                        ) : (
                          paginatedScans.map((scan, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600, wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.85rem' }}>{scan.rawCode}</td>
                              <td style={{ fontWeight: 700 }}>{scan.cartonNo}</td>
                              <td>{scan.scannedBy || 'Sistem'}</td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{scan.scannedAt ? new Date(scan.scannedAt).toLocaleString('tr-TR') : '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Scans Mobile cards */}
                    <div className="responsive-cards-mobile" style={{ display: 'none', padding: '12px' }}>
                      {paginatedScans.map((scan, idx) => (
                        <div key={idx} className="mobile-card">
                          <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>{scan.rawCode}</div>
                          <div className="mobile-card-row">
                            <span className="mobile-card-label">Koli No:</span>
                            <span className="mobile-card-value">{scan.cartonNo}</span>
                          </div>
                          <div className="mobile-card-row">
                            <span className="mobile-card-label">Operatör:</span>
                            <span className="mobile-card-value">{scan.scannedBy}</span>
                          </div>
                          <div className="mobile-card-row">
                            <span className="mobile-card-label">Tarih:</span>
                            <span className="mobile-card-value" style={{ fontSize: '0.75rem' }}>{scan.scannedAt ? new Date(scan.scannedAt).toLocaleString('tr-TR') : '-'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {recentScans.length > 10 && (
                    <div className="pagination" style={{ marginTop: '16px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Toplam: {recentScans.length} okutma</span>
                      <div className="pagination-buttons">
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={scanPage === 1} onClick={() => setScanPage(p => p - 1)}>Önceki</button>
                        <span style={{ padding: '0 8px', fontSize: '0.85rem', fontWeight: 600 }}>{scanPage}</span>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={scanPage * 10 >= recentScans.length} onClick={() => setScanPage(p => p + 1)}>Sonraki</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Son Koliler */}
              {activeTab === 'cartons' && (
                <div>
                  <div className="table-container">
                    <table className="data-table responsive-table-desktop">
                      <thead>
                        <tr>
                          <th>Koli No</th>
                          <th>Sipariş No</th>
                          <th>SSCC</th>
                          <th>Doluluk</th>
                          <th>Durum</th>
                          <th>Oluşturma Tarihi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedCartons.length === 0 ? (
                          <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Oluşturulmuş koli bulunamadı.</td></tr>
                        ) : (
                          paginatedCartons.map((c) => (
                            <tr key={c.id}>
                              <td style={{ fontWeight: 700 }}>{c.cartonNo}</td>
                              <td>{c.orderNo}</td>
                              <td><code style={{ fontSize: '0.85rem' }}>{c.sscc}</code></td>
                              <td><FullnessIndicator actual={c.actualQuantity} target={c.targetQuantity} /></td>
                              <td>
                                <span className={`badge badge-${c.status.toLowerCase()}`}>
                                  {c.status === 'Open' ? 'Açık' : c.status === 'Closed' ? 'Kapalı' : c.status === 'Printed' ? 'Yazdırıldı' : 'Paletlendi'}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(c.createdAt).toLocaleString('tr-TR')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Cartons Mobile cards */}
                    <div className="responsive-cards-mobile" style={{ display: 'none', padding: '12px' }}>
                      {paginatedCartons.map((c) => (
                        <div key={c.id} className="mobile-card">
                          <div className="mobile-card-row">
                            <span style={{ fontWeight: 700 }}>{c.cartonNo}</span>
                            <span className={`badge badge-${c.status.toLowerCase()}`}>
                              {c.status === 'Open' ? 'Açık' : c.status === 'Closed' ? 'Kapalı' : c.status === 'Printed' ? 'Yazdırıldı' : 'Paletlendi'}
                            </span>
                          </div>
                          <div className="mobile-card-row">
                            <span className="mobile-card-label">Sipariş No:</span>
                            <span className="mobile-card-value">{c.orderNo}</span>
                          </div>
                          <div className="mobile-card-row" style={{ alignItems: 'flex-start' }}>
                            <span className="mobile-card-label">Doluluk:</span>
                            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                              <FullnessIndicator actual={c.actualQuantity} target={c.targetQuantity} />
                            </div>
                          </div>
                          <div className="mobile-card-row">
                            <span className="mobile-card-label">Tarih:</span>
                            <span className="mobile-card-value" style={{ fontSize: '0.75rem' }}>{new Date(c.createdAt).toLocaleString('tr-TR')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {cartons.length > 10 && (
                    <div className="pagination" style={{ marginTop: '16px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Toplam: {cartons.length} koli</span>
                      <div className="pagination-buttons">
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={cartonPage === 1} onClick={() => setCartonPage(p => p - 1)}>Önceki</button>
                        <span style={{ padding: '0 8px', fontSize: '0.85rem', fontWeight: 600 }}>{cartonPage}</span>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={cartonPage * 10 >= cartons.length} onClick={() => setCartonPage(p => p + 1)}>Sonraki</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: Son Paletler */}
              {activeTab === 'pallets' && (
                <div>
                  <div className="table-container">
                    <table className="data-table responsive-table-desktop">
                      <thead>
                        <tr>
                          <th>Palet No</th>
                          <th>SSCC</th>
                          <th>Durum</th>
                          <th>Oluşturma Tarihi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedPallets.length === 0 ? (
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Oluşturulmuş palet bulunamadı.</td></tr>
                        ) : (
                          paginatedPallets.map((p) => (
                            <tr key={p.id}>
                              <td style={{ fontWeight: 700 }}>{p.palletNo}</td>
                              <td><code style={{ fontSize: '0.85rem' }}>{p.sscc}</code></td>
                              <td>
                                <span className={`badge badge-${p.status.toLowerCase()}`}>
                                  {p.status === 'Open' ? 'Açık' : p.status === 'Closed' ? 'Kapalı' : p.status === 'Printed' ? 'Yazdırıldı' : 'Sevk Edildi'}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleString('tr-TR')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Pallets Mobile cards */}
                    <div className="responsive-cards-mobile" style={{ display: 'none', padding: '12px' }}>
                      {paginatedPallets.map((p) => (
                        <div key={p.id} className="mobile-card">
                          <div className="mobile-card-row">
                            <span style={{ fontWeight: 700 }}>{p.palletNo}</span>
                            <span className={`badge badge-${p.status.toLowerCase()}`}>
                              {p.status === 'Open' ? 'Açık' : p.status === 'Closed' ? 'Kapalı' : p.status === 'Printed' ? 'Yazdırıldı' : 'Sevk'}
                            </span>
                          </div>
                          <div className="mobile-card-row">
                            <span className="mobile-card-label">SSCC:</span>
                            <span className="mobile-card-value" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.sscc}</span>
                          </div>
                          <div className="mobile-card-row">
                            <span className="mobile-card-label">Oluşturma:</span>
                            <span className="mobile-card-value" style={{ fontSize: '0.75rem' }}>{new Date(p.createdAt).toLocaleString('tr-TR')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {pallets.length > 10 && (
                    <div className="pagination" style={{ marginTop: '16px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Toplam: {pallets.length} palet</span>
                      <div className="pagination-buttons">
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={palletPage === 1} onClick={() => setPalletPage(p => p - 1)}>Önceki</button>
                        <span style={{ padding: '0 8px', fontSize: '0.85rem', fontWeight: 600 }}>{palletPage}</span>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={palletPage * 10 >= pallets.length} onClick={() => setPalletPage(p => p + 1)}>Sonraki</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </>
      )}

    </div>
  );
};
