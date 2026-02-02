import api from './client'
import type { AppSettings, AppSettingsAdmin } from '@/types'

export interface DashboardStats {
  users: number
  companies: number
  vehicles: number
  hours_this_week: number
  open_invoices: number
  week_number: number
  year: number
}

export interface ActivityItem {
  type: 'invoice' | 'planning' | 'leave' | 'user' | 'company'
  icon: string
  title: string
  description: string
  status: string
  timestamp: string
  user: string | null
  link: string
}

export interface RecentActivityResponse {
  activities: ActivityItem[]
}

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
  
  deleteLogo: async (): Promise<AppSettingsAdmin> => {
    const response = await api.post('/core/admin/settings/delete-logo/')
    return response.data
  },
  
  deleteFavicon: async (): Promise<AppSettingsAdmin> => {
    const response = await api.post('/core/admin/settings/delete-favicon/')
    return response.data
  },
  
  testEmail: async (toEmail: string): Promise<{ message: string }> => {
    const response = await api.post('/core/admin/settings/test-email/', { to_email: toEmail })
    return response.data
  },
  
  // Dashboard stats
  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/core/dashboard/stats/')
    return response.data
  },
  
  // Recent activity
  getRecentActivity: async (limit: number = 10): Promise<RecentActivityResponse> => {
    const response = await api.get(`/core/dashboard/activity/?limit=${limit}`)
    return response.data
  },
  
  // Image upload
  uploadImage: async (file: File): Promise<{ url: string; filename: string; size: number }> => {
    const formData = new FormData()
    formData.append('image', file)
    const response = await api.post('/core/upload/image/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
}
