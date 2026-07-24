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
  const statusColor = connected ? '#166534' : agentStatus ? '#9a3412' : '#991b1b';
  const statusBackground = connected ? '#f0fdf4' : agentStatus ? '#fff7ed' : '#fef2f2';

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1280, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Camera size={26} color="#2563eb" /> Endüstriyel Kamera Bant Okutma
          </h1>
          <p style={{ color: '#64748b', margin: '5px 0 0', fontSize: '0.875rem' }}>
            Koli etiketi → ürünler → sıradaki koli akışını Local Agent otomatik yönetir.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 20, background: statusBackground, color: statusColor, border: `1px solid ${connected ? '#bbf7d0' : '#fed7aa'}`, fontWeight: 700, fontSize: '0.82rem' }}>
            {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
            {connected ? `Kamera bağlı · ${agentStatus?.captureFramesPerSecond || 0} FPS` : agentStatus ? 'Agent bağlı · kamera bekleniyor' : 'Local Agent kapalı'}
          </div>
          <button className="btn" type="button" onClick={() => { soundEnabledRef.current = !soundEnabled; setSoundEnabled(!soundEnabled); }} style={{ border: '1px solid #cbd5e1', background: '#fff', color: soundEnabled ? '#2563eb' : '#94a3b8' }}>
            {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button className="btn" type="button" onClick={() => void openConfig()} style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#334155', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Settings size={16} /> Ayarlar
          </button>
        </div>
      </div>

      {(agentError || backendError) && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 18, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontWeight: 600, fontSize: '0.875rem' }}>
          {backendError || agentError}
          {agentStatus?.pendingEvents ? ` · ${agentStatus.pendingEvents} kod güvenli kuyrukta bekliyor.` : ''}
        </div>
      )}

      {agentStatus?.shadowMode && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 18, background: '#fffbeb', border: '1px solid #fde68a', color: '#854d0e', fontWeight: 600, fontSize: '0.875rem' }}>
          Gölge test modu açık: kamera kodları çözüyor ancak backend’e okutma göndermiyor.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 390px', gap: 24, marginBottom: 24 }}>
        <div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(15,23,42,.04)', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 18 }}>
              <div>
                <span style={{ display: 'inline-block', padding: '4px 9px', borderRadius: 6, color: '#fff', background: session.cartonNo ? '#10b981' : '#2563eb', fontSize: '0.75rem', fontWeight: 800 }}>
                  {session.cartonNo ? '2 · ÜRÜNLERİ OKUT' : '1 · KOLİ ETİKETİNİ OKUT'}
                </span>
                <h2 style={{ margin: '10px 0 2px', color: '#0f172a', fontSize: '1.35rem' }}>{session.cartonNo || 'Koli bekleniyor'}</h2>
                <div style={{ color: '#64748b', fontSize: '0.84rem' }}>
                  {session.cartonNo ? `${session.orderNo}${session.productName ? ` · ${session.productName}` : ''}` : 'Ön etiketli koliyi görüş alanına gönderin.'}
                </div>
              </div>
              <div style={{ minWidth: 170 }}>
                <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: 5 }}>İSTASYON</label>
                <select
                  className="form-control"
                  value={selectedStationId}
                  disabled={Boolean(session.cartonNo || processingEvent)}
                  onChange={event => {
                    selectedStationRef.current = event.target.value;
                    setSelectedStationId(event.target.value);
                    localStorage.setItem('trackTrace_selectedStation', event.target.value);
                  }}
                  style={{ borderRadius: 8, fontWeight: 600 }}
                >
                  {stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
              <span style={{ color: '#475569', fontSize: '0.84rem', fontWeight: 700 }}>Koli doluluğu</span>
              <strong style={{ color: '#0f172a', fontSize: '1.1rem' }}>{session.currentQty} / {session.targetQty || '-'}</strong>
            </div>
            <div style={{ height: 12, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: progress >= 100 ? '#10b981' : '#2563eb', transition: 'width .15s ease' }} />
            </div>
          </div>

          <div style={{ borderRadius: 16, padding: 24, minHeight: 172, display: 'flex', alignItems: 'center', gap: 18, background: workflowStatus === 'error' ? '#fef2f2' : workflowStatus === 'cartonClosed' ? '#ecfdf5' : '#eff6ff', border: `1px solid ${workflowStatus === 'error' ? '#fecaca' : workflowStatus === 'cartonClosed' ? '#a7f3d0' : '#bfdbfe'}` }}>
            {workflowStatus === 'error' ? <XCircle size={50} color="#dc2626" /> : workflowStatus === 'cartonClosed' ? <CheckCircle2 size={50} color="#059669" /> : processingEvent ? <Clock3 size={50} color="#2563eb" /> : <Barcode size={50} color="#2563eb" />}
            <div>
              <div style={{ color: '#0f172a', fontSize: '1.2rem', fontWeight: 800, marginBottom: 5 }}>
                {processingEvent ? 'Kod işleniyor…' : workflowStatus === 'error' ? 'Okutma reddedildi' : workflowStatus === 'cartonClosed' ? 'Koli tamamlandı' : 'Bant akışı hazır'}
              </div>
              <div style={{ color: workflowStatus === 'error' ? '#991b1b' : '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>{message}</div>
              {lastScannedBarcode && <code style={{ display: 'block', marginTop: 9, color: '#334155', wordBreak: 'break-all' }}>{lastScannedBarcode}</code>}
              {lastClosedCartonNo && workflowStatus === 'cartonClosed' && <div style={{ marginTop: 8, color: '#047857', fontWeight: 700 }}>Son koli: {lastClosedCartonNo}</div>}
            </div>
          </div>
        </div>

        <div style={{ background: '#0f172a', borderRadius: 16, overflow: 'hidden', color: '#fff', minHeight: 410, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}><Eye size={17} /> Agent kamera önizleme</span>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>2 FPS önizleme</span>
          </div>
          <div style={{ flex: 1, minHeight: 270, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617' }}>
            {previewUrl ? <img src={previewUrl} alt="Endüstriyel kamera son karesi" style={{ width: '100%', maxHeight: 300, objectFit: 'contain' }} /> : <Camera size={48} color="#475569" />}
          </div>
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.78rem' }}>
            <Stat icon={<Gauge size={14} />} label="Yakalama" value={`${agentStatus?.captureFramesPerSecond || 0} FPS`} />
            <Stat icon={<Clock3 size={14} />} label="Çözümleme" value={`${agentStatus?.lastDecodeMilliseconds || 0} ms`} />
            <Stat icon={<ShieldCheck size={14} />} label="Kuyruk" value={`${agentStatus?.pendingEvents || 0} kod`} />
            <Stat icon={<Barcode size={14} />} label="Algılanan" value={`${agentStatus?.detectedCodes || 0}`} />
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', fontWeight: 800, color: '#0f172a' }}>Son kamera okumaları</div>
        {scanHistory.length === 0 ? (
          <div style={{ padding: 26, textAlign: 'center', color: '#94a3b8' }}>Henüz kod işlenmedi.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead><tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left' }}><th style={cell}>Saat</th><th style={cell}>Kod</th><th style={cell}>Format</th><th style={cell}>Koli</th><th style={cell}>Sonuç</th></tr></thead>
              <tbody>{scanHistory.map(item => (
                <tr key={item.sequence} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={cell}>{item.timestamp}</td>
                  <td style={{ ...cell, maxWidth: 410, wordBreak: 'break-all', fontFamily: 'monospace' }}>{item.rawCode}</td>
                  <td style={cell}>{item.format}</td>
                  <td style={cell}>{item.cartonNo}</td>
                  <td style={{ ...cell, color: item.success ? '#047857' : '#b91c1c', fontWeight: 700 }}>{item.status}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {showConfig && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ width: 'min(620px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 24px 60px rgba(15,23,42,.28)' }}>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem' }}>Endüstriyel Kamera Ayarları</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.5 }}>Kamera bu bilgisayarda çalıştığı için adres varsayılan olarak localhost’tur. ROI değerleri yalnızca etiketin geçtiği alanı tarayarak hızı artırır.</p>

            {configError && <div style={{ padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, marginBottom: 12 }}>{configError}</div>}
            {draftConfig ? (
              <div style={{ display: 'grid', gap: 15 }}>
                <Toggle label="Kamera taramasını etkinleştir" checked={draftConfig.enabled} onChange={enabled => setDraftConfig({ ...draftConfig, enabled })} />
                <Toggle label="Gölge test modu (backend’e gönderme)" checked={draftConfig.shadowMode} onChange={shadowMode => setDraftConfig({ ...draftConfig, shadowMode })} />
                <Field label="Kamera son görüntü adresi"><input className="form-control" value={draftConfig.cameraUrl} onChange={event => setDraftConfig({ ...draftConfig, cameraUrl: event.target.value })} /></Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <NumberField label="Kare aralığı (ms)" value={draftConfig.pollIntervalMs} min={40} max={1000} onChange={pollIntervalMs => setDraftConfig({ ...draftConfig, pollIntervalMs })} />
                  <NumberField label="Zaman aşımı (ms)" value={draftConfig.requestTimeoutMs} min={250} max={5000} onChange={requestTimeoutMs => setDraftConfig({ ...draftConfig, requestTimeoutMs })} />
                </div>
                <NumberField label="Aynı kodu yeniden kurma için boş kare" value={draftConfig.releaseAfterMissedFrames} min={1} max={20} onChange={releaseAfterMissedFrames => setDraftConfig({ ...draftConfig, releaseAfterMissedFrames })} />
                <div>
                  <div style={{ color: '#334155', fontWeight: 700, fontSize: '0.8rem', marginBottom: 7 }}>Tarama alanı ROI (%)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    <NumberField label="Sol" value={draftConfig.roiXPercent} min={0} max={99} onChange={roiXPercent => setDraftConfig({ ...draftConfig, roiXPercent })} />
                    <NumberField label="Üst" value={draftConfig.roiYPercent} min={0} max={99} onChange={roiYPercent => setDraftConfig({ ...draftConfig, roiYPercent })} />
                    <NumberField label="Genişlik" value={draftConfig.roiWidthPercent} min={1} max={100} onChange={roiWidthPercent => setDraftConfig({ ...draftConfig, roiWidthPercent })} />
                    <NumberField label="Yükseklik" value={draftConfig.roiHeightPercent} min={1} max={100} onChange={roiHeightPercent => setDraftConfig({ ...draftConfig, roiHeightPercent })} />
                  </div>
                </div>
              </div>
            ) : <div style={{ padding: 20, color: '#64748b' }}>Ayarlar yükleniyor…</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
              <button className="btn btn-secondary" type="button" onClick={() => { setShowConfig(false); setDraftConfig(config); }}>Vazgeç</button>
              <button className="btn btn-primary" type="button" disabled={!draftConfig || savingConfig} onClick={() => void saveConfig()}>{savingConfig ? 'Kaydediliyor…' : 'Kaydet'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const cell: React.CSSProperties = { padding: '11px 14px', verticalAlign: 'top' };

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ background: '#1e293b', borderRadius: 8, padding: '8px 10px' }}>
    <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5 }}>{icon}{label}</div>
    <div style={{ color: '#f8fafc', fontWeight: 800, marginTop: 3 }}>{value}</div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label><span style={{ display: 'block', color: '#334155', fontWeight: 700, fontSize: '0.8rem', marginBottom: 6 }}>{label}</span>{children}</label>
);

const NumberField: React.FC<{ label: string; value: number; min: number; max: number; onChange: (value: number) => void }> = ({ label, value, min, max, onChange }) => (
  <Field label={label}><input className="form-control" type="number" value={value} min={min} max={max} onChange={event => onChange(Number(event.target.value))} /></Field>
);

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#334155', fontWeight: 650, fontSize: '0.86rem' }}>
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} style={{ width: 17, height: 17 }} />{label}
  </label>
);

export default DigiEyeScan;
