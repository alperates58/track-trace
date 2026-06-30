import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { getPrintProvider } from '../services/printProvider';
import { useAuth } from '../context/AuthContext';
import { Volume2, VolumeX, Barcode, Printer } from 'lucide-react';

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
  cartonNo: string;
}

export const Scan: React.FC = () => {
  const { user } = useAuth();

  // Orders lists
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [selectedOrderNo, setSelectedOrderNo] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<ActiveOrder | null>(null);

  // Hidden input focus logic
  const inputRef = useRef<HTMLInputElement>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Scan state
  const [status, setStatus] = useState<'ready' | 'success' | 'error' | 'cartonClosed'>('ready');
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Active carton details
  const [cartonNo, setCartonNo] = useState<string | null>(null);
  const [cartonSSCC, setCartonSSCC] = useState<string | null>(null);
  const [currentQty, setCurrentQty] = useState(0);
  const [targetQty, setTargetQty] = useState(0);
  const [completedCartons, setCompletedCartons] = useState(0);
  const [totalScanned, setTotalScanned] = useState(0);

  // Last closed carton details (for label reprint & ZPL)
  const [lastClosedCartonId, setLastClosedCartonId] = useState<string | null>(null);
  const [lastClosedCartonNo, setLastClosedCartonNo] = useState<string | null>(null);
  const [lastClosedCartonSSCC, setLastClosedCartonSSCC] = useState<string | null>(null);

  // History & settings
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  const [printMode, setPrintMode] = useState<string>('kiosk');
  const [autoPrintEnabled, setAutoPrintEnabled] = useState<boolean>(true);

  useEffect(() => {
    const loadSettings = async () => {
      let activeMode = 'kiosk';
      let activeAutoPrint = true;

      const localSettings = localStorage.getItem('trackTrace_printSettings');
      if (localSettings) {
        try {
          const parsed = JSON.parse(localSettings);
          activeMode = parsed.printMode === 'browser' ? 'kiosk' : (parsed.printMode === 'agent' ? 'network' : parsed.printMode);
          activeAutoPrint = parsed.autoPrintCarton !== false;
        } catch (e) {}
      } else {
        try {
          const res = await api.get('/api/settings/GlobalPrintConfig');
          if (res && res.value) {
            const parsed = JSON.parse(res.value);
            activeMode = parsed.printMode === 'browser' ? 'kiosk' : (parsed.printMode === 'agent' ? 'network' : parsed.printMode);
            activeAutoPrint = parsed.autoPrintCarton !== false;
          }
        } catch (e) {}
      }

      setPrintMode(activeMode);
      setAutoPrintEnabled(activeAutoPrint);
    };
    loadSettings();
  }, []);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testMessage, setTestMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isReprinting, setIsReprinting] = useState(false);

  // Check API health status
  useEffect(() => {
    const checkHealth = () => {
      api.get('/health')
        .then(res => {
          setIsOnline(res && res.status === 'Healthy');
        })
        .catch(() => {
          setIsOnline(false);
        });
    };
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

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

      // Fetch last closed carton to pre-populate printing options
      api.get(`/api/cartons?orderId=${selectedOrderId}&status=Closed&pageSize=1&pageNumber=1`)
        .then(res => {
          if (res.items && res.items.length > 0) {
            const lastCarton = res.items[0];
            setLastClosedCartonId(lastCarton.id);
            setLastClosedCartonNo(lastCarton.cartonNo);
            setLastClosedCartonSSCC(lastCarton.sscc);
          } else {
            setLastClosedCartonId(null);
            setLastClosedCartonNo(null);
            setLastClosedCartonSSCC(null);
          }
        })
        .catch(err => {
          console.error("Failed to fetch last closed carton:", err);
          setLastClosedCartonId(null);
          setLastClosedCartonNo(null);
          setLastClosedCartonSSCC(null);
        });

      setScanHistory([]);
      setStatus('ready');
      setLastScannedBarcode('');
      setErrorMsg('');
      setTimeout(focusInput, 100);
    } else {
      setSelectedOrder(null);
      setCartonNo(null);
      setCartonSSCC(null);
      setCurrentQty(0);
      setTargetQty(0);
      setCompletedCartons(0);
      setTotalScanned(0);
      setLastClosedCartonId(null);
      setLastClosedCartonNo(null);
      setLastClosedCartonSSCC(null);
      setScanHistory([]);
      setStatus('ready');
      setLastScannedBarcode('');
      setErrorMsg('');
    }
  }, [selectedOrderId]);

  // Keep focus on hidden input
  useEffect(() => {
    focusInput();
    const interval = setInterval(focusInput, 1500); // periodically enforce focus
    return () => clearInterval(interval);
  }, [selectedOrderId]);

  // Handle global F8 keydown to refocus the input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        if (inputRef.current) {
          inputRef.current.focus();
          setIsInputFocused(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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



  const printPDFDirectly = async (cartonId: string) => {
    try {
      const blob = await api.get(`/api/cartons/${cartonId}/label.pdf`) as Blob;
      const url = window.URL.createObjectURL(blob);
      
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = url;
      document.body.appendChild(iframe);
      
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          window.URL.revokeObjectURL(url);
        }, 5000);
      };
    } catch (err: any) {
      console.error("Direct PDF print failed:", err);
      alert("Doğrudan PDF yazdırma hatası: " + err.message);
      throw err;
    }
  };

  const handleTestPrint = async () => {
    setIsTestingConnection(true);
    setTestMessage(null);
    try {
      const provider = getPrintProvider(printMode);
      const testZpl = `^XA^CI28^PW800^LL640^FO50,50^A0N,44,44^FDTEST PRINT^FS^FO50,110^A0N,28,28^FDBaglanti: Basarili^FS^FO50,150^A0N,24,24^FDTarih: ${new Date().toLocaleString('tr-TR')}^FS^FO50,200^GB700,3,3^FS^FO50,230^A0N,20,20^FDTrack & Trace Termal Yazici Testi^FS^XZ\n`;
      await provider.testPrint(testZpl);
      setTestMessage({ text: 'Test sayfası başarıyla tetiklendi!', type: 'success' });
    } catch (err: any) {
      setTestMessage({ text: err.message || 'Yazıcıya bağlanılamadı.', type: 'error' });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleNetworkPrint = async () => {
    if (!lastClosedCartonId) return;
    setIsReprinting(true);
    try {
      const provider = getPrintProvider(printMode);
      await provider.print({ id: lastClosedCartonId, type: 'carton' });
    } catch (err: any) {
      alert("Yazdırma hatası: " + err.message);
    } finally {
      setIsReprinting(false);
    }
  };

  const handleSaveSettings = (mode: string, auto: boolean) => {
    // Legacy support
    localStorage.setItem('tt_print_mode', mode);
    localStorage.setItem('tt_auto_print', auto.toString());
    
    // Phase 5A Global Sync
    const globalSettings = localStorage.getItem('trackTrace_printSettings');
    let parsed: any = {
      printMode: 'browser',
      defaultLabelType: 'carton',
      defaultFormat: 'pdf',
      autoPrintCarton: true,
      autoPrintPallet: true,
      showNotification: true
    };
    if (globalSettings) {
      try { parsed = { ...parsed, ...JSON.parse(globalSettings) }; } catch(e){}
    }
    parsed.printMode = mode === 'kiosk' ? 'browser' : (mode === 'network' ? 'agent' : mode);
    parsed.autoPrintCarton = auto;
    localStorage.setItem('trackTrace_printSettings', JSON.stringify(parsed));

    setPrintMode(mode);
    setAutoPrintEnabled(auto);
    setIsSettingsModalOpen(false);
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    setBarcodeInput(''); // clear immediately

    if (!selectedOrderId) {
      playSound('warning');
      setStatus('error');
      setLastScannedBarcode(code);
      setErrorMsg('Lütfen barkod okutmadan önce yukarıdan aktif bir sipariş seçin.');
      return;
    }

    try {
      const res = await api.post('/api/scan/product', { orderId: selectedOrderId, rawCode: code });
      
      if (res.success) {
        playSound('success');
        
        setCartonNo(res.cartonNo);
        setCartonSSCC(res.sscc);
        setCurrentQty(res.cartonCurrentQty);
        setTargetQty(res.cartonTargetQty);
        setTotalScanned(prev => prev + 1);

        if (res.status === 'CartonClosed') {
          setStatus('cartonClosed');
          setCompletedCartons(prev => prev + 1);
          setLastClosedCartonId(res.cartonId || null);
          setLastClosedCartonNo(res.cartonNo || null);
          setLastClosedCartonSSCC(res.sscc || null);

          // Auto-print carton label if enabled
          const currentMode = printMode || 'kiosk';
          const currentAuto = autoPrintEnabled;

          if (currentAuto && res.cartonId) {
            const provider = getPrintProvider(currentMode);
            provider.print({ id: res.cartonId, type: 'carton' })
              .then(() => {
                console.log(`Koli barkodu otomatik yazdırılmaya gönderildi (Mode: ${currentMode}).`);
              })
              .catch((printErr: any) => {
                console.error(`Otomatik yazdırma başarısız (Mode: ${currentMode}):`, printErr);
                playSound('warning');
                alert(`Koli tamamlandı ancak etiket otomatik olarak yazdırılamadı: ${printErr.message}`);
              });
          }
        } else {
          setStatus('success');
        }

        setLastScannedBarcode(code);
        setErrorMsg('');

        // Add to history list (max 10)
        setScanHistory(prev => [
          {
            rawCode: code,
            gtin: res.gtin || '',
            serialNo: res.serialNo || '',
            status: 'Başarılı',
            timestamp: new Date().toLocaleTimeString('tr-TR'),
            cartonNo: res.cartonNo || '-'
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
        handleScanError(code, res.message || 'Hatalı okutma.');
      }
    } catch (err: any) {
      handleScanError(code, err.message || 'Bağlantı hatası.');
    }
  };

  const handleScanError = (code: string, errorMsg: string) => {
    playSound('error');
    setStatus('error');
    setLastScannedBarcode(code);
    setErrorMsg(errorMsg);

    setScanHistory(prev => [
      {
        rawCode: code,
        gtin: '',
        serialNo: '',
        status: 'Hata',
        timestamp: new Date().toLocaleTimeString('tr-TR'),
        cartonNo: '-'
      },
      ...prev.slice(0, 9)
    ]);
  };

  const handleDownloadPDF = async () => {
    if (!lastClosedCartonId) return;
    try {
      const blob = await api.get(`/api/cartons/${lastClosedCartonId}/label.pdf`);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `carton_label_${lastClosedCartonNo}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("PDF indirme hatası: " + err.message);
    }
  };

  const handleCopyZPL = async () => {
    if (!lastClosedCartonId) return;
    try {
      const res = await api.post(`/api/cartons/${lastClosedCartonId}/print?format=ZPL`);
      if (res && res.zpl) {
        await navigator.clipboard.writeText(res.zpl);
        alert("ZPL barkod kodu başarıyla panoya kopyalandı!");
      } else {
        alert("ZPL kodu alınamadı.");
      }
    } catch (err: any) {
      alert("ZPL alma hatası: " + err.message);
    }
  };

  const getStatusColors = (statusStr: string) => {
    switch (statusStr) {
      case 'success':
        return {
          bg: '#f0fdf4',
          border: '#16a34a',
          text: '#15803d',
          title: 'BAŞARILI OKUMA'
        };
      case 'error':
        return {
          bg: '#fef2f2',
          border: '#ef4444',
          text: '#b91c1c',
          title: 'HATALI OKUMA'
        };
      case 'cartonClosed':
        return {
          bg: '#faf5ff',
          border: '#7c3aed',
          text: '#6b21a8',
          title: 'KOLİ TAMAMLANDI'
        };
      case 'ready':
      default:
        return {
          bg: '#eff6ff',
          border: '#3b82f6',
          text: '#1d4ed8',
          title: 'OKUTMAYA HAZIR'
        };
    }
  };

  const colors = getStatusColors(status);
  const progressPercent = targetQty > 0 ? (currentQty / targetQty) * 100 : 0;

  return (
    <div className="scan-layout" onClick={focusInput} style={{ minHeight: 'calc(100vh - 80px)', paddingBottom: '30px' }}>
      
      {/* Top Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: '#0f172a', margin: 0 }}>Ürün Okutma Terminali</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '4px 0 0 0' }}>Barkod tabancasıyla ürün okutma, koli oluşturma ve anlık ilerleme takibi.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Connection Status Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '20px', backgroundColor: isOnline ? '#ecfdf5' : '#fef2f2', border: `1px solid ${isOnline ? '#a7f3d0' : '#fca5a5'}` }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isOnline ? '#10b981' : '#ef4444', display: 'inline-block' }}></span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isOnline ? '#065f46' : '#991b1b' }}>
              {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
            </span>
          </div>
          {/* Operator Name Info */}
          {user?.name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '20px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                Operatör: <strong>{user.name}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Configuration & Controls Panel */}
      <div className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '320px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <select
              className="form-input"
              style={{ width: '100%', height: '42px', fontWeight: 600, borderRadius: '8px', border: '1px solid #cbd5e1' }}
              value={selectedOrderNo}
              onChange={(e) => {
                setSelectedOrderNo(e.target.value);
                setSelectedOrderId('');
                setSelectedOrder(null);
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
          </div>

          <div style={{ flex: 1.5, minWidth: '200px' }}>
            <select
              className="form-input"
              style={{ width: '100%', height: '42px', fontWeight: 600, borderRadius: '8px', border: '1px solid #cbd5e1' }}
              value={selectedOrderId}
              disabled={!selectedOrderNo}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">-- ÜRÜN / STOK KODU SEÇİN --</option>
              {activeOrders
                .filter(o => o.orderNo === selectedOrderNo)
                .map(o => (
                  <option key={o.id} value={o.id}>
                    {o.stockCode} - {o.productName} - {o.gtin} - ({o.scannedCount}/{o.expectedQuantity})
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Focus State Indicator */}
          <div 
            onClick={focusInput}
            style={{ 
              cursor: 'pointer',
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 14px', 
              borderRadius: '8px', 
              fontSize: '0.85rem', 
              fontWeight: 600,
              backgroundColor: isInputFocused ? '#eff6ff' : '#fff7ed', 
              border: `1px solid ${isInputFocused ? '#bfdbfe' : '#fed7aa'}`,
              color: isInputFocused ? '#1d4ed8' : '#c2410c'
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isInputFocused ? '#3b82f6' : '#f97316', display: 'inline-block' }}></span>
            {isInputFocused ? 'Odak Aktif' : 'Odak Kayboldu / Tıkla veya F8 ile odakla'}
          </div>

          {/* Sound State Toggle Button */}
          <button
            className="btn"
            style={{ 
              height: '42px', 
              padding: '0 16px', 
              borderRadius: '8px', 
              backgroundColor: soundEnabled ? '#ecfdf5' : '#f1f5f9',
              border: `1px solid ${soundEnabled ? '#a7f3d0' : '#cbd5e1'}`,
              color: soundEnabled ? '#047857' : '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600
            }}
            onClick={(e) => { e.stopPropagation(); setSoundEnabled(!soundEnabled); }}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            {soundEnabled ? 'Ses Açık' : 'Ses Kapalı'}
          </button>

          {/* Printer Settings Button */}
          <button
            className="btn"
            style={{ 
              height: '42px', 
              padding: '0 16px', 
              borderRadius: '8px', 
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600
            }}
            onClick={(e) => { e.stopPropagation(); setIsSettingsModalOpen(true); }}
          >
            <Printer size={18} />
            Yazıcı Ayarları
          </button>
        </div>
      </div>

      {/* Main Terminal Layout Grid */}
      <div className="scan-body" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}>
        
        {/* Left Section: Central Indicator Card & Detail Info & Progress */}
        <div className="scan-left" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Central Terminal Status Banner Card */}
          <div 
            onClick={focusInput}
            style={{
              flex: 1,
              minHeight: '260px',
              borderRadius: '16px',
              backgroundColor: colors.bg,
              border: `3px solid ${colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '30px',
              textAlign: 'center',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
              position: 'relative',
              cursor: 'pointer'
            }}
          >
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: colors.text, margin: 0, letterSpacing: '1px' }}>
              {colors.title}
            </h1>
            
            {status === 'error' && errorMsg && (
              <p style={{ fontSize: '1.25rem', fontWeight: 600, color: '#dc2626', marginTop: '16px', maxWidth: '80%' }}>
                {errorMsg}
              </p>
            )}

            {lastScannedBarcode && (
              <div style={{ marginTop: '20px', padding: '12px 24px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Son Okunan Barkod:</span>
                <code style={{ fontSize: '1.35rem', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', letterSpacing: '0.5px' }}>
                  {lastScannedBarcode}
                </code>
              </div>
            )}

            <span style={{ position: 'absolute', bottom: '16px', fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
              Barkod tabancasıyla okutun veya kodu yazıp Enter'a basın.
            </span>
          </div>

          {/* Hidden HTML input for keyboard scanning emulator */}
          <form onSubmit={handleScanSubmit}>
            <input
              ref={inputRef}
              type="text"
              className="hidden-input"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
            />
          </form>

          {/* Progress Tracking Cards */}
          {selectedOrder && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', width: '100%' }}>
              
              {/* Order Goal Progress Card */}
              <div className="card" style={{ padding: '18px', borderLeft: '4px solid #8b5cf6', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <h4 style={{ fontSize: '0.9rem', color: '#6b21a8', margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Genel İlerleme</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '12px' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>{totalScanned}</span>
                  <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>/ {selectedOrder.expectedQuantity} Adet</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginTop: '8px', fontWeight: 600 }}>
                  <span>Kalan: {Math.max(0, selectedOrder.expectedQuantity - totalScanned)}</span>
                  <span>Koli: {completedCartons} adet</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: '#f3e8ff', borderRadius: '4px', overflow: 'hidden', marginTop: '12px' }}>
                  <div style={{ height: '100%', width: `${selectedOrder.expectedQuantity ? Math.min(100, (totalScanned / selectedOrder.expectedQuantity) * 100) : 0}%`, backgroundColor: '#8b5cf6', transition: 'width 0.3s ease' }}></div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#6b21a8', marginTop: '6px' }}>
                  {selectedOrder.expectedQuantity ? Math.round(Math.min(100, (totalScanned / selectedOrder.expectedQuantity) * 100)) : 0}% Sipariş Tamamlandı
                </div>
              </div>

              {/* Active Carton Progress Card */}
              <div className="card" style={{ padding: '18px', borderLeft: '4px solid #3b82f6', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <h4 style={{ fontSize: '0.9rem', color: '#1d4ed8', margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center' }}>
                  Aktif Koli Durumu
                  {currentQty > 0 && (
                    <span style={{ marginLeft: '8px', fontSize: '0.7rem', backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #ffd8a8', padding: '2px 6px', borderRadius: '4px', textTransform: 'none', fontWeight: 600 }}>
                      Yarım Kalan Koli
                    </span>
                  )}
                </h4>
                {cartonNo ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '12px' }}>
                      <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>{currentQty}</span>
                      <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>/ {targetQty} Adet</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cartonSSCC || ''}>
                      No: <strong>{cartonNo}</strong> | SSCC: <code>{cartonSSCC}</code>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#dbeafe', borderRadius: '4px', overflow: 'hidden', marginTop: '12px' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, progressPercent)}%`, backgroundColor: '#3b82f6', transition: 'width 0.3s ease' }}></div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#1d4ed8', marginTop: '6px' }}>
                      {Math.round(Math.min(100, progressPercent))}% Doluluk
                    </div>
                  </>
                ) : (
                  <div style={{ height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.85rem', textAlign: 'center' }}>
                    Okutma başlatılınca otomatik koli açılacaktır.
                  </div>
                )}
              </div>

              {/* Last Closed Carton Actions Card */}
              <div className="card" style={{ padding: '18px', borderLeft: '4px solid #10b981', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '0.9rem', color: '#047857', margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Son Kapatılan Koli</h4>
                  {lastClosedCartonNo ? (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{lastClosedCartonNo}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lastClosedCartonSSCC || ''}>
                        SSCC: <code>{lastClosedCartonSSCC}</code>
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                      Kapatılan koli bulunmuyor.
                    </div>
                  )}
                </div>
                
                {lastClosedCartonId && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-primary" 
                      disabled={isReprinting}
                      style={{ flex: '1 1 100%', padding: '6px 8px', fontSize: '0.75rem', backgroundColor: '#3b82f6', fontWeight: 700, borderRadius: '6px' }}
                      onClick={handleNetworkPrint}
                    >
                      {isReprinting ? 'Yazdırılıyor...' : 'Doğrudan Yazdır'}
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      style={{ flex: 1, padding: '6px 8px', fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px' }}
                      onClick={handleDownloadPDF}
                    >
                      PDF İndir
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      style={{ flex: 1, padding: '6px 8px', fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px' }}
                      onClick={handleCopyZPL}
                    >
                      ZPL Kopyala
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Selected Order Metadata panel */}
          {selectedOrder && (
            <div className="card" style={{ padding: '16px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                Sipariş & Ürün Detayları
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Sipariş No</span>
                  <strong style={{ color: '#0f172a' }}>{selectedOrder.orderNo}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Müşteri</span>
                  <strong style={{ color: '#0f172a' }}>{selectedOrder.customerName}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Stok Kodu</span>
                  <strong style={{ color: '#0f172a' }}>{selectedOrder.stockCode}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Ürün Adı</span>
                  <strong style={{ color: '#0f172a' }}>{selectedOrder.productName}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>İş Emri No</span>
                  <strong style={{ color: '#0f172a' }}>{selectedOrder.gtin}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Koli İçi Adet</span>
                  <strong style={{ color: '#0f172a' }}>{selectedOrder.productPerCarton}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Beklenen Adet</span>
                  <strong style={{ color: '#0f172a' }}>{selectedOrder.expectedQuantity}</strong>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Section: Real-time Scan History List */}
        <div className="scan-right" style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', margin: 0 }}>
            Okutma Geçmişi (Son 10)
          </h3>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: '16px', overflowY: 'auto' }}>
            {scanHistory.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#64748b', gap: '10px' }}>
                <Barcode size={32} />
                <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>Bu oturumda henüz okuma yapılmadı.</p>
              </div>
            ) : (
              scanHistory.map((item, idx) => (
                <div key={idx} style={{
                  borderLeft: `4px solid ${item.status === 'Başarılı' ? '#10b981' : '#ef4444'}`,
                  backgroundColor: item.status === 'Başarılı' ? '#f8fafc' : '#fef2f2',
                  marginBottom: '10px',
                  borderRadius: '6px',
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid #e2e8f0',
                  borderLeftWidth: '4px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '70%' }}>
                    <code style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.rawCode}>
                      {item.rawCode}
                    </code>
                    {item.serialNo && (
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                        Seri No: {item.serialNo}
                      </span>
                    )}
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Koli: <strong>{item.cartonNo}</strong>
                    </span>
                  </div>
                  
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: item.status === 'Başarılı' ? '#047857' : '#b91c1c',
                      backgroundColor: item.status === 'Başarılı' ? '#d1fae5' : '#fee2e2',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {item.status}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>{item.timestamp}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Yazıcı Ayarları Modalı */}
      {isSettingsModalOpen && (
        <div 
          onClick={() => setIsSettingsModalOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '500px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={20} style={{ color: '#3b82f6' }} />
                Yazıcı Ayarları
              </h3>
              <button 
                onClick={() => setIsSettingsModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: 1
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Yazdırma Yöntemi
                </label>
                <select
                  className="form-input"
                  style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600 }}
                  value={printMode}
                  onChange={(e) => setPrintMode(e.target.value)}
                >
                  <option value="kiosk">Browser Auto Print (Chrome)</option>
                  <option value="pdf">PDF Download (Manuel)</option>
                  <option value="zpl">ZPL Download</option>
                  <option value="network">Zebra Browser Print / Agent</option>
                </select>
              </div>

              {printMode === 'network' && (
                <>
                  <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                      Bilgisayarınızda kurulu olan <strong>Zebra Browser Print</strong> uygulaması aracılığıyla, varsayılan yazıcınıza doğrudan çıktı gönderilir.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch("https://localhost:9101/default?type=printer");
                            const rawText = await res.text();
                            const deviceObj = JSON.parse(rawText);
                            const displayName = deviceObj.name || deviceObj.uid || "Bilinmeyen Yazıcı";
                            alert(`Varsayılan Yazıcı: ${displayName} (${deviceObj.connection})`);
                          } catch (e: any) {
                            alert("Zebra Browser Print bağlantı hatası! Lütfen uygulamanın çalıştığından emin olun ve https://localhost:9101 adresindeki SSL sertifikasına güven izni verin.");
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Bağlu Yazıcıyı Sorgula
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <input
                      type="checkbox"
                      id="autoPrintCheckbox"
                      checked={autoPrintEnabled}
                      onChange={(e) => setAutoPrintEnabled(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="autoPrintCheckbox" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                      Koli Tamamlanınca Otomatik Barkod Bas
                    </label>
                  </div>

                  <div>
                    <button
                      type="button"
                      disabled={isTestingConnection}
                      onClick={handleTestPrint}
                      style={{
                        width: '100%',
                        height: '38px',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        color: '#334155',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      {isTestingConnection ? 'Bağlantı Test Ediliyor...' : 'Test Et (ZPL Barkodu Bas)'}
                    </button>
                    {testMessage && (
                      <div style={{
                        marginTop: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: testMessage.type === 'success' ? '#16a34a' : '#dc2626',
                        backgroundColor: testMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${testMessage.type === 'success' ? '#bcf0da' : '#fde8e8'}`,
                        padding: '8px 12px',
                        borderRadius: '6px'
                      }}>
                        {testMessage.text}
                      </div>
                    )}
                  </div>
                </>
              )}

              {printMode === 'kiosk' && (
                <>
                  <div style={{ backgroundColor: '#f0fdf4', padding: '14px', borderRadius: '8px', border: '1px solid #bcf0da' }}>
                    <p style={{ fontSize: '0.8rem', color: '#14532d', margin: '0 0 8px 0', lineHeight: '1.4', fontWeight: 600 }}>
                      ✓ Bu mod, Argox dahil TÜM marka yazıcıları destekler.
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#166534', margin: 0, lineHeight: '1.4' }}>
                      Bunun için etiket yazıcınızı Windows üzerinde <strong>Varsayılan Yazıcı</strong> yapmalısınız. Otomatik (onay penceresiz) baskı almak istiyorsanız, Google Chrome tarayıcınızı <code>--kiosk-printing</code> parametresi ile başlatmalısınız.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <input
                      type="checkbox"
                      id="autoPrintCheckbox"
                      checked={autoPrintEnabled}
                      onChange={(e) => setAutoPrintEnabled(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="autoPrintCheckbox" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                      Koli Tamamlanınca Otomatik Barkod Bas
                    </label>
                  </div>

                  <div>
                    <button
                      type="button"
                      disabled={isTestingConnection}
                      onClick={async () => {
                        if (lastClosedCartonId) {
                          setIsTestingConnection(true);
                          try {
                            await printPDFDirectly(lastClosedCartonId);
                          } finally {
                            setIsTestingConnection(false);
                          }
                        } else {
                          alert("Test edebilmek için sonlandırılmış en az bir koli bulunmalıdır.");
                        }
                      }}
                      style={{
                        width: '100%',
                        height: '38px',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        color: '#334155',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      {isTestingConnection ? 'Yazdırılıyor...' : 'Test Et (Mevcut Koliyi Yazdır)'}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '16px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                style={{ height: '40px', padding: '0 16px', borderRadius: '8px', fontWeight: 600 }}
                onClick={() => setIsSettingsModalOpen(false)}
              >
                Vazgeç
              </button>
              <button
                className="btn btn-primary"
                style={{ height: '40px', padding: '0 16px', borderRadius: '8px', fontWeight: 600, backgroundColor: '#3b82f6' }}
                onClick={() => handleSaveSettings(printMode, autoPrintEnabled)}
              >
                Ayarları Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
