import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getTransactions, getPartners, getRecurring, getWorks, getGoals, getPartnerships, getPartnershipEntries } from './store';
import { DEFAULT_CATEGORIES } from './defaultCategories';
import { downloadFile, downloadBlob } from './download';

export type CustomExportSection = 'income' | 'expenses' | 'parties' | 'recurring' | 'investments' | 'categories' | 'works' | 'goals' | 'accounts' | 'partnership';

export async function exportCustomDataExcel(opts: {
  from?: string;
  to?: string;
  sections: CustomExportSection[];
  format?: 'xlsx' | 'json';
  onProgress?: (label: string, pct: number) => void;
}) {
  try {
    const { from, to, sections, format = 'xlsx', onProgress } = opts;
    const txs = getTransactions().filter(t => !t.deletedAt);
    const partners = getPartners();
    const partnerMap = new Map<string, string>();
    for (const p of partners) partnerMap.set(p.id, p.name);
    const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);
    const txsInRange = txs.filter(t => inRange(t.date));
    const partyName = (id?: string) => (id ? partnerMap.get(id) || '' : '');
    // Entities are "in period" when their own date window overlaps [from, to].
    // Guard part ranges: a missing bound means "no limit" on that side.
    const recInRange = getRecurring().filter(r => {
      if (from && (r.startDate || '') && (r.startDate || '') > (to || '9999-12-31')) return false;
      if (to && r.endDate && r.endDate < (from || '0000-01-01')) return false;
      return true;
    });
    const worksInRange = getWorks().filter(w => {
      if (from && w.startDate && w.startDate > (to || '9999-12-31')) return false;
      if (to && w.endDate && w.endDate < (from || '0000-01-01')) return false;
      return true;
    });

    onProgress?.('Reading data…', 10);
    const incRows = sections.includes('income') ? txsInRange.filter(t => t.type === 'income') : [];
    const expRows = sections.includes('expenses') ? txsInRange.filter(t => t.type === 'expense') : [];
    const investRows = sections.includes('investments') ? txsInRange.filter(t => t.type === 'investment') : [];
    let categoriesCount = 0;

    // Raw table map (keeps original ids) so the export can be imported back into the app.
    const data: Record<string, any[]> = {};
    // Income/expenses/investments/categories/accounts all come from the transactions table.
    const txIncluded = ['income', 'expenses', 'investments', 'categories', 'accounts'].some(s => sections.includes(s as CustomExportSection));
    if (txIncluded) {
      const wantType = (ty: string) =>
        (ty === 'income' && sections.includes('income')) ||
        (ty === 'expense' && sections.includes('expenses')) ||
        (ty === 'investment' && sections.includes('investments')) ||
        ((ty === 'income' || ty === 'expense') && sections.includes('categories')) ||
        sections.includes('accounts');
      data.transactions = txsInRange.filter(t => wantType(t.type));
    }
    if (sections.includes('parties')) data.partners = partners;
    if (sections.includes('recurring')) data.recurring = recInRange;
    if (sections.includes('works')) data.works = worksInRange;
    if (sections.includes('goals')) data.goals = getGoals();
    if (sections.includes('partnership')) {
      data.partnerships = getPartnerships();
      data.partnershipEntries = getPartnerships().flatMap(p => getPartnershipEntries(p.id).filter(e => inRange(e.date)));
    }
    if (Object.keys(data).length === 0) throw new Error('No data to export for the selected sections.');

    // JSON mode emits the raw table map directly — the developer-page Import restores it.
    if (format === 'json') {
      onProgress?.('Building JSON data…', 30);
      onProgress?.('Generating file…', 90);
      const stamp = new Date().toISOString().split('T')[0];
      const range = `[${from || 'all'}]-[${to || 'all'}]`.replace(/[^a-z0-9_[\]]/gi, '-');
      await downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `money-meva-export-${range}-${stamp}.json`);
      onProgress?.('Done', 100);
      return;
    }

    const wb = XLSX.utils.book_new();

    if (sections.includes('income')) {
      onProgress?.('Building Income sheet…', 30);
      const ws = XLSX.utils.json_to_sheet(incRows.map(t => ({
        Date: t.date, Category: t.category, Description: t.description, Party: partyName(t.partnerAccountId), Amount: t.amount,
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Income');
    }

    if (sections.includes('expenses')) {
      onProgress?.('Building Expenses sheet…', 45);
      const ws = XLSX.utils.json_to_sheet(expRows.map(t => ({
        Date: t.date, Category: t.category, Description: t.description, Party: partyName(t.partnerAccountId), Amount: t.amount,
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    }

    if (sections.includes('parties')) {
      onProgress?.('Building Parties sheet…', 60);
      const ws = XLSX.utils.json_to_sheet(partners.map(p => {
        const pt = txsInRange.filter(t => t.partnerAccountId === p.id && t.account !== 'credit');
        const income = pt.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expense = pt.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        // Positive = you owe this party (buy on credit); negative = party owes you (sale on credit)
        const credit = txsInRange.filter(t => t.account === 'credit' && t.partnerAccountId === p.id)
          .reduce((s, t) => s + (t.type === 'expense' ? t.amount : -t.amount), 0);
        return {
          Name: p.name, Group: p.group || '', Type: p.type || '', Description: p.description || '',
          'Initial Investment': p.initialInvestment || 0, 'Net P&L': income - expense, 'Credit Balance': credit,
        };
      }));
      XLSX.utils.book_append_sheet(wb, ws, 'Parties');
    }

    if (sections.includes('recurring')) {
      onProgress?.('Building Recurring sheet…', 55);
      const ws = XLSX.utils.json_to_sheet(recInRange.map(r => ({
        Title: r.title, Type: r.txType, Amount: r.amount, Frequency: r.frequency, Status: r.status,
        'Start Date': r.startDate || '', 'End Date': r.endDate || '', 'Next Date': r.nextDate || '', 'Reminder (days)': r.reminderDays || 0,
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Recurring');
    }

    if (sections.includes('investments')) {
      onProgress?.('Building Investments sheet…', 60);
      const ws = XLSX.utils.json_to_sheet(investRows.map(t => ({
        Date: t.date, Category: t.category, Description: t.description, Amount: t.amount,
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Investments');
    }

    if (sections.includes('categories')) {
      onProgress?.('Building Categories sheet…', 63);
      const catStats: Record<string, { incN: number; incA: number; expN: number; expA: number }> = {};
      for (const c of [...DEFAULT_CATEGORIES.income, ...DEFAULT_CATEGORIES.expense]) {
        catStats[c] = { incN: 0, incA: 0, expN: 0, expA: 0 };
      }
      for (const t of txsInRange) {
        if (t.type !== 'income' && t.type !== 'expense') continue;
        const s = catStats[t.category] || (catStats[t.category] = { incN: 0, incA: 0, expN: 0, expA: 0 });
        if (t.type === 'income') { s.incN++; s.incA += t.amount; } else { s.expN++; s.expA += t.amount; }
      }
      categoriesCount = Object.keys(catStats).length;
      const ws = XLSX.utils.json_to_sheet(Object.keys(catStats).sort().map(c => ({
        Category: c,
        'Income Count': catStats[c].incN,
        'Income Total': catStats[c].incA,
        'Expense Count': catStats[c].expN,
        'Expense Total': catStats[c].expA,
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Categories');
    }

    if (sections.includes('works')) {
      onProgress?.('Building Works sheet…', 66);
      const ws = XLSX.utils.json_to_sheet(worksInRange.map(w => {
        const status = w.paidAmount >= w.agreedAmount ? 'paid' : w.paidAmount > 0 ? 'partial' : 'pending';
        return {
          Direction: w.direction, Profile: w.profile, 'Work Type': w.workType, Crop: w.crop || '', Season: w.season, Year: w.year,
          Party: w.partyId ? partyName(w.partyId) : '', 'Agreed Amount': w.agreedAmount, 'Paid Amount': w.paidAmount, Balance: w.agreedAmount - w.paidAmount,
          Status: status, 'Start Date': w.startDate || '', 'End Date': w.endDate || '', 'Due Date': w.dueDate || '', Notes: w.notes || '',
        };
      }));
      XLSX.utils.book_append_sheet(wb, ws, 'Works');
    }

    if (sections.includes('goals')) {
      onProgress?.('Building Goals sheet…', 69);
      const ws = XLSX.utils.json_to_sheet(getGoals().map(g => ({
        Name: g.name, Target: g.target, Saved: g.saved, Remaining: Math.max(0, g.target - g.saved),
        'Progress %': g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0,
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Goals');
    }

    if (sections.includes('accounts')) {
      onProgress?.('Building Accounts sheet…', 72);
      const bal = (pred: (t: any) => boolean) => txsInRange.filter(pred).reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0);
      const investTotal = txsInRange.filter(t => t.type === 'investment').reduce((s, t) => s + t.amount, 0);
      const capitalIn = txsInRange.filter(t => t.type === 'income' && t.category === 'Capital').reduce((s, t) => s + t.amount, 0);
      const drawings = txsInRange.filter(t => t.type === 'expense' && t.category === 'Drawings').reduce((s, t) => s + t.amount, 0);
      const ws = XLSX.utils.json_to_sheet([
        { Account: 'Cash', Balance: bal(t => !t.account || t.account === 'cash') },
        { Account: 'Bank', Balance: bal(t => t.account === 'bank') },
        { Account: 'UPI', Balance: bal(t => t.account === 'upi') },
        { Account: 'Credit', Balance: bal(t => t.account === 'credit') },
        { Account: 'Investments', Balance: investTotal },
        { Account: 'Capital', Balance: capitalIn - drawings },
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Accounts');
    }

    if (sections.includes('partnership')) {
      onProgress?.('Building Partnership sheet…', 75);
      const ws = XLSX.utils.json_to_sheet(getPartnerships().map(p => {
        const entries = getPartnershipEntries(p.id).filter(e => inRange(e.date));
        const totalIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
        const totalExpense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
        return {
          Title: p.title, Crop: p.crop, Season: p.season, Year: p.year, Members: (p.members || []).map(m => m.name).join(', '),
          'Total Income': totalIncome, 'Total Expense': totalExpense, Net: totalIncome - totalExpense,
        };
      }));
      XLSX.utils.book_append_sheet(wb, ws, 'Partnership');
    }

    onProgress?.('Building Summary sheet…', 80);
    const sumRows = [
      { Section: 'Income', Rows: incRows.length, Amount: incRows.reduce((s, t) => s + t.amount, 0) },
      { Section: 'Expenses', Rows: expRows.length, Amount: expRows.reduce((s, t) => s + t.amount, 0) },
      ...(sections.includes('investments') ? [{ Section: 'Investments', Rows: investRows.length, Amount: investRows.reduce((s, t) => s + t.amount, 0) }] : []),
      ...(sections.includes('parties') ? [{ Section: 'Parties', Rows: partners.length, Amount: 0 }] : []),
      ...(sections.includes('recurring') ? [{ Section: 'Recurring', Rows: recInRange.length, Amount: 0 }] : []),
      ...(sections.includes('categories') ? [{ Section: 'Categories', Rows: categoriesCount, Amount: 0 }] : []),
      ...(sections.includes('works') ? [{ Section: 'Works', Rows: worksInRange.length, Amount: 0 }] : []),
      ...(sections.includes('goals') ? [{ Section: 'Goals', Rows: getGoals().length, Amount: 0 }] : []),
      ...(sections.includes('accounts') ? [{ Section: 'Accounts', Rows: 6, Amount: 0 }] : []),
      ...(sections.includes('partnership') ? [{ Section: 'Partnership', Rows: getPartnerships().length, Amount: 0 }] : []),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sumRows), 'Summary');

    // Embed the raw table arrays (with original ids) as hidden "_mm_" sheets so the
    // developer-page Import can load them back exactly like a JSON export.
    // Normalize nested objects/arrays so spreadsheet cells stay lossless for the importer.
    const sheetSafe = (rows: any[]) => rows.map(r => {
      const row: Record<string, any> = {};
      for (const [k, v] of Object.entries(r)) row[k] = v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
      return row;
    });
    const hiddenSheets: string[] = [];
    for (const [key, rows] of Object.entries(data)) {
      if (!rows.length) continue;
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetSafe(rows)), `_mm_${key}`);
      hiddenSheets.push(`_mm_${key}`);
    }
    if (hiddenSheets.length) {
      wb.Workbook = wb.Workbook || {};
      wb.Workbook.Sheets = wb.SheetNames.map(n => ({ Name: n, Hidden: hiddenSheets.includes(n) ? 1 : 0 }));
    }

    onProgress?.('Generating file…', 90);
    const stamp = new Date().toISOString().split('T')[0];
    const range = `[${from || 'all'}]-[${to || 'all'}]`.replace(/[^a-z0-9_[\]]/gi, '-');
    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    await downloadBlob(new Blob([wbOut], { type: 'application/octet-stream' }), `money-meva-export-${range}-${stamp}.xlsx`);
    onProgress?.('Done', 100);
  } catch (e) {
    console.error('Custom export failed:', e);
    throw e;
  }
}

export async function exportSummaryPDF(data: { month: string; income: number; expense: number; investment: number }[]) {
  try {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Money Meva - Monthly Summary', 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 30);

    const headers = [['Month', 'Income', 'Expense', 'Investment']];
    const rows = data.map(d => [
      d.month,
      `₹${d.income.toLocaleString('en-IN')}`,
      `₹${d.expense.toLocaleString('en-IN')}`,
      `₹${d.investment.toLocaleString('en-IN')}`,
    ]);
    const totals = data.reduce((s, d) => ({ income: s.income + d.income, expense: s.expense + d.expense, investment: s.investment + d.investment }), { income: 0, expense: 0, investment: 0 });
    rows.push(['Total', `₹${totals.income.toLocaleString('en-IN')}`, `₹${totals.expense.toLocaleString('en-IN')}`, `₹${totals.investment.toLocaleString('en-IN')}`]);

    autoTable(doc, { head: headers, body: rows, startY: 36, theme: 'striped', headStyles: { fillColor: [79, 70, 229] } });
    await downloadBlob(doc.output('blob'), 'money-meva-summary.pdf');
  } catch (e) { console.error('PDF export failed:', e); }
}

export async function exportSummaryExcel(data: { month: string; income: number; expense: number; investment: number }[]) {
  try {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data.map(d => ({ Month: d.month, Income: d.income, Expense: d.expense, Investment: d.investment })));
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    await downloadBlob(new Blob([wbOut], { type: 'application/octet-stream' }), 'money-meva-summary.xlsx');
  } catch (e) { console.error('Excel export failed:', e); }
}

export async function exportAllDataExcel(onProgress?: (label: string, pct: number) => void) {
  try {
    onProgress?.('Reading transactions…', 15);
    const txs = getTransactions();
    onProgress?.('Building spreadsheet…', 50);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(txs.map(t => ({
      Date: t.date, Type: t.type, Category: t.category, Description: t.description, Amount: t.amount,
      PartnerId: t.partnerAccountId || '', Recurring: t.isRecurring ? 'Yes' : 'No',
    })));
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    onProgress?.('Generating file…', 85);
    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    onProgress?.('Saving file…', 100);
    await downloadBlob(new Blob([wbOut], { type: 'application/octet-stream' }), 'money-meva-all-data.xlsx');
  } catch (e) { console.error('Excel export failed:', e); }
}

export async function exportAllDataPDF(onProgress?: (label: string, pct: number) => void) {
  try {
    onProgress?.('Reading transactions…', 15);
    const txs = getTransactions();
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Money Meva - All Transactions', 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 30);
    doc.text(`Total transactions: ${txs.length}`, 14, 36);

    onProgress?.('Building PDF table…', 55);
    const headers = [['Date', 'Type', 'Category', 'Description', 'Amount']];
    const rows = txs.slice(0, 500).map(t => [
      t.date, t.type, t.category, t.description, `₹${t.amount.toLocaleString('en-IN')}`,
    ]);
    autoTable(doc, { head: headers, body: rows, startY: 42, theme: 'striped', headStyles: { fillColor: [79, 70, 229] } });
    onProgress?.('Generating file…', 85);
    await downloadBlob(doc.output('blob'), 'money-meva-transactions.pdf');
  } catch (e) { console.error('PDF export failed:', e); }
}
