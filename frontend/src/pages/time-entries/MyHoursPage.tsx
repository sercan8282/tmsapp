/**
 * My Hours Page - For chauffeurs to view their submitted hours
 * They can view and delete but not edit submitted entries
 */
import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  TrashIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { TimeEntry } from '@/types'
import {
  getTimeEntries,
  deleteTimeEntry,
  getWeekSummary,
  WeekSummary,
} from '@/api/timetracking'
import toast from 'react-hot-toast'
import Pagination, { PageSize } from '@/components/common/Pagination'

// Format duration to readable string
function formatDuration(duration: string | null): string {
  if (!duration) return '-'
  
  // Handle HH:MM:SS format
  if (duration.includes(':')) {
    const parts = duration.split(':')
    const hours = parseInt(parts[0]) || 0
    const minutes = parseInt(parts[1]) || 0
    return `${hours}u ${minutes}m`
  }
  
  return duration
}

// Format date to Dutch format
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Get current week number
function getCurrentWeekNumber(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const diff = now.getTime() - start.getTime()
  const oneWeek = 604800000
  return Math.ceil((diff + start.getDay() * 86400000) / oneWeek)
}

export default function MyHoursPage() {
  // State - initialize with current week/year
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [weekSummary, setWeekSummary] = useState<WeekSummary | null>(null)
  const [currentWeek, setCurrentWeek] = useState<number>(getCurrentWeekNumber())
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear())
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(30)
  
  // Modal state
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Load entries when week changes
  useEffect(() => {
    loadEntries()
    loadWeekSummary()
  }, [currentWeek, currentYear, currentPage, pageSize])

  const loadEntries = async () => {
    try {
      setLoading(true)
      const response = await getTimeEntries({
        weeknummer: currentWeek,
        jaar: currentYear,
        status: 'ingediend',
        page: currentPage,
        page_size: pageSize,
        ordering: '-datum',
      })
      
      setEntries(response.results)
      setTotalCount(response.count)
      setTotalPages(Math.ceil(response.count / pageSize))
    } catch (err) {
      console.error('Failed to load entries:', err)
      toast.error('Kon uren niet laden')
    } finally {
      setLoading(false)
    }
  }

  const loadWeekSummary = async () => {
    try {
      const summary = await getWeekSummary(currentWeek, currentYear)
      setWeekSummary(summary)
    } catch (err) {
      console.error('Failed to load week summary:', err)
    }
  }

  const handlePreviousWeek = () => {
    if (currentWeek === 1) {
      setCurrentWeek(52)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentWeek(currentWeek - 1)
    }
    setCurrentPage(1)
  }

  const handleNextWeek = () => {
    if (currentWeek === 52) {
      setCurrentWeek(1)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentWeek(currentWeek + 1)
    }
    setCurrentPage(1)
  }

  const handlePageSizeChange = (newSize: PageSize) => {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  const handleViewEntry = (entry: TimeEntry) => {
    setSelectedEntry(entry)
    setShowDetailModal(true)
  }

  const handleDeleteClick = (entry: TimeEntry) => {
    setSelectedEntry(entry)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedEntry) return
    
    try {
      setDeleting(true)
      await deleteTimeEntry(selectedEntry.id)
      toast.success('Urenregistratie verwijderd')
      setShowDeleteModal(false)
      setSelectedEntry(null)
      loadEntries()
      loadWeekSummary()
    } catch (err) {
      toast.error('Verwijderen mislukt')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mijn Ingediende Uren</h1>
          <p className="text-gray-500 mt-1">Overzicht van je ingediende urenregistraties</p>
        </div>
      </div>

      {/* Week selector with search and summary */}
      <div className="card mb-6">
        <div className="p-4">
          {/* Search fields */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Week:</label>
              <input
                type="number"
                min="1"
                max="53"
                value={currentWeek}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1
                  setCurrentWeek(Math.min(53, Math.max(1, val)))
                  setCurrentPage(1)
                }}
                className="form-input w-20 text-center"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Jaar:</label>
              <input
                type="number"
                min="2020"
                max="2030"
                value={currentYear}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || new Date().getFullYear()
                  setCurrentYear(val)
                  setCurrentPage(1)
                }}
                className="form-input w-24 text-center"
              />
            </div>
          </div>
          
          {/* Navigation arrows and summary */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePreviousWeek}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            
            <div className="text-center flex-1">
              <div className="text-xl font-bold text-gray-900">
                Week {currentWeek}, {currentYear}
              </div>
              
              {weekSummary && weekSummary.ingediend_count > 0 && (
                <div className="mt-2 flex justify-center gap-6 text-sm">
                  <div>
                    <span className="text-gray-500">Uren:</span>{' '}
                    <span className="font-medium">{formatDuration(weekSummary.totaal_uren)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">KM:</span>{' '}
                    <span className="font-medium">{weekSummary.totaal_km}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Ritten:</span>{' '}
                    <span className="font-medium">{weekSummary.ingediend_count}</span>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={handleNextWeek}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Entries table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center">
            <ClockIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Geen ingediende uren voor deze week</p>
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Datum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ritnummer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kenteken
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uren
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    KM
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {formatDate(entry.datum)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {entry.ritnummer}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                      {entry.kenteken}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {formatDuration(entry.totaal_uren)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {entry.totaal_km}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleViewEntry(entry)}
                          className="text-primary-600 hover:text-primary-900 p-1"
                          title="Bekijken"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(entry)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Verwijderen"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        )}
      </div>

      {/* Detail Modal */}
      <Transition appear show={showDetailModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowDetailModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <Dialog.Title className="text-lg font-semibold">
                      Urenregistratie details
                    </Dialog.Title>
                    <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-500">
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  {selectedEntry && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500">Datum</div>
                          <div className="font-medium">{formatDate(selectedEntry.datum)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Weeknummer</div>
                          <div className="font-medium">{selectedEntry.weeknummer}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Ritnummer</div>
                          <div className="font-medium">{selectedEntry.ritnummer}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Kenteken</div>
                          <div className="font-mono font-medium">{selectedEntry.kenteken}</div>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Tijden</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-sm text-gray-500">Aanvang</div>
                            <div className="font-medium">{selectedEntry.aanvang}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">Eind</div>
                            <div className="font-medium">{selectedEntry.eind}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">Pauze</div>
                            <div className="font-medium">{formatDuration(selectedEntry.pauze)}</div>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="text-sm text-gray-500">Totaal uren</div>
                          <div className="text-lg font-bold text-primary-600">
                            {formatDuration(selectedEntry.totaal_uren)}
                          </div>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Kilometers</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-sm text-gray-500">Start</div>
                            <div className="font-medium">{selectedEntry.km_start}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">Eind</div>
                            <div className="font-medium">{selectedEntry.km_eind}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">Totaal</div>
                            <div className="text-lg font-bold text-primary-600">
                              {selectedEntry.totaal_km} km
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end">
                    <button onClick={() => setShowDetailModal(false)} className="btn-secondary">
                      Sluiten
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete Confirmation Modal */}
      <Transition appear show={showDeleteModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowDeleteModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 shadow-xl transition-all">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 p-2 bg-red-100 rounded-full">
                      <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-gray-900">
                        Urenregistratie verwijderen
                      </Dialog.Title>
                      <p className="mt-2 text-sm text-gray-500">
                        Weet je zeker dat je deze urenregistratie wilt verwijderen? 
                        Dit kan niet ongedaan worden gemaakt.
                      </p>
                      {selectedEntry && (
                        <p className="mt-2 text-sm font-medium">
                          {formatDate(selectedEntry.datum)} - {selectedEntry.ritnummer}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="btn-secondary"
                      disabled={deleting}
                    >
                      Annuleren
                    </button>
                    <button
                      onClick={handleDeleteConfirm}
                      className="btn-primary bg-red-600 hover:bg-red-700"
                      disabled={deleting}
                    >
                      {deleting ? 'Verwijderen...' : 'Verwijderen'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  )
}
