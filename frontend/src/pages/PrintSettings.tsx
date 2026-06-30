import React, { useState, useEffect } from 'react';
import { getPrintProvider } from '../services/printProvider';
import { useAuth } from '../context/AuthContext';
import { TTCard, TTPageHeader } from '../components/common';
import { Settings, MonitorPlay, FileDown, Server, Info, Copy, Check } from 'lucide-react';

interface PrintConfig {
  printMode: 'browser' | 'pdf' | 'zpl' | 'agent';
  defaultLabelType: 'carton' | 'pallet';
  defaultFormat: 'pdf' | 'zpl';
  autoPrintCarton: boolean;
  autoPrintPallet: boolean;
  showNotification: boolean;
  agentToken?: string;
}

const DEFAULT_CONFIG: PrintConfig = {
  printMode: 'browser',
  defaultLabelType: 'carton',
  defaultFormat: 'pdf',
  autoPrintCarton: true,
  autoPrintPallet: true,
  showNotification: true,
  agentToken: ''
};

export const PrintSettings: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [globalConfig, setGlobalConfig] = useState<PrintConfig>(DEFAULT_CONFIG);
  const [localConfig, setLocalConfig] = useState<PrintConfig | null>(null);
  const [isUsingLocalOverride, setIsUsingLocalOverride] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [testMessage, setTestMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings/GlobalPrintConfig');
        if (res.ok) {
          const data = await res.json();
          setGlobalConfig({ ...DEFAULT_CONFIG, ...JSON.parse(data.value) });
        }
      } catch (e) {
        console.error('Failed to fetch global print settings', e);
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

  const handleTestPrint = async () => {
    setTestMessage(null);
    try {
      if (config.printMode === 'agent' && !config.agentToken) {
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
      await fetch('/api/settings/GlobalPrintConfig', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ key: 'GlobalPrintConfig', value: JSON.stringify(updated) })
      });
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
    <div className="page-container">
      <TTPageHeader 
        title="Yazdırma Ayarları" 
        description="Sistem genelinde kullanılacak çoklu yazdırma modu ve etiket yapılandırmaları" 
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <TTCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Ayar Kaynağı</div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', color: isUsingLocalOverride ? 'var(--warning)' : 'var(--primary)' }}>
              {isUsingLocalOverride ? 'Local Override (Bu PC)' : 'Global Default'}
            </div>
            {isUsingLocalOverride && (
              <button 
                onClick={clearLocalOverride}
                style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', marginTop: '4px' }}
              >
                Yerel ayarı temizle
              </button>
            )}
          </div>
        </TTCard>

        <TTCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Aktif Yazdırma Modu</div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {config.printMode === 'browser' && <><MonitorPlay size={18} className="text-primary" /> Browser Auto Print</>}
              {config.printMode === 'pdf' && <><FileDown size={18} className="text-primary" /> PDF Download</>}
              {config.printMode === 'zpl' && <><FileDown size={18} className="text-primary" /> ZPL Download</>}
              {config.printMode === 'agent' && <><Server size={18} className="text-primary" /> Local Agent</>}
            </div>
          </div>
        </TTCard>
        
        <TTCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Varsayılan Etiket Formatı</div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{config.defaultFormat.toUpperCase()}</div>
          </div>
        </TTCard>

        <TTCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Otomatik Yazdırma</div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem', color: config.autoPrintCarton ? 'var(--success)' : 'var(--text-muted)' }}>
              {config.autoPrintCarton ? 'Aktif (Koli)' : 'Pasif'}
            </div>
          </div>
        </TTCard>

        <TTCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Son Baskı Durumu</div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--success)' }}>Başarılı</div>
          </div>
        </TTCard>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {[
            { id: 'general', label: 'Genel Ayarlar', icon: <Settings size={16} /> },
            { id: 'browser', label: 'Browser Auto Print', icon: <MonitorPlay size={16} /> },
            { id: 'pdfzpl', label: 'PDF / ZPL', icon: <FileDown size={16} /> },
            { id: 'agent', label: 'Local Agent', icon: <Server size={16} /> },
            { id: 'guide', label: 'Kurulum Rehberi', icon: <Info size={16} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 24px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: activeTab === tab.id ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px' }}>
          {activeTab === 'general' && (
            <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label>Varsayılan Yazdırma Modu</label>
                <select 
                  className="input" 
                  value={config.printMode} 
                  onChange={(e) => handleSaveLocal({ printMode: e.target.value as any })}
                >
                  <option value="browser">Browser Auto Print</option>
                  <option value="pdf">PDF Download</option>
                  <option value="zpl">ZPL Download</option>
                  <option value="agent" disabled={!config.agentToken}>Local Print Agent</option>
                </select>
                <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Bu ayar tarayıcı bazlıdır ve o anki cihazın davranışını belirler.
                </small>
                {!config.agentToken && (
                  <small style={{ color: 'var(--warning)', marginTop: '4px', display: 'block' }}>
                    Local Print Agent modunu seçebilmek için 'Local Agent' sekmesinden Pairing Token girmelisiniz.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Varsayılan Etiket Tipi</label>
                <select 
                  className="input" 
                  value={config.defaultLabelType}
                  onChange={(e) => handleSaveLocal({ defaultLabelType: e.target.value as any })}
                >
                  <option value="carton">Koli Etiketi</option>
                  <option value="pallet">Palet Etiketi</option>
                </select>
              </div>

              <div className="form-group">
                <label>Varsayılan Format</label>
                <select 
                  className="input" 
                  value={config.defaultFormat}
                  onChange={(e) => handleSaveLocal({ defaultFormat: e.target.value as any })}
                >
                  <option value="pdf">PDF</option>
                  <option value="zpl">ZPL</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: config.printMode === 'pdf' ? 'not-allowed' : 'pointer', opacity: config.printMode === 'pdf' ? 0.6 : 1 }}>
                  <input 
                    type="checkbox" 
                    checked={config.printMode === 'pdf' ? false : config.autoPrintCarton}
                    disabled={config.printMode === 'pdf'}
                    onChange={(e) => handleSaveLocal({ autoPrintCarton: e.target.checked })}
                  />
                  Koli tamamlanınca otomatik yazdır
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: config.printMode === 'pdf' ? 'not-allowed' : 'pointer', opacity: config.printMode === 'pdf' ? 0.6 : 1 }}>
                  <input 
                    type="checkbox" 
                    checked={config.printMode === 'pdf' ? false : config.autoPrintPallet}
                    disabled={config.printMode === 'pdf'}
                    onChange={(e) => handleSaveLocal({ autoPrintPallet: e.target.checked })}
                  />
                  Palet kapatılınca otomatik yazdır
                </label>
                
                {config.printMode === 'pdf' && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--warning)', marginTop: '-4px', marginLeft: '24px' }}>
                    PDF Download modunda otomatik yazdırma desteklenmez. Etiketi manuel olarak indirip yazdırın.
                  </div>
                )}
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={config.showNotification}
                    onChange={(e) => handleSaveLocal({ showNotification: e.target.checked })}
                  />
                  Yazdırma sonrası bildirim göster
                </label>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => handleSaveGlobal(config)}
                  style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Şu Anki Ayarları Global Olarak Kaydet
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleTestPrint}
                  style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Test Etiketi Yazdır
                </button>
              </div>

              {testMessage && (
                <div style={{ padding: '12px', marginTop: '12px', borderRadius: '6px', backgroundColor: testMessage.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${testMessage.type === 'success' ? '#bbf7d0' : '#fecaca'}`, color: testMessage.type === 'success' ? '#16a34a' : '#ef4444' }}>
                  {testMessage.text}
                </div>
              )}
            </div>
          )}

          {activeTab === 'browser' && (
            <div>
              <h3 style={{ marginBottom: '16px' }}>Browser Auto Print</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                Bu yöntem Chrome'un otomatik yazdırma modu ve varsayılan yazıcı ayarı ile çalışır. 
                TrackTrace etiketi tarayıcıda açar, Chrome otomatik olarak seçili yazıcıya gönderir.
              </p>

              <div style={{ background: 'var(--bg-body)', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
                <h4 style={{ marginBottom: '12px' }}>Kurulum Adımları</h4>
                <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li>Argox / Zebra yazıcı sürücüsünü kur.</li>
                  <li>Argox Printer Tool veya üreticinin yazıcı aracını kur.</li>
                  <li>Windows'ta ilgili yazıcıyı varsayılan yazıcı yap.</li>
                  <li>Chrome kısayolunu oluştur.</li>
                  <li>Chrome kısayol hedef alanına aşağıdaki parametreleri ekle:</li>
                </ol>
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px', background: 'var(--bg-card)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border)', alignItems: 'center' }}>
                  <code style={{ flex: 1, wordBreak: 'break-all' }}>
                    "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --disable-print-preview --printer="ARGOX CP-2140"
                  </code>
                  <button className="btn btn-secondary btn-icon" onClick={() => copyToClipboard('"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --kiosk-printing --disable-print-preview --printer="ARGOX CP-2140"')}>
                    {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                  </button>
                </div>
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>
                  Not: Bazı Chrome sürümlerinde --printer parametresi çalışmayabilir. Bu durumda Windows varsayılan yazıcısı kullanılmalıdır.
                </small>
              </div>

              <div style={{ padding: '16px', borderLeft: '4px solid var(--warning)', background: 'var(--bg-body)' }}>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--warning)' }}>Uyarılar</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-muted)' }}>
                  <li>Yazıcı adı Windows'taki tam yazıcı adıyla aynı olmalı.</li>
                  <li>Chrome arka planda açık kalmışsa kapatıp yeniden aç.</li>
                  <li>Varsayılan yazıcı değişirse otomatik baskı farklı yazıcıya gidebilir.</li>
                  <li>Tarayıcı izinleri veya pop-up engelleyici baskıyı etkileyebilir.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'pdfzpl' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={{ background: 'var(--bg-body)', padding: '24px', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileDown size={20} className="text-primary" /> PDF Download
                </h3>
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)' }}>
                  <li>Kullanıcı etiketi PDF olarak indirir.</li>
                  <li>Kendi PDF görüntüleyicisi üzerinden manuel yazdırır.</li>
                  <li>En güvenli ve donanım bağımsız (en uyumlu) yöntemdir.</li>
                  <li>Özel driver gerektirmez, tüm ofis ve depo yazıcılarında çalışır.</li>
                </ul>
              </div>

              <div style={{ background: 'var(--bg-body)', padding: '24px', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileDown size={20} className="text-primary" /> ZPL Download
                </h3>
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>Local Print Agent</h3>
              </div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                Tarayıcı kısıtlarından bağımsız olarak yerel yazıcınıza doğrudan yazdırmak için kullanılır. 
                Bilgisayarınızda çalışan TrackTrace Local Agent ile güvenli haberleşme sağlar.
              </p>

              <div style={{ background: 'var(--bg-body)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label>Agent Pairing Token <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input 
                    type="password" 
                    className="input" 
                    placeholder="Local Agent kurulumunda verilen token"
                    value={config.agentToken || ''}
                    onChange={(e) => handleSaveLocal({ agentToken: e.target.value })}
                  />
                  <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Agent ile güvenli bağlantı kurmak için zorunludur. Token boş ise bu bilgisayarda Local Agent kullanılamaz.
                  </small>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '16px', background: 'var(--bg-card)', borderRadius: '6px' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Agent Bağlantı Durumu</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: config.agentToken ? '#cbd5e1' : '#ef4444' }}></div>
                      {config.agentToken ? 'Bağlantı Kurulmadı (Test Yapınız)' : 'Token Eksik'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Port</div>
                    <div style={{ color: 'var(--text-muted)' }}>127.0.0.1:5000</div>
                  </div>
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
