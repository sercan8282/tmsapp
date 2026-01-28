import { useState, useEffect, useCallback, Fragment } from 'react'
import { Dialog, Transition, Listbox } from '@headlessui/react'
import {
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  ChevronUpDownIcon,
  ExclamationTriangleIcon,
  TruckIcon,
  UserIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useAuthStore } from '@/stores/authStore'
import { Company, Driver, WeekPlanning, PlanningEntry } from '@/types'
import {
  getWeekPlannings,
  createWeekPlanning,
  deleteWeekPlanning,
  getCurrentWeek,
  copyToNextWeek,
  updatePlanningEntry,
  getMyPlanning,
  MyPlanningEntry,
} from '@/api/planning'
import { getCompanies } from '@/api/companies'
import { getDrivers } from '@/api/drivers'
import clsx from '@/utils/clsx'

const DAYS = [
  { key: 'ma', label: 'Ma', full: 'Maandag' },
  { key: 'di', label: 'Di', full: 'Dinsdag' },
  { key: 'wo', label: 'Wo', full: 'Woensdag' },
  { key: 'do', label: 'Do', full: 'Donderdag' },
  { key: 'vr', label: 'Vr', full: 'Vrijdag' },
] as const

// Get current week number helper
function getCurrentWeekNumber(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const diff = now.getTime() - start.getTime()
  const oneWeek = 604800000
  return Math.ceil((diff + start.getDay() * 86400000) / oneWeek)
}

// Chauffeur Planning View Component
function ChauffeurPlanningView() {
  const [loading, setLoading] = useState(true)
  const [currentWeek, setCurrentWeek] = useState<number>(getCurrentWeekNumber())
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear())
  const [entries, setEntries] = useState<MyPlanningEntry[]>([])
  const [chauffeurName, setChauffeurName] = useState<string>('')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    loadMyPlanning()
  }, [currentWeek, currentYear])

  const loadMyPlanning = async () => {
    try {
      setLoading(true)
      const response = await getMyPlanning(currentWeek, currentYear)
      setEntries(response.entries)
      setChauffeurName(response.chauffeur || '')
      setMessage(response.message || '')
    } catch (err) {
      console.error('Failed to load my planning:', err)
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  const handlePreviousWeek = () => {
    if (currentWeek === 1) {
      setCurrentWeek(52)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentWeek(currentWeek - 1)
    }
  }

  const handleNextWeek = () => {
    if (currentWeek === 52) {
      setCurrentWeek(1)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentWeek(currentWeek + 1)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mijn Planning</h1>
          {chauffeurName && (
            <p className="text-gray-500 mt-1">Chauffeur: {chauffeurName}</p>
          )}
        </div>
      </div>

      {/* Week selector */}
      <div className="card mb-6">
        <div className="p-4">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handlePreviousWeek}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            
            <div className="text-center min-w-[200px]">
              <div className="text-2xl font-bold text-gray-900">
                Week {currentWeek}
              </div>
              <div className="text-sm text-gray-500">{currentYear}</div>
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

      {/* Planning content */}
      {loading ? (
        <div className="card p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : message ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500">{message}</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="card p-8 text-center">
          <TruckIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Geen planning voor deze week</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dag
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Voertuig
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bedrijf
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{entry.dag_naam}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <TruckIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="font-mono font-medium">{entry.kenteken}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {entry.voertuig_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {entry.bedrijf}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Admin/Manager Planning View
function AdminPlanningView() {
  // Admins can always edit
  const isReadOnly = false
  
  // State
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<Company[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [planning, setPlanning] = useState<WeekPlanning | null>(null)
  
  // Filters
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [currentWeek, setCurrentWeek] = useState<number>(1)
  const [currentYear, setCurrentYear] = useState<number>(2026)
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Entry editing
  const [editingEntry, setEditingEntry] = useState<string | null>(null)

  // Load initial data
  useEffect(() => {
    loadInitialData()
  }, [])

  // Load planning when filters change
  useEffect(() => {
    if (selectedCompany && currentWeek && currentYear) {
      loadPlanning()
    }
  }, [selectedCompany, currentWeek, currentYear])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [companiesRes, driversRes, weekInfo] = await Promise.all([
        getCompanies({ page_size: 100 }),
        getDrivers({ page_size: 100 }),
        getCurrentWeek(),
      ])
      
      setCompanies(companiesRes.results)
      setDrivers(driversRes.results)
      setCurrentWeek(weekInfo.weeknummer)
      setCurrentYear(weekInfo.jaar)
      
      // Auto-select first company
      if (companiesRes.results.length > 0) {
        setSelectedCompany(companiesRes.results[0].id)
      }
    } catch (err) {
      console.error('Failed to load initial data:', err)
      setError('Kon data niet laden')
    } finally {
      setLoading(false)
    }
  }

  const loadPlanning = async () => {
    if (!selectedCompany) return
    
    try {
      const response = await getWeekPlannings({
        bedrijf: selectedCompany,
        weeknummer: currentWeek,
        jaar: currentYear,
      })
      
      setPlanning(response.results.length > 0 ? response.results[0] : null)
    } catch (err) {
      console.error('Failed to load planning:', err)
    }
  }

  const handlePreviousWeek = () => {
    if (currentWeek === 1) {
      setCurrentWeek(52)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentWeek(currentWeek - 1)
    }
  }

  const handleNextWeek = () => {
    if (currentWeek === 52) {
      setCurrentWeek(1)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentWeek(currentWeek + 1)
    }
  }

  const handleCreatePlanning = async () => {
    if (!selectedCompany) return
    
    try {
      setSaving(true)
      setError(null)
      
      await createWeekPlanning({
        bedrijf: selectedCompany,
        weeknummer: currentWeek,
        jaar: currentYear,
      })
      
      setShowCreateModal(false)
      loadPlanning()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Kon planning niet aanmaken')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePlanning = async () => {
    if (!planning) return
    
    try {
      setSaving(true)
      await deleteWeekPlanning(planning.id)
      setPlanning(null)
      setShowDeleteModal(false)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Kon planning niet verwijderen')
    } finally {
      setSaving(false)
    }
  }

  const handleCopyToNextWeek = async () => {
    if (!planning) return
    
    try {
      setSaving(true)
      setError(null)
      
      const newPlanning = await copyToNextWeek(planning.id)
      
      // Navigate to the new week
      setCurrentWeek(newPlanning.weeknummer)
      setCurrentYear(newPlanning.jaar)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Kon planning niet kopiëren')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateEntry = async (entryId: string, chauffeurId: string | null) => {
    try {
      await updatePlanningEntry(entryId, { chauffeur: chauffeurId })
      loadPlanning()
      setEditingEntry(null)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Kon toewijzing niet opslaan')
    }
  }

  // Export planning to PDF
  const handleExportPDF = () => {
    if (!planning?.entries || planning.entries.length === 0) {
      setError('Geen planning data om te exporteren')
      return
    }

    const companyName = companies.find(c => c.id === selectedCompany)?.naam || 'Onbekend'
    
    // Create PDF in landscape mode for better table fit
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    // Title
    doc.setFontSize(18)
    doc.text(`Weekplanning Week ${currentWeek} - ${currentYear}`, 14, 15)
    
    doc.setFontSize(12)
    doc.text(`Bedrijf: ${companyName}`, 14, 23)
    
    // Prepare table data
    // Columns: Weeknummer, Dag, Route, Chauffeur, Telefoonnummer, ADR, Kenteken
    const tableData: string[][] = []
    
    // Sort entries by day order
    const dayOrder = { ma: 1, di: 2, wo: 3, do: 4, vr: 5 }
    const sortedEntries = [...planning.entries].sort((a, b) => {
      const dayDiff = dayOrder[a.dag] - dayOrder[b.dag]
      if (dayDiff !== 0) return dayDiff
      // Then sort by kenteken
      return a.vehicle_kenteken.localeCompare(b.vehicle_kenteken)
    })

    for (const entry of sortedEntries) {
      tableData.push([
        currentWeek.toString(),
        entry.dag_display || entry.dag.toUpperCase(),
        entry.vehicle_ritnummer || '-',
        entry.chauffeur_naam || '-',
        entry.telefoon || '-',
        entry.adr ? 'Ja' : 'Nee',
        entry.vehicle_kenteken || '-'
      ])
    }

    // Generate table
    autoTable(doc, {
      head: [['Weeknummer', 'Dag', 'Route', 'Chauffeur', 'Telefoonnummer', 'ADR', 'Kenteken']],
      body: tableData,
      startY: 30,
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [59, 130, 246], // Blue color
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      columnStyles: {
        0: { cellWidth: 25 }, // Weeknummer
        1: { cellWidth: 25 }, // Dag
        2: { cellWidth: 35 }, // Route
        3: { cellWidth: 50 }, // Chauffeur
        4: { cellWidth: 40 }, // Telefoonnummer
        5: { cellWidth: 20 }, // ADR
        6: { cellWidth: 30 }, // Kenteken
      },
    })

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(128)
      doc.text(
        `Gegenereerd op ${new Date().toLocaleDateString('nl-NL')} om ${new Date().toLocaleTimeString('nl-NL')}`,
        14,
        doc.internal.pageSize.height - 10
      )
      doc.text(
        `Pagina ${i} van ${pageCount}`,
        doc.internal.pageSize.width - 30,
        doc.internal.pageSize.height - 10
      )
    }

    // Download
    doc.save(`planning-week-${currentWeek}-${currentYear}-${companyName.replace(/\s+/g, '-')}.pdf`)
  }

  // Group entries by vehicle
  const getEntriesByVehicle = useCallback(() => {
    if (!planning?.entries) return []
    
    const vehicleMap = new Map<string, {
      kenteken: string
      type: string
      ritnummer: string
      entries: Map<string, PlanningEntry>
    }>()
    
    for (const entry of planning.entries) {
      if (!vehicleMap.has(entry.vehicle)) {
        vehicleMap.set(entry.vehicle, {
          kenteken: entry.vehicle_kenteken,
          type: entry.vehicle_type,
          ritnummer: entry.vehicle_ritnummer,
          entries: new Map()
        })
      }
      vehicleMap.get(entry.vehicle)!.entries.set(entry.dag, entry)
    }
    
    return Array.from(vehicleMap.entries()).map(([vehicleId, data]) => ({
      vehicleId,
      ...data
    }))
  }, [planning])

  // Get drivers for company
  const companyDrivers = drivers.filter(d => 
    !d.bedrijf || d.bedrijf === selectedCompany
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Weekplanning</h1>
        {planning && (
          <div className="flex gap-2">
            <button
              onClick={handleExportPDF}
              className="btn-secondary"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Exporteer PDF
            </button>
            {!isReadOnly && (
              <>
                <button
                  onClick={handleCopyToNextWeek}
                  disabled={saving}
                  className="btn-secondary"
                >
                  <DocumentDuplicateIcon className="h-5 w-5 mr-2" />
                  Kopieer naar volgende week
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="btn-danger"
                >
                  <TrashIcon className="h-5 w-5 mr-2" />
                  Verwijderen
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="p-4 flex flex-wrap items-center gap-4">
          {/* Company selector */}
          <div className="w-64">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bedrijf
            </label>
            <Listbox value={selectedCompany} onChange={setSelectedCompany}>
              <div className="relative">
                <Listbox.Button className="input-field w-full text-left flex items-center justify-between">
                  <span className="truncate">
                    {companies.find(c => c.id === selectedCompany)?.naam || 'Selecteer...'}
                  </span>
                  <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
                </Listbox.Button>
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    {companies.map((company) => (
                      <Listbox.Option
                        key={company.id}
                        value={company.id}
                        className={({ active }) =>
                          clsx(
                            'cursor-pointer select-none relative py-2 pl-10 pr-4',
                            active ? 'bg-primary-100 text-primary-900' : 'text-gray-900'
                          )
                        }
                      >
                        {({ selected }) => (
                          <>
                            <span className={clsx('block truncate', selected && 'font-semibold')}>
                              {company.naam}
                            </span>
                            {selected && (
                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary-600">
                                <CheckIcon className="h-5 w-5" />
                              </span>
                            )}
                          </>
                        )}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            </Listbox>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousWeek}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <div className="px-4 py-2 bg-primary-50 rounded-lg font-medium text-primary-700 min-w-[140px] text-center">
              Week {currentWeek} / {currentYear}
            </div>
            <button
              onClick={handleNextWeek}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Create button */}
          {!isReadOnly && !planning && selectedCompany && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary ml-auto"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Planning aanmaken
            </button>
          )}
        </div>
      </div>

      {/* Planning Grid */}
      {planning ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                    Voertuig
                  </th>
                  {DAYS.map((day) => (
                    <th
                      key={day.key}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]"
                    >
                      {day.full}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getEntriesByVehicle().map((vehicle) => (
                  <tr key={vehicle.vehicleId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <TruckIcon className="h-5 w-5 text-gray-400 mr-2" />
                        <div>
                          <div className="font-medium text-gray-900">
                            {vehicle.kenteken}
                          </div>
                          <div className="text-sm text-gray-500">
                            {vehicle.ritnummer} • {vehicle.type}
                          </div>
                        </div>
                      </div>
                    </td>
                    {DAYS.map((day) => {
                      const entry = vehicle.entries.get(day.key)
                      if (!entry) return <td key={day.key} className="px-4 py-3" />
                      
                      const isEditing = editingEntry === entry.id
                      
                      return (
                        <td key={day.key} className="px-2 py-2">
                          {isEditing && !isReadOnly ? (
                            <DriverSelector
                              drivers={companyDrivers}
                              value={entry.chauffeur}
                              onChange={(driverId) => handleUpdateEntry(entry.id, driverId)}
                              onCancel={() => setEditingEntry(null)}
                            />
                          ) : (
                            <div
                              onClick={() => !isReadOnly && setEditingEntry(entry.id)}
                              className={clsx(
                                'rounded-lg p-2 min-h-[60px] transition-colors',
                                entry.chauffeur
                                  ? 'bg-primary-50 border border-primary-200'
                                  : 'bg-gray-50 border border-gray-200 border-dashed',
                                !isReadOnly && 'cursor-pointer hover:border-primary-400'
                              )}
                            >
                              {entry.chauffeur ? (
                                <div className="flex items-center">
                                  <UserIcon className="h-4 w-4 text-primary-600 mr-1.5" />
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {entry.chauffeur_naam}
                                    </div>
                                    {entry.adr && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                        ADR
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400 text-center">
                                  {isReadOnly ? 'Niet toegewezen' : 'Klik om toe te wijzen'}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {getEntriesByVehicle().length === 0 && (
            <div className="p-8 text-center text-gray-500">
              Geen voertuigen gevonden voor dit bedrijf.
              Voeg eerst voertuigen toe in het Vloot beheer.
            </div>
          )}
        </div>
      ) : selectedCompany ? (
        <div className="card">
          <div className="p-8 text-center">
            <TruckIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">
              Geen planning voor deze week
            </h3>
            <p className="mt-1 text-gray-500">
              Er is nog geen planning aangemaakt voor week {currentWeek} van {currentYear}.
            </p>
            {!isReadOnly && (
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Planning aanmaken
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="p-8 text-center text-gray-500">
            Selecteer eerst een bedrijf om de planning te bekijken.
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Transition appear show={showCreateModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowCreateModal(false)}>
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
                      Planning aanmaken
                    </Dialog.Title>
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Er wordt een nieuwe planning aangemaakt voor:
                    </p>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <dl className="space-y-2">
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Bedrijf:</dt>
                          <dd className="text-sm font-medium">
                            {companies.find(c => c.id === selectedCompany)?.naam}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Week:</dt>
                          <dd className="text-sm font-medium">
                            {currentWeek} / {currentYear}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <p className="text-sm text-gray-500">
                      Alle voertuigen van dit bedrijf worden automatisch toegevoegd aan de planning.
                    </p>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="btn-secondary"
                    >
                      Annuleren
                    </button>
                    <button
                      onClick={handleCreatePlanning}
                      disabled={saving}
                      className="btn-primary"
                    >
                      {saving ? 'Bezig...' : 'Aanmaken'}
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
                    <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                      <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-gray-900">
                        Planning verwijderen
                      </Dialog.Title>
                      <p className="mt-2 text-sm text-gray-500">
                        Weet je zeker dat je de planning voor week {currentWeek} / {currentYear} wilt verwijderen?
                        Alle chauffeur toewijzingen gaan verloren.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(false)}
                      className="btn-secondary"
                    >
                      Annuleren
                    </button>
                    <button
                      onClick={handleDeletePlanning}
                      disabled={saving}
                      className="btn-danger"
                    >
                      {saving ? 'Bezig...' : 'Verwijderen'}
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

// Driver selector dropdown component
interface DriverSelectorProps {
  drivers: Driver[]
  value: string | null
  onChange: (driverId: string | null) => void
  onCancel: () => void
}

function DriverSelector({ drivers, value, onChange, onCancel }: DriverSelectorProps) {
  return (
    <div className="relative">
      <select
        autoFocus
        defaultValue={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        onBlur={onCancel}
        className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
      >
        <option value="">-- Niet toegewezen --</option>
        {drivers.map((driver) => (
          <option key={driver.id} value={driver.id}>
            {driver.naam} {driver.adr ? '(ADR)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

// Main export - shows different view based on user role
export default function PlanningPage() {
  const { user } = useAuthStore()
  
  // Chauffeurs see their own planning
  if (user?.rol === 'chauffeur') {
    return <ChauffeurPlanningView />
  }
  
  // Admins and managers see the full planning management
  return <AdminPlanningView />
}
