// Shared types for BoxPlay app

export interface Box {
  id: string;
  name: string;
  price: number;
}

export interface Prize {
  id: string;
  name: string;
  image?: string;
  value: number;
}

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  date: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  totalEarnings: number;
  balance: number;
}

export interface Notification {
  id: string;
  icon: string;
  message: string;
  date: string;
}
