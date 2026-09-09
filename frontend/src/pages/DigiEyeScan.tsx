import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Barcode,
  Camera,
  CheckCircle2,
  Clock3,
  Eye,
  Gauge,
  Settings,
  ShieldCheck,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  XCircle
} from 'lucide-react';
import { api } from '../services/api';
import { digiEyeAgent, DigiEyeConfig, DigiEyeEvent, DigiEyeStatus } from '../services/digiEyeAgent';
import { digiEyeBackend, DigiEyeBackendConnectionError } from '../services/digiEyeBackend';
import { TTPageHeader } from '../components/common';

interface Station {
  id: string;
  name: string;
}

interface ScanSession {
  cartonNo: string | null;
  cartonId: string | null;
  orderId: string;
  orderNo: string;
  productName: string;
  currentQty: number;
  targetQty: number;
}

interface ScanHistory {
  sequence: number;
  rawCode: string;
  format: string;
  status: string;
  timestamp: string;
  cartonNo: string;
  success: boolean;
}

type WorkflowStatus = 'ready' | 'success' | 'error' | 'cartonClosed';

const EMPTY_SESSION: ScanSession = {
  cartonNo: null,
  cartonId: null,
  orderId: '',
  orderNo: '',
  productName: '',
  currentQty: 0,
  targetQty: 0
};

const PROCESSED_EVENTS_KEY = 'tt_digieye_processed_events';

function loadProcessedEvents(): Set<number> {
  try {
    const values = JSON.parse(localStorage.getItem(PROCESSED_EVENTS_KEY) || '[]');
    return new Set(Array.isArray(values) ? values.filter(Number.isFinite) : []);
  } catch {
    return new Set();
  }
}

export const DigiEyeScan: React.FC = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState('');
  const selectedStationRef = useRef('');

  const [session, setSession] = useState<ScanSession>(EMPTY_SESSION);
  const sessionRef = useRef<ScanSession>(EMPTY_SESSION);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>('ready');
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');
  const [lastClosedCartonNo, setLastClosedCartonNo] = useState<string | null>(null);
  const [message, setMessage] = useState('Kamera kod bekliyor. Önce ön etiketli koliyi kameraya gönderin.');
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);

  const [agentStatus, setAgentStatus] = useState<DigiEyeStatus | null>(null);
  const agentStatusRef = useRef<DigiEyeStatus | null>(null);
  const [agentError, setAgentError] = useState('');
  const [backendError, setBackendError] = useState('');
  const [processingEvent, setProcessingEvent] = useState<DigiEyeEvent | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [config, setConfig] = useState<DigiEyeConfig | null>(null);
  const [draftConfig, setDraftConfig] = useState<DigiEyeConfig | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configError, setConfigError] = useState('');

  const processedEventsRef = useRef<Set<number>>(loadProcessedEvents());

  const persistProcessedEvents = useCallback(() => {
    localStorage.setItem(PROCESSED_EVENTS_KEY, JSON.stringify([...processedEventsRef.current].slice(-100)));
  }, []);

  const applySession = useCallback((next: ScanSession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const playSound = useCallback((type: 'success' | 'error' | 'warning') => {
    if (!soundEnabledRef.current) return;
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.type = type === 'error' ? 'sawtooth' : type === 'warning' ? 'square' : 'sine';
      oscillator.frequency.setValueAtTime(type === 'error' ? 160 : type === 'warning' ? 600 : 1000, context.currentTime);
      gain.gain.setValueAtTime(type === 'error' ? 0.15 : 0.1, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + (type === 'error' ? 0.45 : 0.16));
      oscillator.start();
      oscillator.stop(context.currentTime + (type === 'error' ? 0.45 : 0.16));
      oscillator.addEventListener('ended', () => void context.close());
    } catch {
      // Audio feedback is optional; scanning must continue if the browser blocks sound.
    }
  }, []);

  const addHistory = useCallback((event: DigiEyeEvent, status: string, cartonNo: string, success: boolean) => {
    setScanHistory(previous => [{
      sequence: event.sequence,
      rawCode: event.rawCode,
      format: event.format,
      status,
      timestamp: new Date().toLocaleTimeString('tr-TR'),
      cartonNo,
      success
    }, ...previous].slice(0, 20));
  }, []);

  const registerScanError = useCallback((event: DigiEyeEvent, errorMessage: string) => {
    playSound('error');
    setWorkflowStatus('error');
    setLastScannedBarcode(event.rawCode);
    setMessage(errorMessage);
    addHistory(event, errorMessage, sessionRef.current.cartonNo || '-', false);
  }, [addHistory, playSound]);

  const acknowledgeProcessedEvent = useCallback(async (sequence: number) => {
    processedEventsRef.current.add(sequence);
    persistProcessedEvents();
    await digiEyeAgent.acknowledge(sequence);
    processedEventsRef.current.delete(sequence);
    persistProcessedEvents();
  }, [persistProcessedEvents]);

  const processEvent = useCallback(async (event: DigiEyeEvent): Promise<boolean> => {
    if (processedEventsRef.current.has(event.sequence)) {
      try {
        await digiEyeAgent.acknowledge(event.sequence);
        processedEventsRef.current.delete(event.sequence);
        persistProcessedEvents();
        return true;
      } catch (error) {
        setAgentError(error instanceof Error ? error.message : 'Agent olayı onaylanamadı.');
        return false;
      }
    }

    const stationId = selectedStationRef.current;
    if (!stationId) return false;

    setProcessingEvent(event);
    setBackendError('');
    try {
      const current = sessionRef.current;
      if (!current.cartonNo) {
        const response = await digiEyeBackend.openPrePrintedCarton(event.rawCode, stationId);
        if (!response.success) {
          registerScanError(event, response.message || 'Ön etiketli koli açılamadı.');
        } else {
          const next: ScanSession = {
            cartonNo: response.cartonNo || null,
            cartonId: response.cartonId || null,
            orderId: response.orderId || '',
            orderNo: response.orderNo || '',
            productName: response.productName || '',
            currentQty: response.actualQuantity || 0,
            targetQty: response.targetQuantity || 0
          };
          applySession(next);
          playSound('success');
          setWorkflowStatus('ready');
          setLastScannedBarcode(event.rawCode);
          setMessage(`${next.cartonNo} açıldı. Şimdi ürünleri gönderin.`);
          addHistory(event, 'Koli açıldı', next.cartonNo || '-', true);
        }
      } else {
        if (!current.cartonId || !current.orderId) {
          throw new DigiEyeBackendConnectionError('Aktif koli bilgisi eksik. Sayfayı yenileyip koliyi tekrar okutun.');
        }

        const response = await digiEyeBackend.scanProduct({
          orderId: current.orderId,
          rawCode: event.rawCode,
          stationId,
          activeCartonId: current.cartonId
        });

        if (!response.success) {
          registerScanError(event, response.message || 'Ürün okutulamadı.');
        } else {
          playSound('success');
          setLastScannedBarcode(event.rawCode);
          addHistory(event, response.status === 'CartonClosed' ? 'Koli tamamlandı' : 'Ürün eklendi', response.cartonNo || current.cartonNo, true);

          if (response.status === 'CartonClosed') {
            setLastClosedCartonNo(response.cartonNo || current.cartonNo);
            applySession(EMPTY_SESSION);
            setWorkflowStatus('cartonClosed');
            setMessage(`${response.cartonNo || current.cartonNo} tamamlandı. Sıradaki koliyi gönderin.`);
          } else {
            const next = { ...current, currentQty: response.cartonCurrentQty };
            applySession(next);
            setWorkflowStatus('success');
            setMessage(`Ürün eklendi: ${response.cartonCurrentQty}/${current.targetQty}`);
          }
        }
      }

      await acknowledgeProcessedEvent(event.sequence);
      return true;
    } catch (error) {
      if (error instanceof DigiEyeBackendConnectionError) {
        setBackendError(error.message);
        setMessage(error.message);
      } else {
        setAgentError(error instanceof Error ? error.message : 'Local Agent onayı başarısız.');
      }
      return false;
    } finally {
      setProcessingEvent(null);
    }
  }, [acknowledgeProcessedEvent, addHistory, applySession, persistProcessedEvents, playSound, registerScanError]);

  useEffect(() => {
    api.get('/api/stations?includeInactive=false')
      .then((items: Station[]) => {
        setStations(items);
        const saved = localStorage.getItem('trackTrace_selectedStation');
        const selected = saved && items.some(station => station.id === saved) ? saved : items[0]?.id || '';
        selectedStationRef.current = selected;
        setSelectedStationId(selected);
      })
      .catch((error: Error) => setBackendError(error.message));
  }, []);

  useEffect(() => {
    let stopped = false;
    const run = async () => {
      while (!stopped) {
        try {
          const status = await digiEyeAgent.getStatus();
          if (stopped) return;
          agentStatusRef.current = status;
          setAgentStatus(status);
          setAgentError('');
        } catch (error) {
          if (!stopped) {
            setAgentStatus(null);
            agentStatusRef.current = null;
            setAgentError(error instanceof Error ? error.message : "Local Agent'a ulaşılamıyor.");
          }
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    };
    void run();
    return () => { stopped = true; };
  }, []);

  useEffect(() => {
    let stopped = false;
    const run = async () => {
      while (!stopped) {
        let delay = 100;
        try {
          const currentAgentStatus = agentStatusRef.current;
          if (selectedStationRef.current && currentAgentStatus?.enabled && !currentAgentStatus.shadowMode) {
            const events = await digiEyeAgent.getEvents(25);
            for (const event of events) {
              if (stopped) return;
              const completed = await processEvent(event);
              if (!completed) {
                delay = 500;
                break;
              }
            }
          }
        } catch (error) {
          if (!stopped) setAgentError(error instanceof Error ? error.message : "Local Agent'a ulaşılamıyor.");
          delay = 500;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    };
    void run();
    return () => { stopped = true; };
  }, [processEvent]);

  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      try {
        const blob = await digiEyeAgent.getLatestFrame();
        if (!stopped && blob) {
          const nextUrl = URL.createObjectURL(blob);
          if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = nextUrl;
          setPreviewUrl(nextUrl);
        }
      } catch {
        // Status polling already reports Agent/camera failures.
      }
    };
    const interval = window.setInterval(() => void refresh(), 500);
    void refresh();
    return () => {
      stopped = true;
      window.clearInterval(interval);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    };
  }, []);

  const openConfig = async () => {
    setShowConfig(true);
    setConfigError('');
    try {
      const value = await digiEyeAgent.getConfig();
      setConfig(value);
      setDraftConfig(value);
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : 'Endüstriyel kamera ayarları okunamadı.');
    }
  };

  const saveConfig = async () => {
    if (!draftConfig) return;
    setSavingConfig(true);
    setConfigError('');
    try {
      const value = await digiEyeAgent.updateConfig(draftConfig);
      setConfig(value);
      setDraftConfig(value);
      setShowConfig(false);
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : 'Endüstriyel kamera ayarları kaydedilemedi.');
    } finally {
      setSavingConfig(false);
    }
  };

  const progress = session.targetQty > 0 ? Math.min(100, (session.currentQty / session.targetQty) * 100) : 0;
  const connected = Boolean(agentStatus?.cameraConnected);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: '30px' }}>
      {/* Top Header */}
      <TTPageHeader
        title="Endüstriyel Kamera Bant Okutma"
        description="Koli etiketi → ürünler → sıradaki koli akışını Local Agent otomatik yönetir."
        breadcrumb="Üretim / Terminal"
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span 
              className={`tt-badge ${connected ? 'tt-badge-success' : agentStatus ? 'tt-badge-warning' : 'tt-badge-danger'}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', height: '32px', padding: '0 10px' }}
            >
              {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
              {connected ? `Kamera Bağlı · ${agentStatus?.captureFramesPerSecond || 0} FPS` : agentStatus ? 'Agent Bağlı · Kamera Bekleniyor' : 'Local Agent Kapalı'}
            </span>
            <button 
              className="btn btn-sm btn-secondary" 
              type="button" 
              onClick={() => { soundEnabledRef.current = !soundEnabled; setSoundEnabled(!soundEnabled); }} 
              style={{ height: '32px', padding: '0 10px', borderRadius: 'var(--radius-sm)' }}
              title={soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
            >
              {soundEnabled ? <Volume2 size={15} style={{ color: 'var(--primary)' }} /> : <VolumeX size={15} />}
            </button>
            <button 
              className="btn btn-sm btn-secondary" 
              type="button" 
              onClick={() => void openConfig()} 
              style={{ height: '32px', padding: '0 12px', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.82rem' }}
            >
              <Settings size={14} /> Ayarlar
            </button>
          </div>
        }
      />

      {(agentError || backendError) && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', fontWeight: 600, fontSize: '0.84rem' }}>
          {backendError || agentError}
          {agentStatus?.pendingEvents ? ` · ${agentStatus.pendingEvents} kod güvenli kuyrukta bekliyor.` : ''}
        </div>
      )}

      {agentStatus?.shadowMode && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-text)', fontWeight: 600, fontSize: '0.84rem' }}>
          Gölge test modu açık: kamera kodları çözüyor ancak backend’e okutma göndermiyor.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 390px', gap: '20px', marginBottom: '20px' }}>
        <div>
          {/* Step 1 & 2 Active Carton Status Card */}
          <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '18px 20px', boxShadow: 'var(--shadow-xs)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span className={`tt-badge ${session.cartonNo ? 'tt-badge-success' : 'tt-badge-primary'}`} style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px' }}>
                  {session.cartonNo ? '2 · ÜRÜNLERİ OKUT' : '1 · KOLİ ETİKETİNİ OKUT'}
                </span>
                <h2 style={{ margin: '8px 0 2px', color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: 800 }}>{session.cartonNo || 'Koli bekleniyor'}</h2>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {session.cartonNo ? `${session.orderNo}${session.productName ? ` · ${session.productName}` : ''}` : 'Ön etiketli koliyi görüş alanına gönderin.'}
                </div>
              </div>
              <div style={{ minWidth: '180px' }}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase' }}>İSTASYON</label>
                <select
                  className="form-input"
                  value={selectedStationId}
                  disabled={Boolean(session.cartonNo || processingEvent)}
                  onChange={event => {
                    selectedStationRef.current = event.target.value;
                    setSelectedStationId(event.target.value);
                    localStorage.setItem('trackTrace_selectedStation', event.target.value);
                  }}
                  style={{ width: '100%', height: '36px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.82rem', fontWeight: 600, backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                >
                  {stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>Koli Doluluğu</span>
              <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }} className="tabular-nums font-mono">{session.currentQty} / {session.targetQty || '-'}</strong>
            </div>
            <div style={{ height: '8px', borderRadius: '999px', background: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: progress >= 100 ? 'var(--success)' : 'var(--primary)', transition: 'width .15s ease' }} />
            </div>
          </div>

          {/* Large Workflow Status Banner Card */}
          <div 
            style={{ 
              borderRadius: 'var(--radius-lg)', 
              padding: '20px', 
              minHeight: '160px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px', 
              background: workflowStatus === 'error' ? 'var(--danger-bg)' : workflowStatus === 'cartonClosed' ? 'var(--success-bg)' : 'var(--primary-light)', 
              border: `1px solid ${workflowStatus === 'error' ? 'var(--danger-border)' : workflowStatus === 'cartonClosed' ? 'var(--success-border)' : 'var(--border-subtle)'}`,
              boxShadow: 'var(--shadow-xs)'
            }}
          >
            {workflowStatus === 'error' ? <XCircle size={44} style={{ color: 'var(--danger)', shrink: 0 }} /> : workflowStatus === 'cartonClosed' ? <CheckCircle2 size={44} style={{ color: 'var(--success)', shrink: 0 }} /> : processingEvent ? <Clock3 size={44} style={{ color: 'var(--primary)', shrink: 0 }} /> : <Barcode size={44} style={{ color: 'var(--primary)', shrink: 0 }} />}
            <div>
              <div style={{ color: 'var(--text-main)', fontSize: '1.15rem', fontWeight: 800, marginBottom: '4px' }}>
                {processingEvent ? 'Kod işleniyor…' : workflowStatus === 'error' ? 'Okutma reddedildi' : workflowStatus === 'cartonClosed' ? 'Koli tamamlandı' : 'Bant akışı hazır'}
              </div>
              <div style={{ color: workflowStatus === 'error' ? 'var(--danger-text)' : 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.4 }}>{message}</div>
              {lastScannedBarcode && (
                <div style={{ marginTop: '8px', display: 'inline-block', padding: '4px 10px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <code style={{ color: 'var(--text-main)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 700 }} className="tabular-nums">
                    {lastScannedBarcode}
                  </code>
                </div>
              )}
              {lastClosedCartonNo && workflowStatus === 'cartonClosed' && (
                <div style={{ marginTop: '6px', color: 'var(--success-text)', fontWeight: 700, fontSize: '0.82rem' }}>
                  Son koli: <strong className="tabular-nums font-mono">{lastClosedCartonNo}</strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Camera Preview Side Card */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-subtle)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)' }}>
              <Eye size={15} style={{ color: 'var(--primary)' }} /> Kamera Önizleme
            </span>
            <span className="tt-badge tt-badge-neutral" style={{ fontSize: '0.7rem' }}>2 FPS</span>
          </div>
          <div style={{ flex: 1, minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617' }}>
            {previewUrl ? <img src={previewUrl} alt="Endüstriyel kamera son karesi" style={{ width: '100%', maxHeight: 240, objectFit: 'contain' }} /> : <Camera size={40} color="#475569" />}
          </div>
          <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
            <Stat icon={<Gauge size={13} />} label="Yakalama" value={`${agentStatus?.captureFramesPerSecond || 0} FPS`} />
            <Stat icon={<Clock3 size={13} />} label="Çözümleme" value={`${agentStatus?.lastDecodeMilliseconds || 0} ms`} />
            <Stat icon={<ShieldCheck size={13} />} label="Kuyruk" value={`${agentStatus?.pendingEvents || 0} kod`} />
            <Stat icon={<Barcode size={13} />} label="Algılanan" value={`${agentStatus?.detectedCodes || 0}`} />
          </div>
        </div>
      </div>

      {/* Real-time Scan Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Son Kamera Okumaları</span>
          <span className="tt-badge tt-badge-neutral" style={{ fontSize: '0.72rem' }}>Canlı Akış</span>
        </div>
        {scanHistory.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Henüz kod işlenmedi.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-modern" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={cell}>Saat</th>
                  <th style={cell}>Kod</th>
                  <th style={cell}>Format</th>
                  <th style={cell}>Koli</th>
                  <th style={cell}>Sonuç</th>
                </tr>
              </thead>
              <tbody>{scanHistory.map(item => (
                <tr key={item.sequence} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={{ ...cell, color: 'var(--text-muted)' }} className="tabular-nums">{item.timestamp}</td>
                  <td style={{ ...cell, maxWidth: 410, wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)' }} className="tabular-nums">{item.rawCode}</td>
                  <td style={{ ...cell, color: 'var(--text-muted)' }}>{item.format}</td>
                  <td style={{ ...cell, fontFamily: 'var(--font-mono)' }} className="tabular-nums">{item.cartonNo}</td>
                  <td style={cell}>
                    <span className={`tt-badge ${item.success ? 'tt-badge-success' : 'tt-badge-danger'}`} style={{ fontSize: '0.72rem', padding: '1px 6px' }}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {showConfig && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ width: 'min(580px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--modal-bg)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border-subtle)' }}>
            <h2 style={{ margin: '0 0 4px', color: 'var(--text-main)', fontSize: '1.15rem', fontWeight: 800 }}>Endüstriyel Kamera Ayarları</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.4, margin: '0 0 16px' }}>Kamera bu bilgisayarda çalıştığı için adres varsayılan olarak localhost’tur. ROI değerleri yalnızca etiketin geçtiği alanı tarayarak hızı artırır.</p>

            {configError && <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 'var(--radius-sm)', marginBottom: '12px', fontSize: '0.82rem' }}>{configError}</div>}
            {draftConfig ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                <Toggle label="Kamera taramasını etkinleştir" checked={draftConfig.enabled} onChange={enabled => setDraftConfig({ ...draftConfig, enabled })} />
                <Toggle label="Gölge test modu (backend’e gönderme)" checked={draftConfig.shadowMode} onChange={shadowMode => setDraftConfig({ ...draftConfig, shadowMode })} />
                <Field label="Kamera son görüntü adresi"><input className="form-input" style={{ width: '100%', height: '36px', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }} value={draftConfig.cameraUrl} onChange={event => setDraftConfig({ ...draftConfig, cameraUrl: event.target.value })} /></Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <NumberField label="Kare aralığı (ms)" value={draftConfig.pollIntervalMs} min={40} max={1000} onChange={pollIntervalMs => setDraftConfig({ ...draftConfig, pollIntervalMs })} />
                  <NumberField label="Zaman aşımı (ms)" value={draftConfig.requestTimeoutMs} min={250} max={5000} onChange={requestTimeoutMs => setDraftConfig({ ...draftConfig, requestTimeoutMs })} />
                </div>
                <NumberField label="Aynı kodu yeniden kurma için boş kare" value={draftConfig.releaseAfterMissedFrames} min={1} max={20} onChange={releaseAfterMissedFrames => setDraftConfig({ ...draftConfig, releaseAfterMissedFrames })} />
                <div>
                  <div style={{ color: 'var(--text-main)', fontWeight: 700, fontSize: '0.78rem', marginBottom: '6px' }}>Tarama Alanı ROI (%)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    <NumberField label="Sol" value={draftConfig.roiXPercent} min={0} max={99} onChange={roiXPercent => setDraftConfig({ ...draftConfig, roiXPercent })} />
                    <NumberField label="Üst" value={draftConfig.roiYPercent} min={0} max={99} onChange={roiYPercent => setDraftConfig({ ...draftConfig, roiYPercent })} />
                    <NumberField label="Genişlik" value={draftConfig.roiWidthPercent} min={1} max={100} onChange={roiWidthPercent => setDraftConfig({ ...draftConfig, roiWidthPercent })} />
                    <NumberField label="Yükseklik" value={draftConfig.roiHeightPercent} min={1} max={100} onChange={roiHeightPercent => setDraftConfig({ ...draftConfig, roiHeightPercent })} />
                  </div>
                </div>
              </div>
            ) : <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Ayarlar yükleniyor…</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
              <button className="btn btn-sm btn-secondary" type="button" style={{ height: '34px', padding: '0 14px', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.82rem' }} onClick={() => { setShowConfig(false); setDraftConfig(config); }}>Vazgeç</button>
              <button className="btn btn-sm btn-primary" type="button" style={{ height: '34px', padding: '0 14px', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.82rem' }} disabled={!draftConfig || savingConfig} onClick={() => void saveConfig()}>{savingConfig ? 'Kaydediliyor…' : 'Kaydet'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const cell: React.CSSProperties = { padding: '9px 12px', verticalAlign: 'middle' };

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ background: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', border: '1px solid var(--border-subtle)' }}>
    <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem' }}>{icon}{label}</div>
    <div style={{ color: 'var(--text-main)', fontWeight: 700, marginTop: '2px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }} className="tabular-nums">{value}</div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label><span style={{ display: 'block', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.78rem', marginBottom: '4px' }}>{label}</span>{children}</label>
);

const NumberField: React.FC<{ label: string; value: number; min: number; max: number; onChange: (value: number) => void }> = ({ label, value, min, max, onChange }) => (
  <Field label={label}><input className="form-input" style={{ width: '100%', height: '34px', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }} type="number" value={value} min={min} max={max} onChange={event => onChange(Number(event.target.value))} /></Field>
);

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} style={{ width: '15px', height: '15px' }} />{label}
  </label>
);

export default DigiEyeScan;
