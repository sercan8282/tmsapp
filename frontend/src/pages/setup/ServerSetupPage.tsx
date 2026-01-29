/**
 * Server Setup Page
 * Allows users to configure the backend server URL
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useServerConfigStore } from '@/stores/serverConfigStore'
import { ServerIcon, ArrowRightIcon, ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { useAppStore } from '@/stores/appStore'

export default function ServerSetupPage() {
  const navigate = useNavigate()
  const { setServerUrl } = useServerConfigStore()
  const { fetchSettings } = useAppStore()
  
  const [url, setUrl] = useState('')
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [serverInfo, setServerInfo] = useState<{ name: string; logo?: string } | null>(null)

  const validateUrl = (input: string): string | null => {
    try {
      const parsed = new URL(input)
      
      // Only allow http and https
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return 'URL moet beginnen met http:// of https://'
      }
      
      // Prevent localhost in production builds
      if (import.meta.env.PROD && 
          (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
        return 'Localhost is niet toegestaan in productie'
      }
      
      // Prevent IP addresses without explicit port (security best practice)
      // Allow IP addresses only on local networks for testing
      const ipv4Regex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
      if (ipv4Regex.test(parsed.hostname)) {
        const parts = parsed.hostname.split('.').map(Number)
        const isPrivate = 
          parts[0] === 10 ||
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
          (parts[0] === 192 && parts[1] === 168)
        
        if (!isPrivate && import.meta.env.PROD) {
          return 'Publieke IP-adressen zijn niet toegestaan. Gebruik een domeinnaam.'
        }
      }
      
      return null
    } catch {
      return 'Ongeldige URL'
    }
  }

  const testConnection = async () => {
    const validationError = validateUrl(url)
    if (validationError) {
      setError(validationError)
      return
    }

    setTesting(true)
    setError(null)
    setSuccess(false)
    setServerInfo(null)

    try {
      // Normalize URL
      const normalizedUrl = url.replace(/\/+$/, '')
      
      // Test connection by fetching public settings
      const response = await fetch(`${normalizedUrl}/api/core/settings/`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Server antwoordde met status ${response.status}`)
      }

      const data = await response.json()
      
      setServerInfo({
        name: data.app_name || 'TMS Server',
        logo: data.logo_url,
      })
      setSuccess(true)
    } catch (err: any) {
      console.error('Connection test failed:', err)
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setError('Kan geen verbinding maken met de server. Controleer de URL en of de server bereikbaar is.')
      } else {
        setError(err.message || 'Kan geen verbinding maken met de server')
      }
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!success) {
      await testConnection()
      return
    }

    // Save the configuration
    const normalizedUrl = url.replace(/\/+$/, '')
    setServerUrl(normalizedUrl, serverInfo?.name)
    
    // Fetch settings from the new server
    await fetchSettings()
    
    // Navigate to login
    navigate('/login')
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value)
    setError(null)
    setSuccess(false)
    setServerInfo(null)
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary-600 to-primary-800">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo/Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <ServerIcon className="h-10 w-10 text-white" />
          </div>
        </div>
        
        <h1 className="text-center text-3xl font-bold text-white mb-2">
          TMS Configuratie
        </h1>
        <p className="text-center text-white/80 mb-8">
          Voer de server URL in om verbinding te maken
        </p>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* URL Input */}
            <div>
              <label htmlFor="serverUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Server URL
              </label>
              <input
                id="serverUrl"
                type="url"
                value={url}
                onChange={handleUrlChange}
                placeholder="https://moveo-bv.nl"
                className="input-field w-full"
                autoComplete="url"
                autoFocus
              />
              <p className="mt-2 text-xs text-gray-500">
                Bijv: https://moveo-bv.nl of https://tms.bedrijf.nl
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <ExclamationCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && serverInfo && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                {serverInfo.logo ? (
                  <img src={serverInfo.logo} alt="" className="h-10 w-10 rounded-lg object-contain" />
                ) : (
                  <CheckCircleIcon className="h-10 w-10 text-green-500" />
                )}
                <div>
                  <p className="font-medium text-green-800">{serverInfo.name}</p>
                  <p className="text-sm text-green-600">Verbinding succesvol!</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={testing || !url}
              className="w-full flex items-center justify-center gap-2 btn-primary py-3"
            >
              {testing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Verbinding testen...
                </>
              ) : success ? (
                <>
                  Doorgaan naar login
                  <ArrowRightIcon className="h-5 w-5" />
                </>
              ) : (
                <>
                  Verbinding testen
                  <ArrowRightIcon className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Development Mode Option */}
          {import.meta.env.DEV && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  // In development, use relative URLs (Vite proxy)
                  setServerUrl('', 'Lokale ontwikkeling')
                  navigate('/login')
                }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
              >
                🔧 Lokale ontwikkelomgeving (dev mode)
              </button>
            </div>
          )}

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Vraag je beheerder om de juiste server URL als je deze niet weet.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
