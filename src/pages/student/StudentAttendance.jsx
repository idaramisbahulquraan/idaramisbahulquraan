import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase-config';
import logo from '../../../assets/main-logo-1-e1724093314271.png';

const StudentAttendance = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const q = query(collection(db, 'attendance'), where('studentId', '==', currentUser.uid));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => d.data());
        setRecords(data);
      } finally {
        setLoading(false);
      }
    };
    if (currentUser) fetchRecords();
  }, [currentUser]);

  if (loading) return <div className="text-center p-10">Loading...</div>;

  const total = records.length;
  const present = records.filter(r => r.status === 'present').length;
  const percent = total ? Math.round((present / total) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Institution Logo" className="h-10 w-10 object-contain" />
          <div>
            <div className="text-xl font-bold text-gray-800">Idara Misbah ul Quran Mangment System</div>
            <div className="text-sm text-gray-500">My Attendance</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Download PDF</button>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300">Back</button>
        </div>
      </div>

      <div className="p-6 bg-white rounded-lg shadow-md mb-6">
        <h3 className="text-lg font-semibold text-gray-700">Overall</h3>
        <p className="text-3xl font-bold text-teal-600">{percent}%</p>
        <p className="text-sm text-gray-500 mt-1">{present} of {total} days present</p>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Class</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan="3" className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-center">No attendance records.</td>
              </tr>
            ) : (
              records.sort((a,b)=>a.date.localeCompare(b.date)).map(r => (
                <tr key={`${r.date}_${r.studentId}`}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{r.date}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">Class {r.className}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm capitalize">{r.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentAttendance;
