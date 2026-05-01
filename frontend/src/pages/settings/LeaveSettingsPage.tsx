/**
 * Leave Settings Page (Admin)
 * Admin interface for managing leave settings:
 * - Global settings (default hours, work week hours, overtime percentage)
 * - Per-user leave balance management
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeftIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import {
  getGlobalSettings,
  updateGlobalSettings,
  GlobalLeaveSettings,
} from '@/api/leave'

export default function LeaveSettingsPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation()
  
  // Global settings state
  const [globalSettings, setGlobalSettings] = useState<GlobalLeaveSettings | null>(null)
  const [editingGlobal, setEditingGlobal] = useState(false)
  const [globalForm, setGlobalForm] = useState({
    default_vacation_hours: 216,
    work_week_hours: 40,
    overtime_leave_percentage: 50,
    free_special_leave_hours: 1,
  })
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const settings = await getGlobalSettings()
      setGlobalSettings(settings)
      setGlobalForm({
        default_vacation_hours: settings.default_vacation_hours,
        work_week_hours: settings.work_week_hours,
        overtime_leave_percentage: settings.overtime_leave_percentage,
        free_special_leave_hours: settings.free_special_leave_hours,
      })
    } catch (err: any) {
      setError(err.message || t('common.error'))
    } finally {
      setIsLoading(false)
    }
  }

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleSaveGlobalSettings = async () => {
    if (!globalSettings) return
    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        default_leave_hours: String(globalForm.default_vacation_hours),
        standard_work_week_hours: String(globalForm.work_week_hours),
        overtime_leave_percentage: globalForm.overtime_leave_percentage,
        free_special_leave_hours_per_month: String(globalForm.free_special_leave_hours),
      }
      const updated = await updateGlobalSettings(globalSettings.id, payload)
      setGlobalSettings(updated)
      setEditingGlobal(false)
      showSuccess(t('settings.saved'))
    } catch (err: any) {
      setError(err.message || t('errors.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {/* Header - hidden when embedded */}
      {!embedded && (
        <div>
          <Link
            to="/settings"
            className="flex items-center text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('settings.leaveSettings')}</h1>
          <p className="text-gray-500">{t('leave.title')}</p>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Global Settings */}
      <div className="card">
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Cog6ToothIcon className="w-5 h-5 text-gray-400" />
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">{t('settings.general')}</h2>
          </div>
          {!editingGlobal && (
            <button
              onClick={() => setEditingGlobal(true)}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              {t('common.edit')}
            </button>
          )}
        </div>
        <div className="p-4 sm:p-6">
          {editingGlobal ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Standaard vakantie-uren per jaar
                  </label>
                  <input
                    type="number"
                    value={globalForm.default_vacation_hours}
                    onChange={(e) => setGlobalForm({ ...globalForm, default_vacation_hours: Number(e.target.value) })}
                    className="input"
                    min="0"
                    step="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Standaard: 216 uur</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Werkweek uren
                  </label>
                  <input
                    type="number"
                    value={globalForm.work_week_hours}
                    onChange={(e) => setGlobalForm({ ...globalForm, work_week_hours: Number(e.target.value) })}
                    className="input"
                    min="1"
                    step="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Uren boven dit aantal = overwerk</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Overwerk percentage voor verlof (%)
                  </label>
                  <input
                    type="number"
                    value={globalForm.overtime_leave_percentage}
                    onChange={(e) => setGlobalForm({ ...globalForm, overtime_leave_percentage: Number(e.target.value) })}
                    className="input"
                    min="0"
                    max="100"
                    step="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Hoeveel % van overwerk als verlof opneembaar is</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gratis bijzonder verlof per maand (uren)
                  </label>
                  <input
                    type="number"
                    value={globalForm.free_special_leave_hours}
                    onChange={(e) => setGlobalForm({ ...globalForm, free_special_leave_hours: Number(e.target.value) })}
                    className="input"
                    min="0"
                    step="0.5"
                  />
                  <p className="text-xs text-gray-500 mt-1">Extra uren worden van vakantie afgetrokken</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => {
                    setEditingGlobal(false)
                    setGlobalForm({
                      default_vacation_hours: globalSettings?.default_vacation_hours || 216,
                      work_week_hours: globalSettings?.work_week_hours || 40,
                      overtime_leave_percentage: globalSettings?.overtime_leave_percentage || 50,
                      free_special_leave_hours: globalSettings?.free_special_leave_hours || 1,
                    })
                  }}
                  className="btn btn-secondary"
                  disabled={isSaving}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSaveGlobalSettings}
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs sm:text-sm text-gray-500">Standaard vakantie-uren</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                  {globalSettings?.default_vacation_hours || 216}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs sm:text-sm text-gray-500">Werkweek uren</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                  {globalSettings?.work_week_hours || 40}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs sm:text-sm text-gray-500">Overwerk % verlof</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                  {globalSettings?.overtime_leave_percentage || 50}%
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs sm:text-sm text-gray-500">Gratis bijz. verlof</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                  {globalSettings?.free_special_leave_hours || 1} uur
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
