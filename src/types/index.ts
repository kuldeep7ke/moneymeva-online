export type TransactionType = 'income' | 'expense' | 'investment';

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
  updatedAt: string;
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
  updatedAt: string;
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
  updatedAt: string;
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
  updatedAt: string;
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
  updatedAt: string;
}

export type ArchiveItemType = 'transaction' | 'recurring' | 'reminder' | 'partner' | 'budget' | 'adjustment' | 'goal' | 'work' | 'partnership' | 'partnership_entry';

// ─── Works (कामे) — pending-payment work register ───────────
export type WorkDirection = 'receivable' | 'payable';
export type WorkStatus = 'pending' | 'partial' | 'paid';

export interface WorkPayment {
  id: string;
  date: string;
  amount: number;
  note?: string;
  linkedTransactionId?: string;
}

export interface WorkArea {
  value: number;
  unit: 'acre' | 'hectare' | 'guntha' | 'are';
}

export interface WorkEntry {
  id: string;
  userId: string;
  transitionId: string;
  direction: WorkDirection;          // receivable = my work, payment to receive; payable = hired work, I must pay
  partyId?: string;                  // linked Party
  partnershipId?: string;            // optional Partnership link
  profile: string;                   // WORK_PROFILES key (farmer, farm_services…)
  workType: string;                  // preset key or custom label
  crop?: string;
  season: SeasonType;                // kharif / rabi / summer / annual
  year: number;
  area?: WorkArea;
  startDate: string;                 // YYYY-MM-DD
  endDate?: string;                  // YYYY-MM-DD → durationDays computed when both set
  agreedAmount: number;
  paidAmount: number;                // sum of payments[]
  payments: WorkPayment[];
  dueDate?: string;
  notes?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Partnership (भागीदारी) — shared crop income/expense split ──
export type SeasonType = 'kharif' | 'rabi' | 'summer' | 'annual' | 'custom';

export interface PartnershipMember {
  id: string;
  partyId?: string;                  // optional link to Party
  name: string;                      // display name (from party or free text)
  sharePct: number;                  // agreed share of income & expenses
}

export interface Partnership {
  id: string;
  userId: string;
  transitionId: string;
  title: string;                     // e.g. "Cotton Kharif 2026"
  crop: string;
  season: SeasonType;
  year: number;
  areaValue?: number;
  areaUnit?: 'acre' | 'hectare' | 'guntha' | 'are';
  startDate?: string;
  endDate?: string;
  members: PartnershipMember[];
  notes?: string;
  description?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartnershipEntry {
  id: string;
  userId: string;
  transitionId: string;
  partnershipId: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  date: string;                      // YYYY-MM-DD
  paidByPartyId?: string;            // which member fronted this expense
  linkedTransactionId?: string;      // mirror in main ledger
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

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
  profession?: string;
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
