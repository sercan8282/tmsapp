import axios from 'axios'
import { useServerConfigStore } from '@/stores/serverConfigStore'
import type { LicenseStatusResponse, LicenseActivateResponse } from '@/types'

/**
 * Get the current API base URL without auth interceptors.
 * License endpoints are public (AllowAny) and must NOT send auth tokens,
 * because an expired JWT would cause a 401 before AllowAny is checked.
 */
function getBaseUrl(): string {
  const serverConfig = useServerConfigStore.getState()
  if (serverConfig.isConfigured) {
    return serverConfig.getApiUrl()
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:8001/api'
  }
  return '/api'
}

export const licensingApi = {
  /**
   * Get current license status (no auth required)
   */
  getStatus: async (): Promise<LicenseStatusResponse> => {
    const response = await axios.get(`${getBaseUrl()}/licensing/status/`)
    return response.data
  },

  /**
   * Activate a license key (no auth required)
   */
  activate: async (licenseKey: string): Promise<LicenseActivateResponse> => {
    const response = await axios.post(`${getBaseUrl()}/licensing/activate/`, {
      license_key: licenseKey,
    })
    return response.data
  },
}
