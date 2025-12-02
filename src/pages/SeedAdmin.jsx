import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase-config';

const SeedAdmin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSeed = async (e) => {
    e.preventDefault();
    try {
      // Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create Firestore Doc with 'admin' role
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        role: 'admin',
        createdAt: new Date()
      });

      setMessage('Admin user created successfully! You can now login.');
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen flex justify-center items-center">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Create First Admin</h2>
        {message && <p className="mb-4 text-sm text-blue-600">{message}</p>}
        <form onSubmit={handleSeed} className="space-y-4">
          <input
            type="email"
            placeholder="Admin Email"
            className="w-full p-2 border rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-2 border rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
            Create Admin
          </button>
        </form>
      </div>
    </div>
  );
};

export default SeedAdmin;
