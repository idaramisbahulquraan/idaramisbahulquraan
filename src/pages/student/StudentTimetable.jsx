import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase-config';
import logo from '../../../assets/main-logo-1-e1724093314271.png';

const StudentTimetable = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [className, setClassName] = useState('');
  const [department, setDepartment] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      // Get student doc for class
      const sRef = doc(db, 'students', currentUser.uid);
      const sSnap = await getDoc(sRef);
      const sData = sSnap.exists() ? sSnap.data() : {};
      const c = sData.className || '';
      const dpt = sData.department || '';
      setClassName(c);
      setDepartment(dpt);
      if (c) {
        const base = collection(db, 'timetables');
        const q = dpt ? query(base, where('department','==', dpt), where('className', '==', String(c))) : query(base, where('className', '==', String(c)));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => d.data());
        setEntries(data);
      }
      setLoading(false);
    };
    if (currentUser) fetch();
  }, [currentUser]);

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  const byDay = entries.reduce((acc, e) => {
    acc[e.day] = acc[e.day] || [];
    acc[e.day].push(e);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Institution Logo" className="h-10 w-10 object-contain" />
          <div>
            <div className="text-xl font-bold text-gray-800">Idara Misbah ul Quran Mangment System</div>
            <div className="text-sm text-gray-500">My Timetable ({department ? department + ' - ' : ''}{className})</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Download PDF</button>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300">Back</button>
        </div>
      </div>

      {Object.keys(byDay).length === 0 ? (
        <div className="text-center p-10 text-gray-500">No timetable entries.</div>
      ) : (
        Object.keys(byDay).map(day => (
          <div key={day} className="bg-white shadow-md rounded">
            <div className="px-6 py-3 border-b"><span className="font-semibold">{day}</span></div>
            <ul className="divide-y">
              {byDay[day]
                .sort((a,b)=>a.startTime.localeCompare(b.startTime))
                .map((e, idx) => (
                  <li key={idx} className="px-6 py-3 flex justify-between">
                    <span>{e.subject}</span>
                    <span className="text-gray-600">{e.startTime} - {e.endTime}</span>
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
};

export default StudentTimetable;
