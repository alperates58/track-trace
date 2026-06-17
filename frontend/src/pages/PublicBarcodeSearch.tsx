import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Barcode, Info, AlertCircle, Package, Check, Copy, ShieldCheck } from 'lucide-react';

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

interface PublicBarcodeSearchProps {
  code: string;
}

export const PublicBarcodeSearch: React.FC<PublicBarcodeSearchProps> = ({ code }) => {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    const fetchPublicData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get(`/api/barcodes/public/search?code=${encodeURIComponent(code.trim())}`);
        setResult(data);
      } catch (err: any) {
        setError(err.message || 'Barkod veya Koli bilgisi bulunamadı.');
      } finally {
        setLoading(false);
      }
    };

    if (code) {
      fetchPublicData();
    } else {
      setError('Geçersiz sorgulama kodu.');
      setLoading(false);
    }
  }, [code]);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllCodes = () => {
    if (!result?.cartonItems) return;
    const allCodes = result.cartonItems.join('\n');
    navigator.clipboard.writeText(allCodes);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', backgroundColor: '#f8fafc', padding: '20px'
      }}>
        <div style={{
          width: '50px', height: '50px', border: '4px solid #e2e8f0', borderTop: '4px solid #2563eb',
          borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px'
        }} />
        <p style={{ color: '#64748b', fontFamily: 'var(--font-primary)' }}>Koli bilgileri yükleniyor...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', backgroundColor: '#f8fafc', padding: '20px', fontFamily: 'var(--font-primary)'
      }}>
        <div style={{
          backgroundColor: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '440px', width: '100%',
          boxShadow: 'var(--shadow-lg)', border: '1px solid #e2e8f0', textAlign: 'center'
        }}>
          <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: '#0f172a' }}>Sorgulama Başarısız</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '24px', lineHeight: '1.5' }}>
            {error || 'Sorguladığınız koliye veya ürüne ait bilgi sistemde bulunamadı.'}
          </p>
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Lider Kozmetik Track & Trace</span>
          </div>
        </div>
      </div>
    );
  }

  const isCarton = result.cartonItems && result.cartonItems.length > 0;

  return (
    <div style={{
      backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px 16px 40px 16px',
      fontFamily: 'var(--font-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center'
    }}>
      {/* Top Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', marginTop: '8px'
      }}>
        <ShieldCheck size={24} color="var(--primary)" />
        <span style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '0.5px', color: '#0f172a', fontFamily: 'var(--font-display)' }}>
          LİDER KOZMETİK DOĞRULAMA
        </span>
      </div>

      <div style={{ maxWidth: '640px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Info Card */}
        <div style={{
          backgroundColor: '#fff', borderRadius: '16px', padding: '20px',
          boxShadow: 'var(--shadow-md)', border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <Package size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              {isCarton ? 'Koli Bilgileri' : 'Ürün / Barkod Bilgileri'}
            </h3>
            <span style={{
              marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px',
              borderRadius: '9999px', backgroundColor: 'var(--success-bg)', color: 'var(--success-text)'
            }}>
              {result.status}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
            <div>
              <span style={{ color: '#64748b' }}>Müşteri / Customer:</span>
              <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{result.customerName || '-'}</div>
            </div>

            <div>
              <span style={{ color: '#64748b' }}>Ürün Adı / Product Name:</span>
              <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{result.productName || '-'}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '4px' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>GTIN:</span>
                <div style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>{result.gtin || '-'}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Sipariş No / Order:</span>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{result.orderNo || '-'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Koli No / Carton No:</span>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{result.cartonNo || '-'}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Koli SSCC:</span>
                <div style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace', fontSize: '0.85rem' }}>{result.cartonSSCC || '-'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content list card (Alt Alta Kodlar) */}
        {isCarton && result.cartonItems && (
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px', padding: '20px',
            boxShadow: 'var(--shadow-md)', border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Barcode size={20} color="var(--success)" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Koli İçeriği ({result.cartonItems.length} Ürün)
                </h3>
              </div>
              <button 
                onClick={copyAllCodes}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600,
                  color: 'var(--primary)', border: '1px solid var(--border-color)', backgroundColor: 'transparent',
                  padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'var(--transition)'
                }}
              >
                {copiedAll ? (
                  <>
                    <Check size={14} color="var(--success)" /> Kopyalandı
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Tümünü Kopyala
                  </>
                )}
              </button>
            </div>

            {/* List showing products one under another */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {result.cartonItems.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: '10px', transition: 'var(--transition)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, marginRight: '12px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8' }}>
                      Ürün #{idx + 1}
                    </span>
                    <span style={{
                      fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600,
                      color: '#334155', wordBreak: 'break-all', lineHeight: '1.4'
                    }}>
                      {item}
                    </span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(item, idx)}
                    style={{
                      border: 'none', backgroundColor: '#fff', width: '32px', height: '32px',
                      borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', borderStyle: 'solid', borderWidth: '1px', borderColor: '#e2e8f0',
                      flexShrink: 0
                    }}
                    title="Kopyala"
                  >
                    {copiedIndex === idx ? (
                      <Check size={14} color="var(--success)" />
                    ) : (
                      <Copy size={14} color="#64748b" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.75rem', color: '#94a3b8' }}>
          <p>© {new Date().getFullYear()} Lider Kozmetik San. ve Tic. A.Ş.</p>
          <p style={{ marginTop: '2px' }}>Her hakkı saklıdır. Track & Trace Güvenli Ürün Doğrulama</p>
        </div>

      </div>
    </div>
  );
};
