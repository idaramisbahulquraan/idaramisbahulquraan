import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../firebase-config';
import logo from '../../../assets/main-logo-1-e1724093314271.png';

const FinanceReports = () => {
  const navigate = useNavigate();
  const [income, setIncome] = useState([]);
  const [expense, setExpense] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ start: '', end: '' });

  const loadAll = async () => {
    const iSnap = await getDocs(query(collection(db, 'incomeTransactions')));
    const eSnap = await getDocs(query(collection(db, 'expenseTransactions')));
    setIncome(iSnap.docs.map(d => d.data()));
    setExpense(eSnap.docs.map(d => d.data()));
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const within = (d) => {
    if (!range.start || !range.end) return true;
    return d >= range.start && d <= range.end;
  };

  const filteredIncome = income.filter(i => within(i.date));
  const filteredExpense = expense.filter(e => within(e.date));

  const totalIncome = filteredIncome.reduce((s, x) => s + Number(x.amount || 0), 0);
  const totalExpense = filteredExpense.reduce((s, x) => s + Number(x.amount || 0), 0);
  const net = totalIncome - totalExpense;

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Institution Logo" className="h-10 w-10 object-contain" />
          <div>
            <div className="text-xl font-bold text-gray-800">Idara Misbah ul Quran Mangment System</div>
            <div className="text-sm text-gray-500">Finance Reports</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Download PDF</button>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300">Back</button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Start</label>
            <input type="date" value={range.start} onChange={(e)=>setRange({ ...range, start: e.target.value })} className="shadow border rounded w-full py-2 px-3" />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">End</label>
            <input type="date" value={range.end} onChange={(e)=>setRange({ ...range, end: e.target.value })} className="shadow border rounded w-full py-2 px-3" />
          </div>
          <div className="flex items-end">
            <div className="text-sm text-gray-600">{range.start && range.end ? `Showing ${range.start} to ${range.end}` : 'Showing all'}</div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-sm text-gray-600">Income</div>
            <div className="text-3xl font-bold text-green-600">PKR {totalIncome.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Expense</div>
            <div className="text-3xl font-bold text-red-600">PKR {totalExpense.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Net</div>
            <div className="text-3xl font-bold text-blue-600">PKR {net.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="px-6 py-3 border-b font-semibold">Income Transactions</div>
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody>
            {filteredIncome.length === 0 ? (
              <tr><td colSpan="3" className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-center">No records.</td></tr>
            ) : (
              filteredIncome.sort((a,b)=>a.date.localeCompare(b.date)).map((t, idx) => (
                <tr key={idx}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{t.date}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">PKR {Number(t.amount || 0)}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{t.description}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="px-6 py-3 border-b font-semibold">Expense Transactions</div>
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpense.length === 0 ? (
              <tr><td colSpan="3" className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-center">No records.</td></tr>
            ) : (
              filteredExpense.sort((a,b)=>a.date.localeCompare(b.date)).map((t, idx) => (
                <tr key={idx}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{t.date}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">PKR {Number(t.amount || 0)}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{t.description}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FinanceReports;
