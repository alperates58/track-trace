import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Upload, Play, CheckCircle2, XCircle, Printer, X, FileText, Barcode, ChevronLeft, ChevronRight, Loader2, Eye, Trash2, RotateCcw, Archive, Layers } from 'lucide-react';

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

interface ImportBatch {
  id: string;
  orderId: string;
  fileName: string | null;
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  linkedCodeCount: number;
  usedCodeCount: number;
  createdBy: string | null;
  createdAt: string;
  canDelete: boolean;
}

interface OrderLineDetailModalProps {
  selectedOrder: Order;
  onClose: () => void;
  onOrderUpdated: () => void;
}

export const OrderLineDetailModal: React.FC<OrderLineDetailModalProps> = ({ selectedOrder, onClose, onOrderUpdated }) => {
  const { user, hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<'summary' | 'cartons' | 'pallets' | 'codes' | 'imports'>('summary');
  const [showImportModal, setShowImportModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pallets State
  const [pallets, setPallets] = useState<any[]>([]);
  const [palletsTotal, setPalletsTotal] = useState(0);
  const [palletsLoading, setPalletsLoading] = useState(false);

  // Cartons State
  const [cartons, setCartons] = useState<any[]>([]);
  const [cartonsLoading, setCartonsLoading] = useState(false);
  const [selectedCartonForItems, setSelectedCartonForItems] = useState<any | null>(null);
  const [cartonItems, setCartonItems] = useState<any[]>([]);
  const [cartonItemsLoading, setCartonItemsLoading] = useState(false);

  // Product Codes State
  const [codes, setCodes] = useState<any[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesPage, setCodesPage] = useState(1);
  const [codesTotal, setCodesTotal] = useState(0);
  const [codesSearch, setCodesSearch] = useState('');
  const [codesStatusFilter, setCodesStatusFilter] = useState('');

  // Import Batches State
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [importBatchesLoading, setImportBatchesLoading] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [clearingCodes, setClearingCodes] = useState(false);

  // Print State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printCols, setPrintCols] = useState(3);
  const [printRows, setPrintRows] = useState(4);
  const [printSize, setPrintSize] = useState(120);
  const [printAddText, setPrintAddText] = useState(true);
  const [printLine1, setPrintLine1] = useState(selectedOrder.productName || '');
  const [printLine2, setPrintLine2] = useState(selectedOrder.gtin || '');
  const [printLabelBelow, setPrintLabelBelow] = useState(true);
  const [printSplitSize, setPrintSplitSize] = useState(0);
  const [printCodeScope, setPrintCodeScope] = useState<'all' | 'unassigned'>('all');
  const [printingPdf, setPrintingPdf] = useState(false);

  // File Import State
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);

  const fetchProductCodes = () => {
    setCodesLoading(true);
    api.get(`/api/orders/${selectedOrder.id}/product-codes?page=${codesPage}&pageSize=50&search=${encodeURIComponent(codesSearch)}&status=${codesStatusFilter}`)
      .then(res => {
        setCodes(res.items);
        setCodesTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setCodesLoading(false));
  };

  const fetchImportBatches = () => {
    setImportBatchesLoading(true);
    api.get(`/api/orders/${selectedOrder.id}/import-batches`)
      .then(res => setImportBatches(res || []))
      .catch(console.error)
      .finally(() => setImportBatchesLoading(false));
  };

  const fetchOrderCartons = (orderId: string) => {
    setCartonsLoading(true);
    api.get(`/api/cartons?orderId=${orderId}&pageSize=1000`)
      .then(res => {
        setCartons(res.items || []);
      })
      .catch(console.error)
      .finally(() => setCartonsLoading(false));
  };

  const loadCartonItems = (carton: any) => {
    setSelectedCartonForItems(carton);
    setCartonItemsLoading(true);
    api.get(`/api/cartons/${carton.id}/items`)
      .then(res => setCartonItems(res || []))
      .catch(console.error)
      .finally(() => setCartonItemsLoading(false));
  };

  const fetchPallets = () => {
    setPalletsLoading(true);
    api.get(`/api/pallets?orderId=${selectedOrder.id}&pageSize=1000`)
      .then((res: any) => {
        setPallets(res.items || []);
        setPalletsTotal(res.totalCount || res.items?.length || 0);
      })
      .catch(console.error)
      .finally(() => setPalletsLoading(false));
  };

  useEffect(() => {
    fetchOrderCartons(selectedOrder.id);
    fetchProductCodes();
    fetchImportBatches();
    fetchPallets();
  }, [selectedOrder.id]);

  useEffect(() => {
    if (activeTab === 'codes') {
      fetchProductCodes();
    }
  }, [codesPage, codesStatusFilter]);

  const productionByDate = useMemo(() => {
    const groups: { [key: string]: number } = {};
    cartons.forEach(c => {
      if (!c.createdAt) return;
      const dateStr = new Date(c.createdAt).toLocaleDateString('tr-TR');
      groups[dateStr] = (groups[dateStr] || 0) + c.actualQuantity;
    });
    return Object.entries(groups).map(([date, count]) => ({ date, count })).sort((a, b) => b.date.localeCompare(a.date));
  }, [cartons]);

  const handleCodesSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCodesPage(1);
    fetchProductCodes();
  };

  const handleStatusChange = async (id: string, action: 'activate' | 'complete' | 'cancel') => {
    if (!confirm(`Bu satırı ${action === 'activate' ? 'aktifleştirmek' : action === 'complete' ? 'tamamlamak' : 'iptal etmek'} istediğinize emin misiniz?`)) return;
    try {
      await api.post(`/api/orders/${id}/${action}`);
      onOrderUpdated();
    } catch (err: any) {
      alert(err.message || 'İşlem başarısız.');
    }
  };

  const handleDeleteImportBatch = async (batch: ImportBatch) => {
    if (!confirm(`${batch.fileName || 'Bu yükleme'} kaydı ve ona bağlı ${batch.linkedCodeCount} kod sunucudan silinsin mi?`)) return;
    setDeletingBatchId(batch.id);
    try {
      await api.delete(`/api/orders/${selectedOrder.id}/import-batches/${batch.id}`);
      fetchImportBatches();
      onOrderUpdated();
    } catch (err: any) {
      alert(err.message || 'Yükleme kaydı silinemedi.');
    } finally {
      setDeletingBatchId(null);
    }
  };

  const handleClearOrderCodes = async () => {
    if (!confirm('Bu sipariş satırındaki tüm yüklenmiş barkodlar ve yükleme geçmişi sunucudan silinsin mi? Üretim/okutma başladıysa işlem engellenir.')) return;
    setClearingCodes(true);
    try {
      const result = await api.delete(`/api/orders/${selectedOrder.id}/product-codes`);
      fetchImportBatches();
      setCodes([]);
      setCodesTotal(0);
      alert(`${result?.deletedCodes || 0} kod silindi.`);
      onOrderUpdated();
    } catch (err: any) {
      alert(err.message || 'Kodlar temizlenemedi.');
    } finally {
      setClearingCodes(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!confirm(`${selectedOrder.orderNo} (${selectedOrder.stockCode}) sipariş satırı sistemden tamamen silinsin mi?`)) return;
    try {
      await api.delete(`/api/orders/${selectedOrder.id}`);
      onClose();
      onOrderUpdated();
    } catch (err: any) {
      alert(err.message || 'Sipariş silinemedi.');
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await api.post(`/api/orders/${selectedOrder.id}/import-codes`, formData);
      setImportResult(result);
      alert(`Kodlar başarıyla çözümlendi ve yüklendi!\nİçe Aktarılan: ${result.importedCount || 0}\nHatalı: ${result.invalidCount || 0}`);
      fetchImportBatches();
      onOrderUpdated();
    } catch (err: any) {
      setError(err.message || 'Kodlar yüklenirken hata oluştu.');
    } finally {
      setImporting(false);
    }
  };

  const handlePrintCodes = async () => {
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
        splitSize: printSplitSize,
        onlyUnassigned: printCodeScope === 'unassigned'
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileExt = printSplitSize > 0 ? 'zip' : 'pdf';
      const scopeSuffix = printCodeScope === 'unassigned' ? '_acikta' : '';
      link.setAttribute('download', `dm_labels_${selectedOrder.orderNo}${scopeSuffix}.${fileExt}`);
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

  const downloadCartonPdf = async (cartonId: string, cartonNo: string) => {
    try {
      const response = await api.get(`/api/cartons/${cartonId}/label.pdf`);
      const url = window.URL.createObjectURL(response);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cartonNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('PDF indirme hatası:', err);
      alert('PDF indirilirken hata oluştu.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Draft': return <span className="badge" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>Taslak</span>;
      case 'Active': return <span className="badge" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>Aktif</span>;
      case 'Completed': return <span className="badge" style={{ backgroundColor: '#dcfce3', color: '#15803d' }}>Tamamlandı</span>;
      case 'Cancelled': return <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>İptal</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  const getCartonStatusBadge = (status: string) => {
    switch (status) {
      case 'Open': return <span className="badge" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>Açık</span>;
      case 'Closed': return <span className="badge" style={{ backgroundColor: '#f3e8ff', color: '#6b21a8' }}>Kapalı</span>;
      case 'Printed': return <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>Yazdırıldı</span>;
      case 'Palletized': return <span className="badge" style={{ backgroundColor: '#dcfce3', color: '#15803d' }}>Paletlendi</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  const getProductCodeStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'uploaded': return 'Yüklendi';
      case 'scanned': return 'Okutuldu';
      case 'packed': return 'Kolilendi';
      case 'shipped': return 'Sevk Edildi';
      default: return status;
    }
  };

  return (
    <div className="order-line-modal-overlay" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(4px)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }} onClick={onClose}>
      <div className="order-line-modal" style={{
        width: '100%',
        maxWidth: '1200px',
        height: '85vh',
        backgroundColor: '#fff',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }} onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="order-line-modal-header" style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#f8fafc' }}>
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              Sipariş Satırı Detayı 
              {getStatusBadge(selectedOrder.status)}
            </h3>
            <p style={{ color: '#475569', fontSize: '0.95rem', margin: 0, fontWeight: 600 }}>{selectedOrder.orderNo} / {selectedOrder.customerName} — <span style={{ color: '#0f172a' }}>{selectedOrder.productName || '-'}</span></p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {hasPermission('orders.delete') && (
              <button 
                className="btn" 
                style={{ padding: '8px 16px', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', fontWeight: 700, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem' }}
                onClick={handleDeleteOrder}
                title="Bu Sipariş Satırını Sil"
              >
                <Trash2 size={16} /> Sipariş Satırını Sil
              </button>
            )}
            <button className="btn" style={{ padding: '8px', borderRadius: '50%', backgroundColor: '#e2e8f0', color: '#475569', border: 'none' }} onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="order-line-modal-tabs" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 24px', backgroundColor: '#fff' }}>
          <button
            style={{ padding: '16px 24px', border: 'none', background: 'none', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', borderBottom: activeTab === 'summary' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'summary' ? '#3b82f6' : '#64748b', transition: 'all 0.2s' }}
            onClick={() => setActiveTab('summary')}
          >
            <FileText size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
            Özet
          </button>
          <button
            style={{ padding: '16px 24px', border: 'none', background: 'none', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', borderBottom: activeTab === 'cartons' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'cartons' ? '#3b82f6' : '#64748b', transition: 'all 0.2s' }}
            onClick={() => setActiveTab('cartons')}
          >
            <Barcode size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
            Koliler ({cartons.length})
          </button>
          <button
            style={{ padding: '16px 24px', border: 'none', background: 'none', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', borderBottom: activeTab === 'pallets' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'pallets' ? '#3b82f6' : '#64748b', transition: 'all 0.2s' }}
            onClick={() => setActiveTab('pallets')}
          >
            <Layers size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
            Paletler ({palletsTotal})
          </button>
          <button 
            style={{ padding: '16px 24px', border: 'none', background: 'none', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', borderBottom: activeTab === 'codes' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'codes' ? '#3b82f6' : '#64748b', transition: 'all 0.2s' }}
            onClick={() => setActiveTab('codes')}
          >
            <Barcode size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
            Kodlar ({codesTotal})
          </button>
          <button
            style={{ padding: '16px 24px', border: 'none', background: 'none', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', borderBottom: activeTab === 'imports' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'imports' ? '#3b82f6' : '#64748b', transition: 'all 0.2s' }}
            onClick={() => setActiveTab('imports')}
          >
            <Archive size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
            Yüklemeler ({importBatches.length})
          </button>
        </div>

        {/* Modal Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#f1f5f9' }}>
          
          {activeTab === 'summary' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="card" style={{ padding: '16px', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Sipariş No</div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedOrder.orderNo}</div>
                  </div>
                  <div className="card" style={{ padding: '16px', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Müşteri</div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedOrder.customerName}</div>
                  </div>
                  <div className="card" style={{ padding: '16px', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>İş Emri No</div>
                    <div><code style={{ backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '0.85rem' }}>{selectedOrder.gtin}</code></div>
                  </div>
                  <div className="card" style={{ padding: '16px', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Stok Kodu</div>
                    <div style={{ fontWeight: 600, color: '#334155' }}>{selectedOrder.stockCode || '-'}</div>
                  </div>
                  <div className="card" style={{ gridColumn: 'span 2', padding: '16px', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Stok İsmi / Ürün Adı</div>
                    <div style={{ fontWeight: 500, color: '#0f172a', wordBreak: 'break-word' }}>{selectedOrder.productName || '-'}</div>
                  </div>
                </div>

                <div className="card" style={{ padding: '20px', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>Üretim Hedefleri</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Beklenen Adet</div>
                      <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0f172a' }}>{selectedOrder.expectedQuantity}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Okutulan Adet</div>
                      <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0284c7' }}>{selectedOrder.scannedCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Kalan Adet</div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#b91c1c' }}>{Math.max(0, selectedOrder.expectedQuantity - selectedOrder.scannedCount)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Tamamlanma Yüzdesi</div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#10b981' }}>
                        {selectedOrder.expectedQuantity > 0 ? Math.round((selectedOrder.scannedCount / selectedOrder.expectedQuantity) * 100) : 0}%
                      </div>
                    </div>
                    <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '12px', marginTop: '4px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Koli İçi Adet</div>
                      <div style={{ fontWeight: 600 }}>{selectedOrder.productPerCarton}</div>
                    </div>
                    <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '12px', marginTop: '4px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Palet İçi Koli</div>
                      <div style={{ fontWeight: 600 }}>{selectedOrder.cartonPerPallet}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="card" style={{ padding: '20px', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>Günlük Üretim Raporu</h4>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {productionByDate.length === 0 ? (
                      <div style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '40px' }}>Henüz üretim kaydı bulunmuyor.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {productionByDate.map((p, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                            <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>{p.date}</span>
                            <span style={{ fontWeight: 800, color: '#1e3a8a', fontSize: '0.95rem' }}>{p.count} adet okutuldu</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card" style={{ padding: '16px', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>Açıklama</div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                    {selectedOrder.description || 'Açıklama bulunmuyor.'}
                  </p>
                </div>

                <div className="card" style={{ padding: '16px', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Oluşturma Tarihi</div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{new Date(selectedOrder.createdAt).toLocaleString('tr-TR')}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cartons' && (
            <div className="card" style={{ padding: '20px', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', minHeight: '500px' }}>
              {cartonsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="spinner" size={40} /></div>
              ) : cartons.length === 0 ? (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '100px', fontSize: '1.1rem' }}>Bu siparişe ait henüz koli bulunmuyor.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                  {cartons.map((c: any) => (
                    <div key={c.id} style={{ 
                      backgroundColor: '#fff', 
                      borderRadius: '12px', 
                      border: '1px solid #e2e8f0',
                      padding: '16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '180px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>{c.cartonNo}</span>
                          {getCartonStatusBadge(c.status)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace', marginBottom: '12px', wordBreak: 'break-all' }}>
                          SSCC: {c.sscc}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>
                          <span style={{ color: '#64748b' }}>Doluluk</span>
                          <span style={{ color: '#0f172a' }}>{c.actualQuantity} / {c.targetQuantity}</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${Math.min(100, Math.round((c.actualQuantity / c.targetQuantity) * 100))}%`, 
                            backgroundColor: c.status === 'Closed' || c.status === 'Printed' || c.status === 'Palletized' ? '#10b981' : '#3b82f6',
                            transition: 'width 0.3s'
                          }}></div>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>
                          Tarih: {new Date(c.createdAt).toLocaleString('tr-TR')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                        <button className="btn" style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontWeight: 600 }} onClick={() => loadCartonItems(c)}>
                          <Eye size={14} /> İçerik
                        </button>
                        <button className="btn btn-secondary" style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontWeight: 600 }} onClick={() => downloadCartonPdf(c.id, c.cartonNo)}>
                          <Printer size={14} /> PDF
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pallets' && (
            <div className="card" style={{ padding: '20px', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', minHeight: '500px' }}>
              {palletsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="spinner" size={40} /></div>
              ) : pallets.length === 0 ? (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '100px', fontSize: '1.1rem' }}>Bu siparişe ait henüz palet bulunmuyor.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                  {pallets.map((p: any) => (
                    <div key={p.id} style={{ 
                      backgroundColor: '#fff', 
                      borderRadius: '12px', 
                      border: '1px solid #e2e8f0',
                      padding: '16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '160px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>{p.palletNo}</span>
                          <span className="badge" style={{ 
                            backgroundColor: p.status === 'Closed' ? '#dcfce3' : p.status === 'Printed' ? '#dbeafe' : '#fef3c7', 
                            color: p.status === 'Closed' ? '#166534' : p.status === 'Printed' ? '#1e40af' : '#92400e' 
                          }}>{p.status}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace', marginBottom: '12px', wordBreak: 'break-all' }}>
                          SSCC: {p.sscc}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '12px', fontWeight: 600 }}>
                          <span style={{ color: '#64748b' }}>Koli Sayısı</span>
                          <span style={{ color: '#0f172a' }}>{p.cartonCount} Koli</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>
                          Tarih: {new Date(p.createdAt).toLocaleString('tr-TR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'codes' && (
            <div className="card" style={{ padding: '20px', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
              <form onSubmit={handleCodesSearchSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Kod veya Seri No Ara..." 
                  style={{ flex: 1, minWidth: '200px' }}
                  value={codesSearch}
                  onChange={e => setCodesSearch(e.target.value)}
                />
                <select 
                  className="form-input" 
                  style={{ width: '150px' }}
                  value={codesStatusFilter}
                  onChange={e => setCodesStatusFilter(e.target.value)}
                >
                  <option value="">Tüm Durumlar</option>
                  <option value="uploaded">Yüklendi</option>
                  <option value="scanned">Okutuldu</option>
                  <option value="packed">Kolilendi</option>
                  <option value="shipped">Sevk Edildi</option>
                </select>
                <button type="submit" className="btn btn-secondary">Ara</button>
              </form>

              <div style={{ flex: 1, overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table className="data-table" style={{ margin: 0, minWidth: '800px' }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr>
                      <th style={{ padding: '12px' }}>Raw Code</th>
                      <th style={{ padding: '12px' }}>Seri No</th>
                      <th style={{ padding: '12px' }}>Durum</th>
                      <th style={{ padding: '12px' }}>Okutulma Tarihi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codesLoading ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="spinner" size={24} style={{ margin: '0 auto' }} /></td></tr>
                    ) : codes.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Bu siparişe ait kod bulunamadı.</td></tr>
                    ) : (
                      codes.map((c: any) => (
                        <tr key={c.id}>
                          <td style={{ padding: '12px', fontSize: '0.85rem', fontFamily: 'monospace' }}>{c.rawCode}</td>
                          <td style={{ padding: '12px', fontSize: '0.85rem' }}>{c.serialNo || '-'}</td>
                          <td style={{ padding: '12px' }}>
                            <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.75rem' }}>{getProductCodeStatusLabel(c.status)}</span>
                          </td>
                          <td style={{ padding: '12px', fontSize: '0.85rem', color: '#64748b' }}>
                            {c.scannedAt ? new Date(c.scannedAt).toLocaleString('tr-TR') : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Toplam: {codesTotal} kod</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px' }} disabled={codesPage === 1} onClick={() => setCodesPage(p => p - 1)}><ChevronLeft size={16} /></button>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{codesPage}</span>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px' }} disabled={codesPage * 50 >= codesTotal} onClick={() => setCodesPage(p => p + 1)}><ChevronRight size={16} /></button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'imports' && (
            <div className="card" style={{ padding: '20px', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', minHeight: '420px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Kod Yükleme Kayıtları</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0' }}>Bu sipariş satırına yüklenen dosyaları ve bağlı kodları yönetin.</p>
                </div>
                {hasPermission('orders.edit') && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(selectedOrder.status === 'Draft' || selectedOrder.status === 'Cancelled' || selectedOrder.status === 'Active') && (
                      <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowImportModal(true)}>
                        <Upload size={16} /> Yeni Kod Yükle
                      </button>
                    )}
                    <button className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleClearOrderCodes} disabled={clearingCodes}>
                      {clearingCodes ? <Loader2 className="spinner" size={16} /> : <Trash2 size={16} />}
                      Tüm Kodları Temizle
                    </button>
                  </div>
                )}
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table className="data-table" style={{ margin: 0, minWidth: '980px' }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr>
                      <th style={{ padding: '12px' }}>Tarih</th>
                      <th style={{ padding: '12px' }}>Dosya</th>
                      <th style={{ padding: '12px' }}>Satır</th>
                      <th style={{ padding: '12px' }}>Eklenen</th>
                      <th style={{ padding: '12px' }}>Mükerrer</th>
                      <th style={{ padding: '12px' }}>Hatalı</th>
                      <th style={{ padding: '12px' }}>Bağlı Kod</th>
                      <th style={{ padding: '12px' }}>Kullanılan</th>
                      <th style={{ padding: '12px' }}>Kullanıcı</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importBatchesLoading ? (
                      <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="spinner" size={24} style={{ margin: '0 auto' }} /></td></tr>
                    ) : importBatches.length === 0 ? (
                      <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Bu siparişe ait yükleme kaydı bulunamadı.</td></tr>
                    ) : (
                      importBatches.map((batch) => (
                        <tr key={batch.id}>
                          <td style={{ padding: '12px', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{new Date(batch.createdAt).toLocaleString('tr-TR')}</td>
                          <td style={{ padding: '12px', fontWeight: 600, color: '#0f172a', maxWidth: '220px', wordBreak: 'break-word' }}>{batch.fileName || '-'}</td>
                          <td style={{ padding: '12px' }}>{batch.totalRows.toLocaleString()}</td>
                          <td style={{ padding: '12px', color: '#15803d', fontWeight: 700 }}>{batch.importedCount.toLocaleString()}</td>
                          <td style={{ padding: '12px', color: '#b45309' }}>{batch.duplicateCount.toLocaleString()}</td>
                          <td style={{ padding: '12px', color: batch.invalidCount > 0 ? '#b91c1c' : '#64748b' }}>{batch.invalidCount.toLocaleString()}</td>
                          <td style={{ padding: '12px' }}>{batch.linkedCodeCount.toLocaleString()}</td>
                          <td style={{ padding: '12px' }}>
                            <span className="badge" style={{ backgroundColor: batch.usedCodeCount > 0 ? '#fee2e2' : '#dcfce7', color: batch.usedCodeCount > 0 ? '#b91c1c' : '#166534' }}>
                              {batch.usedCodeCount.toLocaleString()}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>{batch.createdBy || '-'}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            {hasPermission('orders.edit') && (
                              <button
                                className="btn btn-danger"
                                style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                disabled={!batch.canDelete || deletingBatchId === batch.id}
                                title={!batch.canDelete ? 'Bu yükleme eski kayıtlara bağlı değil veya kullanılan kod içeriyor.' : 'Bu yüklemenin kodlarını sil'}
                                onClick={() => handleDeleteImportBatch(batch)}
                              >
                                {deletingBatchId === batch.id ? <Loader2 className="spinner" size={14} /> : <Trash2 size={14} />}
                                Sil
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        {activeTab === 'summary' && (
          <div className="order-line-modal-footer" style={{ padding: '20px 24px', backgroundColor: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            {selectedOrder.status === 'Draft' && (
              <>
                {hasPermission('orders.edit') && (
                  <>
                    <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center' }} onClick={() => setShowImportModal(true)}>
                      <Upload size={16} style={{ marginRight: '6px' }}/> Kod Yükle
                    </button>
                    <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center' }} onClick={() => handleStatusChange(selectedOrder.id, 'activate')}>
                      <Play size={16} style={{ marginRight: '6px' }}/> Aktifleştir
                    </button>
                  </>
                )}
              </>
            )}

            {selectedOrder.status === 'Active' && (
              <>
                {hasPermission('orders.edit') && (
                  <button className="btn btn-danger" style={{ display: 'flex', alignItems: 'center' }} onClick={() => handleStatusChange(selectedOrder.id, 'cancel')}>
                    <XCircle size={16} style={{ marginRight: '6px' }}/> İptal Et
                  </button>
                )}
                {user?.role !== 'Viewer' && (
                  <>
                    <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center' }} onClick={() => { setError(null); setShowPrintModal(true); }}>
                      <Printer size={16} style={{ marginRight: '6px' }}/> Kod Sayfası PDF Üret
                    </button>
                    <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', backgroundColor: '#0ea5e9' }} onClick={() => window.location.href = `/scan?orderId=${selectedOrder.id}`}>
                      <Barcode size={16} style={{ marginRight: '6px' }}/> Scan Ekranına Git
                    </button>
                  </>
                )}
                {hasPermission('orders.edit') && (
                  <button className="btn btn-primary" style={{ backgroundColor: '#10b981', display: 'flex', alignItems: 'center' }} onClick={() => handleStatusChange(selectedOrder.id, 'complete')}>
                    <CheckCircle2 size={16} style={{ marginRight: '6px' }}/> Tamamla
                  </button>
                )}
              </>
            )}

            {selectedOrder.status === 'Cancelled' && (
              <>
                {hasPermission('orders.edit') && (
                  <>
                    <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center' }} onClick={() => setActiveTab('imports')}>
                      <Archive size={16} style={{ marginRight: '6px' }}/> Yüklemeleri Yönet
                    </button>
                    <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center' }} onClick={() => setShowImportModal(true)}>
                      <Upload size={16} style={{ marginRight: '6px' }}/> Kod Yükle
                    </button>
                    <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center' }} onClick={() => handleStatusChange(selectedOrder.id, 'activate')}>
                      <RotateCcw size={16} style={{ marginRight: '6px' }}/> Tekrar Aktifleştir
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Carton Items Sub-Modal */}
      {selectedCartonForItems && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(2px)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }} onClick={() => setSelectedCartonForItems(null)}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '650px',
            maxHeight: '75vh',
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            padding: '24px',
            backgroundColor: '#fff',
            display: 'flex',
            flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Koli İçeriği ({selectedCartonForItems.cartonNo})
              </h3>
              <button className="btn" style={{ padding: '6px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: '#475569', border: 'none' }} onClick={() => setSelectedCartonForItems(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }}>
              {cartonItemsLoading ? (
                <div style={{ textAlign: 'center', padding: '30px' }}><Loader2 className="spinner" size={24} style={{ margin: '0 auto' }} /></div>
              ) : cartonItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Bu kolide henüz okutulmuş ürün bulunmuyor.</div>
              ) : (
                <table className="data-table" style={{ margin: 0 }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr>
                      <th style={{ padding: '8px 12px', fontSize: '0.85rem' }}>Barkod / Datamatrix</th>
                      <th style={{ padding: '8px 12px', fontSize: '0.85rem' }}>Seri No</th>
                      <th style={{ padding: '8px 12px', fontSize: '0.85rem' }}>Okunma Tarihi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartonItems.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ padding: '8px 12px', fontSize: '0.85rem', fontFamily: 'monospace' }}>{item.rawCode}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.85rem' }}>{item.serialNo || '-'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.85rem', color: '#64748b' }}>
                          {item.scannedAt ? new Date(item.scannedAt).toLocaleString('tr-TR') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedCartonForItems(null)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* --- PRINT PDF MODAL --- */}
      {showPrintModal && (
        <div data-testid="print-pdf-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={e => e.stopPropagation()}>
          <div role="dialog" aria-modal="true" aria-labelledby="print-pdf-title" className="card" style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 id="print-pdf-title" style={{ fontSize: '1.25rem', margin: 0 }}>DataMatrix Barkod Sayfası PDF Oluştur</h3>
              <button
                type="button"
                aria-label="PDF penceresini kapat"
                data-testid="print-pdf-close"
                disabled={printingPdf}
                onClick={() => { setShowPrintModal(false); setError(null); }}
                style={{ width: 36, height: 36, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%', border: 'none', backgroundColor: '#f1f5f9', color: '#475569', cursor: printingPdf ? 'not-allowed' : 'pointer' }}
              >
                <X size={19} />
              </button>
            </div>
            {error && <div style={{ color: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '0.85rem' }}>{error}</div>}
            <form onSubmit={(e) => { e.preventDefault(); handlePrintCodes(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '8px' }}>PDF Kod Kapsamı</label>
                <div role="radiogroup" aria-label="PDF kod kapsamı" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={printCodeScope === 'all'}
                    data-testid="print-scope-all"
                    onClick={() => setPrintCodeScope('all')}
                    style={{ padding: '13px', borderRadius: '10px', border: printCodeScope === 'all' ? '2px solid #2563eb' : '1px solid #cbd5e1', backgroundColor: printCodeScope === 'all' ? '#eff6ff' : '#fff', color: '#0f172a', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 800 }}><Barcode size={17} color={printCodeScope === 'all' ? '#2563eb' : '#64748b'} /> Tüm QR Kodları</span>
                    <small style={{ display: 'block', marginTop: '5px', color: '#64748b', lineHeight: 1.35 }}>Siparişe yüklenen bütün kodları üretir.</small>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={printCodeScope === 'unassigned'}
                    data-testid="print-scope-unassigned"
                    onClick={() => setPrintCodeScope('unassigned')}
                    style={{ padding: '13px', borderRadius: '10px', border: printCodeScope === 'unassigned' ? '2px solid #d97706' : '1px solid #cbd5e1', backgroundColor: printCodeScope === 'unassigned' ? '#fffbeb' : '#fff', color: '#0f172a', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 800 }}><Archive size={17} color={printCodeScope === 'unassigned' ? '#d97706' : '#64748b'} /> Sadece Açıkta Kalanlar</span>
                    <small style={{ display: 'block', marginTop: '5px', color: '#64748b', lineHeight: 1.35 }}>Hiç okutulmamış ve hiçbir koliye girmemiş kodlar.</small>
                  </button>
                </div>
              </div>
              {printCodeScope === 'unassigned' && (
                <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: '0.82rem', lineHeight: 1.45 }}>
                  PDF yalnızca okutma zamanı olmayan ve herhangi bir koliye bağlanmamış açıkta kalan QR kodlarından oluşturulacak.
                </div>
              )}
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
                    <input type="text" className="form-input" placeholder="İş Emri No" value={printLine2} onChange={e => setPrintLine2(e.target.value)} />
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
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowPrintModal(false); setError(null); }} disabled={printingPdf}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={printingPdf}>
                  {printingPdf ? 'PDF Üretiliyor...' : printCodeScope === 'unassigned' ? 'Açıkta Kalanları Üret & İndir' : 'Yazdır & İndir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- IMPORT MODAL --- */}
      {showImportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={(e) => { e.stopPropagation(); setShowImportModal(false); setImportResult(null); setFile(null); }}>
          <div className="card" style={{ width: '100%', maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Barkod Yükleme ({selectedOrder.orderNo})</h3>
            {error && <div style={{ color: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '0.85rem' }}>{error}</div>}
            <form onSubmit={handleImportSubmit}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Sipariş İş Emri No ({selectedOrder.gtin}) ile uyumlu Rusya Kozmetik GS1 DataMatrix kodlarını içeren <strong>.txt</strong>, <strong>.csv</strong> veya <strong>.xlsx</strong> dosyasını yükleyin.
              </p>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <input type="file" accept=".txt,.csv,.xlsx" className="form-input" required onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              {importResult && (
                <div style={{ backgroundColor: '#f1f5f9', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.85rem' }}>
                  <h4 style={{ fontWeight: 700, marginBottom: '8px' }}>Yükleme Sonucu:</h4>
                  <div>Toplam Satır: <strong style={{ float: 'right' }}>{importResult.totalRows}</strong></div>
                  <div style={{ color: 'var(--success-text)' }}>İçe Aktarılan: <strong style={{ float: 'right' }}>{importResult.importedCount}</strong></div>
                  <div style={{ color: 'var(--warning-text)' }}>Mükerrer: <strong style={{ float: 'right' }}>{importResult.duplicateCount}</strong></div>
                  <div style={{ color: 'var(--danger-text)' }}>Hatalı/Geçersiz: <strong style={{ float: 'right' }}>{importResult.invalidCount}</strong></div>
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
