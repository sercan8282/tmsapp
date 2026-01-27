import api from './client'
import type { AppSettings, AppSettingsAdmin } from '@/types'

export const settingsApi = {
  // Public settings (no auth required)
  getPublic: async (): Promise<AppSettings> => {
    const response = await api.get('/core/settings/')
    return response.data
  },
  
  // Admin settings
  getAdmin: async (): Promise<AppSettingsAdmin> => {
    const response = await api.get('/core/admin/settings/')
    return response.data
  },
  
  update: async (data: Partial<AppSettingsAdmin>): Promise<AppSettingsAdmin> => {
    const response = await api.patch('/core/admin/settings/', data)
    return response.data
  },
  
  uploadLogo: async (file: File): Promise<AppSettingsAdmin> => {
    const formData = new FormData()
    formData.append('logo', file)
    const response = await api.post('/core/admin/settings/upload-logo/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
  
  uploadFavicon: async (file: File): Promise<AppSettingsAdmin> => {
    const formData = new FormData()
    formData.append('favicon', file)
    const response = await api.post('/core/admin/settings/upload-favicon/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
  
  testEmail: async (toEmail: string): Promise<{ message: string }> => {
    const response = await api.post('/core/admin/settings/test-email/', { to_email: toEmail })
    return response.data
  },
}
