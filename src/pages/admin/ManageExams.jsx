import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase-config';
import logo from '../../../assets/main-logo-1-e1724093314271.png';

const departments = ['Dars-e-Nizami','Hifz','Tajweed'];
const DARS_CLASSES = ['Mutwasta','Aama Arzbic (A)','Aama Arabic (B)','Aama English','Khasa - I','Khasa - II','Matric','Intermediate (IX)','Aalia - I (X)','Aalia - II (XI)','Aalamia - I (XII)','Almia - II (XI)'];
const HIFZ_CLASSES = ['Amer Bin Khatab','Abdullah Bin Masood','Zaid Bin Sabit','Musab Bin Omair','Abdullah Bin Abbas','Osman Ghani','Abee Bin Kaab','Abu Bakar Siddique','Ali-ul-Murtazi','Naseerah Murseed'];
const TAJWEED_CLASSES = ['Class 1st year','Class IInd year'];

const ManageExams = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ department: '', className: '', subject: '', date: '', startTime: '', endTime: '' });

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(query(collection(db, 'exams')));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExams(data);
      setLoading(false);
    };
    fetch();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const docRef = doc(collection(db, 'exams'));
    const payload = {
      uid: docRef.id,
      department: form.department,
      className: form.className,
      subject: form.subject,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      createdAt: new Date()
    };
    await setDoc(docRef, payload);
    setExams([{ id: docRef.id, ...payload }, ...exams]);
    setForm({ department: '', className: '', subject: '', date: '', startTime: '', endTime: '' });
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'exams', id));
    setExams(exams.filter(e => e.id !== id));
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Institution Logo" className="h-10 w-10 object-contain" />
          <div>
            <div className="text-xl font-bold text-gray-800">Idara Misbah ul Quran Mangment System</div>
            <div className="text-sm text-gray-500">Manage Exams</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Download PDF</button>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300">Back</button>
        </div>
      </div>

      <form onSubmit={handleCreate} className="bg-white shadow-md rounded px-8 pt-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Department</label>
            <select name="department" value={form.department} onChange={handleChange} className="shadow border rounded w-full py-2 px-3" required>
              <option value="">Select Department</option>
              {departments.map(d => (<option key={d} value={d}>{d}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Class</label>
            <select name="className" value={form.className} onChange={handleChange} className="shadow border rounded w-full py-2 px-3" required>
              <option value="">Select Class</option>
              {(form.department === 'Dars-e-Nizami' ? DARS_CLASSES : form.department === 'Hifz' ? HIFZ_CLASSES : form.department === 'Tajweed' ? TAJWEED_CLASSES : []).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Subject</label>
            <input name="subject" value={form.subject} onChange={handleChange} className="shadow border rounded w-full py-2 px-3" required />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Date</label>
            <input type="date" name="date" value={form.date} onChange={handleChange} className="shadow border rounded w-full py-2 px-3" required />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Start Time</label>
            <input type="time" name="startTime" value={form.startTime} onChange={handleChange} className="shadow border rounded w-full py-2 px-3" required />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">End Time</label>
            <input type="time" name="endTime" value={form.endTime} onChange={handleChange} className="shadow border rounded w-full py-2 px-3" required />
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <button type="submit" disabled={saving} className={`px-4 py-2 bg-orange-600 text-white rounded ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}>{saving ? 'Saving...' : 'Schedule Exam'}</button>
        </div>
      </form>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Class</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subject</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date/Time</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {exams.length === 0 ? (
              <tr><td colSpan="4" className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-center">No exams scheduled.</td></tr>
            ) : (
              exams.map(e => (
                <tr key={e.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">Class {e.className}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{e.subject}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{e.date} {e.startTime}-{e.endTime}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm"><button onClick={() => handleDelete(e.id)} className="text-red-600 hover:text-red-900">Delete</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManageExams;
