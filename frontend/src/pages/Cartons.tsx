import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Printer, Eye, Search, AlertCircle, FileText, Barcode } from 'lucide-react';

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
      const blob = await api.get(`/api/cartons/${cartonId}/label.pdf`);
      const fileURL = URL.createObjectURL(blob);
      const pdfWindow = window.open();
      if (pdfWindow) {
        pdfWindow.location.href = fileURL;
      }
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

      <div style={{ display: 'grid', gridTemplateColumns: selectedCarton ? '3fr 2fr' : '1fr', gap: '24px' }}>
        
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
            <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
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
                      <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{item.rawCode}</div>
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
