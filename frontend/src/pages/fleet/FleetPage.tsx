import { useState, useEffect, useCallback } from 'react'
import { 
  MagnifyingGlassIcon, 
  PlusIcon, 
  PencilSquareIcon, 
  TrashIcon,
  CheckCircleIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowPathIcon,
  TruckIcon,
} from '@heroicons/react/24/outline'
import { Vehicle, Company } from '@/types'
import { 
  getVehicles, 
  createVehicle, 
  updateVehicle, 
  deleteVehicle,
  VehicleFilters,
  VehicleCreate,
  VehicleUpdate,
} from '@/api/fleet'
import { getAllCompanies } from '@/api/companies'

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
  isLoading = false,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  isLoading?: boolean
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          disabled={isLoading}
        >
          Annuleren
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? 'Bezig...' : confirmText}
        </button>
      </div>
    </Modal>
  )
}

// Vehicle form component
function VehicleForm({
  vehicle,
  companies,
  onSave,
  onCancel,
  isLoading,
}: {
  vehicle?: Vehicle
  companies: Company[]
  onSave: (data: VehicleCreate | VehicleUpdate) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    kenteken: vehicle?.kenteken || '',
    type_wagen: vehicle?.type_wagen || '',
    ritnummer: vehicle?.ritnummer || '',
    bedrijf: vehicle?.bedrijf?.toString() || '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.kenteken.trim()) newErrors.kenteken = 'Kenteken is verplicht'
    if (!formData.bedrijf) newErrors.bedrijf = 'Bedrijf is verplicht'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    
    const saveData: VehicleCreate | VehicleUpdate = {
      kenteken: formData.kenteken.toUpperCase(),
      type_wagen: formData.type_wagen || undefined,
      ritnummer: formData.ritnummer || undefined,
      bedrijf: parseInt(formData.bedrijf),
    }
    onSave(saveData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kenteken *
        </label>
        <input
          type="text"
          name="kenteken"
          value={formData.kenteken}
          onChange={handleChange}
          placeholder="AB-123-CD"
          className={`input uppercase ${errors.kenteken ? 'border-red-500' : ''}`}
        />
        {errors.kenteken && <p className="text-red-500 text-xs mt-1">{errors.kenteken}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Type wagen
        </label>
        <input
          type="text"
          name="type_wagen"
          value={formData.type_wagen}
          onChange={handleChange}
          placeholder="Bijv. Vrachtwagen, Bestelbus, Trailer"
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Ritnummer
        </label>
        <input
          type="text"
          name="ritnummer"
          value={formData.ritnummer}
          onChange={handleChange}
          placeholder="Interne ritnummer"
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bedrijf *
        </label>
        <select
          name="bedrijf"
          value={formData.bedrijf}
          onChange={handleChange}
          className={`input ${errors.bedrijf ? 'border-red-500' : ''}`}
        >
          <option value="">Selecteer bedrijf</option>
          {companies.map(company => (
            <option key={company.id} value={company.id}>
              {company.naam}
            </option>
          ))}
        </select>
        {errors.bedrijf && <p className="text-red-500 text-xs mt-1">{errors.bedrijf}</p>}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          disabled={isLoading}
        >
          Annuleren
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={isLoading}
        >
          {isLoading ? 'Bezig...' : vehicle ? 'Opslaan' : 'Aanmaken'}
        </button>
      </div>
    </form>
  )
}

// Main FleetPage component
export default function FleetPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<string>('kenteken')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const pageSize = 10

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)

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

  // Fetch lookups (companies)
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const companiesData = await getAllCompanies()
        setCompanies(companiesData)
      } catch (err) {
        console.error('Error fetching companies:', err)
      }
    }
    fetchLookups()
  }, [])

  // Get unique vehicle types for filter
  const vehicleTypes = [...new Set(vehicles.map(v => v.type_wagen).filter(Boolean))]

  // Fetch vehicles
  const fetchVehicles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const filters: VehicleFilters = {
        page,
        page_size: pageSize,
        ordering: sortDirection === 'asc' ? sortField : `-${sortField}`,
      }
      if (search) filters.search = search
      if (companyFilter) filters.bedrijf = parseInt(companyFilter)
      if (typeFilter) filters.type_wagen = typeFilter
      
      const response = await getVehicles(filters)
      setVehicles(response.results || [])
      setTotalCount(response.count || 0)
    } catch (err) {
      setError('Fout bij ophalen voertuigen')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, search, companyFilter, typeFilter, sortField, sortDirection])

  useEffect(() => {
    fetchVehicles()
  }, [fetchVehicles])

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
      setSortDirection('asc')
    }
  }

  // Handle create
  const handleCreate = async (data: VehicleCreate | VehicleUpdate) => {
    setIsActionLoading(true)
    try {
      await createVehicle(data as VehicleCreate)
      setShowCreateModal(false)
      showSuccess('Voertuig succesvol aangemaakt')
      fetchVehicles()
    } catch (err: any) {
      setError(getErrorMessage(err, 'Fout bij aanmaken voertuig'))
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle update
  const handleUpdate = async (data: VehicleCreate | VehicleUpdate) => {
    if (!selectedVehicle) return
    setIsActionLoading(true)
    try {
      await updateVehicle(selectedVehicle.id, data as VehicleUpdate)
      setShowEditModal(false)
      setSelectedVehicle(null)
      showSuccess('Voertuig succesvol bijgewerkt')
      fetchVehicles()
    } catch (err: any) {
      setError(getErrorMessage(err, 'Fout bij bijwerken voertuig'))
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!selectedVehicle) return
    setIsActionLoading(true)
    try {
      await deleteVehicle(selectedVehicle.id)
      setShowDeleteModal(false)
      setSelectedVehicle(null)
      showSuccess('Voertuig succesvol verwijderd')
      fetchVehicles()
    } catch (err: any) {
      setError(getErrorMessage(err, 'Fout bij verwijderen voertuig'))
      setShowDeleteModal(false)
      setSelectedVehicle(null)
    } finally {
      setIsActionLoading(false)
    }
  }

  // Get company name by ID
  const getCompanyName = (vehicle: Vehicle) => {
    if (vehicle.bedrijf_naam) return vehicle.bedrijf_naam
    if (vehicle.bedrijf) {
      const company = companies.find(c => c.id === vehicle.bedrijf)
      return company?.naam || '-'
    }
    return '-'
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

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Wagenpark</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Nieuw voertuig
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

      {/* Filters */}
      <div className="card mb-6">
        <div className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex-1 min-w-64">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zoeken
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Zoek op kenteken, type, ritnummer..."
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Company filter */}
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bedrijf
              </label>
              <select
                value={companyFilter}
                onChange={(e) => { setCompanyFilter(e.target.value); setPage(1) }}
                className="input"
              >
                <option value="">Alle bedrijven</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.naam}
                  </option>
                ))}
              </select>
            </div>

            {/* Type filter */}
            {vehicleTypes.length > 0 && (
              <div className="w-48">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
                  className="input"
                >
                  <option value="">Alle types</option>
                  {vehicleTypes.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Refresh button */}
            <button
              onClick={() => fetchVehicles()}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="Vernieuwen"
            >
              <ArrowPathIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('kenteken')}
                >
                  Kenteken <SortIcon field="kenteken" />
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('type_wagen')}
                >
                  Type <SortIcon field="type_wagen" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Ritnummer
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Bedrijf
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                      <span className="ml-3">Laden...</span>
                    </div>
                  </td>
                </tr>
              ) : vehicles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    <TruckIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p>Geen voertuigen gevonden</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-2 text-primary-600 hover:text-primary-700"
                    >
                      Voeg je eerste voertuig toe
                    </button>
                  </td>
                </tr>
              ) : (
                vehicles.map(vehicle => (
                  <tr key={vehicle.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 font-mono">
                        {vehicle.kenteken}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{vehicle.type_wagen || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{vehicle.ritnummer || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{getCompanyName(vehicle)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setSelectedVehicle(vehicle); setShowEditModal(true) }}
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded"
                          title="Bewerken"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedVehicle(vehicle); setShowDeleteModal(true) }}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded"
                          title="Verwijderen"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {totalCount} voertuig{totalCount !== 1 ? 'en' : ''} gevonden
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Vorige
              </button>
              <span className="text-sm text-gray-600">
                Pagina {page} van {totalPages}
              </span>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Volgende
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nieuw voertuig"
        size="md"
      >
        <VehicleForm
          companies={companies}
          onSave={handleCreate}
          onCancel={() => setShowCreateModal(false)}
          isLoading={isActionLoading}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedVehicle(null) }}
        title="Voertuig bewerken"
        size="md"
      >
        {selectedVehicle && (
          <VehicleForm
            vehicle={selectedVehicle}
            companies={companies}
            onSave={handleUpdate}
            onCancel={() => { setShowEditModal(false); setSelectedVehicle(null) }}
            isLoading={isActionLoading}
          />
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmDialog
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedVehicle(null) }}
        onConfirm={handleDelete}
        title="Voertuig verwijderen"
        message={`Weet je zeker dat je voertuig "${selectedVehicle?.kenteken}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`}
        confirmText="Verwijderen"
        isLoading={isActionLoading}
      />
    </div>
  )
}
