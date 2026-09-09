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
  const [cartonsTotal, setCartonsTotal] = useState(0);
  const [deletingEmptyCartons, setDeletingEmptyCartons] = useState(false);
  const [deletingCartonId, setDeletingCartonId] = useState<string | null>(null);

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
      .then((res: any) => {
        setCartons(res.items || []);
        setCartonsTotal(res.totalCount ?? (res.items ? res.items.length : 0));
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

  const handleDeleteEmptyCartons = async () => {
    const countText = cartonsTotal > 0 ? `${cartonsTotal} koli içerisindeki tüm içi boş koliler` : 'Tüm içi boş koliler';
    if (!confirm(`Bu siparişe ait ${countText} kalıcı olarak silinecektir.\n\nBu işlem geri alınamaz. Devam etmek istiyor musunuz?`)) return;
    setDeletingEmptyCartons(true);
    try {
      const res = await api.delete(`/api/orders/${selectedOrder.id}/empty-cartons`);
      alert(res?.message || `${res?.deletedCount || 0} adet boş koli başarıyla silindi.`);
      fetchOrderCartons(selectedOrder.id);
      onOrderUpdated();
    } catch (err: any) {
      alert(err.message || 'Boş koliler silinemedi.');
    } finally {
      setDeletingEmptyCartons(false);
    }
  };

  const handleDeleteSingleCarton = async (carton: any) => {
    if (!confirm(`${carton.cartonNo} numaralı boş koli silinsin mi?`)) return;
    setDeletingCartonId(carton.id);
    try {
      await api.delete(`/api/cartons/${carton.id}`);
      fetchOrderCartons(selectedOrder.id);
      onOrderUpdated();
    } catch (err: any) {
      alert(err.message || 'Koli silinemedi.');
    } finally {
      setDeletingCartonId(null);
    }
  };

  const handleDeleteOrder = async () => {
    if (!confirm(`${selectedOrder.orderNo} (${selectedOrder.stockCode}) sipariş satırı sistemden tamamen silinsin mi?`)) return;
    try {
      await api.delete(`/api/orders/${selectedOrder.id}`);
      onClose();
      onOrderUpdated();
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('koli bulunmaktadır') || msg.includes('QR/Barkod bulunmaktadır')) {
        if (confirm(`${msg}\n\nBu siparişin tüm boş kolilerini ve kullanılmamış kodlarını otomatik temizleyip siparişi ZORLA SİLMEK ister misiniz?`)) {
          try {
            await api.delete(`/api/orders/${selectedOrder.id}?force=true`);
            alert('Sipariş ve bağlı boş koli / kodlar başarıyla silindi.');
            onClose();
            onOrderUpdated();
          } catch (forceErr: any) {
            alert(forceErr.message || 'Zorla silme işlemi başarısız.');
          }
        }
      } else {
        alert(msg || 'Sipariş silinemedi.');
      }
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
      case 'Draft': return <span className="tt-badge tt-badge-neutral">Taslak</span>;
      case 'Active': return <span className="tt-badge tt-badge-primary">Aktif</span>;
      case 'Completed': return <span className="tt-badge tt-badge-success">Tamamlandı</span>;
      case 'Cancelled': return <span className="tt-badge tt-badge-danger">İptal</span>;
      default: return <span className="tt-badge tt-badge-neutral">{status}</span>;
    }
  };

  const getCartonStatusBadge = (status: string) => {
    switch (status) {
      case 'Open': return <span className="tt-badge tt-badge-primary">Açık</span>;
      case 'Closed': return <span className="tt-badge tt-badge-neutral">Kapalı</span>;
      case 'Printed': return <span className="tt-badge tt-badge-info">Yazdırıldı</span>;
      case 'Palletized': return <span className="tt-badge tt-badge-success">Paletlendi</span>;
      default: return <span className="tt-badge tt-badge-neutral">{status}</span>;
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
      inset: 0,
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
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }} onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="order-line-modal-header" style={{ 
          padding: '18px 24px', 
          borderBottom: '1px solid var(--border-color)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          backgroundColor: 'var(--bg-card)' 
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Sipariş Satırı Detayı: <span className="tabular-nums font-mono">{selectedOrder.orderNo}</span>
              </h3>
              {getStatusBadge(selectedOrder.status)}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>
              {selectedOrder.customerName} — <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{selectedOrder.productName || '-'}</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {hasPermission('orders.delete') && (
              <button 
                className="btn" 
                style={{ padding: '6px 12px', backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)', fontWeight: 600, fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: 'var(--radius-sm)' }}
                onClick={handleDeleteOrder}
                title="Bu Sipariş Satırını Sil"
              >
                <Trash2 size={14} /> Sipariş Satırını Sil
              </button>
            )}
            <button className="btn btn-secondary" style={{ padding: '6px', border: 'none', background: 'transparent', cursor: 'pointer' }} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="order-line-modal-tabs" style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border-color)', 
          padding: '0 24px', 
          backgroundColor: 'var(--bg-card)', 
          gap: '8px',
          overflowX: 'auto'
        }}>
          <button
            type="button"
            style={{ 
              padding: '12px 16px', 
              border: 'none', 
              background: 'transparent', 
              fontWeight: activeTab === 'summary' ? 600 : 500, 
              fontSize: '0.875rem', 
              cursor: 'pointer', 
              borderBottom: activeTab === 'summary' ? '2px solid var(--primary)' : '2px solid transparent', 
              color: activeTab === 'summary' ? 'var(--primary)' : 'var(--text-muted)', 
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease' 
            }}
            onClick={() => setActiveTab('summary')}
          >
            <FileText size={16} />
            <span>Özet</span>
          </button>
          <button
            type="button"
            style={{ 
              padding: '12px 16px', 
              border: 'none', 
              background: 'transparent', 
              fontWeight: activeTab === 'cartons' ? 600 : 500, 
              fontSize: '0.875rem', 
              cursor: 'pointer', 
              borderBottom: activeTab === 'cartons' ? '2px solid var(--primary)' : '2px solid transparent', 
              color: activeTab === 'cartons' ? 'var(--primary)' : 'var(--text-muted)', 
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease' 
            }}
            onClick={() => setActiveTab('cartons')}
          >
            <Barcode size={16} />
            <span>Koliler ({cartonsTotal || cartons.length})</span>
          </button>
          <button
            type="button"
            style={{ 
              padding: '12px 16px', 
              border: 'none', 
              background: 'transparent', 
              fontWeight: activeTab === 'pallets' ? 600 : 500, 
              fontSize: '0.875rem', 
              cursor: 'pointer', 
              borderBottom: activeTab === 'pallets' ? '2px solid var(--primary)' : '2px solid transparent', 
              color: activeTab === 'pallets' ? 'var(--primary)' : 'var(--text-muted)', 
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease' 
            }}
            onClick={() => setActiveTab('pallets')}
          >
            <Layers size={16} />
            <span>Paletler ({palletsTotal})</span>
          </button>
          <button 
            type="button"
            style={{ 
              padding: '12px 16px', 
              border: 'none', 
              background: 'transparent', 
              fontWeight: activeTab === 'codes' ? 600 : 500, 
              fontSize: '0.875rem', 
              cursor: 'pointer', 
              borderBottom: activeTab === 'codes' ? '2px solid var(--primary)' : '2px solid transparent', 
              color: activeTab === 'codes' ? 'var(--primary)' : 'var(--text-muted)', 
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease' 
            }}
            onClick={() => setActiveTab('codes')}
          >
            <Barcode size={16} />
            <span>Kodlar ({codesTotal})</span>
          </button>
          <button 
            type="button"
            style={{ 
              padding: '12px 16px', 
              border: 'none', 
              background: 'transparent', 
              fontWeight: activeTab === 'imports' ? 600 : 500, 
              fontSize: '0.875rem', 
              cursor: 'pointer', 
              borderBottom: activeTab === 'imports' ? '2px solid var(--primary)' : '2px solid transparent', 
              color: activeTab === 'imports' ? 'var(--primary)' : 'var(--text-muted)', 
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease' 
            }}
            onClick={() => setActiveTab('imports')}
          >
            <Archive size={16} />
            <span>Yüklemeler ({importBatches.length})</span>
          </button>
        </div>

        {/* Modal Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: 'var(--bg-primary)' }}>
          
          {activeTab === 'summary' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', backgroundColor: 'var(--bg-card)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sipariş No</div>
                    <div className="font-mono tabular-nums" style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>{selectedOrder.orderNo}</div>
                  </div>
                  <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', backgroundColor: 'var(--bg-card)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Müşteri</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>{selectedOrder.customerName}</div>
                  </div>
                  <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', backgroundColor: 'var(--bg-card)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>İş Emri No</div>
                    <div className="font-mono tabular-nums" style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>{selectedOrder.gtin || '-'}</div>
                  </div>
                  <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', backgroundColor: 'var(--bg-card)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stok Kodu</div>
                    <div className="font-mono tabular-nums" style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>{selectedOrder.stockCode || '-'}</div>
                  </div>
                  <div className="card" style={{ gridColumn: 'span 2', padding: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', backgroundColor: 'var(--bg-card)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stok İsmi / Ürün Adı</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem', wordBreak: 'break-word' }}>{selectedOrder.productName || '-'}</div>
                  </div>
                </div>

                <div className="card" style={{ padding: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', backgroundColor: 'var(--bg-card)' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Üretim Hedefleri</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Beklenen Adet</div>
                      <div className="tabular-nums font-mono" style={{ fontWeight: 800, fontSize: '1.35rem', color: 'var(--text-main)' }}>
                        {selectedOrder.expectedQuantity?.toLocaleString('tr-TR')}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Okutulan Adet</div>
                      <div className="tabular-nums font-mono" style={{ fontWeight: 800, fontSize: '1.35rem', color: 'var(--primary)' }}>
                        {selectedOrder.scannedCount?.toLocaleString('tr-TR')}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Kalan Adet</div>
                      <div className="tabular-nums font-mono" style={{ 
                        fontWeight: 700, 
                        fontSize: '1.15rem', 
                        color: selectedOrder.expectedQuantity <= selectedOrder.scannedCount ? 'var(--success)' : 'var(--text-main)' 
                      }}>
                        {Math.max(0, selectedOrder.expectedQuantity - selectedOrder.scannedCount).toLocaleString('tr-TR')}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Tamamlanma Yüzdesi</div>
                      <div className="tabular-nums font-mono" style={{ 
                        fontWeight: 700, 
                        fontSize: '1.15rem', 
                        color: selectedOrder.expectedQuantity > 0 && selectedOrder.scannedCount >= selectedOrder.expectedQuantity ? 'var(--success)' : 'var(--primary)' 
                      }}>
                        {selectedOrder.expectedQuantity > 0 ? Math.round((selectedOrder.scannedCount / selectedOrder.expectedQuantity) * 100) : 0}%
                      </div>
                    </div>
                    <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Koli İçi Adet</div>
                      <div className="tabular-nums font-mono" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{selectedOrder.productPerCarton}</div>
                    </div>
                    <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Palet İçi Koli</div>
                      <div className="tabular-nums font-mono" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{selectedOrder.cartonPerPallet}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="card" style={{ padding: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', backgroundColor: 'var(--bg-card)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Günlük Üretim Raporu</h4>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {productionByDate.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '40px' }}>Henüz üretim kaydı bulunmuyor.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {productionByDate.map((p, idx) => (
                          <div key={idx} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '12px 16px', 
                            backgroundColor: 'var(--bg-surface-subtle)', 
                            borderRadius: 'var(--radius-sm)', 
                            borderLeft: '3px solid var(--primary)',
                            border: '1px solid var(--border-subtle)',
                            borderLeftWidth: '3px'
                          }}>
                            <span className="tabular-nums font-mono" style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>{p.date}</span>
                            <span className="tabular-nums font-mono" style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.92rem' }}>{p.count.toLocaleString('tr-TR')} adet okutuldu</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', backgroundColor: 'var(--bg-card)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Açıklama</div>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-main)', backgroundColor: 'var(--bg-surface-subtle)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    {selectedOrder.description || 'Açıklama bulunmuyor.'}
                  </p>
                </div>

                <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', backgroundColor: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: '4px' }}>Oluşturma Tarihi</div>
                    <div className="tabular-nums font-mono" style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>{new Date(selectedOrder.createdAt).toLocaleString('tr-TR')}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cartons' && (
            <div className="card" style={{ padding: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', minHeight: '500px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Toplam Koli: <span style={{ color: 'var(--primary)' }}>{cartonsTotal || cartons.length}</span>
                  </span>
                  {cartonsTotal > cartons.length && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface-subtle)', padding: '3px 8px', borderRadius: '6px' }}>
                      (İlk {cartons.length} adedi listeleniyor)
                    </span>
                  )}
                </div>
                {(hasPermission('cartons.delete') || hasPermission('orders.delete') || hasPermission('cartons.create')) && (
                  <button 
                    className="btn" 
                    style={{ padding: '8px 16px', backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: deletingEmptyCartons ? 'not-allowed' : 'pointer' }}
                    onClick={handleDeleteEmptyCartons}
                    disabled={deletingEmptyCartons || (cartonsTotal === 0 && cartons.length === 0)}
                    title="İçinde hiçbir ürün bulunmayan tüm kolileri toplu olarak siler"
                  >
                    {deletingEmptyCartons ? <><Loader2 className="spinner" size={16} /> Koliler Siliniyor...</> : <><Trash2 size={16} /> İçi Boş Kolileri Toplu Sil</>}
                  </button>
                )}
              </div>

              {cartonsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="spinner" size={40} /></div>
              ) : cartons.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '100px', fontSize: '1.1rem' }}>Bu siparişe ait henüz koli bulunmuyor.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                  {cartons.map((c: any) => (
                    <div key={c.id} style={{ 
                      backgroundColor: 'var(--bg-card)', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border-color)',
                      padding: '16px',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '180px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>{c.cartonNo}</span>
                          {getCartonStatusBadge(c.status)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '12px', wordBreak: 'break-all' }}>
                          SSCC: {c.sscc}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Doluluk</span>
                          <span className="tabular-nums font-mono" style={{ color: 'var(--text-main)' }}>{c.actualQuantity} / {c.targetQuantity}</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${Math.min(100, Math.round((c.actualQuantity / c.targetQuantity) * 100))}%`, 
                            backgroundColor: c.status === 'Closed' || c.status === 'Printed' || c.status === 'Palletized' ? 'var(--success)' : 'var(--primary)',
                            transition: 'width 0.3s'
                          }}></div>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                          Tarih: {new Date(c.createdAt).toLocaleString('tr-TR')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                        <button className="btn btn-secondary" style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontWeight: 600 }} onClick={() => loadCartonItems(c)}>
                          <Eye size={14} /> İçerik
                        </button>
                        <button className="btn btn-secondary" style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontWeight: 600 }} onClick={() => downloadCartonPdf(c.id, c.cartonNo)}>
                          <Printer size={14} /> PDF
                        </button>
                        {c.actualQuantity === 0 && (hasPermission('cartons.delete') || hasPermission('orders.delete') || hasPermission('cartons.create')) && (
                          <button 
                            className="btn" 
                            style={{ padding: '6px 10px', fontSize: '0.8rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontWeight: 600 }}
                            onClick={() => handleDeleteSingleCarton(c)}
                            disabled={deletingCartonId === c.id}
                            title="Bu boş koliyi sil"
                          >
                            {deletingCartonId === c.id ? <Loader2 className="spinner" size={14} /> : <Trash2 size={14} />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pallets' && (
            <div className="card" style={{ padding: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', minHeight: '500px' }}>
              {palletsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="spinner" size={40} /></div>
              ) : pallets.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '100px', fontSize: '1.1rem' }}>Bu siparişe ait henüz palet bulunmuyor.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                  {pallets.map((p: any) => (
                    <div key={p.id} style={{ 
                      backgroundColor: 'var(--bg-card)', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border-color)',
                      padding: '16px',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '160px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>{p.palletNo}</span>
                          <span className={p.status === 'Closed' ? 'badge badge-green' : p.status === 'Printed' ? 'badge badge-cyan' : 'badge badge-orange'}>{p.status}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '12px', wordBreak: 'break-all' }}>
                          SSCC: {p.sscc}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '12px', fontWeight: 600 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Koli Sayısı</span>
                          <span className="tabular-nums font-mono" style={{ color: 'var(--text-main)' }}>{p.cartonCount} Koli</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
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
            <div className="card" style={{ padding: '20px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)', minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
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

              <div style={{ flex: 1, overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <table className="data-table" style={{ margin: 0, minWidth: '800px' }}>
                  <thead style={{ backgroundColor: 'var(--table-header-bg)' }}>
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
                          <td style={{ padding: '12px', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{c.rawCode}</td>
                          <td style={{ padding: '12px', fontSize: '0.85rem' }}>{c.serialNo || '-'}</td>
                          <td style={{ padding: '12px' }}>
                            <span className="badge badge-gray" style={{ fontSize: '0.75rem' }}>{getProductCodeStatusLabel(c.status)}</span>
                          </td>
                          <td style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {c.scannedAt ? new Date(c.scannedAt).toLocaleString('tr-TR') : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Toplam: {codesTotal} kod</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px' }} disabled={codesPage === 1} onClick={() => setCodesPage(p => p - 1)}><ChevronLeft size={16} /></button>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{codesPage}</span>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px' }} disabled={codesPage * 50 >= codesTotal} onClick={() => setCodesPage(p => p + 1)}><ChevronRight size={16} /></button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'imports' && (
            <div className="card" style={{ padding: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', minHeight: '420px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Kod Yükleme Kayıtları</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Bu sipariş satırına yüklenen dosyaları ve bağlı kodları yönetin.</p>
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

              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <table className="data-table" style={{ margin: 0, minWidth: '980px' }}>
                  <thead style={{ backgroundColor: 'var(--table-header-bg)' }}>
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
                      <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Bu siparişe ait yükleme kaydı bulunamadı.</td></tr>
                    ) : (
                      importBatches.map((batch) => (
                        <tr key={batch.id}>
                          <td style={{ padding: '12px', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{new Date(batch.createdAt).toLocaleString('tr-TR')}</td>
                          <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-main)', maxWidth: '220px', wordBreak: 'break-word' }}>{batch.fileName || '-'}</td>
                          <td style={{ padding: '12px' }}>{batch.totalRows.toLocaleString()}</td>
                          <td style={{ padding: '12px', color: 'var(--success)', fontWeight: 700 }}>{batch.importedCount.toLocaleString()}</td>
                          <td style={{ padding: '12px', color: 'var(--warning-text)' }}>{batch.duplicateCount.toLocaleString()}</td>
                          <td style={{ padding: '12px', color: batch.invalidCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{batch.invalidCount.toLocaleString()}</td>
                          <td style={{ padding: '12px' }}>{batch.linkedCodeCount.toLocaleString()}</td>
                          <td style={{ padding: '12px' }}>
                            <span className={batch.usedCodeCount > 0 ? 'badge badge-red' : 'badge badge-green'}>
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
          <div className="order-line-modal-footer" style={{ 
            padding: '14px 24px', 
            backgroundColor: 'var(--bg-card)', 
            borderTop: '1px solid var(--border-color)', 
            display: 'flex', 
            justifyContent: 'flex-end', 
            alignItems: 'center',
            gap: '10px', 
            flexWrap: 'wrap' 
          }}>
            {selectedOrder.status === 'Draft' && (
              <>
                {hasPermission('orders.edit') && (
                  <>
                    <button className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.85rem' }} onClick={() => setShowImportModal(true)}>
                      <Upload size={15} /> Kod Yükle
                    </button>
                    <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.85rem' }} onClick={() => handleStatusChange(selectedOrder.id, 'activate')}>
                      <Play size={15} /> Aktifleştir
                    </button>
                  </>
                )}
              </>
            )}

            {selectedOrder.status === 'Active' && (
              <>
                {hasPermission('orders.edit') && (
                  <button className="btn" style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    height: '36px',
                    padding: '0 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--danger-bg)', 
                    color: 'var(--danger-text)', 
                    border: '1px solid var(--danger-border)', 
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }} onClick={() => handleStatusChange(selectedOrder.id, 'cancel')}>
                    <XCircle size={15} /> İptal Et
                  </button>
                )}
                {user?.role !== 'Viewer' && (
                  <>
                    <button className="btn btn-secondary" style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      height: '36px',
                      padding: '0 14px',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 600,
                      fontSize: '0.85rem'
                    }} onClick={() => { setError(null); setShowPrintModal(true); }}>
                      <Printer size={15} /> Kod Sayfası PDF Üret
                    </button>
                    <button className="btn btn-secondary" style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      height: '36px',
                      padding: '0 14px',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--primary)',
                      borderColor: 'var(--primary-light)',
                      fontWeight: 600,
                      fontSize: '0.85rem'
                    }} onClick={() => window.location.href = `/scan?orderId=${selectedOrder.id}`}>
                      <Barcode size={15} /> Scan Ekranına Git
                    </button>
                  </>
                )}
                {hasPermission('orders.edit') && (
                  <button className="btn btn-primary" style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    height: '36px',
                    padding: '0 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }} onClick={() => handleStatusChange(selectedOrder.id, 'complete')}>
                    <CheckCircle2 size={15} /> Tamamla
                  </button>
                )}
              </>
            )}

            {selectedOrder.status === 'Cancelled' && (
              <>
                {hasPermission('orders.edit') && (
                  <>
                    <button className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.85rem' }} onClick={() => setActiveTab('imports')}>
                      <Archive size={15} /> Yüklemeleri Yönet
                    </button>
                    <button className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.85rem' }} onClick={() => setShowImportModal(true)}>
                      <Upload size={15} /> Kod Yükle
                    </button>
                    <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.85rem' }} onClick={() => handleStatusChange(selectedOrder.id, 'activate')}>
                      <RotateCcw size={15} /> Tekrar Aktifleştir
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
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
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
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-xl)',
            padding: 0,
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', padding: '16px 20px', backgroundColor: 'var(--bg-surface-subtle)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Koli İçeriği: <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{selectedCartonForItems.cartonNo}</span>
              </h3>
              <button className="btn btn-secondary" style={{ padding: '4px', border: 'none', background: 'transparent' }} onClick={() => setSelectedCartonForItems(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {cartonItemsLoading ? (
                <div style={{ textAlign: 'center', padding: '30px' }}><Loader2 className="spinner" size={24} style={{ margin: '0 auto' }} /></div>
              ) : cartonItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Bu kolide henüz okutulmuş ürün bulunmuyor.</div>
              ) : (
                <div className="table-container">
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px 12px', fontSize: '0.75rem' }}>Barkod / Datamatrix</th>
                        <th style={{ padding: '8px 12px', fontSize: '0.75rem' }}>Seri No</th>
                        <th style={{ padding: '8px 12px', fontSize: '0.75rem' }}>Okunma Tarihi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cartonItems.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="tabular-nums" style={{ padding: '8px 12px', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>{item.rawCode}</td>
                          <td style={{ padding: '8px 12px', fontSize: '0.8125rem' }}>{item.serialNo || '-'}</td>
                          <td className="tabular-nums" style={{ padding: '8px 12px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            {item.scannedAt ? new Date(item.scannedAt).toLocaleString('tr-TR') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', padding: '12px 20px', backgroundColor: 'var(--bg-surface-subtle)' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedCartonForItems(null)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* --- PRINT PDF MODAL --- */}
      {showPrintModal && (
        <div data-testid="print-pdf-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={e => e.stopPropagation()}>
          <div role="dialog" aria-modal="true" aria-labelledby="print-pdf-title" className="card" style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: 'var(--shadow-xl)', backgroundColor: 'var(--bg-card)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 id="print-pdf-title" style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>DataMatrix Barkod Sayfası PDF Oluştur</h3>
              <button
                type="button"
                aria-label="PDF penceresini kapat"
                data-testid="print-pdf-close"
                disabled={printingPdf}
                onClick={() => { setShowPrintModal(false); setError(null); }}
                className="btn btn-secondary"
                style={{ width: 32, height: 32, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-xs)', border: 'none', background: 'transparent', cursor: printingPdf ? 'not-allowed' : 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            {error && <div style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.8125rem' }}>{error}</div>}
            <form onSubmit={(e) => { e.preventDefault(); handlePrintCodes(); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '6px' }}>PDF Kod Kapsamı</label>
                <div role="radiogroup" aria-label="PDF kod kapsamı" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={printCodeScope === 'all'}
                    data-testid="print-scope-all"
                    onClick={() => setPrintCodeScope('all')}
                    style={{ padding: '12px', borderRadius: 'var(--radius-sm)', border: printCodeScope === 'all' ? '2px solid var(--primary)' : '1px solid var(--border-color)', backgroundColor: printCodeScope === 'all' ? 'var(--primary-light)' : 'var(--bg-card)', color: 'var(--text-main)', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.875rem' }}><Barcode size={15} color={printCodeScope === 'all' ? 'var(--primary)' : 'var(--text-muted)'} /> Tüm QR Kodları</span>
                    <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)', lineHeight: 1.3, fontSize: '0.75rem' }}>Siparişe yüklenen bütün kodları üretir.</small>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={printCodeScope === 'unassigned'}
                    data-testid="print-scope-unassigned"
                    onClick={() => setPrintCodeScope('unassigned')}
                    style={{ padding: '12px', borderRadius: 'var(--radius-sm)', border: printCodeScope === 'unassigned' ? '2px solid var(--warning)' : '1px solid var(--border-color)', backgroundColor: printCodeScope === 'unassigned' ? 'var(--warning-bg)' : 'var(--bg-card)', color: 'var(--text-main)', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.875rem' }}><Archive size={15} color={printCodeScope === 'unassigned' ? 'var(--warning)' : 'var(--text-muted)'} /> Sadece Açıkta Kalanlar</span>
                    <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)', lineHeight: 1.3, fontSize: '0.75rem' }}>Hiç okutulmamış ve koliye girmemiş kodlar.</small>
                  </button>
                </div>
              </div>
              {printCodeScope === 'unassigned' && (
                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning)', fontSize: '0.8125rem', lineHeight: 1.45 }}>
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
                <label htmlFor="addText" style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>Barkod Yanına Yazı Ekle</label>
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
                    <select className="form-select" value={printLabelBelow ? 'below' : 'above'} onChange={e => setPrintLabelBelow(e.target.value === 'below')}>
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={(e) => { e.stopPropagation(); setShowImportModal(false); setImportResult(null); setFile(null); }}>
          <div className="card" style={{ width: '100%', maxWidth: '550px', padding: '24px', boxShadow: 'var(--shadow-xl)', backgroundColor: 'var(--bg-card)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
                Barkod Yükleme ({selectedOrder.orderNo})
              </h3>
              <button className="btn btn-secondary" style={{ padding: '4px', border: 'none', background: 'transparent' }} onClick={() => { setShowImportModal(false); setImportResult(null); setFile(null); }}>
                <X size={18} />
              </button>
            </div>
            {error && <div style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.8125rem' }}>{error}</div>}
            <form onSubmit={handleImportSubmit}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                Sipariş İş Emri No ({selectedOrder.gtin}) ile uyumlu Rusya Kozmetik GS1 DataMatrix kodlarını içeren <strong>.txt</strong>, <strong>.csv</strong> veya <strong>.xlsx</strong> dosyasını yükleyin.
              </p>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <input type="file" accept=".txt,.csv,.xlsx" className="form-input" required onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              {importResult && (
                <div style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-color)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.8125rem' }}>
                  <h4 style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>Yükleme Sonucu:</h4>
                  <div className="tabular-nums" style={{ color: 'var(--text-main)' }}>Toplam Satır: <strong style={{ float: 'right' }}>{importResult.totalRows}</strong></div>
                  <div className="tabular-nums" style={{ color: 'var(--success)' }}>İçe Aktarılan: <strong style={{ float: 'right' }}>{importResult.importedCount}</strong></div>
                  <div className="tabular-nums" style={{ color: 'var(--warning)' }}>Mükerrer: <strong style={{ float: 'right' }}>{importResult.duplicateCount}</strong></div>
                  <div className="tabular-nums" style={{ color: 'var(--danger)' }}>Hatalı/Geçersiz: <strong style={{ float: 'right' }}>{importResult.invalidCount}</strong></div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
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
