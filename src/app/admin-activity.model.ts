export type AdminActivityType =
  | 'product_created'
  | 'product_edited'
  | 'stock_adjusted'
  | 'product_status_changed'
  | 'category_changed'
  | 'request_status_changed';

export interface AdminActivity {
  id: string;
  type: AdminActivityType;
  entityType: 'product' | 'category' | 'request';
  entityId: string;
  title: string;
  description: string;
  createdAt: number;
}

export type NewAdminActivity = Omit<AdminActivity, 'id' | 'createdAt'>;
