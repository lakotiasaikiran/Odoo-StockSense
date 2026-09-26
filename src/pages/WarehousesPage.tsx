import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Warehouse, Location } from '../types';
import { Plus, Warehouse as WhIcon, MapPin, Edit2, Trash2, X, AlertCircle, RefreshCw } from 'lucide-react';

interface WarehousesPageProps {
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const WarehousesPage: React.FC<WarehousesPageProps> = ({ onShowToast }) => {
  const [activeTab, setActiveTab] = useState<'warehouses' | 'locations'>('warehouses');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Warehouse Modal
  const [showWhModal, setShowWhModal] = useState(false);
  const [editingWh, setEditingWh] = useState<Warehouse | null>(null);
  const [whName, setWhName] = useState('');
  const [whShortCode, setWhShortCode] = useState('');
  const [whAddress, setWhAddress] = useState('');

  // Location Modal
  const [showLocModal, setShowLocModal] = useState(false);
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);
  const [locWhId, setLocWhId] = useState<string>('');
  const [locName, setLocName] = useState('');
  const [locShortCode, setLocShortCode] = useState('');
  const [locIsVirtual, setLocIsVirtual] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [whs, locs] = await Promise.all([
        api.getWarehouses(),
        api.getLocations(),
      ]);
      setWarehouses(whs);
      setLocations(locs);
      if (whs.length > 0 && !locWhId) {
        setLocWhId(whs[0].id.toString());
      }
    } catch (err: any) {
      onShowToast('error', `Failed to load settings: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Warehouse Handlers
  const openCreateWh = () => {
    setEditingWh(null);
    setWhName('');
    setWhShortCode('WH' + (warehouses.length + 1));
    setWhAddress('');
    setFormError(null);
    setShowWhModal(true);
  };

  const openEditWh = (wh: Warehouse) => {
    setEditingWh(wh);
    setWhName(wh.name);
    setWhShortCode(wh.short_code);
    setWhAddress(wh.address || '');
    setFormError(null);
    setShowWhModal(true);
  };

  const handleWhSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim() || !whShortCode.trim()) {
      setFormError('Warehouse Name and Short Code are required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      if (editingWh) {
        await api.updateWarehouse(editingWh.id, {
          name: whName.trim(),
          short_code: whShortCode.trim().toUpperCase(),
          address: whAddress.trim(),
        });
        onShowToast('success', `Warehouse "${whName}" updated successfully!`);
      } else {
        await api.createWarehouse({
          name: whName.trim(),
          short_code: whShortCode.trim().toUpperCase(),
          address: whAddress.trim(),
        });
        onShowToast('success', `Warehouse "${whName}" created with default Vendor/Customer/Stock locations!`);
      }
      setShowWhModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save warehouse.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWh = async (wh: Warehouse) => {
    if (!confirm(`Are you sure you want to delete warehouse "${wh.name}"? This will delete all its internal locations.`)) return;
    try {
      await api.deleteWarehouse(wh.id);
      onShowToast('success', `Warehouse "${wh.name}" deleted.`);
      loadData();
    } catch (err: any) {
      onShowToast('error', `Failed to delete warehouse: ${err.message}`);
    }
  };

  // Location Handlers
  const openCreateLoc = () => {
    setEditingLoc(null);
    setLocWhId(warehouses.length > 0 ? warehouses[0].id.toString() : '');
    setLocName('');
    setLocShortCode('RACK-' + Math.floor(10 + Math.random() * 90));
    setLocIsVirtual(false);
    setFormError(null);
    setShowLocModal(true);
  };

  const handleLocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locName.trim() || !locShortCode.trim() || !locWhId) {
      setFormError('Warehouse, Name, and Short Code are required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await api.createLocation({
        warehouse_id: parseInt(locWhId, 10),
        name: locName.trim(),
        short_code: locShortCode.trim().toUpperCase(),
        is_virtual: locIsVirtual,
      });
      onShowToast('success', `Location "${locName}" created successfully!`);
      setShowLocModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create location.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLoc = async (loc: Location) => {
    if (!confirm(`Are you sure you want to delete location "${loc.name}"?`)) return;
    try {
      await api.deleteLocation(loc.id);
      onShowToast('success', `Location "${loc.name}" deleted.`);
      loadData();
    } catch (err: any) {
      onShowToast('error', `Failed to delete location: ${err.message}`);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div>
          <div className="crumb">Settings / Warehouse Topology</div>
          <h1>Warehouses & Locations</h1>
        </div>
        <div className="header-actions">
          <button className="secondary-btn" onClick={loadData} title="Refresh data">
            <RefreshCw size={15} /> Refresh
          </button>
          {activeTab === 'warehouses' ? (
            <button className="primary-btn" onClick={openCreateWh}>
              <Plus size={16} /> New Warehouse
            </button>
          ) : (
            <button className="primary-btn" onClick={openCreateLoc}>
              <Plus size={16} /> New Location
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs-header">
        <button
          className={`tab-btn ${activeTab === 'warehouses' ? 'active' : ''}`}
          onClick={() => setActiveTab('warehouses')}
        >
          <WhIcon size={16} /> Warehouses ({warehouses.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'locations' ? 'active' : ''}`}
          onClick={() => setActiveTab('locations')}
        >
          <MapPin size={16} /> Locations ({locations.length})
        </button>
      </div>

      {/* Warehouses Table */}
      {activeTab === 'warehouses' && (
        <div className="panel card-panel">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Warehouse Name</th>
                  <th>Short Code</th>
                  <th>Address</th>
                  <th>Internal Locations</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="loading-cell">Loading warehouses...</td>
                  </tr>
                ) : warehouses.length > 0 ? (
                  warehouses.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <div className="wh-cell">
                          <div className="wh-icon-wrap"><WhIcon size={18} /></div>
                          <strong>{w.name}</strong>
                        </div>
                      </td>
                      <td><span className="sku-badge">{w.short_code}</span></td>
                      <td>{w.address || '—'}</td>
                      <td>
                        <span className="badge-tag">
                          {w.internal_location_count ?? 0} active zones
                        </span>
                      </td>
                      <td>
                        <div className="action-row">
                          <button
                            className="icon-btn edit"
                            onClick={() => openEditWh(w)}
                            title="Edit Warehouse"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className="icon-btn delete"
                            onClick={() => handleDeleteWh(w)}
                            title="Delete Warehouse"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="empty-cell">No warehouses configured.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Locations Table */}
      {activeTab === 'locations' && (
        <div className="panel card-panel">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Location Name</th>
                  <th>Short Code</th>
                  <th>Warehouse</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="loading-cell">Loading locations...</td>
                  </tr>
                ) : locations.length > 0 ? (
                  locations.map((loc) => (
                    <tr key={loc.id}>
                      <td>
                        <div className="loc-cell">
                          <MapPin size={16} className={loc.is_virtual ? 'text-muted' : 'text-purple'} />
                          <strong>{loc.name}</strong>
                        </div>
                      </td>
                      <td><span className="sku-badge">{loc.short_code}</span></td>
                      <td>{loc.warehouse_name || 'Main Warehouse'}</td>
                      <td>
                        <span className={`status-tag ${loc.is_virtual ? 'tag-draft' : 'tag-ready'}`}>
                          {loc.is_virtual ? 'Virtual (Vendor/Customer)' : 'Physical Stock Rack'}
                        </span>
                      </td>
                      <td>
                        {!loc.is_virtual && (
                          <div className="action-row">
                            <button
                              className="icon-btn delete"
                              onClick={() => handleDeleteLoc(loc)}
                              title="Delete Location"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="empty-cell">No locations configured.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Warehouse Modal */}
      {showWhModal && (
        <div className="modal-backdrop" onClick={() => !submitting && setShowWhModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingWh ? 'Edit Warehouse' : 'New Warehouse'}</h3>
              <button className="icon-btn" onClick={() => setShowWhModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleWhSubmit}>
              {formError && (
                <div className="form-alert error">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label>Warehouse Name *</label>
                  <input
                    type="text"
                    required
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    placeholder="e.g. North Distribution Center"
                  />
                </div>

                <div className="form-group">
                  <label>Short Code * (e.g. WH, NDC)</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={whShortCode}
                    onChange={(e) => setWhShortCode(e.target.value)}
                    placeholder="e.g. NDC"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Physical Address</label>
                  <textarea
                    rows={3}
                    value={whAddress}
                    onChange={(e) => setWhAddress(e.target.value)}
                    placeholder="Street, City, Postal Code"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowWhModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? 'Saving...' : editingWh ? 'Update Warehouse' : 'Create Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {showLocModal && (
        <div className="modal-backdrop" onClick={() => !submitting && setShowLocModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Location</h3>
              <button className="icon-btn" onClick={() => setShowLocModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLocSubmit}>
              {formError && (
                <div className="form-alert error">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label>Warehouse *</label>
                  <select
                    value={locWhId}
                    onChange={(e) => setLocWhId(e.target.value)}
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id.toString()}>
                        {w.name} ({w.short_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Location Name *</label>
                  <input
                    type="text"
                    required
                    value={locName}
                    onChange={(e) => setLocName(e.target.value)}
                    placeholder="e.g. Rack C, Shelf 4"
                  />
                </div>

                <div className="form-group">
                  <label>Short Code *</label>
                  <input
                    type="text"
                    required
                    value={locShortCode}
                    onChange={(e) => setLocShortCode(e.target.value)}
                    placeholder="e.g. RC-4"
                  />
                </div>

                <div className="form-group">
                  <label>Location Type</label>
                  <select
                    value={locIsVirtual ? 'virtual' : 'internal'}
                    onChange={(e) => setLocIsVirtual(e.target.value === 'virtual')}
                  >
                    <option value="internal">Physical Stock Location</option>
                    <option value="virtual">Virtual Location (Vendor/Customer)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowLocModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
