import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { Toast } from './components/Toast';
import { ToastMessage } from './types';
import { api } from './api';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { WarehousesPage } from './pages/WarehousesPage';
import { ReceiptsPage } from './pages/ReceiptsPage';
import { DeliveriesPage } from './pages/DeliveriesPage';
import { StockPage } from './pages/StockPage';
import { MoveHistoryPage } from './pages/MoveHistoryPage';

// Icons
import {
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Package,
  History,
  Settings,
  Database,
  Plus,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

function App() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'receipts' | 'deliveries' | 'stock' | 'products' | 'moves' | 'warehouses'>('dashboard');
  const [dbStatus, setDbStatus] = useState<{ ok: boolean; message: string }>({ ok: false, message: 'Connecting to PostgreSQL...' });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modal triggers from other pages
  const [openReceiptModal, setOpenReceiptModal] = useState(false);
  const [openDeliveryModal, setOpenDeliveryModal] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState<number | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Check health on mount
  useEffect(() => {
    api.getHealth()
      .then((data) => {
        if (data.ok) {
          setDbStatus({ ok: true, message: 'PostgreSQL Connected' });
        } else {
          setDbStatus({ ok: false, message: 'Database Disconnected' });
        }
      })
      .catch((err) => {
        setDbStatus({ ok: false, message: `DB Offline: ${err.message}` });
      });
  }, []);

  const handleNavigate = (page: string) => {
    setCurrentPage(page as any);
  };

  const handleOpenNewReceipt = () => {
    setCurrentPage('receipts');
    setOpenReceiptModal(true);
  };

  const handleOpenNewDelivery = () => {
    setCurrentPage('deliveries');
    setOpenDeliveryModal(true);
  };

  const handleOpenStockAdjust = (productId?: number) => {
    setCurrentPage('stock');
    if (productId) setAdjustProductId(productId);
  };

  return (
    <div className="app-shell">
      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-wrap">
          <div className="brand-mark">S</div>
          <div>
            <div className="brand-name">StockSense</div>
            <div className="brand-sub">Odoo Inventory Cloud</div>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-group-title">Workspace</div>
          <button
            className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
          >
            <LayoutDashboard size={17} /> Overview
          </button>

          <div className="nav-group-title">Operations</div>
          <button
            className={`nav-item ${currentPage === 'receipts' ? 'active' : ''}`}
            onClick={() => {
              setCurrentPage('receipts');
              setOpenReceiptModal(false);
            }}
          >
            <ArrowDownLeft size={17} /> Receipts (In)
          </button>
          <button
            className={`nav-item ${currentPage === 'deliveries' ? 'active' : ''}`}
            onClick={() => {
              setCurrentPage('deliveries');
              setOpenDeliveryModal(false);
            }}
          >
            <ArrowUpRight size={17} /> Deliveries (Out)
          </button>
          <button
            className={`nav-item ${currentPage === 'stock' ? 'active' : ''}`}
            onClick={() => setCurrentPage('stock')}
          >
            <Boxes size={17} /> Stock Inventory
          </button>

          <div className="nav-group-title">Master Data</div>
          <button
            className={`nav-item ${currentPage === 'products' ? 'active' : ''}`}
            onClick={() => setCurrentPage('products')}
          >
            <Package size={17} /> Products
          </button>
          <button
            className={`nav-item ${currentPage === 'moves' ? 'active' : ''}`}
            onClick={() => setCurrentPage('moves')}
          >
            <History size={17} /> Move History
          </button>

          <div className="nav-group-title">Configuration</div>
          <button
            className={`nav-item ${currentPage === 'warehouses' ? 'active' : ''}`}
            onClick={() => setCurrentPage('warehouses')}
          >
            <Settings size={17} /> Warehouses & Racks
          </button>
        </nav>

        {/* Database & System Status Card */}
        <div className="sidebar-card">
          <div className="mini-label">System Connectivity</div>
          <div className="status-row">
            <span className={`dot ${dbStatus.ok ? 'success' : 'warn'}`} />
            <span className="status-text">{dbStatus.message}</span>
          </div>
          <div className="status-sub">PostgreSQL Port 5432 • Live CRUD</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-panel">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <span className="brand-chip">StockSense 1.0</span>
            <span className="topbar-crumb">/ {currentPage.toUpperCase()}</span>
          </div>

          <div className="top-actions">
            <div className={`db-pill ${dbStatus.ok ? 'connected' : 'error'}`}>
              <Database size={14} />
              <span>{dbStatus.ok ? 'Postgres Live' : 'DB Disconnected'}</span>
            </div>
            <button className="secondary-btn small" onClick={handleOpenNewDelivery}>
              <ArrowUpRight size={14} /> Dispatch
            </button>
            <button className="primary-btn small" onClick={handleOpenNewReceipt}>
              <Plus size={14} /> Receive Goods
            </button>
          </div>
        </header>

        {/* Routed Page */}
        <div className="page-content">
          {currentPage === 'dashboard' && (
            <DashboardPage
              onNavigate={handleNavigate}
              onOpenNewReceipt={handleOpenNewReceipt}
              onOpenNewDelivery={handleOpenNewDelivery}
              onOpenStockAdjust={handleOpenStockAdjust}
            />
          )}

          {currentPage === 'products' && (
            <ProductsPage onShowToast={showToast} />
          )}

          {currentPage === 'warehouses' && (
            <WarehousesPage onShowToast={showToast} />
          )}

          {currentPage === 'receipts' && (
            <ReceiptsPage
              onShowToast={showToast}
              openCreateImmediately={openReceiptModal}
            />
          )}

          {currentPage === 'deliveries' && (
            <DeliveriesPage
              onShowToast={showToast}
              openCreateImmediately={openDeliveryModal}
            />
          )}

          {currentPage === 'stock' && (
            <StockPage
              onShowToast={showToast}
              openAdjustProductId={adjustProductId}
              onClearAdjustProduct={() => setAdjustProductId(null)}
            />
          )}

          {currentPage === 'moves' && (
            <MoveHistoryPage onShowToast={showToast} />
          )}
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
