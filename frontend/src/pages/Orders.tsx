import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Upload, Search, ChevronLeft, ChevronRight, Loader2, FileSpreadsheet, Trash2, Package, Clock, CheckCircle2, BarChart2, X } from 'lucide-react';
import { OrderGroupDetail } from './OrderGroupDetail';
import { TTPageHeader } from '../components/common/TTPageHeader';

interface OrderGroup {
  groupKey: string;
  orderNo: string;
  customerName: string;
  lineCount: number;
  distinctWorkOrderCount: number;
  totalExpectedQuantity: number;
  totalScannedQuantity: number;
  progressPercentage: number;
  statusSummary: string;
  lastActivityAt: string;
}

interface OrderGroupKpis {
  totalOrderGroups: number;
  openOrderGroups: number;
  completedOrderGroups: number;
  overallProgressPercentage: number;
}

export const Orders: React.FC = () => {
  const { hasPermission } = useAuth();
  
  // View State
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);

  // Lists & Paging
  const [groups, setGroups] = useState<OrderGroup[]>([]);
  const [kpis, setKpis] = useState<OrderGroupKpis | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  
  // Create Form State
  const [orderNo, setOrderNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [stockCode, setStockCode] = useState('');
  const [productName, setProductName] = useState('');
  const [gtin, setGtin] = useState('');
  const [productPerCarton, setProductPerCarton] = useState(48);
  const [cartonPerPallet, setCartonPerPallet] = useState(20);
  const [expectedQuantity, setExpectedQuantity] = useState(1000);
  const [description, setDescription] = useState('');
  
  // Excel Import State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelImportResult, setExcelImportResult] = useState<any | null>(null);
  const [excelImporting, setExcelImporting] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = () => {
    setLoading(true);
    const query = `?pageNumber=${page}&pageSize=10&search=${encodeURIComponent(search)}&status=${statusFilter}`;
    api.get(`/api/order-groups${query}`)
      .then(res => {
        setGroups(res.items);
        setTotalCount(res.totalCount);
        setKpis(res.kpis);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchGroups();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchGroups();
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/api/orders', {
        orderNo,
        customerName,
        stockCode,
        productName,
        gtin,
        productPerCarton,
        cartonPerPallet,
        expectedQuantity,
        description
      });
      setShowCreateModal(false);
      resetCreateForm();
      fetchGroups();
    } catch (err: any) {
      setError(err.message || 'Sipariş oluşturulamadı.');
    }
  };

  const resetCreateForm = () => {
    setOrderNo('');
    setCustomerName('');
    setStockCode('');
    setProductName('');
    setGtin('');
    setProductPerCarton(48);
    setCartonPerPallet(20);
    setExpectedQuantity(1000);
    setDescription('');
  };

  const handleExcelImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) return;
    setExcelImporting(true);
    setExcelImportResult(null);
    setExcelError(null);

    const formData = new FormData();
    formData.append('file', excelFile);

    try {
      const result = await api.post('/api/orders/import-excel', formData);
      setExcelImportResult(result);
      fetchGroups();
    } catch (err: any) {
      setExcelError(err.message || 'Excel siparişleri yüklenirken hata oluştu.');
    } finally {
      setExcelImporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Taslak':
      case 'Draft':
        return <span className="tt-badge tt-badge-neutral">Taslak</span>;
      case 'Aktif':
      case 'Active':
        return <span className="tt-badge tt-badge-primary">Aktif</span>;
      case 'Tamamlandı':
      case 'Completed':
        return <span className="tt-badge tt-badge-success">Tamamlandı</span>;
      case 'İptal':
      case 'Cancelled':
        return <span className="tt-badge tt-badge-danger">İptal</span>;
      default:
        return <span className="tt-badge tt-badge-neutral">{status}</span>;
    }
  };

  return (
    <div style={{ position: 'relative', overflowX: 'hidden', minHeight: '100%', paddingBottom: '40px' }}>
      {/* Subview Routing */}
      {selectedGroupKey ? (
        <OrderGroupDetail 
          groupKey={selectedGroupKey} 
          onBack={() => { setSelectedGroupKey(null); fetchGroups(); }} 
        />
      ) : (
        <>
          {/* Header */}
          <TTPageHeader
            title="Sipariş Yönetimi"
            description="Sipariş oluşturma, grupları yönetme ve genel ilerleme takibi."
            actions={
              hasPermission('orders.create') ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={() => { setShowExcelImportModal(true); setExcelFile(null); setExcelImportResult(null); setExcelError(null); }}>
                    <Upload size={15} style={{ marginRight: '6px' }}/> Excel'den Sipariş Aktar
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                    <Plus size={15} style={{ marginRight: '6px' }}/> Yeni Sipariş
                  </button>
                </div>
              ) : undefined
            }
          />

          {/* Summary Cards */}
          <div className="stats-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-card-modern">
              <div className="stat-info">
                <span className="stat-title">Toplam Sipariş Grubu</span>
                <span className="stat-value tabular-nums">{kpis?.totalOrderGroups ?? 0}</span>
                <span className="stat-subtext">Sistemde kayıtlı</span>
              </div>
              <div className="stat-icon-wrapper stat-blue">
                <Package size={20} />
              </div>
            </div>

            <div className="stat-card-modern">
              <div className="stat-info">
                <span className="stat-title">Hedefe Ulaşmayan (Açık)</span>
                <span className="stat-value tabular-nums">{kpis?.openOrderGroups ?? 0}</span>
                <span className="stat-subtext">İşlem bekleyen / süren</span>
              </div>
              <div className="stat-icon-wrapper stat-yellow">
                <Clock size={20} />
              </div>
            </div>

            <div className="stat-card-modern">
              <div className="stat-info">
                <span className="stat-title">Hedefe Ulaşan (Tamamlanan)</span>
                <span className="stat-value tabular-nums">{kpis?.completedOrderGroups ?? 0}</span>
                <span className="stat-subtext">Hedeflenen miktara ulaşıldı</span>
              </div>
              <div className="stat-icon-wrapper stat-green">
                <CheckCircle2 size={20} />
              </div>
            </div>

            <div className="stat-card-modern">
              <div className="stat-info">
                <span className="stat-title">Genel Okutma İlerlemesi</span>
                <span className="stat-value tabular-nums">%{kpis?.overallProgressPercentage ?? 0}</span>
                <span className="stat-subtext">Toplam ürün ilerleme oranı</span>
              </div>
              <div className="stat-icon-wrapper stat-purple">
                <BarChart2 size={20} />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card" style={{ padding: '14px 16px', marginBottom: '20px' }}>
            <form onSubmit={handleSearchSubmit} className="orders-filter-form" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 2, minWidth: '240px', marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Arama</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={15} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '36px', width: '100%', height: '36px' }}
                    placeholder="Sipariş No, Müşteri, Stok Kodu, İş Emri No..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '160px', marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Durum Filtresi</label>
                <select
                  className="form-select"
                  style={{ height: '36px' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">Tüm Durumlar</option>
                  <option value="Draft">Taslak</option>
                  <option value="Active">Aktif</option>
                  <option value="Completed">Tamamlandı</option>
                  <option value="Cancelled">İptal</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ height: '36px', padding: '0 16px' }}>Ara</button>
                <button type="button" className="btn btn-secondary" style={{ height: '36px', padding: '0 16px' }} onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); fetchGroups(); }}>Temizle</button>
              </div>
            </form>
          </div>

          {/* Main DataGrid */}
          <div className="table-container" style={{ marginBottom: '20px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ padding: '10px 14px' }}>Sipariş No</th>
                  <th style={{ padding: '10px 14px' }}>Müşteri</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Ürün Satırı</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Farklı İş Emri</th>
                  <th style={{ padding: '10px 14px' }}>Okutulan / Hedef</th>
                  <th style={{ padding: '10px 14px' }}>Durum</th>
                  <th style={{ padding: '10px 14px' }}>Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {loading && groups.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="spinner" size={22} style={{ margin: '0 auto' }} /></td></tr>
                ) : groups.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Sipariş grubu bulunamadı.</td></tr>
                ) : (
                  groups.map((g) => (
                    <tr key={g.groupKey} style={{ cursor: 'pointer' }} onClick={() => setSelectedGroupKey(g.groupKey)} className="hover-row">
                      <td data-label="Sipariş No" style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-main)' }}>
                        <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{g.orderNo}</span>
                      </td>
                      <td data-label="Müşteri" style={{ padding: '12px 14px', color: 'var(--text-main)', fontWeight: 500 }}>{g.customerName}</td>
                      <td data-label="Ürün Satırı" style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span className="tabular-nums" style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '2px 8px', borderRadius: 'var(--radius-xs)', fontWeight: 500, fontSize: '0.8125rem' }}>{g.lineCount}</span>
                      </td>
                      <td data-label="Farklı İş Emri" style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span className="tabular-nums" style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '2px 8px', borderRadius: 'var(--radius-xs)', fontWeight: 500, fontSize: '0.8125rem' }}>{g.distinctWorkOrderCount}</span>
                      </td>
                      <td data-label="Okutulan / Hedef" style={{ padding: '12px 14px' }}>
                        <div className="progress-cell-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px' }}>
                          <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 500, width: '100%' }}>
                            <span style={{ color: 'var(--primary)' }}>{g.totalScannedQuantity.toLocaleString('tr-TR')}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{g.totalExpectedQuantity.toLocaleString('tr-TR')}</span>
                          </div>
                          <div style={{ width: '100%', height: '5px', backgroundColor: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${g.progressPercentage}%`, backgroundColor: g.progressPercentage === 100 ? 'var(--success)' : 'var(--primary)', transition: 'width 0.3s ease' }}></div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Durum" style={{ padding: '12px 14px' }}>{getStatusBadge(g.statusSummary)}</td>
                      <td data-label="Aksiyon" style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8125rem', height: '28px' }} onClick={(e) => { e.stopPropagation(); setSelectedGroupKey(g.groupKey); }}>
                            İncele
                          </button>
                          {hasPermission('orders.delete') && (
                            <button className="btn" style={{ padding: '4px 8px', fontSize: '0.8125rem', height: '28px', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Sipariş Grubunu Komple Sil" onClick={(e) => {
                              e.stopPropagation();
                              if (!window.confirm(`${g.orderNo} (${g.customerName}) sipariş grubu ve bağlı sipariş satırları silinsin mi?`)) return;
                              api.delete(`/api/order-groups/${encodeURIComponent(g.groupKey)}`)
                                .then(() => fetchGroups())
                                .catch(err => alert(err.message || 'Sipariş grubu silinemedi.'));
                            }}>
                              <Trash2 size={13} /> Sil
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-surface-subtle)' }}>
              <span className="tabular-nums" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>Toplam {totalCount} kayıt</span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', height: '28px' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
                <span className="tabular-nums" style={{ fontSize: '0.8125rem', fontWeight: 600, minWidth: '24px', textAlign: 'center', color: 'var(--text-main)' }}>{page}</span>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', height: '28px' }} disabled={page * 10 >= totalCount} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>

          {/* --- CREATE ORDER MODAL --- */}
          {showCreateModal && (
            <div className="tt-modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
              <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: 'var(--shadow-xl)', backgroundColor: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>Yeni Sipariş Oluştur</h3>
                  <button className="btn btn-secondary" style={{ padding: '4px', border: 'none', background: 'transparent' }} onClick={() => setShowCreateModal(false)}>
                    <X size={18} />
                  </button>
                </div>
                {error && <div style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.8125rem' }}>{error}</div>}
                <form onSubmit={handleCreateOrder} className="two-column-grid">
                  <div className="form-group">
                    <label className="form-label">Sipariş No *</label>
                    <input type="text" className="form-input" required value={orderNo} onChange={e => setOrderNo(e.target.value)} placeholder="ORD-2026-0001" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Müşteri Adı *</label>
                    <input type="text" className="form-input" required value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Kozmetik A.Ş." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stok Kodu *</label>
                    <input type="text" className="form-input" required value={stockCode} onChange={e => setStockCode(e.target.value)} placeholder="SKU-XYZ-99" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stok İsmi *</label>
                    <input type="text" className="form-input" required value={productName} onChange={e => setProductName(e.target.value)} placeholder="Krem Vücut Losyonu" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">İş Emri No *</label>
                    <input type="text" className="form-input" required value={gtin} onChange={e => setGtin(e.target.value)} placeholder="WO-2026-001" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Beklenen Miktar *</label>
                    <input type="number" className="form-input" required value={expectedQuantity} onChange={e => setExpectedQuantity(parseInt(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Koli İçi Ürün Sayısı *</label>
                    <input type="number" className="form-input" required value={productPerCarton} onChange={e => setProductPerCarton(parseInt(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Palet İçi Koli Sayısı *</label>
                    <input type="number" className="form-input" required value={cartonPerPallet} onChange={e => setCartonPerPallet(parseInt(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Açıklama</label>
                    <textarea className="form-input" style={{ minHeight: '70px' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Siparişle ilgili notlar..."></textarea>
                  </div>
                  <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>İptal</button>
                    <button type="submit" className="btn btn-primary">Kaydet</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* --- EXCEL IMPORT MODAL --- */}
          {showExcelImportModal && (
            <div className="tt-modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
              <div className="card" style={{ width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: 'var(--shadow-xl)', backgroundColor: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>Excel'den Toplu Sipariş Aktarımı</h3>
                  <button className="btn btn-secondary" style={{ padding: '4px', border: 'none', background: 'transparent' }} onClick={() => { setShowExcelImportModal(false); setExcelImportResult(null); setExcelFile(null); setExcelError(null); }}>
                    <X size={18} />
                  </button>
                </div>
                {excelError && <div style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.8125rem' }}>{excelError}</div>}
                
                {/* Download Sample Template Callout */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', backgroundColor: 'var(--bg-surface-subtle)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.875rem' }}>Örnek Şablon Hazır</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kolon başlıkları tanımlı hazır Excel dosyasını indirebilirsiniz.</div>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={async () => {
                      try {
                        const blob = await api.get('/api/orders/excel-template');
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'TrackTrace_Siparis_Aktarim_Sablonu.xlsx';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                      } catch (err: any) {
                        alert('Şablon indirilirken hata oluştu: ' + err.message);
                      }
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', padding: '6px 12px', flexShrink: 0 }}
                  >
                    <FileSpreadsheet size={15} /> Şablon İndir (.xlsx)
                  </button>
                </div>
                <form onSubmit={handleExcelImportSubmit}>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                    <p style={{ marginBottom: '8px', color: 'var(--text-main)', fontWeight: 500 }}>Yükleyeceğiniz Excel dosyasında aşağıdaki kolonların bulunması gerekmektedir:</p>
                    <ul style={{ paddingLeft: '20px', listStyleType: 'disc', marginBottom: '12px' }}>
                      <li><strong>Sipariş No</strong> (Benzersiz sipariş numarası)</li>
                      <li><strong>Firma veya Müşteri Adı</strong></li>
                      <li><strong>İş Emri No</strong></li>
                      <li><strong>Stok Kodu</strong></li>
                      <li><strong>Stok İsmi veya Ürün Adı</strong></li>
                      <li><strong>Miktar</strong> (Sipariş miktarı)</li>
                      <li><strong>Koli İçi</strong> (Koli içi ürün adeti - <span style={{ color: 'var(--danger)', fontWeight: 600 }}>ZORUNLU</span>)</li>
                      <li><strong>Palet İçi</strong> (Palet içi koli adeti - Opsiyonel, varsayılan: 20)</li>
                    </ul>
                  </div>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <input type="file" accept=".xlsx" className="form-input" required onChange={(e) => setExcelFile(e.target.files?.[0] || null)} />
                  </div>
                  {excelImportResult && (
                    <div style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-color)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.8125rem' }}>
                      <h4 style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>İçe Aktarım Özeti:</h4>
                      <div className="tabular-nums">Okunan Toplam Satır: <strong style={{ float: 'right' }}>{excelImportResult.totalRows}</strong></div>
                      <div className="tabular-nums" style={{ color: 'var(--success)' }}>Eklenen Siparişler: <strong style={{ float: 'right' }}>{excelImportResult.importedCount}</strong></div>
                      <div className="tabular-nums" style={{ color: 'var(--warning)' }}>Mükerrer: <strong style={{ float: 'right' }}>{excelImportResult.duplicateCount}</strong></div>
                      <div className="tabular-nums" style={{ color: 'var(--danger)' }}>Hatalı/Geçersiz: <strong style={{ float: 'right' }}>{excelImportResult.invalidCount}</strong></div>
                      {excelImportResult.errors && excelImportResult.errors.length > 0 && (
                        <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                          {excelImportResult.errors.map((e: any, idx: number) => (
                            <div key={idx} style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>Satır {e.rowNo}: {e.errorMessage}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => { setShowExcelImportModal(false); setExcelImportResult(null); setExcelFile(null); setExcelError(null); }} disabled={excelImporting}>Kapat</button>
                    <button type="submit" className="btn btn-primary" disabled={excelImporting || !excelFile}>{excelImporting ? 'İçe Aktarılıyor...' : 'Yükle & İçe Aktar'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
