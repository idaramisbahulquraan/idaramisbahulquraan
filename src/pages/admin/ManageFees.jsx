import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase-config';
import logo from '../../../assets/main-logo-1-e1724093314271.png';

const ManageFees = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ studentId: '', amount: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const sSnap = await getDocs(query(collection(db, 'students')));
        const sData = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setStudents(sData);
        const fSnap = await getDocs(query(collection(db, 'fees')));
        const fData = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setFees(fData);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.studentId || !form.amount) return;
    setSaving(true);
    try {
      const docRef = doc(collection(db, 'fees'));
      const newData = {
        uid: docRef.id,
        studentId: form.studentId,
        amount: Number(form.amount),
        description: form.description || '',
        status: 'unpaid',
        createdAt: new Date()
      };
      await setDoc(docRef, newData);
      setFees([{ id: docRef.id, ...newData }, ...fees]);
      setForm({ studentId: '', amount: '', description: '' });
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (id) => {
    await updateDoc(doc(db, 'fees', id), { status: 'paid' });
    setFees(fees.map(f => (f.id === id ? { ...f, status: 'paid' } : f)));
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this fee record?')) {
      await deleteDoc(doc(db, 'fees', id));
      setFees(fees.filter(f => f.id !== id));
    }
  };

  if (loading) return <div className="text-center p-10">Loading...</div>;

  const studentName = (sid) => {
    const s = students.find(st => st.id === sid);
    return s ? `${s.firstName} ${s.lastName}` : sid;
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Institution Logo" className="h-10 w-10 object-contain" />
          <div>
            <div className="text-xl font-bold text-gray-800">Idara Misbah ul Quran Mangment System</div>
            <div className="text-sm text-gray-500">Manage Fees</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Download PDF</button>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
          >
            Back
          </button>
        </div>
      </div>

      <form onSubmit={handleCreate} className="bg-white shadow-md rounded px-8 pt-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Student</label>
            <select
              className="shadow border rounded w-full py-2 px-3 text-gray-700"
              name="studentId"
              value={form.studentId}
              onChange={handleChange}
              required
            >
              <option value="">Select Student</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Amount</label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
              type="number"
              name="amount"
              value={form.amount}
              onChange={handleChange}
              required
              min="0"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Description</label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
              type="text"
              name="description"
              value={form.description}
              onChange={handleChange}
            />
          </div>
        </div>
        <div className="flex items-center justify-end mt-6">
          <button
            className={`bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            type="submit"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Create Fee'}
          </button>
        </div>
      </form>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Student</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fees.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-center">No fee records.</td>
              </tr>
            ) : (
              fees.map(f => (
                <tr key={f.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{studentName(f.studentId)}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">PKR {f.amount}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm capitalize">{f.status}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {f.status !== 'paid' && (
                      <button onClick={() => markPaid(f.id)} className="text-green-600 hover:text-green-800 mr-4">Mark Paid</button>
                    )}
                    <button onClick={() => handleDelete(f.id)} className="text-red-600 hover:text-red-900">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManageFees;
