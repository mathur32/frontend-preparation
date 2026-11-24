import './App.css'
import {Button} from './components/Button'
import {Welcome} from './components/Welcome'
import {Products} from './components/Products'
import { CardWrapper } from './components/CardWrapper'
import { UserDetails } from './components/UserDetails'
import { TransactionList } from './components/TransactionList'
function App() {
  const transactions = [
  { id: 1, type: "CREDIT", amount: 5000 },
  { id: 2, type: "DEBIT", amount: 2000 },
  { id: 3, type: "CREDIT", amount: 3000 },
  { id: 4, type: "DEBIT", amount: 1000 },
  { id: 5, type: "CREDIT", amount: 7000 }
];
  return (
   <>
    <TransactionList transactions={transactions} />
     <UserDetails name="Gautam Kumar" isOnline={true} />
     <UserDetails name="Amit Kumar" isOnline={false} />
    <CardWrapper title="User Profile" >
       <p1>Gautam Kumar</p1>
       <p1>gkmathuri1@gmail.com</p1>
       <button>Edit</button>
    </CardWrapper>
     <Products title="Laptop"
      price={999.99} 
      inStock={true}
      categories={['Electronics', 'Computers']} 
     />
     <Welcome name="Amit Kumar"/>
     <Welcome name="Gautam Kumar" />
     <Welcome name="Anish Kumar" age={22} />
      <Button />
   </>
  )
}

export default App
