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
        minHeight: '100vh', backgroundColor: '#f8fafc', padding: '20px'
      }}>
        <div style={{
          width: '50px', height: '50px', border: '4px solid #e2e8f0', borderTop: '4px solid #2563eb',
          borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px'
        }} />
        <p style={{ color: '#64748b', fontFamily: 'var(--font-primary)' }}>Doğrulanıyor...</p>
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
        minHeight: '100vh', backgroundColor: '#f8fafc', padding: '20px', fontFamily: 'var(--font-primary)'
      }}>
        <div style={{
          backgroundColor: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '440px', width: '100%',
          boxShadow: 'var(--shadow-lg)', border: '1px solid #e2e8f0', textAlign: 'center'
        }}>
          <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: '#0f172a' }}>Doğrulama Başarısız</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '24px', lineHeight: '1.5' }}>
            {error || 'Sorguladığınız koli sistemde bulunamadı.'}
          </p>
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Lider Kozmetik Track & Trace</span>
          </div>
        </div>
      </div>
    );
  }

  const isPallet = result.type === 'Pallet';
  const progressPercent = result.targetQuantity > 0 ? (result.actualQuantity / result.targetQuantity) * 100 : 0;

  return (
    <div style={{
      backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px 16px 40px 16px',
      fontFamily: 'var(--font-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', marginTop: '8px' }}>
        <ShieldCheck size={24} color="var(--primary)" />
        <span style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '0.5px', color: '#0f172a', fontFamily: 'var(--font-display)' }}>
          LİDER KOZMETİK DOĞRULAMA
        </span>
      </div>

      <div style={{ maxWidth: '480px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{
          backgroundColor: '#fff', borderRadius: '16px', padding: '24px',
          boxShadow: 'var(--shadow-md)', border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
            <Package size={24} color="var(--primary)" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {isPallet ? 'Palet Doğrulandı' : 'Koli Doğrulandı'}
            </h3>
            <span style={{
              marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 700, padding: '6px 12px',
              borderRadius: '9999px', backgroundColor: 'var(--success-bg)', color: 'var(--success-text)'
            }}>
              {result.status}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.95rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px dashed #e2e8f0' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Sipariş No:</span>
              <strong style={{ color: '#0f172a', fontSize: '1.05rem' }}>{result.orderNo || '-'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px dashed #e2e8f0' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Ürün:</span>
              <strong style={{ color: '#0f172a', textAlign: 'right', maxWidth: '60%' }}>{result.productName || '-'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px dashed #e2e8f0' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>{isPallet ? 'Palet No:' : 'Koli No:'}</span>
              <strong style={{ color: '#0f172a', fontFamily: 'monospace', fontSize: '1.1rem' }}>{result.codeNo || '-'}</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>İçerik Miktarı:</span>
                <strong style={{ color: '#0f172a' }}>{result.actualQuantity} / {result.targetQuantity} Adet</strong>
              </div>
              <div style={{ width: '100%', height: '10px', backgroundColor: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, progressPercent)}%`, backgroundColor: '#3b82f6', transition: 'width 0.5s ease' }}></div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                {Math.round(progressPercent)}% Dolu
              </div>
            </div>
          </div>
        </div>

        {/* Content list card (Alt Alta Kodlar) */}
        {result.cartonItems && result.cartonItems.length > 0 && (
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px', padding: '20px',
            boxShadow: 'var(--shadow-md)', border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Barcode size={20} color="var(--success)" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  İçerik ({result.cartonItems.length} {isPallet ? 'Koli' : 'Ürün'})
                </h3>
              </div>
              <button 
                onClick={copyAllCodes}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600,
                  color: 'var(--primary)', border: '1px solid #e2e8f0', backgroundColor: 'transparent',
                  padding: '6px 12px', borderRadius: '8px', cursor: 'pointer'
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {result.cartonItems.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: '10px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, marginRight: '12px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8' }}>
                      {isPallet ? 'Koli' : 'Ürün'} #{idx + 1}
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

        <div style={{ textAlign: 'center', marginTop: '16px', color: '#94a3b8', fontSize: '0.85rem' }}>
          Lider Kozmetik Track & Trace Güvenli Doğrulama Sistemi
        </div>
      </div>
    </div>
  );
};
