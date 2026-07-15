export type TransactionType = 'income' | 'expense' | 'saving' | 'investment';

export interface Transaction {
  id: string;
  userId: string;
  transitionId: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  date: string;
  account?: 'cash' | 'bank' | 'upi' | 'invest';
  savingTag?: string;
  transferId?: string;
  partnerAccountId?: string;
  isRecurring: boolean;
  recurringId?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerAccount {
  id: string;
  userId: string;
  transitionId: string;
  name: string;
  type: string;
  group: 'customer' | 'vendor' | 'contact';
  description: string;
  budgetWindowStart: string;
  budgetWindowEnd: string;
  initialInvestment: number;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTx {
  id: string;
  userId: string;
  transitionId: string;
  title: string;
  amount: number;
  category: string;
  txType: 'income' | 'expense';
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  customIntervalDays?: number;
  startDate: string;
  endDate?: string;
  status: 'active' | 'stopped';
  nextDate: string;
  reminderDays: number;
  deletedAt?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  transitionId: string;
  category: string;
  limit: number;
  period: 'monthly' | 'yearly';
  deletedAt?: string;
  createdAt: string;
}

export type ReminderFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';

export interface Reminder {
  id: string;
  userId: string;
  transitionId: string;
  title: string;
  description: string;
  dueDate: string;
  category: string;
  amount: number;
  frequency: ReminderFrequency;
  status: 'pending' | 'completed';
  deletedAt?: string;
  createdAt: string;
}

export interface Adjustment {
  id: string;
  userId: string;
  transitionId: string;
  amount: number;
  accountType: 'personal' | 'partner';
  partnerAccountId?: string;
  notes: string;
  date: string;
  deletedAt?: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  transitionId: string;
  name: string;
  target: number;
  saved: number;
  deletedAt?: string;
  createdAt: string;
}

export type TodoPriority = 'low' | 'medium' | 'high';

export interface Todo {
  id: string;
  userId: string;
  transitionId: string;
  title: string;
  description: string;
  dueDate: string;
  category: string;
  amount?: number;
  priority: TodoPriority;
  important: boolean;
  status: 'pending' | 'completed';
  completedAt?: string;
  createdAt: string;
  deletedAt?: string;
}

export type ArchiveItemType = 'transaction' | 'recurring' | 'reminder' | 'partner' | 'budget' | 'adjustment' | 'goal' | 'todo';

export interface ArchivedItem {
  id: string;
  type: ArchiveItemType;
  label: string;
  subtitle: string;
  amount: number;
  deletedAt: string;
  original: any;
}

export interface UserProfile {
  id: string;
  full_name: string;
  currency: string;
  onboarding_completed: boolean;
  email?: string;
  phone?: string;
  monthly_income?: string;
  primary_goal?: string;
  occupation?: string;
  business_name?: string;
  business_type?: string;
  terms_accepted?: boolean;
}

export type MutationAction = 'created' | 'updated' | 'deleted' | 'restored' | 'toggled' | 'completed' | 'permanent_deleted' | 'advanced';

export interface MutationLog {
  id: string;
  transitionId: string;
  entityType: string;
  entityId: string;
  action: MutationAction;
  timestamp: string;
  userId: string;
  detail?: string;
}
