import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { Volume2, VolumeX, Barcode } from 'lucide-react';

interface ActiveOrder {
  id: string;
  orderNo: string;
  customerName: string;
  stockCode: string;
  productName: string;
  gtin: string;
  productPerCarton: number;
  expectedQuantity: number;
  scannedCount: number;
}

interface ScanHistory {
  rawCode: string;
  gtin: string;
  serialNo: string;
  status: string;
  timestamp: string;
}

export const Scan: React.FC = () => {
  // Orders
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [selectedOrderNo, setSelectedOrderNo] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<ActiveOrder | null>(null);

  // Hidden input focus logic
  const inputRef = useRef<HTMLInputElement>(null);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Scan state
  const [status, setStatus] = useState<'ready' | 'success' | 'warning' | 'error'>('ready');
  const [indicatorTitle, setIndicatorTitle] = useState('OKUTMA BEKLENİYOR');
  const [indicatorMsg, setIndicatorMsg] = useState('Lütfen bir sipariş seçip barkod okutun.');
  
  // Progress State
  const [cartonNo, setCartonNo] = useState<string | null>(null);
  const [cartonSSCC, setCartonSSCC] = useState<string | null>(null);
  const [currentQty, setCurrentQty] = useState(0);
  const [targetQty, setTargetQty] = useState(0);
  const [completedCartons, setCompletedCartons] = useState(0);
  const [totalScanned, setTotalScanned] = useState(0);

  // History logs
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Load Active Orders
  useEffect(() => {
    api.get('/api/orders?pageSize=100&status=Active')
      .then(res => {
        setActiveOrders(res.items);
      })
      .catch(console.error);
  }, []);

  // Handle Order Select
  useEffect(() => {
    if (selectedOrderId) {
      const order = activeOrders.find(o => o.id === selectedOrderId) || null;
      setSelectedOrder(order);
      
      // Fetch current progress from backend
      api.get(`/api/scan/current-carton?orderId=${selectedOrderId}`)
        .then(res => {
          setCartonNo(res.cartonNo);
          setCartonSSCC(res.sscc);
          setCurrentQty(res.cartonCurrentQty);
          setTargetQty(res.cartonTargetQty);
          setCompletedCartons(res.completedCartonsCount);
          setTotalScanned(res.totalScannedCount);
        })
        .catch(err => {
          console.error(err);
          setCartonNo(null);
          setCartonSSCC(null);
          setCurrentQty(0);
          setTargetQty(order?.productPerCarton || 0);
          setCompletedCartons(0);
          setTotalScanned(0);
        });

      setScanHistory([]);
      setStatus('ready');
      setIndicatorTitle('OKUTMAYA HAZIR');
      setIndicatorMsg(`İş Emri No: ${order?.gtin} için barkod okutma moduna geçildi.`);
      focusInput();
    } else {
      setSelectedOrder(null);
      setCartonNo(null);
      setCartonSSCC(null);
      setCurrentQty(0);
      setTargetQty(0);
      setCompletedCartons(0);
      setTotalScanned(0);
      setScanHistory([]);
      setStatus('ready');
      setIndicatorTitle('OKUTMA BEKLENİYOR');
      setIndicatorMsg('Lütfen bir sipariş seçip barkod okutun.');
    }
  }, [selectedOrderId]);

  // Keep focus on hidden input
  useEffect(() => {
    focusInput();
    const interval = setInterval(focusInput, 1500); // periodically enforce focus
    return () => clearInterval(interval);
  }, [selectedOrderId]);

  const focusInput = () => {
    // Do not steal focus if user is actively focusing a select dropdown or other controls
    const active = document.activeElement;
    if (active && (
      active.tagName === 'SELECT' || 
      active.tagName === 'BUTTON' || 
      (active.tagName === 'INPUT' && !active.classList.contains('hidden-input'))
    )) {
      return;
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Sound generator using Web Audio API (Synthesizer beep sounds)
  const playSound = (type: 'success' | 'error' | 'warning') => {
    if (!soundEnabled) return;

    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      
      if (type === 'success') {
        // High pitch short beep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, ctx.currentTime); // 1000Hz
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'error') {
        // Low pitch longer buzzer sound
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(150, ctx.currentTime);
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(155, ctx.currentTime); // detuned for fat buzzer effect
        
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.5);
        osc2.stop(ctx.currentTime + 0.5);
      } else {
        // Warning sound (dual alternating alert beep)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn("Web Audio API failed to initialize", e);
    }
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    setBarcodeInput(''); // clear immediately

    if (!selectedOrderId) {
      playSound('warning');
      setStatus('warning');
      setIndicatorTitle('SİPARİŞ SEÇİLMEDİ');
      setIndicatorMsg('Lütfen barkod okutmadan önce yukarıdan aktif bir sipariş seçin.');
      return;
    }

    try {
      const res = await api.post('/api/scan/product', { orderId: selectedOrderId, rawCode: code });
      
      if (res.success) {
        playSound('success');
        setStatus('success');
        
        setCartonNo(res.cartonNo);
        setCartonSSCC(res.sscc);
        setCurrentQty(res.cartonCurrentQty);
        setTargetQty(res.cartonTargetQty);
        setTotalScanned(prev => prev + 1);

        if (res.status === 'CartonClosed') {
          setIndicatorTitle('KOLİ KAPATILDI');
          setIndicatorMsg(`Koli tamamlandı! Yeni koliye geçiliyor. SSCC: ${res.sscc}`);
          setCompletedCartons(prev => prev + 1);
        } else {
          setIndicatorTitle('OKUTMA BAŞARILI');
          setIndicatorMsg(`Barkod: ${res.serialNo || code}`);
        }

        // Add to history list (max 10)
        setScanHistory(prev => [
          {
            rawCode: code,
            gtin: res.gtin || '',
            serialNo: res.serialNo || '',
            status: 'Başarılı',
            timestamp: new Date().toLocaleTimeString('tr-TR')
          },
          ...prev.slice(0, 9)
        ]);

        // Increment overall order count in client view
        if (selectedOrder) {
          setSelectedOrder({
            ...selectedOrder,
            scannedCount: selectedOrder.scannedCount + 1
          });
        }
      } else {
        // Fail cases returned in request structure (should not happen normally but handled)
        handleScanError(code, res.message || 'Hatalı okutma.');
      }
    } catch (err: any) {
      handleScanError(code, err.message || 'Bağlantı hatası.');
    }
  };

  const handleScanError = (code: string, errorMsg: string) => {
    playSound('error');
    setStatus('error');
    setIndicatorTitle('OKUTMA HATASI');
    setIndicatorMsg(errorMsg);

    setScanHistory(prev => [
      {
        rawCode: code,
        gtin: '',
        serialNo: '',
        status: 'Hata',
        timestamp: new Date().toLocaleTimeString('tr-TR')
      },
      ...prev.slice(0, 9)
    ]);
  };

  const progressPercent = targetQty > 0 ? (currentQty / targetQty) * 100 : 0;

  return (
    <div className="scan-layout" onClick={focusInput}>
      
      {/* Top configuration and sound settings */}
      <div className="scan-top-bar" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', width: '100%', maxWidth: 'none' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Barcode size={24} color="var(--primary)" />
            Ürün Okutma Terminali
          </span>
          <select
            className="form-input"
            style={{ width: '100%', maxWidth: '250px', height: '40px', fontWeight: 600 }}
            value={selectedOrderNo}
            onChange={(e) => {
              setSelectedOrderNo(e.target.value);
              setSelectedOrderId('');
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="">-- SİPARİŞ NO SEÇİN --</option>
            {Array.from(new Set(activeOrders.map(o => o.orderNo))).map(orderNo => {
              const customerName = activeOrders.find(o => o.orderNo === orderNo)?.customerName || '';
              return (
                <option key={orderNo} value={orderNo}>
                  {orderNo} - {customerName}
                </option>
              );
            })}
          </select>

          {selectedOrderNo && (
            <select
              className="form-input"
              style={{ width: '100%', maxWidth: '350px', height: '40px', fontWeight: 600 }}
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">-- ÜRÜN / STOK KODU SEÇİN --</option>
              {activeOrders
                .filter(o => o.orderNo === selectedOrderNo)
                .map(o => (
                  <option key={o.id} value={o.id}>
                    {o.stockCode} - {o.productName} ({o.scannedCount}/{o.expectedQuantity})
                  </option>
                ))}
            </select>
          )}
        </div>

        <button
          className="btn btn-secondary"
          onClick={(e) => { e.stopPropagation(); setSoundEnabled(!soundEnabled); }}
          style={{ width: '120px', height: '40px' }}
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          {soundEnabled ? 'Ses Açık' : 'Ses Kapalı'}
        </button>
      </div>

      {/* Main Body Grid */}
      <div className="scan-body">
        
        {/* Left Side: Giant Display and progress details */}
        <div className="scan-left">
          
          {/* Main Giant Banner */}
          <div className={`status-indicator ${status}`}>
            <h1 className="indicator-title">{indicatorTitle}</h1>
            <p className="indicator-message">{indicatorMsg}</p>
            
            {/* Tiny simulator instructions */}
            <span style={{ position: 'absolute', bottom: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              (Scanner klavye emülatörü modundadır. Mouse kullanmadan direk okutun veya yazıp Enter'a basın.)
            </span>
          </div>

          {/* Hidden Form to capture keyboard inputs */}
          <form onSubmit={handleScanSubmit}>
            <input
              ref={inputRef}
              type="text"
              className="hidden-input"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
            />
          </form>

          {/* Carton Progress card */}
          {selectedOrder && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
              {/* Overall Order Progress */}
              <div className="card" style={{ padding: '20px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', color: '#6b21a8', margin: 0 }}>Genel Sipariş İlerleme Durumu</h3>
                    <span style={{ fontSize: '0.85rem', color: '#701a75', fontWeight: 500, marginTop: '4px', display: 'inline-block' }}>
                      Tamamlanan Koli Sayısı: <strong style={{ fontSize: '0.95rem', color: 'var(--primary)' }}>{completedCartons} koli</strong>
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#6b21a8' }}>{totalScanned}</span>
                    <span style={{ color: '#701a75', fontWeight: 500 }}> / {selectedOrder.expectedQuantity} adet</span>
                  </div>
                </div>
                <div className="progress-container" style={{ backgroundColor: '#f3e8ff', marginTop: '12px' }}>
                  <div className="progress-bar" style={{ width: `${selectedOrder.expectedQuantity > 0 ? (totalScanned / selectedOrder.expectedQuantity) * 100 : 0}%`, backgroundColor: '#8b5cf6' }}></div>
                  <span className="progress-text" style={{ color: '#581c87' }}>
                    {Math.round(selectedOrder.expectedQuantity > 0 ? (totalScanned / selectedOrder.expectedQuantity) * 100 : 0)}% Sipariş Tamamlandı
                  </span>
                </div>
              </div>

              {/* Active Carton Progress */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Aktif Koli İlerleme Durumu</h3>
                    {cartonNo ? (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', display: 'inline-block' }}>
                        Koli No: <strong>{cartonNo}</strong> | SSCC: <code>{cartonSSCC}</code>
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', display: 'inline-block' }}>Okutma başlatılınca otomatik koli açılacaktır.</span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{currentQty}</span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> / {targetQty} adet</span>
                  </div>
                </div>

                <div className="progress-container" style={{ marginTop: '12px' }}>
                  <div className="progress-bar" style={{ width: `${progressPercent}%` }}></div>
                  <span className="progress-text">{Math.round(progressPercent)}% Doluluk</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Scan History List */}
        <div className="scan-right">
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            Okutma Geçmişi (Son 10)
          </h3>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {scanHistory.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', gap: '10px' }}>
                <Barcode size={32} />
                <p style={{ fontSize: '0.85rem' }}>Bu oturumda henüz okuma yapılmadı.</p>
              </div>
            ) : (
              scanHistory.map((item, idx) => (
                <div key={idx} className="history-item" style={{
                  borderLeft: `4px solid ${item.status === 'Başarılı' ? 'var(--success)' : 'var(--danger)'}`,
                  backgroundColor: item.status === 'Başarılı' ? '#f8fafc' : 'var(--danger-bg)',
                  marginBottom: '8px',
                  borderRadius: '4px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '75%' }}>
                    <code style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.rawCode}>
                      {item.rawCode}
                    </code>
                    {item.serialNo && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        S/N: {item.serialNo}
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: item.status === 'Başarılı' ? 'var(--success-text)' : 'var(--danger-text)'
                    }}>
                      {item.status}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.timestamp}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
