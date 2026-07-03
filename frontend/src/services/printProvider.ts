import { api } from './api';

export interface PrintRequest {
  id: string; // CartonId or PalletId
  type: 'carton' | 'pallet';
  format?: 'pdf' | 'zpl';
}

export interface IPrintProvider {
  print(request: PrintRequest): Promise<void>;
  testPrint(zplData: string): Promise<void>;
}

// Global Zebra Browser Print reference
declare global {
  interface Window {
    BrowserPrint: any;
  }
}

const printViaZebraBrowserPrint = (zplData: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!window.BrowserPrint) {
      reject(new Error("Zebra Browser Print eklentisi bulunamadı veya çalışmıyor."));
      return;
    }

    window.BrowserPrint.getDefaultDevice("printer", (device: any) => {
      if (!device) {
        reject(new Error("Varsayılan yazıcı bulunamadı. Lütfen Browser Print ayarlarını kontrol edin."));
        return;
      }
      device.send(zplData, () => {
        resolve();
      }, (error: any) => {
        reject(new Error("Yazdırma hatası: " + (error || "Bilinmeyen hata")));
      });
    }, (error: any) => {
      reject(new Error("Yazıcı aranırken hata oluştu: " + error));
    });
  });
};

export class BrowserAutoPrintProvider implements IPrintProvider {
  async print(request: PrintRequest): Promise<void> {
    const labelRes = await api.get(`/api/${request.type}s/${request.id}/label.zpl`);
    if (labelRes && labelRes.zpl) {
      await printViaZebraBrowserPrint(labelRes.zpl);
    }
  }

  async testPrint(zplData: string): Promise<void> {
    await printViaZebraBrowserPrint(zplData);
  }
}

export class PdfDownloadProvider implements IPrintProvider {
  async print(request: PrintRequest): Promise<void> {
    window.open(`/api/${request.type}s/${request.id}/label.pdf`, '_blank');
  }

  async testPrint(_zplData: string): Promise<void> {
    const blob = await api.post('/api/print/test', { format: 'pdf' });
    if (!(blob instanceof Blob)) {
      throw new Error("Geçersiz PDF formatı.");
    }
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

export class ZplDownloadProvider implements IPrintProvider {
  async print(request: PrintRequest): Promise<void> {
    const labelRes = await api.get(`/api/${request.type}s/${request.id}/label.zpl`);
    if (labelRes && labelRes.zpl) {
      this.downloadZplFile(labelRes.zpl, `${request.type}-${request.id}.zpl`);
    }
  }

  async testPrint(zplData: string): Promise<void> {
    this.downloadZplFile(zplData, 'test-label.zpl');
  }

  private downloadZplFile(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export class LocalAgentProvider implements IPrintProvider {
  private getAgentToken(): string {
    const token = localStorage.getItem('tt_agent_token');
    if (token) return token;
    throw new Error("Agent eşleştirme (pairing) token'ı eksik, ayarlardan giriniz.");
  }

  private async getAgentStatus(): Promise<{ status?: string; printer?: string }> {
    const token = this.getAgentToken();
    try {
      const res = await fetch('http://127.0.0.1:5000/api/agent/status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        throw new Error("Yetkisiz Erisim (401): Agent Pairing Token gecersiz.");
      }

      if (!res.ok) {
        throw new Error(`Agent Hatasi (${res.status}): Baglanti durumu okunamadi.`);
      }

      return await res.json();
    } catch (err: any) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error("Local Agent'a ulasilamiyor. Uygulamanin calistigindan ve 5000 portunun acik oldugundan emin olun.");
      }
      throw err;
    }
  }

  private async getAgentPrinterLanguage(): Promise<'pplb' | 'zpl'> {
    const status = await this.getAgentStatus();
    const printer = status.printer?.toLowerCase() || '';
    if (/(pplz|zpl|zebra)/i.test(printer)) {
      return 'zpl';
    }
    return /(pplb|argox)/i.test(printer) ? 'pplb' : 'zpl';
  }

  private async sendToAgent(path: string, body: any): Promise<void> {
    const token = this.getAgentToken();
    try {
      const res = await fetch(`http://127.0.0.1:5000${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      
      if (res.status === 401) {
        throw new Error("Yetkisiz Erişim (401): Agent Pairing Token geçersiz.");
      }
      if (!res.ok) {
        throw new Error(`Agent Hatası (${res.status}): Yazdırma işlemi başarısız.`);
      }
    } catch (err: any) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error("Local Agent'a ulaşılamıyor. Uygulamanın çalıştığından ve 5000 portunun açık olduğundan emin olun.");
      }
      throw err;
    }
  }

  async print(request: PrintRequest): Promise<void> {
    const language = await this.getAgentPrinterLanguage();
    const labelRes = await api.get(`/api/${request.type}s/${request.id}/label.${language}`);
    const labelData = labelRes?.data || labelRes?.pplb || labelRes?.zpl;
    if (labelData) {
      await this.sendToAgent('/api/print', { data: labelData });
    }
  }

  async testPrint(zplData: string): Promise<void> {
    const language = await this.getAgentPrinterLanguage();
    const data = language === 'pplb' ? this.createPplbTestLabel() : zplData;
    await this.sendToAgent('/api/printer/test', { data });
  }

  private createPplbTestLabel(): string {
    return [
      'N',
      'q800',
      'Q640,24',
      'S3',
      'D8',
      'ZT',
      'A50,50,0,4,1,1,N,"TEST PRINT"',
      'A50,105,0,3,1,1,N,"Baglanti: Basarili"',
      `A50,150,0,2,1,1,N,"Tarih: ${new Date().toLocaleString('tr-TR')}"`,
      'A50,205,0,2,1,1,N,"TrackTrace Local Agent PPLB Testi"',
      'B50,270,0,E,2,4,100,B,"123456789012"',
      'P1'
    ].join('\n') + '\n';
  }
}

export const getPrintProvider = (mode: string): IPrintProvider => {
  switch (mode) {
    case 'kiosk':
    case 'browser':
      return new BrowserAutoPrintProvider();
    case 'pdf':
      return new PdfDownloadProvider();
    case 'zpl':
      return new ZplDownloadProvider();
    case 'agent':
    case 'network':
      return new LocalAgentProvider();
    default:
      return new BrowserAutoPrintProvider();
  }
};
