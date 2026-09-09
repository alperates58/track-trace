import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  Search, 
  User, 
  Clock, 
  FileSpreadsheet, 
  FileDown, 
  Layers, 
  Inbox, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  RefreshCw,
  Eye,
  SlidersHorizontal,
  Plus,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { TTPageHeader, TTButton } from '../components/common';

// View states
type ViewMode = 'main' | 'order' | 'stock';

export const Reports: React.FC = () => {
  const { hasPermission } = useAuth();
  // Navigation & View States
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [selectedOrderNo, setSelectedOrderNo] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  
  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // --- VIEW 1: MAIN ORDER REPORTS STATES ---
  const [orders, setOrders] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  
  // Main Filters
  const [filterOrderNo, setFilterOrderNo] = useState('');
  const [filterStockCode, setFilterStockCode] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOnlyMissing, setFilterOnlyMissing] = useState(false);
  const [filterOnlyUsed, setFilterOnlyUsed] = useState(false);
  const [filterOnlyCartoned, setFilterOnlyCartoned] = useState(false);
  const [filterOnlyPalletized, setFilterOnlyPalletized] = useState(false);

  // --- VIEW 2: ORDER DETAILS STATES ---
  const [orderSummary, setOrderSummary] = useState<any>(null);
  const [orderStockCodes, setOrderStockCodes] = useState<any[]>([]);

  // --- VIEW 3: STOCK CODE DETAILS STATES ---
  const [stockDetail, setStockDetail] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'used' | 'missing' | 'cartons' | 'pallets'>('used');
  const [tabSearch, setTabSearch] = useState('');
  const [tabPage, setTabPage] = useState(1);
  const [tabTotal, setTabTotal] = useState(0);
  const [tabItems, setTabItems] = useState<any[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Expandable cartons states inside Tab 3
  const [expandedCartons, setExpandedCartons] = useState<Record<string, boolean>>({});
  const [cartonItems, setCartonItems] = useState<Record<string, any[]>>({});
  const [cartonItemsLoading, setCartonItemsLoading] = useState<Record<string, boolean>>({});

  // --- BACKGROUND JOBS STATES ---
  const [showJobsPanel, setShowJobsPanel] = useState(false);
  const [backgroundJobs, setBackgroundJobs] = useState<any[]>([]);
  const [exportPrompt, setExportPrompt] = useState<any>(null); // { orderNo, stockCode, advice }

  // --- COLUMN SETTINGS STATES ---
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [columnSettings, setColumnSettings] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'used' | 'missing' | 'carton' | 'pallet'>('used');
  const [customColInput, setCustomColInput] = useState('');

  const getDefaultColumnSettings = () => ({
    usedCodes: [
      { key: 'RawCode', label: 'QR / RawCode', enabled: true, isCustom: false },
      { key: 'Gtin', label: 'GTIN', enabled: true, isCustom: false },
      { key: 'SerialNo', label: 'Seri No', enabled: true, isCustom: false },
      { key: 'CartonNo', label: 'Koli No', enabled: true, isCustom: false },
      { key: 'PalletNo', label: 'Palet No', enabled: true, isCustom: false },
      { key: 'ScannedByName', label: 'Okutan Kullanıcı', enabled: true, isCustom: false },
      { key: 'ScannedAt', label: 'Okutma Tarihi', enabled: true, isCustom: false },
      { key: 'Status', label: 'Durum', enabled: true, isCustom: false }
    ],
    missingCodes: [
      { key: 'RawCode', label: 'QR / RawCode', enabled: true, isCustom: false },
      { key: 'Gtin', label: 'GTIN', enabled: true, isCustom: false },
      { key: 'SerialNo', label: 'Seri No', enabled: true, isCustom: false },
      { key: 'Status', label: 'Durum', enabled: true, isCustom: false },
      { key: 'Description', label: 'Açıklama', enabled: true, isCustom: false }
    ],
    cartonDist: [
      { key: 'CartonNo', label: 'Koli No', enabled: true, isCustom: false },
      { key: 'SSCC', label: 'SSCC', enabled: true, isCustom: false },
      { key: 'RawCode', label: 'QR / RawCode', enabled: true, isCustom: false },
      { key: 'SerialNo', label: 'Seri No', enabled: true, isCustom: false },
      { key: 'PalletNo', label: 'Palet No', enabled: true, isCustom: false },
      { key: 'ScannedAt', label: 'Okutma Tarihi', enabled: true, isCustom: false }
    ],
    palletDist: [
      { key: 'PalletNo', label: 'Palet No', enabled: true, isCustom: false },
      { key: 'CartonNo', label: 'Koli No', enabled: true, isCustom: false },
      { key: 'SSCC', label: 'SSCC', enabled: true, isCustom: false },
      { key: 'QrCount', label: 'QR Sayısı', enabled: true, isCustom: false }
    ]
  });

  const fetchColumnSettings = async () => {
    try {
      const res = await api.get('/api/settings/report_column_settings');
      if (res && res.value) {
        setColumnSettings(typeof res.value === 'string' ? JSON.parse(res.value) : res.value);
      } else {
        setColumnSettings(getDefaultColumnSettings());
      }
    } catch {
      setColumnSettings(getDefaultColumnSettings());
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put('/api/settings/report_column_settings', {
        key: 'report_column_settings',
        value: JSON.stringify(columnSettings)
      });
      alert('Rapor kolon ayarları başarıyla kaydedildi! Tüm raporlar bu tercihlere göre üretilecektir.');
      setShowSettingsModal(false);
    } catch (err: any) {
      alert('Ayarlar kaydedilirken hata oluştu: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // -------------------------------------------------------------
  // EFFECT: Fetch Main Order Reports
  // -------------------------------------------------------------
  const fetchOrderReports = () => {
    setLoading(true);
    setError(null);
    let url = `/api/reports/orders?pageNumber=${page}&pageSize=${pageSize}`;
    
    if (filterOrderNo) url += `&orderNo=${encodeURIComponent(filterOrderNo)}`;
    if (filterStockCode) url += `&stockCode=${encodeURIComponent(filterStockCode)}`;
    if (filterStartDate) url += `&startDate=${encodeURIComponent(filterStartDate)}`;
    if (filterEndDate) url += `&endDate=${encodeURIComponent(filterEndDate)}`;
    if (filterStatus) url += `&status=${encodeURIComponent(filterStatus)}`;
    if (filterOnlyMissing) url += `&onlyMissing=true`;
    if (filterOnlyUsed) url += `&onlyUsed=true`;
    if (filterOnlyCartoned) url += `&onlyCartoned=true`;
    if (filterOnlyPalletized) url += `&onlyPalletized=true`;

    api.get(url)
      .then(res => {
        setOrders(res.items || []);
        setTotalCount(res.totalCount || 0);
      })
      .catch(err => {
        setError(err.message || 'Sipariş raporları yüklenirken hata oluştu.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (viewMode === 'main') {
      fetchOrderReports();
    }
  }, [page, viewMode]);

  // -------------------------------------------------------------
  // EFFECT: Fetch Order Details
  // -------------------------------------------------------------
  useEffect(() => {
    if (viewMode === 'order' && selectedOrderNo) {
      setLoading(true);
      setError(null);
      api.get(`/api/reports/orders/${encodeURIComponent(selectedOrderNo)}`)
        .then(res => {
          setOrderSummary(res.summary);
          setOrderStockCodes(res.stockCodes || []);
        })
        .catch(err => {
          setError(err.message || 'Sipariş detayları yüklenirken hata oluştu.');
        })
        .finally(() => setLoading(false));
    }
  }, [viewMode, selectedOrderNo]);

  // -------------------------------------------------------------
  // EFFECT: Fetch Stock Code Details (General Info)
  // -------------------------------------------------------------
  useEffect(() => {
    if (viewMode === 'stock' && selectedOrderId) {
      setLoading(true);
      setError(null);
      api.get(`/api/reports/orders/items/${selectedOrderId}`)
        .then(res => {
          setStockDetail(res);
          // Trigger tab items fetch
          setActiveTab('used');
          setTabPage(1);
          setTabSearch('');
        })
        .catch(err => {
          setError(err.message || 'Stok kodu detayları yüklenirken hata oluştu.');
        })
        .finally(() => setLoading(false));
    }
  }, [viewMode, selectedOrderId]);

  // -------------------------------------------------------------
  // EFFECT: Fetch Tab Data (Used QRs, Missing QRs, Cartons, Pallets)
  // -------------------------------------------------------------
  const fetchTabData = () => {
    if (viewMode !== 'stock' || !selectedOrderId) return;
    setTabLoading(true);
    
    let endpoint = '';
    switch (activeTab) {
      case 'used':
        endpoint = 'scanned-codes';
        break;
      case 'missing':
        endpoint = 'missing-codes';
        break;
      case 'cartons':
        endpoint = 'cartons';
        break;
      case 'pallets':
        endpoint = 'pallets';
        break;
    }

    let url = `/api/reports/orders/items/${selectedOrderId}/${endpoint}?pageNumber=${tabPage}&pageSize=10`;
    if (tabSearch) {
      url += `&search=${encodeURIComponent(tabSearch)}`;
    }

    api.get(url)
      .then(res => {
        setTabItems(res.items || []);
        setTabTotal(res.totalCount || 0);
      })
      .catch(err => {
        console.error(err);
      })
      .finally(() => setTabLoading(false));
  };

  useEffect(() => {
    fetchTabData();
  }, [viewMode, selectedOrderId, activeTab, tabPage]);

  // -------------------------------------------------------------
  // EFFECT: Fetch Background Jobs
  // -------------------------------------------------------------
  const fetchJobs = () => {
    api.get('/api/reports/jobs')
      .then(res => setBackgroundJobs(res || []))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    let interval: any;
    if (showJobsPanel) {
      fetchJobs();
      interval = setInterval(fetchJobs, 5000);
    }
    return () => clearInterval(interval);
  }, [showJobsPanel]);

  // -------------------------------------------------------------
  // Carton Items Expansion inside Tab 3
  // -------------------------------------------------------------
  const toggleCarton = (cartonId: string) => {
    const isCurrentlyExpanded = !!expandedCartons[cartonId];
    setExpandedCartons(prev => ({ ...prev, [cartonId]: !isCurrentlyExpanded }));

    if (!isCurrentlyExpanded && !cartonItems[cartonId]) {
      setCartonItemsLoading(prev => ({ ...prev, [cartonId]: true }));
      api.get(`/api/cartons/${cartonId}/items`)
        .then(res => {
          setCartonItems(prev => ({ ...prev, [cartonId]: res || [] }));
        })
        .catch(err => {
          console.error(err);
        })
        .finally(() => {
          setCartonItemsLoading(prev => ({ ...prev, [cartonId]: false }));
        });
    }
  };

  // -------------------------------------------------------------
  // Export Handlers
  // -------------------------------------------------------------
  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const startBackgroundJob = async (orderNo: string, stockCode?: string, format: string = 'CSV') => {
    try {
      await api.post('/api/reports/jobs', { orderNo, stockCode, format });
      setShowJobsPanel(true);
      setExportPrompt(null);
    } catch (err: any) {
      alert('Arka plan işi başlatılamadı: ' + err.message);
    }
  };

  const handleExportExcel = async (orderNo: string, e: React.MouseEvent, stockCode?: string) => {
    e.stopPropagation();
    const exportKey = `excel-${orderNo}-${stockCode || 'all'}`;
    if (exportingKey) return;

    setExportingKey(exportKey);
    setExportMessage('Rapor hazırlanıyor...');

    try {
      const stockQuery = stockCode ? `?stockCode=${encodeURIComponent(stockCode)}` : '';
      const advice = await api.get(`/api/reports/orders/${encodeURIComponent(orderNo)}/export-advice${stockQuery}`);

      let safeOnly = false;
      let expectedFileName = stockCode
        ? `${orderNo}_${stockCode}_TrackTrace_Raporu.xlsx`
        : `${orderNo}_TrackTrace_Raporu.xlsx`;

      if (advice.strategy === 'large-excel-warning' || advice.strategy === 'split-excel-zip' || advice.strategy === 'mixed' || advice.strategy === 'risky-stock') {
        setExportPrompt({ orderNo, stockCode, advice });
        setExportingKey(null);
        setExportMessage(null);
        return;
      }

      const params = new URLSearchParams();
      if (stockCode) params.set('stockCode', stockCode);
      if (safeOnly) params.set('safeOnly', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';
      const blob = await api.get(`/api/reports/orders/${encodeURIComponent(orderNo)}/excel${query}`);
      downloadBlob(blob, expectedFileName);
    } catch (err: any) {
      alert('Excel raporu üretilirken hata oluştu: ' + err.message);
    } finally {
      setExportingKey(null);
      setExportMessage(null);
    }
  };

  const handleExportPdf = async (orderNo: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const exportKey = `pdf-${orderNo}`;
    if (exportingKey) return;

    setExportingKey(exportKey);
    setExportMessage('Rapor hazırlanıyor...');

    try {
      const blob = await api.get(`/api/reports/orders/${encodeURIComponent(orderNo)}/pdf`);
      downloadBlob(blob, `${orderNo}_TrackTrace_Raporu.pdf`);
    } catch (err: any) {
      alert('PDF raporu üretilirken hata oluştu: ' + err.message);
    } finally {
      setExportingKey(null);
      setExportMessage(null);
    }
  };

  const clearFilters = () => {
    setFilterOrderNo('');
    setFilterStockCode('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterStatus('');
    setFilterOnlyMissing(false);
    setFilterOnlyUsed(false);
    setFilterOnlyCartoned(false);
    setFilterOnlyPalletized(false);
    setPage(1);
    setTimeout(fetchOrderReports, 50);
  };

  // Helper completion percentage rendering
  const renderCompletionBar = (expected: number, used: number) => {
    const rate = expected > 0 ? (used / expected) * 100 : 0;
    let badgeVariant = 'tt-badge-neutral';
    if (rate >= 100) badgeVariant = 'tt-badge-success';
    else if (rate > 0) badgeVariant = 'tt-badge-warning';

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        <div style={{ width: '60px', height: '6px', backgroundColor: 'var(--border-subtle, #334155)', borderRadius: '3px', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ width: `${Math.min(rate, 100)}%`, height: '100%', backgroundColor: rate >= 100 ? 'var(--color-success, #10b981)' : 'var(--primary, #3b82f6)', transition: 'width 0.2s' }} />
        </div>
        <span className={`tt-badge ${badgeVariant} tabular-nums`} style={{ fontSize: '0.72rem', padding: '1px 6px', fontWeight: 600 }}>
          %{rate.toFixed(1)}
        </span>
      </div>
    );
  };

  return (
    <div style={{ padding: '0px' }}>
      {exportMessage && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--primary-light, rgba(59,130,246,0.1))', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm, 6px)', fontWeight: 500, fontSize: '0.85rem' }}>
          {exportMessage}
        </div>
      )}
      
      {/* -------------------------------------------------------------
          VIEW 1: MAIN REPORTING SCREEN (Grouped by OrderNo)
          ------------------------------------------------------------- */}
      {viewMode === 'main' && (
        <div>
          {/* Header */}
          <TTPageHeader
            title="Sipariş Bazlı Raporlama"
            description="Sipariş bazında yükleme, okutma, koli, palet ve tamamlanma oranları takibi."
            actions={
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <TTButton 
                  variant="secondary" 
                  onClick={() => {
                    fetchColumnSettings();
                    setShowSettingsModal(true);
                  }} 
                  icon={<SlidersHorizontal size={14} />}
                >
                  Rapor Kolon Ayarları
                </TTButton>
                <TTButton 
                  variant="secondary" 
                  onClick={() => {
                    fetchJobs();
                    setShowJobsPanel(true);
                  }} 
                  icon={<Clock size={14} className={backgroundJobs.some(j => j.status === 'Processing' || j.status === 'Pending') ? 'animate-spin' : ''} />}
                >
                  Arka Plan Görevleri {backgroundJobs.filter(j => j.status === 'Processing' || j.status === 'Pending').length > 0 && `(${backgroundJobs.filter(j => j.status === 'Processing' || j.status === 'Pending').length})`}
                </TTButton>
                <TTButton variant="secondary" onClick={fetchOrderReports} icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}>
                  Yenile
                </TTButton>
              </div>
            }
          />

          {/* Filters Panel */}
          <div style={{ padding: '18px 20px', marginBottom: '20px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg, 10px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={15} className="text-primary" />
                Rapor Filtreleri
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={clearFilters} style={{ height: '32px', padding: '0 12px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }}>
                  Temizle
                </button>
                <button className="btn btn-primary" onClick={() => { setPage(1); setTimeout(fetchOrderReports, 50); }} style={{ height: '32px', padding: '0 16px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }}>
                  Filtrele
                </button>
              </div>
            </div>
            
            {/* Input Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Sipariş No</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={filterOrderNo} 
                  onChange={e => setFilterOrderNo(e.target.value)} 
                  placeholder="Sipariş No ara..."
                  style={{ height: '36px', padding: '0 10px', fontSize: '0.85rem', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Stok Kodu</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={filterStockCode} 
                  onChange={e => setFilterStockCode(e.target.value)} 
                  placeholder="Stok Kodu ara..."
                  style={{ height: '36px', padding: '0 10px', fontSize: '0.85rem', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Başlangıç Tarihi</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={filterStartDate} 
                  onChange={e => setFilterStartDate(e.target.value)}
                  style={{ height: '36px', padding: '0 10px', fontSize: '0.85rem', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Bitiş Tarihi</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={filterEndDate} 
                  onChange={e => setFilterEndDate(e.target.value)}
                  style={{ height: '36px', padding: '0 10px', fontSize: '0.85rem', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Durum</label>
                <select 
                  className="input-field" 
                  value={filterStatus} 
                  onChange={e => setFilterStatus(e.target.value)}
                  style={{ height: '36px', padding: '0 10px', fontSize: '0.85rem', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="">Tümü</option>
                  <option value="Draft">Taslak</option>
                  <option value="Active">Aktif</option>
                  <option value="Completed">Tamamlandı</option>
                  <option value="Cancelled">İptal Edildi</option>
                </select>
              </div>
            </div>

            {/* Checkbox Filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', paddingTop: '6px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={filterOnlyMissing} onChange={e => setFilterOnlyMissing(e.target.checked)} className="rounded text-primary focus:ring-0" />
                Sadece Eksik Kodlar
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={filterOnlyUsed} onChange={e => setFilterOnlyUsed(e.target.checked)} className="rounded text-primary focus:ring-0" />
                Sadece Kullanılan Kodlar
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={filterOnlyCartoned} onChange={e => setFilterOnlyCartoned(e.target.checked)} className="rounded text-primary focus:ring-0" />
                Sadece Kolilenmiş Kodlar
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={filterOnlyPalletized} onChange={e => setFilterOnlyPalletized(e.target.checked)} className="rounded text-primary focus:ring-0" />
                Sadece Paletlenmiş Kodlar
              </label>
            </div>
          </div>

          {/* Main Table */}
          <div className="table-container" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg, 10px)', overflow: 'hidden' }}>
            {error && (
              <div style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            <table className="data-table">
              <thead>
                <tr>
                  <th>Sipariş No</th>
                  <th>Müşteri / Cari</th>
                  <th style={{ textAlign: 'center' }}>Stok Kodu</th>
                  <th style={{ textAlign: 'right' }}>Beklenen QR</th>
                  <th style={{ textAlign: 'right' }}>Kullanılan QR</th>
                  <th style={{ textAlign: 'right' }}>Eksik QR</th>
                  <th style={{ textAlign: 'center' }}>Koli</th>
                  <th style={{ textAlign: 'center' }}>Palet</th>
                  <th>Tamamlanma Oranı</th>
                  <th>Son İşlem</th>
                  <th style={{ textAlign: 'center' }}>Aksiyonlar</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Yükleniyor...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Filtrelere uygun sipariş kaydı bulunamadı.</td></tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.orderno} style={{ cursor: 'pointer' }} onClick={() => { setSelectedOrderNo(o.orderno); setViewMode('order'); }}>
                      <td><code className="font-mono font-semibold text-primary">{o.orderno}</code></td>
                      <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.customername}>{o.customername || '-'}</td>
                      <td style={{ textAlign: 'center' }}><span className="tt-badge tt-badge-neutral tabular-nums">{o.totalstockcodes}</span></td>
                      <td style={{ textAlign: 'right' }} className="tabular-nums font-semibold">{o.expectedquantity}</td>
                      <td style={{ textAlign: 'right' }} className="tabular-nums font-semibold text-emerald-500">{o.usedquantity}</td>
                      <td style={{ textAlign: 'right' }} className={`tabular-nums font-semibold ${o.missingquantity > 0 ? 'text-red-400' : 'text-slate-400'}`}>{o.missingquantity}</td>
                      <td style={{ textAlign: 'center' }} className="tabular-nums font-medium">{o.totalcartons}</td>
                      <td style={{ textAlign: 'center' }} className="tabular-nums font-medium">{o.totalpallets}</td>
                      <td>{renderCompletionBar(o.expectedquantity, o.usedquantity)}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }} className="tabular-nums">
                        {o.lastprocessedat ? new Date(o.lastprocessedat).toLocaleString('tr-TR') : '-'}
                      </td>
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ height: '28px', padding: '0 8px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: 'var(--radius-sm, 6px)' }}
                            onClick={() => { setSelectedOrderNo(o.orderno); setViewMode('order'); }}
                            title="Detay"
                          >
                            <Eye size={12} /> Detay
                          </button>
                          {hasPermission('reports.export') && (
                            <>
                              <button 
                                className="btn btn-secondary" 
                                style={{ height: '28px', padding: '0 8px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a', borderRadius: 'var(--radius-sm, 6px)' }}
                                onClick={(e) => handleExportExcel(o.orderno, e)} disabled={!!exportingKey}
                                title="Excel İndir"
                              >
                                <FileSpreadsheet size={12} /> Excel
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ height: '28px', padding: '0 8px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#dc2626', borderRadius: 'var(--radius-sm, 6px)' }}
                                onClick={(e) => handleExportPdf(o.orderno, e)} disabled={!!exportingKey}
                                title="PDF İndir"
                              >
                                <FileDown size={12} /> PDF
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            
            {/* Pagination */}
            <div className="pagination" style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 16px', backgroundColor: 'var(--bg-card)' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Toplam: <strong className="tabular-nums text-slate-200">{totalCount}</strong> sipariş</span>
              <div className="pagination-buttons" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button className="btn btn-secondary" style={{ height: '30px', padding: '0 10px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Önceki</button>
                <span className="tabular-nums" style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '0.85rem', fontWeight: 600 }}>{page}</span>
                <button className="btn btn-secondary" style={{ height: '30px', padding: '0 10px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }} disabled={page * pageSize >= totalCount} onClick={() => setPage(p => p + 1)}>Sonraki</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          VIEW 2: ORDER DETAILS SCREEN (List of StockCodes for OrderNo)
          ------------------------------------------------------------- */}
      {viewMode === 'order' && orderSummary && (
        <div>
          {/* Top Bar with Back Button */}
          <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setViewMode('main')} style={{ height: '34px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.85rem' }}>
                <ArrowLeft size={15} /> Geri Dön
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Sipariş Detay Raporu:</span>
                <code className="font-mono text-primary font-bold text-base px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  {selectedOrderNo}
                </code>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              {hasPermission('reports.export') && (
                <>
                  <button className="btn btn-secondary" onClick={(e) => handleExportExcel(selectedOrderNo, e)} disabled={!!exportingKey} style={{ height: '34px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#16a34a', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.85rem' }}>
                    <FileSpreadsheet size={15} /> Excel Raporu
                  </button>
                  <button className="btn btn-secondary" onClick={(e) => handleExportPdf(selectedOrderNo, e)} disabled={!!exportingKey} style={{ height: '34px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#dc2626', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.85rem' }}>
                    <FileDown size={15} /> PDF Raporu
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Summary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Müşteri / Cari</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={orderSummary.customername}>
                {orderSummary.customername || '-'}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stok Kodu Çeşidi</div>
              <div className="tabular-nums font-mono" style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '4px', color: 'var(--primary)' }}>{orderSummary.totalstockcodes}</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Beklenen QR</div>
              <div className="tabular-nums font-mono" style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>{orderSummary.expectedquantity}</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Okutulan / Kullanılan</div>
              <div className="tabular-nums font-mono" style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '4px', color: 'var(--color-success, #10b981)' }}>{orderSummary.usedquantity}</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Eksik / Kalan</div>
              <div className="tabular-nums font-mono" style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '4px', color: orderSummary.missingquantity > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                {orderSummary.missingquantity}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Toplam Koli / Palet</div>
              <div className="tabular-nums font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
                Koli: {orderSummary.totalcartons} / Palet: {orderSummary.totalpallets}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tamamlanma Oranı</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span className="tabular-nums font-mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: orderSummary.usedquantity >= orderSummary.expectedquantity ? 'var(--color-success, #10b981)' : 'var(--primary)' }}>
                  %{(orderSummary.expectedquantity > 0 ? (orderSummary.usedquantity / orderSummary.expectedquantity * 100) : 0).toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Stock Codes Table */}
          <div className="table-container" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg, 10px)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Siparişe Ait Stok Kodları</h3>
            </div>
            
            <table className="data-table">
              <thead>
                <tr>
                  <th>Stok Kodu</th>
                  <th>Ürün Adı</th>
                  <th style={{ textAlign: 'right' }}>Beklenen QR</th>
                  <th style={{ textAlign: 'right' }}>Kullanılan QR</th>
                  <th style={{ textAlign: 'right' }}>Eksik QR</th>
                  <th style={{ textAlign: 'center' }}>Koli Sayısı</th>
                  <th style={{ textAlign: 'center' }}>Palet Sayısı</th>
                  <th>Tamamlanma Oranı</th>
                  <th>Durum</th>
                  <th style={{ textAlign: 'center' }}>Detay</th>
                </tr>
              </thead>
              <tbody>
                {orderStockCodes.map((sc) => {
                  let statusBadge = 'tt-badge-neutral';
                  let statusText = 'Taslak';

                  if (sc.status === 'Active') {
                    statusBadge = 'tt-badge-active';
                    statusText = 'Aktif (Okutuluyor)';
                  } else if (sc.status === 'Completed') {
                    statusBadge = 'tt-badge-success';
                    statusText = 'Tamamlandı';
                  } else if (sc.status === 'Cancelled') {
                    statusBadge = 'tt-badge-danger';
                    statusText = 'İptal Edildi';
                  }

                  return (
                    <tr key={sc.orderid}>
                      <td><code className="font-mono font-semibold text-primary">{sc.stockcode}</code></td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sc.productname}>{sc.productname}</td>
                      <td style={{ textAlign: 'right' }} className="tabular-nums font-semibold">{sc.expectedquantity}</td>
                      <td style={{ textAlign: 'right' }} className="tabular-nums font-semibold text-emerald-500">{sc.usedquantity}</td>
                      <td style={{ textAlign: 'right' }} className={`tabular-nums font-semibold ${sc.missingquantity > 0 ? 'text-red-400' : 'text-slate-400'}`}>{sc.missingquantity}</td>
                      <td style={{ textAlign: 'center' }} className="tabular-nums font-medium">{sc.cartoncount}</td>
                      <td style={{ textAlign: 'center' }} className="tabular-nums font-medium">{sc.palletcount}</td>
                      <td>{renderCompletionBar(sc.expectedquantity, sc.usedquantity)}</td>
                      <td><span className={`tt-badge ${statusBadge}`}>{statusText}</span></td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ height: '28px', padding: '0 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: 'var(--radius-sm, 6px)' }}
                          onClick={() => { setSelectedOrderId(sc.orderid); setViewMode('stock'); }}
                        >
                          <Eye size={12} /> Detaylar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          VIEW 3: STOCK CODE DETAILS SCREEN (Tabs of Used QR, Missing, Cartons, Pallets)
          ------------------------------------------------------------- */}
      {viewMode === 'stock' && stockDetail && (
        <div>
          {/* Top bar with back button */}
          <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setViewMode('order')} style={{ height: '34px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.85rem' }}>
                <ArrowLeft size={15} /> Siparişe Dön
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Stok Detayı:</span>
                <code className="font-mono text-primary font-bold text-base px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  {stockDetail.stockcode}
                </code>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>({stockDetail.productname})</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {hasPermission('reports.export') && (
                <>
                  <button className="btn btn-secondary" onClick={(e) => handleExportExcel(selectedOrderNo, e)} disabled={!!exportingKey} style={{ height: '34px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#16a34a', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.85rem' }}>
                    <FileSpreadsheet size={15} /> Sipariş Exceli
                  </button>
                  <button className="btn btn-secondary" onClick={(e) => handleExportExcel(selectedOrderNo, e, stockDetail.stockcode)} disabled={!!exportingKey} style={{ height: '34px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#059669', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.85rem' }}>
                    <FileSpreadsheet size={15} /> Bu Stok Exceli
                  </button>
                  <button className="btn btn-secondary" onClick={(e) => handleExportPdf(selectedOrderNo, e)} disabled={!!exportingKey} style={{ height: '34px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#dc2626', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.85rem' }}>
                    <FileDown size={15} /> Sipariş PDF'i
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Summary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>GTIN / Barkod</div>
              <div className="tabular-nums font-mono" style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '4px', color: 'var(--text-primary)' }}>{stockDetail.gtin || '-'}</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Beklenen QR</div>
              <div className="tabular-nums font-mono" style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>{stockDetail.expectedquantity}</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Okutulan / Kullanılan</div>
              <div className="tabular-nums font-mono" style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '4px', color: 'var(--color-success, #10b981)' }}>{stockDetail.usedquantity}</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Eksik / Kalan</div>
              <div className="tabular-nums font-mono" style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '4px', color: stockDetail.missingquantity > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                {stockDetail.missingquantity}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Toplam Koli / Palet</div>
              <div className="tabular-nums font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
                Koli: {stockDetail.cartoncount} / Palet: {stockDetail.palletcount}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px 16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tamamlanma Oranı</div>
              <div className="tabular-nums font-mono" style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '4px', color: stockDetail.usedquantity >= stockDetail.expectedquantity ? 'var(--color-success, #10b981)' : 'var(--primary)' }}>
                %{(stockDetail.expectedquantity > 0 ? (stockDetail.usedquantity / stockDetail.expectedquantity * 100) : 0).toFixed(1)}
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '16px', overflowX: 'auto' }}>
            <button 
              className={`tab-btn ${activeTab === 'used' ? 'active' : ''}`}
              onClick={() => { setActiveTab('used'); setTabPage(1); setTabSearch(''); }}
              style={{ 
                padding: '10px 16px', 
                fontWeight: 600, 
                fontSize: '0.85rem',
                border: 'none', 
                borderBottom: activeTab === 'used' ? '2px solid var(--primary)' : '2px solid transparent', 
                background: 'none', 
                color: activeTab === 'used' ? 'var(--primary)' : 'var(--text-secondary)', 
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              1. Kullanılan QR Kodlar 
              <span className="tt-badge tt-badge-neutral tabular-nums text-xs">{stockDetail.usedquantity}</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'missing' ? 'active' : ''}`}
              onClick={() => { setActiveTab('missing'); setTabPage(1); setTabSearch(''); }}
              style={{ 
                padding: '10px 16px', 
                fontWeight: 600, 
                fontSize: '0.85rem',
                border: 'none', 
                borderBottom: activeTab === 'missing' ? '2px solid var(--primary)' : '2px solid transparent', 
                background: 'none', 
                color: activeTab === 'missing' ? 'var(--primary)' : 'var(--text-secondary)', 
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              2. Eksik QR Kodlar 
              <span className="tt-badge tt-badge-neutral tabular-nums text-xs">{stockDetail.missingquantity}</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'cartons' ? 'active' : ''}`}
              onClick={() => { setActiveTab('cartons'); setTabPage(1); setTabSearch(''); }}
              style={{ 
                padding: '10px 16px', 
                fontWeight: 600, 
                fontSize: '0.85rem',
                border: 'none', 
                borderBottom: activeTab === 'cartons' ? '2px solid var(--primary)' : '2px solid transparent', 
                background: 'none', 
                color: activeTab === 'cartons' ? 'var(--primary)' : 'var(--text-secondary)', 
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              3. Koli Dağılımı 
              <span className="tt-badge tt-badge-neutral tabular-nums text-xs">{stockDetail.cartoncount}</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'pallets' ? 'active' : ''}`}
              onClick={() => { setActiveTab('pallets'); setTabPage(1); setTabSearch(''); }}
              style={{ 
                padding: '10px 16px', 
                fontWeight: 600, 
                fontSize: '0.85rem',
                border: 'none', 
                borderBottom: activeTab === 'pallets' ? '2px solid var(--primary)' : '2px solid transparent', 
                background: 'none', 
                color: activeTab === 'pallets' ? 'var(--primary)' : 'var(--text-secondary)', 
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              4. Palet Dağılımı 
              <span className="tt-badge tt-badge-neutral tabular-nums text-xs">{stockDetail.palletcount}</span>
            </button>
          </div>

          {/* Search bar inside Tab */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input 
                type="text" 
                className="input-field" 
                value={tabSearch} 
                onChange={e => setTabSearch(e.target.value)} 
                placeholder={
                  activeTab === 'used' ? "QR, Seri No, Koli veya Palet No ara..." :
                  activeTab === 'missing' ? "QR veya Seri No ara..." :
                  activeTab === 'cartons' ? "Koli No, SSCC veya Palet No ara..." :
                  "Palet No veya SSCC ara..."
                }
                style={{ height: '36px', padding: '0 12px 0 36px', fontSize: '0.85rem', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle)', width: '100%' }}
                onKeyDown={e => { if (e.key === 'Enter') { setTabPage(1); setTimeout(fetchTabData, 50); } }}
              />
              <Search size={15} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
            <button className="btn btn-primary" onClick={() => { setTabPage(1); setTimeout(fetchTabData, 50); }} style={{ height: '36px', padding: '0 18px', fontSize: '0.85rem', borderRadius: 'var(--radius-sm, 6px)' }}>
              Ara
            </button>
          </div>

          {/* TAB 1: USED CODES */}
          {activeTab === 'used' && (
            <div className="table-container" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg, 10px)', overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>QR / RawCode</th>
                    <th>Seri No</th>
                    <th>Koli No</th>
                    <th>Palet No</th>
                    <th>Okutan Kullanıcı</th>
                    <th>Okutma Tarihi</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {tabLoading ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>Yükleniyor...</td></tr>
                  ) : tabItems.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>Okutulmuş QR kod kaydı bulunamadı.</td></tr>
                  ) : (
                    tabItems.map((item) => (
                      <tr key={item.id}>
                        <td><code className="font-mono text-xs text-slate-300" style={{ wordBreak: 'break-all' }}>{item.rawcode}</code></td>
                        <td><strong className="tabular-nums font-mono">{item.serialno}</strong></td>
                        <td>{item.cartonno ? <span className="tt-badge tt-badge-neutral tabular-nums font-mono">{item.cartonno}</span> : <span className="text-red-400 font-semibold text-xs">Kolilenmemiş ⚠️</span>}</td>
                        <td>{item.palletno ? <span className="tt-badge tt-badge-info tabular-nums font-mono">{item.palletno}</span> : <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Palette Değil</span>}</td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem' }}>
                            <User size={12} color="var(--text-secondary)" />
                            {item.scannedby || 'Sistem'}
                          </span>
                        </td>
                        <td>
                          <span className="tabular-nums" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <Clock size={12} />
                            {item.scannedat ? new Date(item.scannedat).toLocaleString('tr-TR') : '-'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span className="tt-badge tt-badge-success">{item.status}</span>
                            {item.doublescanattempts > 0 && (
                              <span className="tt-badge tt-badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '0.68rem' }}>
                                <AlertTriangle size={10} /> {item.doublescanattempts} Mükerrer
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: MISSING CODES */}
          {activeTab === 'missing' && (
            <div className="table-container" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg, 10px)', overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>QR / RawCode</th>
                    <th>Seri No</th>
                    <th>GTIN</th>
                    <th>Durum</th>
                    <th>Açıklama</th>
                  </tr>
                </thead>
                <tbody>
                  {tabLoading ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>Yükleniyor...</td></tr>
                  ) : tabItems.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>Eksik / okutulmayan QR kod kaydı bulunamadı.</td></tr>
                  ) : (
                    tabItems.map((item) => (
                      <tr key={item.id}>
                        <td><code className="font-mono text-xs text-slate-300" style={{ wordBreak: 'break-all' }}>{item.rawcode}</code></td>
                        <td><strong className="tabular-nums font-mono">{item.serialno}</strong></td>
                        <td className="tabular-nums font-mono">{item.gtin}</td>
                        <td><span className="tt-badge tt-badge-neutral">{item.status}</span></td>
                        <td><span className="text-red-400 font-semibold text-xs">Kullanılmadı (Beklemede)</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: CARTONS DISTRIBUTION (Accordion/Lazy loading items) */}
          {activeTab === 'cartons' && (
            <div>
              {tabLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)' }}>Yükleniyor...</div>
              ) : tabItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)' }}>Herhangi bir koli kaydı bulunamadı.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {tabItems.map((carton) => {
                    const isExpanded = !!expandedCartons[carton.id];
                    const items = cartonItems[carton.id] || [];
                    const itemsLoading = !!cartonItemsLoading[carton.id];

                    return (
                      <div key={carton.id} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md, 8px)', overflow: 'hidden' }}>
                        {/* Header Row */}
                        <div 
                          style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', backgroundColor: isExpanded ? 'var(--bg-main)' : 'transparent' }}
                          onClick={() => toggleCarton(carton.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <Inbox size={18} className="text-primary" />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }} className="font-mono">{carton.cartonno}</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>SSCC: <strong className="font-mono text-slate-300">{carton.sscc}</strong></div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Doluluk: </span>
                              <strong className="tabular-nums font-mono" style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{carton.actualquantity} / {carton.targetquantity}</strong>
                            </div>
                            
                            <div>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Palet: </span>
                              <strong className="font-mono" style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{carton.palletno || 'Paletlenmemiş'}</strong>
                            </div>

                            <span className={`tt-badge ${carton.status === 'Open' ? 'tt-badge-active' : 'tt-badge-neutral'}`}>
                              {carton.status === 'Open' ? 'Açık' : 'Kapalı'}
                            </span>

                            {isExpanded ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
                          </div>
                        </div>

                        {/* Expanded Items Drawer (Lazy Loaded) */}
                        {isExpanded && (
                          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 18px', backgroundColor: 'var(--bg-main)' }}>
                            <h4 style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px', color: 'var(--primary)' }}>Koli İçindeki QR Kodları</h4>
                            
                            {itemsLoading ? (
                              <div style={{ padding: '10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>QR kodları yükleniyor...</div>
                            ) : items.length === 0 ? (
                              <div style={{ padding: '10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Koli boş.</div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '6px' }}>
                                {items.map((item, idx) => (
                                  <div key={item.rawCode} style={{ padding: '6px 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 6px)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="font-mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }} title={item.rawCode}>
                                      {idx + 1}. {item.rawCode}
                                    </span>
                                    <span className="tabular-nums font-mono" style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                                      S/N: {item.serialNo}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PALLETS DISTRIBUTION */}
          {activeTab === 'pallets' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tabLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)' }}>Yükleniyor...</div>
              ) : tabItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)' }}>Herhangi bir palet kaydı bulunamadı.</div>
              ) : (
                tabItems.map((pallet) => (
                  <div key={pallet.id} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md, 8px)', padding: '14px 18px' }}>
                    {/* Pallet Title */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Layers size={18} className="text-primary" />
                        <div>
                          <span className="font-mono" style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-primary)' }}>{pallet.palletNo}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '12px' }}>SSCC: <strong className="font-mono text-slate-300">{pallet.sscc}</strong></span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Koli Sayısı: <strong className="tabular-nums font-mono" style={{ color: 'var(--text-primary)' }}>{pallet.cartonCount}</strong></span>
                        <span className={`tt-badge ${pallet.status === 'Open' ? 'tt-badge-active' : 'tt-badge-neutral'}`}>{pallet.status === 'Open' ? 'Açık' : 'Kapalı'}</span>
                      </div>
                    </div>

                    {/* Pallet Cartons */}
                    <div style={{ paddingTop: '4px' }}>
                      <h4 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>İçindeki Koliler</h4>
                      
                      {(!pallet.cartons || pallet.cartons.length === 0) ? (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Palet henüz boş.</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '8px' }}>
                          {pallet.cartons.map((carton: any) => (
                            <div key={carton.SSCC} style={{ padding: '8px 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 6px)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                              <div className="font-mono font-semibold">{carton.CartonNo}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                <span className="font-mono">SSCC: {carton.SSCC ? carton.SSCC.substring(carton.SSCC.length - 8) : '-'}</span>
                                <strong className="tabular-nums font-mono text-slate-300">{carton.ActualQuantity} / {carton.TargetQuantity} ürün</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pagination for tabs */}
          <div className="pagination" style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', padding: '12px 0' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Toplam: <strong className="tabular-nums text-slate-200">{tabTotal}</strong> kayıt</span>
            <div className="pagination-buttons" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button className="btn btn-secondary" style={{ height: '30px', padding: '0 10px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }} disabled={tabPage === 1} onClick={() => setTabPage(p => p - 1)}>Önceki</button>
              <span className="tabular-nums" style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '0.85rem', fontWeight: 600 }}>{tabPage}</span>
              <button className="btn btn-secondary" style={{ height: '30px', padding: '0 10px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }} disabled={tabPage * 10 >= tabTotal} onClick={() => setTabPage(p => p + 1)}>Sonraki</button>
            </div>
          </div>
        </div>
      )}

      {/* --- EXPORT PROMPT MODAL --- */}
      {exportPrompt && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(2px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-subtle)', maxWidth: '520px', width: '100%', boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)' }}>
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <FileSpreadsheet size={20} className="text-primary" /> Rapor Hazırlama Seçenekleri
              </h3>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {exportPrompt.advice.message || 'Sipariş raporunuzu tek bir Excel dosyasında çoklu sayfa olarak veya stok bazlı ZIP arşivi şeklinde hazırlayabilirsiniz.'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* OPTION 1: Single Excel Background (Green Featured) */}
              <button 
                type="button"
                className="btn" 
                onClick={() => startBackgroundJob(exportPrompt.orderNo, exportPrompt.stockCode, 'SingleExcel')}
                style={{ 
                  padding: '14px 16px', 
                  backgroundColor: 'rgba(16, 185, 129, 0.12)', 
                  color: '#34d399', 
                  border: '1px solid rgba(16, 185, 129, 0.3)', 
                  borderRadius: 'var(--radius-md, 8px)', 
                  textAlign: 'left', 
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.92rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>📊 Hepsi Tek Excel'de Hazırla (.xlsx)</span>
                  <span className="tt-badge tt-badge-success" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>Önerilen</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Tüm stok kodları tek bir Excel dosyasında ayrı sekmeler olarak arka planda hazırlanır.
                </div>
              </button>

              {/* OPTION 2: Separate Excel Files ZIP Background */}
              <button 
                type="button"
                className="btn" 
                onClick={() => startBackgroundJob(exportPrompt.orderNo, exportPrompt.stockCode, 'Excel')}
                style={{ 
                  padding: '14px 16px', 
                  backgroundColor: 'var(--bg-main)', 
                  color: 'var(--text-primary)', 
                  border: '1px solid var(--border-subtle)', 
                  borderRadius: 'var(--radius-md, 8px)', 
                  textAlign: 'left', 
                  cursor: 'pointer' 
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                  📦 Stok Bazlı Ayrı Excel Dosyaları (.zip)
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Her stok kodu için ayrı Excel dosyası içeren ZIP arşivi olarak arka planda hazırlanır.
                </div>
              </button>

              {/* OPTION 3: Direct Download Single Excel */}
              <button 
                type="button"
                className="btn" 
                onClick={async () => {
                  const orderNo = exportPrompt.orderNo;
                  const stockCode = exportPrompt.stockCode;
                  setExportPrompt(null);
                  setExportingKey(`excel-${orderNo}-${stockCode || 'all'}`);
                  setExportMessage('Tek Excel raporu hazırlanıyor ve indiriliyor...');
                  try {
                    const params = new URLSearchParams();
                    if (stockCode) params.set('stockCode', stockCode);
                    params.set('forceSingleExcel', 'true');
                    const blob = await api.get(`/api/reports/orders/${encodeURIComponent(orderNo)}/excel?${params.toString()}`);
                    downloadBlob(blob, `${orderNo}_Tek_Excel_Raporu.xlsx`);
                  } catch (err: any) {
                    alert('Excel raporu üretilirken hata oluştu: ' + err.message);
                  } finally {
                    setExportingKey(null);
                    setExportMessage(null);
                  }
                }}
                style={{ 
                  padding: '12px 16px', 
                  backgroundColor: 'rgba(59, 130, 246, 0.08)', 
                  color: 'var(--primary)', 
                  border: '1px solid rgba(59, 130, 246, 0.25)', 
                  borderRadius: 'var(--radius-md, 8px)', 
                  textAlign: 'left', 
                  cursor: 'pointer' 
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                  ⚡ Canlı Tek Excel İndir (.xlsx)
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Arka plana almadan doğrudan tarayıcıda canlı indirir.
                </div>
              </button>

              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={() => setExportPrompt(null)} 
                style={{ height: '34px', padding: '0 16px', marginTop: '4px', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.85rem' }}
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- BACKGROUND JOBS DRAWER/PANEL --- */}
      {showJobsPanel && (
        <div className="report-jobs-panel" style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '360px', backgroundColor: 'var(--bg-card)', borderLeft: '1px solid var(--border-subtle)', boxShadow: '-4px 0 20px rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} className="text-primary" /> Arka Plan Görevleri
            </h3>
            <button className="btn btn-secondary" onClick={() => setShowJobsPanel(false)} style={{ height: '28px', padding: '0 10px', fontSize: '0.78rem', borderRadius: 'var(--radius-sm, 6px)' }}>Kapat</button>
          </div>
          <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {backgroundJobs.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '40px', fontSize: '0.85rem' }}>Aktif veya geçmiş bir görev bulunamadı.</p>
            ) : (
              backgroundJobs.map(job => (
                <div key={job.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md, 8px)', padding: '14px', backgroundColor: 'var(--bg-main)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span className="font-mono font-semibold text-xs text-primary">Sipariş: {job.orderNo}</span>
                    <span className={`tt-badge ${job.status === 'Completed' ? 'tt-badge-success' : job.status === 'Failed' ? 'tt-badge-danger' : 'tt-badge-warning'}`}>
                      {job.status === 'Completed' ? 'Tamamlandı' : job.status === 'Failed' ? 'Hata' : 'İşleniyor'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {job.stockCode && <div>Stok: <span className="font-mono text-slate-300">{job.stockCode}</span></div>}
                    <div className="tabular-nums">Oluşturulma: {new Date(job.createdAt).toLocaleString('tr-TR')}</div>
                  </div>
                  
                  {job.status === 'Processing' || job.status === 'Pending' ? (
                    <div style={{ backgroundColor: 'var(--border-subtle)', height: '6px', borderRadius: '3px', overflow: 'hidden', marginTop: '8px' }}>
                      <div style={{ backgroundColor: 'var(--primary)', height: '100%', width: `${job.progress}%`, transition: 'width 0.3s' }}></div>
                    </div>
                  ) : job.status === 'Completed' ? (
                    <button 
                      className="btn btn-primary" 
                      style={{ width: '100%', height: '32px', marginTop: '8px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }}
                      onClick={async () => {
                        try {
                          const blob = await api.get(`/api/reports/download/${job.downloadToken}`);
                          const isSingleExcel = job.exportFormat === 'SingleExcel' || job.format === 'SingleExcel' || (job.filePath && job.filePath.endsWith('.xlsx'));
                          const ext = isSingleExcel ? '.xlsx' : '.zip';
                          const fileName = job.stockCode 
                            ? `${job.orderNo}_${job.stockCode}_TrackTrace_Raporu${ext}`
                            : `${job.orderNo}_TrackTrace_Raporu${ext}`;
                          downloadBlob(blob, fileName);
                        } catch (err: any) {
                          alert('Rapor dosyası indirilemedi: ' + err.message);
                        }
                      }}
                    >
                      İndir
                    </button>
                  ) : job.status === 'Failed' ? (
                    <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '6px' }}>Hata: {job.errorMessage}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Floating button to open jobs panel */}
      {hasPermission('reports.export') && (
        <button 
          onClick={() => setShowJobsPanel(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary)',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999
          }}
          title="Arka Plan Görevleri"
        >
          <RefreshCw size={18} className={backgroundJobs.some(j => j.status === 'Processing') ? 'animate-spin' : ''} />
        </button>
      )}

      {/* --- REPORT COLUMN SETTINGS MODAL --- */}
      {showSettingsModal && columnSettings && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(2px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--border-subtle)', maxWidth: '760px', width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SlidersHorizontal size={18} className="text-primary" /> Rapor Kolon Ayarları (Dışarı Aktarım)
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Raporda istemediğiniz gereksiz kolonları çıkarabilir, başlıklarını değiştirebilir veya sistemde olmayan yeni kolonlar ekleyebilirsiniz.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowSettingsModal(false)} style={{ height: '30px', padding: '0 12px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }}>Kapat</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-main)', padding: '0 16px', overflowX: 'auto', gap: '4px' }}>
              <button 
                style={{ padding: '10px 14px', border: 'none', background: 'none', fontWeight: 600, fontSize: '0.82rem', borderBottom: settingsTab === 'used' ? '2px solid var(--primary)' : '2px solid transparent', color: settingsTab === 'used' ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                onClick={() => setSettingsTab('used')}
              >
                (B) Kullanılan QR Kodlar
              </button>
              <button 
                style={{ padding: '10px 14px', border: 'none', background: 'none', fontWeight: 600, fontSize: '0.82rem', borderBottom: settingsTab === 'missing' ? '2px solid var(--primary)' : '2px solid transparent', color: settingsTab === 'missing' ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                onClick={() => setSettingsTab('missing')}
              >
                (C) Eksik QR Kodlar
              </button>
              <button 
                style={{ padding: '10px 14px', border: 'none', background: 'none', fontWeight: 600, fontSize: '0.82rem', borderBottom: settingsTab === 'carton' ? '2px solid var(--primary)' : '2px solid transparent', color: settingsTab === 'carton' ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                onClick={() => setSettingsTab('carton')}
              >
                (D) Koli Dağılımı
              </button>
              <button 
                style={{ padding: '10px 14px', border: 'none', background: 'none', fontWeight: 600, fontSize: '0.82rem', borderBottom: settingsTab === 'pallet' ? '2px solid var(--primary)' : '2px solid transparent', color: settingsTab === 'pallet' ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                onClick={() => setSettingsTab('pallet')}
              >
                (E) Palet Dağılımı
              </button>
            </div>

            {/* Content List */}
            <div style={{ padding: '18px 20px', flex: 1, overflowY: 'auto' }}>
              {(() => {
                const sectionKey = settingsTab === 'used' ? 'usedCodes' : settingsTab === 'missing' ? 'missingCodes' : settingsTab === 'carton' ? 'cartonDist' : 'palletDist';
                const cols = columnSettings[sectionKey] || [];

                const toggleEnable = (idx: number) => {
                  const updated = JSON.parse(JSON.stringify(columnSettings));
                  updated[sectionKey][idx].enabled = !updated[sectionKey][idx].enabled;
                  setColumnSettings(updated);
                };

                const updateLabel = (idx: number, newLabel: string) => {
                  const updated = JSON.parse(JSON.stringify(columnSettings));
                  updated[sectionKey][idx].label = newLabel;
                  setColumnSettings(updated);
                };

                const removeColumn = (idx: number) => {
                  const updated = JSON.parse(JSON.stringify(columnSettings));
                  updated[sectionKey].splice(idx, 1);
                  setColumnSettings(updated);
                };

                const addCustomColumn = () => {
                  if (!customColInput.trim()) return;
                  const updated = JSON.parse(JSON.stringify(columnSettings));
                  updated[sectionKey].push({
                    key: `Custom_${Date.now()}`,
                    label: customColInput.trim(),
                    enabled: true,
                    isCustom: true,
                    defaultValue: ''
                  });
                  setColumnSettings(updated);
                  setCustomColInput('');
                };

                return (
                  <div>
                    <div style={{ marginBottom: '14px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Raporda görüntülenmesini istediğiniz kolonları işaretleyin. İşareti kaldırılan kolonlar dışarı aktarılan rapordan çıkarılacaktır.
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                      {cols.map((col: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 6px)', backgroundColor: col.enabled ? 'var(--bg-card)' : 'var(--bg-main)', opacity: col.enabled ? 1 : 0.55 }}>
                          <input 
                            type="checkbox" 
                            checked={col.enabled} 
                            onChange={() => toggleEnable(idx)} 
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            className="rounded text-primary focus:ring-0" 
                          />
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input 
                              type="text" 
                              className="input-field" 
                              value={col.label} 
                              onChange={(e) => updateLabel(idx, e.target.value)} 
                              style={{ height: '32px', padding: '0 8px', fontSize: '0.82rem', fontWeight: 600, flex: 1, maxWidth: '280px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle)' }} 
                            />
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              {col.isCustom ? '(Özel Eklenen Kolon)' : `[Sistem: ${col.key}]`}
                            </span>
                          </div>
                          {col.isCustom && (
                            <button className="btn btn-danger" onClick={() => removeColumn(idx)} style={{ height: '28px', padding: '0 8px', borderRadius: 'var(--radius-sm, 6px)' }} title="Sil">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add Custom Column Form */}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Sistemde Olmayan Özel Kolon Ekle</h4>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="Örn: Kontrol Eden Operator, Özel Notlar..." 
                          value={customColInput} 
                          onChange={(e) => setCustomColInput(e.target.value)} 
                          style={{ flex: 1, height: '36px', padding: '0 10px', fontSize: '0.82rem', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle)' }} 
                        />
                        <button type="button" className="btn btn-primary" onClick={addCustomColumn} style={{ height: '36px', padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', borderRadius: 'var(--radius-sm, 6px)' }}>
                          <Plus size={15} /> Kolon Ekle
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setColumnSettings(getDefaultColumnSettings())}
                style={{ height: '32px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }}
              >
                <RotateCcw size={13} /> Varsayılana Sıfırla
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={() => setShowSettingsModal(false)} style={{ height: '32px', padding: '0 14px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }}>İptal</button>
                <button className="btn btn-primary" onClick={handleSaveSettings} disabled={savingSettings} style={{ height: '32px', padding: '0 16px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }}>
                  {savingSettings ? 'Kaydediliyor...' : 'Kaydet & Uygula'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
