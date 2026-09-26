import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';
import './styles.css';
import { Toast } from './components/Toast';
import { ToastMessage } from './types';
import { api } from './api';

// Components & Pages
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { Sidebar } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { WarehousesPage } from './pages/WarehousesPage';
import { ReceiptsPage } from './pages/ReceiptsPage';
import { DeliveriesPage } from './pages/DeliveriesPage';
import { StockPage } from './pages/StockPage';
import { MoveHistoryPage } from './pages/MoveHistoryPage';

// Icons
import {
  Menu,
  Database,
  Plus,
  ArrowUpRight,
  LogOut,
  User
} from 'lucide-react';

function App() {
  // Navigation / Routing state
  const [currentRoute, setCurrentRoute] = useState<'/' | '/login' | '/signup' | '/app'>('/');
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'receipts' | 'deliveries' | 'stock' | 'products' | 'moves' | 'warehouses'>('dashboard');

  // Sidebar states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Authentication & Database state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<{ ok: boolean; message: string }>({
    ok: false,
    message: 'Connecting to PostgreSQL...'
  });
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

  // Sync with browser URL / history on mount
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/login') setCurrentRoute('/login');
    else if (path === '/signup') setCurrentRoute('/signup');
    else if (path === '/app' || path === '/dashboard') setCurrentRoute('/app');
    else setCurrentRoute('/');

    const handlePopState = () => {
      const p = window.location.pathname;
      if (p === '/login') setCurrentRoute('/login');
      else if (p === '/signup') setCurrentRoute('/signup');
      else if (p === '/app' || p === '/dashboard') setCurrentRoute('/app');
      else setCurrentRoute('/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (route: '/' | '/login' | '/signup' | '/app') => {
    setCurrentRoute(route);
    window.history.pushState({}, '', route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Initial user & DB health check
  useEffect(() => {
    // Check saved user session
    const savedUser = localStorage.getItem('stocksense_user');
    const token = localStorage.getItem('stocksense_token');
    if (savedUser && token) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        // ignore
      }
    }

    // Check DB health
    api.getHealth()
      .then((data) => {
        if (data?.ok) {
          setDbStatus({ ok: true, message: 'PostgreSQL Connected' });
        } else {
          setDbStatus({ ok: false, message: 'Database Disconnected' });
        }
      })
      .catch((err) => {
        setDbStatus({ ok: false, message: `DB Offline: ${err.message}` });
      });
  }, []);

  const handleAuthSuccess = (user: any) => {
    setCurrentUser(user);
    navigateTo('/app');
  };

  const handleSignOut = () => {
    localStorage.removeItem('stocksense_token');
    localStorage.removeItem('stocksense_user');
    setCurrentUser(null);
    showToast('info', 'You have been signed out.');
    navigateTo('/');
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

  // Route transition variants (under 300ms)
  const pageVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' as const } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease: 'easeIn' as const } },
  };

  return (
    <>
      {/* Global Toast Manager */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* ──────────────── 1. PUBLIC LANDING PAGE (route: "/") ──────────────── */}
      {currentRoute === '/' && (
        <LandingPage
          onNavigateToAuth={(mode) => navigateTo(mode === 'login' ? '/login' : '/signup')}
          onLaunchDemo={() => navigateTo('/app')}
        />
      )}

      {/* ──────────────── 2. AUTHENTICATION PAGES (routes: "/login", "/signup") ──────────────── */}
      {(currentRoute === '/login' || currentRoute === '/signup') && (
        <AuthPage
          initialMode={currentRoute === '/login' ? 'login' : 'signup'}
          onAuthSuccess={handleAuthSuccess}
          onBackToHome={() => navigateTo('/')}
          onShowToast={showToast}
        />
      )}

      {/* ──────────────── 3. MAIN DASHBOARD WORKSPACE (route: "/app") ──────────────── */}
      {currentRoute === '/app' && (
        <div className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
          {/* Animated & Collapsible Sidebar */}
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            isMobileOpen={mobileSidebarOpen}
            onCloseMobile={() => setMobileSidebarOpen(false)}
            currentPage={currentPage}
            onNavigate={(page) => setCurrentPage(page as any)}
            dbStatus={dbStatus}
            currentUser={currentUser}
            onSignOut={handleSignOut}
          />

          {/* Main Workspace Panel */}
          <main className="main-panel">
            {/* Topbar with Hamburger Menu */}
            <header className="topbar">
              <div className="topbar-left">
                {/* Hamburger Toggle Icon for Mobile & Desktop */}
                <button
                  className="hamburger-menu-btn"
                  onClick={() => {
                    if (window.innerWidth < 768) {
                      setMobileSidebarOpen(true);
                    } else {
                      setSidebarCollapsed(!sidebarCollapsed);
                    }
                  }}
                  title="Toggle Navigation"
                  aria-label="Toggle Navigation"
                >
                  <Menu size={20} />
                </button>

                <button 
                  className="brand-chip" 
                  onClick={() => navigateTo('/')}
                  title="Return to Public Landing Page"
                >
                  StockSense
                </button>
                <span className="topbar-crumb">/ {currentPage.toUpperCase()}</span>
              </div>

              <div className="top-actions">
                <div className={`db-pill ${dbStatus.ok ? 'connected' : 'error'}`}>
                  <Database size={13} />
                  <span>{dbStatus.ok ? 'Postgres Live' : 'DB Disconnected'}</span>
                </div>

                <button className="secondary-btn small hide-mobile" onClick={handleOpenNewDelivery}>
                  <ArrowUpRight size={14} /> Dispatch
                </button>
                <button className="primary-btn small" onClick={handleOpenNewReceipt}>
                  <Plus size={14} /> Receive Goods
                </button>

                {/* Return to Home / Exit Link */}
                <button
                  className="icon-btn"
                  onClick={() => navigateTo('/')}
                  title="View Public Landing Page"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </header>

            {/* Page Content with Framer Motion Transition */}
            <div className="page-content">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPage}
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {currentPage === 'dashboard' && (
                    <DashboardPage
                      onNavigate={(page) => setCurrentPage(page as any)}
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
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
