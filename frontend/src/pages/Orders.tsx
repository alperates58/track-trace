import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Upload, Search, Eye } from 'lucide-react';

interface Order {
  id: string;
  orderNo: string;
  customerName: string;
  stockCode: string;
  productName: string;
  gtin: string;
  productPerCarton: number;
  cartonPerPallet: number;
  expectedQuantity: number;
  description: string;
  status: string;
  createdAt: string;
  scannedCount: number;
}

export const Orders: React.FC = () => {
  const { user } = useAuth();
  
  // Lists & Paging
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected Order details & Modals
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
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
  
  // File Import State
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = () => {
    setLoading(true);
    const query = `?pageNumber=${page}&pageSize=10&search=${encodeURIComponent(search)}&status=${statusFilter}`;
    api.get(`/api/orders${query}`)
      .then(res => {
        setOrders(res.items);
        setTotalCount(res.totalCount);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
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
      fetchOrders();
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

  const handleStatusChange = async (id: string, action: 'activate' | 'complete' | 'cancel') => {
    if (!confirm(`Bu siparişi ${action === 'activate' ? 'aktifleştirmek' : action === 'complete' ? 'tamamlamak' : 'iptal etmek'} istediğinize emin misiniz?`)) return;
    try {
      await api.post(`/api/orders/${id}/${action}`);
      fetchOrders();
      if (selectedOrder && selectedOrder.id === id) {
        // reload details
        const updated = await api.get(`/api/orders/${id}`);
        setSelectedOrder(updated);
      }
    } catch (err: any) {
      alert(err.message || 'İşlem başarısız.');
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedOrder) return;
    setImporting(true);
    setImportResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await api.post(`/api/orders/${selectedOrder.id}/import-codes`, formData);
      setImportResult(result);
      fetchOrders();
      // Reload details to update counts
      const updated = await api.get(`/api/orders/${selectedOrder.id}`);
      setSelectedOrder(updated);
    } catch (err: any) {
      setError(err.message || 'Kodlar yüklenirken hata oluştu.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>Sipariş Yönetimi</h2>
          <p style={{ color: 'var(--text-muted)' }}>Sipariş oluşturma, barkod yükleme ve sipariş durum takibi.</p>
        </div>
        {user?.role !== 'Viewer' && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} /> Yeni Sipariş
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '250px', marginBottom: 0 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '38px', width: '100%' }}
              placeholder="Sipariş No, Müşteri veya Ürün Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="form-group" style={{ width: '180px', marginBottom: 0 }}>
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tüm Durumlar</option>
            <option value="Draft">Taslak (Draft)</option>
            <option value="Active">Aktif (Active)</option>
            <option value="Completed">Tamamlandı</option>
            <option value="Cancelled">İptal Edildi</option>
          </select>
        </div>
        <button type="submit" className="btn btn-secondary">Ara</button>
      </form>

      {/* Grid Layout: Left List, Right Detail */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedOrder ? '3fr 2fr' : '1fr', gap: '24px' }}>
        
        {/* Left Side: Order List */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sipariş No</th>
                <th>Müşteri Adı</th>
                <th>GTIN</th>
                <th>Okutulan / Hedef</th>
                <th>Durum</th>
                <th>Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {loading && orders.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px' }}>Yükleniyor...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Sipariş bulunamadı.</td></tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} style={{ cursor: 'pointer', backgroundColor: selectedOrder?.id === o.id ? '#f1f5f9' : '' }} onClick={() => setSelectedOrder(o)}>
                    <td style={{ fontWeight: 600 }}>{o.orderNo}</td>
                    <td>{o.customerName}</td>
                    <td><code style={{ fontSize: '0.85rem' }}>{o.gtin}</code></td>
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{o.scannedCount}</span> / {o.expectedQuantity}
                    </td>
                    <td>
                      <span className={`badge badge-${o.status.toLowerCase()}`}>
                        {o.status === 'Draft' ? 'Taslak' : o.status === 'Active' ? 'Aktif' : o.status === 'Completed' ? 'Tamamlandı' : 'İptal'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={(e) => { e.stopPropagation(); setSelectedOrder(o); }}>
                        <Eye size={14} /> Detay
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="pagination">
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Toplam: {totalCount} sipariş</span>
            <div className="pagination-buttons">
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Önceki</button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '0.9rem', fontWeight: 600 }}>{page}</span>
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} disabled={page * 10 >= totalCount} onClick={() => setPage(p => p + 1)}>Sonraki</button>
            </div>
          </div>
        </div>

        {/* Right Side: Order Detail Panel */}
        {selectedOrder && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignSelf: 'start', position: 'sticky', top: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Sipariş Detayı</h3>
              <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => setSelectedOrder(null)}>Kapat</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Sipariş Numarası:</span> <strong style={{ float: 'right' }}>{selectedOrder.orderNo}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Müşteri Adı:</span> <span style={{ float: 'right', fontWeight: 500 }}>{selectedOrder.customerName}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Stok Kodu:</span> <span style={{ float: 'right' }}>{selectedOrder.stockCode || '-'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Ürün Adı:</span> <span style={{ float: 'right' }}>{selectedOrder.productName || '-'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>GTIN:</span> <code style={{ float: 'right' }}>{selectedOrder.gtin}</code></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Koli İçi Adet:</span> <span style={{ float: 'right' }}>{selectedOrder.productPerCarton} adet</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Palet İçi Koli:</span> <span style={{ float: 'right' }}>{selectedOrder.cartonPerPallet} koli</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Beklenen Adet:</span> <span style={{ float: 'right', fontWeight: 600 }}>{selectedOrder.expectedQuantity}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Açıklama:</span> <p style={{ marginTop: '4px', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '4px', fontSize: '0.85rem' }}>{selectedOrder.description || 'Açıklama girilmemiş.'}</p></div>
            </div>

            {/* Actions for Status */}
            {user?.role !== 'Viewer' && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {selectedOrder.status === 'Draft' && (
                  <>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleStatusChange(selectedOrder.id, 'activate')}>
                      <Play size={16} /> Aktifleştir
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
                      <Upload size={16} /> Kod Yükle
                    </button>
                  </>
                )}
                {selectedOrder.status === 'Active' && (
                  <>
                    <button className="btn btn-primary" style={{ flex: 1, backgroundColor: 'var(--success)' }} onClick={() => handleStatusChange(selectedOrder.id, 'complete')}>
                      <CheckCircle2 size={16} /> Tamamla
                    </button>
                    <button className="btn btn-danger" onClick={() => handleStatusChange(selectedOrder.id, 'cancel')}>
                      <XCircle size={16} /> İptal Et
                    </button>
                  </>
                )}
                {(selectedOrder.status === 'Completed' || selectedOrder.status === 'Cancelled') && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', width: '100%' }}>
                    Sipariş tamamlanmış veya iptal edilmiş olduğu için durum değişikliği yapılamaz.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- CREATE ORDER MODAL --- */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Yeni Sipariş Oluştur</h3>
            
            {error && <div style={{ color: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '0.85rem' }}>{error}</div>}

            <form onSubmit={handleCreateOrder} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Sipariş No *</label>
                <input type="text" className="form-input" required value={orderNo} onChange={e => setOrderNo(e.target.value)} placeholder="ORD-2026-0001" />
              </div>
              <div className="form-group">
                <label className="form-label">Müşteri Adı *</label>
                <input type="text" className="form-input" required value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Kozmetik A.Ş." />
              </div>
              <div className="form-group">
                <label className="form-label">Stok Kodu</label>
                <input type="text" className="form-input" value={stockCode} onChange={e => setStockCode(e.target.value)} placeholder="SKU-XYZ-99" />
              </div>
              <div className="form-group">
                <label className="form-label">Ürün Adı</label>
                <input type="text" className="form-input" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Krem Vücut Losyonu" />
              </div>
              <div className="form-group">
                <label className="form-label">GTIN (14 Hane) *</label>
                <input type="text" className="form-input" required maxLength={14} minLength={14} value={gtin} onChange={e => setGtin(e.target.value)} placeholder="04630477370359" />
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

      {/* --- IMPORT MODAL --- */}
      {showImportModal && selectedOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '550px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              Barkod Yükleme ({selectedOrder.orderNo})
            </h3>

            {error && <div style={{ color: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '0.85rem' }}>{error}</div>}

            <form onSubmit={handleImportSubmit}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Sipariş GTIN'i ({selectedOrder.gtin}) ile uyumlu Rusya Kozmetik GS1 DataMatrix kodlarını içeren <strong>.txt</strong> veya <strong>.csv</strong> dosyasını yükleyin. Her satırda tek bir barkod bulunmalıdır.
              </p>
              
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <input
                  type="file"
                  accept=".txt,.csv"
                  className="form-input"
                  required
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>

              {importResult && (
                <div style={{ backgroundColor: '#f1f5f9', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.85rem' }}>
                  <h4 style={{ fontWeight: 700, marginBottom: '8px' }}>Yükleme Sonucu:</h4>
                  <div>Toplam Satır: <strong style={{ float: 'right' }}>{importResult.totalRows}</strong></div>
                  <div style={{ color: 'var(--success-text)' }}>İçe Aktarılan: <strong style={{ float: 'right' }}>{importResult.importedCount}</strong></div>
                  <div style={{ color: 'var(--warning-text)' }}>Mükerrer (Kopyalanmış): <strong style={{ float: 'right' }}>{importResult.duplicateCount}</strong></div>
                  <div style={{ color: 'var(--danger-text)' }}>Hatalı/Geçersiz: <strong style={{ float: 'right' }}>{importResult.invalidCount}</strong></div>
                  
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '8px', maxHeight: '100px', overflowY: 'auto' }}>
                      <span style={{ fontWeight: 600, color: 'var(--danger-text)' }}>Detaylı Hatalar:</span>
                      {importResult.errors.map((e: any, idx: number) => (
                        <div key={idx} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Satır {e.rowNo}: {e.errorMessage} (Kod: <code>{e.rawLine}</code>)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowImportModal(false); setImportResult(null); setFile(null); }} disabled={importing}>Kapat</button>
                <button type="submit" className="btn btn-primary" disabled={importing || !file}>
                  {importing ? 'İçe Aktarılıyor...' : 'Yükle & Çözümle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
