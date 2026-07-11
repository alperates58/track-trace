import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { getPrintProvider } from '../services/printProvider';
import { useAuth } from '../context/AuthContext';
import { Printer } from 'lucide-react';
import { CameraScanner } from '../components/CameraScanner';
import { SessionHeader } from '../components/Scan/SessionHeader';
import { ScanToolbar } from '../components/Scan/ScanToolbar';
import { ScanProgressCard } from '../components/Scan/ScanProgressCard';
import { RecentScanPanel } from '../components/Scan/RecentScanPanel';

interface Station {
  id: string;
  name: string;
}

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

  // Stations
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('');

  // Orders lists
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [selectedOrderNo, setSelectedOrderNo] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<ActiveOrder | null>(null);

  // Hidden input focus logic
  const inputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef<boolean>(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Scan state
  const [status, setStatus] = useState<'ready' | 'success' | 'error' | 'cartonClosed'>('ready');
  const [, setLastScannedBarcode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Active carton details
  const [, setCartonNo] = useState<string | null>(null);
  const [, setCartonSSCC] = useState<string | null>(null);
  const [currentQty, setCurrentQty] = useState(0);
  const [targetQty, setTargetQty] = useState(0);
  const [, setCompletedCartons] = useState(0);
  const [, setTotalScanned] = useState(0);

  // Last closed carton details (for label reprint & ZPL)
  const [lastClosedCartonId, setLastClosedCartonId] = useState<string | null>(null);
  const [, setLastClosedCartonNo] = useState<string | null>(null);
  const [, setLastClosedCartonSSCC] = useState<string | null>(null);

  // History & settings
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  const [printMode, setPrintMode] = useState<string>('browser');
  const [autoPrintEnabled, setAutoPrintEnabled] = useState<boolean>(true);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      let activeMode = 'kiosk';
      let activeAutoPrint = true;

      const localSettings = localStorage.getItem('trackTrace_printSettings');
      if (localSettings) {
        try {
          const parsed = JSON.parse(localSettings);
          activeMode = parsed.printMode || 'browser';
          activeAutoPrint = parsed.autoPrintCarton !== false;
        } catch (e) {}
      } else {
        try {
          const res = await api.get('/api/settings/GlobalPrintConfig');
          if (res && res.value) {
            const parsed = JSON.parse(res.value);
            activeMode = parsed.printMode || 'browser';
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

  // Load Active Orders & Stations
  useEffect(() => {
    api.get('/api/orders?pageSize=100&status=Active')
      .then(res => {
        setActiveOrders(res.items);
      })
      .catch(console.error);

    api.get('/api/stations?includeInactive=false')
      .then(res => {
        setStations(res);
        const savedStation = localStorage.getItem('trackTrace_selectedStation');
        if (savedStation && res.some((s: Station) => s.id === savedStation)) {
          setSelectedStationId(savedStation);
        } else if (res.length > 0) {
          setSelectedStationId(res[0].id);
          localStorage.setItem('trackTrace_selectedStation', res[0].id);
        }
      })
      .catch(console.error);
  }, []);

  // Handle Order Select
  useEffect(() => {
    if (selectedOrderId && selectedStationId) {
      const order = activeOrders.find(o => o.id === selectedOrderId) || null;
      setSelectedOrder(order);
      
      // Fetch current progress from backend
      api.get(`/api/scan/current-carton?orderId=${selectedOrderId}&stationId=${selectedStationId}`)
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
  }, [selectedOrderId, selectedStationId]);

  // Keep focus on hidden input
  useEffect(() => {
    focusInput();
    const interval = setInterval(focusInput, 1500); // periodically enforce focus
    return () => clearInterval(interval);
  }, [selectedOrderId, selectedStationId]);

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
    parsed.printMode = mode;
    parsed.autoPrintCarton = auto;
    localStorage.setItem('trackTrace_printSettings', JSON.stringify(parsed));

    setPrintMode(mode);
    setAutoPrintEnabled(auto);
    setIsSettingsModalOpen(false);
  };

  const processBarcode = async (code: string) => {
    if (!code) return;

    if (!selectedOrderId) {
      playSound('warning');
      setStatus('error');
      setLastScannedBarcode(code);
      setErrorMsg('Lütfen barkod okutmadan önce yukarıdan aktif bir sipariş seçin.');
      return;
    }

    if (!selectedStationId) {
      playSound('warning');
      setStatus('error');
      setLastScannedBarcode(code);
      setErrorMsg('Lütfen okutmaya başlamadan önce bir istasyon seçin.');
      return;
    }

    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      const res = await api.post('/api/scan/product', { orderId: selectedOrderId, rawCode: code, stationId: selectedStationId });
      
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
            if (currentMode === 'pdf') {
              playSound('warning');
              alert("PDF Download modunda otomatik yazdırma desteklenmez. Etiketi manuel olarak indirip yazdırın.");
            } else {
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
    } finally {
      isProcessingRef.current = false;
    }
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    setBarcodeInput('');
    await processBarcode(code);
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

  return (
    <div className="min-h-full flex flex-col overflow-x-hidden overflow-y-auto bg-gray-50" onClick={focusInput}>
      <SessionHeader isOnline={isOnline} operatorName={user?.name} />

      <main className="flex-1 flex flex-col p-2 md:p-4 gap-2 md:gap-4 relative">
        <ScanToolbar 
          stations={stations}
          selectedStationId={selectedStationId}
          onStationChange={setSelectedStationId}
          activeOrders={activeOrders}
          selectedOrderNo={selectedOrderNo}
          onOrderNoChange={(orderNo) => {
            setSelectedOrderNo(orderNo);
            setSelectedOrderId('');
            setSelectedOrder(null);
          }}
          selectedProductId={selectedOrderId}
          onProductChange={setSelectedOrderId}
          isInputFocused={isInputFocused}
          onFocusRequest={focusInput}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
          onOpenPrinterSettings={() => setIsSettingsModalOpen(true)}
          onOpenCamera={() => setIsCameraOpen(true)}
          onCloseFocusRestoration={focusInput}
        />

        <div className="flex-1 flex flex-col lg:flex-row gap-2 md:gap-4 overflow-hidden min-h-0" style={{ position: 'relative', zIndex: 1 }}>
          <ScanProgressCard 
            productName={selectedOrder?.productName || null}
            stockCode={selectedOrder?.stockCode || null}
            gtin={selectedOrder?.gtin || null}
            currentQty={currentQty}
            targetQty={targetQty}
            isInputFocused={isInputFocused}
            onFocusRequest={focusInput}
          />
          <RecentScanPanel 
            history={scanHistory}
            errorMsg={status === 'error' ? errorMsg : undefined}
          />
        </div>
      </main>

      {/* Hidden HTML input for keyboard scanning emulator */}
      <form onSubmit={handleScanSubmit} className="hidden" style={{ display: 'none' }}>
        <input
          ref={inputRef}
          type="text"
          className="hidden-input opacity-0 absolute w-0 h-0"
          value={barcodeInput}
          onChange={(e) => setBarcodeInput(e.target.value)}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
        />
      </form>

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
                  <option value="browser">Browser Auto Print</option>
                  <option value="pdf">PDF Download</option>
                  <option value="zpl">ZPL Download</option>
                  <option value="agent">Local Print Agent</option>
                </select>
              </div>

              {printMode === 'browser' && (
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
                        Bağlı Yazıcıyı Sorgula
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
      
      <CameraScanner 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onScan={processBarcode} 
      />
    </div>
  );
};
