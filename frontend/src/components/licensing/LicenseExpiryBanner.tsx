/**
 * License Expiry Warning Banner
 * 
 * Shows a dismissible warning banner when the license is expiring within 30 days.
 * Displayed at the top of the dashboard after login.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useLicenseStore } from '@/stores/licenseStore'
import { useAuthStore } from '@/stores/authStore'

export default function LicenseExpiryBanner() {
  const { t } = useTranslation()
  const { license } = useLicenseStore()
  const { user } = useAuthStore()
  const [dismissed, setDismissed] = useState(false)

  // Only show for admins, when license is expiring soon, and not dismissed
  if (
    dismissed ||
    !license ||
    !license.is_expiring_soon ||
    !user ||
    user.rol !== 'admin'
  ) {
    return null
  }

  const days = license.days_remaining
  const expiryDate = new Date(license.expires_at).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Color scheme based on urgency
  const isUrgent = days <= 7
  const bgColor = isUrgent
    ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
    : 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800'
  const iconColor = isUrgent
    ? 'text-red-600 dark:text-red-400'
    : 'text-amber-600 dark:text-amber-400'
  const textColor = isUrgent
    ? 'text-red-800 dark:text-red-200'
    : 'text-amber-800 dark:text-amber-200'
  const btnColor = isUrgent
    ? 'text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
    : 'text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300'

  return (
    <div className={`border-b px-4 py-3 ${bgColor}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ExclamationTriangleIcon className={`h-5 w-5 flex-shrink-0 ${iconColor}`} />
          <p className={`text-sm font-medium ${textColor}`}>
            {days === 0
              ? t('license.expirestoday', 'Uw licentie verloopt vandaag!')
              : days === 1
                ? t('license.expiresTomorrow', 'Uw licentie verloopt morgen!')
                : t('license.expiresInDays', 'Uw licentie verloopt over {{days}} dagen ({{date}}).', {
                    days,
                    date: expiryDate,
                  })}
            {' '}
            <span className="font-normal">
              {t('license.contactForRenewal', 'Neem contact op voor verlenging.')}
            </span>
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className={`flex-shrink-0 p-1 rounded-md ${btnColor} transition-colors`}
          aria-label={t('common.dismiss', 'Sluiten')}
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
