import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCcw, CheckCircle2, AlertCircle, Maximize, PlayCircle } from 'lucide-react';

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
  const [cameras, setCameras] = useState<any[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  const [isContinuous, setIsContinuous] = useState(defaultContinuous);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const DEBOUNCE_MS = 1500;

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length > 0) {
        setCameras(devices);
        // default to back camera if available, otherwise first camera
        const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('arka'));
        setActiveCameraId(backCamera ? backCamera.id : devices[0].id);
      } else {
        setErrorMsg('Kamera bulunamadı veya erişim izni reddedildi.');
      }
    }).catch(err => {
      setErrorMsg('Kamera izni alınamadı. Lütfen tarayıcı ayarlarından izin verin.');
      console.error(err);
    });

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = useCallback(async (cameraId: string) => {
    if (scannerRef.current) {
      await stopScanner();
    }
    
    setErrorMsg(null);
    try {
      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;
      await scanner.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          const now = Date.now();
          if (now - lastScanTimeRef.current > DEBOUNCE_MS) {
            lastScanTimeRef.current = now;
            handleValidScan(decodedText);
          }
        },
        () => {
          // ignore frame errors (happens constantly when no barcode is in view)
        }
      );
    } catch (err) {
      setErrorMsg('Kamera başlatılamadı.');
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (isOpen && activeCameraId) {
      startScanner(activeCameraId);
    }
  }, [isOpen, activeCameraId, startScanner]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
      scannerRef.current = null;
    }
  };

  const handleValidScan = (decodedText: string) => {
    // Play beep sound
    try {
      const audio = new Audio('/sounds/success.mp3'); // We'll try to play a beep or fallback to browser beep
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {}

    setLastScanned(decodedText);
    onScan(decodedText);

    if (!isContinuous) {
      setTimeout(() => {
        handleClose();
      }, 500);
    } else {
      setTimeout(() => setLastScanned(null), 1500); // clear visual feedback after 1.5s
    }
  };

  const switchCamera = () => {
    if (cameras.length > 1) {
      const currentIndex = cameras.findIndex(c => c.id === activeCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      setActiveCameraId(cameras[nextIndex].id);
    }
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
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
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '500px',
        backgroundColor: '#1e293b',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
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

        {/* Scanner View */}
        <div style={{ position: 'relative', width: '100%', minHeight: '300px', backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          
          {errorMsg ? (
            <div style={{ color: '#f87171', textAlign: 'center', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <AlertCircle size={48} />
              <p style={{ margin: 0, fontWeight: 500 }}>{errorMsg}</p>
            </div>
          ) : (
            <div id="reader" style={{ width: '100%', border: 'none' }}></div>
          )}

          {/* Success Overlay */}
          {lastScanned && (
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(16, 185, 129, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              zIndex: 10,
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

        {/* Controls */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#0f172a' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <button 
              className="btn"
              onClick={() => setIsContinuous(!isContinuous)}
              style={{ 
                flex: 1, 
                backgroundColor: isContinuous ? '#3b82f6' : '#334155', 
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: 600
              }}
            >
              {isContinuous ? <PlayCircle size={18} /> : <Maximize size={18} />}
              {isContinuous ? 'Sürekli Mod' : 'Tek Okutma'}
            </button>

            {cameras.length > 1 && (
              <button 
                className="btn btn-secondary"
                onClick={switchCamera}
                style={{ 
                  flex: 1, 
                  backgroundColor: '#334155',
                  color: 'white',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 600
                }}
              >
                <RefreshCcw size={18} />
                Kamera Değiştir
              </button>
            )}
          </div>

          <button 
            onClick={handleClose}
            style={{ 
              width: '100%', 
              backgroundColor: '#ef4444', 
              color: 'white',
              border: 'none',
              padding: '14px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            Kapat
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        #reader video {
          object-fit: cover;
          border-radius: 0;
        }
        #reader {
          border: none !important;
        }
        #reader__dashboard_section_csr span {
          color: white !important;
        }
      `}</style>
    </div>
  );
};
