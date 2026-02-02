import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Theme {
  id: string
  nameKey: string
  colors: {
    primary: string
    primaryHover: string
    primaryLight: string
    background: string
    backgroundSecondary: string
    sidebar: string
    sidebarText: string
    sidebarHover: string
    card: string
    cardBorder: string
    text: string
    textSecondary: string
    accent: string
  }
}

// Predefined themes
export const themes: Theme[] = [
  {
    id: 'default',
    nameKey: 'themes.default',
    colors: {
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      primaryLight: '#eff6ff',
      background: '#f3f4f6',
      backgroundSecondary: '#ffffff',
      sidebar: '#1e293b',
      sidebarText: '#94a3b8',
      sidebarHover: '#334155',
      card: '#ffffff',
      cardBorder: '#e5e7eb',
      text: '#111827',
      textSecondary: '#6b7280',
      accent: '#3b82f6',
    },
  },
  {
    id: 'emerald',
    nameKey: 'themes.emerald',
    colors: {
      primary: '#10b981',
      primaryHover: '#059669',
      primaryLight: '#ecfdf5',
      background: '#f0fdf4',
      backgroundSecondary: '#ffffff',
      sidebar: '#064e3b',
      sidebarText: '#a7f3d0',
      sidebarHover: '#065f46',
      card: '#ffffff',
      cardBorder: '#d1fae5',
      text: '#064e3b',
      textSecondary: '#047857',
      accent: '#10b981',
    },
  },
  {
    id: 'violet',
    nameKey: 'themes.violet',
    colors: {
      primary: '#8b5cf6',
      primaryHover: '#7c3aed',
      primaryLight: '#f5f3ff',
      background: '#faf5ff',
      backgroundSecondary: '#ffffff',
      sidebar: '#4c1d95',
      sidebarText: '#c4b5fd',
      sidebarHover: '#5b21b6',
      card: '#ffffff',
      cardBorder: '#e9d5ff',
      text: '#4c1d95',
      textSecondary: '#7c3aed',
      accent: '#8b5cf6',
    },
  },
  {
    id: 'amber',
    nameKey: 'themes.amber',
    colors: {
      primary: '#f59e0b',
      primaryHover: '#d97706',
      primaryLight: '#fffbeb',
      background: '#fefce8',
      backgroundSecondary: '#ffffff',
      sidebar: '#78350f',
      sidebarText: '#fcd34d',
      sidebarHover: '#92400e',
      card: '#ffffff',
      cardBorder: '#fde68a',
      text: '#78350f',
      textSecondary: '#b45309',
      accent: '#f59e0b',
    },
  },
  {
    id: 'rose',
    nameKey: 'themes.rose',
    colors: {
      primary: '#f43f5e',
      primaryHover: '#e11d48',
      primaryLight: '#fff1f2',
      background: '#fef2f2',
      backgroundSecondary: '#ffffff',
      sidebar: '#881337',
      sidebarText: '#fda4af',
      sidebarHover: '#9f1239',
      card: '#ffffff',
      cardBorder: '#fecdd3',
      text: '#881337',
      textSecondary: '#be123c',
      accent: '#f43f5e',
    },
  },
  {
    id: 'cyan',
    nameKey: 'themes.cyan',
    colors: {
      primary: '#06b6d4',
      primaryHover: '#0891b2',
      primaryLight: '#ecfeff',
      background: '#f0fdfa',
      backgroundSecondary: '#ffffff',
      sidebar: '#164e63',
      sidebarText: '#67e8f9',
      sidebarHover: '#155e75',
      card: '#ffffff',
      cardBorder: '#a5f3fc',
      text: '#164e63',
      textSecondary: '#0e7490',
      accent: '#06b6d4',
    },
  },
  {
    id: 'slate',
    nameKey: 'themes.slate',
    colors: {
      primary: '#64748b',
      primaryHover: '#475569',
      primaryLight: '#f1f5f9',
      background: '#e2e8f0',
      backgroundSecondary: '#f8fafc',
      sidebar: '#0f172a',
      sidebarText: '#94a3b8',
      sidebarHover: '#1e293b',
      card: '#ffffff',
      cardBorder: '#cbd5e1',
      text: '#0f172a',
      textSecondary: '#475569',
      accent: '#64748b',
    },
  },
  {
    id: 'dark',
    nameKey: 'themes.dark',
    colors: {
      primary: '#60a5fa',
      primaryHover: '#3b82f6',
      primaryLight: '#1e3a5f',
      background: '#0f172a',
      backgroundSecondary: '#1e293b',
      sidebar: '#020617',
      sidebarText: '#94a3b8',
      sidebarHover: '#1e293b',
      card: '#1e293b',
      cardBorder: '#334155',
      text: '#f1f5f9',
      textSecondary: '#94a3b8',
      accent: '#60a5fa',
    },
  },
]

interface ThemeState {
  currentTheme: Theme
  setTheme: (themeId: string) => void
  applyTheme: (theme: Theme) => void
}

// Apply theme to CSS variables
const applyThemeToDOM = (theme: Theme) => {
  const root = document.documentElement
  
  root.style.setProperty('--color-primary', theme.colors.primary)
  root.style.setProperty('--color-primary-hover', theme.colors.primaryHover)
  root.style.setProperty('--color-primary-light', theme.colors.primaryLight)
  root.style.setProperty('--color-background', theme.colors.background)
  root.style.setProperty('--color-background-secondary', theme.colors.backgroundSecondary)
  root.style.setProperty('--color-sidebar', theme.colors.sidebar)
  root.style.setProperty('--color-sidebar-text', theme.colors.sidebarText)
  root.style.setProperty('--color-sidebar-hover', theme.colors.sidebarHover)
  root.style.setProperty('--color-card', theme.colors.card)
  root.style.setProperty('--color-card-border', theme.colors.cardBorder)
  root.style.setProperty('--color-text', theme.colors.text)
  root.style.setProperty('--color-text-secondary', theme.colors.textSecondary)
  root.style.setProperty('--color-accent', theme.colors.accent)
  
  // Generate primary color shades for Tailwind compatibility
  root.style.setProperty('--color-primary-50', theme.colors.primaryLight)
  root.style.setProperty('--color-primary-500', theme.colors.primary)
  root.style.setProperty('--color-primary-600', theme.colors.primary)
  root.style.setProperty('--color-primary-700', theme.colors.primaryHover)
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      currentTheme: themes[0],
      
      setTheme: (themeId: string) => {
        const theme = themes.find(t => t.id === themeId) || themes[0]
        set({ currentTheme: theme })
        applyThemeToDOM(theme)
      },
      
      applyTheme: (theme: Theme) => {
        applyThemeToDOM(theme)
      },
    }),
    {
      name: 'tms-theme',
      onRehydrateStorage: () => (state) => {
        // Apply theme after rehydration from localStorage
        if (state?.currentTheme) {
          applyThemeToDOM(state.currentTheme)
        }
      },
    }
  )
)
