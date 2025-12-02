import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SeedAdmin from './pages/SeedAdmin';
import AddStudent from './pages/admin/AddStudent';
import EditStudent from './pages/admin/EditStudent';
import StudentList from './pages/admin/StudentList';
import AddTeacher from './pages/admin/AddTeacher';
import TeacherList from './pages/admin/TeacherList';
import EditTeacher from './pages/admin/EditTeacher';
import ManageFees from './pages/admin/ManageFees';
import ManageTimetable from './pages/admin/ManageTimetable';
import ManageExams from './pages/admin/ManageExams';
import TakeAttendance from './pages/teacher/TakeAttendance';
import EnterGrades from './pages/teacher/EnterGrades';
import TeacherTimetable from './pages/teacher/TeacherTimetable';
import StudentAttendance from './pages/student/StudentAttendance';
import StudentTimetable from './pages/student/StudentTimetable';
import StudentResults from './pages/student/StudentResults';
import ManageIncome from './pages/admin/ManageIncome';
import ManageExpense from './pages/admin/ManageExpense';
import FinanceReports from './pages/admin/FinanceReports';
import BackupRestore from './pages/admin/BackupRestore';
import RoleBasedRoute from './components/RoleBasedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';

const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/" />;
};

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-100">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/seed-admin" element={<SeedAdmin />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          {/* Admin Routes */}
          <Route
            path="/admin/add-student"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <AddStudent />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/students"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <StudentList />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/students/edit/:id"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <EditStudent />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/add-teacher"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <AddTeacher />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/teachers"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <TeacherList />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/teachers/edit/:id"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <EditTeacher />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/fees"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <ManageFees />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/timetable"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <ManageTimetable />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/exams"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <ManageExams />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/teacher/attendance"
            element={
              <RoleBasedRoute allowedRoles={['teacher']}>
                <TakeAttendance />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/teacher/grades"
            element={
              <RoleBasedRoute allowedRoles={['teacher']}>
                <EnterGrades />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/teacher/timetable"
            element={
              <RoleBasedRoute allowedRoles={['teacher']}>
                <TeacherTimetable />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/student/attendance"
            element={
              <RoleBasedRoute allowedRoles={['student']}>
                <StudentAttendance />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/student/timetable"
            element={
              <RoleBasedRoute allowedRoles={['student']}>
                <StudentTimetable />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/student/results"
            element={
              <RoleBasedRoute allowedRoles={['student']}>
                <StudentResults />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/finance/income"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <ManageIncome />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/finance/expense"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <ManageExpense />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/finance/reports"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <FinanceReports />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/backup"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <BackupRestore />
              </RoleBasedRoute>
            }
          />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
