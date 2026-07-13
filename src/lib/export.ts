import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getTransactions } from './store';

export function exportSummaryPDF(data: { month: string; income: number; expense: number; saving: number; investment: number }[]) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Money Meva - Monthly Summary', 14, 22);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 30);

  const headers = [['Month', 'Income', 'Expense', 'Savings', 'Investment']];
  const rows = data.map(d => [
    d.month,
    `₹${d.income.toLocaleString('en-IN')}`,
    `₹${d.expense.toLocaleString('en-IN')}`,
    `₹${d.saving.toLocaleString('en-IN')}`,
    `₹${d.investment.toLocaleString('en-IN')}`,
  ]);
  const totals = data.reduce((s, d) => ({ income: s.income + d.income, expense: s.expense + d.expense, saving: s.saving + d.saving, investment: s.investment + d.investment }), { income: 0, expense: 0, saving: 0, investment: 0 });
  rows.push(['Total', `₹${totals.income.toLocaleString('en-IN')}`, `₹${totals.expense.toLocaleString('en-IN')}`, `₹${totals.saving.toLocaleString('en-IN')}`, `₹${totals.investment.toLocaleString('en-IN')}`]);

  autoTable(doc, { head: headers, body: rows, startY: 36, theme: 'striped', headStyles: { fillColor: [79, 70, 229] } });
  doc.save('money-meva-summary.pdf');
}

export function exportSummaryExcel(data: { month: string; income: number; expense: number; saving: number; investment: number }[]) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data.map(d => ({ Month: d.month, Income: d.income, Expense: d.expense, Savings: d.saving, Investment: d.investment })));
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  XLSX.writeFile(wb, 'money-meva-summary.xlsx');
}

export function exportAllDataExcel() {
  const txs = getTransactions();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(txs.map(t => ({
    Date: t.date, Type: t.type, Category: t.category, Description: t.description, Amount: t.amount,
    PartnerId: t.partnerAccountId || '', Recurring: t.isRecurring ? 'Yes' : 'No',
  })));
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  XLSX.writeFile(wb, 'money-meva-all-data.xlsx');
}

export function exportAllDataPDF() {
  const txs = getTransactions();
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Money Meva - All Transactions', 14, 22);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 30);
  doc.text(`Total transactions: ${txs.length}`, 14, 36);

  const headers = [['Date', 'Type', 'Category', 'Description', 'Amount']];
  const rows = txs.slice(0, 500).map(t => [
    t.date, t.type, t.category, t.description, `₹${t.amount.toLocaleString('en-IN')}`,
  ]);
  autoTable(doc, { head: headers, body: rows, startY: 42, theme: 'striped', headStyles: { fillColor: [79, 70, 229] } });
  doc.save('money-meva-transactions.pdf');
}
