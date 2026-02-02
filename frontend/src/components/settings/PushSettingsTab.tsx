/**
 * Push Notifications Settings Component
 * Admin interface for configuring push notification providers (Web Push/Firebase)
 * Only contains provider configuration - Groups, Schedules, Send, Sent are in the Notifications page
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { pushApi, type PushSettings, type VapidKeys } from '@/api/push'

interface PushSettingsTabProps {
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

export default function PushSettingsTab({ onSuccess, onError }: PushSettingsTabProps) {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<PushSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generatingKeys, setGeneratingKeys] = useState(false)
  
  // Form state
  const [provider, setProvider] = useState<'none' | 'webpush' | 'firebase'>('none')
  const [vapidPublicKey, setVapidPublicKey] = useState('')
  const [vapidPrivateKey, setVapidPrivateKey] = useState('')
  const [vapidAdminEmail, setVapidAdminEmail] = useState('')
  const [firebaseProjectId, setFirebaseProjectId] = useState('')
  const [firebaseApiKey, setFirebaseApiKey] = useState('')
  const [firebaseSenderId, setFirebaseSenderId] = useState('')
  const [pollInterval, setPollInterval] = useState(10)
  
  // Password visibility
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [showFirebaseKey, setShowFirebaseKey] = useState(false)
  
  // Track changes
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const data = await pushApi.getSettings()
      setSettings(data)
      
      // Initialize form state
      setProvider(data.provider)
      setVapidPublicKey(data.vapid_public_key || '')
      setVapidAdminEmail(data.vapid_admin_email || '')
      setFirebaseProjectId(data.firebase_project_id || '')
      setFirebaseSenderId(data.firebase_sender_id || '')
      setPollInterval(data.notification_poll_interval || 10)
      
      setHasChanges(false)
    } catch (err: any) {
      console.error('Failed to load push settings:', err)
      onError?.(t('settings.couldNotLoadPushSettings'))
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateKeys = async () => {
    try {
      setGeneratingKeys(true)
      const keys: VapidKeys = await pushApi.generateVapidKeys()
      
      setVapidPublicKey(keys.public_key)
      setVapidPrivateKey(keys.private_key)
      setHasChanges(true)
      
      onSuccess?.(t('settings.keysGenerated'))
    } catch (err: any) {
      console.error('Failed to generate VAPID keys:', err)
      onError?.(t('settings.couldNotGenerateKeys'))
    } finally {
      setGeneratingKeys(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      
      const updateData: any = { provider, notification_poll_interval: pollInterval }
      
      if (provider === 'webpush') {
        updateData.vapid_public_key = vapidPublicKey
        updateData.vapid_admin_email = vapidAdminEmail
        if (vapidPrivateKey) {
          updateData.vapid_private_key = vapidPrivateKey
        }
      } else if (provider === 'firebase') {
        updateData.firebase_project_id = firebaseProjectId
        updateData.firebase_sender_id = firebaseSenderId
        if (firebaseApiKey) {
          updateData.firebase_api_key = firebaseApiKey
        }
      }
      
      const updated = await pushApi.updateSettings(updateData)
      setSettings(updated)
      setHasChanges(false)
      
      // Clear sensitive fields after save
      setVapidPrivateKey('')
      setFirebaseApiKey('')
      
      onSuccess?.(t('settings.saved'))
    } catch (err: any) {
      console.error('Failed to save push settings:', err)
      onError?.(err.response?.data?.detail || t('errors.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t('settings.pushSettings')}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {t('settings.oauthDescription').replace('OAuth for Microsoft Exchange Online', 'Web Push or Firebase')}
        </p>
      </div>

      <div className="space-y-8">
        {/* Status indicator */}
        <div className={`p-4 rounded-lg ${settings?.is_configured ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className="flex items-center gap-2">
            {settings?.is_configured ? (
              <>
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  {t('notifications.pushConfigured')} ({settings?.provider_display})
                </span>
              </>
            ) : (
              <>
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">
                  {t('notifications.pushNotConfigured')}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Notification Poll Interval */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('settings.pollInterval')}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="5"
              max="300"
              value={pollInterval}
              onChange={(e) => {
                const value = Math.max(5, Math.min(300, parseInt(e.target.value) || 10))
                setPollInterval(value)
                setHasChanges(true)
              }}
              className="input-field w-24"
            />
            <span className="text-sm text-gray-600">{t('common.seconds')}</span>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {t('notifications.pollIntervalHint')}
          </p>
        </div>

        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            {t('settings.pushProvider')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* None */}
            <button
              type="button"
              onClick={() => {
                setProvider('none')
                setHasChanges(true)
              }}
              className={`p-4 border-2 rounded-lg text-left transition-colors ${
                provider === 'none'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">{t('settings.disabled')}</div>
              <div className="text-sm text-gray-500 mt-1">
                {t('notifications.noPushNotifications')}
              </div>
            </button>

            {/* Web Push */}
            <button
              type="button"
              onClick={() => {
                setProvider('webpush')
                setHasChanges(true)
              }}
              className={`p-4 border-2 rounded-lg text-left transition-colors ${
                provider === 'webpush'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">{t('settings.webPush')}</div>
              <div className="text-sm text-gray-500 mt-1">
                {t('notifications.webPushRecommended')}
              </div>
            </button>

            {/* Firebase */}
            <button
              type="button"
              onClick={() => {
                setProvider('firebase')
                setHasChanges(true)
              }}
              className={`p-4 border-2 rounded-lg text-left transition-colors ${
                provider === 'firebase'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">{t('settings.firebase')}</div>
              <div className="text-sm text-gray-500 mt-1">
                {t('notifications.firebaseLegacy')}
              </div>
            </button>
          </div>
        </div>

        {/* Web Push (VAPID) Settings */}
        {provider === 'webpush' && (
          <div className="space-y-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-semibold text-blue-900">{t('notifications.vapidConfiguration')}</h3>
              <button
                onClick={handleGenerateKeys}
                disabled={generatingKeys}
                className="btn-secondary text-sm"
              >
                {generatingKeys ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                    {t('settings.generatingKeys')}
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-4 w-4 mr-2" />
                    {t('notifications.generateNewKeys')}
                  </>
                )}
              </button>
            </div>

            <div className="space-y-4">
              {/* Admin Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('settings.adminEmail')} (mailto:)
                </label>
                <input
                  type="email"
                  value={vapidAdminEmail}
                  onChange={(e) => {
                    setVapidAdminEmail(e.target.value)
                    setHasChanges(true)
                  }}
                  className="input-field"
                  placeholder="admin@example.com"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('notifications.contactAddress')}
                </p>
              </div>

              {/* Public Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VAPID Public Key
                </label>
                <input
                  type="text"
                  value={vapidPublicKey}
                  onChange={(e) => {
                    setVapidPublicKey(e.target.value)
                    setHasChanges(true)
                  }}
                  className="input-field font-mono text-sm"
                  placeholder="BEz3..."
                />
              </div>

              {/* Private Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VAPID Private Key
                </label>
                <div className="relative">
                  <input
                    type={showPrivateKey ? 'text' : 'password'}
                    value={vapidPrivateKey}
                    onChange={(e) => {
                      setVapidPrivateKey(e.target.value)
                      setHasChanges(true)
                    }}
                    className="input-field pr-10 font-mono text-sm"
                    placeholder={settings?.has_vapid_private_key ? t('notifications.encryptedStored') : t('notifications.enterPrivateKey')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPrivateKey ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                  <KeyIcon className="h-3 w-3" />
                  {t('notifications.encryptedInDatabase')}
                  {settings?.has_vapid_private_key && (
                    <span className="text-green-600 ml-2">✓ {t('common.saved')}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-white border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">{t('notifications.howWebPushWorks')}</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>{t('notifications.vapidAutoGenerated')}</li>
                <li>{t('notifications.worksInBrowsers')}</li>
                <li>{t('notifications.noExternalService')}</li>
                <li>{t('notifications.freePrivacy')}</li>
              </ul>
            </div>
          </div>
        )}

        {/* Firebase Settings */}
        {provider === 'firebase' && (
          <div className="space-y-6 p-6 bg-orange-50 border border-orange-200 rounded-lg">
            <h3 className="text-md font-semibold text-orange-900">{t('notifications.firebaseConfiguration')}</h3>

            <div className="space-y-4">
              {/* Project ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project ID
                </label>
                <input
                  type="text"
                  value={firebaseProjectId}
                  onChange={(e) => {
                    setFirebaseProjectId(e.target.value)
                    setHasChanges(true)
                  }}
                  className="input-field"
                  placeholder="my-app-12345"
                />
              </div>

              {/* Sender ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sender ID
                </label>
                <input
                  type="text"
                  value={firebaseSenderId}
                  onChange={(e) => {
                    setFirebaseSenderId(e.target.value)
                    setHasChanges(true)
                  }}
                  className="input-field"
                  placeholder="123456789012"
                />
              </div>

              {/* Firebase API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Server Key / API Key
                </label>
                <div className="relative">
                  <input
                    type={showFirebaseKey ? 'text' : 'password'}
                    value={firebaseApiKey}
                    onChange={(e) => {
                      setFirebaseApiKey(e.target.value)
                      setHasChanges(true)
                    }}
                    className="input-field pr-10"
                    placeholder={settings?.has_firebase_api_key ? t('notifications.encryptedStored') : t('notifications.enterApiKey')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowFirebaseKey(!showFirebaseKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showFirebaseKey ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                  <KeyIcon className="h-3 w-3" />
                  {t('notifications.encryptedInDatabase')}
                  {settings?.has_firebase_api_key && (
                    <span className="text-green-600 ml-2">✓ {t('common.saved')}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Firebase setup instructions */}
            <div className="bg-white border border-orange-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-orange-900 mb-2">{t('notifications.firebaseSetup')}:</h4>
              <ol className="text-sm text-orange-800 space-y-1 list-decimal list-inside">
                <li>{t('notifications.firebaseStep1')} <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Firebase Console</a></li>
                <li>{t('notifications.firebaseStep2')}</li>
                <li>{t('notifications.firebaseStep3')}</li>
                <li>{t('notifications.firebaseStep4')}</li>
              </ol>
            </div>
          </div>
        )}

        {/* Save Button */}
        {hasChanges && (
          <div className="border-t pt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  {t('common.save')}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
