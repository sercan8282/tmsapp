/**
 * Submitted Hours Page - For admins to view and edit all submitted hours
 * Full editing capabilities for all chauffeur time entries
 */
import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  MagnifyingGlassIcon,
  PencilIcon,
  XMarkIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { TimeEntry } from '@/types'
import {
  getTimeEntries,
  updateTimeEntry,
  WeekHistory,
  getWeekHistory,
} from '@/api/timetracking'
import toast from 'react-hot-toast'
import Pagination, { PageSize } from '@/components/common/Pagination'

// Format duration to readable string
function formatDuration(duration: string | null): string {
  if (!duration) return '-'
  
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

export default function SubmittedHoursPage() {
  // State
  const [loading, setLoading] = useState(true)
  const [weekHistory, setWeekHistory] = useState<WeekHistory[]>([])
  const [filteredWeeks, setFilteredWeeks] = useState<WeekHistory[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(30)
  
  // Week detail state
  const [showWeekModal, setShowWeekModal] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState<WeekHistory | null>(null)
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)
  
  // Edit entry state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [editForm, setEditForm] = useState({
    ritnummer: '',
    kenteken: '',
    datum: '',
    aanvang: '',
    eind: '',
    pauze: '',
    km_start: 0,
    km_eind: 0,
  })
  const [saving, setSaving] = useState(false)

  // Load week history on mount
  useEffect(() => {
    loadWeekHistory()
  }, [])

  // Filter weeks when search changes
  useEffect(() => {
    if (!searchTerm) {
      setFilteredWeeks(weekHistory)
    } else {
      const lower = searchTerm.toLowerCase()
      const filtered = weekHistory.filter(week => {
        const fullName = `${week.user__voornaam} ${week.user__achternaam}`.toLowerCase()
        return (
          fullName.includes(lower) ||
          week.weeknummer.toString().includes(lower) ||
          week.jaar.toString().includes(lower)
        )
      })
      setFilteredWeeks(filtered)
    }
    setCurrentPage(1)
  }, [searchTerm, weekHistory])

  const loadWeekHistory = async () => {
    try {
      setLoading(true)
      const history = await getWeekHistory()
      // Sort by year and week descending
      const sorted = history.sort((a, b) => {
        if (a.jaar !== b.jaar) return b.jaar - a.jaar
        return b.weeknummer - a.weeknummer
      })
      setWeekHistory(sorted)
      setFilteredWeeks(sorted)
    } catch (err) {
      console.error('Failed to load week history:', err)
      toast.error('Kon wekenoverzicht niet laden')
    } finally {
      setLoading(false)
    }
  }

  const loadWeekEntries = async (week: WeekHistory) => {
    try {
      setLoadingEntries(true)
      const response = await getTimeEntries({
        weeknummer: week.weeknummer,
        jaar: week.jaar,
        user: week.user_id,
        status: 'ingediend',
        page_size: 100,
        ordering: 'datum',
      })
      setWeekEntries(response.results)
    } catch (err) {
      console.error('Failed to load week entries:', err)
      toast.error('Kon uren niet laden')
    } finally {
      setLoadingEntries(false)
    }
  }

  const handleViewWeek = async (week: WeekHistory) => {
    setSelectedWeek(week)
    setShowWeekModal(true)
    await loadWeekEntries(week)
  }

  const handleEditEntry = (entry: TimeEntry) => {
    setEditingEntry(entry)
    setEditForm({
      ritnummer: entry.ritnummer,
      kenteken: entry.kenteken,
      datum: entry.datum,
      aanvang: entry.aanvang,
      eind: entry.eind,
      pauze: entry.pauze || '00:00:00',
      km_start: entry.km_start,
      km_eind: entry.km_eind,
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editingEntry) return
    
    try {
      setSaving(true)
      await updateTimeEntry(editingEntry.id, {
        ritnummer: editForm.ritnummer,
        kenteken: editForm.kenteken,
        datum: editForm.datum,
        aanvang: editForm.aanvang,
        eind: editForm.eind,
        pauze: editForm.pauze,
        km_start: editForm.km_start,
        km_eind: editForm.km_eind,
      })
      
      toast.success('Urenregistratie bijgewerkt')
      setShowEditModal(false)
      setEditingEntry(null)
      
      // Reload entries for this week
      if (selectedWeek) {
        await loadWeekEntries(selectedWeek)
      }
      
      // Reload week history for updated totals
      loadWeekHistory()
    } catch (err) {
      console.error('Failed to update entry:', err)
      toast.error('Bijwerken mislukt')
    } finally {
      setSaving(false)
    }
  }

  // Pagination
  const totalPages = Math.ceil(filteredWeeks.length / pageSize)
  const paginatedWeeks = filteredWeeks.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ingediende Uren</h1>
          <p className="text-gray-500 mt-1">Overzicht van alle ingediende urenregistraties</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="card mb-6">
        <div className="p-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Zoeken op chauffeur, week of jaar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10 w-full"
            />
          </div>
        </div>
      </div>

      {/* Weeks table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : paginatedWeeks.length === 0 ? (
          <div className="p-8 text-center">
            <ClockIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Geen ingediende uren gevonden</p>
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Week
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jaar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chauffeur
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ritten
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Totaal KM
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedWeeks.map((week) => (
                  <tr key={`${week.user_id}-${week.jaar}-${week.weeknummer}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 text-primary-700 font-bold">
                        {week.weeknummer}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {week.jaar}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {week.user__voornaam} {week.user__achternaam}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {week.ingediend_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                      {week.totaal_km} km
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleViewWeek(week)}
                        className="btn-secondary text-sm"
                      >
                        Bekijken / Bewerken
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={filteredWeeks.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => { setPageSize(newSize); setCurrentPage(1); }}
            />
          </>
        )}
      </div>

      {/* Week Detail Modal */}
      <Transition appear show={showWeekModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowWeekModal(false)}>
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
                <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-lg bg-white shadow-xl transition-all">
                  <div className="flex items-center justify-between p-6 border-b">
                    <div>
                      <Dialog.Title className="text-lg font-semibold">
                        Week {selectedWeek?.weeknummer} - {selectedWeek?.jaar}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 mt-1">
                        {selectedWeek?.user__voornaam} {selectedWeek?.user__achternaam}
                      </p>
                    </div>
                    <button onClick={() => setShowWeekModal(false)} className="text-gray-400 hover:text-gray-500">
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="p-6">
                    {loadingEntries ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                      </div>
                    ) : weekEntries.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">Geen uren gevonden</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Datum
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Ritnr
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Kenteken
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Tijden
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                Uren
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                KM
                              </th>
                              <th className="px-4 py-3"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {weekEntries.map(entry => (
                              <tr key={entry.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm">
                                  {formatDate(entry.datum)}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium">
                                  {entry.ritnummer}
                                </td>
                                <td className="px-4 py-3 text-sm font-mono">
                                  {entry.kenteken}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {entry.aanvang} - {entry.eind}
                                </td>
                                <td className="px-4 py-3 text-sm text-right">
                                  {formatDuration(entry.totaal_uren)}
                                </td>
                                <td className="px-4 py-3 text-sm text-right font-medium">
                                  {entry.totaal_km}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => handleEditEntry(entry)}
                                    className="text-primary-600 hover:text-primary-900 p-1"
                                    title="Bewerken"
                                  >
                                    <PencilIcon className="h-5 w-5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="px-6 py-4 border-t flex justify-end">
                    <button onClick={() => setShowWeekModal(false)} className="btn-secondary">
                      Sluiten
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Edit Entry Modal */}
      <Transition appear show={showEditModal} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setShowEditModal(false)}>
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
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-lg bg-white p-6 shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <Dialog.Title className="text-lg font-semibold">
                      Urenregistratie bewerken
                    </Dialog.Title>
                    <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-500">
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="form-label">Ritnummer</label>
                        <input
                          type="text"
                          value={editForm.ritnummer}
                          onChange={(e) => setEditForm({ ...editForm, ritnummer: e.target.value })}
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="form-label">Kenteken</label>
                        <input
                          type="text"
                          value={editForm.kenteken}
                          onChange={(e) => setEditForm({ ...editForm, kenteken: e.target.value })}
                          className="form-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Datum</label>
                      <input
                        type="date"
                        value={editForm.datum}
                        onChange={(e) => setEditForm({ ...editForm, datum: e.target.value })}
                        className="form-input"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="form-label">Aanvang</label>
                        <input
                          type="time"
                          value={editForm.aanvang}
                          onChange={(e) => setEditForm({ ...editForm, aanvang: e.target.value })}
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="form-label">Eind</label>
                        <input
                          type="time"
                          value={editForm.eind}
                          onChange={(e) => setEditForm({ ...editForm, eind: e.target.value })}
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="form-label">Pauze</label>
                        <input
                          type="time"
                          value={editForm.pauze?.substring(0, 5) || '00:00'}
                          onChange={(e) => setEditForm({ ...editForm, pauze: e.target.value + ':00' })}
                          className="form-input"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="form-label">KM Start</label>
                        <input
                          type="number"
                          value={editForm.km_start}
                          onChange={(e) => setEditForm({ ...editForm, km_start: parseInt(e.target.value) || 0 })}
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="form-label">KM Eind</label>
                        <input
                          type="number"
                          value={editForm.km_eind}
                          onChange={(e) => setEditForm({ ...editForm, km_eind: parseInt(e.target.value) || 0 })}
                          className="form-input"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={() => setShowEditModal(false)}
                      className="btn-secondary"
                      disabled={saving}
                    >
                      Annuleren
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="btn-primary"
                      disabled={saving}
                    >
                      {saving ? 'Opslaan...' : 'Opslaan'}
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
