/**
 * Push Notifications Settings Component
 * Admin interface for configuring push notification providers (Web Push/Firebase)
 */
import { useState, useEffect } from 'react'
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
      
      // Clear sensitive fields (they're write-only)
      setVapidPrivateKey('')
      setFirebaseApiKey('')
    } catch (err: any) {
      console.error('Failed to load push settings:', err)
      onError?.('Kon push instellingen niet laden')
    } finally {
      setLoading(false)
    }
  }

  const handleProviderChange = (newProvider: 'none' | 'webpush' | 'firebase') => {
    setProvider(newProvider)
    setHasChanges(true)
  }

  const handleGenerateVapidKeys = async () => {
    try {
      setGeneratingKeys(true)
      const keys: VapidKeys = await pushApi.generateVapidKeys()
      
      setVapidPublicKey(keys.public_key)
      setVapidPrivateKey(keys.private_key)
      setHasChanges(true)
      
      onSuccess?.('VAPID keys gegenereerd! Vergeet niet op te slaan.')
    } catch (err: any) {
      console.error('Failed to generate VAPID keys:', err)
      onError?.('Kon VAPID keys niet genereren')
    } finally {
      setGeneratingKeys(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      
      const updateData: any = { provider }
      
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
      
      onSuccess?.('Push instellingen opgeslagen')
    } catch (err: any) {
      console.error('Failed to save push settings:', err)
      onError?.(err.response?.data?.detail || 'Kon push instellingen niet opslaan')
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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Push Notificaties</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configureer push notificaties om gebruikers op de hoogte te houden van belangrijke updates.
        </p>
      </div>

      {/* Status indicator */}
      <div className={`p-4 rounded-lg ${settings?.is_configured ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
        <div className="flex items-center gap-2">
          {settings?.is_configured ? (
            <>
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Push notificaties zijn geconfigureerd ({settings?.provider_display})
              </span>
            </>
          ) : (
            <>
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                Push notificaties zijn nog niet geconfigureerd
              </span>
            </>
          )}
        </div>
      </div>

      {/* Provider Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Provider
        </label>
        <div className="space-y-3">
          {/* None */}
          <label className="flex items-start cursor-pointer p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="push-provider"
              value="none"
              checked={provider === 'none'}
              onChange={() => handleProviderChange('none')}
              className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
            />
            <div className="ml-3">
              <span className="block text-sm font-medium text-gray-900">Uitgeschakeld</span>
              <span className="block text-sm text-gray-500">Push notificaties zijn uitgeschakeld</span>
            </div>
          </label>

          {/* Web Push (VAPID) */}
          <label className="flex items-start cursor-pointer p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="push-provider"
              value="webpush"
              checked={provider === 'webpush'}
              onChange={() => handleProviderChange('webpush')}
              className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
            />
            <div className="ml-3 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">Web Push (VAPID)</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  Gratis
                </span>
              </div>
              <span className="block text-sm text-gray-500">
                Standaard Web Push API met zelf-gegenereerde VAPID keys. Geen externe service nodig.
              </span>
            </div>
          </label>

          {/* Firebase */}
          <label className="flex items-start cursor-pointer p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="push-provider"
              value="firebase"
              checked={provider === 'firebase'}
              onChange={() => handleProviderChange('firebase')}
              className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
            />
            <div className="ml-3 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">Firebase Cloud Messaging</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  Google
                </span>
              </div>
              <span className="block text-sm text-gray-500">
                Google Firebase Cloud Messaging. Vereist een Firebase account en project.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Web Push (VAPID) Settings */}
      {provider === 'webpush' && (
        <div className="border-t pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium text-gray-900">Web Push (VAPID) Configuratie</h3>
            <button
              onClick={handleGenerateVapidKeys}
              disabled={generatingKeys}
              className="btn-secondary text-sm"
            >
              {generatingKeys ? (
                <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <SparklesIcon className="h-4 w-4 mr-2" />
              )}
              Keys Genereren
            </button>
          </div>

          <p className="text-sm text-gray-500">
            VAPID (Voluntary Application Server Identification) keys worden gebruikt om je server te identificeren 
            bij push services. Je kunt deze automatisch genereren of zelf invoeren.
          </p>

          <div className="grid grid-cols-1 gap-6">
            {/* Admin Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin E-mail <span className="text-red-500">*</span>
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
                Contactadres voor push services (wordt niet gedeeld met gebruikers)
              </p>
            </div>

            {/* Public Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Public Key <span className="text-red-500">*</span>
              </label>
              <textarea
                value={vapidPublicKey}
                onChange={(e) => {
                  setVapidPublicKey(e.target.value)
                  setHasChanges(true)
                }}
                rows={2}
                className="input-field font-mono text-sm"
                placeholder="BEl62iUYgUi..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Wordt gedeeld met browsers voor push subscriptions
              </p>
            </div>

            {/* Private Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Private Key {settings?.has_vapid_private_key ? '' : <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <textarea
                  value={vapidPrivateKey}
                  onChange={(e) => {
                    setVapidPrivateKey(e.target.value)
                    setHasChanges(true)
                  }}
                  rows={2}
                  className="input-field font-mono text-sm pr-10"
                  placeholder={settings?.has_vapid_private_key ? '(versleuteld opgeslagen)' : 'Voer private key in...'}
                />
                <button
                  type="button"
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
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
                Wordt versleuteld opgeslagen in de database
                {settings?.has_vapid_private_key && (
                  <span className="text-green-600 ml-2">✓ Opgeslagen</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Firebase Settings */}
      {provider === 'firebase' && (
        <div className="border-t pt-6 space-y-6">
          <h3 className="text-base font-medium text-gray-900">Firebase Configuratie</h3>
          
          <p className="text-sm text-gray-500">
            Configureer Firebase Cloud Messaging voor push notificaties. 
            Je hebt een Firebase project nodig met Cloud Messaging ingeschakeld.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Project ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={firebaseProjectId}
                onChange={(e) => {
                  setFirebaseProjectId(e.target.value)
                  setHasChanges(true)
                }}
                className="input-field"
                placeholder="my-project-12345"
              />
            </div>

            {/* Sender ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sender ID <span className="text-red-500">*</span>
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

            {/* API Key */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Server Key / API Key {settings?.has_firebase_api_key ? '' : <span className="text-red-500">*</span>}
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
                  placeholder={settings?.has_firebase_api_key ? '(versleuteld opgeslagen)' : 'Voer API key in...'}
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
                Wordt versleuteld opgeslagen in de database
                {settings?.has_firebase_api_key && (
                  <span className="text-green-600 ml-2">✓ Opgeslagen</span>
                )}
              </p>
            </div>
          </div>

          {/* Firebase setup instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Firebase instellen:</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Ga naar de <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Firebase Console</a></li>
              <li>Maak een nieuw project of selecteer een bestaand project</li>
              <li>Ga naar Project Settings → Cloud Messaging</li>
              <li>Kopieer de Server Key en Sender ID</li>
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
                Opslaan...
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-5 w-5 mr-2" />
                Instellingen Opslaan
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
