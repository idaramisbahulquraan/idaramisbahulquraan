import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, query, where, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase-config';
import logo from '../../../assets/main-logo-1-e1724093314271.png';

const departments = ['Dars-e-Nizami','Hifz','Tajweed'];
const DARS_CLASSES = ['Mutwasta','Aama Arzbic (A)','Aama Arabic (B)','Aama English','Khasa - I','Khasa - II','Matric','Intermediate (IX)','Aalia - I (X)','Aalia - II (XI)','Aalamia - I (XII)','Almia - II (XI)'];
const HIFZ_CLASSES = ['Amer Bin Khatab','Abdullah Bin Masood','Zaid Bin Sabit','Musab Bin Omair','Abdullah Bin Abbas','Osman Ghani','Abee Bin Kaab','Abu Bakar Siddique','Ali-ul-Murtazi','Naseerah Murseed'];
const TAJWEED_CLASSES = ['Class 1st year','Class IInd year'];

const TakeAttendance = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [department, setDepartment] = useState('');
  const [className, setClassName] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchStudents = async () => {
    if (!className) return;
    setLoading(true);
    try {
      const base = collection(db, 'students');
      const q = department ? query(base, where('department','==', department), where('className', '==', className)) : query(base, where('className', '==', className));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data(), status: 'present' }));
      setStudents(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className]);

  const setStatus = (id, status) => {
    setStudents(students.map(s => (s.id === id ? { ...s, status } : s)));
  };

  const submitAttendance = async () => {
    if (!date || !className || students.length === 0) return;
    setSaving(true);
    try {
      const batchWrites = students.map(async (s) => {
        const attId = `${date}_${className}_${s.id}`;
        await setDoc(doc(db, 'attendance', attId), {
          uid: attId,
          date,
          department,
          className,
          studentId: s.id,
          status: s.status,
          teacherId: currentUser?.uid || null,
          createdAt: new Date()
        });
      });
      await Promise.all(batchWrites);
      alert('Attendance submitted');
      navigate('/dashboard');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Institution Logo" className="h-10 w-10 object-contain" />
          <div>
            <div className="text-xl font-bold text-gray-800">Idara Misbah ul Quran Mangment System</div>
            <div className="text-sm text-gray-500">Take Attendance</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Download PDF</button>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300">Back</button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="shadow border rounded w-full py-2 px-3"/>
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="shadow border rounded w-full py-2 px-3">
              <option value="">Select Department</option>
              {departments.map(d => (<option key={d} value={d}>{d}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Class</label>
            <select value={className} onChange={(e) => setClassName(e.target.value)} className="shadow border rounded w-full py-2 px-3">
              <option value="">Select Class</option>
              {(department === 'Dars-e-Nizami' ? DARS_CLASSES : department === 'Hifz' ? HIFZ_CLASSES : department === 'Tajweed' ? TAJWEED_CLASSES : []).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={fetchStudents} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Load Students</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center p-10">Loading students...</div>
      ) : students.length === 0 ? (
        <div className="text-center p-10 text-gray-500">Select a class to load students.</div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Student</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{s.firstName} {s.lastName}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <div className="flex gap-2">
                      {['present','absent','late'].map(st => (
                        <button key={st} onClick={() => setStatus(s.id, st)} className={`px-3 py-1 rounded border ${s.status===st ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{st}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-end mt-6">
        <button onClick={submitAttendance} disabled={saving || students.length===0} className={`px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 ${saving ? 'opacity-50 cursor-not-allowed':''}`}>{saving ? 'Submitting...' : 'Submit Attendance'}</button>
      </div>
    </div>
  );
};

export default TakeAttendance;
