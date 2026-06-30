import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Search, Eye, RefreshCw, X } from 'lucide-react';

interface AuditLog {
  id: string;
  userId: string | null;
  userName: string | null;
  entityName: string;
  entityId: string | null;
  action: string;
  createdAt: string;
  ipAddress: string | null;
}

interface AuditLogDetail extends AuditLog {
  oldValue: string | null;
  newValue: string | null;
}

export const AuditCenter: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entityName, setEntityName] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogDetail | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    if (user?.role !== 'Admin') return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('pageNumber', page.toString());
      params.append('pageSize', pageSize.toString());
      
      if (startDate) params.append('startDate', new Date(startDate).toISOString());
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.append('endDate', end.toISOString());
      }
      if (entityName) params.append('entityName', entityName);
      if (actionFilter) params.append('action', actionFilter);

      const data = await api.get(`/api/audit-logs?${params.toString()}`);
      setLogs(data.items || []);
      setTotalCount(data.totalCount || 0);
    } catch (err: any) {
      alert('Loglar yüklenemedi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setEntityName('');
    setActionFilter('');
    setPage(1);
    // Let effect or explicit fetch run, but since state updates are async, we call fetch later or wait for next render
    setTimeout(() => {
      api.get(`/api/audit-logs?pageNumber=1&pageSize=${pageSize}`).then(data => {
        setLogs(data.items || []);
        setTotalCount(data.totalCount || 0);
      });
    }, 100);
  };

  const openDetail = async (id: string) => {
    try {
      const data = await api.get(`/api/audit-logs/${id}`);
      setSelectedLog(data);
    } catch (err: any) {
      alert('Detay yüklenemedi: ' + err.message);
    }
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

  const formatJson = (jsonStr: string | null) => {
    if (!jsonStr) return 'N/A';
    try {
      return JSON.stringify(JSON.parse(jsonStr), null, 2);
    } catch {
      return jsonStr;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Center</h1>
          <p className="page-subtitle">Sistem logları ve izlenebilirlik merkezi</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchLogs} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
          Yenile
        </button>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '1 1 200px' }}>
            <label>Başlangıç Tarihi</label>
            <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: '1 1 200px' }}>
            <label>Bitiş Tarihi</label>
            <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: '1 1 200px' }}>
            <label>Modül (Entity)</label>
            <input type="text" className="input" placeholder="Örn: Orders, Cartons" value={entityName} onChange={e => setEntityName(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: '1 1 200px' }}>
            <label>İşlem (Action)</label>
            <input type="text" className="input" placeholder="Örn: Create, Scan" value={actionFilter} onChange={e => setActionFilter(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={clearFilters}>Temizle</button>
            <button type="submit" className="btn btn-primary">
              <Search size={18} /> Ara
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        {loading && logs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor...</div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Kullanıcı</th>
                    <th>IP Adresi</th>
                    <th>Modül</th>
                    <th>İşlem</th>
                    <th style={{ textAlign: 'right' }}>Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td>{new Date(log.createdAt).toLocaleString('tr-TR')}</td>
                      <td>{log.userName || '-'}</td>
                      <td>{log.ipAddress || '-'}</td>
                      <td><span className="badge badge-secondary">{log.entityName}</span></td>
                      <td><span className="badge badge-primary">{log.action}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-icon" onClick={() => openDetail(log.id)} title="Detay Görüntüle">
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        Kayıt bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Toplam {totalCount} kayıt, Sayfa {page}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-secondary" 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Önceki
                </button>
                <button 
                  className="btn btn-secondary"
                  disabled={logs.length < pageSize}
                  onClick={() => setPage(p => p + 1)}
                >
                  Sonraki
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem' }}>Audit Detayı</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {selectedLog.entityName} - {selectedLog.action} 
                  ({new Date(selectedLog.createdAt).toLocaleString('tr-TR')})
                </p>
              </div>
              <button className="btn btn-icon" onClick={() => setSelectedLog(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '16px', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ marginBottom: '8px', color: 'var(--danger)', fontSize: '0.95rem' }}>Eski Değer (Old Value)</h4>
                <pre style={{ backgroundColor: 'var(--bg-body)', padding: '16px', borderRadius: '4px', overflowX: 'auto', fontSize: '0.85rem', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                  {formatJson(selectedLog.oldValue)}
                </pre>
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ marginBottom: '8px', color: 'var(--success)', fontSize: '0.95rem' }}>Yeni Değer (New Value)</h4>
                <pre style={{ backgroundColor: 'var(--bg-body)', padding: '16px', borderRadius: '4px', overflowX: 'auto', fontSize: '0.85rem', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                  {formatJson(selectedLog.newValue)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
