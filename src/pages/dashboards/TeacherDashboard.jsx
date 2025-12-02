import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../../assets/main-logo-1-e1724093314271.png';
import hero from '../../../assets/IMG_0644-scaled-1-e1724219058522.jpg';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="rounded-lg overflow-hidden" style={{ backgroundImage: `url(${hero})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="bg-black bg-opacity-40">
          <div className="p-6 flex items-center gap-4">
            <img src={logo} alt="Institution Logo" className="h-12 w-12 object-contain" />
            <div>
              <div className="text-white text-2xl font-bold">Idara Misbah ul Quran Mangment System</div>
              <div className="text-white text-sm">Teacher Dashboard</div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <aside className="md:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h3>
            <div className="flex flex-col gap-3">
              <button onClick={() => navigate('/teacher/attendance')} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Take Attendance</button>
              <button onClick={() => navigate('/teacher/grades')} className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">Enter Grades</button>
              <button onClick={() => navigate('/teacher/timetable')} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">My Timetable</button>
            </div>
          </div>
        </aside>
        <section className="md:col-span-3 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="p-6 bg-white rounded-lg shadow-md border-l-4 border-indigo-500">
            <h3 className="text-lg font-semibold text-gray-700">My Classes</h3>
            <p className="text-3xl font-bold text-indigo-600">5</p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md border-l-4 border-yellow-500">
            <h3 className="text-lg font-semibold text-gray-700">Pending Grades</h3>
            <p className="text-3xl font-bold text-yellow-600">12</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TeacherDashboard;
