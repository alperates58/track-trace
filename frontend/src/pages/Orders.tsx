import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Upload, Search, ChevronLeft, ChevronRight, Loader2, Eye } from 'lucide-react';
import { OrderGroupDetail } from './OrderGroupDetail';

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
      case 'Taslak': return <span className="badge" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>Taslak</span>;
      case 'Aktif': return <span className="badge" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>Aktif</span>;
      case 'Tamamlandı': return <span className="badge" style={{ backgroundColor: '#dcfce3', color: '#15803d' }}>Tamamlandı</span>;
      case 'İptal': return <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>İptal</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <div style={{ position: 'relative', overflowX: 'hidden', minHeight: '100vh', paddingBottom: '40px' }}>
      
      {/* Subview Routing */}
      {selectedGroupKey ? (
        <OrderGroupDetail 
          groupKey={selectedGroupKey} 
          onBack={() => { setSelectedGroupKey(null); fetchGroups(); }} 
        />
      ) : (
        <>
          {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', marginBottom: '6px', color: '#0f172a', fontWeight: 700 }}>Sipariş Yönetimi</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Sipariş oluşturma, grupları yönetme ve genel ilerleme takibi.</p>
        </div>
        {hasPermission('orders.create') && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn" style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', fontWeight: 600 }} onClick={() => { setShowExcelImportModal(true); setExcelFile(null); setExcelImportResult(null); setExcelError(null); }}>
              <Upload size={18} style={{ marginRight: '6px' }}/> Excel'den Sipariş Aktar
            </button>
            <button className="btn btn-primary" style={{ fontWeight: 600, padding: '10px 20px', borderRadius: '8px' }} onClick={() => setShowCreateModal(true)}>
              <Plus size={18} style={{ marginRight: '6px' }}/> Yeni Sipariş
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #3b82f6', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Toplam Sipariş Grubu</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{kpis?.totalOrderGroups ?? 0}</div>
        </div>
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10b981', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Hedefe Ulaşmayan (Açık)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{kpis?.openOrderGroups ?? 0}</div>
        </div>
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #8b5cf6', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Hedefe Ulaşan (Tamamlanan)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{kpis?.completedOrderGroups ?? 0}</div>
        </div>
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Genel Okutma İlerlemesi</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {kpis?.overallProgressPercentage ?? 0}%
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '16px', marginBottom: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 2, minWidth: '250px', marginBottom: 0 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '6px', display: 'block' }}>Arama</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '38px', width: '100%', height: '42px', borderRadius: '8px' }}
                placeholder="Sipariş No, Müşteri, Stok Kodu, İş Emri No..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '180px', marginBottom: 0 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '6px', display: 'block' }}>Durum Filtresi</label>
            <select
              className="form-input"
              style={{ height: '42px', borderRadius: '8px' }}
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
          <button type="submit" className="btn btn-primary" style={{ height: '42px', padding: '0 24px', borderRadius: '8px', fontWeight: 600 }}>Ara</button>
          <button type="button" className="btn" style={{ height: '42px', padding: '0 24px', borderRadius: '8px', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#475569' }} onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); fetchGroups(); }}>Temizle</button>
        </form>
      </div>

      {/* Main DataGrid */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: '1000px', margin: 0 }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '16px', color: '#475569', fontWeight: 700 }}>Sipariş No</th>
                <th style={{ padding: '16px', color: '#475569', fontWeight: 700 }}>Müşteri</th>
                <th style={{ padding: '16px', color: '#475569', fontWeight: 700, textAlign: 'center' }}>Ürün Satırı</th>
                <th style={{ padding: '16px', color: '#475569', fontWeight: 700, textAlign: 'center' }}>Farklı İş Emri</th>
                <th style={{ padding: '16px', color: '#475569', fontWeight: 700 }}>Okutulan / Hedef</th>
                <th style={{ padding: '16px', color: '#475569', fontWeight: 700 }}>Durum</th>
                <th style={{ padding: '16px', color: '#475569', fontWeight: 700 }}>Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {loading && groups.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="spinner" size={24} style={{ margin: '0 auto' }} /></td></tr>
              ) : groups.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Sipariş grubu bulunamadı.</td></tr>
              ) : (
                groups.map((g) => (
                  <tr key={g.groupKey} style={{ cursor: 'pointer', transition: 'background-color 0.2s' }} onClick={() => setSelectedGroupKey(g.groupKey)} className="hover-row">
                    <td style={{ padding: '16px', fontWeight: 700, color: '#0f172a' }}>{g.orderNo}</td>
                    <td style={{ padding: '16px', color: '#334155' }}>{g.customerName}</td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>{g.lineCount}</span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>{g.distinctWorkOrderCount}</span>
                    </td>
                    <td style={{ padding: '16px', minWidth: '150px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                        <span style={{ color: '#0284c7' }}>{g.totalScannedQuantity.toLocaleString()}</span>
                        <span style={{ color: '#64748b' }}>{g.totalExpectedQuantity.toLocaleString()}</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${g.progressPercentage}%`, backgroundColor: g.progressPercentage === 100 ? '#10b981' : '#3b82f6', transition: 'width 0.3s ease' }}></div>
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>{getStatusBadge(g.statusSummary)}</td>
                    <td style={{ padding: '16px' }}>
                      <button className="btn" style={{ padding: '6px 12px', fontSize: '0.85rem', backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#0f172a', fontWeight: 600, borderRadius: '6px' }} onClick={(e) => { e.stopPropagation(); setSelectedGroupKey(g.groupKey); }}>
                        İncele
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
          <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>Toplam {totalCount} kayıt</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn" style={{ padding: '6px 12px', backgroundColor: '#fff', border: '1px solid #cbd5e1' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, minWidth: '30px', textAlign: 'center' }}>{page}</span>
            <button className="btn" style={{ padding: '6px 12px', backgroundColor: '#fff', border: '1px solid #cbd5e1' }} disabled={page * 10 >= totalCount} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {/* --- CREATE ORDER MODAL --- */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Yeni Sipariş Oluştur</h3>
            {error && <div style={{ color: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '0.85rem' }}>{error}</div>}
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
                <textarea className="form-input" style={{ minHeight: '80px' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Siparişle ilgili notlar..."></textarea>
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>İptal</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EXCEL IMPORT MODAL --- */}
      {showExcelImportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Excel'den Toplu Sipariş Aktarımı</h3>
            {excelError && <div style={{ color: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '0.85rem' }}>{excelError}</div>}
            <form onSubmit={handleExcelImportSubmit}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                <p style={{ marginBottom: '8px' }}>Yükleyeceğiniz Excel dosyasında aşağıdaki kolonların bulunması gerekmektedir:</p>
                <ul style={{ paddingLeft: '20px', listStyleType: 'disc', marginBottom: '12px' }}>
                  <li><strong>Sipariş No</strong> (Benzersiz sipariş numarası)</li>
                  <li><strong>Firma veya Müşteri Adı</strong></li>
                  <li><strong>İş Emri No</strong></li>
                  <li><strong>Stok Kodu</strong></li>
                  <li><strong>Stok İsmi veya Ürün Adı</strong></li>
                  <li><strong>Miktar</strong> (Sipariş miktarı)</li>
                  <li><strong>Koli İçi</strong> (Koli içi ürün adeti - <span style={{ color: 'var(--danger-text)', fontWeight: 'bold' }}>ZORUNLU</span>)</li>
                  <li><strong>Palet İçi</strong> (Palet içi koli adeti - Opsiyonel, varsayılan: 20)</li>
                </ul>
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <input type="file" accept=".xlsx" className="form-input" required onChange={(e) => setExcelFile(e.target.files?.[0] || null)} />
              </div>
              {excelImportResult && (
                <div style={{ backgroundColor: '#f1f5f9', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.85rem' }}>
                  <h4 style={{ fontWeight: 700, marginBottom: '8px' }}>İçe Aktarım Özeti:</h4>
                  <div>Okunan Toplam Satır: <strong style={{ float: 'right' }}>{excelImportResult.totalRows}</strong></div>
                  <div style={{ color: 'var(--success-text)' }}>Eklenen Siparişler: <strong style={{ float: 'right' }}>{excelImportResult.importedCount}</strong></div>
                  <div style={{ color: 'var(--warning-text)' }}>Mükerrer: <strong style={{ float: 'right' }}>{excelImportResult.duplicateCount}</strong></div>
                  <div style={{ color: 'var(--danger-text)' }}>Hatalı/Geçersiz: <strong style={{ float: 'right' }}>{excelImportResult.invalidCount}</strong></div>
                  {excelImportResult.errors && excelImportResult.errors.length > 0 && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                      {excelImportResult.errors.map((e: any, idx: number) => (
                        <div key={idx} style={{ fontSize: '0.75rem', color: 'var(--danger-text)' }}>Satır {e.rowNo}: {e.errorMessage}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
