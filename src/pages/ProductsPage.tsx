import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Product, ProductCategory, Warehouse, Location } from '../types';
import { Plus, Search, Edit2, Trash2, Package, RefreshCw, X, AlertCircle } from 'lucide-react';

interface ProductsPageProps {
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({ onShowToast }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('unit');
  const [costPerUnit, setCostPerUnit] = useState<string>('0');
  const [reorderPoint, setReorderPoint] = useState<string>('0');
  const [initialStock, setInitialStock] = useState<string>('0');
  const [locationId, setLocationId] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, cats, locs] = await Promise.all([
        api.getProducts(),
        api.getCategories(),
        api.getLocations({ is_virtual: false }),
      ]);
      setProducts(prods);
      setCategories(cats);
      setLocations(locs);
      if (locs.length > 0 && !locationId) {
        setLocationId(locs[0].id.toString());
      }
    } catch (err: any) {
      onShowToast('error', `Failed to load products: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingProduct(null);
    setSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
    setName('');
    setCategoryId(categories.length > 0 ? categories[0].id.toString() : '');
    setUnitOfMeasure('unit');
    setCostPerUnit('100.00');
    setReorderPoint('10');
    setInitialStock('0');
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setSku(p.sku);
    setName(p.name);
    setCategoryId(p.category_id ? p.category_id.toString() : '');
    setUnitOfMeasure(p.unit_of_measure);
    setCostPerUnit(p.cost_per_unit.toString());
    setReorderPoint(p.reorder_point.toString());
    setInitialStock('0');
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim()) {
      setFormError('SKU and Product Name are required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      if (editingProduct) {
        // Update product
        await api.updateProduct(editingProduct.id, {
          sku: sku.trim(),
          name: name.trim(),
          category_id: categoryId ? parseInt(categoryId, 10) : null,
          unit_of_measure: unitOfMeasure.trim(),
          cost_per_unit: parseFloat(costPerUnit) || 0,
          reorder_point: parseFloat(reorderPoint) || 0,
        });
        onShowToast('success', `Product "${name}" updated successfully!`);
      } else {
        // Create product
        await api.createProduct({
          sku: sku.trim(),
          name: name.trim(),
          category_id: categoryId ? parseInt(categoryId, 10) : null,
          unit_of_measure: unitOfMeasure.trim(),
          cost_per_unit: parseFloat(costPerUnit) || 0,
          reorder_point: parseFloat(reorderPoint) || 0,
          initial_stock: parseFloat(initialStock) || 0,
          location_id: locationId ? parseInt(locationId, 10) : undefined,
        });
        onShowToast('success', `Product "${name}" created and saved to PostgreSQL!`);
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Are you sure you want to delete product "${p.name}" (${p.sku})?`)) return;
    try {
      await api.deleteProduct(p.id);
      onShowToast('success', `Product "${p.name}" deleted.`);
      loadData();
    } catch (err: any) {
      onShowToast('error', `Failed to delete product: ${err.message}`);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'all' || p.category_id?.toString() === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div>
          <div className="crumb">Catalog / Master Data</div>
          <h1>Products & Items</h1>
        </div>
        <div className="header-actions">
          <button className="secondary-btn" onClick={loadData} title="Refresh product list">
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="primary-btn" onClick={openCreateModal}>
            <Plus size={16} /> New Product
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="table-toolbar">
        <div className="search-bar">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search products by SKU or Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Category:</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All Categories ({products.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id.toString()}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="panel card-panel">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Cost / Unit</th>
                <th>On Hand</th>
                <th>Free to Use</th>
                <th>Reorder Alert</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="loading-cell">Loading products from PostgreSQL...</td>
                </tr>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td><strong className="sku-badge">{p.sku}</strong></td>
                    <td>
                      <div className="prod-cell">
                        <strong>{p.name}</strong>
                      </div>
                    </td>
                    <td>{p.category_name || 'General'}</td>
                    <td>{p.unit_of_measure}</td>
                    <td>${p.cost_per_unit.toFixed(2)}</td>
                    <td>
                      <span className={`stock-pill ${p.on_hand_qty <= p.reorder_point ? 'low' : 'normal'}`}>
                        {p.on_hand_qty}
                      </span>
                    </td>
                    <td>
                      <strong>{p.free_to_use}</strong>
                    </td>
                    <td>
                      <span className="reorder-badge">{p.reorder_point}</span>
                    </td>
                    <td>
                      <div className="action-row">
                        <button
                          className="icon-btn edit"
                          onClick={() => openEditModal(p)}
                          title="Edit Product"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="icon-btn delete"
                          onClick={() => handleDelete(p)}
                          title="Delete Product"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="empty-cell">
                    <Package size={32} className="muted-icon" />
                    <p>No products found matching criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => !submitting && setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingProduct ? 'Edit Product' : 'New Product'}</h3>
              <button
                className="icon-btn"
                onClick={() => setShowModal(false)}
                disabled={submitting}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {formError && (
                <div className="form-alert error">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label>SKU (Stock Keeping Unit) *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. DESK-01"
                  />
                </div>

                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ergonomic Standing Desk"
                  />
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id.toString()}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Unit of Measure</label>
                  <select
                    value={unitOfMeasure}
                    onChange={(e) => setUnitOfMeasure(e.target.value)}
                  >
                    <option value="unit">Units (pcs)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="box">Boxes</option>
                    <option value="m">Meters</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Cost per Unit ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costPerUnit}
                    onChange={(e) => setCostPerUnit(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Reorder Point Alert</label>
                  <input
                    type="number"
                    min="0"
                    value={reorderPoint}
                    onChange={(e) => setReorderPoint(e.target.value)}
                    title="Alert is triggered when Free Stock falls at or below this value"
                  />
                </div>

                {!editingProduct && (
                  <>
                    <div className="form-group">
                      <label>Initial Opening Stock</label>
                      <input
                        type="number"
                        min="0"
                        value={initialStock}
                        onChange={(e) => setInitialStock(e.target.value)}
                        placeholder="0"
                      />
                    </div>

                    <div className="form-group">
                      <label>Store in Location</label>
                      <select
                        value={locationId}
                        onChange={(e) => setLocationId(e.target.value)}
                      >
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id.toString()}>
                            {loc.name} ({loc.short_code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
