import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

// Layouts
import DashboardLayout from '@/components/layout/DashboardLayout'
import AuthLayout from '@/components/layout/AuthLayout'

// Auth pages
import LoginPage from '@/pages/auth/LoginPage'

// Dashboard pages
import DashboardPage from '@/pages/dashboard/DashboardPage'

// Admin pages
import UsersPage from '@/pages/admin/UsersPage'
import SettingsPage from '@/pages/settings/SettingsPage'

// Master data pages
import CompaniesPage from '@/pages/companies/CompaniesPage'
import DriversPage from '@/pages/drivers/DriversPage'
import FleetPage from '@/pages/fleet/FleetPage'

// Time tracking
import TimeEntriesPage from '@/pages/time-entries/TimeEntriesPage'

// Planning
import PlanningPage from '@/pages/planning/PlanningPage'

// Invoicing
import InvoicesPage from '@/pages/invoices/InvoicesPage'

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

// Admin Route wrapper
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  
  if (!user?.rol || user.rol !== 'admin') {
    return <Navigate to="/" replace />
  }
  
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      
      {/* Protected dashboard routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        
        {/* Admin routes */}
        <Route path="/admin/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
        <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
        
        {/* Master data */}
        <Route path="/companies" element={<CompaniesPage />} />
        <Route path="/drivers" element={<DriversPage />} />
        <Route path="/fleet" element={<FleetPage />} />
        
        {/* Time tracking */}
        <Route path="/time-entries" element={<TimeEntriesPage />} />
        
        {/* Planning */}
        <Route path="/planning" element={<PlanningPage />} />
        
        {/* Invoicing */}
        <Route path="/invoices" element={<InvoicesPage />} />
      </Route>
      
      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
