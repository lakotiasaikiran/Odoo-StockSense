import React from 'react';
import { StockMove } from '../types';
import { Printer, X } from 'lucide-react';

interface PrintSlipModalProps {
  move: StockMove | null;
  onClose: () => void;
}

export const PrintSlipModal: React.FC<PrintSlipModalProps> = ({ move, onClose }) => {
  if (!move) return null;

  const handlePrint = () => {
    window.print();
  };

  const isReceipt = move.move_type === 'receipt';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card print-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header no-print">
          <h3>
            {isReceipt ? 'Goods Receipt Voucher' : 'Delivery / Packing Slip'} — {move.reference}
          </h3>
          <div className="header-actions">
            <button className="primary-btn" onClick={handlePrint}>
              <Printer size={16} /> Print Document
            </button>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="print-content" id="printable-slip">
          <div className="slip-brand">
            <div>
              <h2>StockSense Enterprise</h2>
              <p>Warehouse & Supply Chain Operations</p>
            </div>
            <div className="slip-meta">
              <div className="slip-ref">{move.reference}</div>
              <div className="slip-date">Date: {move.scheduled_date}</div>
              <div className="slip-status">Status: {move.status.toUpperCase()}</div>
            </div>
          </div>

          <hr className="slip-divider" />

          <div className="slip-info-grid">
            <div className="info-block">
              <label>{isReceipt ? 'Vendor / Source:' : 'Origin Warehouse Location:'}</label>
              <div className="val">{isReceipt ? move.contact : (move.source_location_name || 'Main Warehouse')}</div>
            </div>
            <div className="info-block">
              <label>{isReceipt ? 'Destination Stock Location:' : 'Customer / Destination:'}</label>
              <div className="val">{isReceipt ? (move.dest_location_name || 'Stock') : move.contact}</div>
            </div>
            <div className="info-block">
              <label>Responsible Staff:</label>
              <div className="val">{move.responsible_name || 'Warehouse Staff'}</div>
            </div>
            <div className="info-block">
              <label>Validated At:</label>
              <div className="val">{move.validated_at ? new Date(move.validated_at).toLocaleString() : 'Pending'}</div>
            </div>
          </div>

          <table className="slip-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item / SKU</th>
                <th>Description</th>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {move.lines?.map((line, idx) => (
                <tr key={line.id || idx}>
                  <td>{idx + 1}</td>
                  <td><strong>{line.product_sku || `PROD-${line.product_id}`}</strong></td>
                  <td>{line.product_name}</td>
                  <td>{line.unit_of_measure || 'unit'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{line.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="slip-signatures">
            <div className="sig-box">
              <div className="sig-line" />
              <span>Received By (Signature)</span>
            </div>
            <div className="sig-box">
              <div className="sig-line" />
              <span>Authorized Storekeeper</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
