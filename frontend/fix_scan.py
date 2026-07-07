import sys
import re

file_path = r'c:\Users\alper.ates.LIDER\Desktop\track-trace\frontend\src\pages\Scan.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace("import { Volume2, VolumeX, Barcode, Printer } from 'lucide-react';", 
                          "import { Volume2, VolumeX, Barcode, Printer, Server } from 'lucide-react';")

# 2. Interface
interface_station = '''interface Station {
  id: string;
  name: string;
}

interface ActiveOrder {'''
content = content.replace('interface ActiveOrder {', interface_station)

# 3. State
state_stations = '''  // Stations
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  
  // Orders lists'''
content = content.replace('  // Orders lists', state_stations)

# 4. useEffect load stations
load_orders = '''  // Load Active Orders
  useEffect(() => {
    api.get('/api/orders?pageSize=100&status=Active')
      .then(res => {
        setActiveOrders(res.items);
      })
      .catch(console.error);
  }, []);'''
  
load_both = '''  // Load Active Orders & Stations
  useEffect(() => {
    api.get('/api/orders?pageSize=100&status=Active')
      .then(res => {
        setActiveOrders(res.items);
      })
      .catch(console.error);
      
    api.get('/api/stations?includeInactive=false')
      .then(res => {
        setStations(res);
        const savedStation = localStorage.getItem('trackTrace_selectedStation');
        if (savedStation && res.some((s: Station) => s.id === savedStation)) {
          setSelectedStationId(savedStation);
        } else if (res.length > 0) {
          setSelectedStationId(res[0].id);
          localStorage.setItem('trackTrace_selectedStation', res[0].id);
        }
      })
      .catch(console.error);
  }, []);'''
content = content.replace(load_orders, load_both)

# 5 & 7. Handle Order Select & Station Select
order_select_effect = '''  // Handle Order Select
  useEffect(() => {
    if (selectedOrderId) {
      const order = activeOrders.find(o => o.id === selectedOrderId) || null;
      setSelectedOrder(order);
      
      // Fetch current progress from backend
      api.get(`/api/scan/current-carton?orderId=${selectedOrderId}`)'''
      
new_order_select_effect = '''  // Handle Order Select
  useEffect(() => {
    if (selectedOrderId && selectedStationId) {
      const order = activeOrders.find(o => o.id === selectedOrderId) || null;
      setSelectedOrder(order);
      
      // Fetch current progress from backend
      api.get(`/api/scan/current-carton?orderId=${selectedOrderId}&stationId=${selectedStationId}`)'''
content = content.replace(order_select_effect, new_order_select_effect)

# And change dependency array of that useEffect
dep_array_old = '''      setErrorMsg('');
    }
  }, [selectedOrderId]);'''
dep_array_new = '''      setErrorMsg('');
    }
  }, [selectedOrderId, selectedStationId]);'''
content = content.replace(dep_array_old, dep_array_new)

# Keep focus interval update
focus_effect = '''  // Keep focus on hidden input
  useEffect(() => {
    focusInput();
    const interval = setInterval(focusInput, 1500); // periodically enforce focus
    return () => clearInterval(interval);
  }, [selectedOrderId]);'''
new_focus_effect = '''  // Keep focus on hidden input
  useEffect(() => {
    focusInput();
    const interval = setInterval(focusInput, 1500); // periodically enforce focus
    return () => clearInterval(interval);
  }, [selectedOrderId, selectedStationId]);'''
content = content.replace(focus_effect, new_focus_effect)

# 6. handleScanSubmit
scan_submit_old = '''    if (!selectedOrderId) {
      playSound('warning');
      setStatus('error');
      setLastScannedBarcode(code);
      setErrorMsg('Lütfen barkod okutmadan önce yukarıdan aktif bir sipariş seçin.');
      return;
    }

    try {
      const res = await api.post('/api/scan/product', { orderId: selectedOrderId, rawCode: code });'''
      
scan_submit_new = '''    if (!selectedOrderId) {
      playSound('warning');
      setStatus('error');
      setLastScannedBarcode(code);
      setErrorMsg('Lütfen barkod okutmadan önce yukarıdan aktif bir sipariş seçin.');
      return;
    }

    if (!selectedStationId) {
      playSound('warning');
      setStatus('error');
      setLastScannedBarcode(code);
      setErrorMsg('Lütfen okutmaya başlamadan önce bir istasyon seçin.');
      return;
    }

    try {
      const res = await api.post('/api/scan/product', { orderId: selectedOrderId, rawCode: code, stationId: selectedStationId });'''
content = content.replace(scan_submit_old, scan_submit_new)

# 8. Render UI
ui_old = '''      {/* Configuration & Controls Panel */}
      <div className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '320px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <select
              className="form-input"'''
              
ui_new = '''      {/* Configuration & Controls Panel */}
      <div className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '320px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <select
              className="form-input"
              style={{ width: '100%', height: '42px', fontWeight: 600, borderRadius: '8px', border: '1px solid #cbd5e1' }}
              value={selectedStationId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedStationId(newId);
                if (newId) localStorage.setItem('trackTrace_selectedStation', newId);
                else localStorage.removeItem('trackTrace_selectedStation');
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">-- İSTASYON SEÇİN --</option>
              {stations.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <select
              className="form-input"'''
content = content.replace(ui_old, ui_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Scan.tsx updated successfully!')
