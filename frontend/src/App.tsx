import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useServerConfigStore } from '@/stores/serverConfigStore'

// Layouts
import DashboardLayout from '@/components/layout/DashboardLayout'
import AuthLayout from '@/components/layout/AuthLayout'

// PWA Components
import { PWAUpdatePrompt, PWAInstallPrompt } from '@/components/pwa'

// Font Components
import FontLoader from '@/components/fonts/FontLoader'

// Setup pages
import ServerSetupPage from '@/pages/setup/ServerSetupPage'

// Auth pages
import LoginPage from '@/pages/auth/LoginPage'
import MfaSetupPage from '@/pages/auth/MfaSetupPage'

// Dashboard pages
import DashboardPage from '@/pages/dashboard/DashboardPage'

// Admin pages
import UsersPage from '@/pages/admin/UsersPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import FontManagementPage from '@/pages/settings/FontManagementPage'

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

// Revenue
import RevenuePage from '@/pages/revenue/RevenuePage'

// Invoice Import (OCR)
import { InvoiceImportPage, InvoiceImportDetailPage } from '@/pages/imports'

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, pendingMfaSetup } = useAuthStore()
  const { isConfigured } = useServerConfigStore()
  
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }
  
  // Redirect to server setup if not configured
  if (!isConfigured) {
    return <Navigate to="/setup" replace />
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

// Server Config wrapper - redirects to dashboard if already configured and logged in
function SetupRoute({ children }: { children: React.ReactNode }) {
  const { isConfigured } = useServerConfigStore()
  const { isAuthenticated } = useAuthStore()
  
  // If already configured and authenticated, redirect to dashboard
  if (isConfigured && isAuthenticated) {
    return <Navigate to="/" replace />
  }
  
  return <>{children}</>
}

// Auth Route wrapper - requires server config
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isConfigured } = useServerConfigStore()
  const { isAuthenticated } = useAuthStore()
  
  // Redirect to server setup if not configured
  if (!isConfigured) {
    return <Navigate to="/setup" replace />
  }
  
  // Redirect to dashboard if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />
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
  const { isAuthenticated } = useAuthStore()
  const { isConfigured } = useServerConfigStore()
  
  return (
    <>
      {/* PWA Components */}
      <PWAUpdatePrompt />
      <PWAInstallPrompt />
      
      {/* Load custom fonts when authenticated and configured */}
      {isConfigured && isAuthenticated && <FontLoader />}
      
      <Routes>
      {/* Server setup route */}
      <Route 
        path="/setup" 
        element={
          <SetupRoute>
            <ServerSetupPage />
          </SetupRoute>
        } 
      />
      
      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route 
          path="/login" 
          element={
            <AuthRoute>
              <LoginPage />
            </AuthRoute>
          } 
        />
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
        <Route path="/settings/fonts" element={<AdminRoute><FontManagementPage /></AdminRoute>} />
        
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

        {/* Revenue */}
        <Route path="/revenue" element={<AdminRoute><RevenuePage /></AdminRoute>} />

        {/* Invoice Import (OCR) */}
        <Route path="/imports" element={<AdminRoute><InvoiceImportPage /></AdminRoute>} />
        <Route path="/imports/:id" element={<AdminRoute><InvoiceImportDetailPage /></AdminRoute>} />
      </Route>
      
      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}

export default App
