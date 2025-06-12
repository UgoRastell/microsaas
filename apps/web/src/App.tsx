import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { Toaster } from 'react-hot-toast'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Invoices from './pages/Invoices'
import NewInvoice from './pages/NewInvoice'
import ViewInvoice from './pages/ViewInvoice'
import EditInvoice from './pages/EditInvoice'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'
import ResetPassword from './pages/ResetPassword'

// Components
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

// Create Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

function App() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate initial loading
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <SessionContextProvider supabaseClient={supabase}>
      <Toaster position="top-right" toastOptions={{
        success: {
          duration: 3000,
          style: {
            background: '#10B981',
            color: 'white',
          },
        },
        error: {
          duration: 4000,
          style: {
            background: '#EF4444',
            color: 'white',
          },
        },
      }} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/new" element={<NewInvoice />} />
            <Route path="/invoices/:id" element={<ViewInvoice />} />
            <Route path="/invoices/:id/edit" element={<EditInvoice />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </SessionContextProvider>
  )
}

export default App
