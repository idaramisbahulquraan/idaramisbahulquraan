import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase-config';
import logo from '../../../assets/main-logo-1-e1724093314271.png';

const StudentResults = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const q = query(collection(db, 'examResults'), where('studentId', '==', currentUser.uid));
      const snap = await getDocs(q);
      const data = await Promise.all(snap.docs.map(async d => {
        const v = d.data();
        const eSnap = await getDoc(doc(db, 'exams', v.examId));
        const exam = eSnap.exists() ? eSnap.data() : {};
        return { id: d.id, ...v, exam };
      }));
      setResults(data);
      setLoading(false);
    };
    if (currentUser) fetch();
  }, [currentUser]);

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Institution Logo" className="h-10 w-10 object-contain" />
          <div>
            <div className="text-xl font-bold text-gray-800">Idara Misbah ul Quran Mangment System</div>
            <div className="text-sm text-gray-500">My Results</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Download PDF</button>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300">Back</button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subject</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Class</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Marks</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr><td colSpan="4" className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-center">No results yet.</td></tr>
            ) : (
              results.sort((a,b)=>a.exam.date.localeCompare(b.exam.date)).map(r => (
                <tr key={r.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{r.exam.subject}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">Class {r.exam.className}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{r.exam.date}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{r.marks}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentResults;
