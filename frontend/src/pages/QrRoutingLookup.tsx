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
    <div style={{ padding: '16px 32px 32px', maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', letterSpacing: '-0.02em' }}>QR Sipariş & Koli Bulucu</h1>
          <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Herhangi bir ürün QR kodunu okutun; sipariş, stok ve koli yönlendirmesini anında görün.
          </p>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 11px', borderRadius: 999, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.78rem', fontWeight: 700 }}>
          <CheckCircle2 size={15} /> Salt okunur sorgu
        </div>
      </div>

      <section style={{ padding: 22, borderRadius: 16, background: 'linear-gradient(135deg, #0f172a 0%, #172554 100%)', boxShadow: '0 16px 36px rgba(15,23,42,.16)', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff', marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.12)', borderRadius: 10 }}>
            <QrCode size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 800 }}>QR kodunu okutun</div>
            <div style={{ color: '#cbd5e1', fontSize: '0.78rem', marginTop: 2 }}>El terminali, USB okuyucu veya kamera kullanabilirsiniz.</div>
          </div>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void lookup(); }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 520px' }}>
            <Search size={20} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              ref={inputRef}
              data-testid="qr-route-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isLoading}
              placeholder="Ürün QR / DataMatrix kodu..."
              aria-label="Yönlendirilecek ürün QR kodu"
              autoComplete="off"
              style={{ width: '100%', height: 52, borderRadius: 11, border: '2px solid transparent', padding: '0 48px', fontFamily: 'Consolas, monospace', fontSize: '0.98rem', outline: 'none', boxSizing: 'border-box' }}
            />
            {input && (
              <button type="button" aria-label="QR girişini temizle" onClick={() => { setInput(''); inputRef.current?.focus(); }} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                <XCircle size={18} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            style={{ height: 52, padding: '0 17px', borderRadius: 11, border: '1px solid rgba(255,255,255,.28)', background: 'rgba(255,255,255,.1)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700 }}
          >
            <Camera size={19} /> Kamera
          </button>
          <button
            type="submit"
            data-testid="qr-route-submit"
            disabled={isLoading || !input.trim()}
            style={{ height: 52, padding: '0 22px', borderRadius: 11, border: 0, background: isLoading || !input.trim() ? '#64748b' : '#2563eb', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer', fontWeight: 800 }}
          >
            {isLoading ? <Clock3 size={19} /> : <Search size={19} />}
            {isLoading ? 'Sorgulanıyor' : 'Hedefi Bul'}
          </button>
        </form>
      </section>

      {error && (
        <div role="alert" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '15px 17px', marginBottom: 22, borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
          <XCircle size={22} style={{ flexShrink: 0 }} />
          <div><strong>QR bulunamadı.</strong><div style={{ marginTop: 2, fontSize: '0.84rem' }}>{error}</div></div>
        </div>
      )}

      {result && routingStyle && (
        <div data-testid="qr-route-result">
          <section style={{ borderRadius: 16, border: `1px solid ${routingStyle.border}`, background: routingStyle.background, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              {result.routingStatus === 'Assigned' || result.routingStatus === 'ActiveTarget'
                ? <CheckCircle2 size={26} color={routingStyle.color} />
                : <AlertTriangle size={26} color={routingStyle.color} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.72rem', letterSpacing: '.08em', fontWeight: 900, color: routingStyle.color }}>{routingStyle.label}</div>
                <div style={{ marginTop: 3, color: '#0f172a', fontWeight: 700 }}>{result.routingMessage}</div>
              </div>
              {result.candidateCartonCount > 1 && (
                <span style={{ padding: '5px 9px', borderRadius: 999, background: '#fff', color: routingStyle.color, fontSize: '0.75rem', fontWeight: 800 }}>{result.candidateCartonCount} aday koli</span>
              )}
            </div>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'stretch', gap: 12, marginBottom: 20 }}>
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
              <div style={panelTitleStyle}><QrCode size={17} /> Ürün QR bilgisi</div>
              <DetailRow label="Kod durumu" value={displayStatus(result.productCodeStatus)} />
              <DetailRow label="Seri numarası" value={result.serialNo || '-'} mono />
              <DetailRow label="GTIN" value={result.gtin || '-'} mono />
              <DetailRow label="Okutma zamanı" value={result.scannedAt ? new Date(result.scannedAt).toLocaleString('tr-TR') : 'Henüz okutulmadı'} />
              <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: '#f8fafc', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <code style={{ flex: 1, color: '#334155', fontSize: '0.75rem', wordBreak: 'break-all' }}>{result.rawCode}</code>
                <button type="button" aria-label="QR kodunu kopyala" onClick={() => void copyRawCode()} style={{ border: 0, background: 'transparent', color: copied ? '#059669' : '#64748b', cursor: 'pointer' }}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div style={panelStyle}>
              <div style={panelTitleStyle}><Package size={17} /> Koli operasyonu</div>
              <DetailRow label="Koli numarası" value={result.cartonNo || '-'} mono />
              <DetailRow label="SSCC" value={result.cartonSscc || '-'} mono />
              <DetailRow label="İstasyon" value={result.stationName || '-'} />
              <DetailRow label="Atama türü" value={result.isAssigned ? 'Kesin atama' : result.routingStatus === 'ActiveTarget' ? 'Aktif hedef önerisi' : 'Atama bekleniyor'} />
              {result.cartonTargetQuantity ? (
                <div style={{ marginTop: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: 6 }}>
                    <span>Koli doluluğu</span><strong style={{ color: '#0f172a' }}>{result.cartonActualQuantity || 0} / {result.cartonTargetQuantity}</strong>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', background: '#2563eb', borderRadius: 999 }} /></div>
                </div>
              ) : (
                <div style={{ marginTop: 13, padding: 10, borderRadius: 8, background: '#f8fafc', color: '#64748b', fontSize: '0.8rem' }}>Koli açıldığında doluluk bilgisi burada gösterilir.</div>
              )}
            </div>
          </section>
        </div>
      )}

      {!result && !error && (
        <div style={{ minHeight: 190, display: 'grid', placeItems: 'center', border: '1px dashed #cbd5e1', borderRadius: 16, background: '#f8fafc', color: '#64748b', textAlign: 'center', padding: 24 }}>
          <div><QrCode size={44} color="#94a3b8" /><div style={{ marginTop: 10, fontWeight: 800, color: '#334155' }}>Okutma için hazır</div><div style={{ marginTop: 4, fontSize: '0.84rem' }}>Sonuçlar veritabanında değişiklik yapılmadan gösterilir.</div></div>
        </div>
      )}

      {history.length > 0 && (
        <section style={{ marginTop: 20, border: '1px solid #e2e8f0', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '13px 17px', borderBottom: '1px solid #e2e8f0', fontWeight: 800, color: '#0f172a' }}>Son sorgular</div>
          {history.map(item => (
            <button key={item.id} type="button" onClick={() => setResult(item.result)} style={{ width: '100%', padding: '12px 17px', border: 0, borderBottom: '1px solid #f1f5f9', background: '#fff', display: 'grid', gridTemplateColumns: 'minmax(180px,1.4fr) minmax(130px,1fr) minmax(150px,1fr) 80px', gap: 12, textAlign: 'left', cursor: 'pointer', alignItems: 'center' }}>
              <code style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#334155', fontSize: '0.76rem' }}>{item.result.rawCode}</code>
              <strong style={{ color: '#0f172a', fontSize: '0.82rem' }}>{item.result.orderNo}</strong>
              <span style={{ color: '#475569', fontSize: '0.82rem' }}>{item.result.cartonNo || 'Koli bekleniyor'}</span>
              <span style={{ color: '#94a3b8', fontSize: '0.76rem', textAlign: 'right' }}>{item.checkedAt}</span>
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

const panelStyle: React.CSSProperties = { padding: 18, border: '1px solid #e2e8f0', borderRadius: 14, background: '#fff' };
const panelTitleStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#0f172a', marginBottom: 13 };

const DetailRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.8rem' }}>
    <span style={{ color: '#64748b' }}>{label}</span>
    <strong style={{ color: '#1e293b', textAlign: 'right', fontFamily: mono ? 'Consolas, monospace' : undefined, wordBreak: 'break-all' }}>{value}</strong>
  </div>
);

const RouteCard: React.FC<{ eyebrow: string; primary: string; secondary: string; footer: string; accent?: boolean }> = ({ eyebrow, primary, secondary, footer, accent }) => (
  <div style={{ padding: 18, borderRadius: 14, border: `1px solid ${accent ? '#93c5fd' : '#e2e8f0'}`, background: accent ? '#eff6ff' : '#fff', minWidth: 0 }}>
    <div style={{ color: accent ? '#1d4ed8' : '#64748b', fontSize: '0.68rem', fontWeight: 900, letterSpacing: '.08em' }}>{eyebrow}</div>
    <div style={{ color: '#0f172a', fontSize: '1.05rem', fontWeight: 900, marginTop: 7, overflow: 'hidden', textOverflow: 'ellipsis' }} title={primary}>{primary}</div>
    <div style={{ color: '#475569', fontSize: '0.8rem', marginTop: 5, minHeight: 20 }}>{secondary}</div>
    <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: 10 }}>{footer}</div>
  </div>
);

const RouteArrow: React.FC = () => (
  <div style={{ display: 'grid', placeItems: 'center', color: '#94a3b8' }}><ArrowRight size={22} /></div>
);

export default QrRoutingLookup;
