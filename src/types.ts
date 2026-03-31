export interface SaleEntry {
  date: string;
  amount: number;
  orders: number;
  location: string;
  notes?: string;
}

export interface ItemSale {
  itemName: string;
  category: string;
  quantity: number;
  revenue: number;
  location: string;
}

export interface BusinessAlert {
  date: string;
  title: string;
  type: 'holiday' | 'tamil-special' | 'event';
  description: string;
  recommendation: string;
}

export interface AIInsight {
  type: 'growth' | 'efficiency' | 'marketing';
  title: string;
  content: string;
}

export interface MenuInsight {
  itemName: string;
  action: 'promote' | 'remove' | 'optimize';
  reason: string;
  suggestion: string;
  location: string;
}
