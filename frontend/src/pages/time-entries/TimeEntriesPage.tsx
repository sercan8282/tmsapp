import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  PlusIcon, 
  PencilSquareIcon, 
  TrashIcon,
  CheckCircleIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowPathIcon,
  ClockIcon,
  PaperAirplaneIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { TimeEntry } from '@/types'
import { 
  getTimeEntries,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  submitWeek,
  getWeekSummary,
  TimeEntryFilters,
  TimeEntryCreate,
  TimeEntryUpdate,
  WeekSummary,
  getCurrentWeekNumber,
  getCurrentYear,
  formatMinutesToDuration,
} from '@/api/timetracking'
import { getAllVehicles } from '@/api/fleet'
import { Vehicle } from '@/types'
import { useAuthStore } from '@/stores/authStore'

// Modal component
function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children,
  size = 'md'
}: { 
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className={`relative bg-white rounded-xl shadow-xl w-full ${sizeClasses[size]} transform transition-all`}>
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// Confirm dialog component
function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Bevestigen',
  cancelText = 'Annuleren',
  loadingText = 'Bezig...',
  confirmColor = 'red',
  isLoading = false,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  loadingText?: string
  confirmColor?: 'red' | 'green' | 'blue'
  isLoading?: boolean
}) {
  const colorClasses = {
    red: 'bg-red-600 hover:bg-red-700',
    green: 'bg-green-600 hover:bg-green-700',
    blue: 'bg-primary-600 hover:bg-primary-700',
  }
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          disabled={isLoading}
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${colorClasses[confirmColor]}`}
          disabled={isLoading}
        >
          {isLoading ? loadingText : confirmText}
        </button>
      </div>
    </Modal>
  )
}

// Time Entry form component
function TimeEntryForm({
  entry,
  vehicles,
  onSave,
  onCancel,
  isLoading,
  t,
}: {
  entry?: TimeEntry
  vehicles: Vehicle[]
  onSave: (data: TimeEntryCreate | TimeEntryUpdate) => void
  onCancel: () => void
  isLoading: boolean
  t: (key: string) => string
}) {
  const [formData, setFormData] = useState({
    ritnummer: entry?.ritnummer || '',
    datum: entry?.datum || new Date().toISOString().split('T')[0],
    kenteken: entry?.kenteken || '',
    km_start: entry?.km_start?.toString() || '',
    km_eind: entry?.km_eind?.toString() || '',
    aanvang: entry?.aanvang || '07:00',
    eind: entry?.eind || '16:00',
    pauze_minuten: entry?.pauze ? Math.floor(parsePauze(entry.pauze) / 60) : 30,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function parsePauze(pauze: string): number {
    // Parse pauze duration to seconds
    if (!pauze) return 0
    if (pauze.includes(':')) {
      const parts = pauze.split(':')
      return (parseInt(parts[0]) || 0) * 3600 + (parseInt(parts[1]) || 0) * 60
    }
    return 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.ritnummer.trim()) newErrors.ritnummer = t('timeEntries.errors.routeNumberRequired')
    if (!formData.datum) newErrors.datum = t('timeEntries.errors.dateRequired')
    if (!formData.kenteken.trim()) newErrors.kenteken = t('timeEntries.errors.licensePlateRequired')
    if (!formData.km_start) newErrors.km_start = t('timeEntries.errors.kmStartRequired')
    if (!formData.km_eind) newErrors.km_eind = t('timeEntries.errors.kmEndRequired')
    if (!formData.aanvang) newErrors.aanvang = t('timeEntries.errors.startTimeRequired')
    if (!formData.eind) newErrors.eind = t('timeEntries.errors.endTimeRequired')
    
    // Validate km_eind > km_start
    const kmStart = parseInt(formData.km_start)
    const kmEind = parseInt(formData.km_eind)
    if (!isNaN(kmStart) && !isNaN(kmEind) && kmEind < kmStart) {
      newErrors.km_eind = t('timeEntries.errors.kmEndGreater')
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    
    const saveData: TimeEntryCreate = {
      ritnummer: formData.ritnummer,
      datum: formData.datum,
      kenteken: formData.kenteken.toUpperCase(),
      km_start: parseInt(formData.km_start),
      km_eind: parseInt(formData.km_eind),
      aanvang: formData.aanvang,
      eind: formData.eind,
      pauze: formatMinutesToDuration(formData.pauze_minuten),
    }
    onSave(saveData)
  }

  // Calculate totals
  const totaalKm = Math.max(0, (parseInt(formData.km_eind) || 0) - (parseInt(formData.km_start) || 0))
  
  const calculateTotaalUren = () => {
    if (!formData.aanvang || !formData.eind) return '0:00'
    
    const [aH, aM] = formData.aanvang.split(':').map(Number)
    const [eH, eM] = formData.eind.split(':').map(Number)
    
    let aanvangMinutes = aH * 60 + aM
    let eindMinutes = eH * 60 + eM
    
    // Handle overnight
    if (eindMinutes < aanvangMinutes) {
      eindMinutes += 24 * 60
    }
    
    const werkMinutes = eindMinutes - aanvangMinutes - formData.pauze_minuten
    const hours = Math.floor(werkMinutes / 60)
    const minutes = werkMinutes % 60
    
    return `${hours}:${minutes.toString().padStart(2, '0')}`
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('common.date')} *
          </label>
          <input
            type="date"
            name="datum"
            value={formData.datum}
            onChange={handleChange}
            className={`input ${errors.datum ? 'border-red-500' : ''}`}
          />
          {errors.datum && <p className="text-red-500 text-xs mt-1">{errors.datum}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('timeEntries.routeNumber')} *
          </label>
          <input
            type="text"
            name="ritnummer"
            value={formData.ritnummer}
            onChange={handleChange}
            placeholder={t('timeEntries.routeNumberPlaceholder')}
            className={`input ${errors.ritnummer ? 'border-red-500' : ''}`}
          />
          {errors.ritnummer && <p className="text-red-500 text-xs mt-1">{errors.ritnummer}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('fleet.licensePlate')} *
        </label>
        <select
          name="kenteken"
          value={formData.kenteken}
          onChange={handleChange}
          className={`input ${errors.kenteken ? 'border-red-500' : ''}`}
        >
          <option value="">{t('timeEntries.selectVehicle')}</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.kenteken}>
              {v.kenteken} {v.type_wagen ? `- ${v.type_wagen}` : ''}
            </option>
          ))}
        </select>
        {errors.kenteken && <p className="text-red-500 text-xs mt-1">{errors.kenteken}</p>}
        {formData.kenteken && !vehicles.find(v => v.kenteken === formData.kenteken) && (
          <input
            type="text"
            name="kenteken"
            value={formData.kenteken}
            onChange={handleChange}
            placeholder={t('timeEntries.orEnterManually')}
            className="input mt-2 uppercase"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('timeEntries.kmStart')} *
          </label>
          <input
            type="number"
            name="km_start"
            value={formData.km_start}
            onChange={handleChange}
            min="0"
            className={`input ${errors.km_start ? 'border-red-500' : ''}`}
          />
          {errors.km_start && <p className="text-red-500 text-xs mt-1">{errors.km_start}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('timeEntries.kmEnd')} *
          </label>
          <input
            type="number"
            name="km_eind"
            value={formData.km_eind}
            onChange={handleChange}
            min="0"
            className={`input ${errors.km_eind ? 'border-red-500' : ''}`}
          />
          {errors.km_eind && <p className="text-red-500 text-xs mt-1">{errors.km_eind}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('timeEntries.startTime')} *
          </label>
          <input
            type="time"
            name="aanvang"
            value={formData.aanvang}
            onChange={handleChange}
            className={`input ${errors.aanvang ? 'border-red-500' : ''}`}
          />
          {errors.aanvang && <p className="text-red-500 text-xs mt-1">{errors.aanvang}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('timeEntries.endTime')} *
          </label>
          <input
            type="time"
            name="eind"
            value={formData.eind}
            onChange={handleChange}
            className={`input ${errors.eind ? 'border-red-500' : ''}`}
          />
          {errors.eind && <p className="text-red-500 text-xs mt-1">{errors.eind}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('timeEntries.breakMinutes')}
          </label>
          <select
            name="pauze_minuten"
            value={formData.pauze_minuten}
            onChange={(e) => setFormData(prev => ({ ...prev, pauze_minuten: parseInt(e.target.value) }))}
            className="input"
          >
            <option value={0}>0 {t('timeEntries.minutes')}</option>
            <option value={15}>15 {t('timeEntries.minutes')}</option>
            <option value={30}>30 {t('timeEntries.minutes')}</option>
            <option value={45}>45 {t('timeEntries.minutes')}</option>
            <option value={60}>1 {t('timeEntries.hour')}</option>
            <option value={90}>1,5 {t('timeEntries.hour')}</option>
          </select>
        </div>
      </div>

      {/* Calculated values */}
      <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4">
        <div>
          <span className="text-sm text-gray-500">{t('timeEntries.totalKm')}</span>
          <p className="text-lg font-semibold text-gray-900">{totaalKm} {t('timeEntries.km')}</p>
        </div>
        <div>
          <span className="text-sm text-gray-500">{t('timeEntries.totalHours')}</span>
          <p className="text-lg font-semibold text-gray-900">{calculateTotaalUren()}</p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          disabled={isLoading}
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={isLoading}
        >
          {isLoading ? t('common.saving') : entry ? t('common.save') : t('common.add')}
        </button>
      </div>
    </form>
  )
}

// Week Summary Card
function WeekSummaryCard({ 
  summary, 
  weeknummer, 
  jaar,
  onSubmit,
  isSubmitting,
  t,
}: { 
  summary: WeekSummary | null
  weeknummer: number
  jaar: number
  onSubmit: () => void
  isSubmitting: boolean
  t: (key: string) => string
}) {
  if (!summary) return null

  return (
    <div className="card p-4 mb-6">
      {/* Desktop layout */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-sm text-gray-500">{t('common.week')} {weeknummer}, {jaar}</span>
            <p className="text-2xl font-bold text-gray-900">{summary.totaal_entries} {t('timeEntries.entriesCount')}</p>
          </div>
          <div className="h-12 w-px bg-gray-200" />
          <div>
            <span className="text-sm text-gray-500">{t('timeEntries.totalKm')}</span>
            <p className="text-lg font-semibold text-gray-900">{summary.totaal_km.toLocaleString()} {t('timeEntries.km')}</p>
          </div>
          <div className="h-12 w-px bg-gray-200" />
          <div>
            <span className="text-sm text-gray-500">{t('timeEntries.totalHours')}</span>
            <p className="text-lg font-semibold text-gray-900">{summary.totaal_uren}</p>
          </div>
          <div className="h-12 w-px bg-gray-200" />
          <div>
            <span className="text-sm text-gray-500">{t('common.status')}</span>
            <div className="flex items-center gap-2 mt-1">
              {summary.concept_count > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                  {summary.concept_count} {t('timeEntries.concept')}
                </span>
              )}
              {summary.ingediend_count > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                  {summary.ingediend_count} {t('timeEntries.submitted')}
                </span>
              )}
            </div>
          </div>
        </div>
        {summary.kan_indienen && (
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="btn-primary flex items-center"
          >
            <PaperAirplaneIcon className="w-4 h-4 mr-2" />
            {isSubmitting ? t('common.saving') : t('timeEntries.submitWeek')}
          </button>
        )}
      </div>

      {/* Mobile layout */}
      <div className="md:hidden">
        <div className="flex justify-between items-start mb-3">
          <div>
            <span className="text-sm text-gray-500">{t('common.week')} {weeknummer}, {jaar}</span>
            <p className="text-xl font-bold text-gray-900">{summary.totaal_entries} {t('timeEntries.entriesCount')}</p>
          </div>
          <div className="flex items-center gap-1">
            {summary.concept_count > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                {summary.concept_count}
              </span>
            )}
            {summary.ingediend_count > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                {summary.ingediend_count}
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-50 rounded-lg p-2">
            <span className="text-xs text-gray-500">{t('timeEntries.totalKm')}</span>
            <p className="text-sm font-semibold text-gray-900">{summary.totaal_km.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <span className="text-xs text-gray-500">{t('timeEntries.totalHours')}</span>
            <p className="text-sm font-semibold text-gray-900">{summary.totaal_uren}</p>
          </div>
        </div>
        {summary.kan_indienen && (
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="btn-primary w-full flex items-center justify-center"
          >
            <PaperAirplaneIcon className="w-4 h-4 mr-2" />
            {isSubmitting ? t('common.saving') : t('timeEntries.submitWeek')}
          </button>
        )}
      </div>
    </div>
  )
}

// Main TimeEntriesPage component
export default function TimeEntriesPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Week navigation
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeekNumber())
  const [selectedYear, setSelectedYear] = useState(getCurrentYear())
  const [weekSummary, setWeekSummary] = useState<WeekSummary | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'concept' | 'ingediend'>('all')
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<string>('datum')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const pageSize = 10

  // Admin search filters
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [searchWeek, setSearchWeek] = useState<number | null>(null)

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)

  const isAdmin = user?.rol === 'admin'

  // Helper to extract error message
  const getErrorMessage = (err: any, defaultMsg: string): string => {
    if (err.response?.data) {
      const data = err.response.data
      if (data.error) return data.error
      if (data.message) return data.message
      if (data.detail) return data.detail
      const firstField = Object.keys(data)[0]
      if (firstField && Array.isArray(data[firstField])) {
        return `${firstField}: ${data[firstField][0]}`
      }
    }
    return defaultMsg
  }

  // Fetch vehicles for dropdown
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const data = await getAllVehicles()
        setVehicles(data)
      } catch (err) {
        console.error('Error fetching vehicles:', err)
      }
    }
    fetchVehicles()
  }, [])

  // Debounce search query for live search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch entries
  const fetchEntries = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const filters: TimeEntryFilters = {
        page,
        page_size: pageSize,
        weeknummer: searchWeek !== null ? searchWeek : selectedWeek,
        jaar: selectedYear,
        ordering: sortDirection === 'asc' ? sortField : `-${sortField}`,
      }
      if (statusFilter !== 'all') filters.status = statusFilter
      // Admin: search by chauffeur name
      if (isAdmin && debouncedSearch) {
        filters.search = debouncedSearch
      }
      
      const weekToSummarize = searchWeek !== null ? searchWeek : selectedWeek
      const [entriesResponse, summaryResponse] = await Promise.all([
        getTimeEntries(filters),
        getWeekSummary(weekToSummarize, selectedYear),
      ])
      
      setEntries(entriesResponse.results || [])
      setTotalCount(entriesResponse.count || 0)
      setWeekSummary(summaryResponse)
    } catch (err) {
      setError(t('timeEntries.fetchError'))
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, selectedWeek, selectedYear, statusFilter, sortField, sortDirection, isAdmin, debouncedSearch, searchWeek])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  // Show success message temporarily
  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  // Handle sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Week navigation
  const goToPreviousWeek = () => {
    if (selectedWeek === 1) {
      setSelectedWeek(52)
      setSelectedYear(prev => prev - 1)
    } else {
      setSelectedWeek(prev => prev - 1)
    }
    setPage(1)
  }

  const goToNextWeek = () => {
    if (selectedWeek === 52) {
      setSelectedWeek(1)
      setSelectedYear(prev => prev + 1)
    } else {
      setSelectedWeek(prev => prev + 1)
    }
    setPage(1)
  }

  const goToCurrentWeek = () => {
    setSelectedWeek(getCurrentWeekNumber())
    setSelectedYear(getCurrentYear())
    setPage(1)
  }

  // Handle create
  const handleCreate = async (data: TimeEntryCreate | TimeEntryUpdate) => {
    setIsActionLoading(true)
    try {
      await createTimeEntry(data as TimeEntryCreate)
      setShowCreateModal(false)
      showSuccess(t('timeEntries.entryCreated'))
      fetchEntries()
    } catch (err: any) {
      setError(getErrorMessage(err, t('timeEntries.createError')))
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle update
  const handleUpdate = async (data: TimeEntryCreate | TimeEntryUpdate) => {
    if (!selectedEntry) return
    setIsActionLoading(true)
    try {
      await updateTimeEntry(selectedEntry.id, data as TimeEntryUpdate)
      setShowEditModal(false)
      setSelectedEntry(null)
      showSuccess(t('timeEntries.entryUpdated'))
      fetchEntries()
    } catch (err: any) {
      setError(getErrorMessage(err, t('timeEntries.updateError')))
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!selectedEntry) return
    setIsActionLoading(true)
    try {
      await deleteTimeEntry(selectedEntry.id)
      setShowDeleteModal(false)
      setSelectedEntry(null)
      showSuccess(t('timeEntries.entryDeleted'))
      fetchEntries()
    } catch (err: any) {
      setError(getErrorMessage(err, t('timeEntries.deleteError')))
      setShowDeleteModal(false)
      setSelectedEntry(null)
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle submit week
  const handleSubmitWeek = async () => {
    setIsActionLoading(true)
    try {
      await submitWeek(selectedWeek, selectedYear)
      setShowSubmitModal(false)
      showSuccess(t('timeEntries.weekSubmitted'))
      fetchEntries()
    } catch (err: any) {
      setError(getErrorMessage(err, t('timeEntries.submitError')))
      setShowSubmitModal(false)
    } finally {
      setIsActionLoading(false)
    }
  }

  // Pagination
  const totalPages = Math.ceil(totalCount / pageSize)

  // Sort icon
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' 
      ? <ChevronUpIcon className="w-4 h-4 inline ml-1" />
      : <ChevronDownIcon className="w-4 h-4 inline ml-1" />
  }

  // Can edit entry
  const canEditEntry = (entry: TimeEntry) => {
    if (isAdmin) return true
    if (entry.status === 'ingediend') return false
    return entry.user === user?.id
  }

  return (
    <div className="max-w-full overflow-hidden">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">{t('timeEntries.title')}</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          {t('timeEntries.addDay')}
        </button>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center">
          <CheckCircleIcon className="w-5 h-5 mr-2" />
          {successMessage}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Week Navigation */}
      <div className="card p-4 mb-6">
        {/* Desktop layout */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={goToPreviousWeek}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <div className="text-center">
              <div className="flex items-center gap-2">
                <CalendarDaysIcon className="w-5 h-5 text-primary-600" />
                <span className="text-lg font-semibold text-gray-900">
                  Week {selectedWeek}, {selectedYear}
                </span>
              </div>
            </div>
            <button
              onClick={goToNextWeek}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={goToCurrentWeek}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {t('timeEntries.currentWeek')}
            </button>
            
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1) }}
              className="input w-40"
            >
              <option value="all">{t('timeEntries.allStatuses')}</option>
              <option value="concept">{t('timeEntries.concept')}</option>
              <option value="ingediend">{t('timeEntries.submitted')}</option>
            </select>

            {/* Refresh button */}
            <button
              onClick={() => fetchEntries()}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title={t('common.refresh')}
            >
              <ArrowPathIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile layout */}
        <div className="sm:hidden space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={goToPreviousWeek}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <div className="text-center">
              <div className="flex items-center gap-2">
                <CalendarDaysIcon className="w-5 h-5 text-primary-600" />
                <span className="text-base font-semibold text-gray-900">
                  Week {selectedWeek}, {selectedYear}
                </span>
              </div>
            </div>
            <button
              onClick={goToNextWeek}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={goToCurrentWeek}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {t('common.today')}
            </button>
            
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1) }}
              className="input flex-1 text-sm"
            >
              <option value="all">{t('common.all')}</option>
              <option value="concept">{t('timeEntries.concept')}</option>
              <option value="ingediend">{t('timeEntries.submitted')}</option>
            </select>

            <button
              onClick={() => fetchEntries()}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title={t('common.refresh')}
            >
              <ArrowPathIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Admin Search Panel */}
      {isAdmin && (
        <div className="card p-4 mb-6 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <MagnifyingGlassIcon className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-blue-900">{t('timeEntries.adminSearch')}</span>
          </div>
          
          {/* Desktop admin search */}
          <div className="hidden sm:flex items-center gap-4">
            {/* Chauffeur search input */}
            <div className="relative flex-1 max-w-xs">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('timeEntries.searchDriver')}
                className="input pl-9 w-full"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Week number search */}
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="w-4 h-4 text-gray-500" />
              <select
                value={searchWeek !== null ? searchWeek : ''}
                onChange={(e) => { 
                  const val = e.target.value
                  setSearchWeek(val === '' ? null : parseInt(val))
                  setPage(1)
                }}
                className="input w-32"
              >
                <option value="">{t('timeEntries.currentWeek')}</option>
                {Array.from({ length: 52 }, (_, i) => i + 1).map(week => (
                  <option key={week} value={week}>{t('common.week')} {week}</option>
                ))}
              </select>
            </div>

            {/* Clear filters */}
            {(searchQuery || searchWeek !== null) && (
              <button
                onClick={() => { 
                  setSearchQuery('')
                  setSearchWeek(null)
                }}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <XMarkIcon className="w-4 h-4" />
                {t('timeEntries.clearFilters')}
              </button>
            )}

            {/* Active filters indicator */}
            {(debouncedSearch || searchWeek !== null) && (
              <span className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                {[
                  debouncedSearch ? `"${debouncedSearch}"` : null,
                  searchWeek !== null ? `${t('common.week')} ${searchWeek}` : null
                ].filter(Boolean).join(' • ')}
              </span>
            )}
          </div>

          {/* Mobile admin search */}
          <div className="sm:hidden space-y-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('timeEntries.searchDriver')}
                className="input pl-9 w-full text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            <select
              value={searchWeek !== null ? searchWeek : ''}
              onChange={(e) => { 
                const val = e.target.value
                setSearchWeek(val === '' ? null : parseInt(val))
                setPage(1)
              }}
              className="input w-full text-sm"
            >
              <option value="">{t('timeEntries.currentWeek')}</option>
              {Array.from({ length: 52 }, (_, i) => i + 1).map(week => (
                <option key={week} value={week}>{t('common.week')} {week}</option>
              ))}
            </select>
            {(searchQuery || searchWeek !== null) && (
              <button
                onClick={() => { 
                  setSearchQuery('')
                  setSearchWeek(null)
                }}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <XMarkIcon className="w-4 h-4" />
                {t('timeEntries.clearFilters')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Week Summary */}
      <WeekSummaryCard
        summary={weekSummary}
        weeknummer={searchWeek !== null ? searchWeek : selectedWeek}
        jaar={selectedYear}
        onSubmit={() => setShowSubmitModal(true)}
        isSubmitting={isActionLoading}
        t={t}
      />

      {/* Table/Cards */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="px-4 py-12 text-center text-gray-500">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-3">{t('common.loading')}</span>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            <ClockIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p>{t('timeEntries.noEntries')}{searchWeek !== null ? ` ${t('timeEntries.forWeek')} ${searchWeek}` : ` ${t('timeEntries.forWeek')} ${selectedWeek}`}{debouncedSearch ? ` ${t('timeEntries.with')} "${debouncedSearch}"` : ''}</p>
            {!debouncedSearch && !searchWeek && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 text-primary-600 hover:text-primary-700"
              >
                {t('timeEntries.addFirstEntry')}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th 
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('datum')}
                    >
                      {t('common.date')} <SortIcon field="datum" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      {t('drivers.title')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      {t('timeEntries.routeNumber')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      {t('fleet.licensePlate')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      {t('common.time')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                      {t('timeEntries.km')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                      {t('timeEntries.hours')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                      {t('common.status')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {new Date(entry.datum).toLocaleDateString('nl-NL', { 
                            weekday: 'short', 
                            day: 'numeric', 
                            month: 'short' 
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-900 text-sm">{entry.user_naam}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono">{entry.ritnummer}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono">{entry.kenteken}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {entry.aanvang} - {entry.eind}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{entry.totaal_km.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{entry.totaal_uren_display}</td>
                      <td className="px-4 py-3 text-center">
                        {entry.status === 'concept' ? (
                          <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                            {t('timeEntries.concept')}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            {t('timeEntries.submitted')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canEditEntry(entry) && (
                            <>
                              <button
                                onClick={() => { setSelectedEntry(entry); setShowEditModal(true) }}
                                className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded"
                                title={t('common.edit')}
                              >
                                <PencilSquareIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setSelectedEntry(entry); setShowDeleteModal(true) }}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded"
                                title={t('common.delete')}
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {entries.map(entry => (
                <div key={entry.id} className="p-3 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">
                        {new Date(entry.datum).toLocaleDateString('nl-NL', { 
                          weekday: 'short', 
                          day: 'numeric', 
                          month: 'short' 
                        })}
                      </h3>
                      <p className="text-xs text-gray-500">{entry.user_naam}</p>
                    </div>
                    {entry.status === 'concept' ? (
                      <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        {t('timeEntries.concept')}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        {t('timeEntries.submitted')}
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                    <div>
                      <span className="text-gray-500">{t('timeEntries.routeNumberShort')}: </span>
                      <span className="font-mono font-medium">{entry.ritnummer}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('fleet.licensePlate')}: </span>
                      <span className="font-mono font-medium">{entry.kenteken}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('common.time')}: </span>
                      <span className="font-medium">{entry.aanvang}-{entry.eind}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('timeEntries.hours')}: </span>
                      <span className="font-bold text-primary-600">{entry.totaal_uren_display}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('timeEntries.km')}: </span>
                      <span className="font-medium">{entry.totaal_km.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  {canEditEntry(entry) && (
                    <div className="flex gap-2 pt-2 border-t">
                      <button
                        onClick={() => { setSelectedEntry(entry); setShowEditModal(true) }}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 min-h-[44px] text-sm"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => { setSelectedEntry(entry); setShowDeleteModal(true) }}
                        className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 min-h-[44px]"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {totalCount} {t('timeEntries.entriesCount')} {t('timeEntries.found')}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setError(null); setPage(prev => Math.max(1, prev - 1)); }}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.previous')}
              </button>
              <span className="text-sm text-gray-600">
                {t('timeEntries.page')} {page} {t('common.of')} {totalPages}
              </span>
              <button
                onClick={() => { setError(null); setPage(prev => Math.min(totalPages, prev + 1)); }}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('timeEntries.addDay')}
        size="lg"
      >
        <TimeEntryForm
          vehicles={vehicles}
          onSave={handleCreate}
          onCancel={() => setShowCreateModal(false)}
          isLoading={isActionLoading}
          t={t}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedEntry(null) }}
        title={t('timeEntries.editEntry')}
        size="lg"
      >
        {selectedEntry && (
          <TimeEntryForm
            entry={selectedEntry}
            vehicles={vehicles}
            onSave={handleUpdate}
            onCancel={() => { setShowEditModal(false); setSelectedEntry(null) }}
            isLoading={isActionLoading}
            t={t}
          />
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmDialog
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedEntry(null) }}
        onConfirm={handleDelete}
        title={t('timeEntries.deleteEntry')}
        message={t('timeEntries.deleteConfirmMessage', { date: selectedEntry?.datum })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        loadingText={t('common.deleting')}
        confirmColor="red"
        isLoading={isActionLoading}
      />

      {/* Submit Week Modal */}
      <ConfirmDialog
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmitWeek}
        title={t('timeEntries.submitWeek')}
        message={t('timeEntries.submitWeekMessage', { week: selectedWeek })}
        confirmText={t('common.submit')}
        cancelText={t('common.cancel')}
        loadingText={t('common.saving')}
        confirmColor="green"
        isLoading={isActionLoading}
      />
    </div>
  )
}
