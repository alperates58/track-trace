import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Printer, Eye, Search, FileText, Barcode, Trash2, Plus } from 'lucide-react';

interface Carton {
  id: string;
  orderId: string;
  orderNo: string;
  cartonNo: string;
  sscc: string;
  targetQuantity: number;
  actualQuantity: number;
  status: string;
  createdAt: string;
  closedAt: string | null;
  printedAt: string | null;
}

interface ProductCode {
  rawCode: string;
  gtin: string;
  serialNo: string;
  status: string;
  scannedAt: string;
  scannedBy: string;
}

export const Cartons: React.FC = () => {
  const { user } = useAuth();
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Detail panel
  const [selectedCarton, setSelectedCarton] = useState<Carton | null>(null);
  const [cartonItems, setCartonItems] = useState<ProductCode[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [zplOutput, setZplOutput] = useState<string | null>(null);
  const [newProductBarcode, setNewProductBarcode] = useState('');

  const fetchCartons = () => {
    setLoading(true);
    const query = `?pageNumber=${page}&pageSize=10&search=${encodeURIComponent(search)}&status=${statusFilter}`;
    api.get(`/api/cartons${query}`)
      .then(res => {
        setCartons(res.items);
        setTotalCount(res.totalCount);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCartons();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCartons();
  };

  const handleCartonClick = async (carton: Carton) => {
    setSelectedCarton(carton);
    setCartonItems([]);
    setZplOutput(null);
    setItemsLoading(true);

    try {
      const items = await api.get(`/api/cartons/${carton.id}/items`);
      setCartonItems(items);
    } catch (err) {
      console.error(err);
    } finally {
      setItemsLoading(false);
    }
  };

  const handlePrintPdf = async (cartonId: string) => {
    try {
      // Fetch as blob and open using authorized API client
      const blob = (await api.get(`/api/cartons/${cartonId}/label.pdf`)) as Blob;
      const fileURL = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileURL;
      a.download = `koli_etiketi_${cartonId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(fileURL);
      fetchCartons(); // refresh to show "Printed" status
    } catch (err: any) {
      alert('PDF oluşturulamadı: ' + err.message);
    }
  };

  const handlePrintZpl = async (cartonId: string) => {
    try {
      const res = await api.post(`/api/cartons/${cartonId}/print?format=ZPL`);
      setZplOutput(res.zpl);
      fetchCartons(); // refresh to show "Printed" status
    } catch (err: any) {
      alert('ZPL oluşturulamadı: ' + err.message);
    }
  };

  const handleDecompose = async (cartonId: string) => {
    if (!confirm("Bu koliyi bozmak istediğinize emin misiniz? Kolideki tüm ürünler 'Okutuldu' (scanned) durumundan çıkıp 'Yüklendi' (uploaded) durumuna geri dönecek ve koli tamamen silinecektir.")) return;
    try {
      await api.post(`/api/cartons/${cartonId}/decompose`);
      setSelectedCarton(null);
      fetchCartons();
    } catch (err: any) {
      alert("Koli bozulamadı: " + err.message);
    }
  };

  const handleRemoveProduct = async (cartonId: string, rawCode: string) => {
    if (!confirm("Bu ürünü koliden çıkarmak istediğinize emin misiniz? Ürün koli dışına çıkarılacak ve koli tekrar 'Açık' durumuna getirilecektir.")) return;
    try {
      await api.post(`/api/cartons/${cartonId}/remove-product?rawCode=${encodeURIComponent(rawCode)}`);
      // Reload details
      const updatedCarton = await api.get(`/api/cartons/${cartonId}`);
      setSelectedCarton(updatedCarton);
      // Reload items
      const items = await api.get(`/api/cartons/${cartonId}/items`);
      setCartonItems(items);
      fetchCartons();
    } catch (err: any) {
      alert("Ürün çıkarılamadı: " + err.message);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCarton || !newProductBarcode.trim()) return;
    try {
      await api.post(`/api/cartons/${selectedCarton.id}/add-product?rawCode=${encodeURIComponent(newProductBarcode.trim())}`);
      setNewProductBarcode('');
      // Reload details
      const updatedCarton = await api.get(`/api/cartons/${selectedCarton.id}`);
      setSelectedCarton(updatedCarton);
      // Reload items
      const items = await api.get(`/api/cartons/${selectedCarton.id}/items`);
      setCartonItems(items);
      fetchCartons();
    } catch (err: any) {
      alert("Ürün eklenemedi: " + err.message);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>Koli Yönetimi</h2>
        <p style={{ color: 'var(--text-muted)' }}>Oluşturulan kolilerin durumları, içerdikleri ürünler ve etiket yazdırma işlemleri.</p>
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
              placeholder="Koli No, SSCC veya Sipariş No Ara..."
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
            <option value="Open">Açık (Doluyor)</option>
            <option value="Closed">Kapalı (Closed)</option>
            <option value="Printed">Yazdırıldı</option>
            <option value="Palletized">Paletlendi</option>
          </select>
        </div>
        <button type="submit" className="btn btn-secondary">Ara</button>
      </form>

      <div className={selectedCarton ? "carton-split-grid" : ""} style={{ display: selectedCarton ? undefined : 'block' }}>
        
        {/* Cartons Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Koli No</th>
                <th>Sipariş No</th>
                <th>SSCC (18 Hane)</th>
                <th>Doluluk</th>
                <th>Durum</th>
                <th>Aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              {loading && cartons.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px' }}>Yükleniyor...</td></tr>
              ) : cartons.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Koli bulunamadı.</td></tr>
              ) : (
                cartons.map((c) => (
                  <tr key={c.id} style={{ cursor: 'pointer', backgroundColor: selectedCarton?.id === c.id ? '#f1f5f9' : '' }} onClick={() => handleCartonClick(c)}>
                    <td style={{ fontWeight: 600 }}>{c.cartonNo}</td>
                    <td>{c.orderNo}</td>
                    <td><code style={{ fontSize: '0.85rem' }}>{c.sscc}</code></td>
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{c.actualQuantity}</span> / {c.targetQuantity}
                    </td>
                    <td>
                      <span className={`badge badge-${c.status.toLowerCase()}`}>
                        {c.status === 'Open' ? 'Açık' : c.status === 'Closed' ? 'Kapalı' : c.status === 'Printed' ? 'Yazdırıldı' : 'Paletlendi'}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => handleCartonClick(c)}>
                          <Eye size={14} /> Detay
                        </button>
                        <button className="btn btn-primary" style={{ padding: '6px 10px' }} onClick={() => handlePrintPdf(c.id)}>
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
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Toplam: {totalCount} koli</span>
            <div className="pagination-buttons">
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Önceki</button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '0.9rem', fontWeight: 600 }}>{page}</span>
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} disabled={page * 10 >= totalCount} onClick={() => setPage(p => p + 1)}>Sonraki</button>
            </div>
          </div>
        </div>

        {/* Carton Detail Sidebar */}
        {selectedCarton && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem' }}>{selectedCarton.cartonNo} Detayları</h3>
                <code style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>SSCC: {selectedCarton.sscc}</code>
              </div>
              <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem', marginLeft: 'auto' }} onClick={() => setSelectedCarton(null)}>Kapat</button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handlePrintPdf(selectedCarton.id)}>
                <FileText size={16} /> PDF Etiketi İndir
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handlePrintZpl(selectedCarton.id)}>
                <Barcode size={16} /> ZPL Kodu Üret
              </button>
            </div>

            {user?.role !== 'Viewer' && (
              <button 
                className="btn btn-danger" 
                style={{ width: '100%', padding: '10px' }} 
                onClick={() => handleDecompose(selectedCarton.id)}
              >
                Koliyi Boz (İptal Et)
              </button>
            )}

            {/* ZPL Raw Output Panel */}
            {zplOutput && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Zebra ZPL Template:</span>
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
              </div>
            )}

            {/* Scan Product directly to Carton */}
            {selectedCarton.status === 'Open' && user?.role !== 'Viewer' && (
              <form onSubmit={handleAddProduct} className="card" style={{ padding: '14px', backgroundColor: 'var(--primary-light)', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>Koliye Ürün Ekle (Barkod Okutun)</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ flex: 1, height: '36px', fontSize: '0.85rem' }} 
                    required 
                    placeholder="Ürün barkodunu okutun veya yazın..." 
                    value={newProductBarcode} 
                    onChange={e => setNewProductBarcode(e.target.value)} 
                  />
                  <button type="submit" className="btn btn-primary" style={{ height: '36px', padding: '0 12px' }}>
                    <Plus size={16} />
                  </button>
                </div>
              </form>
            )}

            {/* Carton Item List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>Koli İçi Barkodlar ({cartonItems.length})</h4>
              
              {itemsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>İçerik yükleniyor...</div>
              ) : cartonItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Bu kolide henüz okutulmuş ürün yok.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                  {cartonItems.map((item, idx) => (
                    <div key={idx} style={{
                      backgroundColor: '#f8fafc',
                      padding: '10px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ fontWeight: 600, wordBreak: 'break-all', maxWidth: '85%' }}>{item.rawCode}</div>
                        {user?.role !== 'Viewer' && (
                          <button 
                            onClick={() => handleRemoveProduct(selectedCarton.id, item.rawCode)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                            title="Hatalı Ürünü Çıkar"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginTop: '4px', fontSize: '0.75rem' }}>
                        <span>S/N: {item.serialNo}</span>
                        <span>Okuyan: {item.scannedBy}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
