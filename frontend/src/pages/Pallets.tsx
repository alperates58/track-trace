import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Printer, Eye, Search, Barcode, Trash2, X, Check, Loader2, ArrowRight, Clock, Package, Layers } from 'lucide-react';
import { TTPageHeader, TTLoadingState, TTEmptyState, TTButton } from '../components/common';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
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
  const { hasPermission } = useAuth();
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
      const res = await api.post(`/api/pallets?orderId=${selectedOrder.id}`);
      const newPalletId = res?.id || res;
      
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

  const addCartonToPalletByCode = async (code: string) => {
    if (!selectedPallet || selectedPallet.status !== 'Open' || !code.trim()) return;

    try {
      await api.post(`/api/pallets/${selectedPallet.id}/add-carton?cartonSscc=${encodeURIComponent(code.trim())}`);
      setCartonSSCCInput('');
      fetchPallets();
      // Reload pallet
      const updatedPallet = await api.get(`/api/pallets/${selectedPallet.id}`);
      handlePalletClick(updatedPallet);
    } catch (err: any) {
      alert('Koli palete eklenemedi: ' + err.message);
    }
  };

  const handleAddCarton = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPallet || !cartonSSCCInput.trim()) return;
    await addCartonToPalletByCode(cartonSSCCInput);
  };

  // Rapid hardware barcode scanner support for laptop/handheld scanner
  useBarcodeScanner({
    onScan: (barcode) => {
      if (selectedPallet && selectedPallet.status === 'Open' && !showCreateDrawer && !showTransferModal) {
        addCartonToPalletByCode(barcode);
      }
    },
    enabled: !!selectedPallet && selectedPallet.status === 'Open' && !showCreateDrawer && !showTransferModal
  });

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
      <TTPageHeader
        title="Palet Yönetimi"
        description="Kolileri paletlere yerleştirme, palet kapatma ve etiket yazdırma."
        actions={
          hasPermission('pallets.create') ? (
            <TTButton variant="primary" onClick={handleOpenCreateDrawer} icon={<Plus size={18} />}>
              Yeni Palet Aç
            </TTButton>
          ) : undefined
        }
      />
      {/* Filter Bar */}
      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '240px', marginBottom: 0 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '32px', width: '100%', height: '36px', fontSize: '0.85rem' }}
              placeholder="Palet No, SSCC veya Sipariş No Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="form-group" style={{ width: '180px', marginBottom: 0 }}>
          <select
            className="form-input"
            style={{ height: '36px', fontSize: '0.85rem', padding: '0 10px' }}
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
        <button type="submit" className="btn btn-secondary" style={{ height: '36px', padding: '0 16px', fontSize: '0.85rem' }}>
          Ara
        </button>
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
                <tr><td colSpan={6} style={{ padding: '0' }}><TTLoadingState /></td></tr>
              ) : pallets.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '0' }}><TTEmptyState icon={<Layers size={32} />} title="Palet Bulunamadı" /></td></tr>
              ) : (
                pallets.map((p) => (
                  <tr key={p.id} style={{ cursor: 'pointer', backgroundColor: selectedPallet?.id === p.id ? 'var(--bg-surface-subtle)' : '' }} onClick={() => handlePalletClick(p)} className="hover-row">
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }} className="tabular-nums">{p.palletNo}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }} className="tabular-nums">{p.orderNo}</td>
                    <td><code className="tabular-nums" style={{ fontSize: '0.8125rem' }}>{p.sscc}</code></td>
                    <td><span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--primary)' }}>{p.cartonCount}</span></td>
                    <td>
                      <span className={`tt-badge ${p.status === 'Open' ? 'tt-badge-warning' : p.status === 'Closed' ? 'tt-badge-success' : p.status === 'Printed' ? 'tt-badge-primary' : 'tt-badge-neutral'}`}>
                        {p.status === 'Open' ? 'Açık' : p.status === 'Closed' ? 'Kapalı' : p.status === 'Printed' ? 'Yazdırıldı' : 'Sevk Edildi'}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-secondary" style={{ padding: '4px 8px', height: '28px', fontSize: '0.8125rem' }} onClick={() => handlePalletClick(p)} title="Detay Göster">
                          <Eye size={13} />
                        </button>
                        {hasPermission('pallets.print') && (
                          <button className="btn btn-primary" style={{ padding: '4px 8px', height: '28px', fontSize: '0.8125rem' }} onClick={() => handlePrintPdf(p.id)} title="PDF Etiketi İndir">
                            <Printer size={13} />
                          </button>
                        )}
                        {hasPermission('pallets.create') && p.status !== 'Shipped' && (
                          <button className="btn btn-danger" style={{ padding: '4px 8px', height: '28px', fontSize: '0.8125rem' }} onClick={() => handleDeletePallet(p.id)} title="Paleti Sil (Boz)">
                            <Trash2 size={13} />
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
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Toplam: <strong className="tabular-nums">{totalCount}</strong> palet</span>
            <div className="pagination-buttons">
              <button className="btn btn-secondary" style={{ padding: '4px 10px', height: '28px', fontSize: '0.8125rem' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Önceki</button>
              <span className="tabular-nums" style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '0.8125rem', fontWeight: 600 }}>{page}</span>
              <button className="btn btn-secondary" style={{ padding: '4px 10px', height: '28px', fontSize: '0.8125rem' }} disabled={page * 10 >= totalCount} onClick={() => setPage(p => p + 1)}>Sonraki</button>
            </div>
          </div>
        </div>

        {/* Pallet Detail & Adding carton */}
        {selectedPallet && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignSelf: 'start', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} color="var(--primary)" />
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedPallet.palletNo}</span> Detayları
                </h3>
                <code className="tabular-nums" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px', display: 'inline-block' }}>SSCC: {selectedPallet.sscc}</code>
              </div>
              <button className="btn btn-secondary btn-icon" style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedPallet(null)} aria-label="Kapat">
                <X size={15} />
              </button>
            </div>

            {hasPermission('pallets.print') && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" style={{ flex: 1, height: '36px', fontSize: '0.8125rem' }} onClick={() => handlePrintPdf(selectedPallet.id)}>
                  <Printer size={15} /> PDF Etiketi İndir
                </button>
                <button className="btn btn-secondary" style={{ flex: 1, height: '36px', fontSize: '0.8125rem' }} onClick={() => handlePrintZpl(selectedPallet.id)}>
                  <Barcode size={15} /> ZPL Kodu Üret
                </button>
              </div>
            )}

            {/* ZPL Code */}
            {zplOutput && (
              <pre style={{
                backgroundColor: 'var(--bg-canvas)',
                color: 'var(--primary)',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                overflowX: 'auto',
                fontFamily: 'var(--font-mono)',
                border: '1px solid var(--border-subtle)'
              }}>
                {zplOutput}
              </pre>
            )}

            {/* Scan Carton to Pallet Form */}
            {selectedPallet.status === 'Open' && hasPermission('pallets.create') ? (
              <form onSubmit={handleAddCarton} className="card" style={{ padding: '14px', backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)', boxShadow: 'none' }}>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>Koli Ekle (SSCC Okutun)</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input tabular-nums"
                    required
                    style={{ flex: 1, height: '36px', fontSize: '0.8125rem' }}
                    placeholder="34630477370000..."
                    value={cartonSSCCInput}
                    onChange={(e) => setCartonSSCCInput(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" style={{ height: '36px', padding: '0 16px', fontSize: '0.8125rem' }}>Ekle</button>
                </div>
              </form>
            ) : selectedPallet.status === 'Open' && !hasPermission('pallets.create') ? null : (
              <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-sm)', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                Bu palet kapatıldığı için yeni koli ekleme yapılamaz.
              </div>
            )}

            {/* Manual Close Pallet Action */}
            {selectedPallet.status === 'Open' && hasPermission('pallets.close') && (
              <button className="btn btn-warning" style={{ width: '100%', height: '36px', fontSize: '0.8125rem' }} onClick={() => handleClosePallet(selectedPallet.id)}>
                Paleti Kapat (Closed)
              </button>
            )}

            {/* Delete Pallet Action */}
            {selectedPallet.status !== 'Shipped' && hasPermission('pallets.create') && (
              <button className="btn btn-danger" style={{ width: '100%', height: '36px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={() => handleDeletePallet(selectedPallet.id)}>
                <Trash2 size={15} /> Paleti Sil (Boz)
              </button>
            )}

            {/* Cartons List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', margin: 0, color: 'var(--text-main)' }}>
                Palet İçindeki Koliler (<span className="tabular-nums">{selectedPallet.cartonCount}</span>)
              </h4>
              {cartonsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Koli listesi yükleniyor...</div>
              ) : palletCartons.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Bu palete henüz koli eklenmemiş.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                  {palletCartons.map((c, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: 'var(--bg-surface-subtle)',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8125rem',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      <div>
                        <strong style={{ fontFamily: 'var(--font-mono)' }}>{c.cartonNo}</strong>
                        <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SSCC: {c.sscc}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="tabular-nums" style={{ fontWeight: 600 }}>{c.actualQuantity} adet</span>
                        {hasPermission('pallets.create') && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '3px 8px', fontSize: '0.75rem', height: '24px' }}
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
            <div className="drawer-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="drawer-header-title-area">
                <h3 id="drawer-title" style={{ fontSize: '1.0625rem', fontWeight: 600, margin: 0 }}>Yeni Palet Aç</h3>
                <span className="drawer-header-subtitle" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Aktif bir sipariş seçerek yeni bir palet oluşturun.</span>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary btn-icon" 
                style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setShowCreateDrawer(false)}
                aria-label="Kapat"
              >
                <X size={16} />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="drawer-steps" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <div className={`drawer-step-item ${createStep === 1 ? 'active' : createStep > 1 ? 'completed' : ''}`}>
                <div className="drawer-step-number">{createStep > 1 ? <Check size={12} strokeWidth={3} /> : '1'}</div>
                <span style={{ fontSize: '0.8125rem' }}>Sipariş Seç</span>
              </div>
              <div className={`drawer-step-divider ${createStep > 1 ? (createStep > 2 ? 'completed' : 'active') : ''}`} />
              <div className={`drawer-step-item ${createStep === 2 ? 'active' : createStep > 2 ? 'completed' : ''}`}>
                <div className="drawer-step-number">{createStep > 2 ? <Check size={12} strokeWidth={3} /> : '2'}</div>
                <span style={{ fontSize: '0.8125rem' }}>Onay</span>
              </div>
              <div className={`drawer-step-divider ${createStep > 2 ? 'completed' : ''}`} />
              <div className={`drawer-step-item ${createStep === 3 ? 'completed' : ''}`}>
                <div className="drawer-step-number">3</div>
                <span style={{ fontSize: '0.8125rem' }}>Tamamlandı</span>
              </div>
            </div>

            {/* Body */}
            <div className="drawer-body" style={{ padding: '16px 20px' }}>
              {createStep === 1 && (
                <>
                  <div className="drawer-search-wrapper" style={{ marginBottom: '16px' }}>
                    <Search size={16} className="drawer-search-icon" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="drawer-search-input form-input"
                      style={{ height: '36px', fontSize: '0.85rem' }}
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
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
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
                                  <div className="order-select-card-no" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontFamily: 'var(--font-mono)' }}>{order.orderNo}</span>
                                    <span className="tt-badge tt-badge-primary" style={{ fontSize: '0.6875rem' }}>Aktif</span>
                                  </div>
                                  <div className="order-select-card-customer" style={{ fontSize: '0.8125rem' }}>{order.customerName}</div>
                                </div>
                                <div className="order-select-card-check">
                                  <Check size={12} strokeWidth={3} />
                                </div>
                              </div>
                              
                              <div className="order-select-card-metrics-grid">
                                <div className="order-select-card-metric">
                                  <span className="order-select-card-metric-label">Toplam Koli</span>
                                  <span className="order-select-card-metric-value tabular-nums">
                                    {isCartonsLoading ? <span className="shimmer skeleton-text-sm" /> : totalCartons}
                                  </span>
                                </div>
                                <div className="order-select-card-metric">
                                  <span className="order-select-card-metric-label">Açık Koli</span>
                                  <span className="order-select-card-metric-value tabular-nums" style={{ color: 'var(--warning-text)' }}>
                                    {isCartonsLoading ? <span className="shimmer skeleton-text-sm" /> : openCount}
                                  </span>
                                </div>
                                <div className="order-select-card-metric">
                                  <span className="order-select-card-metric-label">Kapanan</span>
                                  <span className="order-select-card-metric-value tabular-nums" style={{ color: 'var(--success)' }}>
                                    {isCartonsLoading ? <span className="shimmer skeleton-text-sm" /> : completedCount}
                                  </span>
                                </div>
                              </div>

                              <div className="order-select-card-footer">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                                  <Clock size={12} />
                                  Son İşlem: <span className="tabular-nums">{lastActivityFormatted}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                                  <Package size={12} />
                                  Ürün: <span className="tabular-nums">{order.scannedCount} / {order.expectedQuantity}</span>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Live Summary */}
                  <div className="live-summary-container" style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                    <div className="live-summary-title" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '12px' }}>Seçilen Sipariş Özeti</div>
                    <div className="live-summary-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '8px' }}>
                      <span className="live-summary-label" style={{ color: 'var(--text-muted)' }}>Sipariş Numarası</span>
                      <span className="live-summary-value tabular-nums" style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{selectedOrder.orderNo}</span>
                    </div>
                    <div className="live-summary-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '8px' }}>
                      <span className="live-summary-label" style={{ color: 'var(--text-muted)' }}>Müşteri</span>
                      <span className="live-summary-value" style={{ fontWeight: 500 }}>{selectedOrder.customerName}</span>
                    </div>
                    <div className="live-summary-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '8px' }}>
                      <span className="live-summary-label" style={{ color: 'var(--text-muted)' }}>Toplam Koli</span>
                      <span className="live-summary-value tabular-nums" style={{ fontWeight: 600 }}>{(orderCartons[selectedOrder.id] || []).length}</span>
                    </div>
                    <div className="live-summary-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '8px' }}>
                      <span className="live-summary-label" style={{ color: 'var(--text-muted)' }}>Açık Koliler</span>
                      <span className="live-summary-value tabular-nums" style={{ color: 'var(--warning-text)', fontWeight: 600 }}>
                        {(orderCartons[selectedOrder.id] || []).filter(c => c.status === 'Open').length}
                      </span>
                    </div>
                    <div className="live-summary-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '8px' }}>
                      <span className="live-summary-label" style={{ color: 'var(--text-muted)' }}>Tamamlanan Koliler</span>
                      <span className="live-summary-value tabular-nums" style={{ color: 'var(--success)', fontWeight: 600 }}>
                        {(orderCartons[selectedOrder.id] || []).filter(c => c.status === 'Closed' || c.status === 'Printed' || c.status === 'Palletized').length}
                      </span>
                    </div>
                    <div className="live-summary-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '8px' }}>
                      <span className="live-summary-label" style={{ color: 'var(--text-muted)' }}>Ürün Adet (Okutulan / Hedef)</span>
                      <span className="live-summary-value tabular-nums" style={{ fontWeight: 600 }}>{selectedOrder.scannedCount} / {selectedOrder.expectedQuantity}</span>
                    </div>
                    <div className="live-summary-row" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', marginTop: '4px' }}>
                      <span className="live-summary-label" style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Tahmini Palet Sayısı</span>
                      <span className="live-summary-value tabular-nums" style={{ fontSize: '0.9375rem', color: 'var(--primary)', fontWeight: 700 }}>
                        {Math.ceil((orderCartons[selectedOrder.id] || []).length / (selectedOrder.cartonPerPallet || 1))}
                      </span>
                    </div>
                  </div>

                  {/* System Information */}
                  <div className="system-info-container" style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                    <div className="system-info-title" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '12px' }}>Sistem Bilgileri (Readonly)</div>
                    <div className="system-info-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '8px' }}>
                      <span className="system-info-label" style={{ color: 'var(--text-muted)' }}>Palet Numarası</span>
                      <span className="system-info-value" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Otomatik oluşturulur</span>
                    </div>
                    <div className="system-info-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '8px' }}>
                      <span className="system-info-label" style={{ color: 'var(--text-muted)' }}>SSCC (18 Hane)</span>
                      <span className="system-info-value" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Otomatik oluşturulur</span>
                    </div>
                    <div className="system-info-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                      <span className="system-info-label" style={{ color: 'var(--text-muted)' }}>Üretim Yöntemi</span>
                      <span className="tt-badge tt-badge-neutral">Database Sequence</span>
                    </div>
                  </div>
                </div>
              )}

              {createStep === 3 && (
                <div className="success-screen" style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div className="success-icon-wrapper" style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                    <Check size={28} strokeWidth={2.5} />
                  </div>
                  <h3 className="success-heading" style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '8px' }}>Palet Başarıyla Açıldı</h3>
                  <p className="success-sub" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{newlyCreatedPallet?.palletNo}</strong> numaralı palet ve <code className="tabular-nums">{newlyCreatedPallet?.sscc}</code> SSCC barkodu başarıyla üretildi.
                  </p>
                  
                  <div className="success-actions-container" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      style={{ height: '38px' }}
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
                      className="btn btn-secondary" 
                      style={{ height: '38px' }}
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
              <div className="drawer-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', height: '38px' }}
                  disabled={!selectedOrder}
                  onClick={() => setCreateStep(2)}
                >
                  Devam Et <ArrowRight size={15} />
                </button>
              </div>
            )}

            {createStep === 2 && selectedOrder && (
              <div className="drawer-footer" style={{ display: 'flex', gap: '10px', padding: '14px 20px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, height: '38px', fontWeight: 600 }}
                  disabled={palletCreationLoading}
                  onClick={() => setCreateStep(1)}
                >
                  Geri
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 2, height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600 }}
                  disabled={palletCreationLoading}
                  onClick={handleCreatePallet}
                >
                  {palletCreationLoading ? <Loader2 size={15} className="spinner" /> : 'Palet Oluştur'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* --- TRANSFER CARTON MODAL --- */}
      {showTransferModal && cartonToTransfer && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 600 }}>
                Koli Taşı: <span style={{ fontFamily: 'var(--font-mono)' }}>{cartonToTransfer.cartonNo}</span>
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowTransferModal(false); setCartonToTransfer(null); }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleTransferCarton} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Hedef Palet Seçin (Açık Paletler) <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select
                  className="form-input"
                  required
                  style={{ height: '36px', fontSize: '0.85rem' }}
                  value={destinationPalletId}
                  onChange={(e) => setDestinationPalletId(e.target.value)}
                >
                  <option value="">-- HEDEF PALET SEÇİN --</option>
                  {openPallets.map(p => (
                    <option key={p.id} value={p.id}>{p.palletNo} - SSCC: {p.sscc} ({p.cartonCount} koli)</option>
                  ))}
                </select>
                {openPallets.length === 0 && (
                  <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '6px', marginBottom: 0 }}>
                    Bu siparişe ait başka açık palet bulunmamaktadır. Lütfen önce yeni bir palet açın.
                  </p>
                )}
              </div>
              <div className="modal-footer" style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" style={{ height: '36px', padding: '0 16px' }} onClick={() => { setShowTransferModal(false); setCartonToTransfer(null); }}>
                  İptal
                </button>
                <button type="submit" className="btn btn-primary" style={{ height: '36px', padding: '0 16px' }} disabled={!destinationPalletId}>
                  Koli Taşı
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
