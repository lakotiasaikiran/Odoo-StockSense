import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { DashboardStats, LowStockItem, StockMove } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Boxes, 
  Activity,
  Plus,
  RefreshCw
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
  onOpenNewReceipt: () => void;
  onOpenNewDelivery: () => void;
  onOpenStockAdjust: (productId?: number) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenNewReceipt,
  onOpenNewDelivery,
  onOpenStockAdjust
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [recentMoves, setRecentMoves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const data = await api.getDashboard();
      setStats(data.dashboard);
      setLowStock(data.lowStock);
      setRecentMoves(data.moves);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div>
          <div className="crumb">Workspace / Operations Overview</div>
          <h1>Inventory Command Center</h1>
        </div>
        <div className="header-actions">
          <button 
            className="secondary-btn" 
            onClick={() => loadData(true)} 
            disabled={refreshing}
            title="Refresh live metrics from PostgreSQL"
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Syncing...' : 'Sync Data'}
          </button>
          <button className="secondary-btn" onClick={onOpenNewDelivery}>
            <ArrowUpRight size={16} /> New Delivery
          </button>
          <button className="primary-btn" onClick={onOpenNewReceipt}>
            <Plus size={16} /> New Receipt
          </button>
        </div>
      </header>

      {/* KPI Cards Grid */}
      <section className="kpi-grid">
        {/* Receipt Card */}
        <div className="kpi-card" onClick={() => onNavigate('receipts')}>
          <div className="kpi-top">
            <div className="kpi-icon-wrap in">
              <ArrowDownLeft size={22} />
            </div>
            <span className="kpi-tag">Inbound</span>
          </div>
          <div className="kpi-value">{loading ? '…' : stats?.toReceive ?? 0}</div>
          <div className="kpi-title">To Receive</div>
          <div className="kpi-sub-pills">
            <span className={`sub-pill ${stats?.toReceiveLate ? 'danger' : 'neutral'}`}>
              <Clock size={12} /> {stats?.toReceiveLate ?? 0} Late
            </span>
            <span className="sub-pill neutral">
              {stats?.toReceiveOps ?? 0} operations
            </span>
          </div>
        </div>

        {/* Delivery Card */}
        <div className="kpi-card" onClick={() => onNavigate('deliveries')}>
          <div className="kpi-top">
            <div className="kpi-icon-wrap out">
              <ArrowUpRight size={22} />
            </div>
            <span className="kpi-tag">Outbound</span>
          </div>
          <div className="kpi-value">{loading ? '…' : stats?.toDeliver ?? 0}</div>
          <div className="kpi-title">To Deliver</div>
          <div className="kpi-sub-pills">
            <span className={`sub-pill ${stats?.toDeliverLate ? 'danger' : 'neutral'}`}>
              <Clock size={12} /> {stats?.toDeliverLate ?? 0} Late
            </span>
            <span className={`sub-pill ${stats?.toDeliverWaiting ? 'warn' : 'neutral'}`}>
              <AlertTriangle size={12} /> {stats?.toDeliverWaiting ?? 0} waiting
            </span>
            <span className="sub-pill neutral">
              {stats?.toDeliverOps ?? 0} ops
            </span>
          </div>
        </div>

        {/* Completed Operations */}
        <div className="kpi-card" onClick={() => onNavigate('moves')}>
          <div className="kpi-top">
            <div className="kpi-icon-wrap success">
              <CheckCircle2 size={22} />
            </div>
            <span className="kpi-tag success">Completed</span>
          </div>
          <div className="kpi-value">{loading ? '…' : stats?.completedMoves ?? 0}</div>
          <div className="kpi-title">Completed Moves</div>
          <div className="kpi-sub-pills">
            <span className="sub-pill success">100% Persisted in DB</span>
            <span className="sub-pill neutral">{stats?.totalMoves ?? 0} Total</span>
          </div>
        </div>

        {/* Low Stock Items Alert Card */}
        <div className="kpi-card" onClick={() => onNavigate('stock')}>
          <div className="kpi-top">
            <div className="kpi-icon-wrap warn">
              <AlertTriangle size={22} />
            </div>
            <span className="kpi-tag warn">Stock Health</span>
          </div>
          <div className="kpi-value">{loading ? '…' : lowStock.length}</div>
          <div className="kpi-title">At-Risk Products</div>
          <div className="kpi-sub-pills">
            <span className={`sub-pill ${lowStock.length > 0 ? 'warn' : 'success'}`}>
              {lowStock.length > 0 ? 'Below reorder point' : 'All stocks healthy'}
            </span>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="dashboard-content-grid">
        {/* At-Risk Stock Table */}
        <section className="panel card-panel">
          <div className="panel-header">
            <div>
              <div className="mini-label">Inventory Thresholds</div>
              <h2>Low Stock Alert</h2>
            </div>
            <button className="secondary-btn small" onClick={() => onNavigate('stock')}>
              View Stock
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Location</th>
                  <th>Free to Use</th>
                  <th>Reorder Point</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.length > 0 ? (
                  lowStock.slice(0, 5).map((item, idx) => (
                    <tr key={`${item.productId}-${idx}`}>
                      <td>
                        <div className="prod-cell">
                          <strong>{item.productName}</strong>
                          <span className="sub-text">{item.sku}</span>
                        </div>
                      </td>
                      <td>{item.locationName}</td>
                      <td>
                        <span className="badge-critical">{item.freeToUse}</span>
                      </td>
                      <td>{item.reorderPoint}</td>
                      <td>
                        <button
                          className="primary-btn small"
                          onClick={() => onOpenNewReceipt()}
                          title="Create receipt to restock"
                        >
                          Restock
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      <CheckCircle2 size={24} className="success-icon" />
                      <p>All warehouse products are currently above their reorder thresholds.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Quick Operations Panel */}
        <section className="panel card-panel side-actions-panel">
          <div className="panel-header">
            <div>
              <div className="mini-label">Operations</div>
              <h2>Quick Actions</h2>
            </div>
          </div>

          <div className="action-buttons-list">
            <button className="op-action-btn" onClick={onOpenNewReceipt}>
              <div className="op-icon in"><ArrowDownLeft size={18} /></div>
              <div className="op-info">
                <strong>Receive Goods</strong>
                <span>Log vendor shipment into stock</span>
              </div>
            </button>

            <button className="op-action-btn" onClick={onOpenNewDelivery}>
              <div className="op-icon out"><ArrowUpRight size={18} /></div>
              <div className="op-info">
                <strong>Create Delivery</strong>
                <span>Dispatch goods to customer</span>
              </div>
            </button>

            <button className="op-action-btn" onClick={() => onOpenStockAdjust()}>
              <div className="op-icon neutral"><Boxes size={18} /></div>
              <div className="op-info">
                <strong>Physical Stock Adjustment</strong>
                <span>Reconcile counted inventory</span>
              </div>
            </button>

            <button className="op-action-btn" onClick={() => onNavigate('products')}>
              <div className="op-icon purple"><Plus size={18} /></div>
              <div className="op-info">
                <strong>Add New Product</strong>
                <span>Define SKU, pricing, reorder point</span>
              </div>
            </button>
          </div>
        </section>
      </div>

      {/* Lower Row: Recent Activity & Pulse */}
      <div className="dashboard-content-grid lower-row">
        {/* Recent Moves Table */}
        <section className="panel card-panel">
          <div className="panel-header">
            <div>
              <div className="mini-label">Live Audit Trail</div>
              <h2>Recent Movements</h2>
            </div>
            <button className="secondary-btn small" onClick={() => onNavigate('moves')}>
              View Full History
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Route</th>
                  <th>Contact</th>
                  <th>Scheduled</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentMoves.length > 0 ? (
                  recentMoves.map((m) => (
                    <tr key={m.id}>
                      <td><strong className="ref-link">{m.reference}</strong></td>
                      <td>
                        <span className={`type-tag ${m.move_type}`}>
                          {m.move_type.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className="route-text">
                          {m.source_location || '—'} → {m.dest_location || '—'}
                        </span>
                      </td>
                      <td>{m.contact || '—'}</td>
                      <td>{m.scheduled_date}</td>
                      <td><StatusBadge status={m.status} /></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      No recent movements logged.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pulse Bar Chart */}
        <section className="panel card-panel">
          <div className="panel-header">
            <div>
              <div className="mini-label">Activity</div>
              <h2>Warehouse Pulse</h2>
            </div>
            <span className="status-indicator-live">
              <span className="live-dot" /> Live
            </span>
          </div>

          <div className="pulse-chart">
            <div className="pulse-bar-col">
              <div className="pulse-bar-track">
                <div className="pulse-bar-fill" style={{ height: '45%' }} />
              </div>
              <span className="pulse-bar-lbl">Mon</span>
            </div>
            <div className="pulse-bar-col">
              <div className="pulse-bar-track">
                <div className="pulse-bar-fill" style={{ height: '62%' }} />
              </div>
              <span className="pulse-bar-lbl">Tue</span>
            </div>
            <div className="pulse-bar-col">
              <div className="pulse-bar-track">
                <div className="pulse-bar-fill" style={{ height: '78%' }} />
              </div>
              <span className="pulse-bar-lbl">Wed</span>
            </div>
            <div className="pulse-bar-col">
              <div className="pulse-bar-track">
                <div className="pulse-bar-fill" style={{ height: '85%' }} />
              </div>
              <span className="pulse-bar-lbl">Thu</span>
            </div>
            <div className="pulse-bar-col">
              <div className="pulse-bar-track">
                <div className="pulse-bar-fill" style={{ height: '70%' }} />
              </div>
              <span className="pulse-bar-lbl">Fri</span>
            </div>
            <div className="pulse-bar-col">
              <div className="pulse-bar-track">
                <div className="pulse-bar-fill active-day" style={{ height: '94%' }} />
              </div>
              <span className="pulse-bar-lbl">Today</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
