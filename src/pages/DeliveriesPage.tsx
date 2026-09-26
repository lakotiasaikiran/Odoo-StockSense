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
  ArrowUpRight, 
  List, 
  LayoutGrid,
  Trash2,
  AlertTriangle
} from 'lucide-react';

interface DeliveriesPageProps {
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
  openCreateImmediately?: boolean;
}

export const DeliveriesPage: React.FC<DeliveriesPageProps> = ({ onShowToast, openCreateImmediately }) => {
  const [deliveries, setDeliveries] = useState<StockMove[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Detail Modal
  const [selectedDelivery, setSelectedDelivery] = useState<StockMove | null>(null);
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
  const [contact, setContact] = useState('Tech Solutions Corp');
  const [sourceLocationId, setSourceLocationId] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [lines, setLines] = useState<{ product_id: number; quantity: number }[]>([
    { product_id: 0, quantity: 2 },
  ]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dels, prods, locs, whs] = await Promise.all([
        api.getDeliveries(),
        api.getProducts(),
        api.getLocations(),
        api.getWarehouses(),
      ]);
      setDeliveries(dels);
      setProducts(prods);
      setLocations(locs);
      setWarehouses(whs);

      if (whs.length > 0 && !selectedWhId) {
        setSelectedWhId(whs[0].id.toString());
      }

      const stockLoc = locs.find((l) => !l.is_virtual);
      if (stockLoc && !sourceLocationId) {
        setSourceLocationId(stockLoc.id.toString());
      }
      if (prods.length > 0 && lines[0].product_id === 0) {
        setLines([{ product_id: prods[0].id, quantity: 2 }]);
      }
    } catch (err: any) {
      onShowToast('error', `Failed to load deliveries: ${err.message}`);
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

  // Validate Delivery (checks stock, decreases stock)
  const handleValidate = async (delivery: StockMove) => {
    setValidating(true);
    try {
      const res = await api.validateDelivery(delivery.id);
      onShowToast('success', res.message);
      setSelectedDelivery(res.move);
      loadData();
    } catch (err: any) {
      onShowToast('error', `Validation rejected: ${err.message}`);
      loadData(); // Reload because status might have updated to 'waiting'
    } finally {
      setValidating(false);
    }
  };

  // Cancel Delivery
  const handleCancel = async (delivery: StockMove) => {
    if (!confirm(`Are you sure you want to cancel delivery ${delivery.reference}?`)) return;
    setCancelling(true);
    try {
      const res = await api.cancelDelivery(delivery.id);
      onShowToast('info', res.message);
      setSelectedDelivery(res.move);
      loadData();
    } catch (err: any) {
      onShowToast('error', `Failed to cancel delivery: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  // Create Delivery
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceLocationId) {
      setCreateError('Please select a source warehouse stock location.');
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
      const newMove = await api.createDelivery({
        warehouse_id: selectedWhId ? parseInt(selectedWhId, 10) : undefined,
        source_location_id: parseInt(sourceLocationId, 10),
        contact: contact.trim() || 'Customer',
        scheduled_date: scheduledDate,
        lines: validLines,
      });

      if (newMove.status === 'waiting') {
        onShowToast('info', `Delivery ${newMove.reference} created with status WAITING (insufficient stock at source).`);
      } else {
        onShowToast('success', `Delivery ${newMove.reference} created with status READY!`);
      }

      setShowCreateModal(false);
      await loadData();
      setSelectedDelivery(newMove);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create delivery.');
    } finally {
      setCreating(false);
    }
  };

  // Line helpers
  const addLine = () => {
    const defaultProdId = products.length > 0 ? products[0].id : 0;
    setLines([...lines, { product_id: defaultProdId, quantity: 1 }]);
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

  const getProductStock = (prodId: number) => {
    const p = products.find((x) => x.id === prodId);
    return p ? p.free_to_use : 0;
  };

  const filteredDeliveries = deliveries.filter((d) => {
    const matchesSearch =
      d.reference.toLowerCase().includes(search.toLowerCase()) ||
      (d.contact && d.contact.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div>
          <div className="crumb">Operations / Outbound Logistics</div>
          <h1>Deliveries (Goods Out)</h1>
        </div>
        <div className="header-actions">
          <button className="secondary-btn" onClick={loadData} title="Refresh deliveries list">
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
            <Plus size={16} /> New Delivery
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="table-toolbar">
        <div className="search-bar">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by reference (e.g. WH/OUT/0001) or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses ({deliveries.length})</option>
            <option value="ready">Ready for Dispatch</option>
            <option value="waiting">Waiting for Stock</option>
            <option value="draft">Draft</option>
            <option value="done">Dispatched (Done)</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Content View */}
      {viewMode === 'list' ? (
        <div className="panel card-panel">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Source Location</th>
                  <th>Delivery Address / Customer</th>
                  <th>Scheduled Date</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="loading-cell">Loading deliveries from database...</td>
                  </tr>
                ) : filteredDeliveries.length > 0 ? (
                  filteredDeliveries.map((d) => (
                    <tr 
                      key={d.id} 
                      className="clickable-row"
                      onClick={() => setSelectedDelivery(d)}
                    >
                      <td><strong className="ref-link">{d.reference}</strong></td>
                      <td>
                        <span className="route-loc">
                          {d.source_location_name || 'WH/Stock1'}
                        </span>
                      </td>
                      <td><strong>{d.contact || 'Customer'}</strong></td>
                      <td>{d.scheduled_date}</td>
                      <td><StatusBadge status={d.status} /></td>
                      <td>
                        <span className="badge-tag">
                          {d.lines?.length || 0} line(s)
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="action-row">
                          {d.status !== 'done' && d.status !== 'cancelled' && (
                            <button
                              className="primary-btn small"
                              onClick={() => handleValidate(d)}
                              disabled={validating}
                              title="Validate delivery and deduct stock"
                            >
                              <Check size={14} /> Validate
                            </button>
                          )}
                          {d.status === 'done' && (
                            <button
                              className="secondary-btn small"
                              onClick={() => setPrintingMove(d)}
                              title="Print Delivery / Packing Slip"
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
                    <td colSpan={7} className="empty-cell">
                      <ArrowUpRight size={32} className="muted-icon" />
                      <p>No delivery orders found.</p>
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
          {['draft', 'waiting', 'ready', 'done'].map((colStatus) => {
            const colMoves = filteredDeliveries.filter((d) => d.status === colStatus);
            return (
              <div key={colStatus} className="kanban-col">
                <div className="kanban-col-header">
                  <span className="col-title">{colStatus.toUpperCase()}</span>
                  <span className="col-count">{colMoves.length}</span>
                </div>
                <div className="kanban-cards">
                  {colMoves.map((d) => (
                    <div
                      key={d.id}
                      className="kanban-card"
                      onClick={() => setSelectedDelivery(d)}
                    >
                      <div className="kanban-card-top">
                        <strong className="ref-link">{d.reference}</strong>
                        <StatusBadge status={d.status} />
                      </div>
                      <div className="kanban-card-body">
                        <div className="card-info-row">
                          <span>Customer:</span> <strong>{d.contact}</strong>
                        </div>
                        <div className="card-info-row">
                          <span>From:</span> {d.source_location_name || 'Stock'}
                        </div>
                        <div className="card-info-row">
                          <span>Date:</span> {d.scheduled_date}
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

      {/* Delivery Detail Modal */}
      {selectedDelivery && (
        <div className="modal-backdrop" onClick={() => setSelectedDelivery(null)}>
          <div className="modal-card detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="title-with-badge">
                <h3>Delivery Order: {selectedDelivery.reference}</h3>
                <StatusBadge status={selectedDelivery.status} />
              </div>
              <button className="icon-btn" onClick={() => setSelectedDelivery(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Workflow Tracker */}
            <div className="tracker-wrap">
              <MoveStatusTracker status={selectedDelivery.status} isDelivery />
            </div>

            {/* In-stock warning alert if status is waiting */}
            {selectedDelivery.status === 'waiting' && (
              <div className="form-alert warning">
                <AlertTriangle size={18} />
                <div>
                  <strong>Stock Shortage Detected!</strong>
                  <p>One or more product lines exceed current free stock at origin location. Replenish stock to proceed with validation.</p>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="detail-action-bar">
              {selectedDelivery.status !== 'done' && selectedDelivery.status !== 'cancelled' && (
                <button
                  className="primary-btn"
                  onClick={() => handleValidate(selectedDelivery)}
                  disabled={validating}
                >
                  <Check size={16} /> {validating ? 'Verifying & Deducting...' : 'Validate Delivery'}
                </button>
              )}

              <button
                className="secondary-btn"
                onClick={() => setPrintingMove(selectedDelivery)}
              >
                <Printer size={16} /> Print Slip
              </button>

              {selectedDelivery.status !== 'done' && selectedDelivery.status !== 'cancelled' && (
                <button
                  className="danger-btn"
                  onClick={() => handleCancel(selectedDelivery)}
                  disabled={cancelling}
                >
                  <Ban size={16} /> Cancel
                </button>
              )}
            </div>

            {/* Metadata */}
            <div className="order-details-grid">
              <div className="detail-field">
                <label>Customer / Destination</label>
                <div className="val">{selectedDelivery.contact || 'Customer'}</div>
              </div>
              <div className="detail-field">
                <label>Origin Stock Location</label>
                <div className="val">{selectedDelivery.source_location_name || 'Main Stock (WH/Stock1)'}</div>
              </div>
              <div className="detail-field">
                <label>Scheduled Date</label>
                <div className="val">{selectedDelivery.scheduled_date}</div>
              </div>
              <div className="detail-field">
                <label>Dispatch Timestamp</label>
                <div className="val">
                  {selectedDelivery.validated_at
                    ? new Date(selectedDelivery.validated_at).toLocaleString()
                    : 'Awaiting validation'}
                </div>
              </div>
            </div>

            {/* Product Lines */}
            <div className="lines-section">
              <h4>Ordered Items & Availability</h4>
              <table className="lines-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Required Qty</th>
                    <th>Free Stock Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDelivery.lines?.map((line, idx) => {
                    const freeStock = getProductStock(line.product_id);
                    const isShortage = selectedDelivery.status !== 'done' && freeStock < line.quantity;
                    return (
                      <tr key={line.id || idx} className={isShortage ? 'row-shortage' : ''}>
                        <td>
                          <strong>{line.product_name || `Product #${line.product_id}`}</strong>
                          {isShortage && (
                            <span className="shortage-notice">
                              <AlertTriangle size={12} /> Insufficient stock!
                            </span>
                          )}
                        </td>
                        <td><span className="sku-badge">{line.product_sku || '—'}</span></td>
                        <td><strong>{line.quantity}</strong> {line.unit_of_measure || 'unit'}</td>
                        <td>
                          {selectedDelivery.status === 'done' ? (
                            <span className="badge-tag success">Fulfilled from Stock</span>
                          ) : isShortage ? (
                            <span className="badge-tag danger">Available: {freeStock} (Short by {line.quantity - freeStock})</span>
                          ) : (
                            <span className="badge-tag success">Available ({freeStock} in stock)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="modal-footer">
              <button className="secondary-btn" onClick={() => setSelectedDelivery(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Delivery Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => !creating && setShowCreateModal(false)}>
          <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Outbound Delivery</h3>
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
                  <label>Customer / Delivery Contact *</label>
                  <input
                    type="text"
                    required
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="e.g. Azure Interior, Global Tech"
                  />
                </div>

                <div className="form-group">
                  <label>Origin Stock Location *</label>
                  <select
                    value={sourceLocationId}
                    onChange={(e) => setSourceLocationId(e.target.value)}
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
                  <h4>Product Lines to Dispatch</h4>
                  <button type="button" className="secondary-btn small" onClick={addLine}>
                    <Plus size={14} /> Add Line
                  </button>
                </div>

                <table className="lines-table">
                  <thead>
                    <tr>
                      <th style={{ width: '55%' }}>Product</th>
                      <th style={{ width: '25%' }}>Quantity</th>
                      <th style={{ width: '20%' }}>Stock Available</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => {
                      const freeStock = getProductStock(line.product_id);
                      const isLow = freeStock < line.quantity;
                      return (
                        <tr key={idx} className={isLow ? 'row-shortage' : ''}>
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
                                  {p.name} ({p.sku})
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
                            <span className={`stock-check ${isLow ? 'danger' : 'ok'}`}>
                              {freeStock} units
                            </span>
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
                      );
                    })}
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
                  {creating ? 'Creating Reference...' : 'Create Delivery'}
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
