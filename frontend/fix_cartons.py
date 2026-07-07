import sys
import re

file_path = r'c:\Users\alper.ates.LIDER\Desktop\track-trace\frontend\src\pages\Cartons.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Interface updates
if 'stationName?: string;' not in content:
    content = content.replace('  printedAt: string | null;', '  printedAt: string | null;\n  stationName?: string;')

if 'interface Station {' not in content:
    station_int = '''interface Station {
  id: string;
  name: string;
}

// Color-coded Fullness Progress Bar Component'''
    content = content.replace('// Color-coded Fullness Progress Bar Component', station_int)

# 2. Add stationName to Table row
table_row_old = '''    <tr style={{ cursor: 'pointer', backgroundColor: isSelected ? 'var(--primary-light)' : '' }} onClick={onSelect}>
      <td style={{ fontWeight: 600 }}>{c.cartonNo}</td>
      <td>{c.orderNo}</td>
      <td><span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{orderStockCode || '-'}</span></td>
      <td><code style={{ fontSize: '0.85rem' }}>{c.sscc}</code></td>
      <td>
        <FullnessIndicator actual={c.actualQuantity} target={c.targetQuantity} />
      </td>'''
table_row_new = '''    <tr style={{ cursor: 'pointer', backgroundColor: isSelected ? 'var(--primary-light)' : '' }} onClick={onSelect}>
      <td style={{ fontWeight: 600 }}>{c.cartonNo}</td>
      <td>{c.orderNo}</td>
      <td><span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{orderStockCode || '-'}</span></td>
      <td>{c.stationName || '-'}</td>
      <td><code style={{ fontSize: '0.85rem' }}>{c.sscc}</code></td>
      <td>
        <FullnessIndicator actual={c.actualQuantity} target={c.targetQuantity} />
      </td>'''
content = content.replace(table_row_old, table_row_new)

# 3. Add stationName to Mobile Card
mobile_card_old = '''      <div className="mobile-card-row">
        <span className="mobile-card-label">Stok Kodu:</span>
        <span className="mobile-card-value">{orderStockCode || '-'}</span>
      </div>

      <div className="mobile-card-row">
        <span className="mobile-card-label">SSCC:</span>'''
mobile_card_new = '''      <div className="mobile-card-row">
        <span className="mobile-card-label">Stok Kodu:</span>
        <span className="mobile-card-value">{orderStockCode || '-'}</span>
      </div>

      <div className="mobile-card-row">
        <span className="mobile-card-label">İstasyon:</span>
        <span className="mobile-card-value">{c.stationName || '-'}</span>
      </div>

      <div className="mobile-card-row">
        <span className="mobile-card-label">SSCC:</span>'''
content = content.replace(mobile_card_old, mobile_card_new)

# 4. State updates in Cartons component
state_old = '''  const [cartons, setCartons] = useState<Carton[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState(false);'''
state_new = '''  const [cartons, setCartons] = useState<Carton[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [transferStationId, setTransferStationId] = useState('');
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState(false);'''
content = content.replace(state_old, state_new)

load_data_old = '''    try {
      const [ordersRes, cartonsRes, summaryRes] = await Promise.all([
        api.get('/api/orders?pageSize=1000'),
        api.get('/api/cartons?pageSize=10000'),
        api.get('/api/dashboard/summary').catch(() => null)
      ]);

      setOrders(ordersRes.items || []);
      setCartons(cartonsRes.items || []);
      if (summaryRes) setSummaryData(summaryRes);'''
load_data_new = '''    try {
      const [ordersRes, cartonsRes, summaryRes, stationsRes] = await Promise.all([
        api.get('/api/orders?pageSize=1000'),
        api.get('/api/cartons?pageSize=10000'),
        api.get('/api/dashboard/summary').catch(() => null),
        api.get('/api/stations?includeInactive=false').catch(() => [])
      ]);

      setOrders(ordersRes.items || []);
      setCartons(cartonsRes.items || []);
      setStations(stationsRes || []);
      if (summaryRes) setSummaryData(summaryRes);'''
content = content.replace(load_data_old, load_data_new)

# 5. Table Header
header_old = '''                  <th>Sipariş No</th>
                  <th>Stok Kodu</th>
                  <th>SSCC Barkod</th>'''
header_new = '''                  <th>Sipariş No</th>
                  <th>Stok Kodu</th>
                  <th>İstasyon</th>
                  <th>SSCC Barkod</th>'''
content = content.replace(header_old, header_new)

# 6. Drawer Details
drawer_old = '''                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Stok Kodu</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{orders.find(o => o.id === selectedCarton.orderId)?.stockCode || '-'}</span>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Durum</span>'''
drawer_new = '''                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Stok Kodu</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{orders.find(o => o.id === selectedCarton.orderId)?.stockCode || '-'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>İstasyon</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{selectedCarton.stationName || '-'}</span>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Durum</span>'''
content = content.replace(drawer_old, drawer_new)

# 7. Add handleTransfer function and UI
funcs_old = '''  const handleDecompose = async (cartonId: string) => {
    if (!window.confirm('Bu koliyi bozmak/iptal etmek istediğinize emin misiniz? (İçindeki ürünler geri alınacak)')) return;'''
funcs_new = '''  const handleTransfer = async (cartonId: string) => {
    if (!transferStationId) {
        alert("Lütfen devredilecek istasyonu seçin.");
        return;
    }
    if (!window.confirm('Bu koliyi seçilen istasyona devretmek istediğinize emin misiniz?')) return;
    try {
      await api.post(`/api/cartons/${cartonId}/transfer`, { targetStationId: transferStationId });
      alert("Koli başarıyla devredildi.");
      setTransferStationId('');
      setSelectedCarton(null);
      loadAllData(true);
    } catch (err: any) {
      alert("Devir işlemi başarısız: " + err.message);
    }
  };

  const handleDecompose = async (cartonId: string) => {
    if (!window.confirm('Bu koliyi bozmak/iptal etmek istediğinize emin misiniz? (İçindeki ürünler geri alınacak)')) return;'''
content = content.replace(funcs_old, funcs_new)

drawer_actions_old = '''                {/* Decompose action */}
                {user?.role !== 'Viewer' && (
                  <button 
                    className="btn btn-danger" 
                    style={{ width: '100%', padding: '10px' }} 
                    onClick={() => handleDecompose(selectedCarton.id)}
                  >
                    Koliyi Boz (İptal Et)
                  </button>
                )}
              </div>'''
drawer_actions_new = '''                {/* Transfer action */}
                {user?.role === 'Admin' && selectedCarton.status === 'Open' && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
                    <select
                      className="form-input"
                      style={{ flex: 1, height: '36px', fontSize: '0.85rem' }}
                      value={transferStationId}
                      onChange={(e) => setTransferStationId(e.target.value)}
                    >
                      <option value="">-- İstasyon Seç (Devret) --</option>
                      {stations.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button 
                      className="btn btn-primary"
                      style={{ padding: '8px 16px', height: '36px' }}
                      onClick={() => handleTransfer(selectedCarton.id)}
                    >
                      Devret
                    </button>
                  </div>
                )}
                {/* Decompose action */}
                {user?.role !== 'Viewer' && (
                  <button 
                    className="btn btn-danger" 
                    style={{ width: '100%', padding: '10px', marginTop: '10px' }} 
                    onClick={() => handleDecompose(selectedCarton.id)}
                  >
                    Koliyi Boz (İptal Et)
                  </button>
                )}
              </div>'''
content = content.replace(drawer_actions_old, drawer_actions_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Cartons.tsx updated successfully!")
