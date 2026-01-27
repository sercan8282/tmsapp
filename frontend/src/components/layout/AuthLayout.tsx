import { useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthStore()
  const { settings, fetchSettings } = useAppStore()
  
  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }
  
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {settings?.logo_url ? (
          <img
            className="mx-auto h-16 w-auto"
            src={settings.logo_url}
            alt={settings.app_name}
          />
        ) : (
          <h1 className="text-center text-3xl font-bold text-primary-600">
            {settings?.app_name || 'TMS'}
          </h1>
        )}
      </div>
      
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
