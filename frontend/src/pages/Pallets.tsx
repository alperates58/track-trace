import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Printer, Eye, Search, Barcode, Trash2, X, Check, Loader2, ArrowRight, Clock, Package } from 'lucide-react';

interface Pallet {
  id: string;
  orderId: string;
  orderNo: string;
  palletNo: string;
  sscc: string;
  status: string;
  createdAt: string;
  closedAt: string | null;
  printedAt: string | null;
  cartonCount: number;
}

interface ActiveOrder {
  id: string;
  orderNo: string;
  customerName: string;
  stockCode?: string;
  productName?: string;
  gtin: string;
  productPerCarton: number;
  cartonPerPallet: number;
  expectedQuantity: number;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  scannedCount: number;
}

export const Pallets: React.FC = () => {
  const { user } = useAuth();
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Active Orders Drawer states
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<ActiveOrder | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderCartons, setOrderCartons] = useState<Record<string, any[]>>({});
  const [orderCartonsLoading, setOrderCartonsLoading] = useState<Record<string, boolean>>({});
  const [palletCreationLoading, setPalletCreationLoading] = useState(false);
  const [newlyCreatedPallet, setNewlyCreatedPallet] = useState<Pallet | null>(null);

  const drawerRef = useRef<HTMLDivElement>(null);

  // Selected Pallet detail & carton addition
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
  const [cartonSSCCInput, setCartonSSCCInput] = useState('');
  const [palletCartons, setPalletCartons] = useState<any[]>([]);
  const [cartonsLoading, setCartonsLoading] = useState(false);
  const [zplOutput, setZplOutput] = useState<string | null>(null);

  // Carton Transfer states
  const [openPallets, setOpenPallets] = useState<Pallet[]>([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [cartonToTransfer, setCartonToTransfer] = useState<any>(null);
  const [destinationPalletId, setDestinationPalletId] = useState('');

  const fetchPallets = () => {
    setLoading(true);
    const query = `?pageNumber=${page}&pageSize=10&search=${encodeURIComponent(search)}&status=${statusFilter}`;
    api.get(`/api/pallets${query}`)
      .then(res => {
        setPallets(res.items);
        setTotalCount(res.totalCount);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPallets();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPallets();
  };

  const handleOpenCreateDrawer = async () => {
    try {
      setOrdersLoading(true);
      setShowCreateDrawer(true);
      setCreateStep(1);
      setSelectedOrder(null);
      setDrawerSearch('');
      setNewlyCreatedPallet(null);
      
      const res = await api.get('/api/orders?pageNumber=1&pageSize=200&status=Active');
      const items = res.items || [];
      setActiveOrders(items);
      setOrdersLoading(false);

      // Load carton stats in background
      items.forEach(async (order: ActiveOrder) => {
        setOrderCartonsLoading(prev => ({ ...prev, [order.id]: true }));
        try {
          const cartonsRes = await api.get(`/api/cartons?orderId=${order.id}&pageSize=1000`);
          setOrderCartons(prev => ({ ...prev, [order.id]: cartonsRes.items || [] }));
        } catch (err) {
          console.error(`Failed to fetch cartons for order ${order.id}:`, err);
        } finally {
          setOrderCartonsLoading(prev => ({ ...prev, [order.id]: false }));
        }
      });
    } catch (err) {
      console.error(err);
      setOrdersLoading(false);
    }
  };

  const handleCreatePallet = async () => {
    if (!selectedOrder) return;
    try {
      setPalletCreationLoading(true);
      const newPalletId = await api.post(`/api/pallets?orderId=${selectedOrder.id}`);
      
      // Fetch details of newly created pallet for step 3 success display
      const palletDetails = await api.get(`/api/pallets/${newPalletId}`);
      setNewlyCreatedPallet(palletDetails);
      
      setCreateStep(3);
      fetchPallets();
    } catch (err: any) {
      alert(err.message || 'Palet oluşturulamadı.');
    } finally {
      setPalletCreationLoading(false);
    }
  };

  // Keyboard and Focus management for accessibility
  useEffect(() => {
    if (showCreateDrawer && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [showCreateDrawer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showCreateDrawer) return;

      if (e.key === 'Escape') {
        setShowCreateDrawer(false);
      }

      if (e.key === 'Enter') {
        const activeElem = document.activeElement;
        if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'BUTTON')) {
          // If user is typing in search, let Enter trigger selecting the first filtered order
          if (createStep === 1 && activeElem.classList.contains('drawer-search-input')) {
            const filtered = activeOrders.filter(o => {
              const q = drawerSearch.toLowerCase();
              return (
                o.orderNo.toLowerCase().includes(q) ||
                o.customerName.toLowerCase().includes(q) ||
                (o.stockCode && o.stockCode.toLowerCase().includes(q))
              );
            });
            if (filtered.length > 0) {
              e.preventDefault();
              setSelectedOrder(filtered[0]);
              setCreateStep(2);
            }
          }
          return;
        }

        if (createStep === 1 && selectedOrder) {
          e.preventDefault();
          setCreateStep(2);
        } else if (createStep === 2 && selectedOrder && !palletCreationLoading) {
          e.preventDefault();
          handleCreatePallet();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCreateDrawer, createStep, selectedOrder, palletCreationLoading, activeOrders, drawerSearch]);

  const handlePalletClick = async (pallet: Pallet) => {
    setSelectedPallet(pallet);
    setZplOutput(null);
    setCartonSSCCInput('');
    setPalletCartons([]);
    setCartonsLoading(true);

    try {
      // Fetch cartons inside this pallet
      const res = await api.get(`/api/cartons?pageNumber=1&pageSize=100&palletId=${pallet.id}`);
      setPalletCartons(res.items);
    } catch (err) {
      console.error(err);
    } finally {
      setCartonsLoading(false);
    }
  };

  const handleAddCarton = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPallet || !cartonSSCCInput.trim()) return;

    try {
      await api.post(`/api/pallets/${selectedPallet.id}/add-carton?cartonSscc=${cartonSSCCInput.trim()}`);
      setCartonSSCCInput('');
      fetchPallets();
      // Reload pallet
      const updatedPallet = await api.get(`/api/pallets/${selectedPallet.id}`);
      handlePalletClick(updatedPallet);
    } catch (err: any) {
      alert('Koli palete eklenemedi: ' + err.message);
    }
  };

  const handleClosePallet = async (palletId: string) => {
    if (!confirm('Paleti kapatmak istediğinize emin misiniz? Palet kapatıldıktan sonra yeni koli eklenemez.')) return;
    try {
      await api.post(`/api/pallets/${palletId}/close`);
      fetchPallets();
      if (selectedPallet && selectedPallet.id === palletId) {
        const updated = await api.get(`/api/pallets/${palletId}`);
        setSelectedPallet(updated);
      }
    } catch (err: any) {
      alert('İşlem başarısız: ' + err.message);
    }
  };

  const handleDeletePallet = async (palletId: string) => {
    if (!confirm('Paleti silmek (bozmak) istediğinize emin misiniz? Palet silindiğinde içindeki koliler serbest kalacaktır.')) return;
    try {
      await api.delete(`/api/pallets/${palletId}`);
      if (selectedPallet?.id === palletId) {
        setSelectedPallet(null);
      }
      fetchPallets();
    } catch (err: any) {
      alert('Palet silinemedi: ' + err.message);
    }
  };

  const handleOpenTransferModal = async (carton: any) => {
    try {
      const res = await api.get(`/api/pallets?pageSize=100&status=Open&orderId=${selectedPallet?.orderId}`);
      const filtered = res.items.filter((p: Pallet) => p.id !== selectedPallet?.id);
      setOpenPallets(filtered);
      setCartonToTransfer(carton);
      setDestinationPalletId('');
      setShowTransferModal(true);
    } catch (err: any) {
      alert("Paletler yüklenemedi: " + err.message);
    }
  };

  const handleTransferCarton = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartonToTransfer || !destinationPalletId) return;
    try {
      await api.post(`/api/pallets/${destinationPalletId}/transfer-carton?cartonId=${cartonToTransfer.id}`);
      setShowTransferModal(false);
      setCartonToTransfer(null);
      setDestinationPalletId('');
      fetchPallets();
      if (selectedPallet) {
        const updated = await api.get(`/api/pallets/${selectedPallet.id}`);
        handlePalletClick(updated);
      }
    } catch (err: any) {
      alert("Koli taşınamadı: " + err.message);
    }
  };

  const handlePrintPdf = async (palletId: string) => {
    try {
      const blob = (await api.get(`/api/pallets/${palletId}/label.pdf`)) as Blob;
      const fileURL = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileURL;
      a.download = `palet_etiketi_${palletId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(fileURL);
      fetchPallets();
    } catch (err: any) {
      alert('PDF üretilemedi: ' + err.message);
    }
  };

  const handlePrintZpl = async (palletId: string) => {
    try {
      const res = await api.post(`/api/pallets/${palletId}/print?format=ZPL`);
      setZplOutput(res.zpl);
      fetchPallets();
    } catch (err: any) {
      alert('ZPL üretilemedi: ' + err.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>Palet Yönetimi</h2>
          <p style={{ color: 'var(--text-muted)' }}>Kolileri paletlere yerleştirme, palet kapatma ve etiket yazdırma.</p>
        </div>
        {user?.role !== 'Viewer' && (
          <button className="btn btn-primary" onClick={handleOpenCreateDrawer}>
            <Plus size={18} /> Yeni Palet Aç
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
              placeholder="Palet No, SSCC veya Sipariş No Ara..."
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
            <option value="Open">Açık (Open)</option>
            <option value="Closed">Kapalı (Closed)</option>
            <option value="Printed">Yazdırıldı</option>
            <option value="Shipped">Sevk Edildi</option>
          </select>
        </div>
        <button type="submit" className="btn btn-secondary">Ara</button>
      </form>

      <div className={selectedPallet ? "pallet-split-grid" : ""} style={{ display: selectedPallet ? undefined : 'block' }}>
        
        {/* Pallets List */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Palet No</th>
                <th>Sipariş No</th>
                <th>SSCC (18 Hane)</th>
                <th>Koli Sayısı</th>
                <th>Durum</th>
                <th>Aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              {loading && pallets.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px' }}>Yükleniyor...</td></tr>
              ) : pallets.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Palet bulunamadı.</td></tr>
              ) : (
                pallets.map((p) => (
                  <tr key={p.id} style={{ cursor: 'pointer', backgroundColor: selectedPallet?.id === p.id ? '#f1f5f9' : '' }} onClick={() => handlePalletClick(p)}>
                    <td style={{ fontWeight: 600 }}>{p.palletNo}</td>
                    <td>{p.orderNo}</td>
                    <td><code style={{ fontSize: '0.85rem' }}>{p.sscc}</code></td>
                    <td><span style={{ fontWeight: 700, color: 'var(--primary)' }}>{p.cartonCount}</span></td>
                    <td>
                      <span className={`badge badge-${p.status.toLowerCase()}`}>
                        {p.status === 'Open' ? 'Açık' : p.status === 'Closed' ? 'Kapalı' : p.status === 'Printed' ? 'Yazdırıldı' : 'Sevk Edildi'}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => handlePalletClick(p)}>
                          <Eye size={14} /> Detay
                        </button>
                        <button className="btn btn-primary" style={{ padding: '6px 10px' }} onClick={() => handlePrintPdf(p.id)}>
                          <Printer size={14} /> PDF
                        </button>
                        {user?.role !== 'Viewer' && p.status !== 'Shipped' && (
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }} onClick={() => handleDeletePallet(p.id)} title="Paleti Sil">
                            <Trash2 size={14} /> Sil
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="pagination">
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Toplam: {totalCount} palet</span>
            <div className="pagination-buttons">
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Önceki</button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '0.9rem', fontWeight: 600 }}>{page}</span>
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} disabled={page * 10 >= totalCount} onClick={() => setPage(p => p + 1)}>Sonraki</button>
            </div>
          </div>
        </div>

        {/* Pallet Detail & Adding carton */}
        {selectedPallet && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem' }}>{selectedPallet.palletNo} Detayları</h3>
                <code style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>SSCC: {selectedPallet.sscc}</code>
              </div>
              <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem', marginLeft: 'auto' }} onClick={() => setSelectedPallet(null)}>Kapat</button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handlePrintPdf(selectedPallet.id)}>
                <Printer size={16} /> PDF Etiketi İndir
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handlePrintZpl(selectedPallet.id)}>
                <Barcode size={16} /> ZPL Kodu Üret
              </button>
            </div>

            {/* ZPL Code */}
            {zplOutput && (
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
            )}

            {/* Scan Carton to Pallet Form */}
            {selectedPallet.status === 'Open' && user?.role !== 'Viewer' ? (
              <form onSubmit={handleAddCarton} className="card" style={{ padding: '16px', backgroundColor: 'var(--primary-light)', border: '1px solid #bfdbfe' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px', color: 'var(--primary)' }}>Koli Ekle (SSCC Okutun)</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    required
                    style={{ flex: 1, height: '40px' }}
                    placeholder="34630477370000..."
                    value={cartonSSCCInput}
                    onChange={(e) => setCartonSSCCInput(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" style={{ height: '40px' }}>Ekle</button>
                </div>
              </form>
            ) : selectedPallet.status === 'Open' && user?.role === 'Viewer' ? null : (
              <div style={{ padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '4px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Bu palet kapatıldığı için yeni koli ekleme yapılamaz.
              </div>
            )}

            {/* Manual Close Pallet Action */}
            {selectedPallet.status === 'Open' && user?.role !== 'Viewer' && (
              <button className="btn btn-danger" style={{ width: '100%', height: '42px' }} onClick={() => handleClosePallet(selectedPallet.id)}>
                Paleti Kapat (Closed)
              </button>
            )}

            {/* Delete Pallet Action */}
            {selectedPallet.status !== 'Shipped' && user?.role !== 'Viewer' && (
              <button className="btn btn-secondary" style={{ width: '100%', height: '42px', backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={() => handleDeletePallet(selectedPallet.id)}>
                <Trash2 size={16} /> Paleti Sil (Boz)
              </button>
            )}

            {/* Cartons List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                Palet İçindeki Koliler ({selectedPallet.cartonCount})
              </h4>
              {cartonsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Koli listesi yükleniyor...</div>
              ) : palletCartons.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Bu palete henüz koli eklenmemiş.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                  {palletCartons.map((c, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: '#f8fafc',
                      padding: '10px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div>
                        <strong>{c.cartonNo}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SSCC: {c.sscc}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 600 }}>{c.actualQuantity} adet</span>
                        {user?.role !== 'Viewer' && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => handleOpenTransferModal(c)}
                          >
                            Taşı
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- CREATE PALLET DRAWER --- */}
      {showCreateDrawer && (
        <div 
          className="drawer-backdrop" 
          onClick={() => setShowCreateDrawer(false)}
        />
      )}
      <div 
        ref={drawerRef}
        className={`drawer-container ${showCreateDrawer ? 'open' : ''}`}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {showCreateDrawer && (
          <>
            {/* Header */}
            <div className="drawer-header">
              <div className="drawer-header-title-area">
                <h3 id="drawer-title">Yeni Palet</h3>
                <span className="drawer-header-subtitle">Aktif bir sipariş seçerek yeni bir palet oluşturun.</span>
              </div>
              <button 
                type="button" 
                className="drawer-close-btn" 
                onClick={() => setShowCreateDrawer(false)}
                aria-label="Kapat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="drawer-steps">
              <div className={`drawer-step-item ${createStep === 1 ? 'active' : createStep > 1 ? 'completed' : ''}`}>
                <div className="drawer-step-number">{createStep > 1 ? <Check size={12} strokeWidth={3} /> : '1'}</div>
                <span>Sipariş Seç</span>
              </div>
              <div className={`drawer-step-divider ${createStep > 1 ? (createStep > 2 ? 'completed' : 'active') : ''}`} />
              <div className={`drawer-step-item ${createStep === 2 ? 'active' : createStep > 2 ? 'completed' : ''}`}>
                <div className="drawer-step-number">{createStep > 2 ? <Check size={12} strokeWidth={3} /> : '2'}</div>
                <span>Onay</span>
              </div>
              <div className={`drawer-step-divider ${createStep > 2 ? 'completed' : ''}`} />
              <div className={`drawer-step-item ${createStep === 3 ? 'completed' : ''}`}>
                <div className="drawer-step-number">3</div>
                <span>Tamamlandı</span>
              </div>
            </div>

            {/* Body */}
            <div className="drawer-body">
              {createStep === 1 && (
                <>
                  <div className="drawer-search-wrapper">
                    <Search size={18} className="drawer-search-icon" />
                    <input
                      type="text"
                      className="drawer-search-input"
                      placeholder="Sipariş No, Müşteri veya Stok Kodu Ara..."
                      value={drawerSearch}
                      onChange={(e) => setDrawerSearch(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="drawer-order-list">
                    {ordersLoading ? (
                      [1, 2, 3].map(n => (
                        <div className="order-select-card" key={n} style={{ cursor: 'default' }}>
                          <div className="order-select-card-header">
                            <div style={{ flex: 1 }}>
                              <div className="shimmer skeleton-text-lg" style={{ marginBottom: '8px' }}></div>
                              <div className="shimmer skeleton-text-md"></div>
                            </div>
                          </div>
                          <div className="order-select-card-metrics-grid">
                            {[1, 2, 3].map(m => (
                              <div className="order-select-card-metric" key={m}>
                                <div className="shimmer skeleton-text-sm" style={{ marginBottom: '4px' }}></div>
                                <div className="shimmer skeleton-text-md"></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      (() => {
                        const filtered = activeOrders.filter(o => {
                          const q = drawerSearch.toLowerCase();
                          return (
                            o.orderNo.toLowerCase().includes(q) ||
                            o.customerName.toLowerCase().includes(q) ||
                            (o.stockCode && o.stockCode.toLowerCase().includes(q))
                          );
                        });

                        if (filtered.length === 0) {
                          return (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                              Aktif sipariş bulunamadı.
                            </div>
                          );
                        }

                        return filtered.map(order => {
                          const isSelected = selectedOrder?.id === order.id;
                          const cartons = orderCartons[order.id] || [];
                          const isCartonsLoading = orderCartonsLoading[order.id];

                          const totalCartons = cartons.length;
                          const openCount = cartons.filter(c => c.status === 'Open').length;
                          const completedCount = cartons.filter(c => c.status === 'Closed' || c.status === 'Printed' || c.status === 'Palletized').length;

                          const lastActivityDate = order.updatedAt ? new Date(order.updatedAt) : new Date(order.createdAt);
                          const lastActivityFormatted = lastActivityDate.toLocaleDateString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          });

                          return (
                            <div
                              key={order.id}
                              tabIndex={0}
                              className={`order-select-card ${isSelected ? 'selected' : ''}`}
                              onClick={() => setSelectedOrder(order)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  setSelectedOrder(order);
                                  setCreateStep(2);
                                }
                              }}
                            >
                              <div className="order-select-card-header">
                                <div style={{ flex: 1 }}>
                                  <div className="order-select-card-no">
                                    {order.orderNo}
                                    <span className="badge badge-active" style={{ fontSize: '0.7rem', padding: '2px 6px', margin: 0, backgroundColor: '#eff6ff', color: '#2563eb' }}>Aktif</span>
                                  </div>
                                  <div className="order-select-card-customer">{order.customerName}</div>
                                </div>
                                <div className="order-select-card-check">
                                  <Check size={12} strokeWidth={3} />
                                </div>
                              </div>
                              
                              <div className="order-select-card-metrics-grid">
                                <div className="order-select-card-metric">
                                  <span className="order-select-card-metric-label">Toplam Koli</span>
                                  <span className="order-select-card-metric-value">
                                    {isCartonsLoading ? <span className="shimmer skeleton-text-sm" /> : totalCartons}
                                  </span>
                                </div>
                                <div className="order-select-card-metric">
                                  <span className="order-select-card-metric-label">Açık Koli</span>
                                  <span className="order-select-card-metric-value" style={{ color: '#2563eb' }}>
                                    {isCartonsLoading ? <span className="shimmer skeleton-text-sm" /> : openCount}
                                  </span>
                                </div>
                                <div className="order-select-card-metric">
                                  <span className="order-select-card-metric-label">Kapanan</span>
                                  <span className="order-select-card-metric-value" style={{ color: '#10b981' }}>
                                    {isCartonsLoading ? <span className="shimmer skeleton-text-sm" /> : completedCount}
                                  </span>
                                </div>
                              </div>

                              <div className="order-select-card-footer">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Clock size={12} />
                                  Son İşlem: {lastActivityFormatted}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Package size={12} />
                                  Ürün: {order.scannedCount} / {order.expectedQuantity}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                </>
              )}

              {createStep === 2 && selectedOrder && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Live Summary */}
                  <div className="live-summary-container">
                    <div className="live-summary-title">Seçilen Sipariş Özeti</div>
                    <div className="live-summary-row">
                      <span className="live-summary-label">Sipariş Numarası</span>
                      <span className="live-summary-value">{selectedOrder.orderNo}</span>
                    </div>
                    <div className="live-summary-row">
                      <span className="live-summary-label">Müşteri</span>
                      <span className="live-summary-value">{selectedOrder.customerName}</span>
                    </div>
                    <div className="live-summary-row">
                      <span className="live-summary-label">Toplam Koli</span>
                      <span className="live-summary-value">{(orderCartons[selectedOrder.id] || []).length}</span>
                    </div>
                    <div className="live-summary-row">
                      <span className="live-summary-label">Açık Koliler</span>
                      <span className="live-summary-value" style={{ color: '#2563eb' }}>
                        {(orderCartons[selectedOrder.id] || []).filter(c => c.status === 'Open').length}
                      </span>
                    </div>
                    <div className="live-summary-row">
                      <span className="live-summary-label">Tamamlanan Koliler</span>
                      <span className="live-summary-value" style={{ color: '#10b981' }}>
                        {(orderCartons[selectedOrder.id] || []).filter(c => c.status === 'Closed' || c.status === 'Printed' || c.status === 'Palletized').length}
                      </span>
                    </div>
                    <div className="live-summary-row">
                      <span className="live-summary-label">Ürün Adet (Okutulan / Hedef)</span>
                      <span className="live-summary-value">{selectedOrder.scannedCount} / {selectedOrder.expectedQuantity}</span>
                    </div>
                    <div className="live-summary-row" style={{ borderTop: '1px solid #cbd5e1', paddingTop: '12px', marginTop: '4px' }}>
                      <span className="live-summary-label" style={{ fontWeight: 700 }}>Tahmini Palet Sayısı</span>
                      <span className="live-summary-value" style={{ fontSize: '1rem', color: '#2563eb', fontWeight: 800 }}>
                        {Math.ceil((orderCartons[selectedOrder.id] || []).length / selectedOrder.cartonPerPallet)}
                      </span>
                    </div>
                  </div>

                  {/* System Information */}
                  <div className="system-info-container">
                    <div className="system-info-title">Sistem Bilgileri (Readonly)</div>
                    <div className="system-info-row">
                      <span className="system-info-label">Palet Numarası</span>
                      <span className="system-info-value">Otomatik oluşturulur</span>
                    </div>
                    <div className="system-info-row">
                      <span className="system-info-label">SSCC (18 Hane)</span>
                      <span className="system-info-value">Otomatik oluşturulur</span>
                    </div>
                    <div className="system-info-row">
                      <span className="system-info-label">Üretim Yöntemi</span>
                      <span className="system-info-badge">Database Sequence</span>
                    </div>
                  </div>
                </div>
              )}

              {createStep === 3 && (
                <div className="success-screen">
                  <div className="success-icon-wrapper">
                    <svg className="success-icon-svg" viewBox="0 0 100 100">
                      <circle className="success-icon-circle" cx="50" cy="50" r="40" />
                      <path className="success-icon-check" d="M30,50 L45,65 L70,35" />
                    </svg>
                  </div>
                  <h3 className="success-heading">Palet Başarıyla Açıldı</h3>
                  <p className="success-sub">
                    <strong>{newlyCreatedPallet?.palletNo}</strong> numaralı palet ve <code>{newlyCreatedPallet?.sscc}</code> SSCC barkodu başarıyla üretildi.
                  </p>
                  
                  <div className="success-actions-container" style={{ marginTop: '16px' }}>
                    <button 
                      type="button" 
                      className="btn btn-primary drawer-btn-full success-btn-scanning" 
                      onClick={() => {
                        if (newlyCreatedPallet) {
                          handlePalletClick(newlyCreatedPallet);
                        }
                        setShowCreateDrawer(false);
                      }}
                    >
                      Koli Okutmaya Başla
                    </button>
                    <button 
                      type="button" 
                      className="btn success-btn-list drawer-btn-full" 
                      onClick={() => {
                        setShowCreateDrawer(false);
                      }}
                    >
                      Palet Listesine Dön
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {createStep === 1 && (
              <div className="drawer-footer">
                <button
                  type="button"
                  className="btn btn-primary drawer-btn-full"
                  disabled={!selectedOrder}
                  onClick={() => setCreateStep(2)}
                >
                  Devam Et <ArrowRight size={16} />
                </button>
              </div>
            )}

            {createStep === 2 && selectedOrder && (
              <div className="drawer-footer" style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, height: '48px', fontWeight: 600 }}
                  disabled={palletCreationLoading}
                  onClick={() => setCreateStep(1)}
                >
                  Geri
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 2, height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600 }}
                  disabled={palletCreationLoading}
                  onClick={handleCreatePallet}
                >
                  {palletCreationLoading ? <Loader2 size={16} className="spinner" /> : 'Palet Oluştur'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* --- TRANSFER CARTON MODAL --- */}
      {showTransferModal && cartonToTransfer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              Koli Taşı: {cartonToTransfer.cartonNo}
            </h3>
            <form onSubmit={handleTransferCarton}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Hedef Palet Seçin (Açık Paletler) *</label>
                <select
                  className="form-input"
                  required
                  value={destinationPalletId}
                  onChange={(e) => setDestinationPalletId(e.target.value)}
                >
                  <option value="">-- HEDEF PALET SEÇİN --</option>
                  {openPallets.map(p => (
                    <option key={p.id} value={p.id}>{p.palletNo} - SSCC: {p.sscc} ({p.cartonCount} koli)</option>
                  ))}
                </select>
                {openPallets.length === 0 && (
                  <p style={{ color: 'var(--danger-text)', fontSize: '0.8rem', marginTop: '8px' }}>
                    Bu siparişe ait başka açık palet bulunmamaktadır. Lütfen önce yeni bir palet açın.
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowTransferModal(false); setCartonToTransfer(null); }}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={!destinationPalletId}>Koli Taşı</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
