/**
 * PWA Update Prompt Component
 * Shows a prompt when a new version of the app is available
 */
import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline'

export default function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log('Service Worker registered:', swUrl)
      
      // Check for updates every hour
      if (registration) {
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)
      }
    },
    onRegisterError(error) {
      console.error('Service Worker registration error:', error)
    },
  })

  useEffect(() => {
    if (needRefresh) {
      setShowPrompt(true)
    }
  }, [needRefresh])

  const handleUpdate = () => {
    updateServiceWorker(true)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    setNeedRefresh(false)
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-slide-up">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <ArrowPathIcon className="h-5 w-5 text-primary-600" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">
              Update beschikbaar
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Er is een nieuwe versie van TMS beschikbaar. Herlaad om de nieuwste versie te gebruiken.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleUpdate}
                className="btn-primary text-sm py-1.5 px-3"
              >
                Nu updaten
              </button>
              <button
                onClick={handleDismiss}
                className="btn-secondary text-sm py-1.5 px-3"
              >
                Later
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
