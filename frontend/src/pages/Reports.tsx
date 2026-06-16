import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Calendar, User } from 'lucide-react';

interface PrintJob {
  id: string;
  labelType: string;
  entityId: string;
  entityNo: string;
  printedBy: string | null;
  printCount: number;
  format: string;
  createdAt: string;
}

export const Reports: React.FC = () => {
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/print-jobs?pageNumber=${page}&pageSize=10`)
      .then(res => {
        setPrintJobs(res.items);
        setTotalCount(res.totalCount);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>Baskı Geçmişi & Raporlama</h2>
        <p style={{ color: 'var(--text-muted)' }}>Sistemde gerçekleştirilen etiket basım (PDF ve ZPL) log kayıtları.</p>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Etiket Tipi</th>
              <th>Koli / Palet No</th>
              <th>Format</th>
              <th>Kopya Sayısı</th>
              <th>Yazdıran Kullanıcı</th>
              <th>Baskı Tarihi</th>
            </tr>
          </thead>
          <tbody>
            {loading && printJobs.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px' }}>Yükleniyor...</td></tr>
            ) : printJobs.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Herhangi bir yazdırma geçmişi bulunamadı.</td></tr>
            ) : (
              printJobs.map((job) => (
                <tr key={job.id}>
                  <td style={{ fontWeight: 600 }}>
                    <span className={`badge ${job.labelType === 'Carton' ? 'badge-printed' : 'badge-palletized'}`}>
                      {job.labelType === 'Carton' ? 'Koli Etiketi' : 'Palet Etiketi'}
                    </span>
                  </td>
                  <td><strong>{job.entityNo}</strong></td>
                  <td><code>{job.format}</code></td>
                  <td>{job.printCount}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <User size={14} color="var(--text-muted)" />
                      {job.printedBy || 'Sistem'}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                      <Calendar size={14} />
                      {new Date(job.createdAt).toLocaleString('tr-TR')}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="pagination">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Toplam: {totalCount} baskı kaydı</span>
          <div className="pagination-buttons">
            <button className="btn btn-secondary" style={{ padding: '6px 12px' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Önceki</button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '0.9rem', fontWeight: 600 }}>{page}</span>
            <button className="btn btn-secondary" style={{ padding: '6px 12px' }} disabled={page * 10 >= totalCount} onClick={() => setPage(p => p + 1)}>Sonraki</button>
          </div>
        </div>
      </div>
    </div>
  );
};
