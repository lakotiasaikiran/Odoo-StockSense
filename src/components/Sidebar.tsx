import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Package,
  History,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Database
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
  dbStatus: { ok: boolean; message: string };
  currentUser: any;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  currentPage,
  onNavigate,
  dbStatus,
  currentUser,
  onSignOut,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: <LayoutDashboard size={18} />, section: 'Workspace' },
    { id: 'receipts', label: 'Receipts (In)', icon: <ArrowDownLeft size={18} />, section: 'Operations' },
    { id: 'deliveries', label: 'Deliveries (Out)', icon: <ArrowUpRight size={18} />, section: 'Operations' },
    { id: 'stock', label: 'Stock Inventory', icon: <Boxes size={18} />, section: 'Operations' },
    { id: 'products', label: 'Products', icon: <Package size={18} />, section: 'Master Data' },
    { id: 'moves', label: 'Move History', icon: <History size={18} />, section: 'Master Data' },
    { id: 'warehouses', label: 'Warehouses & Racks', icon: <Settings size={18} />, section: 'Configuration' },
  ];

  const handleItemClick = (pageId: string) => {
    onNavigate(pageId);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            className="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCloseMobile}
          />
        )}
      </AnimatePresence>

      {/* Animated Sidebar */}
      <motion.aside
        className={`sidebar ${collapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        initial={false}
        animate={{
          width: collapsed ? 72 : 260,
          transition: { duration: 0.24, ease: 'easeOut' as const },
        }}
      >
        {/* Brand Area */}
        <div className="brand-wrap">
          <div className="brand-mark" onClick={() => onNavigate('dashboard')} style={{ cursor: 'pointer' }}>
            S
          </div>
          {!collapsed && (
            <motion.div
              className="brand-text-block"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18 }}
            >
              <div className="brand-name">StockSense</div>
              <div className="brand-sub">Odoo Inventory Cloud</div>
            </motion.div>
          )}

          {/* Mobile close button */}
          <button className="mobile-close-btn" onClick={onCloseMobile}>
            <X size={18} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="nav">
          {navItems.map((item, index) => {
            const showSectionTitle =
              !collapsed &&
              (index === 0 || navItems[index - 1].section !== item.section);

            return (
              <React.Fragment key={item.id}>
                {showSectionTitle && (
                  <div className="nav-group-title">{item.section}</div>
                )}
                <button
                  className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                  onClick={() => handleItemClick(item.id)}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {!collapsed && (
                    <motion.span
                      className="nav-label"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* User Session & Status Area */}
        <div className="sidebar-bottom-area">
          {/* User profile */}
          <div className="user-profile-row">
            <div className="user-avatar">
              <User size={16} />
            </div>
            {!collapsed && (
              <div className="user-info">
                <span className="user-name">{currentUser?.name || 'Administrator'}</span>
                <span className="user-role">{currentUser?.email || 'admin@stocksense.com'}</span>
              </div>
            )}
            <button
              className="signout-icon-btn"
              onClick={onSignOut}
              title="Sign Out / Return to Home"
            >
              <LogOut size={16} />
            </button>
          </div>

          {/* Database Connectivity Indicator */}
          {!collapsed ? (
            <div className="sidebar-card">
              <div className="mini-label">PostgreSQL Connectivity</div>
              <div className="status-row">
                <span className={`dot ${dbStatus.ok ? 'success' : 'warn'}`} />
                <span className="status-text">{dbStatus.message}</span>
              </div>
            </div>
          ) : (
            <div className="collapsed-db-dot" title={dbStatus.message}>
              <span className={`dot ${dbStatus.ok ? 'success' : 'warn'}`} />
            </div>
          )}

          {/* Collapse/Expand Toggle on Desktop */}
          <div className="sidebar-collapse-toggle desktop-only">
            <button
              className="collapse-btn"
              onClick={onToggleCollapse}
              title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              {!collapsed && <span>Collapse Sidebar</span>}
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
};
