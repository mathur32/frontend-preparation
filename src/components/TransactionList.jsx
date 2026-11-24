export function TransactionList({ transactions }) {
  return (
    <div>
      <h2>Transactions</h2>

      {transactions.map((transaction) => (
        <div key={transaction.id}>
          <span>{transaction.type}</span>
          <span>{transaction.amount}</span>
        </div>
      ))}
    </div>
  );
}