import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Upload, Search, Eye, Play, CheckCircle2, XCircle, Printer } from 'lucide-react';

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
  
  // Edit Form State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editOrderNo, setEditOrderNo] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editStockCode, setEditStockCode] = useState('');
  const [editProductName, setEditProductName] = useState('');
  const [editGtin, setEditGtin] = useState('');
  const [editProductPerCarton, setEditProductPerCarton] = useState(48);
  const [editCartonPerPallet, setEditCartonPerPallet] = useState(20);
  const [editExpectedQuantity, setEditExpectedQuantity] = useState(1000);
  const [editDescription, setEditDescription] = useState('');
  
  // Print PDF Options State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printCols, setPrintCols] = useState(3);
  const [printRows, setPrintRows] = useState(4);
  const [printSize, setPrintSize] = useState(120);
  const [printAddText, setPrintAddText] = useState(true);
  const [printLine1, setPrintLine1] = useState('');
  const [printLine2, setPrintLine2] = useState('');
  const [printLabelBelow, setPrintLabelBelow] = useState(true);
  const [printSplitSize, setPrintSplitSize] = useState(0);
  const [printingPdf, setPrintingPdf] = useState(false);
  
  // File Import State
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);

  // Excel Order Import State
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelImportResult, setExcelImportResult] = useState<any | null>(null);
  const [excelImporting, setExcelImporting] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  
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

  const openEditModal = (order: Order) => {
    setEditOrderNo(order.orderNo);
    setEditCustomerName(order.customerName);
    setEditStockCode(order.stockCode || '');
    setEditProductName(order.productName || '');
    setEditGtin(order.gtin);
    setEditProductPerCarton(order.productPerCarton);
    setEditCartonPerPallet(order.cartonPerPallet);
    setEditExpectedQuantity(order.expectedQuantity);
    setEditDescription(order.description || '');
    setError(null);
    setShowEditModal(true);
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setError(null);
    try {
      await api.put(`/api/orders/${selectedOrder.id}`, {
        customerName: editCustomerName,
        stockCode: editStockCode,
        productName: editProductName,
        gtin: editGtin,
        productPerCarton: editProductPerCarton,
        cartonPerPallet: editCartonPerPallet,
        expectedQuantity: editExpectedQuantity,
        description: editDescription
      });
      setShowEditModal(false);
      fetchOrders();
      // Reload details
      const updated = await api.get(`/api/orders/${selectedOrder.id}`);
      setSelectedOrder(updated);
    } catch (err: any) {
      setError(err.message || 'Sipariş güncellenemedi.');
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm('Bu siparişi silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve tüm ilişkili veriler silinecektir.')) return;
    setError(null);
    try {
      await api.delete(`/api/orders/${id}`);
      setSelectedOrder(null);
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Sipariş silinemedi.');
    }
  };

  const handlePrintCodes = async () => {
    if (!selectedOrder) return;
    setPrintingPdf(true);
    setError(null);
    try {
      const blob = await api.post(`/api/orders/${selectedOrder.id}/print-codes`, {
        cols: printCols,
        rows: printRows,
        size: printSize,
        addText: printAddText,
        line1: printLine1,
        line2: printLine2,
        labelBelow: printLabelBelow,
        splitSize: printSplitSize
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileExt = printSplitSize > 0 ? 'zip' : 'pdf';
      link.setAttribute('download', `dm_labels_${selectedOrder.orderNo}.${fileExt}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setShowPrintModal(false);
    } catch (err: any) {
      setError(err.message || 'PDF dosyası oluşturulamadı.');
    } finally {
      setPrintingPdf(false);
    }
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
      fetchOrders();
    } catch (err: any) {
      setExcelError(err.message || 'Excel siparişleri yüklenirken hata oluştu.');
    } finally {
      setExcelImporting(false);
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => { setShowExcelImportModal(true); setExcelFile(null); setExcelImportResult(null); setExcelError(null); }}>
              <Upload size={18} /> Excel'den Sipariş Aktar
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={18} /> Yeni Sipariş
            </button>
          </div>
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
      <div className={selectedOrder ? "order-split-grid" : ""} style={{ display: selectedOrder ? undefined : 'block' }}>
        
        {/* Left Side: Order List */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sipariş No</th>
                <th>Müşteri Adı</th>
                <th>İş Emri No</th>
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
              <div><span style={{ color: 'var(--text-muted)' }}>İş Emri No:</span> <code style={{ float: 'right' }}>{selectedOrder.gtin}</code></div>
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
                    <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '8px' }}>
                      <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openEditModal(selectedOrder)}>
                        Düzenle
                      </button>
                      <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleDeleteOrder(selectedOrder.id)}>
                        Sil
                      </button>
                    </div>
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
                {selectedOrder.status === 'Cancelled' && (
                  <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => handleDeleteOrder(selectedOrder.id)}>
                    Sil
                  </button>
                )}
                {selectedOrder.status !== 'Cancelled' && (
                  <button className="btn btn-secondary" style={{ width: '100%', marginTop: '8px' }} onClick={() => { setPrintLine1(selectedOrder.productName || ''); setPrintLine2(selectedOrder.gtin); setShowPrintModal(true); }}>
                    <Printer size={16} /> Kod Sayfası PDF Üret
                  </button>
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

      {/* --- EDIT ORDER MODAL --- */}
      {showEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Siparişi Düzenle</h3>
            
            {error && <div style={{ color: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '0.85rem' }}>{error}</div>}

            <form onSubmit={handleUpdateOrder} className="two-column-grid">
              <div className="form-group">
                <label className="form-label">Sipariş No (Değiştirilemez)</label>
                <input type="text" className="form-input" disabled value={editOrderNo} />
              </div>
              <div className="form-group">
                <label className="form-label">Müşteri Adı *</label>
                <input type="text" className="form-input" required value={editCustomerName} onChange={e => setEditCustomerName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Stok Kodu *</label>
                <input type="text" className="form-input" required value={editStockCode} onChange={e => setEditStockCode(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Stok İsmi *</label>
                <input type="text" className="form-input" required value={editProductName} onChange={e => setEditProductName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">İş Emri No *</label>
                <input type="text" className="form-input" required value={editGtin} onChange={e => setEditGtin(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Beklenen Miktar *</label>
                <input type="number" className="form-input" required value={editExpectedQuantity} onChange={e => setEditExpectedQuantity(parseInt(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Koli İçi Ürün Sayısı *</label>
                <input type="number" className="form-input" required value={editProductPerCarton} onChange={e => setEditProductPerCarton(parseInt(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Palet İçi Koli Sayısı *</label>
                <input type="number" className="form-input" required value={editCartonPerPallet} onChange={e => setEditCartonPerPallet(parseInt(e.target.value))} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Açıklama</label>
                <textarea className="form-input" style={{ minHeight: '80px' }} value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Siparişle ilgili notlar..."></textarea>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>İptal</button>
                <button type="submit" className="btn btn-primary">Değişiklikleri Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- PRINT PDF MODAL --- */}
      {showPrintModal && selectedOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              DataMatrix Barkod Sayfası PDF Oluştur
            </h3>

            {error && <div style={{ color: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '0.85rem' }}>{error}</div>}

            <form onSubmit={(e) => { e.preventDefault(); handlePrintCodes(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="two-column-grid">
                <div className="form-group">
                  <label className="form-label">Sütun Sayısı (Cols)</label>
                  <input type="number" className="form-input" min="1" max="10" required value={printCols} onChange={e => setPrintCols(parseInt(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Satır Sayısı (Rows)</label>
                  <input type="number" className="form-input" min="1" max="15" required value={printRows} onChange={e => setPrintRows(parseInt(e.target.value))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Barkod Boyutu (px): {printSize}px</label>
                <input type="range" min="40" max="300" step="10" className="form-input" style={{ width: '100%' }} value={printSize} onChange={e => setPrintSize(parseInt(e.target.value))} />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="addText" checked={printAddText} onChange={e => setPrintAddText(e.target.checked)} />
                <label htmlFor="addText" style={{ cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>Barkod Yanına Yazı Ekle</label>
              </div>

              {printAddText && (
                <>
                  <div className="form-group">
                    <label className="form-label">Yazı Satırı 1</label>
                    <input type="text" className="form-input" placeholder="Ürün İsmi" value={printLine1} onChange={e => setPrintLine1(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Yazı Satırı 2</label>
                    <input type="text" className="form-input" placeholder="GTIN/İş Emri" value={printLine2} onChange={e => setPrintLine2(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Yazı Konumu</label>
                    <select className="form-input" value={printLabelBelow ? 'below' : 'above'} onChange={e => setPrintLabelBelow(e.target.value === 'below')}>
                      <option value="above">Barkodun Üzerinde</option>
                      <option value="below">Barkodun Altında</option>
                    </select>
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">PDF Parçalama (Split Size)</label>
                <input type="number" className="form-input" min="0" placeholder="0 (Parçalama yok)" value={printSplitSize === 0 ? '' : printSplitSize} onChange={e => setPrintSplitSize(parseInt(e.target.value) || 0)} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Eğer sıfırdan büyük bir sayı girerseniz, her PDF dosyası en fazla bu kadar kod içerir ve tüm PDF'ler tek bir .zip arşivi olarak indirilir.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPrintModal(false)} disabled={printingPdf}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={printingPdf}>
                  {printingPdf ? 'PDF Üretiliyor...' : 'Yazdır & İndir'}
                </button>
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
                Sipariş İş Emri No ({selectedOrder.gtin}) ile uyumlu Rusya Kozmetik GS1 DataMatrix kodlarını içeren <strong>.txt</strong>, <strong>.csv</strong> veya <strong>.xlsx</strong> dosyasını yükleyin.
              </p>
              
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <input
                  type="file"
                  accept=".txt,.csv,.xlsx"
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

      {/* --- EXCEL IMPORT MODAL --- */}
      {showExcelImportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              Excel'den Toplu Sipariş Aktarımı
            </h3>

            {excelError && <div style={{ color: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '0.85rem' }}>{excelError}</div>}

            <form onSubmit={handleExcelImportSubmit}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                <p style={{ marginBottom: '8px' }}>Yükleyeceğiniz Excel dosyasında aşağıdaki kolonların bulunması gerekmektedir:</p>
                <ul style={{ paddingLeft: '20px', listStyleType: 'disc', marginBottom: '12px' }}>
                  <li><strong>Sipariş No</strong> (Benzersiz sipariş numarası)</li>
                  <li><strong>Firma</strong> veya Müşteri Adı</li>
                  <li><strong>İş Emri</strong> veya GTIN numarası</li>
                  <li><strong>Stok Kodu</strong></li>
                  <li><strong>Stok İsmi</strong> veya Ürün Adı</li>
                  <li><strong>Miktar</strong> (Sipariş miktarı)</li>
                  <li><strong>Koli İçi</strong> (Koli içi ürün adeti - <span style={{ color: 'var(--danger-text)', fontWeight: 'bold' }}>ZORUNLU</span>)</li>
                  <li><strong>Palet İçi</strong> (Palet içi koli adeti - Opsiyonel, varsayılan: 20)</li>
                </ul>
                <p style={{ fontStyle: 'italic' }}>* Başlık satırları eşleşmezse sırasıyla ilk 8 kolon bu alanlar olarak kabul edilecektir.</p>
              </div>
              
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <input
                  type="file"
                  accept=".xlsx"
                  className="form-input"
                  required
                  onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                />
              </div>

              {excelImportResult && (
                <div style={{ backgroundColor: '#f1f5f9', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.85rem' }}>
                  <h4 style={{ fontWeight: 700, marginBottom: '8px' }}>İçe Aktarım Özeti:</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>Okunan Toplam Satır: <strong style={{ float: 'right' }}>{excelImportResult.totalRows}</strong></div>
                    <div style={{ color: 'var(--success-text)' }}>Başarıyla Eklenen Siparişler: <strong style={{ float: 'right' }}>{excelImportResult.importedCount}</strong></div>
                    <div style={{ color: 'var(--warning-text)' }}>Mükerrer (Eklenmeyen): <strong style={{ float: 'right' }}>{excelImportResult.duplicateCount}</strong></div>
                    <div style={{ color: 'var(--danger-text)' }}>Hatalı/Geçersiz Satır: <strong style={{ float: 'right' }}>{excelImportResult.invalidCount}</strong></div>
                  </div>
                  
                  {excelImportResult.errors && excelImportResult.errors.length > 0 && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                      <span style={{ fontWeight: 600, color: 'var(--danger-text)' }}>Hata Detayları:</span>
                      {excelImportResult.errors.map((e: any, idx: number) => (
                        <div key={idx} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', paddingBottom: '4px', borderBottom: '1px dotted #e2e8f0' }}>
                          Satır {e.rowNo} {e.orderNo ? `(Sipariş: ${e.orderNo})` : ''}: {e.errorMessage}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowExcelImportModal(false); setExcelImportResult(null); setExcelFile(null); setExcelError(null); }} disabled={excelImporting}>
                  Kapat
                </button>
                <button type="submit" className="btn btn-primary" disabled={excelImporting || !excelFile}>
                  {excelImporting ? 'İçe Aktarılıyor...' : 'Yükle & İçe Aktar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
