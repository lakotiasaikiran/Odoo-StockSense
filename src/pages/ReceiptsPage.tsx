import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { StockMove, Product, Warehouse, Location } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { MoveStatusTracker } from '../components/MoveStatusTracker';
import { PrintSlipModal } from '../components/PrintSlipModal';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Check, 
  Printer, 
  Ban, 
  X, 
  AlertCircle, 
  ArrowDownLeft, 
  List, 
  LayoutGrid,
  Trash2,
  Calendar,
  User,
  ArrowRight
} from 'lucide-react';

interface ReceiptsPageProps {
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
  openCreateImmediately?: boolean;
}

export const ReceiptsPage: React.FC<ReceiptsPageProps> = ({ onShowToast, openCreateImmediately }) => {
  const [receipts, setReceipts] = useState<StockMove[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Detail Drawer / Modal
  const [selectedReceipt, setSelectedReceipt] = useState<StockMove | null>(null);
  const [validating, setValidating] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Print Modal
  const [printingMove, setPrintingMove] = useState<StockMove | null>(null);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form Fields
  const [selectedWhId, setSelectedWhId] = useState<string>('');
  const [contact, setContact] = useState('Azure Interior');
  const [destLocationId, setDestLocationId] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [lines, setLines] = useState<{ product_id: number; quantity: number }[]>([
    { product_id: 0, quantity: 10 },
  ]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recs, prods, locs, whs] = await Promise.all([
        api.getReceipts(),
        api.getProducts(),
        api.getLocations(),
        api.getWarehouses(),
      ]);
      setReceipts(recs);
      setProducts(prods);
      setLocations(locs);
      setWarehouses(whs);

      if (whs.length > 0 && !selectedWhId) {
        setSelectedWhId(whs[0].id.toString());
      }

      // Default stock location
      const stockLoc = locs.find((l) => !l.is_virtual);
      if (stockLoc && !destLocationId) {
        setDestLocationId(stockLoc.id.toString());
      }
      if (prods.length > 0 && lines[0].product_id === 0) {
        setLines([{ product_id: prods[0].id, quantity: 10 }]);
      }
    } catch (err: any) {
      onShowToast('error', `Failed to load receipts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (openCreateImmediately) {
      setShowCreateModal(true);
    }
  }, [openCreateImmediately]);

  // Validate Receipt
  const handleValidate = async (receipt: StockMove) => {
    setValidating(true);
    try {
      const res = await api.validateReceipt(receipt.id);
      onShowToast('success', res.message);
      // update state
      setSelectedReceipt(res.move);
      loadData();
    } catch (err: any) {
      onShowToast('error', `Validation failed: ${err.message}`);
    } finally {
      setValidating(false);
    }
  };

  // Cancel Receipt
  const handleCancel = async (receipt: StockMove) => {
    if (!confirm(`Are you sure you want to cancel receipt ${receipt.reference}?`)) return;
    setCancelling(true);
    try {
      const res = await api.cancelReceipt(receipt.id);
      onShowToast('info', res.message);
      setSelectedReceipt(res.move);
      loadData();
    } catch (err: any) {
      onShowToast('error', `Failed to cancel receipt: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  // Create Receipt
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destLocationId) {
      setCreateError('Please select a destination warehouse location.');
      return;
    }

    const validLines = lines.filter((l) => l.product_id > 0 && l.quantity > 0);
    if (validLines.length === 0) {
      setCreateError('At least one product line with quantity > 0 is required.');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const newMove = await api.createReceipt({
        warehouse_id: selectedWhId ? parseInt(selectedWhId, 10) : undefined,
        dest_location_id: parseInt(destLocationId, 10),
        contact: contact.trim() || 'Vendor',
        scheduled_date: scheduledDate,
        lines: validLines,
      });

      onShowToast('success', `Receipt ${newMove.reference} created successfully!`);
      setShowCreateModal(false);
      await loadData();
      // Open detail view for the newly created receipt
      setSelectedReceipt(newMove);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create receipt.');
    } finally {
      setCreating(false);
    }
  };

  // Line item helpers
  const addLine = () => {
    const defaultProdId = products.length > 0 ? products[0].id : 0;
    setLines([...lines, { product_id: defaultProdId, quantity: 5 }]);
  };

  const updateLine = (index: number, field: 'product_id' | 'quantity', val: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: val };
    setLines(updated);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, idx) => idx !== index));
  };

  const filteredReceipts = receipts.filter((r) => {
    const matchesSearch =
      r.reference.toLowerCase().includes(search.toLowerCase()) ||
      (r.contact && r.contact.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div>
          <div className="crumb">Operations / Inbound Logistics</div>
          <h1>Receipts (Goods In)</h1>
        </div>
        <div className="header-actions">
          <button className="secondary-btn" onClick={loadData} title="Refresh receipts list">
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
          <button className="primary-btn" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> New Receipt
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="table-toolbar">
        <div className="search-bar">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by reference (e.g. WH/IN/0001) or vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses ({receipts.length})</option>
            <option value="ready">Ready to Validate</option>
            <option value="draft">Draft</option>
            <option value="done">Completed (Done)</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Content View (List vs Kanban) */}
      {viewMode === 'list' ? (
        <div className="panel card-panel">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Receive From</th>
                  <th>Destination Location</th>
                  <th>Contact</th>
                  <th>Scheduled Date</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="loading-cell">Loading receipts from database...</td>
                  </tr>
                ) : filteredReceipts.length > 0 ? (
                  filteredReceipts.map((r) => (
                    <tr 
                      key={r.id} 
                      className="clickable-row"
                      onClick={() => setSelectedReceipt(r)}
                    >
                      <td><strong className="ref-link">{r.reference}</strong></td>
                      <td>
                        <span className="route-loc">
                          {r.source_location_name || 'Vendor'}
                        </span>
                      </td>
                      <td>
                        <span className="route-loc dest">
                          {r.dest_location_name || 'WH/Stock1'}
                        </span>
                      </td>
                      <td>{r.contact || '—'}</td>
                      <td>{r.scheduled_date}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>
                        <span className="badge-tag">
                          {r.lines?.length || 0} line(s)
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="action-row">
                          {r.status !== 'done' && r.status !== 'cancelled' && (
                            <button
                              className="primary-btn small"
                              onClick={() => handleValidate(r)}
                              disabled={validating}
                              title="Validate receipt and increase stock"
                            >
                              <Check size={14} /> Validate
                            </button>
                          )}
                          {r.status === 'done' && (
                            <button
                              className="secondary-btn small"
                              onClick={() => setPrintingMove(r)}
                              title="Print Goods Receipt Voucher"
                            >
                              <Printer size={14} /> Print
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="empty-cell">
                      <ArrowDownLeft size={32} className="muted-icon" />
                      <p>No receipt orders found.</p>
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
          {['draft', 'ready', 'done', 'cancelled'].map((colStatus) => {
            const colMoves = filteredReceipts.filter((r) => r.status === colStatus);
            return (
              <div key={colStatus} className="kanban-col">
                <div className="kanban-col-header">
                  <span className="col-title">{colStatus.toUpperCase()}</span>
                  <span className="col-count">{colMoves.length}</span>
                </div>
                <div className="kanban-cards">
                  {colMoves.map((r) => (
                    <div
                      key={r.id}
                      className="kanban-card"
                      onClick={() => setSelectedReceipt(r)}
                    >
                      <div className="kanban-card-top">
                        <strong className="ref-link">{r.reference}</strong>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="kanban-card-body">
                        <div className="card-info-row">
                          <span>Vendor:</span> <strong>{r.contact}</strong>
                        </div>
                        <div className="card-info-row">
                          <span>To:</span> {r.dest_location_name || 'WH/Stock1'}
                        </div>
                        <div className="card-info-row">
                          <span>Date:</span> {r.scheduled_date}
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

      {/* Receipt Detail Modal / Drawer */}
      {selectedReceipt && (
        <div className="modal-backdrop" onClick={() => setSelectedReceipt(null)}>
          <div className="modal-card detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="title-with-badge">
                <h3>Receipt Order: {selectedReceipt.reference}</h3>
                <StatusBadge status={selectedReceipt.status} />
              </div>
              <button className="icon-btn" onClick={() => setSelectedReceipt(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Workflow Pipeline Tracker */}
            <div className="tracker-wrap">
              <MoveStatusTracker status={selectedReceipt.status} />
            </div>

            {/* Action Bar */}
            <div className="detail-action-bar">
              {selectedReceipt.status !== 'done' && selectedReceipt.status !== 'cancelled' && (
                <button
                  className="primary-btn"
                  onClick={() => handleValidate(selectedReceipt)}
                  disabled={validating}
                >
                  <Check size={16} /> {validating ? 'Updating Stock...' : 'Validate Receipt'}
                </button>
              )}

              <button
                className="secondary-btn"
                onClick={() => setPrintingMove(selectedReceipt)}
              >
                <Printer size={16} /> Print Slip
              </button>

              {selectedReceipt.status !== 'done' && selectedReceipt.status !== 'cancelled' && (
                <button
                  className="danger-btn"
                  onClick={() => handleCancel(selectedReceipt)}
                  disabled={cancelling}
                >
                  <Ban size={16} /> Cancel
                </button>
              )}
            </div>

            {/* Order Metadata */}
            <div className="order-details-grid">
              <div className="detail-field">
                <label>Vendor / Source</label>
                <div className="val">{selectedReceipt.contact || 'Standard Vendor'}</div>
              </div>
              <div className="detail-field">
                <label>Destination Location</label>
                <div className="val">{selectedReceipt.dest_location_name || 'Main Stock (WH/Stock1)'}</div>
              </div>
              <div className="detail-field">
                <label>Scheduled Date</label>
                <div className="val">{selectedReceipt.scheduled_date}</div>
              </div>
              <div className="detail-field">
                <label>Validation Timestamp</label>
                <div className="val">
                  {selectedReceipt.validated_at
                    ? new Date(selectedReceipt.validated_at).toLocaleString()
                    : 'Not validated yet'}
                </div>
              </div>
            </div>

            {/* Product Lines */}
            <div className="lines-section">
              <h4>Received Items</h4>
              <table className="lines-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReceipt.lines?.map((line, idx) => (
                    <tr key={line.id || idx}>
                      <td><strong>{line.product_name || `Product #${line.product_id}`}</strong></td>
                      <td><span className="sku-badge">{line.product_sku || '—'}</span></td>
                      <td>{line.unit_of_measure || 'unit'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{line.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-footer">
              <button className="secondary-btn" onClick={() => setSelectedReceipt(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Receipt Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => !creating && setShowCreateModal(false)}>
          <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Inbound Receipt</h3>
              <button className="icon-btn" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              {createError && (
                <div className="form-alert error">
                  <AlertCircle size={16} />
                  <span>{createError}</span>
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label>Warehouse *</label>
                  <select
                    value={selectedWhId}
                    onChange={(e) => setSelectedWhId(e.target.value)}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id.toString()}>
                        {w.name} ({w.short_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Vendor / Supplier Contact *</label>
                  <input
                    type="text"
                    required
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="e.g. Azure Interior, Deco Addict"
                  />
                </div>

                <div className="form-group">
                  <label>Destination Stock Location *</label>
                  <select
                    value={destLocationId}
                    onChange={(e) => setDestLocationId(e.target.value)}
                    required
                  >
                    {locations
                      .filter((l) => !l.is_virtual)
                      .map((loc) => (
                        <option key={loc.id} value={loc.id.toString()}>
                          {loc.name} ({loc.short_code})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Scheduled Delivery Date</label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Product Lines Section */}
              <div className="lines-builder">
                <div className="lines-header">
                  <h4>Product Lines</h4>
                  <button type="button" className="secondary-btn small" onClick={addLine}>
                    <Plus size={14} /> Add Line
                  </button>
                </div>

                <table className="lines-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60%' }}>Product</th>
                      <th style={{ width: '30%' }}>Quantity</th>
                      <th style={{ width: '10%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx}>
                        <td>
                          <select
                            value={line.product_id}
                            onChange={(e) =>
                              updateLine(idx, 'product_id', parseInt(e.target.value, 10))
                            }
                            required
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku}) — In Stock: {p.on_hand_qty}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) =>
                              updateLine(idx, 'quantity', parseFloat(e.target.value) || 1)
                            }
                            required
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="icon-btn delete"
                            onClick={() => removeLine(idx)}
                            disabled={lines.length === 1}
                            title="Remove line"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={creating}>
                  {creating ? 'Creating Reference...' : 'Generate Receipt'}
                </button>
              </div>
            </form>
          </div>
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
