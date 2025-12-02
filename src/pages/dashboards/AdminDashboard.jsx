import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../firebase-config';
import logo from '../../../assets/main-logo-1-e1724093314271.png';
import hero from '../../../assets/masjid-pic-scaled-1-1024x681.jpg';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ students: 0, teachers: 0, revenue: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const sSnap = await getDocs(query(collection(db, 'students')));
      const tSnap = await getDocs(query(collection(db, 'teachers')));
      const fSnap = await getDocs(query(collection(db, 'fees')));
      let revenue = 0;
      fSnap.docs.forEach(d => {
        const v = d.data();
        if (v.status === 'paid') revenue += Number(v.amount) || 0;
      });
      setStats({ students: sSnap.size, teachers: tSnap.size, revenue });
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-lg overflow-hidden" style={{ backgroundImage: `url(${hero})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="bg-black bg-opacity-40">
          <div className="p-6 flex items-center gap-4">
            <img src={logo} alt="Institution Logo" className="h-12 w-12 object-contain" />
            <div>
              <div className="text-white text-2xl font-bold">Idara Misbah ul Quran Mangment System</div>
              <div className="text-white text-sm">Admin Dashboard</div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <aside className="md:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h3>
            <div className="flex flex-col gap-3">
              <button onClick={() => navigate('/admin/add-student')} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Add Student</button>
              <button onClick={() => navigate('/admin/students')} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">View Students</button>
              <button onClick={() => navigate('/admin/add-teacher')} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Add Teacher</button>
              <button onClick={() => navigate('/admin/teachers')} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">View Teachers</button>
              <button onClick={() => navigate('/admin/fees')} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Manage Fees</button>
              <button onClick={() => navigate('/admin/timetable')} className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800">Manage Timetable</button>
              <button onClick={() => navigate('/admin/exams')} className="px-4 py-2 bg-orange-700 text-white rounded hover:bg-orange-800">Manage Exams</button>
              <button onClick={() => navigate('/admin/finance/income')} className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800">Income</button>
              <button onClick={() => navigate('/admin/finance/expense')} className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800">Expense</button>
              <button onClick={() => navigate('/admin/finance/reports')} className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800">Finance Reports</button>
              <button onClick={() => navigate('/admin/backup')} className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800">Backup & Restore</button>
            </div>
          </div>
        </aside>
        <section className="md:col-span-3">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div 
              className="p-6 bg-white rounded-lg shadow-md border-l-4 border-blue-500 cursor-pointer hover:shadow-lg transition"
              onClick={() => navigate('/admin/students')}
            >
              <h3 className="text-lg font-semibold text-gray-700">Total Students</h3>
              <p className="text-3xl font-bold text-blue-600">{stats.students}</p>
              <p className="text-sm text-gray-500 mt-2">Click to view list</p>
            </div>
            <div 
              className="p-6 bg-white rounded-lg shadow-md border-l-4 border-green-500 cursor-pointer hover:shadow-lg transition"
              onClick={() => navigate('/admin/teachers')}
            >
              <h3 className="text-lg font-semibold text-gray-700">Total Teachers</h3>
              <p className="text-3xl font-bold text-green-600">{stats.teachers}</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-md border-l-4 border-purple-500">
              <h3 className="text-lg font-semibold text-gray-700">Total Revenue</h3>
              <p className="text-3xl font-bold text-purple-600">PKR {stats.revenue.toLocaleString()}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
