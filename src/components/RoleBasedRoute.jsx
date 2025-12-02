import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RoleBasedRoute = ({ children, allowedRoles }) => {
  const { currentUser, userRole } = useAuth();

  if (!currentUser) {
    return <Navigate to="/" />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
     // Redirect to unauthorized page or dashboard if role doesn't match
     // For now, let's redirect to a generic "Unauthorized" view or just stay on dashboard with limited access
     // But simpler is to just redirect to home/login if they try to access something they shouldn't
     // A better approach:
     return <div className="p-10 text-center text-red-600">You do not have permission to view this page.</div>;
  }

  return children;
};

export default RoleBasedRoute;
