import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
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
  Percent
} from 'lucide-react';

// View states
type ViewMode = 'main' | 'order' | 'stock';

export const Reports: React.FC = () => {
  // Navigation & View States
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [selectedOrderNo, setSelectedOrderNo] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  
  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const handleExportExcel = (orderNo: string, e: React.MouseEvent) => {
    e.stopPropagation();
    api.get(`/api/reports/orders/${encodeURIComponent(orderNo)}/excel`)
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${orderNo}_TrackTrace_Raporu.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(err => alert('Excel raporu üretilirken hata oluştu: ' + err.message));
  };

  const handleExportPdf = (orderNo: string, e: React.MouseEvent) => {
    e.stopPropagation();
    api.get(`/api/reports/orders/${encodeURIComponent(orderNo)}/pdf`)
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${orderNo}_TrackTrace_Raporu.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(err => alert('PDF raporu üretilirken hata oluştu: ' + err.message));
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
    let badgeColor = 'badge-secondary';
    if (rate >= 100) badgeColor = 'badge-success';
    else if (rate > 0) badgeColor = 'badge-warning';

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        <div style={{ width: '60px', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(rate, 100)}%`, height: '100%', backgroundColor: rate >= 100 ? 'var(--success)' : 'var(--primary)' }} />
        </div>
        <span className={`badge ${badgeColor}`} style={{ fontSize: '0.75rem', padding: '2px 6px' }}>
          {rate.toFixed(1)}%
        </span>
      </div>
    );
  };

  return (
    <div style={{ padding: '4px' }}>
      
      {/* -------------------------------------------------------------
          VIEW 1: MAIN REPORTING SCREEN (Grouped by OrderNo)
          ------------------------------------------------------------- */}
      {viewMode === 'main' && (
        <div>
          {/* Header */}
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>Sipariş Bazlı Raporlama</h2>
              <p style={{ color: 'var(--text-muted)' }}>Sipariş bazında yükleme, okutma, koli, palet ve tamamlanma oranları takibi.</p>
            </div>
            <button className="btn btn-secondary" onClick={fetchOrderReports} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
              Yenile
            </button>
          </div>

          {/* Filters Panel */}
          <div className="table-container" style={{ padding: '20px', marginBottom: '24px', backgroundColor: 'var(--bg-card)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Rapor Filtreleri</h3>
            
            {/* Input Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Sipariş No</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={filterOrderNo} 
                  onChange={e => setFilterOrderNo(e.target.value)} 
                  placeholder="Sipariş No ara..."
                  style={{ padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Stok Kodu</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={filterStockCode} 
                  onChange={e => setFilterStockCode(e.target.value)} 
                  placeholder="Stok Kodu ara..."
                  style={{ padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Başlangıç Tarihi</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={filterStartDate} 
                  onChange={e => setFilterStartDate(e.target.value)}
                  style={{ padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Bitiş Tarihi</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={filterEndDate} 
                  onChange={e => setFilterEndDate(e.target.value)}
                  style={{ padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Durum</label>
                <select 
                  className="input-field" 
                  value={filterStatus} 
                  onChange={e => setFilterStatus(e.target.value)}
                  style={{ padding: '8px 12px' }}
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', marginTop: '12px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={filterOnlyMissing} onChange={e => setFilterOnlyMissing(e.target.checked)} />
                Sadece Eksik Kodlar
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={filterOnlyUsed} onChange={e => setFilterOnlyUsed(e.target.checked)} />
                Sadece Kullanılan Kodlar
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={filterOnlyCartoned} onChange={e => setFilterOnlyCartoned(e.target.checked)} />
                Sadece Kolilenmiş Kodlar
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={filterOnlyPalletized} onChange={e => setFilterOnlyPalletized(e.target.checked)} />
                Sadece Paletlenmiş Kodlar
              </label>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={clearFilters} style={{ padding: '8px 16px' }}>
                  Temizle
                </button>
                <button className="btn btn-primary" onClick={() => { setPage(1); setTimeout(fetchOrderReports, 50); }} style={{ padding: '8px 24px' }}>
                  Filtrele
                </button>
              </div>
            </div>
          </div>

          {/* Main Table */}
          <div className="table-container">
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
                  <th style={{ textAlign: 'center' }}>Stok Kodu Sayısı</th>
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
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px' }}>Yükleniyor...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Filtrelere uygun sipariş kaydı bulunamadı.</td></tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.orderno} style={{ cursor: 'pointer' }} onClick={() => { setSelectedOrderNo(o.orderno); setViewMode('order'); }}>
                      <td><strong>{o.orderno}</strong></td>
                      <td>{o.customername}</td>
                      <td style={{ textAlign: 'center' }}><span className="badge badge-secondary">{o.totalstockcodes}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{o.expectedquantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success-text)' }}>{o.usedquantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: o.missingquantity > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{o.missingquantity}</td>
                      <td style={{ textAlign: 'center' }}><strong>{o.totalcartons}</strong></td>
                      <td style={{ textAlign: 'center' }}><strong>{o.totalpallets}</strong></td>
                      <td>{renderCompletionBar(o.expectedquantity, o.usedquantity)}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {o.lastprocessedat ? new Date(o.lastprocessedat).toLocaleString('tr-TR') : '-'}
                      </td>
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => { setSelectedOrderNo(o.orderno); setViewMode('order'); }}
                            title="Detay"
                          >
                            <Eye size={12} /> Detay
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a' }}
                            onClick={(e) => handleExportExcel(o.orderno, e)}
                            title="Excel İndir"
                          >
                            <FileSpreadsheet size={12} /> Excel
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#dc2626' }}
                            onClick={(e) => handleExportPdf(o.orderno, e)}
                            title="PDF İndir"
                          >
                            <FileDown size={12} /> PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            
            {/* Pagination */}
            <div className="pagination">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Toplam: {totalCount} sipariş</span>
              <div className="pagination-buttons">
                <button className="btn btn-secondary" style={{ padding: '6px 12px' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Önceki</button>
                <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '0.9rem', fontWeight: 600 }}>{page}</span>
                <button className="btn btn-secondary" style={{ padding: '6px 12px' }} disabled={page * pageSize >= totalCount} onClick={() => setPage(p => p + 1)}>Sonraki</button>
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
          <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="btn btn-secondary" onClick={() => setViewMode('main')} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={16} /> Geri Dön
            </button>
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)' }}>Sipariş Detay Raporu: <strong style={{ color: 'var(--primary)' }}>{selectedOrderNo}</strong></h2>
            
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={(e) => handleExportExcel(selectedOrderNo, e)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#16a34a' }}>
                <FileSpreadsheet size={16} /> Excel Raporu Al
              </button>
              <button className="btn btn-secondary" onClick={(e) => handleExportPdf(selectedOrderNo, e)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#dc2626' }}>
                <FileDown size={16} /> PDF Raporu Al
              </button>
            </div>
          </div>

          {/* Summary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Müşteri / Cari</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={orderSummary.customername}>
                {orderSummary.customername}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Stok Kodu Çeşidi</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px', color: 'var(--primary)' }}>{orderSummary.totalstockcodes}</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Beklenen QR</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px' }}>{orderSummary.expectedquantity}</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Okutulan/Kullanılan</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px', color: 'var(--success)' }}>{orderSummary.usedquantity}</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Eksik / Kalan</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px', color: orderSummary.missingquantity > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                {orderSummary.missingquantity}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Toplam Koli / Palet</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '4px' }}>
                📦 {orderSummary.totalcartons} / 🪚 {orderSummary.totalpallets}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Tamamlanma Oranı</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <Percent size={14} color="var(--primary)" />
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: orderSummary.usedquantity >= orderSummary.expectedquantity ? 'var(--success)' : 'var(--text-main)' }}>
                  {(orderSummary.expectedquantity > 0 ? (orderSummary.usedquantity / orderSummary.expectedquantity * 100) : 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Stock Codes Table */}
          <div className="table-container">
            <h3 style={{ fontSize: '1.1rem', padding: '16px', borderBottom: '1px solid var(--border-color)' }}>Siparişe Ait Stok Kodları</h3>
            
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
                  let statusBadge = 'badge-secondary';
                  let statusText = 'Taslak';

                  if (sc.status === 'Active') {
                    statusBadge = 'badge-active';
                    statusText = 'Aktif (Okutuluyor)';
                  } else if (sc.status === 'Completed') {
                    statusBadge = 'badge-completed';
                    statusText = 'Tamamlandı';
                  } else if (sc.status === 'Cancelled') {
                    statusBadge = 'badge-cancelled';
                    statusText = 'İptal Edildi';
                  }

                  return (
                    <tr key={sc.orderid}>
                      <td><strong>{sc.stockcode}</strong></td>
                      <td>{sc.productname}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{sc.expectedquantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success-text)' }}>{sc.usedquantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: sc.missingquantity > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{sc.missingquantity}</td>
                      <td style={{ textAlign: 'center' }}><strong>{sc.cartoncount}</strong></td>
                      <td style={{ textAlign: 'center' }}><strong>{sc.palletcount}</strong></td>
                      <td>{renderCompletionBar(sc.expectedquantity, sc.usedquantity)}</td>
                      <td><span className={`badge ${statusBadge}`}>{statusText}</span></td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
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
          <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="btn btn-secondary" onClick={() => setViewMode('order')} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={16} /> Siparişe Dön
            </button>
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)' }}>Stok Detayı: <strong style={{ color: 'var(--primary)' }}>{stockDetail.stockcode}</strong></h2>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>({stockDetail.productname})</span>
          </div>

          {/* Summary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>GTIN / Barkod</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px' }}>{stockDetail.gtin}</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Beklenen QR</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px' }}>{stockDetail.expectedquantity}</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Okutulan / Kullanılan</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px', color: 'var(--success)' }}>{stockDetail.usedquantity}</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Eksik / Kalan</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px', color: stockDetail.missingquantity > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                {stockDetail.missingquantity}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Toplam Koli / Palet</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '4px' }}>
                📦 {stockDetail.cartoncount} / 🪚 {stockDetail.palletcount}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Tamamlanma Oranı</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px', color: stockDetail.usedquantity >= stockDetail.expectedquantity ? 'var(--success)' : 'var(--text-main)' }}>
                {(stockDetail.expectedquantity > 0 ? (stockDetail.usedquantity / stockDetail.expectedquantity * 100) : 0).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--border-color)', marginBottom: '16px' }}>
            <button 
              className={`tab-btn ${activeTab === 'used' ? 'active' : ''}`}
              onClick={() => { setActiveTab('used'); setTabPage(1); setTabSearch(''); }}
              style={{ padding: '12px 20px', fontWeight: 600, border: 'none', borderBottom: activeTab === 'used' ? '2px solid var(--primary)' : '2px solid transparent', background: 'none', color: activeTab === 'used' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}
            >
              1. Kullanılan QR Kodlar ({stockDetail.usedquantity})
            </button>
            <button 
              className={`tab-btn ${activeTab === 'missing' ? 'active' : ''}`}
              onClick={() => { setActiveTab('missing'); setTabPage(1); setTabSearch(''); }}
              style={{ padding: '12px 20px', fontWeight: 600, border: 'none', borderBottom: activeTab === 'missing' ? '2px solid var(--primary)' : '2px solid transparent', background: 'none', color: activeTab === 'missing' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}
            >
              2. Eksik QR Kodlar ({stockDetail.missingquantity})
            </button>
            <button 
              className={`tab-btn ${activeTab === 'cartons' ? 'active' : ''}`}
              onClick={() => { setActiveTab('cartons'); setTabPage(1); setTabSearch(''); }}
              style={{ padding: '12px 20px', fontWeight: 600, border: 'none', borderBottom: activeTab === 'cartons' ? '2px solid var(--primary)' : '2px solid transparent', background: 'none', color: activeTab === 'cartons' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}
            >
              3. Koli Dağılımı ({stockDetail.cartoncount})
            </button>
            <button 
              className={`tab-btn ${activeTab === 'pallets' ? 'active' : ''}`}
              onClick={() => { setActiveTab('pallets'); setTabPage(1); setTabSearch(''); }}
              style={{ padding: '12px 20px', fontWeight: 600, border: 'none', borderBottom: activeTab === 'pallets' ? '2px solid var(--primary)' : '2px solid transparent', background: 'none', color: activeTab === 'pallets' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}
            >
              4. Palet Dağılımı ({stockDetail.palletcount})
            </button>
          </div>

          {/* Search bar inside Tab */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
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
                style={{ padding: '8px 12px 8px 36px', width: '100%' }}
                onKeyDown={e => { if (e.key === 'Enter') { setTabPage(1); setTimeout(fetchTabData, 50); } }}
              />
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
            <button className="btn btn-primary" onClick={() => { setTabPage(1); setTimeout(fetchTabData, 50); }} style={{ padding: '8px 20px' }}>
              Ara
            </button>
          </div>

          {/* TAB 1: USED CODES */}
          {activeTab === 'used' && (
            <div className="table-container">
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
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px' }}>Yükleniyor...</td></tr>
                  ) : tabItems.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Okutulmuş QR kod kaydı bulunamadı.</td></tr>
                  ) : (
                    tabItems.map((item) => (
                      <tr key={item.id}>
                        <td><code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{item.rawcode}</code></td>
                        <td><strong>{item.serialno}</strong></td>
                        <td>{item.cartonno ? <span className="badge badge-secondary">{item.cartonno}</span> : <span style={{ color: 'var(--danger-text)', fontWeight: 600 }}>Kolilenmemiş ⚠️</span>}</td>
                        <td>{item.palletno ? <span className="badge badge-printed">{item.palletno}</span> : <span style={{ color: 'var(--text-muted)' }}>Palette Değil</span>}</td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <User size={12} color="var(--text-muted)" />
                            {item.scannedby || 'Sistem'}
                          </span>
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                            <Clock size={12} color="var(--text-muted)" />
                            {item.scannedat ? new Date(item.scannedat).toLocaleString('tr-TR') : '-'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className="badge badge-success">{item.status}</span>
                            {item.doublescanattempts > 0 && (
                              <span className="badge badge-cancelled" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '0.7rem' }}>
                                <AlertTriangle size={10} /> {item.doublescanattempts} Mükerrer Deneme
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
            <div className="table-container">
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
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px' }}>Yükleniyor...</td></tr>
                  ) : tabItems.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Eksik / okutulmayan QR kod kaydı bulunamadı.</td></tr>
                  ) : (
                    tabItems.map((item) => (
                      <tr key={item.id}>
                        <td><code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{item.rawcode}</code></td>
                        <td><strong>{item.serialno}</strong></td>
                        <td>{item.gtin}</td>
                        <td><span className="badge badge-secondary">{item.status}</span></td>
                        <td><span style={{ color: 'var(--danger-text)', fontWeight: 600 }}>Kullanılmadı (Beklemede)</span></td>
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
                <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>Yükleniyor...</div>
              ) : tabItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>Herhangi bir koli kaydı bulunamadı.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {tabItems.map((carton) => {
                    const isExpanded = !!expandedCartons[carton.id];
                    const items = cartonItems[carton.id] || [];
                    const itemsLoading = !!cartonItemsLoading[carton.id];

                    return (
                      <div key={carton.id} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                        {/* Header Row */}
                        <div 
                          style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', backgroundColor: isExpanded ? '#f8fafc' : 'transparent' }}
                          onClick={() => toggleCarton(carton.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <Inbox size={20} color="var(--primary)" />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{carton.cartonno}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>SSCC: <strong>{carton.sscc}</strong></div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <div>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Doluluk: </span>
                              <strong style={{ fontSize: '1rem' }}>{carton.actualquantity} / {carton.targetquantity}</strong>
                            </div>
                            
                            <div>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Palet: </span>
                              <strong>{carton.palletno || 'Paletlenmemiş'}</strong>
                            </div>

                            <span className={`badge ${carton.status === 'Open' ? 'badge-active' : 'badge-completed'}`}>
                              {carton.status}
                            </span>

                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </div>
                        </div>

                        {/* Expanded Items Drawer (Lazy Loaded) */}
                        {isExpanded && (
                          <div style={{ borderTop: '1px solid var(--border-color)', padding: '16px', backgroundColor: '#fdfdfd' }}>
                            <h4 style={{ fontSize: '0.9rem', marginBottom: '8px', color: 'var(--primary)' }}>Koli İçindeki QR Kodları</h4>
                            
                            {itemsLoading ? (
                              <div style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>QR kodları yükleniyor...</div>
                            ) : items.length === 0 ? (
                              <div style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Koli boş.</div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                                {items.map((item, idx) => (
                                  <div key={item.rawCode} style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-sm)', backgroundColor: '#ffffff', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }} title={item.rawCode}>
                                      {idx + 1}. {item.rawCode}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {tabLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>Yükleniyor...</div>
              ) : tabItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>Herhangi bir palet kaydı bulunamadı.</div>
              ) : (
                tabItems.map((pallet) => (
                  <div key={pallet.id} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
                    {/* Pallet Title */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Layers size={22} color="var(--primary)" />
                        <div>
                          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>{pallet.palletNo}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '12px' }}>SSCC: <strong>{pallet.sscc}</strong></span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Koli Sayısı: <strong>{pallet.cartonCount}</strong></span>
                        <span className={`badge ${pallet.status === 'Open' ? 'badge-active' : 'badge-completed'}`}>{pallet.status}</span>
                      </div>
                    </div>

                    {/* Pallet Cartons */}
                    <div style={{ padding: '4px 8px' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>İçindeki Koliler</h4>
                      
                      {(!pallet.cartons || pallet.cartons.length === 0) ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Palet henüz boş.</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                          {pallet.cartons.map((carton: any) => (
                            <div key={carton.SSCC} style={{ padding: '10px', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-sm)', backgroundColor: '#f8fafc', fontSize: '0.85rem' }}>
                              <div style={{ fontWeight: 700 }}>{carton.CartonNo}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                <span>SSCC: {carton.SSCC.substring(carton.SSCC.length - 8)}</span>
                                <strong>{carton.ActualQuantity} / {carton.TargetQuantity} ürün</strong>
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
          <div className="pagination" style={{ marginTop: '20px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Toplam: {tabTotal} kayıt</span>
            <div className="pagination-buttons">
              <button className="btn btn-secondary" style={{ padding: '4px 10px' }} disabled={tabPage === 1} onClick={() => setTabPage(p => p - 1)}>Önceki</button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '0.85rem', fontWeight: 600 }}>{tabPage}</span>
              <button className="btn btn-secondary" style={{ padding: '4px 10px' }} disabled={tabPage * 10 >= tabTotal} onClick={() => setTabPage(p => p + 1)}>Sonraki</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
