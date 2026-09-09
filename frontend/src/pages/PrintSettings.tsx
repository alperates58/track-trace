import React, { useState, useEffect } from 'react';
import { getPrintProvider } from '../services/printProvider';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { TTCard, TTPageHeader, TTButton } from '../components/common';
import { Settings, MonitorPlay, FileDown, Server, Info, Copy, Check, Save, Printer } from 'lucide-react';

interface PrintConfig {
  printMode: 'browser' | 'pdf' | 'zpl' | 'agent';
  defaultLabelType: 'carton' | 'pallet';
  defaultFormat: 'pdf' | 'zpl';
  autoPrintCarton: boolean;
  autoPrintPallet: boolean;
  showNotification: boolean;
}

const DEFAULT_CONFIG: PrintConfig = {
  printMode: 'browser',
  defaultLabelType: 'carton',
  defaultFormat: 'pdf',
  autoPrintCarton: true,
  autoPrintPallet: true,
  showNotification: true
};

const AGENT_DOWNLOAD_URL = import.meta.env.VITE_AGENT_DOWNLOAD_URL
  || 'https://github.com/alperates58/track-trace/raw/refs/heads/main/frontend/public/downloads/TrackTraceLocalAgentSetup.exe';

type AgentConnectionStatus = 'idle' | 'testing' | 'online' | 'invalid-token' | 'offline' | 'missing-token';
type InlineMessage = { text: string; type: 'success' | 'error' | 'info' };

export const PrintSettings: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [globalConfig, setGlobalConfig] = useState<PrintConfig>(DEFAULT_CONFIG);
  const [localConfig, setLocalConfig] = useState<PrintConfig | null>(null);
  const [isUsingLocalOverride, setIsUsingLocalOverride] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [testMessage, setTestMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [agentToken, setAgentToken] = useState(localStorage.getItem('tt_agent_token') || '');
  const [tokenSaveMessage, setTokenSaveMessage] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentConnectionStatus>(agentToken ? 'idle' : 'missing-token');
  const [agentStatusDetail, setAgentStatusDetail] = useState<string | null>(null);
  const [agentPrinters, setAgentPrinters] = useState<string[]>([]);
  const [selectedAgentPrinter, setSelectedAgentPrinter] = useState<string>('');
  const [downloadMessage, setDownloadMessage] = useState<InlineMessage | null>(null);

  const handleTokenChange = (val: string) => {
    setAgentToken(val);
    const trimmed = val.trim();
    if (trimmed) {
      localStorage.setItem('tt_agent_token', trimmed);
    } else {
      localStorage.removeItem('tt_agent_token');
    }
    setTokenSaveMessage(null);
    setAgentStatus(trimmed ? 'idle' : 'missing-token');
    setAgentStatusDetail(null);
  };

  const handleSaveAgentToken = () => {
    const trimmed = agentToken.trim();
    if (!trimmed) {
      localStorage.removeItem('tt_agent_token');
      setAgentStatus('missing-token');
      setAgentStatusDetail('Token girip kaydedin.');
      setTokenSaveMessage('Token boş bırakılamaz');
      return;
    }

    localStorage.setItem('tt_agent_token', trimmed);
    setAgentToken(trimmed);
    setTokenSaveMessage('Token kaydedildi');
    setTimeout(() => setTokenSaveMessage(null), 2500);
  };

  const handleTestAgentConnection = async () => {
    const token = agentToken.trim() || localStorage.getItem('tt_agent_token')?.trim() || '';

    if (!token) {
      setAgentStatus('missing-token');
      setAgentStatusDetail('Token girip kaydedin.');
      return;
    }

    setAgentStatus('testing');
    setAgentStatusDetail(null);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/agent/status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        setAgentStatus('invalid-token');
        setAgentStatusDetail('Token hatalı.');
        return;
      }

      if (!res.ok) {
        setAgentStatus('offline');
        setAgentStatusDetail('Agent kapalı veya erişilemiyor.');
        return;
      }

      const data = await res.json().catch(() => null);
      setAgentStatus('online');
      setAgentStatusDetail(data?.printer ? `Yazıcı: ${data.printer}` : 'Agent çalışıyor.');
      if (data?.printer) setSelectedAgentPrinter(data.printer);

      try {
        const pRes = await fetch('http://127.0.0.1:5000/api/agent/printers', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (pRes.ok) {
          const list = await pRes.json();
          setAgentPrinters(list);
        }
      } catch(e) {}
    } catch {
      setAgentStatus('offline');
      setAgentStatusDetail('Agent kapalı veya erişilemiyor.');
    }
  };

  const handleUpdateAgentPrinter = async (printerName: string) => {
    setSelectedAgentPrinter(printerName);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/agent/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${agentToken}`
        },
        body: JSON.stringify({ defaultPrinter: printerName })
      });
      if (res.ok) {
        setAgentStatusDetail(`Yazıcı: ${printerName}`);
        alert("Yazıcı başarıyla güncellendi.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadAgent = () => {
    setDownloadMessage({ text: 'GitHub üzerinden indirme başlatıldı', type: 'success' });

    const link = document.createElement('a');
    link.href = AGENT_DOWNLOAD_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/api/settings/GlobalPrintConfig');
        if (res && res.value) {
          setGlobalConfig({ ...DEFAULT_CONFIG, ...JSON.parse(res.value) });
        }
      } catch (e: any) {
        // Ignore 404 since it means no global config exists yet
        if (e?.status !== 404 && e?.response?.status !== 404) {
          console.error('Failed to fetch global print settings', e);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();

    const saved = localStorage.getItem('trackTrace_printSettings');
    if (saved) {
      try {
        setLocalConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
        setIsUsingLocalOverride(true);
      } catch (e) {}
    }
  }, []);

  const config = isUsingLocalOverride ? (localConfig || DEFAULT_CONFIG) : globalConfig;
  const agentStatusView = {
    idle: {
      text: agentToken.trim() ? 'Bağlantı Kurulmadı (Test Yapınız)' : 'Token Eksik',
      color: agentToken.trim() ? '#cbd5e1' : '#ef4444'
    },
    testing: { text: 'Bağlantı test ediliyor...', color: '#3b82f6' },
    online: { text: 'Agent çalışıyor', color: '#16a34a' },
    'invalid-token': { text: 'Token hatalı', color: '#ef4444' },
    offline: { text: 'Agent kapalı veya erişilemiyor', color: '#ef4444' },
    'missing-token': { text: 'Token Eksik', color: '#ef4444' }
  }[agentStatus];

  const handleTestPrint = async () => {
    setTestMessage(null);
    try {
      if (config.printMode === 'agent' && !agentToken) {
        throw new Error("Agent eşleştirme (pairing) token'ı eksik, 'Local Agent' sekmesinden giriniz.");
      }
      const provider = getPrintProvider(config.printMode);
      const testZpl = `^XA^CI28^PW800^LL640^FO50,50^A0N,44,44^FDTEST PRINT^FS^FO50,110^A0N,28,28^FDBaglanti: Basarili^FS^FO50,150^A0N,24,24^FDTarih: ${new Date().toLocaleString('tr-TR')}^FS^FO50,200^GB700,3,3^FS^FO50,230^A0N,20,20^FDTrack & Trace Termal Yazici Testi^FS^XZ\n`;
      await provider.testPrint(testZpl);
      setTestMessage({ text: 'Test yazdırma başarılı!', type: 'success' });
    } catch (err: any) {
      setTestMessage({ text: err.message || 'Test yazdırma başarısız.', type: 'error' });
    }
  };

  const handleSaveLocal = (newConfig: Partial<PrintConfig>) => {
    const updated = { ...config, ...newConfig };
    setLocalConfig(updated);
    setIsUsingLocalOverride(true);
    localStorage.setItem('trackTrace_printSettings', JSON.stringify(updated));
  };

  const handleSaveGlobal = async (newConfig: Partial<PrintConfig>) => {
    const updated = { ...config, ...newConfig };
    try {
      await api.put('/api/settings/GlobalPrintConfig', { key: 'GlobalPrintConfig', value: JSON.stringify(updated) });
      setGlobalConfig(updated);
      alert('Global ayarlar başarıyla kaydedildi.');
    } catch (e) {
      alert('Global ayarlar kaydedilemedi.');
    }
  };

  const clearLocalOverride = () => {
    localStorage.removeItem('trackTrace_printSettings');
    setLocalConfig(null);
    setIsUsingLocalOverride(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (user?.role !== 'Admin') {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>Yetkisiz Erişim</h3>
          <p>Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="page-container">Yükleniyor...</div>;
  }

  return (
    <div className="page-container print-settings-page" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <TTPageHeader 
        title="Yazdırma Ayarları" 
        description="Sistem genelinde kullanılacak çoklu yazdırma modu, yerel agent ve etiket yapılandırmaları" 
      />

      <div className="print-settings-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div className="stat-card-modern" style={{ padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ color: 'var(--text-secondary, var(--text-muted))', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Ayar Kaynağı</div>
          <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: isUsingLocalOverride ? '#d97706' : 'var(--primary)' }}>
            {isUsingLocalOverride ? 'Local Override (Bu PC)' : 'Global Default'}
          </div>
          {isUsingLocalOverride && (
            <button 
              onClick={clearLocalOverride}
              style={{ fontSize: '0.75rem', color: '#dc2626', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', marginTop: '6px', fontWeight: 600 }}
            >
              Yerel ayarı temizle
            </button>
          )}
        </div>

        <div className="stat-card-modern" style={{ padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ color: 'var(--text-secondary, var(--text-muted))', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Aktif Yazdırma Modu</div>
          <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary, var(--text-main))' }}>
            {config.printMode === 'browser' && <><MonitorPlay size={16} style={{ color: 'var(--primary)' }} /> Browser Auto Print</>}
            {config.printMode === 'pdf' && <><FileDown size={16} style={{ color: 'var(--primary)' }} /> PDF Download</>}
            {config.printMode === 'zpl' && <><FileDown size={16} style={{ color: 'var(--primary)' }} /> ZPL Download</>}
            {config.printMode === 'agent' && <><Server size={16} style={{ color: 'var(--primary)' }} /> Local Agent</>}
          </div>
        </div>
        
        <div className="stat-card-modern" style={{ padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ color: 'var(--text-secondary, var(--text-muted))', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Varsayılan Etiket</div>
          <div className="font-mono" style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary, var(--text-main))' }}>{config.defaultFormat.toUpperCase()}</div>
        </div>

        <div className="stat-card-modern" style={{ padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ color: 'var(--text-secondary, var(--text-muted))', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Otomatik Yazdırma</div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: config.autoPrintCarton ? '#10b981' : 'var(--text-secondary, var(--text-muted))' }}>
            {config.autoPrintCarton ? 'Aktif (Koli)' : 'Pasif'}
          </div>
        </div>

        <div className="stat-card-modern" style={{ padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ color: 'var(--text-secondary, var(--text-muted))', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Son Baskı Durumu</div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#10b981' }}>Başarılı</div>
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle, var(--border-color))', borderRadius: 'var(--radius-md, 8px)', overflow: 'hidden' }}>
        <div className="print-settings-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle, var(--border-color))', overflowX: 'auto', padding: '0 8px' }}>
          {[
            { id: 'general', label: 'Genel Ayarlar', icon: <Settings size={15} /> },
            { id: 'browser', label: 'Browser Auto Print', icon: <MonitorPlay size={15} /> },
            { id: 'pdfzpl', label: 'PDF / ZPL', icon: <FileDown size={15} /> },
            { id: 'agent', label: 'Local Agent', icon: <Server size={15} /> },
            { id: 'guide', label: 'Kurulum Rehberi', icon: <Info size={15} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 18px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary, var(--text-muted))',
                fontWeight: activeTab === tab.id ? 600 : 500,
                fontSize: '0.86rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="print-settings-content" style={{ padding: '24px' }}>
          {activeTab === 'general' && (
            <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', marginBottom: '6px', display: 'block' }}>Varsayılan Yazdırma Modu</label>
                <select 
                  className="form-input" 
                  value={config.printMode} 
                  onChange={(e) => handleSaveLocal({ printMode: e.target.value as any })}
                  style={{ height: '36px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle, var(--border-color))' }}
                >
                  <option value="browser">Browser Auto Print</option>
                  <option value="pdf">PDF Download</option>
                  <option value="zpl">ZPL Download</option>
                  <option value="agent" disabled={!agentToken}>Local Print Agent</option>
                </select>
                <small style={{ color: 'var(--text-secondary, var(--text-muted))', marginTop: '4px', display: 'block', fontSize: '0.78rem' }}>
                  Bu ayar tarayıcı bazlıdır ve o anki cihazın davranışını belirler.
                </small>
                {!agentToken && (
                  <small style={{ color: '#d97706', marginTop: '4px', display: 'block', fontSize: '0.78rem' }}>
                    Local Print Agent modunu seçebilmek için 'Local Agent' sekmesinden Pairing Token girmelisiniz.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', marginBottom: '6px', display: 'block' }}>Varsayılan Etiket Tipi</label>
                <select 
                  className="form-input" 
                  value={config.defaultLabelType}
                  onChange={(e) => handleSaveLocal({ defaultLabelType: e.target.value as any })}
                  style={{ height: '36px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle, var(--border-color))' }}
                >
                  <option value="carton">Koli Etiketi</option>
                  <option value="pallet">Palet Etiketi</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', marginBottom: '6px', display: 'block' }}>Varsayılan Format</label>
                <select 
                  className="form-input" 
                  value={config.defaultFormat}
                  onChange={(e) => handleSaveLocal({ defaultFormat: e.target.value as any })}
                  style={{ height: '36px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle, var(--border-color))' }}
                >
                  <option value="pdf">PDF</option>
                  <option value="zpl">ZPL</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: config.printMode === 'pdf' ? 'not-allowed' : 'pointer', opacity: config.printMode === 'pdf' ? 0.6 : 1, fontSize: '0.85rem' }}>
                  <input 
                    type="checkbox" 
                    checked={config.printMode === 'pdf' ? false : config.autoPrintCarton}
                    disabled={config.printMode === 'pdf'}
                    onChange={(e) => handleSaveLocal({ autoPrintCarton: e.target.checked })}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  Koli tamamlanınca otomatik yazdır
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: config.printMode === 'pdf' ? 'not-allowed' : 'pointer', opacity: config.printMode === 'pdf' ? 0.6 : 1, fontSize: '0.85rem' }}>
                  <input 
                    type="checkbox" 
                    checked={config.printMode === 'pdf' ? false : config.autoPrintPallet}
                    disabled={config.printMode === 'pdf'}
                    onChange={(e) => handleSaveLocal({ autoPrintPallet: e.target.checked })}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  Palet kapatılınca otomatik yazdır
                </label>
                
                {config.printMode === 'pdf' && (
                  <div style={{ fontSize: '0.8rem', color: '#d97706', marginTop: '-4px', marginLeft: '24px' }}>
                    PDF Download modunda otomatik yazdırma desteklenmez. Etiketi manuel olarak indirip yazdırın.
                  </div>
                )}
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input 
                    type="checkbox" 
                    checked={config.showNotification}
                    onChange={(e) => handleSaveLocal({ showNotification: e.target.checked })}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  Yazdırma sonrası bildirim göster
                </label>
              </div>

              <div className="print-settings-actions" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <TTButton 
                  variant="primary" 
                  size="md"
                  onClick={() => handleSaveGlobal(config)}
                  icon={<Save size={14} />}
                >
                  Global Olarak Kaydet
                </TTButton>
                <TTButton 
                  variant="secondary" 
                  size="md"
                  onClick={handleTestPrint}
                  icon={<Printer size={14} />}
                >
                  Test Etiketi Yazdır
                </TTButton>
              </div>

              {testMessage && (
                <div style={{ padding: '10px 14px', marginTop: '12px', borderRadius: 'var(--radius-sm, 6px)', backgroundColor: testMessage.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${testMessage.type === 'success' ? '#bbf7d0' : '#fecaca'}`, color: testMessage.type === 'success' ? '#16a34a' : '#ef4444', fontSize: '0.85rem' }}>
                  {testMessage.text}
                </div>
              )}
            </div>
          )}

          {activeTab === 'browser' && (
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>Browser Auto Print</h3>
              <p style={{ color: 'var(--text-secondary, var(--text-muted))', marginBottom: '20px', fontSize: '0.85rem' }}>
                Bu yöntem Chrome'un otomatik yazdırma modu ve varsayılan yazıcı ayarı ile çalışır. 
                TrackTrace etiketi tarayıcıda açar, Chrome otomatik olarak seçili yazıcıya gönderir.
              </p>

              <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md, 8px)', marginBottom: '20px', border: '1px solid var(--border-subtle, var(--border-color))' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>Kurulum Adımları</h4>
                <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary, var(--text-muted))' }}>
                  <li>Argox / Zebra yazıcı sürücüsünü kur.</li>
                  <li>Argox Printer Tool veya üreticinin yazıcı aracını kur.</li>
                  <li>Windows'ta ilgili yazıcıyı varsayılan yazıcı yap.</li>
                  <li>Chrome kısayolunu oluştur.</li>
                  <li>Chrome kısayol hedef alanına aşağıdaki parametreleri ekle:</li>
                </ol>
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', background: 'var(--bg-card)', padding: '10px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle, var(--border-color))', alignItems: 'center' }}>
                  <code className="font-mono" style={{ flex: 1, wordBreak: 'break-all', fontSize: '0.78rem' }}>
                    "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --disable-print-preview --printer="ARGOX CP-2140"
                  </code>
                  <button 
                    onClick={() => copyToClipboard('"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --kiosk-printing --disable-print-preview --printer="ARGOX CP-2140"')}
                    style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, var(--text-muted))' }}
                  >
                    {copied ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />}
                  </button>
                </div>
                <small style={{ color: 'var(--text-secondary, var(--text-muted))', display: 'block', marginTop: '8px', fontSize: '0.75rem' }}>
                  Not: Bazı Chrome sürümlerinde --printer parametresi çalışmayabilir. Bu durumda Windows varsayılan yazıcısı kullanılmalıdır.
                </small>
              </div>

              <div style={{ padding: '14px', borderLeft: '4px solid #f59e0b', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '0 6px 6px 0' }}>
                <h4 style={{ margin: '0 0 6px 0', color: '#b45309', fontSize: '0.85rem', fontWeight: 700 }}>Uyarılar</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary, var(--text-muted))', fontSize: '0.8rem' }}>
                  <li>Yazıcı adı Windows'taki tam yazıcı adıyla aynı olmalı.</li>
                  <li>Chrome arka planda açık kalmışsa kapatıp yeniden aç.</li>
                  <li>Varsayılan yazıcı değişirse otomatik baskı farklı yazıcıya gidebilir.</li>
                  <li>Tarayıcı izinleri veya pop-up engelleyici baskıyı etkileyebilir.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'pdfzpl' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div style={{ background: 'var(--bg-main)', padding: '20px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))' }}>
                <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>
                  <FileDown size={18} style={{ color: 'var(--primary)' }} /> PDF Download
                </h3>
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary, var(--text-muted))', fontSize: '0.82rem' }}>
                  <li>Kullanıcı etiketi PDF olarak indirir.</li>
                  <li>Kendi PDF görüntüleyicisi üzerinden manuel yazdırır.</li>
                  <li>En güvenli ve donanım bağımsız (en uyumlu) yöntemdir.</li>
                  <li>Özel driver gerektirmez, tüm ofis ve depo yazıcılarında çalışır.</li>
                </ul>
              </div>

              <div style={{ background: 'var(--bg-main)', padding: '20px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))' }}>
                <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>
                  <FileDown size={18} style={{ color: 'var(--primary)' }} /> ZPL Download
                </h3>
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary, var(--text-muted))', fontSize: '0.82rem' }}>
                  <li>Zebra / Argox PPLZ destekli cihazlar için ham ZPL çıktısı alınır.</li>
                  <li>Teknik kullanıcılar için uygundur.</li>
                  <li>ZPL Viewer veya üretici aracı ile test edilebilir.</li>
                  <li>Üzerinde manuel kod değişikliği yapılarak şablon testleri gerçekleştirilebilir.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'agent' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>Local Print Agent</h3>
                <TTButton 
                  variant="primary"
                  size="md"
                  onClick={handleDownloadAgent}
                  icon={<FileDown size={16} />}
                >
                  GitHub'dan Agent İndir
                </TTButton>
              </div>
              <p style={{ color: 'var(--text-secondary, var(--text-muted))', marginBottom: '16px', fontSize: '0.85rem' }}>
                Tarayıcı kısıtlarından bağımsız olarak yerel yazıcınıza doğrudan yazdırmak için kullanılır. 
                Bilgisayarınızda çalışan TrackTrace Local Agent ile güvenli haberleşme sağlar.
                <strong> Her yazdırma bilgisayarına Local Agent ayrı kurulmalıdır. </strong>
                Kurulum yapılmadıysa Browser Auto Print kullanılmaya devam edilebilir.
              </p>

              {downloadMessage && (
                <div style={{
                  padding: '10px 14px',
                  marginBottom: '16px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  backgroundColor: downloadMessage.type === 'success' ? '#f0fdf4' : downloadMessage.type === 'error' ? '#fef2f2' : '#eff6ff',
                  border: `1px solid ${downloadMessage.type === 'success' ? '#bbf7d0' : downloadMessage.type === 'error' ? '#fecaca' : '#bfdbfe'}`,
                  color: downloadMessage.type === 'success' ? '#16a34a' : downloadMessage.type === 'error' ? '#ef4444' : '#2563eb',
                  fontSize: '0.82rem'
                }}>
                  {downloadMessage.text}
                </div>
              )}

              <div style={{ background: 'var(--bg-main)', padding: '20px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))' }}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', marginBottom: '6px', display: 'block' }}>
                    Agent Pairing Token <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Local Agent kurulumu bittiğinde ekranda gösterilen token'ı buraya yapıştırın"
                      value={agentToken}
                      onChange={(e) => handleTokenChange(e.target.value)}
                      style={{ flex: '1 1 320px', height: '36px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle, var(--border-color))' }}
                    />
                    <TTButton
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={handleSaveAgentToken}
                    >
                      Kaydet
                    </TTButton>
                  </div>
                  {tokenSaveMessage && (
                    <small style={{
                      color: tokenSaveMessage.includes('kaydedildi') ? '#10b981' : '#dc2626',
                      marginTop: '6px',
                      display: 'block',
                      fontWeight: 600,
                      fontSize: '0.78rem'
                    }}>
                      {tokenSaveMessage}
                    </small>
                  )}
                  <small style={{ color: 'var(--text-secondary, var(--text-muted))', marginTop: '6px', display: 'block', fontSize: '0.75rem' }}>
                    Agent ile güvenli bağlantı kurmak için zorunludur. Local Agent kurulumunu tamamladığınızda son ekranda karşınıza çıkan Pairing Token değerini kopyalayıp buraya yapıştırın. Bu işlem cihaz başına bir kez yapılır.
                  </small>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle, var(--border-color))', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-primary, var(--text-main))' }}>Agent Bağlantı Durumu</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary, var(--text-muted))', fontSize: '0.82rem' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: agentStatusView.color }}></div>
                      {agentStatusView.text}
                    </div>
                    {agentStatusDetail && (
                      <small style={{ color: 'var(--text-secondary, var(--text-muted))', marginTop: '4px', display: 'block', fontSize: '0.75rem' }}>
                        {agentStatusDetail}
                      </small>
                    )}
                    {agentStatus === 'online' && agentPrinters.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <select 
                          className="form-input" 
                          style={{ width: '100%', maxWidth: '250px', height: '32px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 6px)' }}
                          value={selectedAgentPrinter}
                          onChange={(e) => handleUpdateAgentPrinter(e.target.value)}
                        >
                          {agentPrinters.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-primary, var(--text-main))' }}>Port</div>
                    <div className="font-mono" style={{ color: 'var(--text-secondary, var(--text-muted))', fontSize: '0.82rem' }}>127.0.0.1:5000</div>
                  </div>
                  <TTButton
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={handleTestAgentConnection}
                    disabled={agentStatus === 'testing'}
                  >
                    {agentStatus === 'testing' ? 'Test ediliyor...' : 'Bağlantıyı Test Et'}
                  </TTButton>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <TTCard>
                <h4 style={{ marginBottom: '12px' }}>1. Browser Auto Print Kurulumu</h4>
                <p style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>En yaygın ve hızlı pratik yazdırma çözümü.</p>
                <ul style={{ paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <li><strong>Gerekenler:</strong> Windows işletim sistemi, Google Chrome, Yazıcı Sürücüsü.</li>
                  <li><strong>Adımlar:</strong> Sürücüyü kurun. Chrome kısayolunu `--kiosk-printing` parametresi ile güncelleyin. TrackTrace üzerinden "Koli Kapat" işlemi ile test edin.</li>
                  <li><strong>Sık Karşılaşılan Sorunlar:</strong> Chrome'un arka planda açık kalması parametreyi ezebilir. Tüm Chrome pencerelerini kapatıp özel kısayol ile yeniden açın.</li>
                </ul>
              </TTCard>

              <TTCard>
                <h4 style={{ marginBottom: '12px' }}>2. PDF Manuel Yazdırma</h4>
                <p style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>Geçici kullanımlar veya ofis ortamları için yedek yöntem.</p>
                <ul style={{ paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <li><strong>Gerekenler:</strong> Herhangi bir modern web tarayıcı.</li>
                  <li><strong>Adımlar:</strong> Ayarlardan Varsayılan Yazdırma Modu'nu "PDF Download" seçin. İşlem sonrası inen PDF dosyasını açıp yazdırın.</li>
                  <li><strong>Çözüm Önerileri:</strong> Ölçekleme sorunu yaşanırsa, yazdırma ekranında "Gerçek Boyut" (Actual Size) seçeneğini işaretleyin.</li>
                </ul>
              </TTCard>
              
              <TTCard>
                <h4 style={{ marginBottom: '12px' }}>3. Local Agent (Yakında)</h4>
                <p style={{ color: 'var(--text-muted)' }}>
                  Faz 5B kapsamında sisteme dahil edilecek yerel yazdırma hizmeti. Kurulum adımları agent yayınlandığında 
                  bu sekmeden indirilebilir rehber ve kurulum dosyası (MSI/EXE) ile birlikte sunulacaktır.
                </p>
              </TTCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
