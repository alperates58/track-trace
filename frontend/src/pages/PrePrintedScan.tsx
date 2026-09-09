import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { getPrintProvider } from '../services/printProvider';
import { useAuth } from '../context/AuthContext';
import { Volume2, VolumeX, Barcode, Printer, Camera, RotateCcw } from 'lucide-react';
import { CameraScanner } from '../components/CameraScanner';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { TTPageHeader } from '../components/common';

interface Station {
  id: string;
  name: string;
}

interface ScanHistory {
  rawCode: string;
  gtin: string;
  serialNo: string;
  status: string;
  timestamp: string;
  cartonNo: string;
}

export const PrePrintedScan: React.FC = () => {
  const { user, hasPermission } = useAuth();

  // Stations
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('');

  // Orders lists
  // Active order is determined by the carton
  const [activeOrderNo, setActiveOrderNo] = useState<string>('');
  const [activeOrderId, setActiveOrderId] = useState<string>('');
  const [activeProductName, setActiveProductName] = useState<string>('');

  // Hidden input focus logic
  const inputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef<boolean>(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Scan state
  const [status, setStatus] = useState<'ready' | 'success' | 'error' | 'cartonClosed'>('ready');
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Active carton details
  const [cartonNo, setCartonNo] = useState<string | null>(null);
  const [cartonSSCC, setCartonSSCC] = useState<string | null>(null);
  const [activeCartonId, setActiveCartonId] = useState<string | null>(null);
  const [currentQty, setCurrentQty] = useState(0);
  const [targetQty, setTargetQty] = useState(0);

  // Last closed carton details (for label reprint & ZPL)
  const [lastClosedCartonId, setLastClosedCartonId] = useState<string | null>(null);
  const [lastClosedCartonNo, setLastClosedCartonNo] = useState<string | null>(null);
  const [lastClosedCartonSSCC, setLastClosedCartonSSCC] = useState<string | null>(null);

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
  const [isReprinting, setIsReprinting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

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
    api.get('/api/stations?includeInactive=false')
      .then(res => {
        setStations(res);
        const savedStation = localStorage.getItem('trackTrace_selectedStation');
        if (user?.defaultStationId && res.some((s: Station) => s.id === user.defaultStationId)) {
          setSelectedStationId(user.defaultStationId);
        } else if (savedStation && res.some((s: Station) => s.id === savedStation)) {
          setSelectedStationId(savedStation);
        } else if (res.length > 0) {
          setSelectedStationId(res[0].id);
          localStorage.setItem('trackTrace_selectedStation', res[0].id);
        }
      })
      .catch(console.error);
  }, []);

  // When Station changes, reset state
  useEffect(() => {
    setCartonNo(null);
    setCartonSSCC(null);
    setActiveCartonId(null);
    setCurrentQty(0);
    setTargetQty(0);
    setActiveOrderId('');
    setActiveOrderNo('');
    setActiveProductName('');
    setScanHistory([]);
    setStatus('ready');
    setLastScannedBarcode('');
    setErrorMsg('');
    setTimeout(focusInput, 100);
  }, [selectedStationId]);

  // Keep focus on hidden input
  useEffect(() => {
    focusInput();
    const interval = setInterval(focusInput, 1500); // periodically enforce focus
    return () => clearInterval(interval);
  }, [selectedStationId, cartonNo]);

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
    parsed.printMode = mode;
    parsed.autoPrintCarton = auto;
    localStorage.setItem('trackTrace_printSettings', JSON.stringify(parsed));

    setPrintMode(mode);
    setAutoPrintEnabled(auto);
    setIsSettingsModalOpen(false);
  };

  const processBarcode = async (code: string) => {
    if (!code) return;

    if (!selectedStationId) {
      playSound('warning');
      setStatus('error');
      setLastScannedBarcode(code);
      setErrorMsg('Lütfen okutmaya başlamadan önce bir istasyon seçin.');
      return;
    }

    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    if (!cartonNo) {
      // Step 1: Open PrePrinted Carton
      try {
        const res = await api.post('/api/scan/preprinted/open-carton', { code: code, stationId: selectedStationId });
        if (res.success) {
          playSound('success');
          setCartonNo(res.cartonNo);
          setCartonSSCC(res.sscc);
          setActiveCartonId(res.cartonId || null);
          setCurrentQty(res.actualQuantity);
          setTargetQty(res.targetQuantity);
          setActiveOrderId(res.orderId || '');
          setActiveOrderNo(res.orderNo || '');
          setActiveProductName(res.productName || '');
          setStatus('ready');
          setLastScannedBarcode(code);
          setErrorMsg('');
        } else {
          handleScanError(code, res.message || 'Koli açılamadı.');
        }
      } catch (err: any) {
        handleScanError(code, err.message || 'Bağlantı hatası.');
      } finally {
        isProcessingRef.current = false;
      }
      return;
    }

    // Step 2: Scan Product into the opened carton
    try {
      const res = await api.post('/api/scan/product', { 
        orderId: activeOrderId, 
        rawCode: code, 
        stationId: selectedStationId, 
        mode: 'PrePrinted',
        activeCartonId: activeCartonId 
      });
      
      if (res.success) {
        playSound('success');
        
        setCurrentQty(res.cartonCurrentQty);

        if (res.status === 'CartonClosed') {
          setStatus('cartonClosed');
          setLastClosedCartonId(res.cartonId || null);
          setLastClosedCartonNo(res.cartonNo || null);
          setLastClosedCartonSSCC(res.sscc || null);
          
          // Clear carton so next scan requires a new carton barcode
          setCartonNo(null);
          setCartonSSCC(null);
          setActiveCartonId(null);
          setCurrentQty(0);
          setTargetQty(0);
          setActiveOrderId('');
          setActiveOrderNo('');
          setActiveProductName('');
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

  const handleRemoveItemFromCarton = async (codeToRemove: string) => {
    if (!activeCartonId) {
      alert('Aktif açık bir koli bulunamadı.');
      return;
    }

    setIsUndoing(true);
    try {
      await api.post(`/api/cartons/${activeCartonId}/remove-product?rawCode=${encodeURIComponent(codeToRemove)}`);
      playSound('warning');
      setCurrentQty(prev => Math.max(0, prev - 1));
      setScanHistory(prev => prev.map(item => 
        item.rawCode === codeToRemove && item.status === 'Başarılı'
          ? { ...item, status: 'Geri Alındı' }
          : item
      ));
      setStatus('ready');
      setErrorMsg('');
    } catch (err: any) {
      playSound('error');
      alert('Ürün koliden çıkarılamadı: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
      setIsUndoing(false);
    }
  };

  const handleUndoLastScan = async () => {
    if (!activeCartonId || currentQty <= 0) {
      alert('Aktif kolide geri alınabilecek ürün yok.');
      return;
    }
    const lastSuccess = scanHistory.find(item => item.status === 'Başarılı');
    if (!lastSuccess) {
      alert('Geri alınabilecek son okutulmuş ürün bulunamadı.');
      return;
    }
    await handleRemoveItemFromCarton(lastSuccess.rawCode);
  };

  // Global hardware barcode scanner hook for laptop scanning
  useBarcodeScanner({
    onScan: processBarcode,
    onUndo: handleUndoLastScan,
    enabled: isOnline && !!selectedStationId && !isSettingsModalOpen && !isCameraOpen
  });

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
          bg: 'var(--success-bg)',
          border: 'var(--success-border)',
          text: 'var(--success-text)',
          badgeClass: 'tt-badge-success',
          title: 'BAŞARILI OKUMA'
        };
      case 'error':
        return {
          bg: 'var(--danger-bg)',
          border: 'var(--danger-border)',
          text: 'var(--danger-text)',
          badgeClass: 'tt-badge-danger',
          title: 'HATALI OKUMA'
        };
      case 'cartonClosed':
        return {
          bg: 'rgba(124, 58, 237, 0.08)',
          border: 'rgba(124, 58, 237, 0.3)',
          text: '#7c3aed',
          badgeClass: 'tt-badge-primary',
          title: 'KOLİ TAMAMLANDI'
        };
      case 'ready':
      default:
        return {
          bg: 'var(--bg-surface-subtle)',
          border: 'var(--border-subtle)',
          text: 'var(--primary)',
          badgeClass: 'tt-badge-primary',
          title: 'OKUTMAYA HAZIR'
        };
    }
  };

  const colors = getStatusColors(status);
  const progressPercent = targetQty > 0 ? (currentQty / targetQty) * 100 : 0;

  return (
    <div className="scan-layout" onClick={focusInput} style={{ minHeight: 'calc(100vh - 80px)', paddingBottom: '30px' }}>
      
      {/* Top Header Section */}
      <TTPageHeader
        title="Ön Etiketli Koli Modu"
        description="Önce koli barkodunu okutun, ardından ürünleri okutarak doldurun."
        breadcrumb="Üretim / Terminal"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className={`tt-badge ${isOnline ? 'tt-badge-success' : 'tt-badge-danger'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isOnline ? 'var(--success)' : 'var(--danger)' }} />
              {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
            </span>
            {user?.name && (
              <span className="tt-badge tt-badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Operatör: <strong>{user.name}</strong>
              </span>
            )}
          </div>
        }
      />

      {/* Configuration & Controls Panel */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '16px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '320px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '0 1 240px' }}>
            <select
              className="form-input"
              style={{ width: '100%', height: '36px', fontSize: '0.85rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
              value={selectedStationId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedStationId(newId);
                if (newId) localStorage.setItem('trackTrace_selectedStation', newId);
                else localStorage.removeItem('trackTrace_selectedStation');
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">-- İstasyon Seçin --</option>
              {stations.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          
          {cartonNo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 12px', backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aktif Sipariş</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }} className="tabular-nums">{activeOrderNo}</span>
              </div>
              <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ürün</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{activeProductName}</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
              Koli barkodu okutmanız bekleniyor...
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Undo Action */}
          <button
            onClick={handleUndoLastScan}
            disabled={!activeCartonId || currentQty <= 0 || isUndoing}
            className="btn btn-sm btn-secondary"
            style={{
              height: '34px',
              padding: '0 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--warning-border)',
              backgroundColor: (!activeCartonId || currentQty <= 0) ? 'var(--bg-surface-subtle)' : 'var(--warning-bg)',
              color: (!activeCartonId || currentQty <= 0) ? 'var(--text-muted)' : 'var(--warning-text)',
              cursor: (!activeCartonId || currentQty <= 0) ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              opacity: (!activeCartonId || currentQty <= 0) ? 0.5 : 1
            }}
            title="Son okutulan ürünü koliden çıkar (Ctrl+Z)"
          >
            <RotateCcw size={14} className={isUndoing ? 'animate-spin' : ''} />
            Geri Al
          </button>

          {/* Focus State Indicator */}
          <button 
            type="button"
            onClick={focusInput}
            className="btn btn-sm"
            style={{ 
              height: '34px',
              padding: '0 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem', 
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: isInputFocused ? 'var(--primary-light)' : 'var(--warning-bg)', 
              border: `1px solid ${isInputFocused ? 'var(--border-subtle)' : 'var(--warning-border)'}`,
              color: isInputFocused ? 'var(--primary)' : 'var(--warning-text)',
              cursor: 'pointer'
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isInputFocused ? 'var(--primary)' : 'var(--warning)', display: 'inline-block' }} />
            {isInputFocused ? 'Odak Aktif' : 'Odak Kayboldu (F8)'}
          </button>

          {/* Sound State Toggle Button */}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            style={{ 
              height: '34px', 
              padding: '0 12px', 
              borderRadius: 'var(--radius-sm)', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontWeight: 600,
              fontSize: '0.82rem'
            }}
            onClick={(e) => { e.stopPropagation(); setSoundEnabled(!soundEnabled); }}
          >
            {soundEnabled ? <Volume2 size={15} style={{ color: 'var(--success)' }} /> : <VolumeX size={15} />}
            {soundEnabled ? 'Ses Açık' : 'Ses Kapalı'}
          </button>

          {/* Camera Settings Button */}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            style={{ 
              height: '34px', 
              padding: '0 12px', 
              borderRadius: 'var(--radius-sm)', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontWeight: 600,
              fontSize: '0.82rem'
            }}
            onClick={(e) => { e.stopPropagation(); setIsCameraOpen(true); }}
          >
            <Camera size={15} style={{ color: 'var(--warning-text)' }} />
            Kamera
          </button>

          {/* Printer Settings Button */}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            style={{ 
              height: '34px', 
              padding: '0 12px', 
              borderRadius: 'var(--radius-sm)', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontWeight: 600,
              fontSize: '0.82rem'
            }}
            onClick={(e) => { e.stopPropagation(); setIsSettingsModalOpen(true); }}
          >
            <Printer size={15} style={{ color: 'var(--primary)' }} />
            Yazıcı
          </button>
        </div>
      </div>

      {/* Main Terminal Layout Grid */}
      <div className="scan-body" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '20px' }}>
        
        {/* Left Section: Central Indicator Card & Detail Info & Progress */}
        <div className="scan-left" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Central Terminal Status Banner Card */}
          <div 
            onClick={focusInput}
            style={{
              flex: 1,
              minHeight: '220px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              textAlign: 'center',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-xs)',
              position: 'relative',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: colors.text, marginBottom: '8px' }}>
              {!cartonNo ? 'Adım 1' : 'Adım 2'}
            </span>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: colors.text, margin: 0, letterSpacing: '-0.02em' }}>
              {!cartonNo ? 'Önce Koli Barkodunu Okutun' : colors.title}
            </h1>
            
            {status === 'error' && errorMsg && (
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--danger-text)', marginTop: '12px', maxWidth: '80%' }}>
                {errorMsg}
              </p>
            )}

            {lastScannedBarcode && (
              <div style={{ marginTop: '16px', padding: '8px 16px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Son Barkod:</span>
                <code style={{ fontSize: '1.1rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.5px' }} className="tabular-nums">
                  {lastScannedBarcode}
                </code>
              </div>
            )}

            <span style={{ position: 'absolute', bottom: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
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
          {activeOrderId && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', width: '100%' }}>

              {/* Active Carton Progress Card */}
              <div className="card" style={{ padding: '16px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.82rem', color: 'var(--primary)', margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Aktif Koli Durumu
                  </h4>
                  {currentQty > 0 && (
                    <span className="tt-badge tt-badge-warning" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                      Yarım Kalan Koli
                    </span>
                  )}
                </div>
                {cartonNo ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '10px' }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }} className="tabular-nums">{currentQty}</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }} className="tabular-nums">/ {targetQty} Adet</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cartonSSCC || ''}>
                      No: <strong className="tabular-nums font-mono">{cartonNo}</strong> | SSCC: <code className="tabular-nums font-mono">{cartonSSCC}</code>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: '999px', overflow: 'hidden', marginTop: '10px' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, progressPercent)}%`, backgroundColor: progressPercent >= 100 ? 'var(--success)' : 'var(--primary)', transition: 'width 0.25s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                      {currentQty > 0 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{ padding: '2px 8px', fontSize: '0.72rem', color: 'var(--warning-text)', borderColor: 'var(--warning-border)', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer' }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm("Bu aktif kolinin içindeki tüm ürünleri boşaltmak istediğinize emin misiniz?")) return;
                            try {
                              await api.post(`/api/cartons/${activeCartonId}/empty`);
                              setCurrentQty(0);
                              setStatus('ready');
                              playSound('success');
                              alert("Koli başarıyla boşaltıldı.");
                            } catch (err: any) {
                              alert("Koli boşaltılamadı: " + err.message);
                            }
                          }}
                        >
                          İçini Boşalt
                        </button>
                      )}
                      <div style={{ textAlign: 'right', fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', flex: 1 }} className="tabular-nums">
                        %{Math.round(Math.min(100, progressPercent))} Doluluk
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center' }}>
                    Okutma başlatılınca otomatik koli açılacaktır.
                  </div>
                )}
              </div>

              {/* Last Closed Carton Actions Card */}
              <div className="card" style={{ padding: '16px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', boxShadow: 'var(--shadow-xs)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '0.82rem', color: 'var(--success)', margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Son Kapatılan Koli
                  </h4>
                  {lastClosedCartonNo ? (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }} className="tabular-nums">{lastClosedCartonNo}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lastClosedCartonSSCC || ''}>
                        SSCC: <code className="tabular-nums font-mono">{lastClosedCartonSSCC}</code>
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      Kapatılan koli bulunmuyor.
                    </div>
                  )}
                </div>
                
                {lastClosedCartonId && hasPermission('cartons.print') && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-sm btn-primary" 
                      disabled={isReprinting}
                      style={{ flex: '1 1 100%', height: '30px', fontSize: '0.78rem', fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
                      onClick={handleNetworkPrint}
                    >
                      {isReprinting ? 'Yazdırılıyor...' : 'Doğrudan Yazdır'}
                    </button>
                    <button 
                      className="btn btn-sm btn-secondary" 
                      style={{ flex: 1, height: '30px', fontSize: '0.78rem', fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
                      onClick={handleDownloadPDF}
                    >
                      PDF İndir
                    </button>
                    <button 
                      className="btn btn-sm btn-secondary" 
                      style={{ flex: 1, height: '30px', fontSize: '0.78rem', fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
                      onClick={handleCopyZPL}
                    >
                      ZPL Kopyala
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Right Section: Real-time Scan History List */}
        <div className="scan-right" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <Barcode size={16} /> Okutma Geçmişi
            </h3>
            <span className="tt-badge tt-badge-neutral" style={{ fontSize: '0.72rem' }}>Son 10 Okuma</span>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: '12px', overflowY: 'auto' }}>
            {scanHistory.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '180px', color: 'var(--text-muted)', gap: '8px' }}>
                <Barcode size={28} style={{ opacity: 0.4 }} />
                <p style={{ fontSize: '0.82rem', fontWeight: 500, margin: 0 }}>Bu oturumda henüz okuma yapılmadı.</p>
              </div>
            ) : (
              scanHistory.map((item, idx) => (
                <div key={idx} style={{
                  backgroundColor: item.status === 'Başarılı' ? 'var(--bg-surface-subtle)' : item.status === 'Geri Alındı' ? 'var(--warning-bg)' : 'var(--danger-bg)',
                  marginBottom: '8px',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: `1px solid ${item.status === 'Başarılı' ? 'var(--border-subtle)' : item.status === 'Geri Alındı' ? 'var(--warning-border)' : 'var(--danger-border)'}`,
                  borderLeft: `3px solid ${item.status === 'Başarılı' ? 'var(--success)' : item.status === 'Geri Alındı' ? 'var(--warning)' : 'var(--danger)'}`
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '70%' }}>
                    <code style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }} title={item.rawCode} className="tabular-nums">
                      {item.rawCode}
                    </code>
                    {item.serialNo && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }} className="tabular-nums">
                        Seri: {item.serialNo}
                      </span>
                    )}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Koli: <strong className="tabular-nums">{item.cartonNo}</strong>
                    </span>
                  </div>
                  
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {item.status === 'Başarılı' && activeCartonId && (!cartonNo || item.cartonNo === cartonNo) && (
                        <button
                          onClick={() => handleRemoveItemFromCarton(item.rawCode)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--warning-text)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: 'var(--radius-sm)'
                          }}
                          title="Bu barkodu koliden çıkar"
                          aria-label="Koliden çıkar"
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                      <span className={`tt-badge ${item.status === 'Başarılı' ? 'tt-badge-success' : item.status === 'Geri Alındı' ? 'tt-badge-warning' : 'tt-badge-danger'}`} style={{ fontSize: '0.72rem', padding: '1px 6px' }}>
                        {item.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }} className="tabular-nums">{item.timestamp}</div>
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
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--modal-bg)',
              borderRadius: 'var(--radius-lg)',
              width: '90%',
              maxWidth: '480px',
              padding: '20px 24px',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} style={{ color: 'var(--primary)' }} />
                Yazıcı Ayarları
              </h3>
              <button 
                onClick={() => setIsSettingsModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  lineHeight: 1
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px' }}>
                  Yazdırma Yöntemi (Baskı Modu)
                </label>
                <select
                  className="form-input"
                  style={{ width: '100%', height: '36px', fontSize: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
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
                  <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                      Bilgisayarınızda kurulu olan <strong>Zebra Browser Print</strong> uygulaması aracılığıyla, varsayılan yazıcınıza doğrudan çıktı gönderilir.
                    </p>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
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
                        height: '32px',
                        padding: '0 12px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      Bağlı Yazıcıyı Sorgula
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-surface-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <input
                      type="checkbox"
                      id="autoPrintCheckbox"
                      checked={autoPrintEnabled}
                      onChange={(e) => setAutoPrintEnabled(e.target.checked)}
                      style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                    />
                    <label htmlFor="autoPrintCheckbox" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none' }}>
                      Koli Tamamlanınca Otomatik Barkod Bas
                    </label>
                  </div>

                  <div>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={isTestingConnection}
                      onClick={handleTestPrint}
                      style={{
                        width: '100%',
                        height: '34px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      {isTestingConnection ? 'Bağlantı Test Ediliyor...' : 'Test Et (ZPL Barkodu Bas)'}
                    </button>
                    {testMessage && (
                      <div style={{
                        marginTop: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: testMessage.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
                        backgroundColor: testMessage.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
                        border: `1px solid ${testMessage.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)'
                      }}>
                        {testMessage.text}
                      </div>
                    )}
                  </div>
                </>
              )}

              {printMode === 'kiosk' && (
                <>
                  <div style={{ backgroundColor: 'var(--success-bg)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--success-border)' }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--success-text)', margin: '0 0 6px 0', lineHeight: '1.4', fontWeight: 600 }}>
                      ✓ Bu mod, Argox dahil TÜM marka yazıcıları destekler.
                    </p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--success-text)', margin: 0, lineHeight: '1.4', opacity: 0.9 }}>
                      Bunun için etiket yazıcınızı Windows üzerinde <strong>Varsayılan Yazıcı</strong> yapmalısınız. Chrome tarayıcınızı <code>--kiosk-printing</code> parametresi ile başlatarak otomatik baskı alabilirsiniz.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-surface-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <input
                      type="checkbox"
                      id="autoPrintCheckboxKiosk"
                      checked={autoPrintEnabled}
                      onChange={(e) => setAutoPrintEnabled(e.target.checked)}
                      style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                    />
                    <label htmlFor="autoPrintCheckboxKiosk" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none' }}>
                      Koli Tamamlanınca Otomatik Barkod Bas
                    </label>
                  </div>

                  <div>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
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
                        height: '34px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      {isTestingConnection ? 'Yazdırılıyor...' : 'Test Et (Mevcut Koliyi Yazdır)'}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '18px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-sm btn-secondary"
                style={{ height: '34px', padding: '0 14px', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.82rem' }}
                onClick={() => setIsSettingsModalOpen(false)}
              >
                Vazgeç
              </button>
              <button
                className="btn btn-sm btn-primary"
                style={{ height: '34px', padding: '0 14px', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.82rem' }}
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
