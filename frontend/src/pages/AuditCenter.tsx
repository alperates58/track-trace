import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Search, Eye, RefreshCw, X, 
  Activity, Calendar, AlertCircle, Users, 
  ShieldAlert, CheckCircle2, Info, AlertTriangle, SearchX
} from 'lucide-react';
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
    <div className="ac-wrapper">
      <div className="ac-header">
        <div>
          <div className="ac-breadcrumb">
            <span>TRACKTRACE</span> / <span>MODULE</span> / <span>Audit Center</span>
          </div>
          <h1 className="ac-title">Audit Center</h1>
          <p className="ac-subtitle">Sistem logları ve izlenebilirlik merkezi</p>
        </div>
        <div className="ac-header-right">
          <div className="ac-online-badge">
            <div className="ac-online-dot"></div>
            API Online • Son Yenilenme: {lastRefreshed.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button className="ac-btn-refresh" onClick={fetchLogs} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Yenile
          </button>
        </div>
      </div>

      <div className="ac-kpi-grid">
        <div className="ac-kpi-card">
          <div className="ac-kpi-header">
            <div className="ac-kpi-icon"><Activity size={18} /></div>
            <span>Toplam Log</span>
          </div>
          <div className="ac-kpi-value">{totalCount.toLocaleString('tr-TR')}</div>
        </div>
        <div className="ac-kpi-card">
          <div className="ac-kpi-header">
            <div className="ac-kpi-icon"><Calendar size={18} /></div>
            <span>Bugünkü Log</span>
          </div>
          <div className="ac-kpi-value">{todayLogCount.toLocaleString('tr-TR')}</div>
        </div>
        <div className="ac-kpi-card">
          <div className="ac-kpi-header">
            <div className="ac-kpi-icon" style={{color: '#dc2626', backgroundColor: '#fef2f2'}}><AlertCircle size={18} /></div>
            <span>Başarısız İşlem</span>
          </div>
          <div className="ac-kpi-value">{failedLogCount.toLocaleString('tr-TR')}</div>
        </div>
        <div className="ac-kpi-card">
          <div className="ac-kpi-header">
            <div className="ac-kpi-icon"><Users size={18} /></div>
            <span>Aktif Kullanıcı</span>
          </div>
          <div className="ac-kpi-value">{activeUserCount.toLocaleString('tr-TR')}</div>
        </div>
      </div>

      <div className="ac-filter-card">
        <h3 className="ac-filter-title"><Search size={18} /> Filters</h3>
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
            <button type="button" className="ac-btn-clear" onClick={clearFilters}>Temizle</button>
            <button type="submit" className="ac-btn-search">Ara</button>
          </div>
        </form>
      </div>

      <div className="ac-table-card">
        <div className="ac-table-container">
          <table className="ac-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kullanıcı</th>
                <th>İstasyon</th>
                <th>IP</th>
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
                  return (
                    <tr key={log.id}>
                      <td>{new Date(log.createdAt).toLocaleString('tr-TR')}</td>
                      <td>{log.userName ? log.userName : 'System'}</td>
                      <td>{log.entityName === 'Station' ? log.entityId : '-'}</td>
                      <td>{formatIp(log.ipAddress)}</td>
                      <td>
                        <span className={`ac-badge ac-badge-module ${log.entityName.toLowerCase()}`}>
                          {log.entityName}
                        </span>
                      </td>
                      <td>
                        <span className="ac-badge ac-badge-action">
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <span className={`ac-badge-status ${statusInfo.className}`}>
                          {statusInfo.icon}
                          {statusInfo.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="ac-icon-btn" title="Detayları Gör" onClick={() => openDetail(log.id)}>
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="ac-pagination">
          <div className="ac-pagination-info">Toplam {totalCount} kayıt, Sayfa {page}</div>
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
              <button className="ac-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Önceki</button>
              <button className="ac-page-btn" disabled={logs.length < pageSize} onClick={() => setPage(p => p + 1)}>Sonraki</button>
            </div>
          </div>
        </div>
      </div>

      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '16px', maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 600, color: '#111827' }}>Audit Detayı</h3>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
                  {selectedLog.entityName} - {selectedLog.action} 
                  ({new Date(selectedLog.createdAt).toLocaleString('tr-TR')})
                </p>
              </div>
              <button className="ac-icon-btn" onClick={() => setSelectedLog(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '24px', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#dc2626', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldAlert size={16} /> Eski Değer (Old Value)</h4>
                <pre style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '13px', color: '#374151', border: '1px solid #e5e7eb', margin: 0, minHeight: '100px' }}>
                  {formatJson(selectedLog.oldValue)}
                </pre>
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#059669', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} /> Yeni Değer (New Value)</h4>
                <pre style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '13px', color: '#374151', border: '1px solid #e5e7eb', margin: 0, minHeight: '100px' }}>
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
