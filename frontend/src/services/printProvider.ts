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
  async print(_request: PrintRequest): Promise<void> {
    throw new Error("Local Print Agent henüz yapılandırılmadı (Yapım Aşamasında).");
  }

  async testPrint(_zplData: string): Promise<void> {
    throw new Error("Local Print Agent henüz yapılandırılmadı (Yapım Aşamasında).");
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
