// SEED DATA — Paste this into the browser console (F12) on http://localhost:3000
// Populates every section with realistic data for user/session testing.

(function seed() {
  const KEYS = {
    transactions: 'mm_transactions',
    partners: 'mm_partners',
    recurring: 'mm_recurring',
    budgets: 'mm_budgets',
    reminders: 'mm_reminders',
    adjustments: 'mm_adjustments',
    goals: 'mm_goals',
  };

  const session = JSON.parse(localStorage.getItem('money_meva_session') || 'null');
  const uid = session?.id || 'local-user';

  const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const now = () => new Date().toISOString();
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };
  const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; };
  const pick = (arr, i) => arr[i % arr.length];

  const stamp = (type, category, description, amount, date, partnerAccountId) => ({
    id: id(),
    userId: uid,
    type,
    category,
    description,
    amount,
    date,
    partnerAccountId,
    isRecurring: false,
    createdAt: now(),
    updatedAt: now(),
  });

  // ── PARTNERS (10) ─────────────────────────────────────────
  const partnerRows = [
    ['Village Farm Co-op', 'farm', 'Joint farming investment with local cooperative', 50000],
    ['Tech Startup', 'startup', 'Angel investment in food-tech startup', 100000],
    ['Retail Outlet', 'project', 'Seasonal retail partnership for festival sales', 35000],
    ['Organic Produce Hub', 'farm', 'Bulk produce distribution partner', 42000],
    ['Mobile App Project', 'project', 'Shared cost for product launch', 28000],
    ['Laundry Service', 'other', 'Neighborhood shared service venture', 18000],
    ['Cafe Expansion', 'startup', 'New branch investment pool', 62000],
    ['Solar Rooftop Plan', 'project', 'Renewable energy partnership', 47000],
    ['Grain Storage Unit', 'farm', 'Harvest storage collaboration', 39000],
    ['Logistics Partner', 'other', 'Delivery and transport support', 30000],
  ];
  const partners = partnerRows.map(([name, type, description, initialInvestment], i) => ({
    id: id(),
    userId: uid,
    name,
    type,
    description,
    budgetWindowStart: daysAgo(300 - i * 10),
    budgetWindowEnd: daysFromNow(365 - i * 10),
    initialInvestment,
    createdAt: now(),
    updatedAt: now(),
  }));
  localStorage.setItem(KEYS.partners, JSON.stringify(partners));

  // ── TRANSACTIONS ──────────────────────────────────────────
  const incomeRows = [
    ['Salary', 'Monthly salary', 45000],
    ['Freelance', 'Web development project', 12000],
    ['Business', 'Online store revenue', 15000],
    ['Interest', 'Fixed deposit interest', 2500],
    ['Dividends', 'Stock dividends', 1800],
    ['Rental', 'Apartment rent received', 10000],
    ['Salary', 'Performance bonus', 15000],
    ['Freelance', 'Mobile app development', 25000],
    ['Business', 'Consulting fees', 20000],
    ['Interest', 'Savings account interest', 450],
    ['Dividends', 'Mutual fund payout', 3200],
    ['Rental', 'Parking space rent', 2000],
    ['Salary', 'Annual bonus', 50000],
    ['Freelance', 'Website maintenance', 6000],
    ['Business', 'Weekend market sales', 8400],
  ];

  const expenseRows = [
    ['Rent', 'Monthly apartment rent', 12000],
    ['Groceries', 'Weekly grocery shopping', 3500],
    ['Utilities', 'Electricity bill', 1800],
    ['Transport', 'Fuel', 3000],
    ['Healthcare', 'Medical checkup', 2500],
    ['Entertainment', 'Movie tickets', 600],
    ['Dining', 'Restaurant dinner', 1800],
    ['Shopping', 'Clothing', 5000],
    ['Bills', 'Internet bill', 999],
    ['Insurance', 'Health insurance premium', 5000],
    ['Education', 'Online course', 3000],
    ['Groceries', 'Monthly supplies', 4200],
    ['Utilities', 'Water bill', 600],
    ['Transport', 'Cab rides', 800],
    ['Shopping', 'Electronics', 15000],
  ];

  const savingRows = [
    ['Emergency Fund', 'Monthly emergency fund deposit', 5000],
    ['Goal Savings', 'Vacation fund', 3000],
    ['Goal Savings', 'Down payment savings', 10000],
    ['Retirement', 'Retirement contribution', 8000],
    ['Retirement', 'IRA contribution', 6000],
    ['Education', 'Child education fund', 5000],
    ['Emergency Fund', 'Additional emergency fund', 2000],
    ['Goal Savings', 'New car fund', 7000],
    ['Retirement', 'Index fund SIP', 4500],
    ['Education', 'Certification fund', 2500],
  ];

  const investmentRows = [
    ['Stocks', 'Bought Reliance Industries', 15000],
    ['Stocks', 'Bought TCS shares', 12000],
    ['Mutual Funds', 'SIP - Large Cap Fund', 5000],
    ['Mutual Funds', 'SIP - Mid Cap Fund', 3000],
    ['Fixed Deposit', '1-year FD renewal', 50000],
    ['Gold', 'Digital gold purchase', 5000],
    ['Crypto', 'Bitcoin purchase', 2000],
    ['Real Estate', 'REIT investment', 25000],
    ['Stocks', 'Index fund purchase', 11000],
    ['Gold', 'Gold ETF purchase', 3500],
  ];

  const transactions = [];
  [...incomeRows.map((r, i) => stamp('income', r[0], r[1], r[2], daysAgo(i * 5 + 1))),
   ...expenseRows.map((r, i) => stamp('expense', r[0], r[1], r[2], daysAgo(i * 4 + 2))),
   ...savingRows.map((r, i) => stamp('saving', r[0], r[1], r[2], daysAgo(i * 6 + 3))),
   ...investmentRows.map((r, i) => stamp('investment', r[0], r[1], r[2], daysAgo(i * 7 + 4)))].forEach(t => transactions.push(t));

  // mark 10 archived items while keeping 10+ active entries per section
  [0, 1, 2, 3, 4].forEach(i => { transactions[i].deletedAt = now(); });
  [15, 16, 17, 18, 19].forEach(i => { transactions[i].deletedAt = now(); });
  localStorage.setItem(KEYS.transactions, JSON.stringify(transactions));

  // ── RECURRING (10) ───────────────────────────────────────
  const recurringRows = [
    ['Netflix Subscription', 499, 'Subscription', 'monthly', 180, 5, 3],
    ['Gym Membership', 2000, 'Bills', 'monthly', 90, 10, 2],
    ['Car Insurance Premium', 12000, 'Insurance', 'yearly', 30, 335, 7],
    ['Broadband Bill', 999, 'Bills', 'monthly', 365, 12, 1],
    ['Spotify Plan', 199, 'Premium', 'monthly', 60, 8, 2],
    ['Office Coffee Card', 750, 'Add-ons', 'monthly', 45, 6, 2],
    ['Prepaid Mobile', 349, 'Prepaid', 'monthly', 40, 4, 1],
    ['Credit Card Minimum', 2500, 'Credit Card', 'monthly', 20, 9, 2],
    ['Rent Reminder', 12000, 'Rent', 'monthly', 25, 14, 3],
    ['Cloud Storage', 299, 'Subscription', 'monthly', 70, 11, 2],
  ];
  const recurring = recurringRows.map(([title, amount, category, frequency, startAgo, nextIn, reminderDays]) => ({
    id: id(),
    userId: uid,
    title,
    amount,
    category,
    frequency,
    startDate: daysAgo(startAgo),
    endDate: undefined,
    status: 'active',
    nextDate: daysFromNow(nextIn),
    reminderDays,
    createdAt: now(),
  }));
  localStorage.setItem(KEYS.recurring, JSON.stringify(recurring));

  // ── BUDGETS (10) ─────────────────────────────────────────
  const budgetRows = [
    ['Groceries', 8000], ['Dining', 4000], ['Shopping', 10000], ['Entertainment', 3000], ['Transport', 5000],
    ['Bills', 6500], ['Utilities', 3500], ['Insurance', 7000], ['Healthcare', 4500], ['Education', 6000],
  ];
  const budgets = budgetRows.map(([category, limit]) => ({
    id: id(),
    userId: uid,
    category,
    limit,
    period: 'monthly',
    createdAt: now(),
  }));
  localStorage.setItem(KEYS.budgets, JSON.stringify(budgets));

  // ── REMINDERS (10) ───────────────────────────────────────
  const reminderRows = [
    ['Credit Card Payment', 'Pay HDFC credit card bill', daysFromNow(2), 'Bills', 8500, 'monthly'],
    ['Electricity Bill Due', 'Pay monthly electricity bill', daysFromNow(7), 'Utilities', 1800, 'monthly'],
    ['Car Service Appointment', 'Take car for 6-month service', daysFromNow(15), 'Transport', 5000, 'once'],
    ['Quarterly Tax Payment', 'Advance tax quarterly installment', daysAgo(2), 'Bills', 15000, 'quarterly'],
    ['Insurance Renewal', 'Renew term insurance', daysFromNow(20), 'Insurance', 12000, 'yearly'],
    ['School Fee Due', 'Pay quarterly school fees', daysFromNow(12), 'Education', 22000, 'quarterly'],
    ['Groceries Refill', 'Large pantry refill', daysFromNow(5), 'Groceries', 6000, 'once'],
    ['Internet Renewal', 'Internet plan renewal', daysFromNow(9), 'Bills', 999, 'monthly'],
    ['Doctor Follow-up', 'Annual health review', daysFromNow(25), 'Healthcare', 2500, 'once'],
    ['Partner Profit Review', 'Monthly partner settlement', daysFromNow(14), 'Other', 0, 'monthly'],
  ];
  const reminders = reminderRows.map(([title, description, dueDate, category, amount, frequency]) => ({
    id: id(),
    userId: uid,
    title,
    description,
    dueDate,
    category,
    amount,
    frequency,
    status: 'pending',
    createdAt: now(),
  }));
  localStorage.setItem(KEYS.reminders, JSON.stringify(reminders));

  // ── GOALS (10) ───────────────────────────────────────────
  const goalRows = [
    ['Emergency Fund', 200000, 85000],
    ['Europe Vacation', 150000, 45000],
    ['Down Payment for House', 500000, 125000],
    ['New Laptop', 90000, 22000],
    ['Wedding Fund', 300000, 65000],
    ['Retirement Corpus', 2000000, 360000],
    ['Child Education', 400000, 95000],
    ['Business Expansion', 350000, 70000],
    ['Electric Scooter', 75000, 14000],
    ['Travel Fund', 120000, 38000],
  ];
  const goals = goalRows.map(([name, target, saved]) => ({
    id: id(),
    userId: uid,
    name,
    target,
    saved,
    createdAt: now(),
  }));
  localStorage.setItem(KEYS.goals, JSON.stringify(goals));

  // ── ADJUSTMENTS (10) ─────────────────────────────────────
  const adjustments = [
    { amount: 5000, accountType: 'personal', notes: 'Fixed rounding error from last month', date: daysAgo(15) },
    { amount: -2000, accountType: 'partner', partnerAccountId: partners[0].id, notes: 'Adjusted partner profit share', date: daysAgo(10) },
    { amount: 1500, accountType: 'personal', notes: 'Cash correction after reconciliation', date: daysAgo(8) },
    { amount: -900, accountType: 'partner', partnerAccountId: partners[1].id, notes: 'Partner expense reimbursement', date: daysAgo(6) },
    { amount: 2400, accountType: 'personal', notes: 'Bank charge reversal', date: daysAgo(5) },
    { amount: -1200, accountType: 'partner', partnerAccountId: partners[2].id, notes: 'Market adjustment', date: daysAgo(4) },
    { amount: 3200, accountType: 'personal', notes: 'Manual balance correction', date: daysAgo(3) },
    { amount: -650, accountType: 'partner', partnerAccountId: partners[3].id, notes: 'Transport share correction', date: daysAgo(2) },
    { amount: 800, accountType: 'personal', notes: 'Interest adjustment', date: daysAgo(1) },
    { amount: -300, accountType: 'partner', partnerAccountId: partners[4].id, notes: 'Minor partner rounding adjustment', date: daysAgo(0) },
  ].map(a => ({
    id: id(),
    userId: uid,
    amount: a.amount,
    accountType: a.accountType,
    partnerAccountId: a.partnerAccountId,
    notes: a.notes,
    date: a.date,
    createdAt: now(),
  }));
  localStorage.setItem(KEYS.adjustments, JSON.stringify(adjustments));

  console.log('✅ SEED DATA LOADED — Refresh the app to see test entries.');
  console.log(`   User: ${uid}`);
  console.log(`   ${transactions.filter(t => !t.deletedAt).length} active transactions | ${partners.length} partners | ${recurring.length} recurring | ${budgets.length} budgets`);
  console.log(`   ${reminders.length} reminders | ${goals.length} goals | ${adjustments.length} adjustments | ${transactions.filter(t => t.deletedAt).length} archived items`);
  console.log('   Data is aligned to the current login/session user when available.');
})();
