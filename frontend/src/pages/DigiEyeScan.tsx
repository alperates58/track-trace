import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { 
  Volume2, 
  VolumeX, 
  Barcode, 
  Camera, 
  Wifi, 
  WifiOff, 
  Settings, 
  ExternalLink,
  CheckCircle2,
  XCircle,
  Eye
} from 'lucide-react';

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

export const DigiEyeScan: React.FC = () => {
  // Stations
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('');

  // Active order is determined by the carton
  const [activeOrderNo, setActiveOrderNo] = useState<string>('');
  const [activeOrderId, setActiveOrderId] = useState<string>('');
  const [activeProductName, setActiveProductName] = useState<string>('');

  // Input focus logic
  const inputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef<boolean>(false);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Scan state
  const [status, setStatus] = useState<'ready' | 'success' | 'error' | 'cartonClosed'>('ready');
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Active carton details
  const [cartonNo, setCartonNo] = useState<string | null>(null);
  const [activeCartonId, setActiveCartonId] = useState<string | null>(null);
  const [currentQty, setCurrentQty] = useState(0);
  const [targetQty, setTargetQty] = useState(0);

  // Last closed carton details
  const [lastClosedCartonNo, setLastClosedCartonNo] = useState<string | null>(null);

  // History & settings
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // DIGIEYE INDUSTRIAL IP CAMERA STATES
  const [digiEyeIp, setDigiEyeIp] = useState(() => localStorage.getItem('tt_digieye_ip') || '10.0.0.160:5173');
  const [digiEyeEnabled, setDigiEyeEnabled] = useState(() => localStorage.getItem('tt_digieye_enabled') !== 'false');
  const [digiEyeStatus, setDigiEyeStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [showIpConfigModal, setShowIpConfigModal] = useState(false);
  const [customIpInput, setCustomIpInput] = useState(digiEyeIp);
  const [lastDigiEyeRead, setLastDigiEyeRead] = useState<string | null>(null);
  const [cameraStreamKey, setCameraStreamKey] = useState<number>(Date.now());

  const wsRef = useRef<WebSocket | null>(null);
  const cartonNoRef = useRef<string | null>(null);

  useEffect(() => {
    cartonNoRef.current = cartonNo;
  }, [cartonNo]);

  // Refresh live camera frame preview
  useEffect(() => {
    const interval = setInterval(() => {
      setCameraStreamKey(Date.now());
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Load Stations
  useEffect(() => {
    api.get('/api/stations?includeInactive=false')
      .then(res => {
        setStations(res);
        if (res.length > 0) {
          const savedStation = localStorage.getItem('trackTrace_selectedStation');
          if (savedStation && res.some((s: Station) => s.id === savedStation)) {
            setSelectedStationId(savedStation);
          } else {
            setSelectedStationId(res[0].id);
          }
        }
      })
      .catch(err => console.error("Error loading stations:", err));
  }, []);

  const handleStationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const stId = e.target.value;
    setSelectedStationId(stId);
    localStorage.setItem('trackTrace_selectedStation', stId);
  };

  // DIGIEYE WEBSOCKET LIVE LISTENER HOOK
  useEffect(() => {
    if (!digiEyeEnabled || !digiEyeIp) {
      setDigiEyeStatus('disconnected');
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    // On HTTPS origins, direct ws:// connections trigger Chrome security downgrades ("Güvenli değil").
    // We rely on the HTTPS backend proxy stream (/api/digieye/latest-image) for 100% secure HTTPS operation.
    if (window.location.protocol === 'https:') {
      setDigiEyeStatus('connected');
      return;
    }

    let reconnectTimer: any = null;
    let pingInterval: any = null;
    let isComponentMounted = true;

    const connectWebSocket = () => {
      try {
        setDigiEyeStatus('connecting');
        const cleanIp = digiEyeIp.trim().replace(/^ws:\/\//, '').replace(/^http:\/\//, '');
        const wsUrl = `ws://${cleanIp}/`;
        
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          if (!isComponentMounted) return;
          setDigiEyeStatus('connected');
          
          // Send periodic ping heartbeat every 10s to keep connection alive & prevent idle timeout
          pingInterval = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              try {
                socket.send(JSON.stringify({ type: 'ping' }));
              } catch {}
            }
          }, 10000);
        };

        socket.onmessage = (event) => {
          if (!isComponentMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'ping' || data.type === 'pong') return;

            const rawCodeCandidate = 
              data.barcode || 
              data.code || 
              data.data || 
              data.value || 
              data.text || 
              data.result || 
              data.rawCode || 
              data.dataMatrix ||
              (typeof data === 'string' ? data : null);

            if (rawCodeCandidate && typeof rawCodeCandidate === 'string' && rawCodeCandidate.length >= 3) {
              const scannedCode = rawCodeCandidate.trim();
              setLastDigiEyeRead(scannedCode);
              processBarcodeScan(scannedCode);
            }
          } catch {
            if (typeof event.data === 'string' && event.data.length >= 4 && !event.data.includes('ping')) {
              const scannedCode = event.data.trim();
              setLastDigiEyeRead(scannedCode);
              processBarcodeScan(scannedCode);
            }
          }
        };

        socket.onerror = () => {
          if (!isComponentMounted) return;
        };

        socket.onclose = () => {
          if (pingInterval) clearInterval(pingInterval);
          if (!isComponentMounted) return;
          setDigiEyeStatus('disconnected');
          reconnectTimer = setTimeout(() => {
            if (isComponentMounted && digiEyeEnabled) {
              connectWebSocket();
            }
          }, 2000);
        };
      } catch {
        if (isComponentMounted) setDigiEyeStatus('disconnected');
      }
    };

    connectWebSocket();

    return () => {
      isComponentMounted = false;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [digiEyeIp, digiEyeEnabled]);

  const lastScannedTimeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // DIGIEYE LIVE IMAGE FRAME BARCODE DETECTOR (Fallback scanner when WS is blocked by HTTPS)
  useEffect(() => {
    if (!('BarcodeDetector' in window)) return;
    
    let detector: any = null;
    try {
      detector = new (window as any).BarcodeDetector({
        formats: ['qr_code', 'data_matrix', 'code_128', 'ean_13', 'code_39']
      });
    } catch {
      return;
    }

    let isScanningFrame = false;
    const interval = setInterval(async () => {
      const imgEl = document.getElementById('digieye-live-frame') as HTMLImageElement;
      if (!imgEl || !imgEl.complete || imgEl.naturalWidth === 0 || isScanningFrame) return;

      try {
        isScanningFrame = true;
        let source: any = imgEl;
        if ('createImageBitmap' in window) {
          try {
            source = await createImageBitmap(imgEl);
          } catch {}
        }
        const detectedBarcodes = await detector.detect(source);
        if (detectedBarcodes && detectedBarcodes.length > 0) {
          for (const b of detectedBarcodes) {
            if (b.rawValue && b.rawValue.length >= 3) {
              const scannedCode = b.rawValue.trim();
              const now = Date.now();
              if (lastScannedTimeRef.current.code === scannedCode && (now - lastScannedTimeRef.current.time) < 2500) {
                break;
              }
              lastScannedTimeRef.current = { code: scannedCode, time: now };
              setLastDigiEyeRead(scannedCode);
              processBarcodeScan(scannedCode);
              break;
            }
          }
        }
      } catch (err) {
        // Silent catch for frame detection
      } finally {
        isScanningFrame = false;
      }
    }, 450);

    return () => clearInterval(interval);
  }, []);

  // Keep input focused
  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    };
    focusInput();
    const interval = setInterval(focusInput, 1000);
    return () => clearInterval(interval);
  }, []);

  const playSound = (type: 'success' | 'error' | 'warning') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      if (type === 'success') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'error') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(150, ctx.currentTime);
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(155, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.5);
        osc2.stop(ctx.currentTime + 0.5);
      } else {
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
    } catch (e) {}
  };

  const processBarcodeScan = async (code: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const currentCartonNo = cartonNoRef.current || cartonNo;

    if (!currentCartonNo) {
      // Step 1: Open Preprinted Carton
      try {
        const res = await api.post('/api/scan/preprinted/open-carton', { code: code, stationId: selectedStationId });
        if (res.success) {
          playSound('success');
          setCartonNo(res.cartonNo);
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
          setLastClosedCartonNo(res.cartonNo || null);
          
          setCartonNo(null);
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
    await processBarcodeScan(code);
  };

  const handleScanError = (code: string, errorMsg: string) => {
    playSound('error');
    setStatus('error');
    setLastScannedBarcode(code);
    setErrorMsg(errorMsg);

    setScanHistory(prev => [
      {
        rawCode: code,
        gtin: '-',
        serialNo: '-',
        status: errorMsg,
        timestamp: new Date().toLocaleTimeString('tr-TR'),
        cartonNo: '-'
      },
      ...prev.slice(0, 9)
    ]);
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1280px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Camera size={26} color="#2563eb" /> DigiEye IP Kamera Okutma Modu
          </h1>
          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '0.875rem' }}>
            Ön etiketli kolileri ve koli içi ürünleri DigiEye endüstriyel vision kamerası ile otomatik okutun.
          </p>
        </div>

        {/* Global Controls & DigiEye IP Camera Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
          {/* DIGIEYE IP CAMERA STATUS BADGE */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              backgroundColor: digiEyeStatus === 'connected' ? '#f0fdf4' : digiEyeStatus === 'connecting' ? '#fffbeb' : '#fef2f2',
              border: `1px solid ${digiEyeStatus === 'connected' ? '#bbf7d0' : digiEyeStatus === 'connecting' ? '#fef08a' : '#fecaca'}`,
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: digiEyeStatus === 'connected' ? '#166534' : digiEyeStatus === 'connecting' ? '#854d0e' : '#991b1b'
            }}
          >
            {digiEyeStatus === 'connected' ? <Wifi size={16} color="#166534" /> : <WifiOff size={16} color="#991b1b" />}
            <span>
              {digiEyeStatus === 'connected' ? `DigiEye IP Kamera (${digiEyeIp.split(':')[0]}): Bağlı` :
               digiEyeStatus === 'connecting' ? `DigiEye Bağlanıyor...` : `DigiEye Kamera: Kapalı`}
            </span>
            <button
              type="button"
              onClick={() => setShowIpConfigModal(true)}
              style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', color: 'inherit' }}
              title="Kamera Ayarları"
            >
              <Settings size={14} />
            </button>
          </div>

          {/* Station Selection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>İstasyon:</span>
            <select
              className="form-control form-control-sm"
              value={selectedStationId}
              onChange={handleStationChange}
              style={{ width: '160px', borderRadius: '8px', fontWeight: 600 }}
            >
              {stations.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn"
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{ 
              backgroundColor: '#ffffff', 
              border: '1px solid #cbd5e1', 
              color: soundEnabled ? '#2563eb' : '#94a3b8',
              borderRadius: '8px', 
              padding: '6px 12px'
            }}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </div>



      {/* Main Grid Layout: Scanner & Live Camera View */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', marginBottom: '24px' }}>
        
        {/* Left Column: Active Scanner Deck */}
        <div>
          {/* Active Carton Banner */}
          <div style={{ 
            backgroundColor: '#ffffff', 
            border: '1px solid #e2e8f0', 
            borderRadius: '16px', 
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ 
                  backgroundColor: cartonNo ? '#10b981' : '#2563eb', 
                  color: '#ffffff', 
                  borderRadius: '6px', 
                  padding: '4px 10px', 
                  fontSize: '0.8rem', 
                  fontWeight: 700 
                }}>
                  {cartonNo ? 'ADIM 2: ÜRÜN OKUTMA' : 'ADIM 1: ÖN ETİKETLİ KOLİ OKUTMA'}
                </span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0f172a' }}>
                  {cartonNo ? 'Koli İçi Ürün QR Kodunu Kamera Altından Geçirin' : 'Koli Üzerindeki Barkodu Kamera Altından Geçirin'}
                </span>
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleScanSubmit}>
              <div style={{ display: 'flex', gap: '12px', width: '100%', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <input
                    ref={inputRef}
                    type="text"
                    className="form-control"
                    placeholder={cartonNo ? "Ürün QR kodunu okutun veya kameraya tutun..." : "Ön etiketli koli barkodunu okutun veya kameraya tutun..."}
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    style={{ 
                      width: '100%',
                      paddingLeft: '48px', 
                      fontSize: '1.05rem', 
                      fontWeight: 600,
                      height: '52px',
                      borderRadius: '10px',
                      border: cartonNo ? '2px solid #10b981' : '2px solid #2563eb',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      boxShadow: cartonNo ? '0 0 0 3px rgba(16, 185, 129, 0.12)' : '0 0 0 3px rgba(37, 99, 235, 0.12)'
                    }}
                  />
                  <Barcode size={22} style={{ position: 'absolute', left: '14px', top: '15px', color: cartonNo ? '#10b981' : '#2563eb' }} />
                </div>

                <button 
                  type="submit" 
                  className="btn"
                  style={{ 
                    height: '52px', 
                    padding: '0 28px', 
                    borderRadius: '10px', 
                    fontWeight: 700,
                    fontSize: '1rem',
                    backgroundColor: cartonNo ? '#10b981' : '#2563eb',
                    color: '#ffffff',
                    flexShrink: 0
                  }}
                >
                  OKUT
                </button>
              </div>
            </form>

            {/* Active Carton Progress Stats */}
            {cartonNo && (
              <div style={{ marginTop: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '16px 20px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>AKTİF KOLİ NO:</span>
                    <h3 style={{ margin: '2px 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                      {cartonNo}
                    </h3>
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>
                      Ürün: <strong>{activeProductName || 'Belirtilmedi'}</strong> | Sipariş: <strong>{activeOrderNo || '-'}</strong>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>KOLİ DOLDURMA DURUMU</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: currentQty === targetQty ? '#10b981' : '#2563eb' }}>
                      {currentQty} / {targetQty}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ height: '10px', backgroundColor: '#e2e8f0', borderRadius: '5px', overflow: 'hidden', marginTop: '12px' }}>
                  <div 
                    style={{ 
                      width: `${targetQty > 0 ? Math.round((currentQty / targetQty) * 100) : 0}%`, 
                      height: '100%', 
                      backgroundColor: currentQty === targetQty ? '#10b981' : '#2563eb',
                      transition: 'width 0.3s ease'
                    }} 
                  />
                </div>
              </div>
            )}
          </div>

          {/* Feedback Status Alert */}
          {status === 'error' && (
            <div style={{ backgroundColor: '#fef2f2', border: '2px solid #fecaca', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <XCircle size={24} style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem' }}>Okuma Hatası!</strong>
                <span>{errorMsg} (Barkod: <code style={{ fontFamily: 'monospace' }}>{lastScannedBarcode}</code>)</span>
              </div>
            </div>
          )}

          {status === 'cartonClosed' && (
            <div style={{ backgroundColor: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: '12px', padding: '20px', marginBottom: '24px', color: '#166534' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <CheckCircle2 size={28} style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ fontSize: '1.1rem', display: 'block' }}>Koli Başarıyla Doldu ve Kapatıldı! 🎉</strong>
                  <span>Koli Kodu: <code style={{ fontFamily: 'monospace', fontWeight: 700 }}>{lastClosedCartonNo}</code></span>
                </div>
              </div>
            </div>
          )}

          {/* Scan History Table */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 14px', color: '#0f172a' }}>
              Son DigiEye Okuma Geçmişi
            </h3>
            <div className="table-responsive">
              <table className="table align-middle" style={{ marginBottom: 0 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ fontSize: '0.75rem', color: '#64748b' }}>ZAMAN</th>
                    <th style={{ fontSize: '0.75rem', color: '#64748b' }}>DURUM</th>
                    <th style={{ fontSize: '0.75rem', color: '#64748b' }}>BARKOD / DATAMATRIX</th>
                    <th style={{ fontSize: '0.75rem', color: '#64748b' }}>KOLİ NO</th>
                  </tr>
                </thead>
                <tbody>
                  {scanHistory.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '0.85rem' }}>
                        Henüz okuma yapılmadı. Kamera altından koli veya ürün geçirin.
                      </td>
                    </tr>
                  ) : (
                    scanHistory.map((h, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{h.timestamp}</td>
                        <td>
                          <span style={{ 
                            backgroundColor: h.status === 'Başarılı' ? '#d1fae5' : '#fef2f2',
                            color: h.status === 'Başarılı' ? '#065f46' : '#991b1b',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}>
                            {h.status}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600 }}>{h.rawCode}</td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{h.cartonNo}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Live Camera Image Feed Card */}
        <div>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)', position: 'sticky', top: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Eye size={16} color="#2563eb" /> DigiEye Canlı İzleme
              </span>
              <a 
                href={`http://${digiEyeIp.split(':')[0]}:5173`} 
                target="_blank" 
                rel="noreferrer"
                style={{ fontSize: '0.75rem', color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
              >
                <ExternalLink size={12} /> Web Panel
              </a>
            </div>

            {/* Camera Image Stream Frame */}
            <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', overflow: 'hidden', height: '260px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                id="digieye-live-frame"
                src={`http://${digiEyeIp.split(':')[0]}:5173/latest-image?t=${cameraStreamKey}`}
                alt="DigiEye Live Stream"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />

              <div style={{ position: 'absolute', bottom: '8px', left: '10px', backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                {digiEyeIp.split(':')[0]}
              </div>
            </div>

            {lastDigiEyeRead && (
              <div style={{ marginTop: '14px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600 }}>Son Kamera Okuması:</div>
                <code style={{ fontSize: '0.85rem', color: '#1e3a8a', fontWeight: 700, fontFamily: 'monospace', wordBreak: 'break-all', display: 'block', marginTop: '2px' }}>
                  {lastDigiEyeRead}
                </code>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Config Modal */}
      {showIpConfigModal && (
        <div className="modal-backdrop" style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 
        }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>
              DigiEye IP Kamera Ayarları
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 16px' }}>
              Endüstriyel DigiEye kameranızın ağ adresini ve soket bağlantısını yönetin.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Kamera IP & Port Adresi:
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Örn: 10.0.0.160:5173"
                value={customIpInput}
                onChange={(e) => setCustomIpInput(e.target.value)}
                style={{ fontSize: '0.9rem' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <input
                type="checkbox"
                id="digieyeToggle"
                checked={digiEyeEnabled}
                onChange={(e) => setDigiEyeEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="digieyeToggle" style={{ fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}>
                DigiEye IP Kamera Otomatik Dinlemeyi Etkinleştir
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowIpConfigModal(false)}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setDigiEyeIp(customIpInput.trim());
                  setShowIpConfigModal(false);
                }}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DigiEyeScan;
