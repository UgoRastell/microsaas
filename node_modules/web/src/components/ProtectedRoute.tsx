import { useEffect } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useSessionContext } from '@supabase/auth-helpers-react'

const ProtectedRoute = () => {
  const { session, isLoading } = useSessionContext()
  const location = useLocation()

  // Show loading indicator while session is being checked
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  // Redirect to login if user is not authenticated
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
