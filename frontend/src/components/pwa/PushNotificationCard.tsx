/**
 * Push Notification Subscribe Card
 * Allows users to subscribe/unsubscribe from push notifications
 */
import { useState } from 'react'
import {
  BellIcon,
  BellSlashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline'
import { usePushNotifications } from '@/hooks/usePushNotifications'

export default function PushNotificationCard() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    pushConfig,
    subscribe,
    unsubscribe,
  } = usePushNotifications()

  const [deviceName, setDeviceName] = useState('')
  const [showDeviceInput, setShowDeviceInput] = useState(false)

  const handleSubscribe = async () => {
    if (!showDeviceInput && !isSubscribed) {
      setShowDeviceInput(true)
      return
    }
    
    const success = await subscribe(deviceName || undefined)
    if (success) {
      setShowDeviceInput(false)
      setDeviceName('')
    }
  }

  const handleUnsubscribe = async () => {
    if (window.confirm('Weet je zeker dat je geen push notificaties meer wilt ontvangen?')) {
      await unsubscribe()
    }
  }

  // Not supported
  if (!isSupported) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <BellSlashIcon className="h-6 w-6 text-gray-400" />
          <div>
            <h3 className="text-sm font-medium text-gray-900">Push notificaties niet beschikbaar</h3>
            <p className="text-sm text-gray-500">
              Je browser of apparaat ondersteunt geen push notificaties.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Push not configured by admin
  if (!pushConfig?.is_configured) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500" />
          <div>
            <h3 className="text-sm font-medium text-yellow-900">Push notificaties niet beschikbaar</h3>
            <p className="text-sm text-yellow-700">
              Push notificaties zijn nog niet ingesteld door de beheerder.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Permission denied
  if (permission === 'denied') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <BellSlashIcon className="h-6 w-6 text-red-500" />
          <div>
            <h3 className="text-sm font-medium text-red-900">Notificaties geblokkeerd</h3>
            <p className="text-sm text-red-700">
              Je hebt notificaties geblokkeerd. Wijzig dit in je browser instellingen om push notificaties te ontvangen.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start gap-4">
        <div className={`p-2 rounded-lg ${isSubscribed ? 'bg-green-100' : 'bg-gray-100'}`}>
          {isSubscribed ? (
            <BellIcon className="h-6 w-6 text-green-600" />
          ) : (
            <BellSlashIcon className="h-6 w-6 text-gray-500" />
          )}
        </div>
        
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900">
            Push Notificaties
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {isSubscribed 
              ? 'Je ontvangt push notificaties op dit apparaat.' 
              : 'Ontvang meldingen over belangrijke updates, zelfs als de app niet open is.'}
          </p>

          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}

          {/* Device name input */}
          {showDeviceInput && !isSubscribed && (
            <div className="mt-3 flex items-center gap-2">
              <DevicePhoneMobileIcon className="h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Apparaat naam (optioneel)"
                className="input-field text-sm flex-1"
              />
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {isSubscribed ? (
              <button
                onClick={handleUnsubscribe}
                disabled={isLoading}
                className="btn-secondary text-sm"
              >
                {isLoading ? (
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <BellSlashIcon className="h-4 w-4 mr-2" />
                )}
                Uitschrijven
              </button>
            ) : (
              <>
                <button
                  onClick={handleSubscribe}
                  disabled={isLoading}
                  className="btn-primary text-sm"
                >
                  {isLoading ? (
                    <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <BellIcon className="h-4 w-4 mr-2" />
                  )}
                  {showDeviceInput ? 'Bevestigen' : 'Inschakelen'}
                </button>
                {showDeviceInput && (
                  <button
                    onClick={() => {
                      setShowDeviceInput(false)
                      setDeviceName('')
                    }}
                    className="btn-secondary text-sm"
                  >
                    Annuleren
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status indicator */}
      {isSubscribed && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircleIcon className="h-4 w-4" />
            <span>Push notificaties zijn actief</span>
          </div>
        </div>
      )}
    </div>
  )
}
