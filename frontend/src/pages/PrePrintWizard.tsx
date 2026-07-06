import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { getPrintProvider } from '../services/printProvider';
import { 
  ArrowRight, 
  ArrowLeft, 
  Printer, 
  Check,
  FileText
} from 'lucide-react';
import { TTPageHeader, TTButton } from '../components/common';

export const PrePrintWizard: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const [step, setStep] = useState(1);
  const [orders, setOrders] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedOrderNo, setSelectedOrderNo] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [format, setFormat] = useState('PDF'); // PDF, ZPL, PPLB
  const [stationId, setStationId] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [printMode, setPrintMode] = useState('browser');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [ordersRes, stationsRes] = await Promise.all([
          api.get('/api/orders?pageSize=1000'),
          api.get('/api/stations?includeInactive=false').catch(() => [])
        ]);
        setOrders(ordersRes.items || []);
        setStations(stationsRes || []);
      } catch (err) {
        console.error('Error fetching wizard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    const localSettings = localStorage.getItem('trackTrace_printSettings');
    if (localSettings) {
      try {
        const parsed = JSON.parse(localSettings);
        if (parsed.printMode) setPrintMode(parsed.printMode);
      } catch (e) {}
    }
  }, []);

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  const handleNext = () => {
    if (step === 1 && !selectedOrderId) {
      alert("Lütfen bir sipariş seçin.");
      return;
    }
    if (step === 2 && quantity < 1) {
      alert("Lütfen geçerli bir koli adedi girin.");
      return;
    }
    setStep(prev => prev + 1);
  };

  const handleBack = () => setStep(prev => prev - 1);

  const handleCancel = () => {
    if (onNavigate) onNavigate('cartons');
  };

  const handleSubmit = async (isDownloadOnly: boolean) => {
    setSubmitting(true);
    const requestId = crypto.randomUUID();

    try {
      const res = await api.post('/api/cartons/preprint', {
        orderId: selectedOrderId,
        quantity,
        format,
        stationId: stationId || null,
        requestId
      });

      if (res instanceof Blob) {
        const url = window.URL.createObjectURL(res);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PrePrinted_Labels.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else if (res && res.success && res.content) {
        if (isDownloadOnly || printMode === 'browser' || printMode === 'pdf') {
          const blob = new Blob([res.content], { type: 'text/plain' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `PrePrinted_${format}.txt`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        } else {
          try {
            const provider = getPrintProvider(printMode);
            await provider.testPrint(res.content);
            alert("Etiketler yazıcıya gönderildi!");
          } catch (printErr: any) {
            alert("Yazıcıya gönderilirken hata oluştu: " + printErr.message + "\\nLütfen çıktı dosyasını indirip manuel yazdırın.");
            const blob = new Blob([res.content], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `PrePrinted_${format}_fallback.txt`;
            a.click();
          }
        }
      } else {
        throw new Error(res?.message || 'Etiket üretilemedi.');
      }

      alert("İşlem başarılı.");
      handleCancel();
    } catch (err: any) {
      alert("Ön Etiket Basım Hatası: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px', paddingTop: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {[
          { num: 1, label: 'Sipariş Seç' },
          { num: 2, label: 'Baskı Ayarları' },
          { num: 3, label: 'Önizleme' },
          { num: 4, label: 'Onay' }
        ].map((s, index) => (
          <React.Fragment key={s.num}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 1 }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: step > s.num ? 'var(--success)' : step === s.num ? 'var(--primary)' : '#e2e8f0',
                color: step >= s.num ? '#ffffff' : '#64748b',
                fontWeight: 700,
                transition: 'all 0.3s ease',
                boxShadow: step === s.num ? '0 0 0 4px var(--primary-light)' : 'none'
              }}>
                {step > s.num ? <Check size={16} /> : s.num}
              </div>
              <span style={{ 
                fontSize: '0.85rem', 
                fontWeight: step === s.num ? 600 : 400,
                color: step >= s.num ? 'var(--text-main)' : 'var(--text-muted)'
              }}>
                {s.label}
              </span>
            </div>
            {index < 3 && (
              <div style={{ 
                width: '60px', height: '3px', 
                backgroundColor: step > s.num ? 'var(--success)' : '#e2e8f0',
                marginTop: '-24px',
                transition: 'all 0.3s ease',
                zIndex: 0
              }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ paddingBottom: '60px' }}>
      <TTPageHeader
        title="Ön Etiket Oluştur"
        description="Bu işlem siparişe ait boş koli etiketleri oluşturur. Operatörler daha sonra bu etiketleri kullanarak ürün okutma işlemini gerçekleştirir."
        actions={
          <TTButton variant="secondary" onClick={handleCancel}>
            Vazgeç ve Çık
          </TTButton>
        }
      />

      <div className="card" style={{ maxWidth: '900px', margin: '20px auto 0 auto', minHeight: '500px', position: 'relative', overflow: 'hidden' }}>
        {renderStepIndicator()}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            Yükleniyor...
          </div>
        ) : (
          <div style={{ padding: '0 20px 80px 20px', animation: 'fadeIn 0.3s ease-out' }}>
            
            {/* STEP 1 */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', textAlign: 'center' }}>Sipariş Seçimi</h3>
                
                <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>1. Sipariş No Seçin <span style={{ color: 'red' }}>*</span></label>
                    <select 
                      className="form-input" 
                      style={{ fontSize: '1.1rem', padding: '12px' }}
                      value={selectedOrderNo} 
                      onChange={(e) => {
                         setSelectedOrderNo(e.target.value);
                         setSelectedOrderId('');
                      }}
                    >
                      <option value="">-- Sipariş Seçiniz --</option>
                      {Array.from(new Map(orders.map(o => [o.orderNo, o])).values()).map((o: any) => (
                        <option key={o.orderNo} value={o.orderNo}>
                          {o.orderNo} {o.customerName ? `(${o.customerName})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ opacity: selectedOrderNo ? 1 : 0.5, pointerEvents: selectedOrderNo ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>2. Stok Kodu Seçin <span style={{ color: 'red' }}>*</span></label>
                    <select 
                      className="form-input" 
                      style={{ fontSize: '1.1rem', padding: '12px' }}
                      value={selectedOrderId} 
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                    >
                      <option value="">-- Stok Kodu Seçiniz --</option>
                      {orders.filter(o => o.orderNo === selectedOrderNo).map(o => (
                        <option key={o.id} value={o.id}>
                          {o.stockCode} - {o.productName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {orders.length === 0 && (
                     <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                       Kayıtlı sipariş bulunamadı.
                     </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '500px', margin: '0 auto' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', textAlign: 'center' }}>Baskı Ayarları</h3>
                
                <div className="form-group">
                  <label className="form-label">Basılacak Koli Adedi <span style={{ color: 'red' }}>*</span></label>
                  <input 
                    type="number" 
                    className="form-input" 
                    style={{ fontSize: '1.2rem', padding: '12px', textAlign: 'center', fontWeight: 600 }}
                    min="1" 
                    max="1000" 
                    value={quantity} 
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Çıktı Formatı</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {['PDF', 'ZPL', 'PPLB'].map(fmt => (
                      <div 
                        key={fmt}
                        onClick={() => setFormat(fmt)}
                        style={{
                          flex: 1, padding: '12px', textAlign: 'center', cursor: 'pointer',
                          border: `2px solid ${format === fmt ? 'var(--primary)' : 'var(--border-color)'}`,
                          borderRadius: '8px',
                          backgroundColor: format === fmt ? 'var(--primary-light)' : '#ffffff',
                          color: format === fmt ? 'var(--primary)' : 'var(--text-main)',
                          fontWeight: format === fmt ? 600 : 400,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {fmt}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">İstasyon (Opsiyonel)</label>
                  <select 
                    className="form-input" 
                    value={stationId} 
                    onChange={(e) => setStationId(e.target.value)}
                  >
                    <option value="">-- İstasyon Seçilmedi (Varsayılan) --</option>
                    {stations.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px', display: 'block' }}>
                    Bu seçim yalnızca yazdırma ayarları ve izlenebilirlik için kullanılacaktır.
                  </span>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Etiket Önizlemesi</h3>
                <div style={{ backgroundColor: '#fffbe1', border: '1px solid #fef08a', color: '#854d0e', padding: '10px 16px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>⚠️</span> Temsili Önizleme (Sadece Bilgi Amaçlıdır)
                </div>
                
                <div style={{
                  width: '350px',
                  height: '250px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative'
                }}>
                  <div style={{ borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'monospace' }}>SSCC</h4>
                    <div style={{ fontSize: '1.1rem', letterSpacing: '2px', fontFamily: 'monospace', marginTop: '4px' }}>
                      0 {selectedOrder?.gtin?.substring(0, 7) || '8690000'} XXXXXXXX
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                    <strong>Ürün:</strong> <span>{selectedOrder?.stockCode || 'XXX'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                    <strong>Sipariş:</strong> <span>{selectedOrder?.orderNo || 'ORD-XXX'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                    <strong>Miktar:</strong> <span>{selectedOrder?.boxCapacity || 0} Adet</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'auto' }}>
                    <svg width="250" height="50">
                      <rect width="250" height="50" fill="#f8fafc" />
                      {Array.from({ length: 28 }).map((_, i) => (
                        <rect key={i} x={10 + i * 8.2} y="5" width={Math.random() > 0.5 ? 3 : 1.5} height="40" fill="#0f172a" />
                      ))}
                    </svg>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '32px', marginTop: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', padding: '16px 32px', borderRadius: '12px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>İlk Koli</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>1</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Son Koli</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{quantity}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Toplam</div>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>{quantity} Etiket</div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4 */}
            {step === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px', margin: '0 auto' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', textAlign: 'center' }}>İşlem Onayı</h3>
                
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px', backgroundColor: 'var(--primary-light)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px' }}>
                      <FileText size={24} color="var(--primary)" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)' }}>{selectedOrder?.orderNo}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{selectedOrder?.productName}</div>
                    </div>
                  </div>
                  
                  <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Stok Kodu</div>
                      <div style={{ fontWeight: 600 }}>{selectedOrder?.stockCode}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Toplam Etiket</div>
                      <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '1.2rem' }}>{quantity} Adet</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Çıktı Formatı</div>
                      <div style={{ fontWeight: 600, display: 'inline-block', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '4px' }}>{format}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>İstasyon</div>
                      <div style={{ fontWeight: 600 }}>{stations.find(s => s.id === stationId)?.name || 'Genel (İstasyon Seçilmedi)'}</div>
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: '#eff6ff', color: '#1e40af', padding: '16px', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', gap: '12px', border: '1px solid #bfdbfe' }}>
                  <Printer size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ lineHeight: '1.5' }}>
                    İşlemi onayladığınızda <strong>{quantity} adet</strong> {format} formatında boş etiket üretilecek. Etiketler <strong>{printMode === 'browser' ? 'tarayıcı üzerinden' : 'yerel servis ile'}</strong> yazdırılacaktır.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ 
          position: 'absolute', bottom: '0', left: '0', right: '0', 
          padding: '16px 24px', borderTop: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', backgroundColor: '#f8fafc',
          borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px'
        }}>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '8px 16px' }}
            onClick={step === 1 ? handleCancel : handleBack} 
            disabled={submitting}
          >
            {step === 1 ? 'İptal' : <><ArrowLeft size={16} /> Geri</>}
          </button>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            {step < 4 ? (
              <button 
                className="btn btn-primary" 
                style={{ padding: '8px 24px' }}
                onClick={handleNext} 
                disabled={loading || (step === 1 && !selectedOrderId)}
              >
                İleri <ArrowRight size={16} />
              </button>
            ) : (
              <>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '8px 16px' }}
                  onClick={() => handleSubmit(true)} 
                  disabled={submitting}
                >
                  Sadece PDF Önizle
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '8px 24px' }}
                  onClick={() => handleSubmit(false)} 
                  disabled={submitting}
                >
                  {submitting ? 'Oluşturuluyor...' : 'Oluştur ve Yazdır'} <Printer size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
