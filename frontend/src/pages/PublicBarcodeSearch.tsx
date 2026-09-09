import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AlertCircle, Package, ShieldCheck, Barcode, Copy, Check } from 'lucide-react';

interface VerifyResponse {
  isFound: boolean;
  type: string | null;
  codeNo: string | null;
  orderNo: string | null;
  productName: string | null;
  actualQuantity: number;
  targetQuantity: number;
  status: string | null;
  createdAt: string | null;
  cartonItems: string[] | null;
}

export const PublicBarcodeSearch: React.FC<{ code: string }> = ({ code }) => {
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    const fetchPublicData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get(`/api/public/verify?code=${encodeURIComponent(code.trim())}`);
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
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }).catch(err => console.error('Kopyalama başarısız', err));
  };

  const copyAllCodes = () => {
    if (!result?.cartonItems) return;
    const textToCopy = result.cartonItems.join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }).catch(err => console.error('Tümünü kopyalama başarısız', err));
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', backgroundColor: 'var(--bg-primary)', padding: '20px'
      }}>
        <div style={{
          width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTop: '3px solid var(--primary)',
          borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px'
        }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Doğrulanıyor...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !result || !result.isFound) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', backgroundColor: 'var(--bg-primary)', padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '28px 24px', maxWidth: '420px', width: '100%',
          boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)', textAlign: 'center'
        }}>
          <AlertCircle size={40} color="var(--danger)" style={{ marginBottom: '12px' }} />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>Doğrulama Başarısız</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '20px', lineHeight: '1.5' }}>
            {error || 'Sorguladığınız koli sistemde bulunamadı.'}
          </p>
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Lider Kozmetik Track & Trace</span>
          </div>
        </div>
      </div>
    );
  }

  const isPallet = result.type === 'Pallet';
  const progressPercent = result.targetQuantity > 0 ? (result.actualQuantity / result.targetQuantity) * 100 : 0;

  return (
    <div style={{
      backgroundColor: 'var(--bg-primary)', minHeight: '100vh', padding: '24px 16px 48px',
      display: 'flex', flexDirection: 'column', alignItems: 'center'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <ShieldCheck size={20} color="var(--primary)" />
        <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '0.04em', color: 'var(--text-main)' }}>
          LİDER KOZMETİK DOĞRULAMA
        </span>
      </div>

      <div style={{ maxWidth: '480px', width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{
          backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '20px',
          boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
            <Package size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              {isPallet ? 'Palet Doğrulandı' : 'Koli Doğrulandı'}
            </h3>
            <span style={{
              marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px',
              borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--success-bg)', color: 'var(--success-text)',
              border: '1px solid var(--success-border)'
            }}>
              {result.status}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px dashed var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Sipariş No:</span>
              <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }} className="tabular-nums font-mono">{result.orderNo || '-'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px dashed var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Ürün:</span>
              <strong style={{ color: 'var(--text-main)', textAlign: 'right', maxWidth: '65%' }}>{result.productName || '-'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px dashed var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{isPallet ? 'Palet No:' : 'Koli No:'}</span>
              <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }} className="tabular-nums">{result.codeNo || '-'}</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>İçerik Miktarı:</span>
                <strong style={{ color: 'var(--text-main)' }} className="tabular-nums font-mono">{result.actualQuantity} / {result.targetQuantity} Adet</strong>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, progressPercent)}%`, backgroundColor: 'var(--primary)', transition: 'width 0.4s ease' }}></div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }} className="tabular-nums font-mono">
                %{Math.round(progressPercent)} Dolu
              </div>
            </div>
          </div>
        </div>

        {/* Content list card (Alt Alta Kodlar) */}
        {result.cartonItems && result.cartonItems.length > 0 && (
          <div style={{
            backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '18px',
            boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Barcode size={18} color="var(--success)" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                  İçerik <span className="tabular-nums font-mono" style={{ color: 'var(--text-muted)' }}>({result.cartonItems.length} {isPallet ? 'Koli' : 'Ürün'})</span>
                </h3>
              </div>
              <button 
                onClick={copyAllCodes}
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 600,
                  height: '28px', padding: '0 10px', borderRadius: 'var(--radius-xs)'
                }}
              >
                {copiedAll ? (
                  <>
                    <Check size={12} color="var(--success)" /> Kopyalandı
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Tümünü Kopyala
                  </>
                )}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {result.cartonItems.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-xs)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, marginRight: '10px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {isPallet ? 'Koli' : 'Ürün'} #{idx + 1}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 500,
                      color: 'var(--text-main)', wordBreak: 'break-all', lineHeight: '1.4'
                    }}>
                      {item}
                    </span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(item, idx)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      width: '28px', height: '28px', padding: 0,
                      borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0
                    }}
                    title="Kopyala"
                  >
                    {copiedIndex === idx ? (
                      <Check size={12} color="var(--success)" />
                    ) : (
                      <Copy size={12} color="var(--text-muted)" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '12px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          Lider Kozmetik Track & Trace Güvenli Doğrulama Sistemi
        </div>
      </div>
    </div>
  );
};
