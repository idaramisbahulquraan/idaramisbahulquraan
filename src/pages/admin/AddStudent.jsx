import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase-config';

// We need a secondary app instance to create a user WITHOUT logging out the admin
const firebaseConfig = {
  apiKey: "AIzaSyB0oPTLEYuNiWCx5s9GmZzGzyH1z-HXwb8",
  authDomain: "onlineadmission-f85c6.firebaseapp.com",
  projectId: "onlineadmission-f85c6",
  storageBucket: "onlineadmission-f85c6.firebasestorage.app",
  messagingSenderId: "996707362986",
  appId: "1:996707362986:web:fea98a07bea032ff7e48d3",
  measurementId: "G-6H910NXDM1"
};

// Initialize secondary app
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

const AddStudent = () => {
  const navigate = useNavigate();
  const departments = ['Dars-e-Nizami','Hifz','Tajweed'];
  const DARS_CLASSES = ['Mutwasta','Aama Arzbic (A)','Aama Arabic (B)','Aama English','Khasa - I','Khasa - II','Matric','Intermediate (IX)','Aalia - I (X)','Aalia - II (XI)','Aalamia - I (XII)','Almia - II (XI)'];
  const HIFZ_CLASSES = ['Amer Bin Khatab','Abdullah Bin Masood','Zaid Bin Sabit','Musab Bin Omair','Abdullah Bin Abbas','Osman Ghani','Abee Bin Kaab','Abu Bakar Siddique','Ali-ul-Murtazi','Naseerah Murseed'];
  const TAJWEED_CLASSES = ['Class 1st year','Class IInd year'];

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    department: '',
    className: '',
    rollNumber: '',
    parentName: '',
    parentPhone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Create User in Authentication (using secondary app)
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        formData.email, 
        formData.password
      );
      const user = userCredential.user;

      // 2. Create User Profile in Firestore (using main app db)
      // We store general user info in 'users' collection for role management
      await setDoc(doc(db, "users", user.uid), {
        email: formData.email,
        role: 'student',
        createdAt: new Date()
      });

      // 3. Create Student Details in 'students' collection
      await setDoc(doc(db, "students", user.uid), {
        uid: user.uid,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        department: formData.department,
        className: formData.className,
        rollNumber: formData.rollNumber,
        parentName: formData.parentName,
        parentPhone: formData.parentPhone,
        role: 'student',
        createdAt: new Date()
      });

      alert('Student added successfully!');
      navigate('/dashboard');
    } catch (err) {
      console.error("Error adding student:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Add New Student</h2>
        <button 
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
        >
          Back
        </button>
      </div>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Info */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">First Name</label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Last Name</label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
            />
          </div>

          {/* Account Info */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Email (Login ID)</label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Password</label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="6"
            />
          </div>

          {/* Academic Info */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Department</label>
            <select
              className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
            >
              <option value="">Select Department</option>
              {departments.map(d => (<option key={d} value={d}>{d}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Class / Section</label>
            <select
              className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              name="className"
              value={formData.className}
              onChange={handleChange}
              required
            >
              <option value="">Select Class</option>
              {(formData.department === 'Dars-e-Nizami' ? DARS_CLASSES : formData.department === 'Hifz' ? HIFZ_CLASSES : formData.department === 'Tajweed' ? TAJWEED_CLASSES : []).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Roll Number</label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              type="text"
              name="rollNumber"
              value={formData.rollNumber}
              onChange={handleChange}
              required
            />
          </div>

          {/* Parent Info */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Parent Name</label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              type="text"
              name="parentName"
              value={formData.parentName}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Parent Phone</label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              type="tel"
              name="parentPhone"
              value={formData.parentPhone}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-end mt-6">
          <button
            className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating Student...' : 'Add Student'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddStudent;
