import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  QrCode, 
  Download, 
  RefreshCw,
  Info
} from 'lucide-react';

interface ValidationError {
  rowNo: number;
  rawLine: string;
  errorMessage: string;
}

interface AnalysisResult {
  totalLines: number;
  validCount: number;
  invalidCount: number;
  previewCodes: string[];
  errors: ValidationError[];
}

export const DataMatrixCreator: React.FC = () => {
  // File & Upload States
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Configuration States
  const [format, setFormat] = useState<'PDF' | 'PNG'>('PDF');
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(6);
  const [size, setSize] = useState(100);
  const [addText, setAddText] = useState(false);
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [labelBelow, setLabelBelow] = useState(true);

  // Generation & Preview States
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up Object URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Load preview image from backend
  const loadPreviewImage = async (codeText: string) => {
    try {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
      }
      const blob = await api.get(`/api/datamatrix/preview?text=${encodeURIComponent(codeText)}`);
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      }
    } catch (err) {
      console.error('Önizleme yüklenirken hata oluştu:', err);
    }
  };

  // Trigger analysis when file is selected
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await analyzeFile(selectedFile);
  };

  const analyzeFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setAnalyzing(true);
    setErrorMessage(null);
    setAnalysis(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const result = await api.post('/api/datamatrix/analyze', formData);
      setAnalysis(result);
      if (result.previewCodes && result.previewCodes.length > 0) {
        loadPreviewImage(result.previewCodes[0]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Dosya analiz edilirken bir hata oluştu.');
      setFile(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      await analyzeFile(droppedFile);
    }
  };

  const resetCreator = () => {
    setFile(null);
    setAnalysis(null);
    setErrorMessage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit configuration and download PDF/ZIP
  const handleGenerate = async () => {
    if (!file) return;

    setGenerating(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);
    formData.append('cols', cols.toString());
    formData.append('rows', rows.toString());
    formData.append('size', size.toString());
    formData.append('addText', addText.toString());
    formData.append('line1', line1);
    formData.append('line2', line2);
    formData.append('labelBelow', labelBelow.toString());

    try {
      const blob = await api.post('/api/datamatrix/generate', formData);
      if (blob instanceof Blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = format === 'PNG' 
          ? `${file.name.replace(/\.[^/.]+$/, '')}_datamatrix.zip`
          : `${file.name.replace(/\.[^/.]+$/, '')}_datamatrix.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error('Dosya oluşturulamadı (geçersiz yanıt tipi).');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Dosya üretilirken bir hata oluştu.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>DataMatrix Üretici</h2>
        <p style={{ color: 'var(--text-muted)' }}>Masaüstü uygulaması mantığında; toplu kod listesi içeren bir dosyayı yükleyin, formatını düzenleyin ve PDF şablonu veya PNG arşivi olarak indirin.</p>
      </div>

      {errorMessage && (
        <div className="error-alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: File Upload & Validation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* File Upload Box */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="var(--primary)" />
              Girdi Dosyası Seçimi
            </h3>

            {!file ? (
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '40px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  backgroundColor: 'var(--bg-primary)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".txt,.csv" 
                  style={{ display: 'none' }} 
                />
                <Upload size={36} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.7 }} />
                <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>
                  Dosya seçmek için tıklayın veya buraya sürükleyin
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Sadece .txt ve .csv dosyaları desteklenir. Satır bazlı GS1 DataMatrix kodları okunacaktır.
                </p>
              </div>
            ) : (
              <div style={{
                backgroundColor: 'var(--primary-light)',
                border: '1px solid var(--primary)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FileText size={28} color="var(--primary)" />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>{file.name}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <button 
                  className="btn btn-secondary" 
                  onClick={resetCreator}
                  disabled={analyzing || generating}
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  Dosyayı Değiştir
                </button>
              </div>
            )}

            {analyzing && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '16px', color: 'var(--primary)' }}>
                <RefreshCw size={18} className="animate-spin" />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Dosya analiz ediliyor, lütfen bekleyin...</span>
              </div>
            )}
          </div>

          {/* Validation Metrics */}
          {analysis && (
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} color="var(--success)" />
                Analiz Sonuçları
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  border: '1px solid var(--border-color)'
                }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Toplam Satır</p>
                  <p style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>{analysis.totalLines}</p>
                </div>
                <div style={{
                  padding: '16px',
                  backgroundColor: 'var(--success-bg)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  border: '1px solid var(--success-border)'
                }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--success-text)', fontWeight: 600, textTransform: 'uppercase' }}>Geçerli Kod</p>
                  <p style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--success-text)' }}>{analysis.validCount}</p>
                </div>
                <div style={{
                  padding: '16px',
                  backgroundColor: analysis.invalidCount > 0 ? 'var(--danger-bg)' : 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  border: analysis.invalidCount > 0 ? '1px solid var(--danger-border)' : '1px solid var(--border-color)'
                }}>
                  <p style={{ fontSize: '0.8rem', color: analysis.invalidCount > 0 ? 'var(--danger-text)' : 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Hatalı Satır</p>
                  <p style={{ fontSize: '1.75rem', fontWeight: 700, color: analysis.invalidCount > 0 ? 'var(--danger-text)' : 'var(--text-main)' }}>{analysis.invalidCount}</p>
                </div>
              </div>

              {/* Invalid Code Errors List */}
              {analysis.invalidCount > 0 && (
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--danger-text)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={16} />
                    Hatalı Barkod Listesi (İlk 100 satır)
                  </p>
                  <div style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.85rem'
                  }}>
                    <table className="data-table" style={{ margin: 0, border: 'none' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px 12px' }}>Satır</th>
                          <th style={{ padding: '8px 12px' }}>Orijinal İçerik</th>
                          <th style={{ padding: '8px 12px' }}>Hata Mesajı</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.errors.slice(0, 100).map((err, idx) => (
                          <tr key={idx} style={{ backgroundColor: 'var(--danger-bg)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--danger-text)' }}>{err.rowNo}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{err.rawLine}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--danger-text)', fontWeight: 500 }}>{err.errorMessage}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Configuration & Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Configuration Settings */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <QrCode size={18} color="var(--primary)" />
              Şablon ve Çıktı Yapılandırması
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Output Format Selection */}
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Çıktı Formatı</label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                  <label style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: format === 'PDF' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: format === 'PDF' ? 'var(--primary-light)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'var(--transition)'
                  }}>
                    <input 
                      type="radio" 
                      name="format" 
                      value="PDF" 
                      checked={format === 'PDF'} 
                      onChange={() => setFormat('PDF')} 
                      style={{ display: 'none' }}
                    />
                    PDF Tablosu
                  </label>
                  <label style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: format === 'PNG' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: format === 'PNG' ? 'var(--primary-light)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'var(--transition)'
                  }}>
                    <input 
                      type="radio" 
                      name="format" 
                      value="PNG" 
                      checked={format === 'PNG'} 
                      onChange={() => setFormat('PNG')} 
                      style={{ display: 'none' }}
                    />
                    Bireysel PNG'ler (ZIP)
                  </label>
                </div>
              </div>

              {/* PDF Settings (Enabled only for PDF format) */}
              {format === 'PDF' && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  padding: '16px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Sütun Sayısı (Cols)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      min="1" 
                      max="10" 
                      value={cols} 
                      onChange={(e) => setCols(Math.max(1, parseInt(e.target.value) || 1))} 
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Satır Sayısı (Rows)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      min="1" 
                      max="15" 
                      value={rows} 
                      onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))} 
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2', marginTop: '6px' }}>
                    <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Barkod Boyutu (QuestPDF Points)</span>
                      <strong>{size} pt</strong>
                    </label>
                    <input 
                      type="range" 
                      min="40" 
                      max="300" 
                      step="5" 
                      value={size} 
                      onChange={(e) => setSize(parseInt(e.target.value))} 
                      style={{ width: '100%', accentColor: 'var(--primary)', marginTop: '4px' }}
                    />
                  </div>
                </div>
              )}

              {/* Optional Text Labels */}
              {format === 'PDF' && (
                <div style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    <input 
                      type="checkbox" 
                      checked={addText} 
                      onChange={(e) => setAddText(e.target.checked)} 
                      style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                    />
                    Barkod Altına/Üstüne Metin Ekle
                  </label>

                  {addText && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Metin Satırı 1 (Kalın)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Örn: Duracell AA Pil 4'lü" 
                          value={line1} 
                          onChange={(e) => setLine1(e.target.value)} 
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Metin Satırı 2 (Normal)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Örn: LOT: 2026-06 / SKT: 2030" 
                          value={line2} 
                          onChange={(e) => setLine2(e.target.value)} 
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Metin Konumu</label>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                            <input 
                              type="radio" 
                              name="labelPos" 
                              checked={!labelBelow} 
                              onChange={() => setLabelBelow(false)} 
                              style={{ accentColor: 'var(--primary)' }}
                            />
                            Barkodun Üstünde
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                            <input 
                              type="radio" 
                              name="labelPos" 
                              checked={labelBelow} 
                              onChange={() => setLabelBelow(true)} 
                              style={{ accentColor: 'var(--primary)' }}
                            />
                            Barkodun Altında
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Generate Trigger Action */}
              <button 
                className="btn btn-primary"
                disabled={!file || generating || analyzing || !analysis || analysis.totalLines === 0}
                onClick={handleGenerate}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '14px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  marginTop: '8px'
                }}
              >
                {generating ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Belgeler Üretiliyor...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    {format === 'PDF' ? 'PDF Şablonu İndir' : 'ZIP formatında PNG\'leri İndir'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Visual Preview Panel */}
          {analysis && analysis.previewCodes.length > 0 && (
            <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={18} color="var(--primary)" />
                Görsel Barkod Önizleme
              </h3>
              
              <div style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '16px',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-primary)',
                minWidth: '220px'
              }}>
                {previewUrl ? (
                  <img 
                    src={previewUrl} 
                    alt="DataMatrix Preview" 
                    style={{ width: '160px', height: '160px', objectFit: 'contain', backgroundColor: 'white', padding: '10px', borderRadius: 'var(--radius-sm)' }}
                  />
                ) : (
                  <div style={{ width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    Önizleme Yükleniyor...
                  </div>
                )}
                <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', width: '100%', wordBreak: 'break-all' }}>
                  <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>İlk Üretilecek Kod:</p>
                  <code>{analysis.previewCodes[0]}</code>
                </div>
              </div>
              
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px' }}>
                Yukarıdaki görsel, yüklediğiniz listedeki ilk üretilecek barkodun sunucuda çizdirilmiş birebir görüntüsüdür.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
