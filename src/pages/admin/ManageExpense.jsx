import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase-config';
import logo from '../../../assets/main-logo-1-e1724093314271.png';

const ManageExpense = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  const [txForm, setTxForm] = useState({ categoryId: '', amount: '', date: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [savingCat, setSavingCat] = useState(false);
  const [savingTx, setSavingTx] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      const cSnap = await getDocs(query(collection(db, 'expenseCategories')));
      const tSnap = await getDocs(query(collection(db, 'expenseTransactions')));
      setCategories(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTransactions(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    fetchAll();
  }, []);

  const handleCatChange = (e) => setCatForm({ ...catForm, [e.target.name]: e.target.value });
  const handleTxChange = (e) => setTxForm({ ...txForm, [e.target.name]: e.target.value });

  const addCategory = async (e) => {
    e.preventDefault();
    setSavingCat(true);
    const docRef = doc(collection(db, 'expenseCategories'));
    await setDoc(docRef, {
      uid: docRef.id,
      name: catForm.name,
      description: catForm.description,
      createdAt: new Date()
    });
    setCategories([{ id: docRef.id, uid: docRef.id, ...catForm }, ...categories]);
    setCatForm({ name: '', description: '' });
    setSavingCat(false);
  };

  const deleteCategory = async (id) => {
    await deleteDoc(doc(db, 'expenseCategories', id));
    setCategories(categories.filter(c => c.id !== id));
  };

  const addTransaction = async (e) => {
    e.preventDefault();
    setSavingTx(true);
    const docRef = doc(collection(db, 'expenseTransactions'));
    await setDoc(docRef, {
      uid: docRef.id,
      categoryId: txForm.categoryId,
      amount: Number(txForm.amount || 0),
      date: txForm.date,
      description: txForm.description,
      createdAt: new Date()
    });
    setTransactions([{ id: docRef.id, uid: docRef.id, ...txForm, amount: Number(txForm.amount || 0) }, ...transactions]);
    setTxForm({ categoryId: '', amount: '', date: '', description: '' });
    setSavingTx(false);
  };

  const deleteTransaction = async (id) => {
    await deleteDoc(doc(db, 'expenseTransactions', id));
    setTransactions(transactions.filter(t => t.id !== id));
  };

  if (loading) return <div className="text-center p-10">Loading...</div>;

  const catName = (id) => {
    const c = categories.find(x => x.id === id);
    return c ? c.name : id;
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Institution Logo" className="h-10 w-10 object-contain" />
          <div>
            <div className="text-xl font-bold text-gray-800">Idara Misbah ul Quran Mangment System</div>
            <div className="text-sm text-gray-500">Manage Expense</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Download PDF</button>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300">Back</button>
        </div>
      </div>

      <form onSubmit={addCategory} className="bg-white shadow-md rounded px-8 pt-6 pb-8">
        <h3 className="text-lg font-semibold mb-4">Add Category</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <input name="name" value={catForm.name} onChange={handleCatChange} placeholder="Name" className="shadow border rounded w-full py-2 px-3" required />
          <input name="description" value={catForm.description} onChange={handleCatChange} placeholder="Description" className="shadow border rounded w-full py-2 px-3" />
          <button type="submit" disabled={savingCat} className={`px-4 py-2 bg-red-600 text-white rounded ${savingCat ? 'opacity-50 cursor-not-allowed': ''}`}>{savingCat ? 'Saving...' : 'Add'}</button>
        </div>
      </form>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr><td colSpan="3" className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-center">No categories.</td></tr>
            ) : (
              categories.map(c => (
                <tr key={c.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{c.name}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{c.description}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm"><button onClick={() => deleteCategory(c.id)} className="text-red-600 hover:text-red-900">Delete</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={addTransaction} className="bg-white shadow-md rounded px-8 pt-6 pb-8">
        <h3 className="text-lg font-semibold mb-4">Add Transaction</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <select name="categoryId" value={txForm.categoryId} onChange={handleTxChange} className="shadow border rounded w-full py-2 px-3" required>
            <option value="">Select Category</option>
            {categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <input type="number" name="amount" value={txForm.amount} onChange={handleTxChange} placeholder="Amount" className="shadow border rounded w-full py-2 px-3" required min="0" />
          <input type="date" name="date" value={txForm.date} onChange={handleTxChange} className="shadow border rounded w-full py-2 px-3" required />
          <input name="description" value={txForm.description} onChange={handleTxChange} placeholder="Description" className="shadow border rounded w-full py-2 px-3" />
          <button type="submit" disabled={savingTx} className={`px-4 py-2 bg-blue-600 text-white rounded ${savingTx ? 'opacity-50 cursor-not-allowed': ''}`}>{savingTx ? 'Saving...' : 'Add'}</button>
        </div>
      </form>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr><td colSpan="5" className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-center">No transactions.</td></tr>
            ) : (
              transactions.sort((a,b)=>a.date.localeCompare(b.date)).map(t => (
                <tr key={t.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{t.date}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{catName(t.categoryId)}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">PKR {t.amount}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{t.description}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm"><button onClick={() => deleteTransaction(t.id)} className="text-red-600 hover:text-red-900">Delete</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManageExpense;
