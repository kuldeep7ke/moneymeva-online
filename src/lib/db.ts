import Dexie, { type Table } from 'dexie';
import type { Transaction, PartnerAccount, RecurringTx, Budget, Reminder, Adjustment, Goal, Todo, MutationLog, WorkEntry, Partnership, PartnershipEntry } from '@/types';

export class MoneyMevaDB extends Dexie {
  transactions!: Table<Transaction, string>;
  partners!: Table<PartnerAccount, string>;
  recurring!: Table<RecurringTx, string>;
  budgets!: Table<Budget, string>;
  reminders!: Table<Reminder, string>;
  adjustments!: Table<Adjustment, string>;
  goals!: Table<Goal, string>;
  todos!: Table<Todo, string>;
  works!: Table<WorkEntry, string>;
  partnerships!: Table<Partnership, string>;
  partnership_entries!: Table<PartnershipEntry, string>;
  mutation_log!: Table<MutationLog, string>;

  constructor() {
    super('MoneyMevaDB');
    this.version(4).stores({
      transactions: 'id, type, date, category, userId, deletedAt, account, transitionId',
      partners: 'id, group, userId, deletedAt, transitionId',
      recurring: 'id, txType, status, userId, deletedAt, nextDate, transitionId',
      budgets: 'id, category, userId, deletedAt, transitionId',
      reminders: 'id, status, userId, deletedAt, transitionId',
      adjustments: 'id, accountType, userId, deletedAt, transitionId',
      goals: 'id, name, userId, deletedAt, transitionId',
      todos: 'id, status, category, priority, important, userId, deletedAt, transitionId',
      mutation_log: 'id, transitionId, entityType, entityId, action, timestamp, userId',
    });
    this.version(5).stores({
      works: 'id, direction, partyId, partnershipId, profile, crop, status, userId, deletedAt, transitionId',
      partnerships: 'id, crop, season, year, userId, deletedAt, transitionId',
      partnership_entries: 'id, partnershipId, type, date, paidByPartyId, userId, deletedAt, transitionId',
    });
  }
}

export const db = new MoneyMevaDB();
