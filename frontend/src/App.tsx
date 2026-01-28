import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

// Layouts
import DashboardLayout from '@/components/layout/DashboardLayout'
import AuthLayout from '@/components/layout/AuthLayout'

// Auth pages
import LoginPage from '@/pages/auth/LoginPage'
import MfaSetupPage from '@/pages/auth/MfaSetupPage'

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
import MyHoursPage from '@/pages/time-entries/MyHoursPage'
import SubmittedHoursPage from '@/pages/time-entries/SubmittedHoursPage'

// Planning
import PlanningPage from '@/pages/planning/PlanningPage'

// Profile
import PasswordChangePage from '@/pages/profile/PasswordChangePage'

// Invoicing
import InvoicesPage from '@/pages/invoices/InvoicesPage'
import InvoiceCreatePage from '@/pages/invoices/InvoiceCreatePage'
import TemplatesPage from '@/pages/invoices/TemplatesPage'
import InvoiceEditPage from '@/pages/invoices/InvoiceEditPage'
import TemplateEditorPage from '@/pages/invoices/TemplateEditorPage'

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, pendingMfaSetup } = useAuthStore()
  
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
  
  // Redirect to MFA setup if required
  if (pendingMfaSetup) {
    return <Navigate to="/setup-mfa" replace />
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
      
      {/* MFA Setup route - outside of protected route since it has its own protection */}
      <Route path="/setup-mfa" element={<MfaSetupPage />} />
      
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
        <Route path="/my-hours" element={<MyHoursPage />} />
        <Route path="/submitted-hours" element={<SubmittedHoursPage />} />
        
        {/* Planning */}
        <Route path="/planning" element={<PlanningPage />} />
        
        {/* Profile */}
        <Route path="/profile/password" element={<PasswordChangePage />} />

        {/* Invoicing */}
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/new" element={<InvoiceCreatePage />} />
        <Route path="/invoices/:id/edit" element={<InvoiceEditPage />} />
        <Route path="/invoices/templates" element={<AdminRoute><TemplatesPage /></AdminRoute>} />
        <Route path="/invoices/templates/new" element={<AdminRoute><TemplateEditorPage /></AdminRoute>} />
        <Route path="/invoices/templates/:id/edit" element={<AdminRoute><TemplateEditorPage /></AdminRoute>} />
      </Route>
      
      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
