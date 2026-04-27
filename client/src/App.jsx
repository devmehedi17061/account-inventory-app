import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Inventory from './pages/Inventory.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Customers from './pages/Customers.jsx';
import Purchases from './pages/Purchases.jsx';
import Sales from './pages/Sales.jsx';
import Receipts from './pages/Receipts.jsx';
import Payments from './pages/Payments.jsx';
import Reports from './pages/Reports.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/receipts" element={<Receipts />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
