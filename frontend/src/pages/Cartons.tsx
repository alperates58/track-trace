import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Printer, 
  Eye, 
  Search, 
  FileText, 
  Barcode, 
  Trash2, 
  Plus, 
  X, 
  ChevronDown, 
  ChevronRight, 
  Calendar, 
  Package, 
  Inbox, 
  CheckCircle, 
  SlidersHorizontal, 
  RefreshCw 
} from 'lucide-react';
import { TTPageHeader, TTLoadingState, TTEmptyState, TTButton } from '../components/common';

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

interface ProductCode {
  rawCode: string;
  gtin: string;
  serialNo: string;
  status: string;
  scannedAt: string;
  scannedBy: string;
}

// Color-coded Fullness Progress Bar Component
const FullnessIndicator: React.FC<{ actual: number; target: number }> = ({ actual, target }) => {
  const percentage = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  let color = 'var(--danger)'; // Low (0-49)
  if (percentage >= 100) {
    color = 'var(--success)'; // Full (100)
  } else if (percentage >= 50) {
    color = 'var(--warning)'; // In Progress (50-99)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '110px', maxWidth: '160px', width: '100%' }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700 }}>
        <span style={{ color: 'var(--text-main)' }}>{actual} / {target}</span>
        <span style={{ color: color }}>%{percentage}</span>
      </div>
      <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: color, borderRadius: '3px', transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
};

// Desktop Table Row for Flat List View
const CartonTableRow: React.FC<{ 
  c: Carton; 
  orderStockCode: string; 
  isSelected: boolean; 
  onSelect: () => void; 
  onPrint: () => void;
}> = ({ c, orderStockCode, isSelected, onSelect, onPrint }) => {
  const sonIslemDate = c.printedAt || c.closedAt || c.createdAt;
  const sonIslemFormatted = sonIslemDate ? new Date(sonIslemDate).toLocaleString('tr-TR') : '-';

  return (
    <tr style={{ cursor: 'pointer', backgroundColor: isSelected ? 'var(--primary-light)' : '' }} onClick={onSelect}>
      <td style={{ fontWeight: 600 }}>{c.cartonNo}</td>
      <td>{c.orderNo}</td>
      <td><span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{orderStockCode || '-'}</span></td>
      <td><code style={{ fontSize: '0.85rem' }}>{c.sscc}</code></td>
      <td>
        <FullnessIndicator actual={c.actualQuantity} target={c.targetQuantity} />
      </td>
      <td>
        <span className={`badge badge-${c.status.toLowerCase()}`}>
          {c.status === 'Open' ? 'Açık' : c.status === 'Closed' ? 'Kapalı' : c.status === 'Printed' ? 'Yazdırıldı' : 'Paletlendi'}
        </span>
      </td>
      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sonIslemFormatted}</td>
      <td onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={onSelect}>
            <Eye size={14} /> Detay
          </button>
          <button className="btn btn-primary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={onPrint}>
            <Printer size={14} /> PDF
          </button>
        </div>
      </td>
    </tr>
  );
};

// Mobile Card for Flat List View
const CartonMobileCard: React.FC<{
  c: Carton;
  orderStockCode: string;
  onSelect: () => void;
  onPrint: () => void;
}> = ({ c, orderStockCode, onSelect, onPrint }) => {
  const sonIslemDate = c.printedAt || c.closedAt || c.createdAt;
  const sonIslemFormatted = sonIslemDate ? new Date(sonIslemDate).toLocaleString('tr-TR') : '-';

  return (
    <div className="mobile-card" onClick={onSelect} style={{ cursor: 'pointer' }}>
      <div className="mobile-card-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '4px' }}>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>{c.cartonNo}</span>
        <span className={`badge badge-${c.status.toLowerCase()}`}>
          {c.status === 'Open' ? 'Açık' : c.status === 'Closed' ? 'Kapalı' : c.status === 'Printed' ? 'Yazdırıldı' : 'Paletlendi'}
        </span>
      </div>
      
      <div className="mobile-card-row">
        <span className="mobile-card-label">Sipariş No:</span>
        <span className="mobile-card-value">{c.orderNo}</span>
      </div>

      <div className="mobile-card-row">
        <span className="mobile-card-label">Stok Kodu:</span>
        <span className="mobile-card-value">{orderStockCode || '-'}</span>
      </div>

      <div className="mobile-card-row">
        <span className="mobile-card-label">SSCC:</span>
        <span className="mobile-card-value" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.sscc}</span>
      </div>

      <div className="mobile-card-row" style={{ alignItems: 'flex-start' }}>
        <span className="mobile-card-label">Doluluk:</span>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <FullnessIndicator actual={c.actualQuantity} target={c.targetQuantity} />
        </div>
      </div>

      <div className="mobile-card-row">
        <span className="mobile-card-label">Son İşlem:</span>
        <span className="mobile-card-value" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sonIslemFormatted}</span>
      </div>

      <div className="mobile-card-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }} onClick={e => e.stopPropagation()}>
        <button className="btn btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }} onClick={onSelect}>
          <Eye size={14} /> Detay
        </button>
        <button className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }} onClick={onPrint}>
          <Printer size={14} /> PDF
        </button>
      </div>
    </div>
  );
};

export const Cartons: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filters state
  const [search, setSearch] = useState('');
  const [orderNoFilter, setOrderNoFilter] = useState('');
  const [stockCodeFilter, setStockCodeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [onlyOpenToggle, setOnlyOpenToggle] = useState(false);
  const [onlyPartialToggle, setOnlyPartialToggle] = useState(false);

  // View preferences
  const [isGroupedByOrder, setIsGroupedByOrder] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);

  // Details drawer
  const [selectedCarton, setSelectedCarton] = useState<Carton | null>(null);
  const [cartonItems, setCartonItems] = useState<ProductCode[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [zplOutput, setZplOutput] = useState<string | null>(null);
  const [newProductBarcode, setNewProductBarcode] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [barcodePage, setBarcodePage] = useState(1);

  // Direct Printer Settings
  const [printerIp, setPrinterIp] = useState(localStorage.getItem('network_printer_ip') || '192.168.1.100');
  const [printerPort, setPrinterPort] = useState(localStorage.getItem('network_printer_port') || '9100');
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);

  // Decompose count tracking for cancelled KPIs in this session
  const [cancelledSessionCount, setCancelledSessionCount] = useState(0);

  // Fetch all cartons, orders, and stats in one go
  const loadAllData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [ordersRes, cartonsRes, summaryRes] = await Promise.all([
        api.get('/api/orders?pageSize=1000'),
        api.get('/api/cartons?pageSize=10000'),
        api.get('/api/dashboard/summary').catch(() => null)
      ]);

      setOrders(ordersRes.items || []);
      setCartons(cartonsRes.items || []);
      if (summaryRes) setSummaryData(summaryRes);
    } catch (err) {
      console.error('Error fetching carton screen data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const isToday = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };

  // Compute stats for KPI cards
  const kpis = useMemo(() => {
    const total = cartons.length;
    const open = cartons.filter(c => c.status === 'Open').length;
    const closed = cartons.filter(c => c.status !== 'Open').length; // Dolan koli (Kapalı+Yazdırıldı+Paletlendi)
    const printed = cartons.filter(c => c.status === 'Printed').length;
    
    // Decomposed/cancelled carton count from audit logs (if any in dashboard activity) plus session count
    const decomposedCount = summaryData?.recentActivities?.filter(
      (act: any) => act.action?.toLowerCase() === 'decompose' || (act.entityName?.toLowerCase() === 'cartons' && act.action?.toLowerCase() === 'decompose')
    ).length || 0;
    const cancelled = decomposedCount + cancelledSessionCount;

    const today = summaryData?.cartonsCreatedTodayCount || cartons.filter(c => isToday(c.createdAt)).length;

    return { total, open, closed, printed, cancelled, today };
  }, [cartons, summaryData, cancelledSessionCount]);

  // Extract unique stock codes from orders for filter dropdown
  const uniqueStockCodes = useMemo(() => {
    return Array.from(new Set(orders.map(o => o.stockCode).filter(Boolean))) as string[];
  }, [orders]);

  // Apply filters client-side
  const filteredCartons = useMemo(() => {
    return cartons.filter(c => {
      const order = orders.find(o => o.id === c.orderId);
      const stockCode = order?.stockCode || '';
      const orderNo = c.orderNo || order?.orderNo || '';

      // 1. Genel arama (Koli No / SSCC / Sipariş No)
      if (search) {
        const s = search.toLowerCase();
        const matchesSearch = c.cartonNo.toLowerCase().includes(s) ||
                              c.sscc.toLowerCase().includes(s) ||
                              orderNo.toLowerCase().includes(s);
        if (!matchesSearch) return false;
      }

      // 2. Sipariş No filtresi
      if (orderNoFilter && !orderNo.toLowerCase().includes(orderNoFilter.toLowerCase())) {
        return false;
      }

      // 3. Stok kodu filtresi
      if (stockCodeFilter && stockCode !== stockCodeFilter) {
        return false;
      }

      // 4. Durum filtresi
      if (statusFilter && c.status !== statusFilter) {
        return false;
      }

      // 5. Tarih aralığı filtresi
      if (startDateFilter) {
        const start = new Date(startDateFilter);
        start.setHours(0, 0, 0, 0);
        if (new Date(c.createdAt) < start) return false;
      }
      if (endDateFilter) {
        const end = new Date(endDateFilter);
        end.setHours(23, 59, 59, 999);
        if (new Date(c.createdAt) > end) return false;
      }

      // 6. Sadece açık koliler toggle
      if (onlyOpenToggle && c.status !== 'Open') {
        return false;
      }

      // 7. Sadece eksik dolulukta olanlar toggle
      if (onlyPartialToggle && c.actualQuantity >= c.targetQuantity) {
        return false;
      }

      return true;
    });
  }, [cartons, orders, search, orderNoFilter, stockCodeFilter, statusFilter, startDateFilter, endDateFilter, onlyOpenToggle, onlyPartialToggle]);

  // Group cartons by Order for default view
  const groupedOrders = useMemo(() => {
    if (!isGroupedByOrder) return [];

    const cartonsByOrder = filteredCartons.reduce((acc, c) => {
      if (!acc[c.orderId]) {
        acc[c.orderId] = [];
      }
      acc[c.orderId].push(c);
      return acc;
    }, {} as Record<string, Carton[]>);

    const list = Object.entries(cartonsByOrder).map(([orderId, orderCartons]) => {
      const order = orders.find(o => o.id === orderId);
      const orderNo = order?.orderNo || orderCartons[0]?.orderNo || 'Bilinmeyen Sipariş';
      
      // Calculate last activity timestamp
      let latestTime = 0;
      orderCartons.forEach(c => {
        const dates = [
          c.createdAt ? new Date(c.createdAt).getTime() : 0,
          c.closedAt ? new Date(c.closedAt).getTime() : 0,
          c.printedAt ? new Date(c.printedAt).getTime() : 0
        ];
        latestTime = Math.max(latestTime, ...dates);
      });
      const sonIslem = latestTime > 0 ? new Date(latestTime).toLocaleString('tr-TR') : '-';

      // Aggregate totals
      const totalCartons = orderCartons.length;
      const totalActual = orderCartons.reduce((sum, c) => sum + c.actualQuantity, 0);
      const totalTarget = orderCartons.reduce((sum, c) => sum + c.targetQuantity, 0);
      const openCartonsCount = orderCartons.filter(c => c.status === 'Open').length;

      return {
        orderId,
        orderNo,
        order,
        totalCartons,
        totalActual,
        totalTarget,
        openCartonsCount,
        sonIslem,
        cartons: orderCartons
      };
    });

    // Sort by latest action first
    list.sort((a, b) => {
      const timeA = a.cartons.reduce((max, c) => Math.max(max, new Date(c.createdAt).getTime()), 0);
      const timeB = b.cartons.reduce((max, c) => Math.max(max, new Date(c.createdAt).getTime()), 0);
      return timeB - timeA;
    });

    return list;
  }, [filteredCartons, orders, isGroupedByOrder]);

  const totalItemsCount = isGroupedByOrder ? groupedOrders.length : filteredCartons.length;
  const ITEMS_PER_PAGE = 10;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, orderNoFilter, stockCodeFilter, statusFilter, startDateFilter, endDateFilter, onlyOpenToggle, onlyPartialToggle, isGroupedByOrder]);

  // Paginated items
  const paginatedGroupedOrders = useMemo(() => {
    return groupedOrders.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  }, [groupedOrders, page]);

  const paginatedCartons = useMemo(() => {
    return filteredCartons.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  }, [filteredCartons, page]);

  // Detail actions
  const handleCartonClick = async (carton: Carton) => {
    setSelectedCarton(carton);
    setCartonItems([]);
    setZplOutput(null);
    setItemsLoading(true);
    setBarcodeSearch('');
    setBarcodePage(1);
    setShowPrinterSettings(false);

    try {
      const items = await api.get(`/api/cartons/${carton.id}/items`);
      setCartonItems(items);
    } catch (err) {
      console.error(err);
    } finally {
      setItemsLoading(false);
    }
  };

  const refreshCartonDetails = async (cartonId: string) => {
    setItemsLoading(true);
    try {
      const [updatedCarton, items] = await Promise.all([
        api.get(`/api/cartons/${cartonId}`),
        api.get(`/api/cartons/${cartonId}/items`)
      ]);
      setSelectedCarton(updatedCarton);
      setCartonItems(items);
      await loadAllData();
    } catch (err) {
      console.error(err);
    } finally {
      setItemsLoading(false);
    }
  };

  const handlePrintPdf = async (cartonId: string) => {
    try {
      const blob = (await api.get(`/api/cartons/${cartonId}/label.pdf`)) as Blob;
      const fileURL = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileURL;
      a.download = `koli_etiketi_${cartonId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(fileURL);
      await loadAllData();
    } catch (err: any) {
      alert('PDF oluşturulamadı: ' + err.message);
    }
  };

  const handlePrintZpl = async (cartonId: string) => {
    try {
      const res = await api.post(`/api/cartons/${cartonId}/print?format=ZPL`);
      setZplOutput(res.zpl);
      await loadAllData();
    } catch (err: any) {
      alert('ZPL oluşturulamadı: ' + err.message);
    }
  };

  const handleDecompose = async (cartonId: string) => {
    if (!confirm("Bu koliyi bozmak istediğinize emin misiniz? Kolideki tüm ürünler 'Okutuldu' (scanned) durumundan çıkıp 'Yüklendi' (uploaded) durumuna geri dönecek ve koli tamamen silinecektir.")) return;
    try {
      await api.post(`/api/cartons/${cartonId}/decompose`);
      setCancelledSessionCount(prev => prev + 1);
      setSelectedCarton(null);
      await loadAllData();
      alert('Koli bozuldu ve iptal edildi.');
    } catch (err: any) {
      alert("Koli bozulamadı: " + err.message);
    }
  };

  const handleRemoveProduct = async (cartonId: string, rawCode: string) => {
    if (!confirm("Bu ürünü koliden çıkarmak istediğinize emin misiniz? Ürün koli dışına çıkarılacak ve koli tekrar 'Açık' durumuna getirilecektir.")) return;
    try {
      await api.post(`/api/cartons/${cartonId}/remove-product?rawCode=${encodeURIComponent(rawCode)}`);
      await refreshCartonDetails(cartonId);
      alert('Ürün koliden çıkarıldı.');
    } catch (err: any) {
      alert("Ürün çıkarılamadı: " + err.message);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCarton || !newProductBarcode.trim()) return;
    try {
      await api.post(`/api/cartons/${selectedCarton.id}/add-product?rawCode=${encodeURIComponent(newProductBarcode.trim())}`);
      setNewProductBarcode('');
      await refreshCartonDetails(selectedCarton.id);
      alert('Ürün koliye eklendi.');
    } catch (err: any) {
      alert("Ürün eklenemedi: " + err.message);
    }
  };

  const handleNetworkPrint = async (cartonId: string) => {
    if (!printerIp.trim()) {
      alert('Lütfen geçerli bir IP adresi girin.');
      return;
    }
    const portNum = parseInt(printerPort);
    if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
      alert('Lütfen geçerli bir port numarası girin (1-65535).');
      return;
    }

    setPrintLoading(true);
    try {
      localStorage.setItem('network_printer_ip', printerIp.trim());
      localStorage.setItem('network_printer_port', printerPort.toString());

      await api.post(`/api/cartons/${cartonId}/print-network`, {
        IpAddress: printerIp.trim(),
        Port: portNum
      });
      alert('Yazdırma komutu başarıyla gönderildi.');
      await loadAllData();
    } catch (err: any) {
      alert('Yazdırma hatası: ' + err.message);
    } finally {
      setPrintLoading(false);
    }
  };

  // Filter carton product codes based on drawer search
  const filteredCartonItems = useMemo(() => {
    return cartonItems.filter(item => 
      item.rawCode.toLowerCase().includes(barcodeSearch.toLowerCase()) ||
      item.serialNo.toLowerCase().includes(barcodeSearch.toLowerCase())
    );
  }, [cartonItems, barcodeSearch]);

  // Paginated barcode list inside drawer
  const BARCODES_PER_PAGE = 10;
  const totalBarcodePages = Math.ceil(filteredCartonItems.length / BARCODES_PER_PAGE);
  const paginatedBarcodes = useMemo(() => {
    return filteredCartonItems.slice(
      (barcodePage - 1) * BARCODES_PER_PAGE,
      barcodePage * BARCODES_PER_PAGE
    );
  }, [filteredCartonItems, barcodePage]);

  return (
    <div>
      {/* Header Section */}
      <TTPageHeader
        title="Koli Yönetimi"
        description="Oluşturulan kolilerin durumları, içerdikleri ürünler ve etiket yazdırma işlemleri."
        actions={
          <TTButton 
            variant="secondary" 
            disabled={loading || refreshing} 
            onClick={() => loadAllData(true)}
            icon={<RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />}
          >
            {refreshing ? 'Güncelleniyor...' : 'Verileri Yenile'}
          </TTButton>
        }
      />

      {/* KPI Cards Grid */}
      <div className="stats-grid">
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-info">
            <span className="stat-title">Toplam Koli</span>
            <span className="stat-value">{kpis.total}</span>
          </div>
          <div className="stat-icon stat-blue">
            <Package size={24} />
          </div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="stat-info">
            <span className="stat-title">Açık Koli (Doluyor)</span>
            <span className="stat-value">{kpis.open}</span>
          </div>
          <div className="stat-icon stat-yellow">
            <Inbox size={24} />
          </div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-info">
            <span className="stat-title">Dolan Koli</span>
            <span className="stat-value">{kpis.closed}</span>
          </div>
          <div className="stat-icon stat-green">
            <CheckCircle size={24} />
          </div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid #0369a1' }}>
          <div className="stat-info">
            <span className="stat-title">Yazdırılan Koli</span>
            <span className="stat-value">{kpis.printed}</span>
          </div>
          <div className="stat-icon stat-blue">
            <Printer size={24} />
          </div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="stat-info">
            <span className="stat-title">İptal Edilen Koli</span>
            <span className="stat-value">{kpis.cancelled}</span>
          </div>
          <div className="stat-icon" style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}>
            <Trash2 size={24} />
          </div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid #6b21a8' }}>
          <div className="stat-info">
            <span className="stat-title">Bugün Oluşturulan</span>
            <span className="stat-value">{kpis.today}</span>
          </div>
          <div className="stat-icon stat-purple">
            <Calendar size={24} />
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <div className="card" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SlidersHorizontal size={18} /> Gelişmiş Filtre ve Görünüm Seçenekleri
          </h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Görünüm:</span>
            <button 
              className={`btn ${isGroupedByOrder ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setIsGroupedByOrder(true)}
            >
              Sipariş Gruplu
            </button>
            <button 
              className={`btn ${!isGroupedByOrder ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setIsGroupedByOrder(false)}
            >
              Düz Liste
            </button>
          </div>
        </div>

        {/* Input Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Genel Arama</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px', width: '100%', fontSize: '0.85rem', height: '38px' }}
                placeholder="Koli No, SSCC veya Sipariş No..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Sipariş No</label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', fontSize: '0.85rem', height: '38px' }}
              placeholder="Sipariş No yazın..."
              value={orderNoFilter}
              onChange={(e) => setOrderNoFilter(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Stok Kodu</label>
            <select
              className="form-input"
              style={{ width: '100%', fontSize: '0.85rem', height: '38px', padding: '0 10px' }}
              value={stockCodeFilter}
              onChange={(e) => setStockCodeFilter(e.target.value)}
            >
              <option value="">Tüm Stok Kodları</option>
              {uniqueStockCodes.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Durum</label>
            <select
              className="form-input"
              style={{ width: '100%', fontSize: '0.85rem', height: '38px', padding: '0 10px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tüm Durumlar</option>
              <option value="Open">Açık (Doluyor)</option>
              <option value="Closed">Kapalı (Closed)</option>
              <option value="Printed">Yazdırıldı</option>
              <option value="Palletized">Paletlendi</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Başlangıç Tarihi</label>
            <input
              type="date"
              className="form-input"
              style={{ width: '100%', fontSize: '0.85rem', height: '38px' }}
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Bitiş Tarihi</label>
            <input
              type="date"
              className="form-input"
              style={{ width: '100%', fontSize: '0.85rem', height: '38px' }}
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
            />
          </div>
        </div>

        {/* Checkbox Switches */}
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
          <label className="switch-container">
            <input
              type="checkbox"
              className="switch-input"
              checked={onlyOpenToggle}
              onChange={(e) => setOnlyOpenToggle(e.target.checked)}
            />
            <span className="switch-slider"></span>
            <span>Sadece Açık Koliler</span>
          </label>

          <label className="switch-container">
            <input
              type="checkbox"
              className="switch-input"
              checked={onlyPartialToggle}
              onChange={(e) => setOnlyPartialToggle(e.target.checked)}
            />
            <span className="switch-slider"></span>
            <span>Sadece Eksik Doluluktaki Koliler</span>
          </label>
        </div>
      </div>

      {/* Main List Layout */}
      {loading ? (
        <TTLoadingState text="Veriler Yükleniyor..." />
      ) : totalItemsCount === 0 ? (
        <TTEmptyState
          icon={<Inbox size={32} />}
          title="Kayıt Bulunamadı"
          description="Arama kriterlerinize uygun koli veya sipariş bulunamadı."
        />
      ) : isGroupedByOrder ? (
        /* 1. Grouped View */
        <div className="table-container">
          <table className="data-table responsive-table-desktop">
            <thead>
              <tr>
                <th style={{ width: '48px' }}></th>
                <th>Sipariş No</th>
                <th>Stok Kodu / Ürün Adı</th>
                <th>Toplam Koli</th>
                <th>Doluluk (Toplam Adet)</th>
                <th>Açık Koli</th>
                <th>Son İşlem</th>
              </tr>
            </thead>
            <tbody>
              {paginatedGroupedOrders.map((g) => {
                const isExpanded = expandedOrders[g.orderId];
                return (
                  <React.Fragment key={g.orderId}>
                    <tr 
                      className={`order-group-row ${isExpanded ? 'order-group-expanded' : ''}`}
                      onClick={() => setExpandedOrders(prev => ({ ...prev, [g.orderId]: !prev[g.orderId] }))}
                    >
                      <td style={{ textAlign: 'center' }}>
                        {isExpanded ? <ChevronDown size={18} color="var(--primary)" /> : <ChevronRight size={18} />}
                      </td>
                      <td style={{ fontWeight: 700 }}>{g.orderNo}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{g.order?.stockCode || '-'}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{g.order?.productName || '-'}</span>
                        </div>
                      </td>
                      <td><strong>{g.totalCartons}</strong> koli</td>
                      <td>
                        <FullnessIndicator actual={g.totalActual} target={g.totalTarget} />
                      </td>
                      <td>
                        <span className={`badge ${g.openCartonsCount > 0 ? 'badge-open' : 'badge-closed'}`}>
                          {g.openCartonsCount} Açık
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{g.sonIslem}</td>
                    </tr>

                    {/* Subtable of Cartons */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div className="sub-table-container">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0 }}>
                                <strong>{g.orderNo}</strong> Siparişine Ait Koliler ({g.cartons.length})
                              </h4>
                            </div>
                            <table className="data-table" style={{ backgroundColor: '#ffffff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                              <thead>
                                <tr>
                                  <th>Koli No</th>
                                  <th>SSCC (18 Hane)</th>
                                  <th>Doluluk</th>
                                  <th>Durum</th>
                                  <th>Son İşlem</th>
                                  <th>Aksiyonlar</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.cartons.map(c => (
                                  <tr key={c.id} style={{ cursor: 'pointer', backgroundColor: selectedCarton?.id === c.id ? 'var(--primary-light)' : '' }} onClick={() => handleCartonClick(c)}>
                                    <td style={{ fontWeight: 600 }}>{c.cartonNo}</td>
                                    <td><code style={{ fontSize: '0.85rem' }}>{c.sscc}</code></td>
                                    <td>
                                      <FullnessIndicator actual={c.actualQuantity} target={c.targetQuantity} />
                                    </td>
                                    <td>
                                      <span className={`badge badge-${c.status.toLowerCase()}`}>
                                        {c.status === 'Open' ? 'Açık' : c.status === 'Closed' ? 'Kapalı' : c.status === 'Printed' ? 'Yazdırıldı' : 'Paletlendi'}
                                      </span>
                                    </td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                      {c.printedAt || c.closedAt || c.createdAt ? new Date(c.printedAt || c.closedAt || c.createdAt).toLocaleString('tr-TR') : '-'}
                                    </td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                      <div style={{ display: 'flex', gap: '6px' }}>
                                        <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.75rem' }} onClick={() => handleCartonClick(c)}>
                                          <Eye size={12} /> Detay
                                        </button>
                                        <button className="btn btn-primary" style={{ padding: '5px 10px', fontSize: '0.75rem' }} onClick={() => handlePrintPdf(c.id)}>
                                          <Printer size={12} /> PDF
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* Grouped View Mobile Layout */}
          <div className="responsive-cards-mobile" style={{ display: 'none', padding: '0 8px' }}>
            {paginatedGroupedOrders.map((g) => {
              const isExpanded = expandedOrders[g.orderId];
              return (
                <div key={g.orderId} className="mobile-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                  <div className="mobile-card-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{g.orderNo}</span>
                    <span className={`badge ${g.openCartonsCount > 0 ? 'badge-open' : 'badge-closed'}`}>
                      {g.openCartonsCount} Açık
                    </span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Ürün / Stok:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.8rem', maxWidth: '70%', textAlign: 'right' }}>
                      {g.order?.stockCode ? `${g.order.stockCode} - ${g.order.productName || ''}` : '-'}
                    </span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Toplam Koli:</span>
                    <span className="mobile-card-value">{g.totalCartons} koli</span>
                  </div>
                  <div className="mobile-card-row" style={{ alignItems: 'flex-start' }}>
                    <span className="mobile-card-label">Toplam Doluluk:</span>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                      <FullnessIndicator actual={g.totalActual} target={g.totalTarget} />
                    </div>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Son İşlem:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{g.sonIslem}</span>
                  </div>

                  <button 
                    className="btn btn-secondary" 
                    style={{ width: '100%', fontSize: '0.8rem', padding: '8px' }}
                    onClick={() => setExpandedOrders(prev => ({ ...prev, [g.orderId]: !prev[g.orderId] }))}
                  >
                    {isExpanded ? 'Kolileri Gizle' : `Kolileri Göster (${g.totalCartons})`}
                  </button>

                  {isExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                      {g.cartons.map(c => (
                        <div key={c.id} style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: '#f8fafc' }} onClick={() => handleCartonClick(c)}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.cartonNo}</span>
                            <span className={`badge badge-${c.status.toLowerCase()}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                              {c.status === 'Open' ? 'Açık' : c.status === 'Closed' ? 'Kapalı' : c.status === 'Printed' ? 'Yazdırıldı' : 'Paletlendi'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>SSCC: {c.sscc}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                            <FullnessIndicator actual={c.actualQuantity} target={c.targetQuantity} />
                            <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                              <button className="btn btn-secondary" style={{ padding: '4px 6px', fontSize: '0.7rem' }} onClick={() => handleCartonClick(c)}>Detay</button>
                              <button className="btn btn-primary" style={{ padding: '4px 6px', fontSize: '0.7rem' }} onClick={() => handlePrintPdf(c.id)}>PDF</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 2. Flat List View */
        <div className="table-container">
          <table className="data-table responsive-table-desktop">
            <thead>
              <tr>
                <th>Koli No</th>
                <th>Sipariş No</th>
                <th>Stok Kodu</th>
                <th>SSCC (18 Hane)</th>
                <th>Doluluk</th>
                <th>Durum</th>
                <th>Son İşlem</th>
                <th>Aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCartons.map((c) => {
                const order = orders.find(o => o.id === c.orderId);
                return (
                  <CartonTableRow
                    key={c.id}
                    c={c}
                    orderStockCode={order?.stockCode || ''}
                    isSelected={selectedCarton?.id === c.id}
                    onSelect={() => handleCartonClick(c)}
                    onPrint={() => handlePrintPdf(c.id)}
                  />
                );
              })}
            </tbody>
          </table>

          {/* Flat View Mobile Layout */}
          <div className="responsive-cards-mobile" style={{ display: 'none', padding: '0 8px' }}>
            {paginatedCartons.map((c) => {
              const order = orders.find(o => o.id === c.orderId);
              return (
                <CartonMobileCard
                  key={c.id}
                  c={c}
                  orderStockCode={order?.stockCode || ''}
                  onSelect={() => handleCartonClick(c)}
                  onPrint={() => handlePrintPdf(c.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Main Table Pagination */}
      {!loading && totalItemsCount > ITEMS_PER_PAGE && (
        <div className="pagination" style={{ marginTop: '24px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Toplam: {totalItemsCount} {isGroupedByOrder ? 'sipariş' : 'koli'}
          </span>
          <div className="pagination-buttons">
            <button 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px' }} 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
            >
              Önceki
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '0.9rem', fontWeight: 600 }}>{page}</span>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px' }} 
              disabled={page * ITEMS_PER_PAGE >= totalItemsCount} 
              onClick={() => setPage(p => p + 1)}
            >
              Sonraki
            </button>
          </div>
        </div>
      )}

      {/* Responsive Drawer Backdrop */}
      {selectedCarton && (
        <div className="drawer-backdrop" onClick={() => setSelectedCarton(null)} />
      )}

      {/* Responsive sliding Drawer Panel */}
      <div className={`drawer-container ${selectedCarton ? 'open' : ''}`}>
        {selectedCarton && (
          <>
            {/* Drawer Header */}
            <div className="drawer-header">
              <div>
                <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Package size={20} color="var(--primary)" /> {selectedCarton.cartonNo}
                </h3>
                <code style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>SSCC: {selectedCarton.sscc}</code>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                onClick={() => setSelectedCarton(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="drawer-body">
              {/* Carton Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Sipariş No</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{selectedCarton.orderNo}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Stok Kodu</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{orders.find(o => o.id === selectedCarton.orderId)?.stockCode || '-'}</span>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Durum</span>
                  <span className={`badge badge-${selectedCarton.status.toLowerCase()}`}>
                    {selectedCarton.status === 'Open' ? 'Açık' : selectedCarton.status === 'Closed' ? 'Kapalı' : selectedCarton.status === 'Printed' ? 'Yazdırıldı' : 'Paletlendi'}
                  </span>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Doluluk</span>
                  <FullnessIndicator actual={selectedCarton.actualQuantity} target={selectedCarton.targetQuantity} />
                </div>
              </div>

              {/* Action Buttons & Document Printing */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" style={{ flex: 1, padding: '8px' }} onClick={() => handlePrintPdf(selectedCarton.id)}>
                    <FileText size={16} /> PDF Etiketi
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1, padding: '8px' }} onClick={() => handlePrintZpl(selectedCarton.id)}>
                    <Barcode size={16} /> ZPL Üret
                  </button>
                  <button 
                    className={`btn ${showPrinterSettings ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px' }} 
                    onClick={() => setShowPrinterSettings(!showPrinterSettings)}
                  >
                    <Printer size={16} /> Yazdır
                  </button>
                </div>

                {/* Zebra Direct Network Print Panel */}
                {showPrinterSettings && (
                  <div className="card" style={{ padding: '16px', border: '1px solid var(--primary)', backgroundColor: 'var(--primary-light)', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'none' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', margin: 0, fontWeight: 700 }}>Zebra IP Yazıcıya Gönder</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Yazıcı IP Adresi</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ height: '36px', fontSize: '0.85rem', padding: '6px 10px' }}
                          value={printerIp}
                          onChange={(e) => setPrinterIp(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Port</label>
                        <input
                          type="number"
                          className="form-input"
                          style={{ height: '36px', fontSize: '0.85rem', padding: '6px 10px' }}
                          value={printerPort}
                          onChange={(e) => setPrinterPort(e.target.value)}
                        />
                      </div>
                    </div>
                    <button 
                      className="btn btn-primary" 
                      style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                      disabled={printLoading}
                      onClick={() => handleNetworkPrint(selectedCarton.id)}
                    >
                      {printLoading ? 'Yazdırılıyor...' : 'Yazıcıya Gönder (ZPL)'}
                    </button>
                  </div>
                )}

                {/* Decompose action */}
                {user?.role !== 'Viewer' && (
                  <button 
                    className="btn btn-danger" 
                    style={{ width: '100%', padding: '10px' }} 
                    onClick={() => handleDecompose(selectedCarton.id)}
                  >
                    Koliyi Boz (İptal Et)
                  </button>
                )}
              </div>

              {/* ZPL Raw Output Panel */}
              {zplOutput && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Zebra ZPL Template:</span>
                  <pre style={{
                    backgroundColor: '#0f172a',
                    color: '#38bdf8',
                    padding: '12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    overflowX: 'auto',
                    fontFamily: 'monospace'
                  }}>
                    {zplOutput}
                  </pre>
                </div>
              )}

              {/* Scan Barcode Form */}
              {selectedCarton.status === 'Open' && user?.role !== 'Viewer' && (
                <form onSubmit={handleAddProduct} className="card" style={{ padding: '14px', backgroundColor: 'var(--primary-light)', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: 'none' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>Koliye Ürün Ekle (Barkod Okutun)</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ flex: 1, height: '36px', fontSize: '0.85rem' }} 
                      required 
                      placeholder="Ürün barkodunu okutun veya yazın..." 
                      value={newProductBarcode} 
                      onChange={e => setNewProductBarcode(e.target.value)} 
                    />
                    <button type="submit" className="btn btn-primary" style={{ height: '36px', padding: '0 12px' }}>
                      <Plus size={16} />
                    </button>
                  </div>
                </form>
              )}

              {/* Scanned Barcodes List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                  <h4 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 700 }}>Koli İçi Barkodlar ({cartonItems.length})</h4>
                  <input
                    type="text"
                    className="form-input"
                    style={{ height: '28px', fontSize: '0.75rem', width: '150px', padding: '4px 8px' }}
                    placeholder="Barkodlarda ara..."
                    value={barcodeSearch}
                    onChange={e => {
                      setBarcodeSearch(e.target.value);
                      setBarcodePage(1); // Reset page on query
                    }}
                  />
                </div>
                
                {itemsLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>İçerik yükleniyor...</div>
                ) : cartonItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Bu kolide henüz okutulmuş ürün yok.</div>
                ) : paginatedBarcodes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Arama kriterlerine uygun ürün bulunamadı.</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {paginatedBarcodes.map((item, idx) => (
                        <div key={idx} style={{
                          backgroundColor: '#f8fafc',
                          padding: '10px',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          border: '1px solid var(--border-color)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <div style={{ fontWeight: 600, wordBreak: 'break-all', maxWidth: '85%', color: 'var(--text-main)' }}>{item.rawCode}</div>
                            {user?.role !== 'Viewer' && (
                              <button 
                                onClick={() => handleRemoveProduct(selectedCarton.id, item.rawCode)}
                                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                title="Hatalı Ürünü Çıkar"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginTop: '4px', fontSize: '0.75rem' }}>
                            <span>S/N: {item.serialNo}</span>
                            <span>Okuyan: {item.scannedBy}</span>
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '2px' }}>
                            Okutma Zamanı: {item.scannedAt ? new Date(item.scannedAt).toLocaleString('tr-TR') : '-'}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Barcodes list pagination inside drawer */}
                    {totalBarcodePages > 1 && (
                      <div className="pagination" style={{ borderTop: 'none', paddingTop: 0, justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }} 
                          disabled={barcodePage === 1} 
                          onClick={() => setBarcodePage(p => p - 1)}
                        >
                          Önceki
                        </button>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                          {barcodePage} / {totalBarcodePages}
                        </span>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }} 
                          disabled={barcodePage >= totalBarcodePages} 
                          onClick={() => setBarcodePage(p => p + 1)}
                        >
                          Sonraki
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
