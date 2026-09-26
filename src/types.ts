export interface Product {
  id: number;
  sku: string;
  name: string;
  category_id?: number | null;
  category_name?: string | null;
  unit_of_measure: string;
  cost_per_unit: number;
  reorder_point: number;
  created_at?: string;
  on_hand_qty: number;
  reserved_qty: number;
  free_to_use: number;
}

export interface ProductCategory {
  id: number;
  name: string;
}

export interface Warehouse {
  id: number;
  name: string;
  short_code: string;
  address?: string;
  internal_location_count?: number;
  total_location_count?: number;
}

export interface Location {
  id: number;
  warehouse_id: number;
  warehouse_name?: string;
  warehouse_code?: string;
  name: string;
  short_code: string;
  is_virtual: boolean;
}

export interface MoveLine {
  id?: number;
  product_id: number;
  product_sku?: string;
  product_name?: string;
  unit_of_measure?: string;
  quantity: number;
}

export interface StockMove {
  id: number;
  reference: string;
  move_type: 'receipt' | 'delivery' | 'internal' | 'adjustment';
  source_location_id: number | null;
  source_location_name?: string | null;
  dest_location_id: number | null;
  dest_location_name?: string | null;
  contact?: string | null;
  scheduled_date: string;
  responsible_user_id?: number | null;
  responsible_name?: string | null;
  status: 'draft' | 'waiting' | 'ready' | 'done' | 'cancelled';
  validated_at?: string | null;
  created_at: string;
  lines: MoveLine[];
}

export interface DashboardStats {
  toReceive: number;
  toReceiveLate: number;
  toReceiveOps: number;
  toDeliver: number;
  toDeliverLate: number;
  toDeliverWaiting: number;
  toDeliverOps: number;
  internalTransfers: number;
  completedMoves: number;
  totalMoves: number;
}

export interface LowStockItem {
  productId: number;
  sku: string;
  productName: string;
  locationName: string;
  onHandQty: number;
  reservedQty: number;
  freeToUse: number;
  reorderPoint: number;
}

export interface StockItem {
  id: number;
  sku: string;
  name: string;
  unitOfMeasure: string;
  costPerUnit: number;
  reorderPoint: number;
  onHandQty: number;
  reservedQty: number;
  freeToUse: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
