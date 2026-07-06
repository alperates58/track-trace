import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, CheckCircle2, AlertCircle, Maximize, PlayCircle, Info, Upload, ChevronDown, ChevronUp } from 'lucide-react';

interface CameraScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  isOpen: boolean;
  defaultContinuous?: boolean;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ 
  onScan, 
  onClose, 
  isOpen,
  defaultContinuous = true
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const [isContinuous, setIsContinuous] = useState(defaultContinuous);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScannerRunning, setIsScannerRunning] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  
  // Debug info states
  const [debugInfo, setDebugInfo] = useState<any>({
    userAgent: navigator.userAgent,
    isSecureContext: window.isSecureContext,
    mediaDevicesExists: !!navigator.mediaDevices,
    getUserMediaExists: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    isStandalone: window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true,
    lastError: null
  });

  const lastScanTimeRef = useRef<number>(0);
  const DEBOUNCE_MS = 1500;

  useEffect(() => {
    // When modal closes, ensure scanner stops
    if (!isOpen) {
      stopScanner();
    }
    
    // Do NOT auto-start the scanner here to require a user gesture on mobile!
    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const updateDebugInfo = (key: string, value: any) => {
    setDebugInfo((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleValidScan = (decodedText: string) => {
    setLastScanned(decodedText);
    onScan(decodedText);
    
    if (!isContinuous) {
      setTimeout(() => {
        handleClose();
      }, 800);
    } else {
      setTimeout(() => setLastScanned(null), 1000);
    }
  };

  const startScanner = async () => {
    if (scannerRef.current) {
      await stopScanner();
    }
    
    setErrorMsg(null);
    updateDebugInfo('lastError', null);
    
    try {
      // 1. Feature Detection
      if (!window.isSecureContext) {
        throw new Error('Güvenli bağlantı (HTTPS veya Localhost) gereklidir. Kamera bu ortamda açılamaz.');
      }
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tarayıcınız kamera API\'sini (getUserMedia) desteklemiyor. Lütfen güncel bir Safari veya Chrome kullanın.');
      }

      // 2. Explicit Camera Request
      let devices;
      try {
        devices = await Html5Qrcode.getCameras();
      } catch (camErr: any) {
        throw new Error(`Kamera izinleri reddedildi veya kamera bulunamadı: ${camErr.name || camErr.message || 'Bilinmeyen Hata'}`);
      }

      if (!devices || devices.length === 0) {
        throw new Error('Cihazda uygun bir kamera bulunamadı.');
      }

      const scanner = new Html5Qrcode("reader", {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      });
      scannerRef.current = scanner;
      
      // Select best facing mode / device
      const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('arka'));
      
      // Fallback chain for config
      const configQueue = [
        { facingMode: { exact: "environment" } },
        { facingMode: "environment" },
        backCamera ? backCamera.id : devices[0].id
      ];

      let started = false;
      let lastErr = null;

      for (const config of configQueue) {
        if (started) break;
        try {
          await scanner.start(
            config as any,
            {
              fps: 10,
              qrbox: (viewfinderWidth, viewfinderHeight) => {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                return {
                  width: viewfinderWidth * 0.9,
                  height: minEdge * 0.6
                };
              }
            },
            (decodedText) => {
              const now = Date.now();
              if (now - lastScanTimeRef.current > DEBOUNCE_MS) {
                lastScanTimeRef.current = now;
                handleValidScan(decodedText);
              }
            },
            () => { /* Ignore frame errors */ }
          );
          started = true;
          setIsScannerRunning(true);
        } catch (e: any) {
          lastErr = e;
          console.warn("Failed with config", config, e);
        }
      }

      if (!started) {
        throw new Error(`Kameralar başlatılamadı: ${lastErr?.message || lastErr?.name || 'Bilinmiyor'}`);
      }
      
    } catch (err: any) {
      updateDebugInfo('lastError', err?.message || String(err));
      setErrorMsg(err.message || 'Kamera başlatılamadı. Tarayıcı izinlerini kontrol edin.');
      console.error("Camera Error:", err);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setIsScannerRunning(false);
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      try {
        // Initialize an empty scanner just to use the file scanning API
        const scanner = new Html5Qrcode("reader");
        const decodedText = await scanner.scanFile(file, true);
        handleValidScan(decodedText);
      } catch (err) {
        setErrorMsg('Barkod okunamadı. Lütfen net bir fotoğraf seçin.');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '500px',
        backgroundColor: '#1e293b',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        {/* Header */}
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', flexShrink: 0 }}>
          <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
            <Camera size={20} />
            Kamera ile Okutma
          </h3>
          <button 
            onClick={handleClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
          >
            <X size={24} />
          </button>
        </div>

        {/* PWA Warning */}
        {debugInfo.isStandalone && (
          <div style={{ backgroundColor: '#f59e0b', color: '#fff', padding: '10px 16px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={16} />
            iOS Ana Ekran modunda kamera çalışmayabilir. Sorun yaşarsanız Safari içinde açın.
          </div>
        )}

        {/* Scanner View / Start Button */}
        <div style={{ position: 'relative', width: '100%', minHeight: '300px', backgroundColor: 'black', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          
          {errorMsg ? (
            <div style={{ color: '#f87171', textAlign: 'center', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', zIndex: 5 }}>
              <AlertCircle size={48} />
              <p style={{ margin: 0, fontWeight: 500 }}>{errorMsg}</p>
              <button 
                className="btn" 
                onClick={startScanner}
                style={{ marginTop: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600 }}
              >
                Tekrar Dene
              </button>
            </div>
          ) : !isScannerRunning ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', zIndex: 5 }}>
              <button 
                onClick={startScanner}
                style={{
                  backgroundColor: '#10b981', color: 'white', border: 'none', 
                  padding: '16px 32px', borderRadius: '12px', fontSize: '1.1rem', 
                  fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
                }}
              >
                <Camera size={24} />
                Kamerayı Başlat
              </button>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>İzin istendiğinde lütfen onay verin.</span>
            </div>
          ) : null}

          {/* This is where Html5Qrcode renders the video */}
          <div id="reader" style={{ width: '100%', border: 'none', position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, zIndex: 1 }}></div>

          {/* Success Overlay */}
          {lastScanned && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(16, 185, 129, 0.9)', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 10,
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <CheckCircle2 size={64} style={{ marginBottom: '16px' }} />
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>Başarılı!</span>
              <code style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '8px 16px', borderRadius: '8px', fontSize: '1.1rem' }}>
                {lastScanned}
              </code>
            </div>
          )}
        </div>

        {/* Controls Panel */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#0f172a', overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button 
              className="btn"
              onClick={() => setIsContinuous(!isContinuous)}
              style={{ 
                flex: 1, backgroundColor: isContinuous ? '#3b82f6' : '#334155', color: 'white',
                border: 'none', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '8px', fontWeight: 600
              }}
            >
              {isContinuous ? <PlayCircle size={18} /> : <Maximize size={18} />}
              {isContinuous ? 'Sürekli Mod' : 'Tek Okutma'}
            </button>
            
            <button
              className="btn"
              onClick={() => fileInputRef.current?.click()}
              style={{ 
                flex: 1, backgroundColor: '#334155', color: 'white',
                border: 'none', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '8px', fontWeight: 600
              }}
            >
              <Upload size={18} />
              Fotoğraf Seç
            </button>
            {/* Hidden file input for native camera fallback */}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </div>

          {/* Technical Details Accordion */}
          <div style={{ marginTop: '8px', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
            <button
              onClick={() => setShowDebug(!showDebug)}
              style={{ 
                background: 'none', border: 'none', color: '#94a3b8', width: '100%', 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                fontSize: '0.85rem', fontWeight: 600, padding: '4px 0', cursor: 'pointer'
              }}
            >
              Teknik Detaylar (Debug)
              {showDebug ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {showDebug && (
              <div style={{ 
                marginTop: '12px', padding: '12px', backgroundColor: '#000', 
                borderRadius: '8px', fontSize: '0.7rem', color: '#10b981', 
                fontFamily: 'monospace', wordBreak: 'break-all', display: 'flex', flexDirection: 'column', gap: '4px'
              }}>
                <div><strong>HTTPS:</strong> {debugInfo.isSecureContext ? 'Evet' : 'HAYIR'}</div>
                <div><strong>Protocol:</strong> {window.location.protocol}</div>
                <div><strong>PWA/Standalone:</strong> {debugInfo.isStandalone ? 'Evet' : 'Hayır'}</div>
                <div><strong>mediaDevices:</strong> {debugInfo.mediaDevicesExists ? 'Var' : 'Yok'}</div>
                <div><strong>getUserMedia:</strong> {debugInfo.getUserMediaExists ? 'Var' : 'Yok'}</div>
                <div><strong>UserAgent:</strong> {debugInfo.userAgent}</div>
                {debugInfo.lastError && (
                  <div style={{ color: '#ef4444', marginTop: '4px' }}>
                    <strong>Son Hata:</strong> {debugInfo.lastError}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
