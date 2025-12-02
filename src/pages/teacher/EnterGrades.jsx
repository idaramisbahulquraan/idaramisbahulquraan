import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase-config';
import logo from '../../../assets/main-logo-1-e1724093314271.png';

const EnterGrades = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchExams = async () => {
      const snap = await getDocs(query(collection(db, 'exams')));
      setExams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    fetchExams();
  }, []);

  const loadStudentsForExam = async (examId) => {
    setSelectedExam(examId);
    if (!examId) return setStudents([]);
    const examSnap = await getDoc(doc(db, 'exams', examId));
    const exam = examSnap.data();
    const base = collection(db, 'students');
    const q = exam.department ? query(base, where('department','==', exam.department), where('className', '==', exam.className)) : query(base, where('className', '==', exam.className));
    const sSnap = await getDocs(q);
    const data = sSnap.docs.map(d => ({ id: d.id, ...d.data(), marks: '' }));
    setStudents(data);
  };

  const setMarks = (id, m) => {
    setStudents(students.map(s => (s.id === id ? { ...s, marks: m } : s)));
  };

  const submitMarks = async () => {
    if (!selectedExam) return;
    setSaving(true);
    const writes = students.map(async (s) => {
      const resId = `${selectedExam}_${s.id}`;
      await setDoc(doc(db, 'examResults', resId), {
        uid: resId,
        examId: selectedExam,
        department: (exams.find(e => e.id === selectedExam)?.department) || null,
        studentId: s.id,
        marks: Number(s.marks || 0),
        teacherId: currentUser?.uid || null,
        createdAt: new Date()
      });
    });
    await Promise.all(writes);
    alert('Grades saved');
    navigate('/dashboard');
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Institution Logo" className="h-10 w-10 object-contain" />
          <div>
            <div className="text-xl font-bold text-gray-800">Idara Misbah ul Quran Mangment System</div>
            <div className="text-sm text-gray-500">Enter Grades</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Download PDF</button>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300">Back</button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-6">
        <label className="block text-gray-700 text-sm font-bold mb-2">Select Exam</label>
        <select value={selectedExam} onChange={(e) => loadStudentsForExam(e.target.value)} className="shadow border rounded w-full py-2 px-3">
          <option value="">Select an exam</option>
          {exams.map(e => (
            <option key={e.id} value={e.id}>{e.department ? e.department + ' - ' : ''}{e.className} - {e.subject} - {e.date}</option>
          ))}
        </select>
      </div>

      {selectedExam && (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Student</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Marks</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{s.firstName} {s.lastName}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <input type="number" min="0" className="shadow border rounded w-24 py-1 px-2" value={s.marks} onChange={(e)=>setMarks(s.id, e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end mt-6">
        <button onClick={submitMarks} disabled={!selectedExam || saving} className={`px-4 py-2 bg-yellow-600 text-white rounded ${saving ? 'opacity-50 cursor-not-allowed': ''}`}>{saving ? 'Saving...' : 'Submit Grades'}</button>
      </div>
    </div>
  );
};

export default EnterGrades;
