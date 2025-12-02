import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase-config';

const firebaseConfig = {
  apiKey: "AIzaSyB0oPTLEYuNiWCx5s9GmZzGzyH1z-HXwb8",
  authDomain: "onlineadmission-f85c6.firebaseapp.com",
  projectId: "onlineadmission-f85c6",
  storageBucket: "onlineadmission-f85c6.firebasestorage.app",
  messagingSenderId: "996707362986",
  appId: "1:996707362986:web:fea98a07bea032ff7e48d3",
  measurementId: "G-6H910NXDM1"
};

const secondaryApp = initializeApp(firebaseConfig, 'SecondaryTeacher');
const secondaryAuth = getAuth(secondaryApp);

const AddTeacher = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    subject: '',
    phone: ''
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
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        formData.email,
        formData.password
      );
      const user = cred.user;

      await setDoc(doc(db, 'users', user.uid), {
        email: formData.email,
        role: 'teacher',
        createdAt: new Date()
      });

      await setDoc(doc(db, 'teachers', user.uid), {
        uid: user.uid,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        subject: formData.subject,
        phone: formData.phone,
        role: 'teacher',
        createdAt: new Date()
      });

      alert('Teacher added successfully');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Add New Teacher</h2>
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

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Email</label>
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

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Subject</label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Phone</label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-end mt-6">
          <button
            className={`bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Add Teacher'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddTeacher;
