import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import JSZip from 'jszip';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  AlertTriangle,
  QrCode, 
  Download, 
  RefreshCw,
  Layers,
  Database,
  History,
  Terminal,
  Clock,
  Settings,
  FileSpreadsheet
} from 'lucide-react';

// Types & Interfaces
interface ValidationError {
  rowNo: number;
  rawLine: string;
  errorMessage: string;
  errorType: string;
  suggestedFix: string;
  isWarning?: boolean;
}

interface AnalysisResult {
  totalLines: number;
  validCount: number;
  invalidCount: number;
  previewCodes: string[];
  errors: ValidationError[];
  warningCount: number;
}

interface HistoryItem {
  id: string;
  date: string;
  totalCount: number;
  validCount: number;
  invalidCount: number;
  format: 'PDF' | 'PNG';
  cols: number;
  rows: number;
  size: number;
  splitSize: string;
  fileSizeStr: string;
  status: 'Tamamlandı' | 'Hata';
  username: string;
}

const GS = '\u001D';

// Helper: IndexedDB for storing code lists of history items
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DataMatrixCreatorDB', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('codes')) {
        db.createObjectStore('codes', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveCodesToDB = async (id: string, codes: string[]): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('codes', 'readwrite');
    const store = tx.objectStore('codes');
    const request = store.put({ id, codes });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getCodesFromDB = async (id: string): Promise<string[] | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('codes', 'readonly');
    const store = tx.objectStore('codes');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result ? request.result.codes : null);
    request.onerror = () => reject(request.error);
  });
};

export const DataMatrixCreator: React.FC = () => {
  const { user } = useAuth();

  // File & Upload States
  const [file, setFile] = useState<File | null>(null);
  const [fileCodes, setFileCodes] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Configuration States
  const [profile, setProfile] = useState<string>('Auto');
  const [format, setFormat] = useState<'PDF' | 'PNG'>('PDF');
  const [preset, setPreset] = useState<string>('4x6');
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(6);
  const [size, setSize] = useState(100);
  const [addText, setAddText] = useState(false);
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [labelBelow, setLabelBelow] = useState(true);
  const [fontSize, setFontSize] = useState(10);

  // Split PDF States
  const [splitOption, setSplitOption] = useState<string>('none');
  const [customSplitVal, setCustomSplitVal] = useState<number>(1000);

  // Generation Progress States
  const [generating, setGenerating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  // Preview States
  const [previewTab, setPreviewTab] = useState<'layout' | 'single'>('layout');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // History States
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);

  // Load History from LocalStorage
  useEffect(() => {
    const stored = localStorage.getItem('datamatrix_generation_history');
    if (stored) {
      try {
        setHistoryList(JSON.parse(stored));
      } catch (err) {
        console.error(err);
      }
    }
  }, []);

  // Sync log scroll
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Clean up Object URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Append a console log
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Load preview image from backend
  const loadPreviewImage = async (codeText: string) => {
    try {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
      }
      const blob = await api.get(`/api/datamatrix/preview?text=${encodeURIComponent(codeText)}&profile=${profile}`);
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      }
    } catch (err) {
      console.error('Önizleme yüklenirken hata oluştu:', err);
    }
  };

  // Preset Layout Selector Change Handler
  const handlePresetChange = (name: string) => {
    setPreset(name);
    if (name === '4x6') {
      setCols(4);
      setRows(6);
      setSize(100);
    } else if (name === '3x8') {
      setCols(3);
      setRows(8);
      setSize(110);
    } else if (name === '2x10') {
      setCols(2);
      setRows(10);
      setSize(120);
    } else if (name === 'A4') {
      setCols(5);
      setRows(8);
      setSize(80);
    } else if (name === 'zebra') {
      setCols(1);
      setRows(1);
      setSize(200);
    }
  };

  // Parse Escape Sequences in TS
  const tsInterpretEscapeSequences = (text: string): string => {
    if (!text) return text;
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '\\' && i + 1 < text.length) {
        const next = text[i + 1];
        if (next === 'F') {
          result += GS;
          i++;
          continue;
        }
        if (next === 'n') {
          result += '\n';
          i++;
          continue;
        }
        if (next === 't') {
          result += '\t';
          i++;
          continue;
        }
        if (next === '\\') {
          result += '\\';
          i++;
          continue;
        }
      }
      result += ch;
    }
    return result;
  };

  // TS Client-side validation rule mirror
  const validateCodeClientSide = (rawLine: string, selectedProfile: string): { 
    success: boolean; 
    normalized: string; 
    errorMessage?: string; 
    errorType?: string; 
    suggestedFix?: string;
    warningMessage?: string;
  } => {
    if (!rawLine) {
      return { success: false, normalized: '', errorMessage: 'Satır null veya tanımsız.', errorType: 'Boş Satır', suggestedFix: 'Satır içeriğini kontrol edin.' };
    }
    let s = rawLine;
    // Strip BOM
    while (s.length > 0 && (s[0] === '\uFEFF' || s[0] === '\u200B' || s[0] === '\u0000' || /\s/.test(s[0]))) {
      s = s.substring(1);
    }
    s = s.replace(/[\r\n]+$/, '');
    s = s.trim();

    if (!s) {
      return { success: false, normalized: '', errorMessage: 'Satır boş.', errorType: 'Boş Kod', suggestedFix: 'Boş olmayan bir barkod satırı ekleyin.' };
    }

    const interpreted = tsInterpretEscapeSequences(s);

    if (selectedProfile === 'None') {
      return { success: true, normalized: interpreted };
    }

    // Check literal GS tags
    if (interpreted.includes('<GS>') || interpreted.includes('\\GS') || 
        (interpreted.includes('GS') && (interpreted.includes(' 91') || interpreted.includes(' 92') || interpreted.includes(' 93') || 
                                        interpreted.includes('<GS>91') || interpreted.includes('<GS>92') || interpreted.includes('<GS>93') || 
                                        interpreted.includes('\\GS91') || interpreted.includes('\\GS92') || interpreted.includes('\\GS93')))) {
      return { 
        success: false, 
        normalized: '', 
        errorMessage: 'GS grup ayırıcı eksik veya yanlış yerde. Kodda literal olarak \'GS\', \'<GS>\', \'\\GS\' veya boşluk kullanılmış olabilir.', 
        errorType: 'GS Ayırıcı Eksik', 
        suggestedFix: 'Kodda seri numarası ile doğrulama alanları arasında gerçek GS karakteri kullanılmalıdır.' 
      };
    }

    if (interpreted.includes(' 91') || interpreted.includes(' 92') || interpreted.includes(' 93') || interpreted.includes(' 21')) {
      return { 
        success: false, 
        normalized: '', 
        errorMessage: 'GS grup ayırıcı eksik veya yanlış yerde. Kodda boşluk kullanılmış olabilir.', 
        errorType: 'GS Ayırıcı Eksik', 
        suggestedFix: 'Kodda boşluk yerine gerçek GS karakteri kullanılmalıdır.' 
      };
    }

    const startsWithGs = interpreted.length > 0 && interpreted[0] === GS;
    let stripped = startsWithGs ? interpreted.substring(1) : interpreted;

    if (looksLikeParenthesizedAi(stripped)) {
      stripped = convertParenthesizedAiToRaw(stripped);
    }

    const isGs1Candidate = stripped.startsWith('01');

    if (selectedProfile === 'Auto' && !isGs1Candidate) {
      return { success: true, normalized: interpreted };
    }

    if (!isGs1Candidate) {
      return { success: false, normalized: '', errorMessage: '01 AI bulunamadı.', errorType: '01 AI Eksik', suggestedFix: 'Kodun başlangıcında 01 uygulama tanımlayıcısı (GTIN) bulunmalıdır.' };
    }

    if (stripped.length < 16) {
      return { success: false, normalized: '', errorMessage: 'GTIN 14 hane değil.', errorType: 'GTIN Hatalı', suggestedFix: '01 alanından sonra 14 haneli ürün kodu (GTIN) girilmelidir.' };
    }

    const ai01 = stripped.substring(0, 2);
    const gtin = stripped.substring(2, 16);

    if (ai01 !== '01') {
      return { success: false, normalized: '', errorMessage: '01 AI bulunamadı.', errorType: '01 AI Eksik', suggestedFix: 'Kodun başlangıcında 01 uygulama tanımlayıcısı (GTIN) bulunmalıdır.' };
    }

    if (gtin.length !== 14) {
      return { success: false, normalized: '', errorMessage: 'GTIN 14 hane değil.', errorType: 'GTIN Hatalı', suggestedFix: 'GTIN alanı tam olarak 14 karakterden oluşmalıdır.' };
    }

    if (!/^\d+$/.test(gtin)) {
      return { success: false, normalized: '', errorMessage: 'GTIN sadece rakamlardan oluşmalı.', errorType: 'GTIN Sayısal Değil', suggestedFix: 'GTIN alanında harf veya özel karakter bulunmamalı, sadece rakamlar kullanılmalıdır.' };
    }

    if (stripped.length < 18 || stripped.substring(16, 18) !== '21') {
      return { success: false, normalized: '', errorMessage: '21 AI bulunamadı.', errorType: '21 AI Eksik', suggestedFix: 'GTIN alanından sonra 21 seri numarası uygulama tanımlayıcısı gelmelidir.' };
    }

    const rest = stripped.substring(18);
    if (!rest) {
      return { success: false, normalized: '', errorMessage: 'Seri numarası boş.', errorType: 'Seri Numarası Eksik', suggestedFix: '21 alanından sonra boş olmayan bir seri numarası eklenmelidir.' };
    }

    // Check if both AI 92 and AI 93 are actually present in the parsed structure
    let hasAi92 = false;
    let hasAi93 = false;

    if (rest.includes(GS)) {
      const parts = rest.split(GS);
      // parts[0] is serial, parts[1..] are AI blocks
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part.startsWith('93')) {
          hasAi93 = true;
        }
        if (part.startsWith('92') || part.startsWith('91')) {
          hasAi92 = true;
        }
      }
    } else {
      // No GS character. Let's use findMissingGsSplitPosition to see what we get.
      const splitPos = findMissingGsSplitPosition(rest, selectedProfile);
      if (splitPos > 0) {
        const remainderTemp = rest.substring(splitPos);
        if (remainderTemp.startsWith('93')) {
          hasAi93 = true;
        } else if (remainderTemp.startsWith('91')) {
          hasAi92 = true;
        }
      }
    }

    if (hasAi92 && hasAi93) {
      return { success: false, normalized: '', errorMessage: 'Hem 92 hem 93 alanı var; şablon belirsiz.', errorType: 'Şablon Belirsiz', suggestedFix: 'Kripto alanlarından sadece birini kullanın (ya 91+92 ya da sadece 93).' };
    }

    let serial = '';
    let remainder = '';
    let warningMessage: string | undefined = undefined;

    const gsPos = rest.indexOf(GS);
    if (gsPos < 0) {
      const hasCrypto = rest.includes('91') || rest.includes('92') || rest.includes('93');
      if (selectedProfile === 'Gs1' || (selectedProfile === 'Auto' && !hasCrypto)) {
        if (rest.length > 20) {
          return { success: false, normalized: '', errorMessage: 'Seri numarası 20 karakterden uzun olamaz.', errorType: 'Seri Numarası Çok Uzun', suggestedFix: 'Seri numarasını kısaltın veya doğru yerde GS ayırıcı kullandığınızdan emin olun.' };
        }
        return {
          success: true,
          normalized: GS + '01' + gtin + '21' + rest,
          warningMessage: selectedProfile === 'Auto' ? 'Doğrulama/kripto alanları eksik olabilir.' : undefined
        };
      }

      const splitPos = findMissingGsSplitPosition(rest, selectedProfile);

      if (splitPos > 0) {
        serial = rest.substring(0, splitPos);
        remainder = rest.substring(splitPos);
        warningMessage = 'GS grup ayırıcı eksik. Kod otomatik düzeltildi (GS ayırıcı eklendi).';
      } else {
        return { 
          success: false, 
          normalized: '', 
          errorMessage: '21 seri numarasından sonra 91/92/93 alanlarına geçişte GS grup ayırıcı bulunamadı.', 
          errorType: 'GS Ayırıcı Eksik', 
          suggestedFix: 'Kodda seri numarası ile doğrulama alanları arasında gerçek GS karakteri kullanılmalıdır.' 
        };
      }
    } else {
      serial = rest.substring(0, gsPos);
      remainder = rest.substring(gsPos + 1);
    }

    if (!serial) {
      return { success: false, normalized: '', errorMessage: 'Seri numarası boş.', errorType: 'Seri Numarası Eksik', suggestedFix: '21 alanından sonra boş olmayan bir seri numarası eklenmelidir.' };
    }

    // Validate serial length
    if (selectedProfile === 'ZnakCosmetics' || selectedProfile === 'ZnakShort') {
      if (serial.length !== 6) {
        return { success: false, normalized: '', errorMessage: 'Seri numarası beklenen uzunlukta değil (Kozmetik için 6 karakter olmalıdır).', errorType: 'Seri Numarası Uzunluğu Hatalı', suggestedFix: 'Seri numarasını 6 karakter olacak şekilde düzenleyin.' };
      }
    } else if (selectedProfile === 'ZnakLightIndustry') {
      if (serial.length !== 13) {
        return { success: false, normalized: '', errorMessage: 'Seri numarası beklenen uzunlukta değil (Hafif Sanayi için 13 karakter olmalıdır).', errorType: 'Seri Numarası Uzunluğu Hatalı', suggestedFix: 'Seri numarasını 13 karakter olacak şekilde düzenleyin.' };
      }
    } else if (selectedProfile === 'Auto') {
      if (remainder.startsWith('93')) {
        if (serial.length !== 6) {
          return { success: false, normalized: '', errorMessage: 'Seri numarası beklenen uzunlukta değil (Kozmetik Kısa şablonu için 6 karakter olmalıdır).', errorType: 'Seri Numarası Uzunluğu Hatalı', suggestedFix: 'Seri numarasını 6 karakter olacak şekilde düzenleyin.' };
        }
      } else if (remainder.startsWith('91')) {
        if (serial.length !== 6 && serial.length !== 13) {
          return { success: false, normalized: '', errorMessage: 'Seri numarası beklenen uzunlukta değil (Kozmetik için 6, Hafif Sanayi için 13 karakter olmalıdır).', errorType: 'Seri Numarası Uzunluğu Hatalı', suggestedFix: 'Seri numarasını 6 veya 13 karakter olacak şekilde düzenleyin.' };
        }
      }
    }

    if (remainder.startsWith('93')) {
      if (selectedProfile === 'ZnakCosmetics' || selectedProfile === 'ZnakLightIndustry') {
        return { success: false, normalized: '', errorMessage: 'Kod yapısı seçilen şablonla eşleşmiyor (Kısa şablon 93 alanı tespit edildi).', errorType: 'Şablon Eşleşmedi', suggestedFix: 'Doğrulama profilini \'Kısa Şablon\' veya \'Otomatik Algıla\' olarak değiştirin.' };
      }
      const crypto = remainder.substring(2);
      if (crypto.includes(GS)) {
        return { success: false, normalized: '', errorMessage: '93 alanından sonra beklenmeyen veri veya GS ayırıcı var.', errorType: 'Kripto Kod Geçersiz', suggestedFix: '93 kripto alanından sonra herhangi bir veri bulunmamalıdır.' };
      }
      if (!crypto) {
        return { success: false, normalized: '', errorMessage: '93 alanı var ancak kripto kod boş.', errorType: 'Kripto Kod Eksik', suggestedFix: '93 alanından sonra 4 karakterli kripto kodu ekleyin.' };
      }
      if (crypto.length !== 4) {
        return { success: false, normalized: '', errorMessage: 'Kripto kod beklenen uzunlukta değil (Kısa şablon için 4 karakter olmalıdır).', errorType: 'Kripto Kod Uzunluğu Hatalı', suggestedFix: 'Kripto kod uzunluğunu kontrol edin, tam olarak 4 karakter olmalıdır.' };
      }

      return {
        success: true,
        normalized: GS + '01' + gtin + '21' + serial + GS + '93' + crypto,
        warningMessage: warningMessage
      };
    } else if (remainder.startsWith('91')) {
      if (selectedProfile === 'ZnakShort') {
        return { success: false, normalized: '', errorMessage: 'Kod yapısı seçilen şablonla eşleşmiyor (Standart 91 alanı tespit edildi).', errorType: 'Şablon Eşleşmedi', suggestedFix: 'Doğrulama profilini \'Kozmetik / Ev Kimyasalları\' veya \'Otomatik Algıla\' olarak değiştirin.' };
      }
      const restAfter91 = remainder.substring(2);
      const gs2Pos = restAfter91.indexOf(GS);
      if (gs2Pos < 0) {
        if (restAfter91.includes('92')) {
          return { success: false, normalized: '', errorMessage: '91 doğrulama anahtarından sonra 92 alanına geçişte GS grup ayırıcı olmadığından format hatalı.', errorType: 'GS Ayırıcı Eksik', suggestedFix: '91 doğrulama anahtarı ile 92 kripto alanı arasına gerçek GS karakteri yerleştirilmelidir.' };
        } else {
          return { success: false, normalized: '', errorMessage: '91 alanı var ama 92 alanı yok.', errorType: '92 AI Eksik', suggestedFix: 'Kodun sonuna 92 uygulama tanımlayıcısı ve kripto kod eklenmelidir.' };
        }
      }
      const v91 = restAfter91.substring(0, gs2Pos);
      const after91 = restAfter91.substring(gs2Pos + 1);

      if (!v91) {
        return { success: false, normalized: '', errorMessage: '91 alanı var ancak doğrulama anahtarı boş.', errorType: 'Doğrulama Anahtarı Eksik', suggestedFix: '91 alanından sonra 4 karakterli doğrulama anahtarını ekleyin.' };
      }
      if (v91.length !== 4) {
        return { success: false, normalized: '', errorMessage: '91 doğrulama anahtarı beklenen uzunlukta değil (4 karakter olmalıdır).', errorType: 'Doğrulama Anahtarı Uzunluğu Hatalı', suggestedFix: 'Doğrulama anahtarı uzunluğunu kontrol edin, tam olarak 4 karakter olmalıdır.' };
      }
      if (!after91.startsWith('92')) {
        return { success: false, normalized: '', errorMessage: '91 alanından sonra 92 alanı bekleniyor.', errorType: '92 AI Eksik', suggestedFix: 'Doğrulama anahtarından sonra 92 uygulama tanımlayıcısı ile devam edin.' };
      }
      const crypto = after91.substring(2);
      if (!crypto) {
        return { success: false, normalized: '', errorMessage: '92 alanı var ancak kripto kod boş.', errorType: 'Kripto Kod Eksik', suggestedFix: '92 alanından sonra 44 karakterli kripto kodu ekleyin.' };
      }
      if (crypto.length !== 44) {
        return { success: false, normalized: '', errorMessage: 'Kripto kod beklenen uzunlukta değil (Standart şablon için 44 karakter olmalıdır).', errorType: 'Kripto Kod Uzunluğu Hatalı', suggestedFix: 'Kripto kod uzunluğunu kontrol edin, tam olarak 44 karakter olmalıdır.' };
      }

      return {
        success: true,
        normalized: GS + '01' + gtin + '21' + serial + GS + '91' + v91 + GS + '92' + crypto,
        warningMessage: warningMessage
      };
    } else if (remainder.startsWith('92')) {
      return { success: false, normalized: '', errorMessage: '92 alanı bulundu ancak 91 doğrulama anahtarı eksik.', errorType: '91 AI Eksik', suggestedFix: 'Standart şablonda 91 and 92 alanları birlikte bulunmalıdır.' };
    }

    return { success: false, normalized: '', errorMessage: 'Kod yapısı PDF’teki desteklenen şablonlarla eşleşmiyor.', errorType: 'Şablon Uyuşmazlığı', suggestedFix: 'Kripto alanları için 91+92 veya 93 uygulama tanımlayıcılarını kullanın.' };
  };

  const looksLikeParenthesizedAi = (s: string) => {
    return s.includes('(01)') || s.includes('(21)') || s.includes('(91)') || s.includes('(92)') || s.includes('(93)');
  };

  const convertParenthesizedAiToRaw = (s: string) => {
    return s.replace(/\(01\)/g, '01')
            .replace(/\(21\)/g, '21')
            .replace(/\(91\)/g, '91')
            .replace(/\(92\)/g, '92')
            .replace(/\(93\)/g, '93')
            .trim();
  };

  const findMissingGsSplitPosition = (rest: string, selectedProfile: string): number => {
    if (!rest) return -1;

    if ((selectedProfile === 'Auto' || selectedProfile === 'ZnakShort') &&
        rest.length === 12 &&
        rest.substring(6, 8) === '93') {
      return 6;
    }

    if ((selectedProfile === 'Auto' || selectedProfile === 'ZnakCosmetics') &&
        rest.length > 12 &&
        rest.substring(6).startsWith('91')) {
      return 6;
    }

    if ((selectedProfile === 'Auto' || selectedProfile === 'ZnakLightIndustry') &&
        rest.length > 19 &&
        rest.substring(13).startsWith('91')) {
      return 13;
    }

    let splitPos = -1;
    for (const ai of ['91', '92', '93']) {
      const idx = rest.indexOf(ai);
      if (idx > 0 && (splitPos === -1 || idx < splitPos)) {
        splitPos = idx;
      }
    }

    return splitPos;
  };

  // High-performance asynchronous reader and validator
  const processFileContent = (text: string, currentProfile: string) => {
    setAnalyzing(true);
    setErrorMessage(null);
    setAnalysis(null);
    setLogs([]);
    addLog('Dosya okuma başlatıldı...');

    const rawLines = text.split(/\r?\n/);
    const totalRaw = rawLines.length;
    addLog(`Toplam ${totalRaw.toLocaleString()} satır okundu. Analiz başlıyor...`);

    const validCodes: string[] = [];
    const errors: ValidationError[] = [];
    let warningCount = 0;

    let index = 0;
    const chunkSize = 5000;

    const processChunk = () => {
      const limit = Math.min(index + chunkSize, totalRaw);
      for (let i = index; i < limit; i++) {
        const line = rawLines[i];
        const rowNo = i + 1;

        if (line === null || line === undefined) continue;
        const trimmed = line.trim();
        if (!trimmed) continue;

        const valResult = validateCodeClientSide(line, currentProfile);
        if (valResult.success) {
          validCodes.push(valResult.normalized);
          if (valResult.warningMessage) {
            warningCount++;
            errors.push({
              rowNo,
              rawLine: line,
              errorMessage: valResult.warningMessage,
              errorType: valResult.errorType || 'GS Ayırıcı Eksik',
              suggestedFix: valResult.suggestedFix || 'Otomatik düzeltildi (GS ayırıcı eklendi).',
              isWarning: true
            });
          }
        } else {
          errors.push({
            rowNo,
            rawLine: line,
            errorMessage: valResult.errorMessage || 'Geçersiz format',
            errorType: valResult.errorType || 'Hata',
            suggestedFix: valResult.suggestedFix || 'Kodu kontrol edin.'
          });
        }
      }

      index = limit;
      const progress = Math.round((index / totalRaw) * 100);
      setProgressPercent(progress);
      setProgressStage(`Dosya doğrulanıyor: ${index.toLocaleString()} / ${totalRaw.toLocaleString()}`);

      if (index < totalRaw) {
        setTimeout(processChunk, 0);
      } else {
        // Completed validation!
        setFileCodes(validCodes);
        const hardErrorsCount = errors.filter(e => !e.isWarning).length;
        setAnalysis({
          totalLines: validCodes.length + hardErrorsCount,
          validCount: validCodes.length,
          invalidCount: hardErrorsCount,
          previewCodes: validCodes.slice(0, 5),
          errors: errors,
          warningCount: warningCount
        });

        addLog(`Analiz tamamlandı.`);
        addLog(`Geçerli kod: ${validCodes.length.toLocaleString()}`);
        addLog(`Hatalı satır: ${hardErrorsCount.toLocaleString()}`);
        if (warningCount > 0) {
          addLog(`⚠ ${warningCount.toLocaleString()} kodda uyarı mevcut.`);
        }

        if (validCodes.length > 0) {
          loadPreviewImage(validCodes[0]);
        }
        setAnalyzing(false);
      }
    };

    setTimeout(processChunk, 0);
  };

  // Trigger analysis when file is selected
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        processFileContent(event.target.result as string, profile);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          processFileContent(event.target.result as string, profile);
        }
      };
      reader.readAsText(droppedFile);
    }
  };

  // When profile is changed, re-run analysis
  const handleProfileChange = (newProfile: string) => {
    setProfile(newProfile);
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          processFileContent(event.target.result as string, newProfile);
        }
      };
      reader.readAsText(file);
    }
  };

  const resetCreator = () => {
    setFile(null);
    setFileCodes([]);
    setAnalysis(null);
    setErrorMessage(null);
    setProgressPercent(0);
    setProgressStage('');
    setLogs([]);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Download errors as CSV
  const downloadErrorsCSV = () => {
    if (!analysis || analysis.errors.length === 0) return;
    let csvContent = 'Satir No,Barkod,Hata Tipi,Aciklama,Onerilen Duzeltme\n';
    analysis.errors.forEach(err => {
      const lineEsc = err.rawLine.replace(/"/g, '""');
      const descEsc = err.errorMessage.replace(/"/g, '""');
      const typeEsc = err.errorType.replace(/"/g, '""');
      const fixEsc = err.suggestedFix.replace(/"/g, '""');
      csvContent += `${err.rowNo},"${lineEsc}","${typeEsc}","${descEsc}","${fixEsc}"\n`;
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name.replace(/\.[^/.]+$/, '') || 'datamatrix'}_hatali_kodlar.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // High-performance Generator
  const handleGenerate = async () => {
    if (fileCodes.length === 0 || !file) return;

    setGenerating(true);
    setProgressPercent(0);
    setLogs([]);
    addLog('Üretim işlemi başlatılıyor...');

    let chunkSizeVal = fileCodes.length;
    if (splitOption !== 'none') {
      if (splitOption === 'custom') {
        chunkSizeVal = customSplitVal;
      } else {
        chunkSizeVal = parseInt(splitOption, 10);
      }
    }

    const totalCodes = fileCodes.length;
    const chunks: string[][] = [];
    for (let i = 0; i < totalCodes; i += chunkSizeVal) {
      chunks.push(fileCodes.slice(i, i + chunkSizeVal));
    }

    const totalChunks = chunks.length;
    addLog(`Kodlar ${totalChunks} gruba ayrıldı. ${format} çıktısı hazırlanıyor...`);

    try {
      const generatedBlobs: { name: string; blob: Blob }[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const chunkCodes = chunks[i];
        const chunkIndexStr = String(i + 1).padStart(3, '0');
        setProgressStage(`Belge üretiliyor: Grup ${i + 1} / ${totalChunks}`);
        addLog(`Grup ${i + 1} gönderiliyor (${chunkCodes.length} kod)...`);

        const chunkBlob = new Blob([chunkCodes.join('\n')], { type: 'text/plain' });
        const startIndex = i * chunkSizeVal + 1;
        
        const formData = new FormData();
        formData.append('file', chunkBlob, `part_${chunkIndexStr}.txt`);
        formData.append('format', format);
        formData.append('profile', profile);
        formData.append('cols', cols.toString());
        formData.append('rows', rows.toString());
        formData.append('size', size.toString());
        formData.append('addText', addText.toString());
        formData.append('line1', line1);
        formData.append('line2', line2);
        formData.append('labelBelow', labelBelow.toString());
        formData.append('startIndex', startIndex.toString());
        formData.append('totalCodes', totalCodes.toString());
        formData.append('fontSize', fontSize.toString());

        const responseBlob = await api.post('/api/datamatrix/generate', formData);

        if (responseBlob instanceof Blob) {
          const extension = format === 'PNG' ? 'zip' : 'pdf';
          generatedBlobs.push({
            name: `part_${chunkIndexStr}.${extension}`,
            blob: responseBlob
          });
          
          const progress = Math.round(((i + 1) / totalChunks) * 100);
          setProgressPercent(progress);
          addLog(`✓ Grup ${i + 1} başarıyla oluşturuldu.`);
        } else {
          throw new Error(`Grup ${i + 1} oluşturulurken hata oluştu.`);
        }
      }

      setProgressStage('Dosya derleniyor...');
      if (generatedBlobs.length === 1) {
        const fileObj = generatedBlobs[0];
        const url = URL.createObjectURL(fileObj.blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = format === 'PNG' 
          ? `${file.name.replace(/\.[^/.]+$/, '')}_datamatrix.zip`
          : `${file.name.replace(/\.[^/.]+$/, '')}_datamatrix.pdf`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        
        saveHistoryRecord(totalCodes, fileObj.blob.size, 'Tamamlandı');
        addLog('İşlem tamamlandı. Dosya başarıyla indirildi.');
      } else {
        addLog('Birden fazla parça bulundu. ZIP arşivi hazırlanıyor...');
        const zip = new JSZip();
        generatedBlobs.forEach(fileObj => {
          zip.file(fileObj.name, fileObj.blob);
        });

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${file.name.replace(/\.[^/.]+$/, '')}_${totalCodes}_datamatrix.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        saveHistoryRecord(totalCodes, zipBlob.size, 'Tamamlandı');
        addLog(`İşlem tamamlandı. ${totalChunks} PDF dosyası ZIP olarak indirildi.`);
      }

    } catch (err: any) {
      const errMsg = err.message || 'Dosya üretilirken bir sunucu hatası oluştu.';
      setErrorMessage(errMsg);
      addLog(`❌ HATA: ${errMsg}`);
      saveHistoryRecord(totalCodes, 0, 'Hata');
    } finally {
      setGenerating(false);
      setProgressPercent(100);
      setProgressStage('Tamamlandı');
    }
  };

  const saveHistoryRecord = async (codeCount: number, bytes: number, status: 'Tamamlandı' | 'Hata') => {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
    const date = new Date().toLocaleString();
    const fileSizeStr = bytes > 0 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : '0 KB';
    const splitStr = splitOption === 'none' 
      ? 'Bölme Yok' 
      : splitOption === 'custom' 
        ? `Her ${customSplitVal} kod` 
        : `Her ${splitOption} kod`;

    const newItem: HistoryItem = {
      id,
      date,
      totalCount: (analysis?.totalLines || codeCount),
      validCount: codeCount,
      invalidCount: (analysis?.invalidCount || 0),
      format,
      cols,
      rows,
      size,
      splitSize: splitStr,
      fileSizeStr,
      status,
      username: user?.name || 'Operatör'
    };

    const updated = [newItem, ...historyList].slice(0, 50);
    setHistoryList(updated);
    localStorage.setItem('datamatrix_generation_history', JSON.stringify(updated));

    try {
      await saveCodesToDB(id, fileCodes);
    } catch (err) {
      console.error('IndexedDB kayıt hatası:', err);
    }
  };

  const handleReDownload = async (item: HistoryItem) => {
    setLogs([]);
    addLog(`Geçmiş kayıttan tekrar yükleme başlatıldı: ${item.date}`);
    try {
      const storedCodes = await getCodesFromDB(item.id);
      if (!storedCodes || storedCodes.length === 0) {
        addLog('❌ Hata: Bu kayda ait kod listesi bulunamadı.');
        return;
      }

      setFormat(item.format);
      setCols(item.cols);
      setRows(item.rows);
      setSize(item.size);
      
      addLog(`Kod listesi IndexedDB'den başarıyla yüklendi (${storedCodes.length} kod).`);
      
      setFileCodes(storedCodes);
      const mockFile = new File([storedCodes.join('\n')], `re_download_${item.id.substring(0, 8)}.txt`, { type: 'text/plain' });
      setFile(mockFile);

      setAnalysis({
        totalLines: item.totalCount,
        validCount: item.validCount,
        invalidCount: item.invalidCount,
        previewCodes: storedCodes.slice(0, 5),
        errors: [],
        warningCount: 0
      });

      window.scrollTo({ top: 300, behavior: 'smooth' });
      addLog('Şablon ve düzen ayarları geri yüklendi. "Şablon İndir" butonunu kullanabilirsiniz.');
    } catch (err) {
      console.error(err);
      addLog('❌ Kayıt yüklenirken bir hata oluştu.');
    }
  };

  const getEstimatedPages = () => {
    if (!analysis || analysis.validCount === 0) return 0;
    const codesPerPage = cols * rows;
    return Math.ceil(analysis.validCount / codesPerPage);
  };

  const getEstimatedSize = () => {
    if (!analysis || analysis.validCount === 0) return '0 KB';
    const kb = analysis.validCount * 0.45;
    if (kb > 1024) {
      return `${(kb / 1024).toFixed(1)} MB`;
    }
    return `${kb.toFixed(0)} KB`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header Card */}
      <div className="card" style={{ padding: '24px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <QrCode size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0, color: 'white' }}>DataMatrix Üretici ve Doğrulayıcı</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
              Büyük hacimli üretimler (25.000 - 100.000 kod) için optimize edilmiş; Rusya Chestny ZNAK ve standart GS1 kurallarına göre anlık doğrulama yapabilen etiket şablonlama aracı.
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="error-alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* File Upload Box */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--primary)" />
                Girdi Dosyası Seçimi
              </h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Doğrulama Profili:</label>
                <select 
                  className="form-input" 
                  value={profile} 
                  onChange={(e) => handleProfileChange(e.target.value)} 
                  disabled={analyzing || generating}
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '0.85rem', margin: 0 }}
                >
                  <option value="Auto">Otomatik Algıla</option>
                  <option value="Gs1">Standart GS1</option>
                  <option value="ZnakCosmetics">Rusya Chestny ZNAK - Kozmetik</option>
                  <option value="ZnakShort">Rusya Chestny ZNAK - Kısa Şablon</option>
                  <option value="ZnakLightIndustry">Rusya Chestny ZNAK - Hafif Sanayi</option>
                  <option value="None">Sadece DataMatrix üret (Doğrulama yok)</option>
                </select>
              </div>
            </div>

            {!file ? (
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '36px 20px',
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
                <Upload size={32} color="var(--text-muted)" style={{ marginBottom: '10px', opacity: 0.7 }} />
                <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                  Dosya seçmek için tıklayın veya buraya sürükleyin
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Sadece .txt ve .csv dosyaları desteklenir. UTF-8 formatında büyük hacimli kodlar anında doğrulanır.
                </p>
              </div>
            ) : (
              <div style={{
                backgroundColor: 'var(--primary-light)',
                border: '1px solid var(--primary)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FileText size={24} color="var(--primary)" />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', margin: 0 }}>{file.name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                      {(file.size / 1024).toFixed(1)} KB | {fileCodes.length.toLocaleString()} geçerli kod
                    </p>
                  </div>
                </div>
                <button 
                  className="btn btn-secondary" 
                  onClick={resetCreator}
                  disabled={analyzing || generating}
                  style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                >
                  Sıfırla
                </button>
              </div>
            )}

            {analyzing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                  <RefreshCw size={16} className="animate-spin" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{progressStage}</span>
                </div>
                <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: 'var(--primary)', transition: 'width 0.1s ease' }}></div>
                </div>
              </div>
            )}
          </div>

          {/* Configuration Settings */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} color="var(--primary)" />
              Şablon ve Düzen Yapılandırması
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Çıktı Formatı</label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                  <label style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    border: format === 'PDF' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: format === 'PDF' ? 'var(--primary-light)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem',
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
                    PDF Şablonu
                  </label>
                  <label style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    border: format === 'PNG' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: format === 'PNG' ? 'var(--primary-light)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem',
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
                    ZIP (Bireysel PNG'ler)
                  </label>
                </div>
              </div>

              {format === 'PDF' && (
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Hazır Şablon Düzenleri</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                    {[
                      { id: '4x6', label: '4x6 (Varsayılan)' },
                      { id: '3x8', label: '3x8' },
                      { id: '2x10', label: '2x10' },
                      { id: 'A4', label: 'A4 Tam Sayfa' },
                      { id: 'zebra', label: 'Zebra Etiket' },
                      { id: 'custom', label: 'Özel Düzen' }
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className={`btn ${preset === p.id ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handlePresetChange(p.id)}
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Sütun Sayısı (Cols)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      min="1" 
                      max="15" 
                      value={cols} 
                      onChange={(e) => {
                        setCols(Math.max(1, parseInt(e.target.value) || 1));
                        setPreset('custom');
                      }} 
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Satır Sayısı (Rows)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      min="1" 
                      max="20" 
                      value={rows} 
                      onChange={(e) => {
                        setRows(Math.max(1, parseInt(e.target.value) || 1));
                        setPreset('custom');
                      }} 
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2', marginTop: '6px' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Barkod Boyutu (Punto)</span>
                      <strong>{size} pt</strong>
                    </label>
                    <input 
                      type="range" 
                      min="40" 
                      max="300" 
                      step="5" 
                      value={size} 
                      onChange={(e) => {
                        setSize(parseInt(e.target.value));
                        setPreset('custom');
                      }} 
                      style={{ width: '100%', accentColor: 'var(--primary)', marginTop: '4px' }}
                    />
                  </div>
                </div>
              )}

              {format === 'PDF' && (
                <div style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                    <input 
                      type="checkbox" 
                      checked={addText} 
                      onChange={(e) => setAddText(e.target.checked)} 
                      style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                    />
                    Barkoda Metin Açıklaması Ekle
                  </label>

                  {addText && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Metin Satırı 1 (Kalın)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Örn: Kozmetik Ürünü A" 
                          value={line1} 
                          onChange={(e) => setLine1(e.target.value)} 
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Metin Satırı 2 (Normal)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Örn: LOT: 123 / SKT: 2029" 
                          value={line2} 
                          onChange={(e) => setLine2(e.target.value)} 
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Metin Konumu</label>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                            <input 
                              type="radio" 
                              name="labelPos" 
                              checked={!labelBelow} 
                              onChange={() => setLabelBelow(false)} 
                              style={{ accentColor: 'var(--primary)' }}
                            />
                            Barkodun Üstünde
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
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
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Yazı Boyutu (Punto)</label>
                        <select 
                          className="form-input" 
                          value={fontSize} 
                          onChange={(e) => setFontSize(parseInt(e.target.value))}
                          style={{ marginTop: '4px' }}
                        >
                          <option value="6">6 pt</option>
                          <option value="7">7 pt</option>
                          <option value="8">8 pt</option>
                          <option value="9">9 pt</option>
                          <option value="10">10 pt</option>
                          <option value="11">11 pt</option>
                          <option value="12">12 pt</option>
                          <option value="14">14 pt</option>
                          <option value="16">16 pt</option>
                          <option value="18">18 pt</option>
                          <option value="20">20 pt</option>
                          <option value="24">24 pt</option>
                          <option value="28">28 pt</option>
                          <option value="32">32 pt</option>
                          <option value="36">36 pt</option>
                          <option value="40">40 pt</option>
                          <option value="48">48 pt</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {format === 'PDF' && (
                <div style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>PDF Bölme (Segmentasyon)</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <select 
                      className="form-input" 
                      value={splitOption} 
                      onChange={(e) => setSplitOption(e.target.value)}
                      style={{ margin: 0, flex: 1 }}
                    >
                      <option value="none">Bölme Yok (Tek PDF)</option>
                      <option value="500">Her 500 kodda bir</option>
                      <option value="1000">Her 1.000 kodda bir</option>
                      <option value="2000">Her 2.000 kodda bir</option>
                      <option value="5000">Her 5.000 kodda bir</option>
                      <option value="custom">Özel değer...</option>
                    </select>
                    {splitOption === 'custom' && (
                      <input 
                        type="number" 
                        className="form-input" 
                        value={customSplitVal} 
                        onChange={(e) => setCustomSplitVal(Math.max(10, parseInt(e.target.value) || 1000))} 
                        style={{ width: '100px', margin: 0 }} 
                      />
                    )}
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
                    Çok büyük dosyalarda (25.000+) tarayıcının ve sunucunun donmaması için etiketlerinizi parçalı PDF'lere ayırabilirsiniz. Parçalar ZIP arşivi olarak indirilir.
                  </p>
                </div>
              )}

              <button 
                className="btn btn-primary"
                disabled={fileCodes.length === 0 || generating || analyzing}
                onClick={handleGenerate}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  marginTop: '8px'
                }}
              >
                {generating ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Belgeler Üretiliyor...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    {format === 'PDF' ? 'Şablon İndir (PDF)' : 'ZIP formatında PNG\'leri İndir'}
                  </>
                )}
              </button>

              {generating && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--primary)' }}>{progressStage}</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: 'var(--primary)', transition: 'width 0.2s ease-out' }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Live Preview Panel */}
          <div className="card" style={{ padding: '24px', minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="var(--primary)" />
                Etiket Canlı Önizleme
              </h3>
              
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  className={`btn ${previewTab === 'layout' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPreviewTab('layout')}
                  style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px' }}
                >
                  Sayfa Düzeni
                </button>
                <button 
                  className={`btn ${previewTab === 'single' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPreviewTab('single')}
                  disabled={!previewUrl}
                  style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px' }}
                >
                  Tekil Barkod
                </button>
              </div>
            </div>

            {previewTab === 'layout' ? (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                overflow: 'auto',
                maxHeight: '400px'
              }} className="layout-preview-box">
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Aşağıdaki ızgara PDF belgenizin sayfa düzenini temsil eder. (Önizleme amacıyla max 4x4 hücre gösterilir)
                </p>
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  padding: '12px',
                  width: '100%',
                  maxWidth: '300px',
                  aspectRatio: '1/1.414',
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(cols, 4)}, 1fr)`,
                  gridTemplateRows: `repeat(${Math.min(rows, 4)}, 1fr)`,
                  gap: '4px',
                  alignContent: 'start'
                }}>
                  {Array.from({ length: Math.min(cols, 4) * Math.min(rows, 4) }).map((_, idx) => (
                    <div 
                      key={idx} 
                      style={{
                        border: '1px dashed #e2e8f0',
                        borderRadius: '2px',
                        display: 'flex',
                        flexDirection: labelBelow ? 'column' : 'column-reverse',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2px',
                        fontSize: '5px',
                        overflow: 'hidden',
                        textAlign: 'center'
                      }}
                    >
                      {!labelBelow && addText && (
                        <div style={{ scale: '0.75', transformOrigin: 'center', width: '100%' }}>
                          <div style={{ fontWeight: 'bold', color: '#000', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{line1 || 'Satır 1'}</div>
                          <div style={{ color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{line2 || 'Satır 2'}</div>
                        </div>
                      )}
                      
                      <svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" style={{ margin: '1px 0' }}>
                        <rect x="2" y="2" width="20" height="20" fill="none" stroke="#000" strokeWidth="2" />
                        <rect x="4" y="4" width="4" height="4" fill="#000" />
                        <rect x="4" y="10" width="4" height="2" fill="#000" />
                        <rect x="4" y="14" width="2" height="4" fill="#000" />
                        <rect x="8" y="4" width="2" height="4" fill="#000" />
                        <rect x="12" y="4" width="4" height="4" fill="#000" />
                        <rect x="18" y="4" width="2" height="6" fill="#000" />
                        <rect x="10" y="10" width="4" height="4" fill="#000" />
                        <rect x="16" y="12" width="4" height="2" fill="#000" />
                        <rect x="8" y="16" width="6" height="4" fill="#000" />
                        <rect x="16" y="16" width="4" height="4" fill="#000" />
                      </svg>
                      {labelBelow && addText && (
                        <div style={{ scale: '0.75', transformOrigin: 'center', width: '100%' }}>
                          <div style={{ fontWeight: 'bold', color: '#000', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{line1 || 'Satır 1'}</div>
                          <div style={{ color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{line2 || 'Satır 2'}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Sayfa Düzeni: {cols} sütun x {rows} satır | Boyut: {size} pt
                </div>
              </div>
            ) : (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
                textAlign: 'center'
              }}>
                {previewUrl ? (
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ 
                      display: 'inline-flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      backgroundColor: 'white', 
                      padding: '20px', 
                      borderRadius: 'var(--radius-sm)', 
                      boxShadow: 'var(--shadow-sm)', 
                      border: '1px solid var(--border-color)',
                      gap: '8px'
                    }}>
                      {addText && !labelBelow && (
                        <div style={{ textAlign: 'center', wordBreak: 'break-word', maxWidth: '170px' }}>
                          {line1 && <div style={{ fontSize: `${Math.max(10, fontSize)}px`, fontWeight: 'bold', color: 'black', marginBottom: '2px' }}>{line1}</div>}
                          {line2 && <div style={{ fontSize: `${Math.max(9, fontSize - 2)}px`, color: '#334155' }}>{line2}</div>}
                        </div>
                      )}
                      <img 
                        src={previewUrl} 
                        alt="DataMatrix Preview" 
                        style={{ 
                          width: '150px', 
                          height: '150px', 
                          objectFit: 'contain', 
                          backgroundColor: 'white', 
                          padding: '2px', 
                        }}
                      />
                      {addText && labelBelow && (
                        <div style={{ textAlign: 'center', wordBreak: 'break-word', maxWidth: '170px' }}>
                          {line1 && <div style={{ fontSize: `${Math.max(10, fontSize)}px`, fontWeight: 'bold', color: 'black', marginBottom: '2px' }}>{line1}</div>}
                          {line2 && <div style={{ fontSize: `${Math.max(9, fontSize - 2)}px`, color: '#334155' }}>{line2}</div>}
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', width: '100%', maxWidth: '250px', wordBreak: 'break-all' }}>
                      <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px', fontSize: '0.85rem' }}>Listenin İlk Geçerli Kodu:</p>
                      <code style={{ fontSize: '0.75rem', backgroundColor: 'rgba(0,0,0,0.05)', padding: '2px 4px', borderRadius: '3px' }}>
                        {analysis?.previewCodes[0]}
                      </code>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Lütfen dosya yükleyin. İlk geçerli barkodun sunucu görüntüsü burada görünecektir.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Analysis Summary Info */}
          {analysis && (
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={18} color="var(--success)" />
                Yüklenen Dosya Üretim Özeti
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOPLAM SATIR</span>
                  <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{analysis.totalLines.toLocaleString()}</p>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'var(--success-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--success-border)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--success-text)', fontWeight: 600 }}>GEÇERLİ KOD</span>
                  <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--success-text)' }}>{analysis.validCount.toLocaleString()}</p>
                </div>
                <div style={{ padding: '12px', backgroundColor: analysis.invalidCount > 0 ? 'var(--danger-bg)' : 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: analysis.invalidCount > 0 ? '1px solid var(--danger-border)' : '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.75rem', color: analysis.invalidCount > 0 ? 'var(--danger-text)' : 'var(--text-muted)', fontWeight: 600 }}>HATALI SATIR</span>
                  <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: analysis.invalidCount > 0 ? 'var(--danger-text)' : 'var(--text-main)' }}>{analysis.invalidCount.toLocaleString()}</p>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TAHMİNİ PDF SAYFASI</span>
                  <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{getEstimatedPages().toLocaleString()}</p>
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tahmini PDF Boyutu:</span>
                  <strong style={{ color: 'var(--text-main)' }}>{getEstimatedSize()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Uygulanan Şablon Düzeni:</span>
                  <strong style={{ color: 'var(--text-main)' }}>{cols} Sütun x {rows} Satır</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Hedef Çıktı Formatı:</span>
                  <strong style={{ color: 'var(--text-main)' }}>{format === 'PDF' ? 'PDF Belgesi' : 'PNG Resimleri (ZIP)'}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Terminal Log Console */}
      {logs.length > 0 && (
        <div className="card" style={{ padding: '16px', backgroundColor: '#0f172a', color: '#38bdf8', fontFamily: 'monospace', borderRadius: 'var(--radius-md)', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #1e293b', paddingBottom: '8px', marginBottom: '8px', color: '#94a3b8' }}>
            <Terminal size={14} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>İşlem Günlüğü (Console Log)</span>
          </div>
          <div 
            ref={logContainerRef}
            style={{ maxHeight: '120px', overflowY: 'auto', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px', color: '#a5f3fc' }}
          >
            {logs.map((log, idx) => (
              <div key={idx}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {/* Error / Warning Report Panel */}
      {analysis && (analysis.invalidCount > 0 || analysis.warningCount > 0) && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ 
              fontSize: '1.1rem', 
              margin: 0, 
              color: analysis.invalidCount > 0 ? 'var(--danger-text)' : 'var(--warning-text)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px' 
            }}>
              {analysis.invalidCount > 0 ? <AlertCircle size={18} /> : <AlertTriangle size={18} color="var(--warning)" />}
              GS1 Doğrulama Raporu ({analysis.invalidCount > 0 ? `${analysis.invalidCount} hata` : ''} {analysis.invalidCount > 0 && analysis.warningCount > 0 ? 've' : ''} {analysis.warningCount > 0 ? `${analysis.warningCount} uyarı` : ''} tespit edildi)
            </h3>
            
            <button 
              className="btn btn-secondary" 
              onClick={downloadErrorsCSV}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem' }}
            >
              <FileSpreadsheet size={16} />
              Hatalı / Uyarılı Satırları CSV Olarak İndir
            </button>
          </div>

          <div style={{
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)'
          }}>
            <table className="data-table" style={{ margin: 0, width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-primary)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ width: '80px', padding: '10px' }}>Satır No</th>
                  <th style={{ width: '250px', padding: '10px' }}>Kod Önizleme</th>
                  <th style={{ width: '150px', padding: '10px' }}>Hata/Uyarı Tipi</th>
                  <th style={{ padding: '10px' }}>Açıklama</th>
                  <th style={{ width: '220px', padding: '10px' }}>Önerilen Düzeltme</th>
                </tr>
              </thead>
              <tbody>
                {analysis.errors.map((err, idx) => {
                  const isWarn = err.isWarning;
                  return (
                    <tr key={idx} style={{ backgroundColor: isWarn ? 'var(--warning-bg)' : 'var(--danger-bg)' }}>
                      <td style={{ fontWeight: 'bold', color: isWarn ? 'var(--warning-text)' : 'var(--danger-text)', padding: '10px' }}>{err.rowNo}</td>
                      <td style={{ fontFamily: 'monospace', wordBreak: 'break-all', padding: '10px', color: isWarn ? 'var(--warning-text)' : 'var(--text-main)' }}>{err.rawLine}</td>
                      <td style={{ color: isWarn ? 'var(--warning-text)' : 'var(--danger-text)', fontWeight: 600, padding: '10px' }}>{err.errorType}</td>
                      <td style={{ color: isWarn ? 'var(--warning-text)' : 'var(--danger-text)', padding: '10px' }}>{err.errorMessage}</td>
                      <td style={{ color: 'var(--text-main)', fontSize: '0.8rem', padding: '10px', backgroundColor: 'rgba(255,255,255,0.4)' }}>{err.suggestedFix}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History log panel */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <History size={18} color="var(--primary)" />
          Son İşlemler ve Geçmiş
        </h3>

        {historyList.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)' }}>
            Henüz yapılmış bir DataMatrix üretimi bulunmamaktadır.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ margin: 0, width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px' }}>Tarih</th>
                  <th style={{ padding: '10px' }}>Kod Sayısı</th>
                  <th style={{ padding: '10px' }}>Format</th>
                  <th style={{ padding: '10px' }}>Düzen</th>
                  <th style={{ padding: '10px' }}>Parçalama Boyutu</th>
                  <th style={{ padding: '10px' }}>Dosya Boyutu</th>
                  <th style={{ padding: '10px' }}>Durum</th>
                  <th style={{ padding: '10px' }}>Kullanıcı</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ whiteSpace: 'nowrap', padding: '10px' }}>{item.date}</td>
                    <td style={{ fontWeight: 600, padding: '10px' }}>
                      {item.validCount.toLocaleString()} {item.invalidCount > 0 && <span style={{ color: 'var(--danger-text)', fontSize: '0.75rem' }}>({item.invalidCount} Hatalı)</span>}
                    </td>
                    <td style={{ padding: '10px' }}>{item.format}</td>
                    <td style={{ padding: '10px' }}>{item.cols}x{item.rows} ({item.size}pt)</td>
                    <td style={{ padding: '10px' }}>{item.splitSize}</td>
                    <td style={{ padding: '10px' }}>{item.fileSizeStr}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: item.status === 'Tamamlandı' ? 'var(--success-bg)' : 'var(--danger-bg)',
                        color: item.status === 'Tamamlandı' ? 'var(--success-text)' : 'var(--danger-text)'
                      }}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>{item.username}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => handleReDownload(item)}
                        style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Clock size={12} />
                        Tekrar Yükle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
