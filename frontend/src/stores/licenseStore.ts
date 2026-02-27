import { create } from 'zustand'
import { licensingApi } from '@/api/licensing'
import type { LicenseInfo } from '@/types'

interface LicenseState {
  isLicensed: boolean
  license: LicenseInfo | null
  isLoading: boolean
  error: string | null
  
  // Actions
  checkLicense: () => Promise<boolean>
  clearLicense: () => void
}

export const useLicenseStore = create<LicenseState>()((set) => ({
  isLicensed: false,
  license: null,
  isLoading: true,
  error: null,

  checkLicense: async () => {
    try {
      set({ isLoading: true, error: null })
      const data = await licensingApi.getStatus()
      
      set({
        isLicensed: data.licensed,
        license: data.license || null,
        isLoading: false,
      })
      
      return data.licensed
    } catch (err: any) {
      // If we get a network error, assume no license check possible
      // but don't block access (server might not have the table yet)
      set({
        isLicensed: false,
        license: null,
        isLoading: false,
        error: err.message || 'License check failed',
      })
      return false
    }
  },

  clearLicense: () => {
    set({
      isLicensed: false,
      license: null,
      isLoading: false,
      error: null,
    })
  },
}))
