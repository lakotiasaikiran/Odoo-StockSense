import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { StockMove } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { PrintSlipModal } from '../components/PrintSlipModal';
import { 
  Search, 
  RefreshCw, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  SlidersHorizontal,
  Printer,
  History,
  List,
  LayoutGrid
} from 'lucide-react';

interface MoveHistoryPageProps {
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const MoveHistoryPage: React.FC<MoveHistoryPageProps> = ({ onShowToast }) => {
  const [moves, setMoves] = useState<StockMove[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [printingMove, setPrintingMove] = useState<StockMove | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getMoves({
        search: search.trim() || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setMoves(data);
    } catch (err: any) {
      onShowToast('error', `Failed to load move history: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [typeFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const getMoveIcon = (type: string) => {
    if (type === 'receipt') return <ArrowDownLeft size={16} className="text-green" />;
    if (type === 'delivery') return <ArrowUpRight size={16} className="text-red" />;
    return <ArrowLeftRight size={16} className="text-purple" />;
  };

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div>
          <div className="crumb">Audit Trail / Movements</div>
          <h1>Move History</h1>
        </div>
        <div className="header-actions">
          <button className="secondary-btn" onClick={loadData} title="Refresh movements">
            <RefreshCw size={15} /> Refresh
          </button>
          <div className="toggle-btn-group">
            <button
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <List size={16} />
            </button>
            <button
              className={`toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
              title="Kanban View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <form onSubmit={handleSearchSubmit} className="table-toolbar">
        <div className="search-bar">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by reference (e.g. WH/IN/0001), contact, or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Type:</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="receipt">Inbound (Receipts)</option>
            <option value="delivery">Outbound (Deliveries)</option>
            <option value="internal">Internal Transfers</option>
            <option value="adjustment">Stock Adjustments</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="done">Completed (Done)</option>
            <option value="ready">Ready</option>
            <option value="waiting">Waiting</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </form>

      {/* Content View */}
      {viewMode === 'list' ? (
        <div className="panel card-panel">
          <div className="table-responsive">
            <table className="data-table moves-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Date</th>
                  <th>Contact</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Items & Quantities</th>
                  <th>Status</th>
                  <th>Voucher</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="loading-cell">Loading move history from database...</td>
                  </tr>
                ) : moves.length > 0 ? (
                  moves.map((m) => {
                    const isIn = m.move_type === 'receipt';
                    const isOut = m.move_type === 'delivery';
                    const rowClass = isIn ? 'move-in' : isOut ? 'move-out' : '';

                    return (
                      <tr key={m.id} className={rowClass}>
                        <td>
                          <div className="ref-cell">
                            {getMoveIcon(m.move_type)}
                            <strong>{m.reference}</strong>
                          </div>
                        </td>
                        <td>{m.scheduled_date}</td>
                        <td>{m.contact || '—'}</td>
                        <td>
                          <span className={`loc-pill ${isIn ? 'vendor' : 'stock'}`}>
                            {m.source_location_name || (isIn ? 'Vendor' : 'Stock')}
                          </span>
                        </td>
                        <td>
                          <span className={`loc-pill ${isOut ? 'customer' : 'stock'}`}>
                            {m.dest_location_name || (isOut ? 'Customer' : 'Stock')}
                          </span>
                        </td>
                        <td>
                          <div className="move-lines-summary">
                            {m.lines?.map((line: any, idx: number) => (
                              <div key={idx} className="line-chip">
                                <strong>{line.product_name || `Item #${line.product_id}`}</strong>: {line.quantity}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td><StatusBadge status={m.status} /></td>
                        <td>
                          <button
                            className="secondary-btn small"
                            onClick={() => setPrintingMove(m)}
                            title="Print Document"
                          >
                            <Printer size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="empty-cell">
                      <History size={32} className="muted-icon" />
                      <p>No inventory movements recorded.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Kanban View */
        <div className="kanban-grid">
          {['ready', 'waiting', 'done', 'cancelled'].map((colStatus) => {
            const colMoves = moves.filter((m) => m.status === colStatus);
            return (
              <div key={colStatus} className="kanban-col">
                <div className="kanban-col-header">
                  <span className="col-title">{colStatus.toUpperCase()}</span>
                  <span className="col-count">{colMoves.length}</span>
                </div>
                <div className="kanban-cards">
                  {colMoves.map((m) => (
                    <div key={m.id} className="kanban-card">
                      <div className="kanban-card-top">
                        <div className="ref-cell">
                          {getMoveIcon(m.move_type)}
                          <strong>{m.reference}</strong>
                        </div>
                        <StatusBadge status={m.status} />
                      </div>
                      <div className="kanban-card-body">
                        <div className="card-info-row">
                          <span>Route:</span> {m.source_location_name || 'Origin'} → {m.dest_location_name || 'Dest'}
                        </div>
                        <div className="card-info-row">
                          <span>Contact:</span> {m.contact || '—'}
                        </div>
                        <div className="card-info-row">
                          <span>Date:</span> {m.scheduled_date}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Print Slip Modal */}
      <PrintSlipModal
        move={printingMove}
        onClose={() => setPrintingMove(null)}
      />
    </div>
  );
};
