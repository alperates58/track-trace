import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Package,
  QrCode,
  Search,
  XCircle
} from 'lucide-react';
import { CameraScanner } from '../components/CameraScanner';
import { api } from '../services/api';

interface QrRoutingResult {
  productCodeId: string;
  rawCode: string;
  gtin?: string | null;
  serialNo?: string | null;
  productCodeStatus: string;
  scannedAt?: string | null;
  orderId: string;
  orderNo: string;
  stockCode?: string | null;
  productName?: string | null;
  customerName: string;
  orderStatus: string;
  cartonId?: string | null;
  cartonNo?: string | null;
  cartonSscc?: string | null;
  cartonStatus?: string | null;
  stationName?: string | null;
  cartonActualQuantity?: number | null;
  cartonTargetQuantity?: number | null;
  isAssigned: boolean;
  routingStatus: 'Assigned' | 'ActiveTarget' | 'Ambiguous' | 'AwaitingCarton';
  routingMessage: string;
  candidateCartonCount: number;
}

interface LookupHistoryItem {
  id: string;
  result: QrRoutingResult;
  checkedAt: string;
}

const routingStyles: Record<QrRoutingResult['routingStatus'], { label: string; color: string; background: string; border: string }> = {
  Assigned: { label: 'KESİN KOLİ ATAMASI', color: '#047857', background: '#ecfdf5', border: '#a7f3d0' },
  ActiveTarget: { label: 'AKTİF HEDEF KOLİ', color: '#1d4ed8', background: '#eff6ff', border: '#bfdbfe' },
  Ambiguous: { label: 'İSTASYON KONTROLÜ GEREKLİ', color: '#b45309', background: '#fffbeb', border: '#fde68a' },
  AwaitingCarton: { label: 'AKTİF KOLİ BEKLENİYOR', color: '#b45309', background: '#fffbeb', border: '#fde68a' }
};

const statusLabels: Record<string, string> = {
  Uploaded: 'Henüz okutulmadı',
  Scanned: 'Okutuldu',
  Active: 'Aktif',
  Closed: 'Kapalı',
  Filling: 'Dolduruluyor',
  Open: 'Açık',
  PrePrinted: 'Ön etiketli',
  Printed: 'Etiket basıldı'
};

const displayStatus = (value?: string | null) => value ? statusLabels[value] || value : '-';

export const QrRoutingLookup: React.FC = () => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<QrRoutingResult | null>(null);
  const [history, setHistory] = useState<LookupHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const playFeedback = (success: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const context = new AudioCtx();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.type = success ? 'sine' : 'sawtooth';
      oscillator.frequency.setValueAtTime(success ? 720 : 180, context.currentTime);
      if (success) oscillator.frequency.setValueAtTime(980, context.currentTime + 0.08);
      gain.gain.setValueAtTime(0.11, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.22);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.22);
      oscillator.addEventListener('ended', () => void context.close());
    } catch {
      // Sound feedback is optional.
    }
  };

  const lookup = async (scannedCode?: string) => {
    const code = (scannedCode ?? input).trim();
    if (!code || isLoading) return;

    setInput('');
    setIsLoading(true);
    setError('');

    try {
      const response = await api.get(`/api/qr-verification/route?code=${encodeURIComponent(code)}`) as QrRoutingResult;
      setResult(response);
      setHistory(previous => [{
        id: `${Date.now()}-${response.productCodeId}`,
        result: response,
        checkedAt: new Date().toLocaleTimeString('tr-TR')
      }, ...previous].slice(0, 8));
      playFeedback(true);
    } catch (lookupError) {
      setResult(null);
      setError(lookupError instanceof Error ? lookupError.message : 'QR kodu sorgulanamadı.');
      playFeedback(false);
    } finally {
      setIsLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 60);
    }
  };

  const copyRawCode = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.rawCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const routingStyle = result ? routingStyles[result.routingStatus] : null;
  const progress = result?.cartonTargetQuantity
    ? Math.min(100, Math.round(((result.cartonActualQuantity || 0) / result.cartonTargetQuantity) * 100))
    : 0;

  return (
    <div style={{ padding: '20px 32px 40px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em' }}>QR Sipariş & Koli Bulucu</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Herhangi bir ürün QR kodunu okutun; sipariş, stok ve koli yönlendirmesini anında görün.
          </p>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--radius-xs)', background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success-text)', fontSize: '0.75rem', fontWeight: 600 }}>
          <CheckCircle2 size={13} /> Salt Okunur Sorgu
        </div>
      </div>

      <section style={{ 
        padding: 20, 
        borderRadius: 'var(--radius-lg)', 
        background: 'var(--bg-card)', 
        border: '1px solid var(--border-color)', 
        boxShadow: 'var(--shadow-sm)', 
        marginBottom: 20 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 'var(--radius-sm)' }}>
            <QrCode size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.925rem', color: 'var(--text-main)' }}>QR Kodunu Okutun veya Girin</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 1 }}>El terminali, USB okuyucu veya dahili kamera ile sorgulama yapabilirsiniz.</div>
          </div>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void lookup(); }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 480px' }}>
            <Search size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              ref={inputRef}
              data-testid="qr-route-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isLoading}
              placeholder="Ürün QR / DataMatrix kodu..."
              aria-label="Yönlendirilecek ürün QR kodu"
              autoComplete="off"
              className="form-input"
              style={{ width: '100%', height: 44, borderRadius: 'var(--radius-sm)', padding: '0 40px 0 42px', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
            {input && (
              <button type="button" aria-label="QR girişini temizle" onClick={() => { setInput(''); inputRef.current?.focus(); }} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                <XCircle size={16} />
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCameraOpen(true)}
            style={{ height: 44, padding: '0 16px', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500, fontSize: '0.85rem' }}
          >
            <Camera size={16} /> Kamera
          </button>
          <button
            type="submit"
            data-testid="qr-route-submit"
            className="btn btn-primary"
            disabled={isLoading || !input.trim()}
            style={{ height: 44, padding: '0 20px', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem' }}
          >
            {isLoading ? <Clock3 size={16} className="animate-spin" /> : <Search size={16} />}
            {isLoading ? 'Sorgulanıyor' : 'Hedefi Bul'}
          </button>
        </form>
      </section>

      {error && (
        <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', marginBottom: 20, borderRadius: 'var(--radius-md)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', fontSize: '0.85rem' }}>
          <XCircle size={18} style={{ flexShrink: 0 }} />
          <div><strong>QR bulunamadı.</strong> <span style={{ marginLeft: 4 }}>{error}</span></div>
        </div>
      )}

      {result && routingStyle && (
        <div data-testid="qr-route-result">
          <section style={{ borderRadius: 'var(--radius-md)', border: `1px solid ${routingStyle.border}`, background: routingStyle.background, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              {result.routingStatus === 'Assigned' || result.routingStatus === 'ActiveTarget'
                ? <CheckCircle2 size={22} color={routingStyle.color} />
                : <AlertTriangle size={22} color={routingStyle.color} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.7rem', letterSpacing: '.06em', fontWeight: 800, color: routingStyle.color }}>{routingStyle.label}</div>
                <div style={{ marginTop: 2, color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem' }}>{result.routingMessage}</div>
              </div>
              {result.candidateCartonCount > 1 && (
                <span className="tabular-nums font-mono" style={{ padding: '3px 8px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-card)', color: routingStyle.color, fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${routingStyle.border}` }}>
                  {result.candidateCartonCount} aday koli
                </span>
              )}
            </div>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'stretch', gap: 10, marginBottom: 16 }}>
            <RouteCard eyebrow="SİPARİŞ" primary={result.orderNo} secondary={result.customerName} footer={`Durum: ${displayStatus(result.orderStatus)}`} />
            <RouteArrow />
            <RouteCard eyebrow="STOK" primary={result.stockCode || '-'} secondary={result.productName || 'Ürün adı bulunmuyor'} footer={`GTIN: ${result.gtin || '-'}`} />
            <RouteArrow />
            <RouteCard
              eyebrow={result.isAssigned ? 'ATANMIŞ KOLİ' : 'HEDEF KOLİ'}
              primary={result.cartonNo || (result.routingStatus === 'Ambiguous' ? 'İstasyon seçilmeli' : 'Henüz belirlenmedi')}
              secondary={result.stationName || (result.cartonNo ? 'İstasyon bilgisi yok' : 'Aktif koli bekleniyor')}
              footer={`Durum: ${displayStatus(result.cartonStatus)}`}
              accent={Boolean(result.cartonNo)}
            />
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={panelStyle}>
              <div style={panelTitleStyle}><QrCode size={16} /> Ürün QR Bilgisi</div>
              <DetailRow label="Kod durumu" value={displayStatus(result.productCodeStatus)} />
              <DetailRow label="Seri numarası" value={result.serialNo || '-'} mono />
              <DetailRow label="GTIN" value={result.gtin || '-'} mono />
              <DetailRow label="Okutma zamanı" value={result.scannedAt ? new Date(result.scannedAt).toLocaleString('tr-TR') : 'Henüz okutulmadı'} />
              <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-subtle)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <code style={{ flex: 1, color: 'var(--text-main)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{result.rawCode}</code>
                <button type="button" aria-label="QR kodunu kopyala" onClick={() => void copyRawCode()} style={{ border: 0, background: 'transparent', color: copied ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div style={panelStyle}>
              <div style={panelTitleStyle}><Package size={16} /> Koli Operasyonu</div>
              <DetailRow label="Koli numarası" value={result.cartonNo || '-'} mono />
              <DetailRow label="SSCC" value={result.cartonSscc || '-'} mono />
              <DetailRow label="İstasyon" value={result.stationName || '-'} />
              <DetailRow label="Atama türü" value={result.isAssigned ? 'Kesin atama' : result.routingStatus === 'ActiveTarget' ? 'Aktif hedef önerisi' : 'Atama bekleniyor'} />
              {result.cartonTargetQuantity ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                    <span>Koli doluluğu</span>
                    <strong style={{ color: 'var(--text-main)' }} className="tabular-nums font-mono">{result.cartonActualQuantity || 0} / {result.cartonTargetQuantity}</strong>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', borderRadius: 3, transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-subtle)', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  Koli açıldığında doluluk bilgisi burada gösterilir.
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {!result && !error && (
        <div style={{ minHeight: 180, display: 'grid', placeItems: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface-subtle)', color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
          <div>
            <QrCode size={36} color="var(--text-muted)" style={{ opacity: 0.7 }} />
            <div style={{ marginTop: 8, fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>Okutma İçin Hazır</div>
            <div style={{ marginTop: 2, fontSize: '0.8rem' }}>Sonuçlar veritabanında değişiklik yapılmadan salt-okunur gösterilir.</div>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <section style={{ marginTop: 20, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>Son Sorgular</div>
          {history.map(item => (
            <button key={item.id} type="button" onClick={() => setResult(item.result)} style={{ width: '100%', padding: '10px 16px', border: 0, borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', display: 'grid', gridTemplateColumns: 'minmax(180px,1.4fr) minmax(130px,1fr) minmax(150px,1fr) 80px', gap: 12, textAlign: 'left', cursor: 'pointer', alignItems: 'center' }}>
              <code style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{item.result.rawCode}</code>
              <strong style={{ color: 'var(--text-main)', fontSize: '0.8rem' }} className="tabular-nums font-mono">{item.result.orderNo}</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }} className="tabular-nums font-mono">{item.result.cartonNo || 'Koli bekleniyor'}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'right' }} className="tabular-nums">{item.checkedAt}</span>
            </button>
          ))}
        </section>
      )}

      {cameraOpen && (
        <CameraScanner
          isOpen={cameraOpen}
          defaultContinuous={false}
          onClose={() => setCameraOpen(false)}
          onScan={(code) => {
            setCameraOpen(false);
            void lookup(code);
          }}
        />
      )}
    </div>
  );
};

const panelStyle: React.CSSProperties = { padding: 16, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' };
const panelTitleStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)', marginBottom: 10 };

const DetailRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '6px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    <strong style={{ color: 'var(--text-main)', textAlign: 'right', fontFamily: mono ? 'var(--font-mono)' : undefined, wordBreak: 'break-all' }} className={mono ? 'tabular-nums' : undefined}>{value}</strong>
  </div>
);

const RouteCard: React.FC<{ eyebrow: string; primary: string; secondary: string; footer: string; accent?: boolean }> = ({ eyebrow, primary, secondary, footer, accent }) => (
  <div style={{ 
    padding: 14, 
    borderRadius: 'var(--radius-md)', 
    border: `1px solid ${accent ? 'var(--primary)' : 'var(--border-color)'}`, 
    background: accent ? 'var(--primary-light)' : 'var(--bg-card)', 
    minWidth: 0 
  }}>
    <div style={{ color: accent ? 'var(--primary)' : 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '.06em' }}>{eyebrow}</div>
    <div style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 700, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-mono)' }} title={primary} className="tabular-nums">{primary}</div>
    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 3, minHeight: 18 }}>{secondary}</div>
    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: 6 }}>{footer}</div>
  </div>
);

const RouteArrow: React.FC = () => (
  <div style={{ display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}><ArrowRight size={18} /></div>
);

export default QrRoutingLookup;

