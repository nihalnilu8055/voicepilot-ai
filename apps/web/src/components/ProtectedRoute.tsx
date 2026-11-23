import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireCompany?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireCompany = true }) => {
  const { user, loading, memberships } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-xs text-slate-400">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If page requires an active company membership and user has none, redirect to company setup
  if (requireCompany && memberships.length === 0 && location.pathname !== '/company-setup') {
    return <Navigate to="/company-setup" replace />;
  }

  return <>{children}</>;
};
