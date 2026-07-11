import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Boxes,
  CheckCircle2,
  PackageCheck,
  Plus,
  RefreshCw,
  ScanLine,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { TTBadge, TTButton, TTCard, TTPageHeader } from '../components/common';
import './Shipments.css';

interface ShipmentSummary {
  id: string;
  shipmentNo: string;
  status: 'Draft' | 'Shipped' | 'Cancelled';
  createdAt: string;
  completedAt?: string | null;
  palletCount: number;
  cartonCount: number;
  productCount: number;
}

interface ShipmentItem {
  id: string;
  itemType: 'Pallet' | 'Carton';
  entityId: string;
  entityNo: string;
  sscc: string;
  orderNo: string;
  cartonCount: number;
  productCount: number;
  scannedAt: string;
  scannedBy?: string | null;
}

interface ShipmentDetail {
  shipment: ShipmentSummary;
  items: ShipmentItem[];
}

const statusLabel = (status: ShipmentSummary['status']) => {
  if (status === 'Draft') return 'Yükleniyor';
  if (status === 'Shipped') return 'Sevk Edildi';
  return 'İptal Edildi';
};

const statusVariant = (status: ShipmentSummary['status']): 'warning' | 'success' | 'danger' => {
  if (status === 'Draft') return 'warning';
  if (status === 'Shipped') return 'success';
  return 'danger';
};

export const Shipments: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [scanCode, setScanCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const loadShipments = useCallback(async (preferredId?: string | null) => {
    const response = await api.get('/api/shipments?pageSize=100');
    const nextShipments: ShipmentSummary[] = response.items || [];
    setShipments(nextShipments);
    const nextId = preferredId === null
      ? nextShipments.find(item => item.status === 'Draft')?.id || nextShipments[0]?.id || null
      : preferredId || selectedId || nextShipments.find(item => item.status === 'Draft')?.id || nextShipments[0]?.id || null;
    setSelectedId(nextId);
    if (nextId) {
      setDetail(await api.get(`/api/shipments/${nextId}`));
    } else {
      setDetail(null);
    }
  }, [selectedId]);

  useEffect(() => {
    loadShipments()
      .catch(error => setMessage({ type: 'error', text: error.message }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (detail?.shipment.status === 'Draft') {
      scanInputRef.current?.focus();
    }
  }, [detail?.shipment.id, detail?.shipment.status]);

  const selectShipment = async (id: string) => {
    setSelectedId(id);
    setMessage(null);
    try {
      setDetail(await api.get(`/api/shipments/${id}`));
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const createShipment = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await api.post('/api/shipments');
      await loadShipments(response.id);
      setMessage({ type: 'success', text: 'Yeni sevkiyat açıldı. Koli veya palet okutabilirsiniz.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  };

  const scanItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail || !scanCode.trim()) return;

    setBusy(true);
    setMessage(null);
    try {
      const result = await api.post(`/api/shipments/${detail.shipment.id}/scan`, { code: scanCode.trim() });
      setScanCode('');
      await loadShipments(detail.shipment.id);
      setMessage({ type: 'success', text: `${result.message} ${result.entityNo}` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
      window.setTimeout(() => scanInputRef.current?.focus(), 50);
    }
  };

  const removeItem = async (item: ShipmentItem) => {
    if (!detail || !window.confirm(`${item.entityNo} sevkiyattan çıkarılsın mı?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.delete(`/api/shipments/${detail.shipment.id}/items/${item.id}`);
      await loadShipments(detail.shipment.id);
      setMessage({ type: 'success', text: 'Kayıt sevkiyattan çıkarıldı.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  };

  const completeShipment = async () => {
    if (!detail || !window.confirm(`${detail.shipment.shipmentNo} tamamlanıp sevk edilsin mi? Bu işlem geri alınamaz.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.post(`/api/shipments/${detail.shipment.id}/complete`);
      await loadShipments(detail.shipment.id);
      setMessage({ type: 'success', text: 'Sevkiyat başarıyla tamamlandı.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  };

  const cancelShipment = async () => {
    if (!detail) return;
    const isCompleted = detail.shipment.status === 'Shipped';
    const confirmation = isCompleted
      ? `${detail.shipment.shipmentNo} sevkiyatı geri alınsın mı? Koli ve paletler yeniden sevke açılacak.`
      : `${detail.shipment.shipmentNo} iptal edilsin mi?`;
    if (!window.confirm(confirmation)) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.post(`/api/shipments/${detail.shipment.id}/cancel`);
      await loadShipments(detail.shipment.id);
      setMessage({ type: 'success', text: 'Taslak sevkiyat iptal edildi.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  };

  const deleteShipment = async () => {
    if (!detail || !window.confirm(`${detail.shipment.shipmentNo} kaydı kalıcı olarak silinsin mi?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.delete(`/api/shipments/${detail.shipment.id}`);
      setSelectedId(null);
      await loadShipments(null);
      setMessage({ type: 'success', text: 'İptal edilmiş sevkiyat kaydı silindi.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="tt-loading-state"><span className="tt-loading-text">Sevkiyatlar yükleniyor...</span></div>;
  }

  const isDraft = detail?.shipment.status === 'Draft';
  const canCancel = Boolean(
    detail &&
    hasPermission('shipments.cancel') &&
    (detail.shipment.status === 'Draft' || (detail.shipment.status === 'Shipped' && user?.role === 'Admin'))
  );
  const canDelete = Boolean(
    detail &&
    detail.shipment.status === 'Cancelled' &&
    user?.role === 'Admin' &&
    hasPermission('shipments.delete')
  );

  return (
    <div className="shipments-page">
      <TTPageHeader
        title="Depo & Sevkiyat"
        description="Koli veya palet SSCC barkodlarını okutarak sevkiyatı hazırlayın."
        actions={hasPermission('shipments.create') && (
          <TTButton icon={<Plus size={17} />} onClick={createShipment} loading={busy}>Yeni Sevkiyat</TTButton>
        )}
      />

      {message && (
        <div className={`shipment-message ${message.type}`} role="status">
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="shipments-layout">
        <TTCard className="shipment-list-card" padding="none">
          <div className="shipment-panel-header">
            <div>
              <strong>Sevkiyatlar</strong>
              <span>{shipments.length} kayıt</span>
            </div>
            <button className="shipment-icon-button" onClick={() => loadShipments()} title="Yenile">
              <RefreshCw size={17} />
            </button>
          </div>

          <div className="shipment-list">
            {shipments.length === 0 && <div className="shipment-empty">Henüz sevkiyat bulunmuyor.</div>}
            {shipments.map(shipment => (
              <button
                key={shipment.id}
                className={`shipment-list-item ${selectedId === shipment.id ? 'active' : ''}`}
                onClick={() => selectShipment(shipment.id)}
              >
                <div className="shipment-list-item-top">
                  <strong>{shipment.shipmentNo}</strong>
                  <TTBadge variant={statusVariant(shipment.status)} size="sm">{statusLabel(shipment.status)}</TTBadge>
                </div>
                <div className="shipment-list-meta">
                  <span><Boxes size={14} /> {shipment.palletCount} palet</span>
                  <span><Box size={14} /> {shipment.cartonCount} koli</span>
                </div>
                <small>{new Date(shipment.createdAt).toLocaleString('tr-TR')}</small>
              </button>
            ))}
          </div>
        </TTCard>

        <div className="shipment-workspace">
          {!detail ? (
            <TTCard className="shipment-empty-workspace">
              <Truck size={54} />
              <h3>Sevkiyat seçin veya yeni sevkiyat açın</h3>
            </TTCard>
          ) : (
            <>
              <TTCard>
                <div className="shipment-detail-header">
                  <div>
                    <span className="shipment-eyebrow">Aktif Sevkiyat</span>
                    <h3>{detail.shipment.shipmentNo}</h3>
                  </div>
                  <TTBadge variant={statusVariant(detail.shipment.status)}>{statusLabel(detail.shipment.status)}</TTBadge>
                </div>

                <div className="shipment-stats">
                  <div><Boxes size={22} /><span>Palet</span><strong>{detail.shipment.palletCount}</strong></div>
                  <div><Box size={22} /><span>Toplam Koli</span><strong>{detail.shipment.cartonCount}</strong></div>
                  <div><PackageCheck size={22} /><span>Toplam Ürün</span><strong>{detail.shipment.productCount}</strong></div>
                </div>

                {isDraft && hasPermission('shipments.scan') && (
                  <form className="shipment-scanner" onSubmit={scanItem}>
                    <ScanLine size={28} />
                    <div>
                      <label htmlFor="shipment-scan">Koli veya Palet Barkodu</label>
                      <input
                        id="shipment-scan"
                        ref={scanInputRef}
                        value={scanCode}
                        onChange={event => setScanCode(event.target.value)}
                        placeholder="SSCC okutun ve Enter'a basın"
                        autoComplete="off"
                        disabled={busy}
                      />
                    </div>
                    <TTButton type="submit" disabled={!scanCode.trim()} loading={busy}>Ekle</TTButton>
                  </form>
                )}
              </TTCard>

              <TTCard padding="none">
                <div className="shipment-panel-header">
                  <div><strong>Yükleme Listesi</strong><span>{detail.items.length} okutma</span></div>
                </div>
                <div className="shipment-items-table-wrap">
                  <table className="shipment-items-table">
                    <thead><tr><th>Tip</th><th>Kayıt</th><th>Sipariş</th><th>İçerik</th><th>Okutan</th>{isDraft && <th />}</tr></thead>
                    <tbody>
                      {detail.items.length === 0 && <tr><td colSpan={isDraft ? 6 : 5} className="shipment-empty">Henüz koli veya palet okutulmadı.</td></tr>}
                      {detail.items.map(item => (
                        <tr key={item.id}>
                          <td><TTBadge variant={item.itemType === 'Pallet' ? 'primary' : 'info'} size="sm">{item.itemType === 'Pallet' ? 'Palet' : 'Koli'}</TTBadge></td>
                          <td><strong>{item.entityNo}</strong><small>{item.sscc}</small></td>
                          <td>{item.orderNo}</td>
                          <td>{item.cartonCount} koli · {item.productCount} ürün</td>
                          <td>{item.scannedBy || '-'}<small>{new Date(item.scannedAt).toLocaleTimeString('tr-TR')}</small></td>
                          {isDraft && <td>{hasPermission('shipments.scan') && <button className="shipment-remove-button" onClick={() => removeItem(item)} title="Çıkar"><Trash2 size={17} /></button>}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TTCard>

              {(isDraft || canCancel || canDelete) && (
                <div className="shipment-actions">
                  {canDelete && (
                    <TTButton variant="danger" icon={<Trash2 size={17} />} onClick={deleteShipment} disabled={busy}>
                      Kaydı Sil
                    </TTButton>
                  )}
                  {canCancel && (
                    <TTButton variant="danger" onClick={cancelShipment} disabled={busy}>
                      {detail.shipment.status === 'Shipped' ? 'Sevkiyatı Geri Al' : 'Sevkiyatı İptal Et'}
                    </TTButton>
                  )}
                  {isDraft && hasPermission('shipments.complete') && <TTButton icon={<Truck size={18} />} onClick={completeShipment} disabled={busy || detail.items.length === 0}>Sevkiyatı Tamamla</TTButton>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
