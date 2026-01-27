import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { authApi } from '@/api/auth'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  
  // Actions
  setUser: (user: User | null) => void
  setTokens: (access: string, refresh: string) => void
  login: (email: string, password: string) => Promise<{ requires2FA: boolean; userId?: string }>
  verify2FA: (userId: string, code: string) => Promise<void>
  logout: () => void
  fetchProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      
      setTokens: (access, refresh) => set({ 
        accessToken: access, 
        refreshToken: refresh,
        isAuthenticated: true,
      }),
      
      login: async (email, password) => {
        const response = await authApi.login({ email, password })
        
        if (response.requires_2fa) {
          return { requires2FA: true, userId: response.user_id }
        }
        
        set({
          user: response.user,
          accessToken: response.access,
          refreshToken: response.refresh,
          isAuthenticated: true,
          isLoading: false,
        })
        
        return { requires2FA: false }
      },
      
      verify2FA: async (userId, code) => {
        const response = await authApi.verify2FA({ user_id: userId, code })
        
        set({
          user: response.user,
          accessToken: response.access,
          refreshToken: response.refresh,
          isAuthenticated: true,
          isLoading: false,
        })
      },
      
      logout: () => {
        const { refreshToken } = get()
        if (refreshToken) {
          authApi.logout(refreshToken).catch(() => {})
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        })
      },
      
      fetchProfile: async () => {
        try {
          set({ isLoading: true })
          const user = await authApi.getProfile()
          set({ user, isAuthenticated: true, isLoading: false })
        } catch {
          set({ 
            user: null, 
            accessToken: null, 
            refreshToken: null, 
            isAuthenticated: false, 
            isLoading: false 
          })
        }
      },
    }),
    {
      name: 'tms-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          state.fetchProfile()
        } else {
          state?.setUser(null)
          useAuthStore.setState({ isLoading: false })
        }
      },
    }
  )
)
