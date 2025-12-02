import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../../assets/main-logo-1-e1724093314271.png';
import hero from '../../../assets/IMG_0943-scaled-1-1024x681.jpg';

const StudentDashboard = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="rounded-lg overflow-hidden" style={{ backgroundImage: `url(${hero})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="bg-black bg-opacity-40">
          <div className="p-6 flex items-center gap-4">
            <img src={logo} alt="Institution Logo" className="h-12 w-12 object-contain" />
            <div>
              <div className="text-white text-2xl font-bold">Idara Misbah ul Quran Mangment System</div>
              <div className="text-white text-sm">Student Dashboard</div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <aside className="md:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h3>
            <div className="flex flex-col gap-3">
              <button onClick={() => navigate('/student/timetable')} className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">View Timetable</button>
              <button onClick={() => navigate('/student/results')} className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">My Results</button>
              <button onClick={() => navigate('/student/attendance')} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">My Attendance</button>
            </div>
          </div>
        </aside>
        <section className="md:col-span-3 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="p-6 bg-white rounded-lg shadow-md border-l-4 border-teal-500">
            <h3 className="text-lg font-semibold text-gray-700">Attendance</h3>
            <p className="text-3xl font-bold text-teal-600">95%</p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md border-l-4 border-orange-500">
            <h3 className="text-lg font-semibold text-gray-700">Next Exam</h3>
            <p className="text-xl font-bold text-orange-600">Math - Oct 12</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default StudentDashboard;
