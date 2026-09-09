import React, { useState } from 'react';
import { api } from '../services/api';
import { Search, Info, AlertCircle, Barcode, Copy, Check } from 'lucide-react';
import { TTPageHeader, TTBadge } from '../components/common';

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
  cartonItems?: string[];
}

export const BarcodeSearch: React.FC = () => {
  const [queryCode, setQueryCode] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);

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

  const handleCopyRaw = () => {
    if (!result?.rawCode) return;
    navigator.clipboard.writeText(result.rawCode);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <div style={{ paddingBottom: '32px' }}>
      <TTPageHeader
        title="Barkod Sorgulama"
        description="Herhangi bir ürün barkodunun (RawCode) veya koli etiketinin (SSCC) agregasyon ve içerik geçmişini sorgulayın."
      />

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '24px', marginTop: '16px' }}>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '42px', height: '42px', fontSize: '0.925rem', width: '100%', fontFamily: 'var(--font-mono)', borderRadius: 'var(--radius-sm)' }}
            placeholder="Sorgulamak istediğiniz barkod verisini girin veya okutun..."
            value={queryCode}
            onChange={(e) => setQueryCode(e.target.value)}
            autoFocus
          />
        </div>
        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ padding: '0 24px', height: '42px', fontSize: '0.9rem', fontWeight: 600, borderRadius: 'var(--radius-sm)' }} 
          disabled={loading || !queryCode.trim()}
        >
          {loading ? 'Aranıyor...' : 'Sorgula'}
        </button>
      </form>

      {error && (
        <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)' }}>
          <AlertCircle size={28} style={{ margin: '0 auto 8px', color: 'var(--danger)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 4px' }}>Barkod Bulunamadı</h3>
          <p style={{ fontSize: '0.85rem', margin: 0, opacity: 0.9 }}>Sistemde "{queryCode}" verisine ait herhangi bir eşleşme bulunamadı.</p>
        </div>
      )}

      {result && (
        <div className="search-split-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
          
          {/* Left Column: Lifecycle Step Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Step 1: Uploaded (Order details) */}
            <div className="card" style={{ display: 'flex', gap: '16px', padding: '18px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-light)', color: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0
              }}>1</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
                    Sipariş İlişkisi
                  </h4>
                  <TTBadge variant="active" size="sm">Kayıtlı</TTBadge>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.825rem' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Sipariş No:</span> <strong className="tabular-nums font-mono">{result.orderNo || '-'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Müşteri:</span> <strong>{result.customerName || '-'}</strong></div>
                  <div style={{ gridColumn: 'span 2' }}><span style={{ color: 'var(--text-muted)' }}>Ürün Adı:</span> <strong>{result.productName || '-'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>İş Emri No / GTIN:</span> <code style={{ fontFamily: 'var(--font-mono)' }} className="tabular-nums">{result.gtin || '-'}</code></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Seri No:</span> <code style={{ fontFamily: 'var(--font-mono)' }} className="tabular-nums">{result.serialNo || '-'}</code></div>
                </div>
              </div>
            </div>

            {/* Step 2: Scanned */}
            <div className="card" style={{ display: 'flex', gap: '16px', padding: '18px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: 'var(--radius-sm)',
                backgroundColor: result.scannedAt ? 'var(--success-bg)' : 'var(--bg-surface-subtle)',
                color: result.scannedAt ? 'var(--success)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0
              }}>2</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
                    Okutma (Scan) Bilgisi
                  </h4>
                  {result.scannedAt ? (
                    <TTBadge variant="success" size="sm">Okutuldu</TTBadge>
                  ) : (
                    <TTBadge variant="neutral" size="sm">Okutulmadı</TTBadge>
                  )}
                </div>
                {result.scannedAt ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.825rem' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Okutma Tarihi:</span> <strong className="tabular-nums">{new Date(result.scannedAt).toLocaleString('tr-TR')}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Operatör:</span> <strong>{result.scannedBy || 'Bilinmiyor'}</strong></div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Bu ürün henüz paketleme hattında okutulmamış.</p>
                )}
              </div>
            </div>

            {/* Step 3: Cartonized */}
            <div className="card" style={{ display: 'flex', gap: '16px', padding: '18px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: 'var(--radius-sm)',
                backgroundColor: result.cartonNo ? 'var(--primary-light)' : 'var(--bg-surface-subtle)',
                color: result.cartonNo ? 'var(--primary)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0
              }}>3</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
                    Koli Agregasyonu
                  </h4>
                  {result.cartonNo ? (
                    <TTBadge variant="info" size="sm">Kolilendi</TTBadge>
                  ) : (
                    <TTBadge variant="neutral" size="sm">Kolide Değil</TTBadge>
                  )}
                </div>
                {result.cartonNo ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.825rem' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Koli No:</span> <strong className="tabular-nums font-mono">{result.cartonNo}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Koli SSCC:</span> <code style={{ fontFamily: 'var(--font-mono)' }} className="tabular-nums">{result.cartonSSCC}</code></div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Bu ürün henüz bir koli içerisine yerleştirilmemiş.</p>
                )}
              </div>
            </div>

            {/* Step 4: Palletized */}
            <div className="card" style={{ display: 'flex', gap: '16px', padding: '18px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: 'var(--radius-sm)',
                backgroundColor: result.palletNo ? 'rgba(168, 85, 247, 0.12)' : 'var(--bg-surface-subtle)',
                color: result.palletNo ? '#8b5cf6' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0
              }}>4</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
                    Palet Agregasyonu
                  </h4>
                  {result.palletNo ? (
                    <TTBadge variant="active" size="sm">Paletlendi</TTBadge>
                  ) : (
                    <TTBadge variant="neutral" size="sm">Palette Değil</TTBadge>
                  )}
                </div>
                {result.palletNo ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.825rem' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Palet No:</span> <strong className="tabular-nums font-mono">{result.palletNo}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Palet SSCC:</span> <code style={{ fontFamily: 'var(--font-mono)' }} className="tabular-nums">{result.palletSSCC}</code></div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Ürünün bulunduğu koli henüz bir palete yerleştirilmemiş.</p>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Code Raw details & copy */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ padding: '18px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '0.925rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                  <Info size={16} color="var(--primary)" /> Ham Barkod Verisi
                </h3>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopyRaw}
                  style={{ height: '26px', padding: '0 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: 'var(--radius-xs)' }}
                >
                  {copiedRaw ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                  <span>{copiedRaw ? 'Kopyalandı' : 'Kopyala'}</span>
                </button>
              </div>
              <div>
                <textarea 
                  readOnly 
                  className="form-input" 
                  style={{
                    width: '100%', minHeight: '100px', backgroundColor: 'var(--bg-surface-subtle)', color: 'var(--text-main)', fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem', cursor: 'text', resize: 'none', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box'
                  }} 
                  value={result.rawCode}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Durum:</span>
                <TTBadge variant="active" size="sm">{result.status}</TTBadge>
              </div>
            </div>

            {result.cartonItems && result.cartonItems.length > 0 && (
              <div className="card" style={{ padding: '18px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '0.925rem', fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-main)' }}>
                  <Barcode size={16} color="var(--success)" /> Koli İçeriği <span className="tabular-nums font-mono" style={{ color: 'var(--text-muted)' }}>({result.cartonItems.length} Ürün)</span>
                </h3>
                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {result.cartonItems.map((item, idx) => (
                    <div key={idx} style={{
                      padding: '6px 10px', backgroundColor: 'var(--bg-surface-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-xs)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', wordBreak: 'break-all'
                    }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: '6px' }} className="tabular-nums">{idx + 1}.</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

