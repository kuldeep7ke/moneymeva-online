import TransactionPage from '@/components/TransactionPage';

export default function ExpensesPage() {
  return (
    <TransactionPage 
      type="expense" 
      title="Expenses" 
      titleKey="nav.expenses"
      description="Manage your spending and track where your money goes" 
    />
  );
}
