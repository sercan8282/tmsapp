/**
 * PWA Update Prompt Component
 * Shows a prompt when a new version of the app is available
 * 
 * iOS Safari specific handling:
 * - iOS doesn't check for updates in background like Android
 * - We need to check on visibility change and focus events
 * - Also check more frequently (every 5 minutes when active)
 */
import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline'

// Detect iOS
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export default function PWAUpdatePrompt() {
  const { t } = useTranslation()
  const [showPrompt, setShowPrompt] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, reg) {
      console.log('Service Worker registered:', swUrl)
      setRegistration(reg || null)
      
      if (reg) {
        // Initial update check
        reg.update()
        
        // Check for updates periodically
        // iOS: every 5 minutes when active
        // Android: every hour
        const interval = isIOS() ? 5 * 60 * 1000 : 60 * 60 * 1000
        setInterval(() => {
          reg.update()
        }, interval)
      }
    },
    onRegisterError(error) {
      console.error('Service Worker registration error:', error)
    },
  })

  // Check for updates when app becomes visible (crucial for iOS)
  const checkForUpdates = useCallback(() => {
    if (registration) {
      console.log('Checking for service worker updates...')
      registration.update()
    }
  }, [registration])

  useEffect(() => {
    // iOS specific: check for updates on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates()
      }
    }

    // iOS specific: check for updates on focus
    const handleFocus = () => {
      checkForUpdates()
    }

    // iOS specific: check for updates when app is resumed from background
    const handlePageShow = (event: PageTransitionEvent) => {
      // persisted means the page was restored from bfcache
      if (event.persisted) {
        checkForUpdates()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('pageshow', handlePageShow)

    // Also check on initial load for iOS
    if (isIOS()) {
      // Small delay to ensure SW is registered
      setTimeout(checkForUpdates, 1000)
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [checkForUpdates])

  useEffect(() => {
    if (needRefresh) {
      setShowPrompt(true)
      
      // On iOS, auto-update after 3 seconds if user doesn't interact
      // This ensures the app always gets the latest version
      if (isIOS()) {
        const timeout = setTimeout(() => {
          if (needRefresh) {
            console.log('Auto-updating on iOS...')
            updateServiceWorker(true)
          }
        }, 3000)
        return () => clearTimeout(timeout)
      }
    }
  }, [needRefresh, updateServiceWorker])

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
              {t('pwa.updateAvailable')}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {isIOS() 
                ? t('pwa.newVersionLoading')
                : t('pwa.newVersionAvailable')
              }
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleUpdate}
                className="btn-primary text-sm py-1.5 px-3"
              >
                {t('pwa.updateNow')}
              </button>
              {!isIOS() && (
                <button
                  onClick={handleDismiss}
                  className="btn-secondary text-sm py-1.5 px-3"
                >
                  {t('pwa.later')}
                </button>
              )}
            </div>
          </div>
          {!isIOS() && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-gray-400 hover:text-gray-500"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
