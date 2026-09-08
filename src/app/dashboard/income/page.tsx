import TransactionPage from '@/components/TransactionPage';

export default function IncomePage() {
  return (
    <TransactionPage 
      type="income" 
      title="Income" 
      titleKey="nav.income"
      description="Track your earnings from all sources" 
    />
  );
}
