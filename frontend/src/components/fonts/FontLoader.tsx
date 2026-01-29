/**
 * Font Loader Component
 * Dynamically loads custom fonts from the backend
 */
import { useEffect, useState } from 'react'
import { fontsApi } from '@/api/fonts'
import { useServerConfigStore } from '@/stores/serverConfigStore'

export default function FontLoader() {
  const [loaded, setLoaded] = useState(false)
  const { isConfigured, serverUrl } = useServerConfigStore()

  useEffect(() => {
    if (!isConfigured || loaded) return

    const loadFonts = async () => {
      try {
        // Get CSS from API
        const css = await fontsApi.getCss()
        
        if (css && css.trim()) {
          // Create a style element and inject the CSS
          const styleId = 'custom-fonts-css'
          let styleEl = document.getElementById(styleId) as HTMLStyleElement
          
          if (!styleEl) {
            styleEl = document.createElement('style')
            styleEl.id = styleId
            styleEl.setAttribute('data-custom-fonts', 'true')
            document.head.appendChild(styleEl)
          }
          
          styleEl.textContent = css
          setLoaded(true)
        }
      } catch (error) {
        console.error('Failed to load custom fonts:', error)
      }
    }

    loadFonts()
  }, [isConfigured, serverUrl, loaded])

  // Re-load when server changes
  useEffect(() => {
    setLoaded(false)
  }, [serverUrl])

  return null // This component doesn't render anything
}

/**
 * Hook to get available font families
 */
export function useFontFamilies() {
  const [families, setFamilies] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFamilies = async () => {
      try {
        const data = await fontsApi.getFamilies()
        const familyNames = data.map(f => f.family)
        // Add system fonts
        const allFamilies = [
          'Inter', // Default
          'System UI',
          'Arial',
          'Helvetica',
          'Georgia',
          'Times New Roman',
          ...familyNames,
        ]
        setFamilies([...new Set(allFamilies)])
      } catch (error) {
        console.error('Failed to fetch font families:', error)
        // Fallback to system fonts
        setFamilies(['Inter', 'System UI', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman'])
      } finally {
        setLoading(false)
      }
    }

    fetchFamilies()
  }, [])

  return { families, loading }
}
