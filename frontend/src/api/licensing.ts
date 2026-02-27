import api from './client'
import type { LicenseStatusResponse, LicenseActivateResponse } from '@/types'

export const licensingApi = {
  /**
   * Get current license status (no auth required)
   */
  getStatus: async (): Promise<LicenseStatusResponse> => {
    const response = await api.get('/licensing/status/')
    return response.data
  },

  /**
   * Activate a license key (no auth required)
   */
  activate: async (licenseKey: string): Promise<LicenseActivateResponse> => {
    const response = await api.post('/licensing/activate/', {
      license_key: licenseKey,
    })
    return response.data
  },
}
