export const PROFESSION_CATEGORIES: Record<string, { income: string[]; expense: string[] }> = {
  salaried: {
    income: ['Salary', 'Freelance', 'Bonus', 'Refund', 'Gift'],
    expense: ['Food', 'Transport', 'Rent', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Education', 'Dining Out', 'Groceries', 'Subscription', 'EMI', 'Insurance', 'Tax'],
  },
  business: {
    income: ['Sales Revenue', 'Client Payment', 'Investment Income', 'Refund'],
    expense: ['Rent', 'Utilities', 'Salary', 'Inventory', 'Marketing', 'Travel', 'Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Dining Out', 'Groceries', 'Subscription', 'EMI', 'Insurance', 'Tax', 'Software'],
  },
  freelancer: {
    income: ['Client Project', 'Consultation', 'Retainer', 'Royalty', 'Refund'],
    expense: ['Software', 'Equipment', 'Travel', 'Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Education', 'Dining Out', 'Groceries', 'Rent', 'Subscription', 'EMI', 'Insurance', 'Tax'],
  },
  student: {
    income: ['Allowance', 'Part-time Job', 'Scholarship', 'Gift', 'Refund'],
    expense: ['Food', 'Transport', 'Rent', 'Education', 'Shopping', 'Entertainment', 'Health', 'Dining Out', 'Groceries', 'Subscription'],
  },
  homemaker: {
    income: ['Allowance', 'Rental Income', 'Gift', 'Refund'],
    expense: ['Food', 'Transport', 'Rent', 'Bills', 'Groceries', 'Shopping', 'Health', 'Education', 'Entertainment', 'Dining Out', 'Subscription'],
  },
  retired: {
    income: ['Pension', 'Investment Income', 'Rental Income', 'Gift', 'Refund'],
    expense: ['Food', 'Transport', 'Rent', 'Bills', 'Health', 'Shopping', 'Entertainment', 'Dining Out', 'Groceries', 'Subscription', 'Insurance'],
  },
  investor: {
    income: ['Dividend', 'Capital Gains', 'Interest', 'Rental Income', 'Refund'],
    expense: ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Dining Out', 'Groceries', 'Subscription', 'Tax', 'Brokerage'],
  },
  medical: {
    income: ['Consultation', 'Procedure', 'Hospital', 'Refund'],
    expense: ['Food', 'Transport', 'Rent', 'Bills', 'Equipment', 'Shopping', 'Entertainment', 'Health', 'Dining Out', 'Groceries', 'Subscription', 'EMI', 'Insurance', 'Tax'],
  },
};

export const DEFAULT_CATEGORIES = {
  income: ['Salary', 'Freelance', 'Business', 'Investment', 'Rental', 'Refund', 'Gift', 'Other'],
  expense: ['Food', 'Transport', 'Rent', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Education', 'Dining Out', 'Groceries', 'Subscription', 'EMI', 'Insurance', 'Tax', 'Other'],
};

export function getDefaultCategories(profession: string | undefined, type: 'income' | 'expense'): string[] {
  const cats = profession && PROFESSION_CATEGORIES[profession] ? PROFESSION_CATEGORIES[profession][type] : DEFAULT_CATEGORIES[type];
  return cats.includes('Other') ? cats : [...cats, 'Other'];
}
