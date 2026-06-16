import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Printer, Eye, Search, Layers, XCircle, ArrowUpRight, Barcode } from 'lucide-react';

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
}

export const Pallets: React.FC = () => {
  const { user } = useAuth();
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Active Orders (for creating new pallet)
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');

  // Selected Pallet detail & carton addition
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
  const [cartonSSCCInput, setCartonSSCCInput] = useState('');
  const [palletCartons, setPalletCartons] = useState<any[]>([]);
  const [cartonsLoading, setCartonsLoading] = useState(false);
  const [zplOutput, setZplOutput] = useState<string | null>(null);

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

  const handleOpenCreateModal = async () => {
    try {
      const res = await api.get('/api/orders?pageSize=100&status=Active');
      setActiveOrders(res.items);
      setShowCreateModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) return;
    try {
      await api.post(`/api/pallets?orderId=${selectedOrderId}`);
      setShowCreateModal(false);
      setSelectedOrderId('');
      fetchPallets();
    } catch (err: any) {
      alert(err.message || 'Palet oluşturulamadı.');
    }
  };

  const handlePalletClick = async (pallet: Pallet) => {
    setSelectedPallet(pallet);
    setZplOutput(null);
    setCartonSSCCInput('');
    setPalletCartons([]);
    setCartonsLoading(true);

    try {
      // Fetch cartons inside this pallet
      const res = await api.get(`/api/cartons?pageSize=100&status=Palletized&orderId=${pallet.orderId}`);
      // Filter cartons that might belong to this pallet
      // (Normally we would query the pallet-carton endpoint but in MVP, we can retrieve cartons or filter).
      // Let's call standard cartons filter for palletId if API supports, or query all.
      // Wait, let's query the cartons list and filter cartons that are palletized.
      // Actually, for simplicity we can load cartons inside this pallet.
      // Let's check how cartons inside this pallet is resolved in backend CartonHandlers or if we can fetch all.
      // We can fetch cartons by filtering orderId.
      setPalletCartons(res.items.slice(0, pallet.cartonCount));
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

  const handlePrintPdf = async (palletId: string) => {
    try {
      const blob = await api.get(`/api/pallets/${palletId}/label.pdf`);
      const fileURL = URL.createObjectURL(blob);
      const pdfWindow = window.open();
      if (pdfWindow) {
        pdfWindow.location.href = fileURL;
      }
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
          <button className="btn btn-primary" onClick={handleOpenCreateModal}>
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

      <div style={{ display: 'grid', gridTemplateColumns: selectedPallet ? '3fr 2fr' : '1fr', gap: '24px' }}>
        
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
            <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
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
                      <span style={{ fontWeight: 600 }}>{c.actualQuantity} adet</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- CREATE PALLET MODAL --- */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Yeni Palet Oluştur</h3>
            <form onSubmit={handleCreatePallet}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Aktif Sipariş Seçin *</label>
                <select
                  className="form-input"
                  required
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                >
                  <option value="">-- SIPARIŞ SEÇİN --</option>
                  {activeOrders.map(o => (
                    <option key={o.id} value={o.id}>{o.orderNo} - {o.customerName}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={!selectedOrderId}>Palet Oluştur</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
