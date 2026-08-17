import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getTransactions } from './store';
import { downloadFile, downloadBlob } from './download';

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
