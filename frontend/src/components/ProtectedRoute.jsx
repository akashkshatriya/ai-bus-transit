import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from './LoadingSpinner';

export const ProtectedRoute = ({ children, allowedRole }) => {
  const { isAuthenticated, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center space-y-4">
        <LoadingSpinner size="lg" message="Verifying authentication..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect unauthenticated user to login page
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // If role does not match the allowed role, redirect to user's assigned role dashboard
  if (allowedRole && role !== allowedRole) {
    const targetRoute = role === 'driver' ? '/driver' : role === 'admin' ? '/admin' : '/passenger';
    return <Navigate to={targetRoute} replace />;
  }

  return children;
};

export default ProtectedRoute;
