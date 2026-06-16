import React, { useState } from 'react';
import { api } from '../services/api';
import { Search, Info, CheckCircle, Clock, Archive, Layers } from 'lucide-react';

interface SearchResult {
  rawCode: string;
  gtin: string;
  serialNo: string;
  status: string;
  scannedAt: string | null;
  scannedBy: string | null;
  orderNo: string | null;
  customerName: string | null;
  productName: string | null;
  cartonNo: string | null;
  cartonSSCC: string | null;
  palletNo: string | null;
  palletSSCC: string | null;
}

export const BarcodeSearch: React.FC = () => {
  const [queryCode, setQueryCode] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryCode.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.get(`/api/barcodes/search?code=${encodeURIComponent(queryCode.trim())}`);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Barkod bulunamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>Barkod Sorgulama</h2>
        <p style={{ color: 'var(--text-muted)' }}>Herhangi bir ürün barkodunun (RawCode) sipariş, koli, palet ve okutma geçmişini izleyin.</p>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={20} style={{ position: 'absolute', left: '16px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '48px', height: '48px', fontSize: '1rem', width: '100%' }}
              placeholder="Sorgulamak istediğiniz barkod verisini girin veya okutun..."
              value={queryCode}
              onChange={(e) => setQueryCode(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" style={{ padding: '0 28px', height: '48px', fontSize: '1rem' }} disabled={loading}>
          {loading ? 'Aranıyor...' : 'Sorgula'}
        </button>
      </form>

      {error && (
        <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
          <AlertCircleIcon size={32} style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.15rem', marginBottom: '4px' }}>Barkod Bulunamadı</h3>
          <p style={{ fontSize: '0.9rem' }}>Sistemde "{queryCode}" verisine ait herhangi bir eşleşme bulunamadı.</p>
        </div>
      )}

      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
          
          {/* Left Column: Lifecycle Step Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Step 1: Uploaded (Order details) */}
            <div className="card" style={{ display: 'flex', gap: '20px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)',
                display: 'flex', alignItems: 'center', justify: 'center', fontWeight: 700, flexShrink: 0
              }}>1</div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Sipariş İlişkisi
                  <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>Kayıtlı</span>
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem', marginTop: '12px' }}>
                  <div>Sipariş No: <strong>{result.orderNo || '-'}</strong></div>
                  <div>Müşteri: <strong>{result.customerName || '-'}</strong></div>
                  <div style={{ gridColumn: 'span 2' }}>Ürün Adı: <strong>{result.productName || '-'}</strong></div>
                  <div>GTIN: <code>{result.gtin || '-'}</code></div>
                  <div>Seri No: <code>{result.serialNo || '-'}</code></div>
                </div>
              </div>
            </div>

            {/* Step 2: Scanned */}
            <div className="card" style={{ display: 'flex', gap: '20px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                backgroundColor: result.scannedAt ? 'var(--success-bg)' : '#f1f5f9',
                color: result.scannedAt ? 'var(--success)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justify: 'center', fontWeight: 700, flexShrink: 0
              }}>2</div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Okutma (Scan) Bilgisi
                  {result.scannedAt ? (
                    <span className="badge badge-completed" style={{ fontSize: '0.7rem' }}>Okutuldu</span>
                  ) : (
                    <span className="badge badge-draft" style={{ fontSize: '0.7rem' }}>Okutulmadı</span>
                  )}
                </h4>
                {result.scannedAt ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem', marginTop: '12px' }}>
                    <div>Okutma Tarihi: <strong>{new Date(result.scannedAt).toLocaleString('tr-TR')}</strong></div>
                    <div>Operatör: <strong>{result.scannedBy || 'Bilinmiyor'}</strong></div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>Bu ürün henüz paketleme hattında okutulmamış.</p>
                )}
              </div>
            </div>

            {/* Step 3: Cartonized */}
            <div className="card" style={{ display: 'flex', gap: '20px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                backgroundColor: result.cartonNo ? '#e0f2fe' : '#f1f5f9',
                color: result.cartonNo ? '#0284c7' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justify: 'center', fontWeight: 700, flexShrink: 0
              }}>3</div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Koli Agregasyonu
                  {result.cartonNo ? (
                    <span className="badge badge-printed" style={{ fontSize: '0.7rem' }}>Kolilendi</span>
                  ) : (
                    <span className="badge badge-draft" style={{ fontSize: '0.7rem' }}>Kolide Değil</span>
                  )}
                </h4>
                {result.cartonNo ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem', marginTop: '12px' }}>
                    <div>Koli Numarası: <strong>{result.cartonNo}</strong></div>
                    <div>Koli SSCC: <code>{result.cartonSSCC}</code></div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>Bu ürün henüz bir koli içerisine yerleştirilmemiş.</p>
                )}
              </div>
            </div>

            {/* Step 4: Palletized */}
            <div className="card" style={{ display: 'flex', gap: '20px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                backgroundColor: result.palletNo ? '#faf5ff' : '#f1f5f9',
                color: result.palletNo ? '#8b5cf6' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justify: 'center', fontWeight: 700, flexShrink: 0
              }}>4</div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Palet Agregasyonu
                  {result.palletNo ? (
                    <span className="badge badge-palletized" style={{ fontSize: '0.7rem' }}>Paletlendi</span>
                  ) : (
                    <span className="badge badge-draft" style={{ fontSize: '0.7rem' }}>Palette Değil</span>
                  )}
                </h4>
                {result.palletNo ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem', marginTop: '12px' }}>
                    <div>Palet Numarası: <strong>{result.palletNo}</strong></div>
                    <div>Palet SSCC: <code>{result.palletSSCC}</code></div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>Ürünün bulunduğu koli henüz bir palete yerleştirilmemiş.</p>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Code Raw details & copy */}
          <div className="card" style={{ alignSelf: 'start' }}>
            <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <Info size={18} color="var(--primary)" /> Ham Barkod Verisi
            </h3>
            <div style={{ marginTop: '12px' }}>
              <textarea readOnly className="form-input" style={{
                width: '100%', minHeight: '120px', backgroundColor: '#f8fafc', fontFamily: 'monospace',
                fontSize: '0.85rem', cursor: 'text', resize: 'none'
              }} value={result.rawCode}></textarea>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', fontSize: '0.85rem' }}>
              <div>Durum (Status): <span className={`badge badge-active`} style={{ float: 'right' }}>{result.status}</span></div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

// Simple inline Helper Icon
const AlertCircleIcon: React.FC<any> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={props.size} height={props.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
