/**
 * License Status Card
 * 
 * Shows current license information in the settings page.
 * Displays customer name, expiry, status, and warnings.
 * Allows admins to update/renew the license key.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
  KeyIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { licensingApi } from '@/api/licensing'
import { useLicenseStore } from '@/stores/licenseStore'
import type { LicenseInfo } from '@/types'

export default function LicenseStatusCard() {
  const { t } = useTranslation()
  const { checkLicense } = useLicenseStore()
  const [license, setLicense] = useState<LicenseInfo | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Renewal form state
  const [showRenewForm, setShowRenewForm] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [activating, setActivating] = useState(false)
  const [renewError, setRenewError] = useState<string | null>(null)
  const [renewSuccess, setRenewSuccess] = useState(false)

  useEffect(() => {
    loadLicenseStatus()
  }, [])

  const loadLicenseStatus = async () => {
    try {
      setLoading(true)
      const data = await licensingApi.getStatus()
      setLicense(data.license || null)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }

  const handleRenew = async () => {
    const key = newKey.trim()
    if (!key) {
      setRenewError(t('license.enterKey', 'Voer een licentiesleutel in.'))
      return
    }

    setActivating(true)
    setRenewError(null)
    setRenewSuccess(false)

    try {
      const result = await licensingApi.activate(key)
      if (result.success) {
        setRenewSuccess(true)
        setNewKey('')
        setShowRenewForm(false)
        // Refresh license data in both card and global store
        await loadLicenseStatus()
        await checkLicense()
      } else {
        setRenewError(result.message || t('license.activationFailed', 'Activatie mislukt.'))
      }
    } catch (err: any) {
      const data = err.response?.data
      if (data?.message) {
        setRenewError(data.message)
      } else if (data?.detail) {
        setRenewError(data.detail)
      } else {
        setRenewError(t('license.activationFailed', 'Activatie mislukt. Controleer de sleutel en probeer opnieuw.'))
      }
    } finally {
      setActivating(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      </div>
    )
  }

  if (!license) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
        <div className="flex items-center gap-3">
          <XCircleIcon className="h-8 w-8 text-red-500 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-red-800 dark:text-red-300">
              {t('license.noLicense', 'Geen actieve licentie')}
            </h4>
            <p className="text-sm text-red-600 dark:text-red-400">
              {t('license.noLicenseDescription', 'Er is geen geldige licentie gevonden voor deze installatie.')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const isExpiringSoon = license.is_expiring_soon
  const isExpired = !license.is_valid

  return (
    <div
      className={`rounded-lg border p-4 ${
        isExpired
          ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
          : isExpiringSoon
          ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
          : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
      }`}
    >
      <div className="flex items-start gap-3">
        {isExpired ? (
          <XCircleIcon className="h-8 w-8 text-red-500 flex-shrink-0" />
        ) : isExpiringSoon ? (
          <ExclamationTriangleIcon className="h-8 w-8 text-yellow-500 flex-shrink-0" />
        ) : (
          <ShieldCheckIcon className="h-8 w-8 text-green-500 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h4
            className={`font-medium ${
              isExpired
                ? 'text-red-800 dark:text-red-300'
                : isExpiringSoon
                ? 'text-yellow-800 dark:text-yellow-300'
                : 'text-green-800 dark:text-green-300'
            }`}
          >
            {isExpired
              ? t('license.expired', 'Licentie verlopen')
              : isExpiringSoon
              ? t('license.expiringSoon', 'Licentie verloopt binnenkort')
              : t('license.active', 'Licentie actief')}
          </h4>

          <div className="mt-2 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                {t('license.customer', 'Klant')}:
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {license.customer_name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                {t('license.expiresAt', 'Geldig tot')}:
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {new Date(license.expires_at).toLocaleDateString('nl-NL')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                {t('license.daysRemaining', 'Dagen resterend')}:
              </span>
              <span
                className={`font-medium ${
                  isExpired
                    ? 'text-red-600 dark:text-red-400'
                    : isExpiringSoon
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-green-600 dark:text-green-400'
                }`}
              >
                {license.days_remaining}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                {t('license.maxUsers', 'Max gebruikers')}:
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {license.max_users === 0
                  ? t('license.unlimited', 'Onbeperkt')
                  : license.max_users}
              </span>
            </div>
            {license.activated_at && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  {t('license.activatedAt', 'Geactiveerd op')}:
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {new Date(license.activated_at).toLocaleDateString('nl-NL')}
                </span>
              </div>
            )}
          </div>

          {isExpiringSoon && !isExpired && (
            <div className="mt-3 flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-400">
              <ClockIcon className="h-4 w-4 flex-shrink-0" />
              {t(
                'license.expiringSoonWarning',
                'Uw licentie verloopt over {{days}} dagen. Neem contact op voor verlenging.',
                { days: license.days_remaining }
              )}
            </div>
          )}
        </div>
      </div>

      {/* Success message */}
      {renewSuccess && (
        <div className="mt-4 flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
          <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-300">
            {t('license.renewSuccess', 'Licentie succesvol vernieuwd!')}
          </p>
        </div>
      )}

      {/* Renew / Update license section */}
      <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
        {!showRenewForm ? (
          <button
            onClick={() => {
              setShowRenewForm(true)
              setRenewSuccess(false)
              setRenewError(null)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
              text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20
              border border-primary-200 dark:border-primary-800
              hover:bg-primary-100 dark:hover:bg-primary-900/40
              transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            {t('license.renewLicense', 'Licentie vernieuwen')}
          </button>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              <div className="flex items-center gap-2 mb-1">
                <KeyIcon className="h-4 w-4" />
                {t('license.newLicenseKey', 'Nieuwe licentiesleutel')}
              </div>
            </label>
            <textarea
              value={newKey}
              onChange={(e) => {
                setNewKey(e.target.value)
                setRenewError(null)
              }}
              rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 
                bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                px-3 py-2 text-sm font-mono
                focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                placeholder-gray-400 dark:placeholder-gray-500"
              placeholder={t('license.keyPlaceholder', 'Plak hier uw licentiesleutel...')}
            />

            {renewError && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <XCircleIcon className="h-4 w-4 flex-shrink-0" />
                {renewError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleRenew}
                disabled={activating || !newKey.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
                  text-white bg-primary-600 hover:bg-primary-700
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors"
              >
                {activating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    {t('license.activating', 'Activeren...')}
                  </>
                ) : (
                  <>
                    <ShieldCheckIcon className="h-4 w-4" />
                    {t('license.activate', 'Licentie Activeren')}
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowRenewForm(false)
                  setNewKey('')
                  setRenewError(null)
                }}
                disabled={activating}
                className="px-4 py-2 text-sm font-medium rounded-md
                  text-gray-700 dark:text-gray-300
                  bg-gray-100 dark:bg-gray-800
                  hover:bg-gray-200 dark:hover:bg-gray-700
                  transition-colors"
              >
                {t('common.cancel', 'Annuleren')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
