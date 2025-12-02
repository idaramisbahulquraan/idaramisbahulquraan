import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, doc, deleteDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase-config';
import logo from '../../../assets/main-logo-1-e1724093314271.png';

const TeacherList = () => {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const q = query(collection(db, 'teachers'));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTeachers(data);
      } finally {
        setLoading(false);
      }
    };
    fetchTeachers();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Delete this teacher?')) {
      await deleteDoc(doc(db, 'teachers', id));
      await deleteDoc(doc(db, 'users', id));
      setTeachers(teachers.filter(t => t.id !== id));
      alert('Deleted');
    }
  };

  if (loading) return <div className="text-center p-10">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Institution Logo" className="h-10 w-10 object-contain" />
          <div>
            <div className="text-xl font-bold text-gray-800">Idara Misbah ul Quran Mangment System</div>
            <div className="text-sm text-gray-500">Teacher List</div>
          </div>
        </div>
        <div className="space-x-4">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Download PDF
          </button>
          <button
            onClick={() => navigate('/admin/add-teacher')}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Add Teacher
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subject</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-center">No teachers found.</td>
              </tr>
            ) : (
              teachers.map(t => (
                <tr key={t.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900">{t.firstName} {t.lastName}</p>
                    <p className="text-gray-500 text-xs">{t.email}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{t.subject}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{t.phone}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <button
                      onClick={() => navigate(`/admin/teachers/edit/${t.id}`)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
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

export default TeacherList;
