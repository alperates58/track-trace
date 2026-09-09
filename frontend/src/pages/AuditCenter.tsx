import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Search, Eye, RefreshCw, X, 
  Activity, Calendar, AlertCircle, Users, 
  ShieldAlert, CheckCircle2, Info, AlertTriangle, SearchX
} from 'lucide-react';
import { 
  TTPageHeader, 
  TTButton, 
  TTBadge, 
  TTModal, 
  TTCard 
} from '../components/common';
import './AuditCenter.css';

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
  const { user, hasPermission } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  
  // API Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entityName, setEntityName] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  
  // Client-side Filters
  const [userFilter, setUserFilter] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  
  // Pagination & State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogDetail | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize]);

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
      setLastRefreshed(new Date());
    } catch (err: any) {
      alert('Loglar yüklenemedi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (page === 1) {
      fetchLogs();
    } else {
      setPage(1);
    }
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setEntityName('');
    setActionFilter('');
    setUserFilter('');
    setStationFilter('');
    setIpFilter('');
    setStatusFilter('');
    setGlobalSearch('');
    
    if (page === 1) {
      setTimeout(() => {
        api.get(`/api/audit-logs?pageNumber=1&pageSize=${pageSize}`).then(data => {
          setLogs(data.items || []);
          setTotalCount(data.totalCount || 0);
          setLastRefreshed(new Date());
        });
      }, 0);
    } else {
      setPage(1);
    }
  };

  const openDetail = async (id: string) => {
    try {
      const data = await api.get(`/api/audit-logs/${id}`);
      setSelectedLog(data);
    } catch (err: any) {
      alert('Detay yüklenemedi: ' + err.message);
    }
  };

  const getStatusInfo = (action: string) => {
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes('fail') || lowerAction.includes('denied') || lowerAction.includes('error')) {
      return { status: 'Failed', className: 'failed', icon: <ShieldAlert size={14} /> };
    }
    if (lowerAction.includes('attempt') || lowerAction.includes('warning')) {
      return { status: 'Warning', className: 'warning', icon: <AlertTriangle size={14} /> };
    }
    if (
      lowerAction.includes('login') || lowerAction.includes('logout') || 
      lowerAction.includes('scan') || lowerAction.includes('create') || 
      lowerAction.includes('update') || lowerAction.includes('delete') || 
      lowerAction.includes('close') || lowerAction.includes('success') ||
      lowerAction.includes('print') || lowerAction.includes('export')
    ) {
      return { status: 'Success', className: 'success', icon: <CheckCircle2 size={14} /> };
    }
    return { status: 'Info', className: 'info', icon: <Info size={14} /> };
  };

  const formatIp = (ip: string | null) => {
    if (!ip) return '-';
    if (ip.startsWith('::ffff:')) return ip.substring(7);
    return ip;
  };

  const formatJson = (jsonStr: string | null) => {
    if (!jsonStr) return 'N/A';
    try {
      return JSON.stringify(JSON.parse(jsonStr), null, 2);
    } catch {
      return jsonStr;
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      let match = true;
      if (userFilter && !log.userName?.toLowerCase().includes(userFilter.toLowerCase())) match = false;
      if (ipFilter && !formatIp(log.ipAddress).includes(ipFilter)) match = false;
      
      if (statusFilter) {
        const status = getStatusInfo(log.action).status;
        if (status.toLowerCase() !== statusFilter.toLowerCase()) match = false;
      }
      
      if (stationFilter && !log.entityName.toLowerCase().includes(stationFilter.toLowerCase()) && !log.entityId?.toLowerCase().includes(stationFilter.toLowerCase())) match = false;

      if (globalSearch) {
        const search = globalSearch.toLowerCase();
        const searchStr = `${log.userName || ''} ${log.action} ${log.entityName} ${formatIp(log.ipAddress)}`.toLowerCase();
        if (!searchStr.includes(search)) match = false;
      }
      
      return match;
    });
  }, [logs, userFilter, ipFilter, statusFilter, stationFilter, globalSearch]);

  const todayLogCount = logs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length;
  const failedLogCount = logs.filter(l => getStatusInfo(l.action).status === 'Failed').length;
  const activeUserCount = new Set(logs.filter(l => l.userId).map(l => l.userId)).size;

  if (!hasPermission('audit.view')) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>Yetkisiz Erişim</h3>
          <p>Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-wrapper" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <TTPageHeader
        title="Audit Center"
        description="Sistem logları, güvenlik olayları ve kullanıcı denetim kayıtları"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="ac-online-badge">
              <div className="ac-online-dot"></div>
              API Online • <span className="tabular-nums font-mono">{lastRefreshed.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <TTButton variant="secondary" size="md" onClick={fetchLogs} disabled={loading} icon={<RefreshCw size={14} className={loading ? 'spin' : ''} />}>
              Yenile
            </TTButton>
          </div>
        }
      />

      <div className="ac-kpi-grid">
        <div className="stat-card-modern ac-kpi-card">
          <div className="ac-kpi-header">
            <div className="ac-kpi-icon"><Activity size={16} /></div>
            <span>Toplam Log</span>
          </div>
          <div className="ac-kpi-value tabular-nums font-mono">{totalCount.toLocaleString('tr-TR')}</div>
        </div>
        <div className="stat-card-modern ac-kpi-card">
          <div className="ac-kpi-header">
            <div className="ac-kpi-icon"><Calendar size={16} /></div>
            <span>Bugünkü Log</span>
          </div>
          <div className="ac-kpi-value tabular-nums font-mono">{todayLogCount.toLocaleString('tr-TR')}</div>
        </div>
        <div className="stat-card-modern ac-kpi-card">
          <div className="ac-kpi-header">
            <div className="ac-kpi-icon" style={{color: '#dc2626', backgroundColor: 'rgba(239, 68, 68, 0.08)'}}><AlertCircle size={16} /></div>
            <span>Başarısız İşlem</span>
          </div>
          <div className="ac-kpi-value tabular-nums font-mono">{failedLogCount.toLocaleString('tr-TR')}</div>
        </div>
        <div className="stat-card-modern ac-kpi-card">
          <div className="ac-kpi-header">
            <div className="ac-kpi-icon"><Users size={16} /></div>
            <span>Aktif Kullanıcı</span>
          </div>
          <div className="ac-kpi-value tabular-nums font-mono">{activeUserCount.toLocaleString('tr-TR')}</div>
        </div>
      </div>

      <div className="ac-filter-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary, var(--text-main))' }}>
          <Search size={16} style={{ color: 'var(--primary)' }} />
          <span>Filtreleme & Arama</span>
        </div>
        <form onSubmit={handleSearch}>
          <div className="ac-filter-grid">
            <div className="ac-filter-group">
              <label className="ac-filter-label">Başlangıç Tarihi</label>
              <input type="date" className="ac-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="ac-filter-group">
              <label className="ac-filter-label">Bitiş Tarihi</label>
              <input type="date" className="ac-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="ac-filter-group">
              <label className="ac-filter-label">Kullanıcı</label>
              <input type="text" className="ac-input" placeholder="Örn: admin" value={userFilter} onChange={e => setUserFilter(e.target.value)} />
            </div>
            <div className="ac-filter-group">
              <label className="ac-filter-label">İstasyon</label>
              <input type="text" className="ac-input" placeholder="Örn: ST-01" value={stationFilter} onChange={e => setStationFilter(e.target.value)} />
            </div>
            <div className="ac-filter-group">
              <label className="ac-filter-label">Modül</label>
              <input type="text" className="ac-input" placeholder="Örn: Orders" value={entityName} onChange={e => setEntityName(e.target.value)} />
            </div>
            <div className="ac-filter-group">
              <label className="ac-filter-label">İşlem</label>
              <input type="text" className="ac-input" placeholder="Örn: Create" value={actionFilter} onChange={e => setActionFilter(e.target.value)} />
            </div>
            <div className="ac-filter-group">
              <label className="ac-filter-label">IP Adresi</label>
              <input type="text" className="ac-input" placeholder="Örn: 192.168.1.1" value={ipFilter} onChange={e => setIpFilter(e.target.value)} />
            </div>
            <div className="ac-filter-group">
              <label className="ac-filter-label">Durum</label>
              <select className="ac-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">Tümü</option>
                <option value="Success">Success</option>
                <option value="Warning">Warning</option>
                <option value="Failed">Failed</option>
                <option value="Info">Info</option>
              </select>
            </div>
            <div className="ac-filter-group" style={{ gridColumn: '1 / -1' }}>
              <label className="ac-filter-label">Global Arama</label>
              <input type="text" className="ac-input" placeholder="Tüm loglarda ara..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} />
            </div>
          </div>
          <div className="ac-filter-actions">
            <TTButton type="button" variant="secondary" size="md" onClick={clearFilters}>
              Temizle
            </TTButton>
            <TTButton type="submit" variant="primary" size="md" icon={<Search size={14} />}>
              Filtrele
            </TTButton>
          </div>
        </form>
      </div>

      <div className="ac-table-card">
        <div className="ac-table-container">
          <table className="ac-table data-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kullanıcı</th>
                <th>İstasyon</th>
                <th>IP Adresi</th>
                <th>Modül</th>
                <th>İşlem</th>
                <th>Durum</th>
                <th style={{ textAlign: 'right' }}>Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skel-${i}`}>
                    <td colSpan={8}>
                      <div className="ac-skeleton-row">
                        <div className="ac-skeleton-cell" style={{ width: '15%' }}></div>
                        <div className="ac-skeleton-cell" style={{ width: '15%' }}></div>
                        <div className="ac-skeleton-cell" style={{ width: '10%' }}></div>
                        <div className="ac-skeleton-cell" style={{ width: '10%' }}></div>
                        <div className="ac-skeleton-cell" style={{ width: '10%' }}></div>
                        <div className="ac-skeleton-cell" style={{ width: '15%' }}></div>
                        <div className="ac-skeleton-cell" style={{ width: '10%' }}></div>
                        <div className="ac-skeleton-cell" style={{ width: '5%', marginLeft: 'auto' }}></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="ac-empty-state">
                      <div className="ac-empty-icon"><SearchX size={24} /></div>
                      <h4 className="ac-empty-title">Kayıt bulunamadı</h4>
                      <p className="ac-empty-desc">Filtreleri değiştirerek tekrar deneyin.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const statusInfo = getStatusInfo(log.action);
                  const badgeVariant = statusInfo.status === 'Success' ? 'success' : statusInfo.status === 'Warning' ? 'warning' : statusInfo.status === 'Failed' ? 'danger' : 'info';
                  return (
                    <tr key={log.id}>
                      <td className="tabular-nums font-mono">{new Date(log.createdAt).toLocaleString('tr-TR')}</td>
                      <td style={{ fontWeight: 600 }}>{log.userName ? log.userName : 'System'}</td>
                      <td className="tabular-nums font-mono">{log.entityName === 'Station' ? log.entityId : '-'}</td>
                      <td className="tabular-nums font-mono" style={{ color: 'var(--text-secondary, var(--text-muted))' }}>{formatIp(log.ipAddress)}</td>
                      <td>
                        <span className={`ac-badge ac-badge-module ${log.entityName.toLowerCase()}`}>
                          {log.entityName}
                        </span>
                      </td>
                      <td>
                        <span className="ac-badge ac-badge-action font-mono" style={{ fontSize: '0.75rem' }}>
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <TTBadge variant={badgeVariant} size="sm">
                          {statusInfo.status}
                        </TTBadge>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <TTButton variant="secondary" size="sm" title="Detayları Gör" onClick={() => openDetail(log.id)} icon={<Eye size={14} />}>
                          Detay
                        </TTButton>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="ac-pagination">
          <div className="ac-pagination-info">
            Toplam <strong className="tabular-nums font-mono">{totalCount}</strong> kayıt, Sayfa <strong className="tabular-nums font-mono">{page}</strong>
          </div>
          <div className="ac-pagination-controls">
            <div className="ac-page-size">
              <span>Göster:</span>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="ac-page-buttons">
              <TTButton variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Önceki</TTButton>
              <TTButton variant="secondary" size="sm" disabled={logs.length < pageSize} onClick={() => setPage(p => p + 1)}>Sonraki</TTButton>
            </div>
          </div>
        </div>
      </div>

      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle, var(--border-color))', padding: '24px', borderRadius: 'var(--radius-lg, 10px)', maxWidth: '800px', width: '92%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>Audit Detayı</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary, var(--text-muted))', fontSize: '0.82rem' }}>
                  <strong>{selectedLog.entityName}</strong> • {selectedLog.action} 
                  <span className="tabular-nums font-mono" style={{ marginLeft: '6px' }}>({new Date(selectedLog.createdAt).toLocaleString('tr-TR')})</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary, var(--text-muted))', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '16px', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--danger-text, #ef4444)', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert size={14} /> Eski Değer (Old Value)
                </h4>
                <pre style={{ backgroundColor: 'var(--bg-main)', padding: '14px', borderRadius: 'var(--radius-sm, 6px)', overflowX: 'auto', fontSize: '0.78rem', color: 'var(--text-primary, var(--text-main))', border: '1px solid var(--border-subtle, var(--border-color))', margin: 0, minHeight: '120px', fontFamily: 'monospace' }}>
                  {formatJson(selectedLog.oldValue)}
                </pre>
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--success-text, #10b981)', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} /> Yeni Değer (New Value)
                </h4>
                <pre style={{ backgroundColor: 'var(--bg-main)', padding: '14px', borderRadius: 'var(--radius-sm, 6px)', overflowX: 'auto', fontSize: '0.78rem', color: 'var(--text-primary, var(--text-main))', border: '1px solid var(--border-subtle, var(--border-color))', margin: 0, minHeight: '120px', fontFamily: 'monospace' }}>
                  {formatJson(selectedLog.newValue)}
                </pre>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <TTButton variant="secondary" size="md" onClick={() => setSelectedLog(null)}>
                Kapat
              </TTButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
