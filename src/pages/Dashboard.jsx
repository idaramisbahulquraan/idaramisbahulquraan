import React from 'react';
import logo from '../../assets/main-logo-1-e1724093314271.png';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from './dashboards/AdminDashboard';
import TeacherDashboard from './dashboards/TeacherDashboard';
import StudentDashboard from './dashboards/StudentDashboard';

const Dashboard = () => {
  const { userRole, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const renderDashboard = () => {
    switch (userRole) {
      case 'admin':
        return <AdminDashboard />;
      case 'teacher':
        return <TeacherDashboard />;
      case 'student':
        return <StudentDashboard />;
      case 'parent':
         return <div className="p-6 text-center">Parent Dashboard Coming Soon</div>;
      default:
        return <div className="p-6 text-center text-gray-500">Loading Dashboard... (Role: {userRole})</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <nav className="bg-white shadow-sm">
        <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <img src={logo} alt="Institution Logo" className="h-10 w-10 object-contain mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Idara Misbah ul Quran Mangment System</h1>
            </div>
            <div className="flex items-center">
              <span className="mr-4 text-sm text-gray-600 capitalize">Role: {userRole}</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 focus:outline-none"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-10">
        <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          {renderDashboard()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
