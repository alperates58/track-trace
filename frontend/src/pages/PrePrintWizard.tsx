import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { getPrintProvider } from '../services/printProvider';
import { 
  ArrowRight, 
  ArrowLeft, 
  Printer, 
  Check,
  FileText,
  Info,
  Zap,
  Download
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

  // Existing Cartons Calculation States
  const [existingCartonsCount, setExistingCartonsCount] = useState<number>(0);
  const [loadingCartons, setLoadingCartons] = useState(false);

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

  // Effect: Fetch existing cartons count when selectedOrderId changes
  useEffect(() => {
    if (!selectedOrderId) {
      setExistingCartonsCount(0);
      return;
    }
    const fetchCartonCount = async () => {
      setLoadingCartons(true);
      try {
        const res = await api.get(`/api/cartons?orderId=${selectedOrderId}&pageSize=1`);
        setExistingCartonsCount(res.totalCount || 0);
      } catch {
        setExistingCartonsCount(0);
      } finally {
        setLoadingCartons(false);
      }
    };
    fetchCartonCount();
  }, [selectedOrderId]);

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  // Calculated Stats
  const expectedQty = selectedOrder?.expectedQuantity || 0;
  const perCarton = selectedOrder?.productPerCarton || selectedOrder?.boxCapacity || 1;
  const totalCartonsNeeded = expectedQty > 0 ? Math.ceil(expectedQty / perCarton) : 0;
  const printedCartons = existingCartonsCount;
  const remainingCartons = Math.max(0, totalCartonsNeeded - printedCartons);

  const handleNext = () => {
    if (step === 1) {
      if (!selectedOrderId) {
        alert("Lütfen bir sipariş seçin.");
        return;
      }
      // Auto-suggest remaining cartons when advancing to step 2
      if (remainingCartons > 0) {
        setQuantity(remainingCartons);
      }
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
        batchId: requestId
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
            await provider.printRaw(res.content);
            alert("Etiketler yazıcıya gönderildi!");
          } catch (printErr: any) {
            alert("Yazıcıya gönderilirken hata oluştu: " + printErr.message + "\nLütfen çıktı dosyasını indirip manuel yazdırın.");
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
    <div className="preprint-step-scroll" style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px', paddingTop: '10px' }}>
      <div className="preprint-step-indicator" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                backgroundColor: step > s.num ? 'var(--success)' : step === s.num ? 'var(--primary)' : 'var(--bg-surface-subtle)',
                color: step > s.num ? '#ffffff' : step === s.num ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.8125rem',
                border: step >= s.num ? 'none' : '1px solid var(--border-subtle)',
                transition: 'all 0.2s ease',
                boxShadow: step === s.num ? '0 0 0 3px var(--primary-light)' : 'none'
              }}>
                {step > s.num ? <Check size={14} /> : s.num}
              </div>
              <span style={{ 
                fontSize: '0.8125rem', 
                fontWeight: step === s.num ? 600 : 500,
                color: step >= s.num ? 'var(--text-main)' : 'var(--text-muted)'
              }}>
                {s.label}
              </span>
            </div>
            {index < 3 && (
              <div style={{ 
                width: '56px', height: '2px', 
                backgroundColor: step > s.num ? 'var(--success)' : 'var(--border-subtle)',
                marginTop: '-24px',
                transition: 'all 0.2s ease',
                zIndex: 0
              }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  return (
    <div className="preprint-wizard-page" style={{ paddingBottom: '60px' }}>
      <TTPageHeader
        title="Ön Etiket Oluştur"
        description="Bu işlem siparişe ait boş koli etiketleri oluşturur. Operatörler daha sonra bu etiketleri kullanarak ürün okutma işlemini gerçekleştirir."
        actions={
          <TTButton variant="secondary" onClick={handleCancel}>
            Vazgeç ve Çık
          </TTButton>
        }
      />

      <div className="card preprint-wizard-card" style={{ maxWidth: '900px', margin: '20px auto 0 auto', minHeight: '500px', position: 'relative', overflow: 'hidden' }}>
        {renderStepIndicator()}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            Yükleniyor...
          </div>
        ) : (
          <div className="preprint-step-content" style={{ padding: '0 20px 80px 20px', animation: 'fadeIn 0.3s ease-out' }}>
            
            {/* STEP 1 */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '4px', textAlign: 'center', color: 'var(--text-main)' }}>Sipariş Seçimi</h3>
                
                <div style={{ maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 500, fontSize: '0.8125rem' }}>1. Sipariş No Seçin <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select 
                      className="form-input" 
                      style={{ fontSize: '0.9375rem', height: '40px' }}
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

                  <div className="form-group" style={{ marginBottom: 0, opacity: selectedOrderNo ? 1 : 0.5, pointerEvents: selectedOrderNo ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
                    <label className="form-label" style={{ fontWeight: 500, fontSize: '0.8125rem' }}>2. Stok Kodu Seçin <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select 
                      className="form-input" 
                      style={{ fontSize: '0.9375rem', height: '40px' }}
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
                     <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                       Kayıtlı sipariş bulunamadı.
                     </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '580px', margin: '0 auto' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '4px', textAlign: 'center', color: 'var(--text-main)' }}>Baskı Ayarları</h3>
                
                {/* PROMINENT SELECTED ORDER & STOCK BANNER */}
                {selectedOrder && (
                  <div style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                      <div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--primary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>SEÇİLEN SİPARİŞ</span>
                        <h4 style={{ margin: '2px 0 0 0', fontSize: '1.0625rem', color: 'var(--text-main)', fontWeight: 700 }}>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedOrder.orderNo}</span> <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>({selectedOrder.customerName || 'Müşteri Belirtilmedi'})</span>
                        </h4>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>İŞ EMRİ NO</span>
                        <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)', padding: '2px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)', marginTop: '2px' }}>
                          {selectedOrder.gtin || '-'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', fontSize: '0.8125rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Stok Kodu & Adı</span>
                        <strong style={{ color: 'var(--primary)' }}>{selectedOrder.stockCode}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{selectedOrder.productName}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Koli İçi Adet</span>
                        <strong className="tabular-nums">{perCarton} Ürün / Koli</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Toplam Hedef Miktar</span>
                        <strong className="tabular-nums">{expectedQty.toLocaleString('tr-TR')} Adet</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* KOLİ HESAPLAMA & KOPYA BİLGİ KARTI */}
                {selectedOrder && (
                  <div style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Info size={15} color="var(--primary)" /> Sipariş Koli Hesaplaması & Durum
                      </span>
                      <span className="tt-badge tt-badge-neutral">
                        Hesaplanan Bilgi
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center', marginBottom: '12px' }}>
                      <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Toplam Hedef Koli</div>
                        <div className="tabular-nums" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{totalCartonsNeeded} Koli</div>
                        <div className="tabular-nums" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>({expectedQty.toLocaleString('tr-TR')} / {perCarton})</div>
                      </div>

                      <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Mevcut / Basılan Koli</div>
                        <div className="tabular-nums" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>
                          {loadingCartons ? '...' : `${printedCartons} Koli`}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Sistemde kayıtlı</div>
                      </div>

                      <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Kalan Basılabilir</div>
                        <div className="tabular-nums" style={{ fontSize: '1rem', fontWeight: 700, color: remainingCartons > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                          {loadingCartons ? '...' : `${remainingCartons} Koli`}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Eksik koli sayısı</div>
                      </div>
                    </div>

                    {remainingCartons > 0 ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setQuantity(remainingCartons)}
                        style={{ 
                          width: '100%', 
                          fontSize: '0.8125rem', 
                          fontWeight: 600, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '6px', 
                          height: '36px',
                          color: 'var(--primary)',
                          borderColor: 'var(--primary)'
                        }}
                      >
                        <Zap size={14} /> Kalan {remainingCartons} Koli İçin Otomatik Doldur
                      </button>
                    ) : (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--success)', fontWeight: 600, textAlign: 'center', padding: '8px', backgroundColor: 'var(--success-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--success-border)' }}>
                        ✓ Tüm hedef koli adedi ({totalCartonsNeeded} koli) sistemde zaten oluşturulmuş.
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Basılacak Koli Adedi <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input 
                    type="number" 
                    className="form-input tabular-nums" 
                    style={{ fontSize: '1.25rem', height: '44px', textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}
                    min="1" 
                    max="5000" 
                    value={quantity} 
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Çıktı Formatı</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {['PDF', 'ZPL', 'PPLB'].map(fmt => (
                      <div 
                        key={fmt}
                        onClick={() => setFormat(fmt)}
                        style={{
                          flex: 1, padding: '10px', textAlign: 'center', cursor: 'pointer',
                          border: `1.5px solid ${format === fmt ? 'var(--primary)' : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: format === fmt ? 'var(--primary-light)' : 'var(--bg-card)',
                          color: format === fmt ? 'var(--primary)' : 'var(--text-main)',
                          fontWeight: format === fmt ? 600 : 500,
                          fontSize: '0.875rem',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {fmt}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>İstasyon (Opsiyonel)</label>
                  <select 
                    className="form-input" 
                    style={{ height: '36px', fontSize: '0.85rem' }}
                    value={stationId} 
                    onChange={(e) => setStationId(e.target.value)}
                  >
                    <option value="">-- İstasyon Seçilmedi (Varsayılan) --</option>
                    {stations.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Bu seçim yalnızca yazdırma ayarları ve izlenebilirlik için kullanılacaktır.
                  </span>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-main)' }}>Etiket Önizlemesi</h3>
                <div style={{ backgroundColor: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-text)', padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Info size={16} /> Temsili Önizleme (Sadece Bilgi Amaçlıdır)
                </div>
                
                <div className="preprint-label-preview" style={{
                  width: '340px',
                  height: '240px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-md)',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative'
                }}>
                  <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '6px', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontFamily: 'monospace', fontWeight: 700 }}>SSCC</h4>
                    <div style={{ fontSize: '0.9375rem', letterSpacing: '1px', fontFamily: 'monospace', marginTop: '2px' }}>
                      0 {selectedOrder?.gtin?.substring(0, 7) || '8690000'} XXXXXXXX
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '6px' }}>
                    <strong>Ürün:</strong> <span>{selectedOrder?.stockCode || 'XXX'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '6px' }}>
                    <strong>Sipariş:</strong> <span style={{ fontFamily: 'monospace' }}>{selectedOrder?.orderNo || 'ORD-XXX'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '6px' }}>
                    <strong>Miktar:</strong> <span className="tabular-nums">{perCarton} Adet</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'auto' }}>
                    <svg width="240" height="42">
                      <rect width="240" height="42" fill="#f8fafc" />
                      {Array.from({ length: 28 }).map((_, i) => (
                        <rect key={i} x={10 + i * 7.8} y="4" width={Math.random() > 0.5 ? 2.5 : 1.2} height="34" fill="#0f172a" />
                      ))}
                    </svg>
                  </div>
                </div>

                <div className="preprint-preview-summary" style={{ display: 'flex', gap: '32px', marginTop: '8px', backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)', padding: '14px 28px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mevcut Koli</div>
                    <div className="tabular-nums" style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{printedCartons}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Basılacak Koli</div>
                    <div className="tabular-nums" style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary)' }}>{quantity}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>İşlem Sonrası Toplam</div>
                    <div className="tabular-nums" style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1rem' }}>{printedCartons + quantity} Koli</div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4 */}
            {step === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '580px', margin: '0 auto' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '4px', textAlign: 'center', color: 'var(--text-main)' }}>İşlem Onayı</h3>
                
                <div style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ backgroundColor: 'var(--primary-light)', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <FileText size={20} color="var(--primary)" />
                    </div>
                    <div>
                      <div className="tabular-nums" style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{selectedOrder?.orderNo}</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{selectedOrder?.productName}</div>
                    </div>
                  </div>
                  
                  <div className="preprint-confirm-grid" style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Stok Kodu</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>{selectedOrder?.stockCode}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Müşteri</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>{selectedOrder?.customerName || '-'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>İş Emri No</div>
                      <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-main)', fontSize: '0.875rem' }}>{selectedOrder?.gtin || '-'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Koli İçi Ürün Adedi</div>
                      <div className="tabular-nums" style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>{perCarton} Adet</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Basılacak Koli Adedi</div>
                      <div className="tabular-nums" style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.0625rem' }}>{quantity} Adet</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Çıktı Formatı</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>{format}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Wizard Footer Controls */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'var(--bg-card)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {step > 1 ? (
            <TTButton variant="secondary" onClick={handleBack} icon={<ArrowLeft size={16} />}>
              Geri
            </TTButton>
          ) : (
            <TTButton variant="secondary" onClick={handleCancel}>
              İptal
            </TTButton>
          )}

          {step < 4 ? (
            <TTButton variant="primary" onClick={handleNext} icon={<ArrowRight size={16} />}>
              İleri
            </TTButton>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <TTButton 
                variant="secondary" 
                onClick={() => handleSubmit(true)} 
                disabled={submitting}
                icon={<Download size={16} />}
              >
                Sadece Dosya İndir
              </TTButton>
              <TTButton 
                variant="primary" 
                onClick={() => handleSubmit(false)} 
                disabled={submitting}
                icon={<Printer size={16} />}
              >
                {submitting ? 'Gönderiliyor...' : 'Baskıyı Başlat'}
              </TTButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
