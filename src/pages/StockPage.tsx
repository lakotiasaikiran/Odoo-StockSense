import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { StockItem, Location } from '../types';
import { Search, RefreshCw, Boxes, Sliders, X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface StockPageProps {
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
  openAdjustProductId?: number | null;
  onClearAdjustProduct?: () => void;
}

export const StockPage: React.FC<StockPageProps> = ({ 
  onShowToast, 
  openAdjustProductId,
  onClearAdjustProduct 
}) => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<StockItem | null>(null);
  const [targetLocationId, setTargetLocationId] = useState<string>('');
  const [newQuantity, setNewQuantity] = useState<string>('0');
  const [adjustReason, setAdjustReason] = useState('Annual Physical Inventory Count');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [items, locs] = await Promise.all([
        api.getStock(),
        api.getLocations({ is_virtual: false }),
      ]);
      setStock(items);
      setLocations(locs);
      if (locs.length > 0 && !targetLocationId) {
        setTargetLocationId(locs[0].id.toString());
      }
    } catch (err: any) {
      onShowToast('error', `Failed to load stock: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (openAdjustProductId && stock.length > 0) {
      const prod = stock.find((s) => s.id === openAdjustProductId);
      if (prod) {
        openAdjustment(prod);
      }
      if (onClearAdjustProduct) onClearAdjustProduct();
    }
  }, [openAdjustProductId, stock]);

  const openAdjustment = (item: StockItem) => {
    setAdjustingProduct(item);
    setNewQuantity(item.onHandQty.toString());
    setAdjustReason('Physical Inventory Count');
    setFormError(null);
    setShowAdjustModal(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct || !targetLocationId) {
      setFormError('Product and location are required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await api.createAdjustment({
        product_id: adjustingProduct.id,
        location_id: parseInt(targetLocationId, 10),
        new_quantity: parseFloat(newQuantity) || 0,
        reason: adjustReason.trim(),
      });

      onShowToast('success', res.message || 'Stock successfully adjusted!');
      setShowAdjustModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to adjust stock.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStock = stock.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div>
          <div className="crumb">Inventory / On-Hand Stock</div>
          <h1>Stock & Free to Use</h1>
        </div>
        <div className="header-actions">
          <button className="secondary-btn" onClick={loadData} title="Refresh live stock">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="table-toolbar">
        <div className="search-bar">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search stock by product name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Stock Table */}
      <div className="panel card-panel">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Per Unit Cost</th>
                <th>On Hand</th>
                <th>Reserved</th>
                <th>Free to Use</th>
                <th>Reorder Threshold</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="loading-cell">Loading stock levels from PostgreSQL...</td>
                </tr>
              ) : filteredStock.length > 0 ? (
                filteredStock.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="prod-cell">
                        <strong>{s.name}</strong>
                      </div>
                    </td>
                    <td><span className="sku-badge">{s.sku}</span></td>
                    <td>${s.costPerUnit.toFixed(2)}</td>
                    <td>
                      <span className={`stock-pill ${s.onHandQty <= s.reorderPoint ? 'low' : 'normal'}`}>
                        {s.onHandQty} {s.unitOfMeasure}
                      </span>
                    </td>
                    <td>{s.reservedQty}</td>
                    <td>
                      <strong className="text-purple">{s.freeToUse}</strong>
                    </td>
                    <td>
                      <span className="reorder-badge">{s.reorderPoint}</span>
                    </td>
                    <td>
                      <button
                        className="secondary-btn small"
                        onClick={() => openAdjustment(s)}
                        title="Update counted stock"
                      >
                        <Sliders size={13} /> Update Stock
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    <Boxes size={32} className="muted-icon" />
                    <p>No products in stock inventory.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {showAdjustModal && adjustingProduct && (
        <div className="modal-backdrop" onClick={() => !submitting && setShowAdjustModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Adjust Stock — {adjustingProduct.name}</h3>
              <button className="icon-btn" onClick={() => setShowAdjustModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit}>
              {formError && (
                <div className="form-alert error">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label>Product</label>
                  <input
                    type="text"
                    disabled
                    value={`${adjustingProduct.name} (${adjustingProduct.sku})`}
                  />
                </div>

                <div className="form-group">
                  <label>Current On Hand</label>
                  <input
                    type="text"
                    disabled
                    value={`${adjustingProduct.onHandQty} ${adjustingProduct.unitOfMeasure}`}
                  />
                </div>

                <div className="form-group">
                  <label>Warehouse Location *</label>
                  <select
                    value={targetLocationId}
                    onChange={(e) => setTargetLocationId(e.target.value)}
                    required
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id.toString()}>
                        {loc.name} ({loc.short_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>New Counted Physical Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Reason / Notes</label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="e.g. Physical stock count reconciliation"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowAdjustModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? 'Applying Adjustment...' : 'Apply Stock Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
