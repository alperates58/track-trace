import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FileText,
  Search,
  Layers,
  Menu,
  X,
  Inbox,
  Barcode,
  Camera,
  CheckSquare,
  Truck,
  Package,
  BarChart3,
  TrendingUp,
  QrCode,
  Server,
  Users as UsersIcon,
  Shield,
  Key,
  Printer,
  Settings,
  LogOut,
  Sun,
  Moon,
  ChevronRight
} from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  hasPermission: (key: string) => boolean;
  user: {
    name?: string;
    role?: string;
  } | null;
  logout: () => void;
  resolvedTheme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onNavigate,
  hasPermission,
  user,
  logout,
  resolvedTheme,
  toggleTheme
}) => {
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  // Close bottom sheet on escape key or back button hash change
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsBottomSheetOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Prevent background scrolling when bottom sheet is open
  useEffect(() => {
    if (isBottomSheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isBottomSheetOpen]);

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {
        // Vibrations not supported or blocked by permissions
      }
    }
  };

  const handleTabClick = (tabKey: string) => {
    triggerHaptic();
    setIsBottomSheetOpen(false);
    onNavigate(tabKey);
  };

  const handleMoreClick = () => {
    triggerHaptic();
    setIsBottomSheetOpen(prev => !prev);
  };

  // Primary bottom navigation items (5 tabs)
  const showDashboard = hasPermission('dashboard.view');
  const showOrders = hasPermission('orders.view');
  const showTraceability = hasPermission('traceability.view');
  const showPallets = hasPermission('pallets.view');

  // Operational items in bottom sheet
  const showScan = hasPermission('scan.view');
  const showCartons = hasPermission('cartons.view');
  const showShipments = hasPermission('shipments.view');
  const showQrVerification = showScan || showCartons || showOrders || true;

  // Analytics items in bottom sheet
  const showReports = hasPermission('reports.view');
  const showPerformance = hasPermission('reports.view') || hasPermission('orders.view') || hasPermission('traceability.view');
  const showDmCreator = hasPermission('generator.view');

  // Admin items in bottom sheet
  const showUsers = hasPermission('users.view');
  const showStations = hasPermission('stations.view');
  const showAudit = hasPermission('audit.view');
  const showPermissions = hasPermission('permissions.manage') || user?.role === 'Admin';
  const showPrintSettings = hasPermission('system.manage');
  const showSystemInfo = hasPermission('system.view');

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="bottom-nav" aria-label="Mobil Alt Gezinme">
        {showDashboard && (
          <button
            type="button"
            className={`bottom-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleTabClick('dashboard')}
            aria-label="Panel"
          >
            <div className="bottom-nav-icon-wrap">
              <LayoutDashboard size={20} />
            </div>
            <span className="bottom-nav-label">Panel</span>
            {activeTab === 'dashboard' && <span className="bottom-nav-indicator" />}
          </button>
        )}

        {showOrders && (
          <button
            type="button"
            className={`bottom-nav-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => handleTabClick('orders')}
            aria-label="Siparişler"
          >
            <div className="bottom-nav-icon-wrap">
              <FileText size={20} />
            </div>
            <span className="bottom-nav-label">Siparişler</span>
            {activeTab === 'orders' && <span className="bottom-nav-indicator" />}
          </button>
        )}

        {showPerformance && (
          <button
            type="button"
            className={`bottom-nav-item ${activeTab === 'performance' ? 'active' : ''}`}
            onClick={() => handleTabClick('performance')}
            aria-label="Performans"
          >
            <div className="bottom-nav-icon-wrap">
              <TrendingUp size={20} />
            </div>
            <span className="bottom-nav-label">Performans</span>
            {activeTab === 'performance' && <span className="bottom-nav-indicator" />}
          </button>
        )}

        {showCartons && (
          <button
            type="button"
            className={`bottom-nav-item ${activeTab === 'cartons' ? 'active' : ''}`}
            onClick={() => handleTabClick('cartons')}
            aria-label="Koliler"
          >
            <div className="bottom-nav-icon-wrap">
              <Inbox size={20} />
            </div>
            <span className="bottom-nav-label">Koliler</span>
            {activeTab === 'cartons' && <span className="bottom-nav-indicator" />}
          </button>
        )}

        {/* 5th Tab: More / All Modules */}
        <button
          type="button"
          className={`bottom-nav-item ${isBottomSheetOpen ? 'active' : ''}`}
          onClick={handleMoreClick}
          aria-label="Tüm Menü ve Ayarlar"
        >
          <div className="bottom-nav-icon-wrap">
            <Menu size={20} />
          </div>
          <span className="bottom-nav-label">Daha Fazla</span>
          {isBottomSheetOpen && <span className="bottom-nav-indicator" />}
        </button>
      </nav>

      {/* Bottom Sheet Backdrop */}
      {isBottomSheetOpen && (
        <div
          className="bottom-sheet-backdrop"
          onClick={() => setIsBottomSheetOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bottom Sheet Modal Container */}
      <div
        className={`bottom-sheet-container ${isBottomSheetOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Tüm Modüller ve Ayarlar"
      >
        <div className="bottom-sheet-handle-bar" onClick={() => setIsBottomSheetOpen(false)}>
          <div className="bottom-sheet-handle-pill" />
        </div>

        {/* Sheet Header */}
        <div className="bottom-sheet-header">
          <div className="bottom-sheet-user-info">
            <div className="user-avatar" style={{ width: 36, height: 36, fontSize: '14px' }}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
              <span className="user-status-dot" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>
                {user?.name || 'Kullanıcı'}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>
                {user?.role === 'Admin' ? 'Yönetici' : user?.role === 'Operator' ? 'Operatör' : 'İzleyici'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                triggerHaptic();
                toggleTheme();
              }}
              className="theme-toggle-btn"
              title={resolvedTheme === 'dark' ? 'Açık Mod' : 'Koyu Mod'}
              aria-label="Temayı Değiştir"
            >
              {resolvedTheme === 'dark' ? (
                <Sun size={18} style={{ color: '#fbbf24' }} />
              ) : (
                <Moon size={18} style={{ color: '#475569' }} />
              )}
            </button>
            <button
              className="bottom-sheet-close-btn"
              onClick={() => setIsBottomSheetOpen(false)}
              aria-label="Kapat"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Sheet Scrollable Body */}
        <div className="bottom-sheet-body">
          {/* Operasyon Modülleri */}
          <div className="bottom-sheet-section">
            <span className="bottom-sheet-section-title">Operasyon & Saha</span>
            <div className="bottom-sheet-grid">
              {showPallets && (
                <button
                  className={`bottom-sheet-item ${activeTab === 'pallets' ? 'active' : ''}`}
                  onClick={() => handleTabClick('pallets')}
                >
                  <div className="bottom-sheet-item-icon">
                    <Layers size={18} />
                  </div>
                  <span className="bottom-sheet-item-label">Palet Yönetimi</span>
                  <ChevronRight size={14} className="bottom-sheet-item-arrow" />
                </button>
              )}

              {showShipments && (
                <button
                  className={`bottom-sheet-item ${activeTab === 'shipments' ? 'active' : ''}`}
                  onClick={() => handleTabClick('shipments')}
                >
                  <div className="bottom-sheet-item-icon">
                    <Truck size={18} />
                  </div>
                  <span className="bottom-sheet-item-label">Depo & Sevkiyat</span>
                  <ChevronRight size={14} className="bottom-sheet-item-arrow" />
                </button>
              )}

              {showQrVerification && (
                <button
                  className={`bottom-sheet-item ${activeTab === 'qr-verification' ? 'active' : ''}`}
                  onClick={() => handleTabClick('qr-verification')}
                >
                  <div className="bottom-sheet-item-icon">
                    <CheckSquare size={18} />
                  </div>
                  <span className="bottom-sheet-item-label">QR Doğrulama</span>
                  <ChevronRight size={14} className="bottom-sheet-item-arrow" />
                </button>
              )}

              {showCartons && (
                <button
                  className={`bottom-sheet-item ${activeTab === 'preprint-create' ? 'active' : ''}`}
                  onClick={() => handleTabClick('preprint-create')}
                >
                  <div className="bottom-sheet-item-icon">
                    <Package size={18} />
                  </div>
                  <span className="bottom-sheet-item-label">Ön Etiket Oluştur</span>
                  <ChevronRight size={14} className="bottom-sheet-item-arrow" />
                </button>
              )}

              {showScan && (
                <>
                  <button
                    className={`bottom-sheet-item ${activeTab === 'scan' ? 'active' : ''}`}
                    onClick={() => handleTabClick('scan')}
                  >
                    <div className="bottom-sheet-item-icon">
                      <Barcode size={18} />
                    </div>
                    <span className="bottom-sheet-item-label">Otomatik Koli Modu</span>
                    <ChevronRight size={14} className="bottom-sheet-item-arrow" />
                  </button>

                  <button
                    className={`bottom-sheet-item ${activeTab === 'preprint-scan' ? 'active' : ''}`}
                    onClick={() => handleTabClick('preprint-scan')}
                  >
                    <div className="bottom-sheet-item-icon">
                      <Barcode size={18} />
                    </div>
                    <span className="bottom-sheet-item-label">Ön Etiketli Koli</span>
                    <ChevronRight size={14} className="bottom-sheet-item-arrow" />
                  </button>

                  <button
                    className={`bottom-sheet-item ${activeTab === 'digieye-scan' ? 'active' : ''}`}
                    onClick={() => handleTabClick('digieye-scan')}
                  >
                    <div className="bottom-sheet-item-icon">
                      <Camera size={18} />
                    </div>
                    <span className="bottom-sheet-item-label">Endüstriyel Kamera</span>
                    <ChevronRight size={14} className="bottom-sheet-item-arrow" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Analitik & Raporlar */}
          {(showReports || showPerformance || showDmCreator || showTraceability) && (
            <div className="bottom-sheet-section">
              <span className="bottom-sheet-section-title">Analitik & İzleme</span>
              <div className="bottom-sheet-grid">
                {showTraceability && (
                  <button
                    className={`bottom-sheet-item ${activeTab === 'traceability' ? 'active' : ''}`}
                    onClick={() => handleTabClick('traceability')}
                  >
                    <div className="bottom-sheet-item-icon">
                      <Search size={18} />
                    </div>
                    <span className="bottom-sheet-item-label">İzlenebilirlik Merkezi</span>
                    <ChevronRight size={14} className="bottom-sheet-item-arrow" />
                  </button>
                )}

                {showReports && (
                  <button
                    className={`bottom-sheet-item ${activeTab === 'reports' ? 'active' : ''}`}
                    onClick={() => handleTabClick('reports')}
                  >
                    <div className="bottom-sheet-item-icon">
                      <BarChart3 size={18} />
                    </div>
                    <span className="bottom-sheet-item-label">Sipariş Raporları</span>
                    <ChevronRight size={14} className="bottom-sheet-item-arrow" />
                  </button>
                )}



                {showDmCreator && (
                  <button
                    className={`bottom-sheet-item ${activeTab === 'dm-creator' ? 'active' : ''}`}
                    onClick={() => handleTabClick('dm-creator')}
                  >
                    <div className="bottom-sheet-item-icon">
                      <QrCode size={18} />
                    </div>
                    <span className="bottom-sheet-item-label">DataMatrix Üretici</span>
                    <ChevronRight size={14} className="bottom-sheet-item-arrow" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Sistem Yönetimi */}
          {(showUsers || showStations || showAudit || showPermissions || showPrintSettings || showSystemInfo) && (
            <div className="bottom-sheet-section">
              <span className="bottom-sheet-section-title">Sistem & Güvenlik</span>
              <div className="bottom-sheet-grid">
                {showStations && (
                  <button
                    className={`bottom-sheet-item ${activeTab === 'stations' ? 'active' : ''}`}
                    onClick={() => handleTabClick('stations')}
                  >
                    <div className="bottom-sheet-item-icon">
                      <Server size={18} />
                    </div>
                    <span className="bottom-sheet-item-label">İstasyon Yönetimi</span>
                    <ChevronRight size={14} className="bottom-sheet-item-arrow" />
                  </button>
                )}

                {showUsers && (
                  <button
                    className={`bottom-sheet-item ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => handleTabClick('users')}
                  >
                    <div className="bottom-sheet-item-icon">
                      <UsersIcon size={18} />
                    </div>
                    <span className="bottom-sheet-item-label">Kullanıcı Yönetimi</span>
                    <ChevronRight size={14} className="bottom-sheet-item-arrow" />
                  </button>
                )}

                {showAudit && (
                  <button
                    className={`bottom-sheet-item ${activeTab === 'audit' ? 'active' : ''}`}
                    onClick={() => handleTabClick('audit')}
                  >
                    <div className="bottom-sheet-item-icon">
                      <Shield size={18} />
                    </div>
                    <span className="bottom-sheet-item-label">Audit Center</span>
                    <ChevronRight size={14} className="bottom-sheet-item-arrow" />
                  </button>
                )}

                {showPermissions && (
                  <button
                    className={`bottom-sheet-item ${activeTab === 'permission-matrix' ? 'active' : ''}`}
                    onClick={() => handleTabClick('permission-matrix')}
                  >
                    <div className="bottom-sheet-item-icon">
                      <Key size={18} />
                    </div>
                    <span className="bottom-sheet-item-label">Yetki Matrisi</span>
                    <ChevronRight size={14} className="bottom-sheet-item-arrow" />
                  </button>
                )}

                {showPrintSettings && (
                  <button
                    className={`bottom-sheet-item ${activeTab === 'print-settings' ? 'active' : ''}`}
                    onClick={() => handleTabClick('print-settings')}
                  >
                    <div className="bottom-sheet-item-icon">
                      <Printer size={18} />
                    </div>
                    <span className="bottom-sheet-item-label">Yazdırma Ayarları</span>
                    <ChevronRight size={14} className="bottom-sheet-item-arrow" />
                  </button>
                )}

                {showSystemInfo && (
                  <button
                    className={`bottom-sheet-item ${activeTab === 'system' ? 'active' : ''}`}
                    onClick={() => handleTabClick('system')}
                  >
                    <div className="bottom-sheet-item-icon">
                      <Settings size={18} />
                    </div>
                    <span className="bottom-sheet-item-label">Sistem Bilgisi</span>
                    <ChevronRight size={14} className="bottom-sheet-item-arrow" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Çıkış Yap Butonu */}
          <div style={{ marginTop: '16px', paddingBottom: '20px' }}>
            <button
              onClick={() => {
                triggerHaptic();
                logout();
              }}
              className="bottom-sheet-logout-btn"
            >
              <LogOut size={16} />
              <span>Oturumu Kapat</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
