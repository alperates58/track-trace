import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
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
import { TTPageHeader, TTButton } from '../components/common';

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
  let color = 'var(--color-danger, #ef4444)';
  if (percentage >= 100) color = 'var(--color-success, #10b981)';
  else if (percentage >= 50) color = 'var(--color-warning, #f59e0b)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '90px', maxWidth: '120px' }}>
      <div className="tabular-nums font-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
        <span>{actual} / {target}</span>
        <span>%{percentage}</span>
      </div>
      <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-subtle, #334155)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: color, transition: 'width 0.2s' }} />
      </div>
    </div>
  );
};

export const TraceabilityCenter: React.FC = () => {
  const { hasPermission } = useAuth();
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
    <div className="traceability-page" style={{ padding: '0px' }}>
      {/* Title */}
      <TTPageHeader
        title="İzlenebilirlik Merkezi"
        description="Ürün, koli, palet ve sipariş ilişkilerini sorgulayın ve baskı geçmişini denetleyin."
        actions={
          <TTButton 
            variant="secondary" 
            disabled={loading || refreshing} 
            onClick={() => loadCenterData(true)}
            icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
          >
            {refreshing ? 'Güncelleniyor...' : 'Verileri Yenile'}
          </TTButton>
        }
      />

      {/* Giant Search Block */}
      <div style={{ padding: '24px 28px', marginBottom: '24px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg, 10px)' }}>
        <form className="traceability-search-form" onSubmit={handleTraceSearch} style={{ display: 'flex', gap: '10px', maxWidth: '820px', margin: '0 auto' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              className="input-field"
              style={{ paddingLeft: '42px', height: '42px', fontSize: '0.95rem', width: '100%', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle)' }}
              placeholder="Barkod, SSCC, Koli No, Palet No veya Sipariş No girin..."
              value={queryCode}
              onChange={(e) => setQueryCode(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ padding: '0 24px', height: '42px', fontSize: '0.9rem', fontWeight: 600, borderRadius: 'var(--radius-sm, 6px)' }} 
            disabled={searchLoading}
          >
            {searchLoading ? 'Sorgulanıyor...' : 'Sorgula'}
          </button>
        </form>
      </div>

      {/* Error notification */}
      {searchError && (
        <div style={{ textAlign: 'center', padding: '24px', marginBottom: '24px', color: '#f87171', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-md, 8px)' }}>
          <AlertCircle size={28} style={{ margin: '0 auto 10px' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>Eşleşme Bulunamadı</h3>
          <p style={{ fontSize: '0.85rem', margin: '0 0 14px', color: 'var(--text-secondary)' }}>{searchError}</p>
          <button className="btn btn-secondary" style={{ height: '32px', padding: '0 16px', fontSize: '0.82rem', borderRadius: 'var(--radius-sm, 6px)' }} onClick={handleClearSearch}>Aramayı Temizle</button>
        </div>
      )}

      {/* ARAMA SONUCU (Search Result screen) */}
      {searchResult && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Sorgu Sonuç Detayı</h3>
            <button className="btn btn-secondary" onClick={handleClearSearch} style={{ height: '32px', padding: '0 14px', fontSize: '0.82rem', borderRadius: 'var(--radius-sm, 6px)' }}>
              Temizle / Geri Dön
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '20px' }} className="two-column-grid">
            
            {/* Left side: Hierarchical Card list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Agregasyon Hiyerarşisi</h4>

              {/* Order Node */}
              <div style={{ padding: '14px 16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderLeft: '4px solid #8b5cf6', borderRadius: 'var(--radius-md, 8px)' }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Adım 4: Sipariş</span>
                <h5 style={{ fontSize: '0.98rem', margin: '4px 0 6px', color: 'var(--text-primary)' }}>
                  {searchResult.type === 'order' ? <strong className="font-mono text-primary">{searchResult.data.orderNo}</strong> : <span className="font-mono">{searchResult.data.orderNo || '-'}</span>} Siparişi
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>Müşteri: <strong className="text-slate-200">{searchResult.data.customerName || '-'}</strong></span>
                  <span>Ürün: <strong className="text-slate-200">{searchResult.data.productName || '-'}</strong></span>
                </div>
              </div>

              <div style={{ textAlign: 'center', margin: '-4px 0' }}><ArrowDown size={18} color="var(--text-secondary)" /></div>

              {/* Pallet Node */}
              <div style={{ padding: '14px 16px', backgroundColor: searchResult.type === 'pallet' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderLeft: '4px solid var(--primary)', borderRadius: 'var(--radius-md, 8px)' }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Adım 3: Palet</span>
                <h5 style={{ fontSize: '0.98rem', margin: '4px 0 6px', color: 'var(--text-primary)' }}>
                  {searchResult.data.palletNo ? `Palet No: ${searchResult.data.palletNo}` : 'Palete Yüklenmedi'}
                </h5>
                {searchResult.data.palletNo && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>Palet SSCC: <code className="font-mono text-slate-300">{searchResult.data.palletSSCC || '-'}</code></span>
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'center', margin: '-4px 0' }}><ArrowDown size={18} color="var(--text-secondary)" /></div>

              {/* Carton Node */}
              <div style={{ padding: '14px 16px', backgroundColor: searchResult.type === 'carton' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderLeft: '4px solid #f59e0b', borderRadius: 'var(--radius-md, 8px)' }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Adım 2: Koli</span>
                <h5 style={{ fontSize: '0.98rem', margin: '4px 0 6px', color: 'var(--text-primary)' }}>
                  {searchResult.data.cartonNo ? `Koli No: ${searchResult.data.cartonNo}` : 'Koliye Eklenmedi'}
                </h5>
                {searchResult.data.cartonNo && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>Koli SSCC: <code className="font-mono text-slate-300">{searchResult.data.cartonSSCC || '-'}</code></span>
                    <span>Durum: <strong className="text-slate-200">{searchResult.data.status || 'Kayıtlı'}</strong></span>
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'center', margin: '-4px 0' }}><ArrowDown size={18} color="var(--text-secondary)" /></div>

              {/* Product Code Node */}
              <div style={{ padding: '14px 16px', backgroundColor: searchResult.type === 'product' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderLeft: '4px solid #10b981', borderRadius: 'var(--radius-md, 8px)' }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Adım 1: Ürün Barkodu</span>
                <h5 style={{ fontSize: '0.95rem', margin: '4px 0 6px', wordBreak: 'break-all', color: 'var(--text-primary)' }}>
                  {searchResult.type === 'product' ? <code className="font-mono text-xs text-primary">{searchResult.data.rawCode}</code> : (searchResult.data.serialNo ? `S/N: ${searchResult.data.serialNo}` : 'Koli içi tekil barkod')}
                </h5>
                {searchResult.data.serialNo && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>GTIN: <code className="font-mono text-slate-300">{searchResult.data.gtin || '-'}</code></span>
                    <span>Seri No: <code className="font-mono text-slate-300">{searchResult.data.serialNo}</code></span>
                  </div>
                )}
              </div>

            </div>

            {/* Right side: Event history timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '18px 20px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md, 8px)', height: '100%' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', color: 'var(--text-primary)' }}>Olay Geçmişi (Zaman Tüneli)</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '24px', borderLeft: '2px solid var(--border-subtle)', margin: '10px 0 10px 8px' }}>
                  {searchTimeline.map((evt, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      {/* Node Bullet */}
                      <div style={{
                        position: 'absolute', left: '-31px', top: '2px', width: '12px', height: '12px', borderRadius: '50%',
                        backgroundColor: evt.status === 'success' ? '#10b981' : evt.status === 'info' ? 'var(--primary)' : '#f59e0b',
                        border: '2px solid var(--bg-card)', boxShadow: '0 0 0 1px var(--border-subtle)'
                      }} />
                      <div className="tabular-nums font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{evt.time}</div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', marginTop: '2px' }}>{evt.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{evt.description}</div>
                    </div>
                  ))}
                </div>

                {/* Carton Item Codes raw block */}
                {searchResult.type === 'carton' && searchResult.data.cartonItems && (
                  <div style={{ marginTop: '18px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>Koli İçi Barkod Listesi (<strong className="tabular-nums">{searchResult.data.cartonItems.length}</strong> Ürün):</span>
                    <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {searchResult.data.cartonItems.map((item: string, idx: number) => (
                        <div key={idx} style={{ padding: '5px 8px', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          {idx + 1}. {item}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Product RawCode text box */}
                {searchResult.type === 'product' && (
                  <div style={{ marginTop: '18px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>Ham Barkod Verisi (RawCode):</span>
                    <textarea readOnly className="input-field" style={{ width: '100%', height: '70px', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.78rem', resize: 'none', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 6px)' }} value={searchResult.data.rawCode} />
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
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '20px', flexWrap: 'wrap', gap: '4px', overflowX: 'auto' }}>
            <button 
              onClick={() => handleTabChange('overview')}
              style={{
                borderRadius: 0, 
                border: 'none',
                borderBottom: activeTab === 'overview' ? '2px solid var(--primary)' : '2px solid transparent',
                backgroundColor: 'transparent', 
                color: activeTab === 'overview' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 600, 
                padding: '10px 18px', 
                fontSize: '0.85rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Genel Bakış
            </button>
            <button 
              onClick={() => handleTabChange('prints')}
              style={{
                borderRadius: 0, 
                border: 'none',
                borderBottom: activeTab === 'prints' ? '2px solid var(--primary)' : '2px solid transparent',
                backgroundColor: 'transparent', 
                color: activeTab === 'prints' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 600, 
                padding: '10px 18px', 
                fontSize: '0.85rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Son Baskılar
            </button>
            <button 
              onClick={() => handleTabChange('scans')}
              style={{
                borderRadius: 0, 
                border: 'none',
                borderBottom: activeTab === 'scans' ? '2px solid var(--primary)' : '2px solid transparent',
                backgroundColor: 'transparent', 
                color: activeTab === 'scans' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 600, 
                padding: '10px 18px', 
                fontSize: '0.85rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Son Okutmalar
            </button>
            <button 
              onClick={() => handleTabChange('cartons')}
              style={{
                borderRadius: 0, 
                border: 'none',
                borderBottom: activeTab === 'cartons' ? '2px solid var(--primary)' : '2px solid transparent',
                backgroundColor: 'transparent', 
                color: activeTab === 'cartons' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 600, 
                padding: '10px 18px', 
                fontSize: '0.85rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Son Koliler
            </button>
            <button 
              onClick={() => handleTabChange('pallets')}
              style={{
                borderRadius: 0, 
                border: 'none',
                borderBottom: activeTab === 'pallets' ? '2px solid var(--primary)' : '2px solid transparent',
                backgroundColor: 'transparent', 
                color: activeTab === 'pallets' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 600, 
                padding: '10px 18px', 
                fontSize: '0.85rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Son Paletler
            </button>
          </div>

          {/* Loader */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-subtle)' }}>
              <RefreshCw size={22} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '10px' }} />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>İzlenebilirlik verileri yükleniyor...</div>
            </div>
          ) : (
            <div>
              
              {/* TAB 1: Genel Bakış */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: 0 }}>
                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px 18px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bugün Okutulan Ürün</span>
                        <div className="tabular-nums font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px', color: '#10b981' }}>{summaryData?.scannedTodayCount || 0}</div>
                      </div>
                      <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><Barcode size={20} /></div>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px 18px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bugün Basılan Etiket</span>
                        <div className="tabular-nums font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px', color: 'var(--primary)' }}>{printCountToday}</div>
                      </div>
                      <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}><Printer size={20} /></div>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px 18px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Toplam Açık Koli</span>
                        <div className="tabular-nums font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px', color: '#f59e0b' }}>{summaryData?.openCartonsCount || 0}</div>
                      </div>
                      <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><Inbox size={20} /></div>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px 18px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Toplam Açık Palet</span>
                        <div className="tabular-nums font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px', color: '#8b5cf6' }}>{summaryData?.openPalletsCount || 0}</div>
                      </div>
                      <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}><Layers size={20} /></div>
                    </div>
                  </div>

                  {/* Recent activities log */}
                  <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg, 10px)', padding: '18px 20px' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Info size={16} className="text-primary" /> Son Sistem Aktiviteleri
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {summaryData?.recentActivities && summaryData.recentActivities.length > 0 ? (
                        summaryData.recentActivities.map((act: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.82rem', borderRadius: 'var(--radius-sm, 6px)' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <ChevronRight size={13} color="var(--text-secondary)" />
                              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{act.message}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '14px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><User size={12} /> {act.user}</span>
                              <span className="tabular-nums font-mono">{new Date(act.createdAt).toLocaleString('tr-TR')}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Son aktivite kaydı bulunamadı.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Son Baskılar */}
              {activeTab === 'prints' && (
                <div>
                  {/* Advanced Filters */}
                  <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg, 10px)', padding: '16px 18px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}><SlidersHorizontal size={14} className="text-primary" /> Baskı Geçmişi Filtreleri</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Etiket Tipi</label>
                        <select className="input-field" style={{ fontSize: '0.82rem', height: '36px', padding: '0 8px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle)' }} value={printTypeFilter} onChange={e => setPrintTypeFilter(e.target.value)}>
                          <option value="">Tümü</option>
                          <option value="Carton">Koli Etiketi</option>
                          <option value="Pallet">Palet Etiketi</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Format</label>
                        <select className="input-field" style={{ fontSize: '0.82rem', height: '36px', padding: '0 8px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle)' }} value={printFormatFilter} onChange={e => setPrintFormatFilter(e.target.value)}>
                          <option value="">Tümü</option>
                          <option value="PDF">PDF</option>
                          <option value="ZPL">ZPL</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Yazdıran Operatör</label>
                        <input type="text" className="input-field" style={{ fontSize: '0.82rem', height: '36px', padding: '0 10px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle)' }} placeholder="Kullanıcı adı..." value={printUserFilter} onChange={e => setPrintUserFilter(e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Başlangıç</label>
                        <input type="date" className="input-field" style={{ fontSize: '0.82rem', height: '36px', padding: '0 10px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle)' }} value={printStartDate} onChange={e => setPrintStartDate(e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Bitiş</label>
                        <input type="date" className="input-field" style={{ fontSize: '0.82rem', height: '36px', padding: '0 10px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle)' }} value={printEndDate} onChange={e => setPrintEndDate(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="table-container" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg, 10px)', overflow: 'hidden' }}>
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
                          <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>Filtrelere uygun baskı kaydı bulunamadı.</td></tr>
                        ) : (
                          paginatedPrints.map((job) => (
                            <tr key={job.id}>
                              <td>
                                <span className={`tt-badge ${job.labelType === 'Carton' ? 'tt-badge-neutral' : 'tt-badge-info'}`}>
                                  {job.labelType === 'Carton' ? 'Koli Etiketi' : 'Palet Etiketi'}
                                </span>
                              </td>
                              <td><strong className="font-mono">{job.entityNo}</strong></td>
                              <td><code className="font-mono text-xs">{job.format}</code></td>
                              <td className="tabular-nums font-mono">{job.printCount}</td>
                              <td>{job.printedBy || 'Sistem'}</td>
                              <td className="tabular-nums font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{new Date(job.createdAt).toLocaleString('tr-TR')}</td>
                              <td>
                                {hasPermission('traceability.print') && (
                                  <button className="btn btn-secondary" style={{ height: '28px', padding: '0 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: 'var(--radius-sm, 6px)' }} onClick={() => handleReprint(job)}>
                                    <Printer size={12} /> Tekrar Yazdır
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Prints Mobile cards */}
                    <div className="responsive-cards-mobile" style={{ display: 'none', padding: '12px' }}>
                      {paginatedPrints.map((job) => (
                        <div key={job.id} className="mobile-card" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md, 8px)', padding: '12px', marginBottom: '8px' }}>
                          <div className="mobile-card-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span className="font-mono font-bold">{job.entityNo}</span>
                            <span className={`tt-badge ${job.labelType === 'Carton' ? 'tt-badge-neutral' : 'tt-badge-info'}`}>
                              {job.labelType === 'Carton' ? 'Koli' : 'Palet'}
                            </span>
                          </div>
                          <div className="mobile-card-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            <span>Format:</span>
                            <span className="font-mono text-slate-300"><code>{job.format}</code> (x{job.printCount})</span>
                          </div>
                          <div className="mobile-card-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            <span>Operatör:</span>
                            <span className="text-slate-300">{job.printedBy || 'Sistem'}</span>
                          </div>
                          <div className="mobile-card-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            <span>Tarih:</span>
                            <span className="tabular-nums font-mono">{new Date(job.createdAt).toLocaleString('tr-TR')}</span>
                          </div>
                          {hasPermission('traceability.print') && (
                            <button className="btn btn-secondary" style={{ width: '100%', height: '32px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={() => handleReprint(job)}>
                              <Printer size={13} /> Tekrar Yazdır
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {filteredPrintJobs.length > 10 && (
                    <div className="pagination" style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Toplam: <strong className="tabular-nums text-slate-200">{filteredPrintJobs.length}</strong> baskı</span>
                      <div className="pagination-buttons" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button className="btn btn-secondary" style={{ height: '30px', padding: '0 10px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }} disabled={printPage === 1} onClick={() => setPrintPage(p => p - 1)}>Önceki</button>
                        <span className="tabular-nums" style={{ padding: '0 8px', fontSize: '0.85rem', fontWeight: 600 }}>{printPage}</span>
                        <button className="btn btn-secondary" style={{ height: '30px', padding: '0 10px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }} disabled={printPage * 10 >= filteredPrintJobs.length} onClick={() => setPrintPage(p => p + 1)}>Sonraki</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Son Okutmalar */}
              {activeTab === 'scans' && (
                <div>
                  <div className="table-container" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg, 10px)', overflow: 'hidden' }}>
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
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>Henüz okutulmuş barkod bulunamadı.</td></tr>
                        ) : (
                          paginatedScans.map((scan, idx) => (
                            <tr key={idx}>
                              <td><code className="font-mono text-xs text-slate-300" style={{ wordBreak: 'break-all' }}>{scan.rawCode}</code></td>
                              <td><strong className="font-mono">{scan.cartonNo}</strong></td>
                              <td>{scan.scannedBy || 'Sistem'}</td>
                              <td className="tabular-nums font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{scan.scannedAt ? new Date(scan.scannedAt).toLocaleString('tr-TR') : '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Scans Mobile cards */}
                    <div className="responsive-cards-mobile" style={{ display: 'none', padding: '12px' }}>
                      {paginatedScans.map((scan, idx) => (
                        <div key={idx} className="mobile-card" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md, 8px)', padding: '12px', marginBottom: '8px' }}>
                          <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', marginBottom: '6px', color: 'var(--text-primary)' }}>{scan.rawCode}</div>
                          <div className="mobile-card-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            <span>Koli No:</span>
                            <span className="font-mono font-bold text-slate-200">{scan.cartonNo}</span>
                          </div>
                          <div className="mobile-card-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            <span>Operatör:</span>
                            <span className="text-slate-300">{scan.scannedBy}</span>
                          </div>
                          <div className="mobile-card-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            <span>Tarih:</span>
                            <span className="tabular-nums font-mono">{scan.scannedAt ? new Date(scan.scannedAt).toLocaleString('tr-TR') : '-'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {recentScans.length > 10 && (
                    <div className="pagination" style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Toplam: <strong className="tabular-nums text-slate-200">{recentScans.length}</strong> okutma</span>
                      <div className="pagination-buttons" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button className="btn btn-secondary" style={{ height: '30px', padding: '0 10px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }} disabled={scanPage === 1} onClick={() => setScanPage(p => p - 1)}>Önceki</button>
                        <span className="tabular-nums" style={{ padding: '0 8px', fontSize: '0.85rem', fontWeight: 600 }}>{scanPage}</span>
                        <button className="btn btn-secondary" style={{ height: '30px', padding: '0 10px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }} disabled={scanPage * 10 >= recentScans.length} onClick={() => setScanPage(p => p + 1)}>Sonraki</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Son Koliler */}
              {activeTab === 'cartons' && (
                <div>
                  <div className="table-container" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg, 10px)', overflow: 'hidden' }}>
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
                          <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>Oluşturulmuş koli bulunamadı.</td></tr>
                        ) : (
                          paginatedCartons.map((c) => (
                            <tr key={c.id}>
                              <td><strong className="font-mono">{c.cartonNo}</strong></td>
                              <td><code className="font-mono text-xs">{c.orderNo}</code></td>
                              <td><code className="font-mono text-xs text-slate-300">{c.sscc}</code></td>
                              <td><FullnessIndicator actual={c.actualQuantity} target={c.targetQuantity} /></td>
                              <td>
                                <span className={`tt-badge ${c.status === 'Open' ? 'tt-badge-active' : c.status === 'Closed' ? 'tt-badge-neutral' : c.status === 'Printed' ? 'tt-badge-info' : 'tt-badge-neutral'}`}>
                                  {c.status === 'Open' ? 'Açık' : c.status === 'Closed' ? 'Kapalı' : c.status === 'Printed' ? 'Yazdırıldı' : c.status === 'PrePrinted' ? 'Ön Etiket' : c.status === 'Filling' ? 'Dolduruluyor' : c.status === 'Palletized' ? 'Paletlendi' : c.status}
                                </span>
                              </td>
                              <td className="tabular-nums font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{new Date(c.createdAt).toLocaleString('tr-TR')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Cartons Mobile cards */}
                    <div className="responsive-cards-mobile" style={{ display: 'none', padding: '12px' }}>
                      {paginatedCartons.map((c) => (
                        <div key={c.id} className="mobile-card" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md, 8px)', padding: '12px', marginBottom: '8px' }}>
                          <div className="mobile-card-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span className="font-mono font-bold">{c.cartonNo}</span>
                            <span className={`tt-badge ${c.status === 'Open' ? 'tt-badge-active' : 'tt-badge-neutral'}`}>
                              {c.status === 'Open' ? 'Açık' : c.status === 'Closed' ? 'Kapalı' : c.status === 'Printed' ? 'Yazdırıldı' : c.status}
                            </span>
                          </div>
                          <div className="mobile-card-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            <span>Sipariş No:</span>
                            <span className="font-mono text-slate-300">{c.orderNo}</span>
                          </div>
                          <div className="mobile-card-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Doluluk:</span>
                            <FullnessIndicator actual={c.actualQuantity} target={c.targetQuantity} />
                          </div>
                          <div className="mobile-card-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            <span>Tarih:</span>
                            <span className="tabular-nums font-mono">{new Date(c.createdAt).toLocaleString('tr-TR')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {cartons.length > 10 && (
                    <div className="pagination" style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Toplam: <strong className="tabular-nums text-slate-200">{cartons.length}</strong> koli</span>
                      <div className="pagination-buttons" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button className="btn btn-secondary" style={{ height: '30px', padding: '0 10px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }} disabled={cartonPage === 1} onClick={() => setCartonPage(p => p - 1)}>Önceki</button>
                        <span className="tabular-nums" style={{ padding: '0 8px', fontSize: '0.85rem', fontWeight: 600 }}>{cartonPage}</span>
                        <button className="btn btn-secondary" style={{ height: '30px', padding: '0 10px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }} disabled={cartonPage * 10 >= cartons.length} onClick={() => setCartonPage(p => p + 1)}>Sonraki</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: Son Paletler */}
              {activeTab === 'pallets' && (
                <div>
                  <div className="table-container" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg, 10px)', overflow: 'hidden' }}>
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
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>Oluşturulmuş palet bulunamadı.</td></tr>
                        ) : (
                          paginatedPallets.map((p) => (
                            <tr key={p.id}>
                              <td><strong className="font-mono">{p.palletNo}</strong></td>
                              <td><code className="font-mono text-xs text-slate-300">{p.sscc}</code></td>
                              <td>
                                <span className={`tt-badge ${p.status === 'Open' ? 'tt-badge-active' : p.status === 'Closed' ? 'tt-badge-neutral' : p.status === 'Printed' ? 'tt-badge-info' : 'tt-badge-neutral'}`}>
                                  {p.status === 'Open' ? 'Açık' : p.status === 'Closed' ? 'Kapalı' : p.status === 'Printed' ? 'Yazdırıldı' : 'Sevk Edildi'}
                                </span>
                              </td>
                              <td className="tabular-nums font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{new Date(p.createdAt).toLocaleString('tr-TR')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Pallets Mobile cards */}
                    <div className="responsive-cards-mobile" style={{ display: 'none', padding: '12px' }}>
                      {paginatedPallets.map((p) => (
                        <div key={p.id} className="mobile-card" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md, 8px)', padding: '12px', marginBottom: '8px' }}>
                          <div className="mobile-card-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span className="font-mono font-bold">{p.palletNo}</span>
                            <span className={`tt-badge ${p.status === 'Open' ? 'tt-badge-active' : 'tt-badge-neutral'}`}>
                              {p.status === 'Open' ? 'Açık' : p.status === 'Closed' ? 'Kapalı' : p.status === 'Printed' ? 'Yazdırıldı' : 'Sevk'}
                            </span>
                          </div>
                          <div className="mobile-card-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            <span>SSCC:</span>
                            <span className="font-mono text-slate-300" style={{ fontSize: '0.75rem' }}>{p.sscc}</span>
                          </div>
                          <div className="mobile-card-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            <span>Oluşturma:</span>
                            <span className="tabular-nums font-mono">{new Date(p.createdAt).toLocaleString('tr-TR')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {pallets.length > 10 && (
                    <div className="pagination" style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Toplam: <strong className="tabular-nums text-slate-200">{pallets.length}</strong> palet</span>
                      <div className="pagination-buttons" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button className="btn btn-secondary" style={{ height: '30px', padding: '0 10px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }} disabled={palletPage === 1} onClick={() => setPalletPage(p => p - 1)}>Önceki</button>
                        <span className="tabular-nums" style={{ padding: '0 8px', fontSize: '0.85rem', fontWeight: 600 }}>{palletPage}</span>
                        <button className="btn btn-secondary" style={{ height: '30px', padding: '0 10px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }} disabled={palletPage * 10 >= pallets.length} onClick={() => setPalletPage(p => p + 1)}>Sonraki</button>
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
