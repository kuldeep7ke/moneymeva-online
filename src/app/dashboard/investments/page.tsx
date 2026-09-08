import TransactionPage from '@/components/TransactionPage';

export default function InvestmentsPage() {
  return (
    <TransactionPage 
      type="investment" 
      title="Investments" 
      titleKey="nav.investments"
      description="Manage your stocks, mutual funds, and other investments" 
    />
  );
}
