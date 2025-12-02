import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase-config';
const departments = ['Dars-e-Nizami','Hifz','Tajweed'];
const DARS_CLASSES = ['Mutwasta','Aama Arzbic (A)','Aama Arabic (B)','Aama English','Khasa - I','Khasa - II','Matric','Intermediate (IX)','Aalia - I (X)','Aalia - II (XI)','Aalamia - I (XII)','Almia - II (XI)'];
const HIFZ_CLASSES = ['Amer Bin Khatab','Abdullah Bin Masood','Zaid Bin Sabit','Musab Bin Omair','Abdullah Bin Abbas','Osman Ghani','Abee Bin Kaab','Abu Bakar Siddique','Ali-ul-Murtazi','Naseerah Murseed'];
const TAJWEED_CLASSES = ['Class 1st year','Class IInd year'];

const EditStudent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    className: '',
    rollNumber: '',
    parentName: '',
    parentPhone: ''
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const docRef = doc(db, "students", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setFormData(docSnap.data());
        } else {
          setError("Student not found");
        }
      } catch (err) {
        console.error("Error fetching student:", err);
        setError("Failed to fetch student details");
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [id]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setError('');

    try {
      const docRef = doc(db, "students", id);
      
      // Update student document
      await updateDoc(docRef, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        department: formData.department,
        className: formData.className,
        rollNumber: formData.rollNumber,
        parentName: formData.parentName,
        parentPhone: formData.parentPhone
        // We don't update email or role here usually
      });

      // Optionally update 'users' collection if name changed
      const userDocRef = doc(db, "users", id);
      // Check if user doc exists first (it should)
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
          // Update relevant fields if they exist in users collection
          // For now, we only stored email/role/createdAt in users, so maybe nothing to update there
          // unless we want to sync names later.
      }

      alert('Student updated successfully!');
      navigate('/admin/students');
    } catch (err) {
      console.error("Error updating student:", err);
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="text-center p-10">Loading...</div>;
  if (error) return <div className="text-center p-10 text-red-600">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Edit Student</h2>
        <button 
          onClick={() => navigate('/admin/students')}
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

          {/* Account Info - Read Only */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Email (Login ID)</label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-500 bg-gray-100 leading-tight focus:outline-none focus:shadow-outline"
              type="email"
              name="email"
              value={formData.email}
              readOnly
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed here.</p>
          </div>
          
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
            className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
            type="submit"
            disabled={updating}
          >
            {updating ? 'Updating...' : 'Update Student'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditStudent;
