/**
 * Leave Request Page
 * Form for employees to submit leave requests
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import {
  getMyLeaveBalance,
  checkConcurrentLeave,
  createLeaveRequest,
  LeaveBalance,
  LeaveRequestCreate,
  LEAVE_TYPE_OPTIONS,
  ConcurrentLeaveCheck,
} from '@/api/leave'

const HOURS_PER_DAY = 8

/**
 * Calculate the number of work days between two dates (inclusive)
 * Excludes weekends (Saturday and Sunday)
 */
function calculateWorkDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0
  
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  if (start > end) return 0
  
  let workDays = 0
  const current = new Date(start)
  
  while (current <= end) {
    const dayOfWeek = current.getDay()
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workDays++
    }
    current.setDate(current.getDate() + 1)
  }
  
  return workDays
}

/**
 * Calculate end date based on start date and hours
 * Returns the date string in YYYY-MM-DD format
 */
function calculateEndDate(startDate: string, hours: number): string {
  if (!startDate || hours <= 0) return startDate || ''
  
  const fullDays = Math.floor(hours / HOURS_PER_DAY)
  const remainingHours = hours % HOURS_PER_DAY
  
  // Start from the start date and count work days
  const current = new Date(startDate)
  let workDaysCounted = 0
  const totalWorkDaysNeeded = remainingHours > 0 ? fullDays + 1 : Math.max(fullDays, 1)
  
  while (workDaysCounted < totalWorkDaysNeeded) {
    const dayOfWeek = current.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workDaysCounted++
      if (workDaysCounted === totalWorkDaysNeeded) break
    }
    current.setDate(current.getDate() + 1)
  }
  
  // Format as YYYY-MM-DD
  return current.toISOString().split('T')[0]
}

export default function LeaveRequestPage() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const [concurrentCheck, setConcurrentCheck] = useState<ConcurrentLeaveCheck | null>(null)
  
  const [formData, setFormData] = useState<LeaveRequestCreate>({
    leave_type: 'vakantie',
    start_date: '',
    end_date: '',
    hours_requested: 8,
    reason: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  
  // Track whether user is manually editing hours vs auto-calculated
  const [isManualHours, setIsManualHours] = useState(false)

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const data = await getMyLeaveBalance()
        setBalance(data)
      } catch (err) {
        setError('Fout bij laden verlofsaldo')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchBalance()
  }, [])

  // Auto-calculate hours when dates change (if not manually set)
  useEffect(() => {
    if (formData.start_date && formData.end_date && !isManualHours) {
      const workDays = calculateWorkDays(formData.start_date, formData.end_date)
      const calculatedHours = workDays * HOURS_PER_DAY
      if (calculatedHours !== formData.hours_requested) {
        setFormData(prev => ({ ...prev, hours_requested: calculatedHours }))
      }
    }
  }, [formData.start_date, formData.end_date, isManualHours])

  // Auto-calculate end date when hours change manually
  useEffect(() => {
    if (formData.start_date && isManualHours && formData.hours_requested > 0) {
      const newEndDate = calculateEndDate(formData.start_date, formData.hours_requested)
      if (newEndDate !== formData.end_date) {
        setFormData(prev => ({ ...prev, end_date: newEndDate }))
      }
    }
  }, [formData.hours_requested, formData.start_date, isManualHours])

  // Check concurrent leave when dates change
  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      checkConcurrentLeave(formData.start_date, formData.end_date)
        .then(setConcurrentCheck)
        .catch(console.error)
    }
  }, [formData.start_date, formData.end_date])

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setIsManualHours(false) // Reset manual hours flag when date changes
    
    if (name === 'start_date' && value) {
      // If setting start date and no end date, default end date to start date
      setFormData(prev => ({
        ...prev,
        start_date: value,
        end_date: prev.end_date || value,
      }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
    setFormErrors(prev => ({ ...prev, [name]: '' }))
  }

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0
    setIsManualHours(true) // User is manually setting hours
    setFormData(prev => ({ ...prev, hours_requested: value }))
    setFormErrors(prev => ({ ...prev, hours_requested: '' }))
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    setFormErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errors: Record<string, string> = {}
    
    if (!formData.start_date) errors.start_date = 'Startdatum is verplicht'
    if (!formData.end_date) errors.end_date = 'Einddatum is verplicht'
    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
      errors.end_date = 'Einddatum moet na startdatum liggen'
    }
    if (!formData.hours_requested || formData.hours_requested <= 0) {
      errors.hours_requested = 'Aantal uren moet groter zijn dan 0'
    }
    
    // Check balance
    if (balance && formData.leave_type === 'vakantie') {
      if (formData.hours_requested > Number(balance.vacation_hours)) {
        errors.hours_requested = `Onvoldoende verlofuren (beschikbaar: ${Number(balance.vacation_hours).toFixed(1)}u)`
      }
    }
    
    if (balance && formData.leave_type === 'overuren') {
      if (formData.hours_requested > Number(balance.available_overtime_for_leave)) {
        errors.hours_requested = `Onvoldoende overuren (beschikbaar: ${Number(balance.available_overtime_for_leave).toFixed(1)}u)`
      }
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    
    setIsSubmitting(true)
    setError(null)
    
    try {
      await createLeaveRequest(formData)
      setSuccess(true)
      setTimeout(() => navigate('/leave'), 2000)
    } catch (err: any) {
      const message = err.response?.data?.hours_requested?.[0] 
        || err.response?.data?.error 
        || 'Fout bij indienen aanvraag'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CalendarDaysIcon className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Aanvraag ingediend!
        </h2>
        <p className="text-gray-500">
          Je verlofaanvraag is ingediend en wacht op goedkeuring.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/leave')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Terug naar overzicht
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Verlof aanvragen</h1>
      </div>

      {/* Balance Summary */}
      {balance && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="card p-4">
            <p className="text-sm text-gray-500">Verlofuren beschikbaar</p>
            <p className="text-2xl font-bold text-primary-600">
              {Number(balance.vacation_hours).toFixed(1)}u
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Overuren opneembaar</p>
            <p className="text-2xl font-bold text-green-600">
              {Number(balance.available_overtime_for_leave).toFixed(1)}u
            </p>
          </div>
        </div>
      )}

      {/* Concurrent Leave Warning */}
      {concurrentCheck?.warning && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">
              Let op: {concurrentCheck.concurrent_count} collega{'s'} hebben al verlof in deze periode
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              {concurrentCheck.employees_on_leave.join(', ')}
            </p>
            <p className="text-sm text-yellow-600 mt-2">
              Het kan zijn dat je aanvraag niet goedgekeurd wordt vanwege bezetting.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        {/* Leave Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type verlof *
          </label>
          <select
            name="leave_type"
            value={formData.leave_type}
            onChange={handleChange}
            className="input w-full"
          >
            {LEAVE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {formData.leave_type === 'bijzonder_tandarts' || formData.leave_type === 'bijzonder_huisarts' ? (
            <p className="text-xs text-gray-500 mt-1">
              Je krijgt 1 uur gratis per maand. Extra uren gaan van je verlofuren af.
            </p>
          ) : null}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Startdatum *
            </label>
            <input
              type="date"
              name="start_date"
              value={formData.start_date}
              onChange={handleDateChange}
              className={`input w-full ${formErrors.start_date ? 'border-red-500' : ''}`}
            />
            {formErrors.start_date && (
              <p className="text-red-500 text-xs mt-1">{formErrors.start_date}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Einddatum *
            </label>
            <input
              type="date"
              name="end_date"
              value={formData.end_date}
              onChange={handleDateChange}
              className={`input w-full ${formErrors.end_date ? 'border-red-500' : ''}`}
            />
            {formErrors.end_date && (
              <p className="text-red-500 text-xs mt-1">{formErrors.end_date}</p>
            )}
          </div>
        </div>

        {/* Hours */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Aantal uren *
          </label>
          <input
            type="number"
            name="hours_requested"
            value={formData.hours_requested}
            onChange={handleHoursChange}
            min="0.5"
            step="0.5"
            className={`input w-full ${formErrors.hours_requested ? 'border-red-500' : ''}`}
          />
          {formErrors.hours_requested && (
            <p className="text-red-500 text-xs mt-1">{formErrors.hours_requested}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {formData.hours_requested > 0 && formData.start_date && (
              <>
                {Math.floor(formData.hours_requested / HOURS_PER_DAY)} dag(en)
                {formData.hours_requested % HOURS_PER_DAY > 0 && ` en ${formData.hours_requested % HOURS_PER_DAY} uur`}
                {' • '}
              </>
            )}
            Uren worden automatisch berekend op basis van werkdagen (8 uur/dag). Je kunt dit aanpassen voor gedeeltelijk verlof.
          </p>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reden / opmerking (optioneel)
          </label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            rows={3}
            className="input w-full"
            placeholder="Eventuele toelichting..."
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate('/leave')}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? 'Bezig...' : 'Aanvraag indienen'}
          </button>
        </div>
      </form>
    </div>
  )
}
