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
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline'
import { Company } from '@/types'
import { 
  getCompanies, 
  createCompany, 
  updateCompany, 
  deleteCompany,
  CompanyFilters,
  CompanyCreate,
  CompanyUpdate,
} from '@/api/companies'
import Pagination, { PageSize } from '@/components/common/Pagination'

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

// Company form component
function CompanyForm({
  company,
  onSave,
  onCancel,
  isLoading,
}: {
  company?: Company
  onSave: (data: CompanyCreate | CompanyUpdate) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    naam: company?.naam || '',
    kvk: company?.kvk || '',
    telefoon: company?.telefoon || '',
    contactpersoon: company?.contactpersoon || '',
    email: company?.email || '',
    adres: company?.adres || '',
    postcode: company?.postcode || '',
    stad: company?.stad || '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.naam.trim()) newErrors.naam = 'Naam is verplicht'
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Ongeldig e-mailadres'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bedrijfsnaam *
        </label>
        <input
          type="text"
          name="naam"
          value={formData.naam}
          onChange={handleChange}
          className={`input ${errors.naam ? 'border-red-500' : ''}`}
        />
        {errors.naam && <p className="text-red-500 text-xs mt-1">{errors.naam}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            KVK Nummer
          </label>
          <input
            type="text"
            name="kvk"
            value={formData.kvk}
            onChange={handleChange}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Telefoon
          </label>
          <input
            type="tel"
            name="telefoon"
            value={formData.telefoon}
            onChange={handleChange}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contactpersoon
          </label>
          <input
            type="text"
            name="contactpersoon"
            value={formData.contactpersoon}
            onChange={handleChange}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            E-mail
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={`input ${errors.email ? 'border-red-500' : ''}`}
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Adres
        </label>
        <input
          type="text"
          name="adres"
          value={formData.adres}
          onChange={handleChange}
          className="input"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Postcode
          </label>
          <input
            type="text"
            name="postcode"
            value={formData.postcode}
            onChange={handleChange}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stad
          </label>
          <input
            type="text"
            name="stad"
            value={formData.stad}
            onChange={handleChange}
            className="input"
          />
        </div>
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
          {isLoading ? 'Bezig...' : company ? 'Opslaan' : 'Aanmaken'}
        </button>
      </div>
    </form>
  )
}

// Main CompaniesPage component
export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<string>('naam')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [pageSize, setPageSize] = useState<PageSize>(30)

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)

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

  // Fetch companies
  const fetchCompanies = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const filters: CompanyFilters = {
        page,
        page_size: pageSize,
        ordering: sortDirection === 'asc' ? sortField : `-${sortField}`,
      }
      if (search) filters.search = search
      
      const response = await getCompanies(filters)
      setCompanies(response.results || [])
      setTotalCount(response.count || 0)
    } catch (err) {
      setError('Fout bij ophalen bedrijven')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, search, sortField, sortDirection])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

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
  const handleCreate = async (data: CompanyCreate | CompanyUpdate) => {
    setIsActionLoading(true)
    try {
      await createCompany(data as CompanyCreate)
      setShowCreateModal(false)
      showSuccess('Bedrijf succesvol aangemaakt')
      fetchCompanies()
    } catch (err: any) {
      setError(getErrorMessage(err, 'Fout bij aanmaken bedrijf'))
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle update
  const handleUpdate = async (data: CompanyCreate | CompanyUpdate) => {
    if (!selectedCompany) return
    setIsActionLoading(true)
    try {
      await updateCompany(selectedCompany.id, data as CompanyUpdate)
      setShowEditModal(false)
      setSelectedCompany(null)
      showSuccess('Bedrijf succesvol bijgewerkt')
      fetchCompanies()
    } catch (err: any) {
      setError(getErrorMessage(err, 'Fout bij bijwerken bedrijf'))
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!selectedCompany) return
    setIsActionLoading(true)
    try {
      await deleteCompany(selectedCompany.id)
      setShowDeleteModal(false)
      setSelectedCompany(null)
      showSuccess('Bedrijf succesvol verwijderd')
      fetchCompanies()
    } catch (err: any) {
      setError(getErrorMessage(err, 'Fout bij verwijderen bedrijf'))
      setShowDeleteModal(false)
      setSelectedCompany(null)
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle page size change
  const handlePageSizeChange = (newSize: PageSize) => {
    setPageSize(newSize)
    setPage(1)
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
        <h1 className="page-title">Bedrijven</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Nieuw bedrijf
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
                  placeholder="Zoek op naam, KVK, contactpersoon..."
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Refresh button */}
            <button
              onClick={() => fetchCompanies()}
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
                  onClick={() => handleSort('naam')}
                >
                  Bedrijf <SortIcon field="naam" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  KVK
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Contactpersoon
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Contact
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('stad')}
                >
                  Locatie <SortIcon field="stad" />
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                      <span className="ml-3">Laden...</span>
                    </div>
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <BuildingOfficeIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p>Geen bedrijven gevonden</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-2 text-primary-600 hover:text-primary-700"
                    >
                      Voeg je eerste bedrijf toe
                    </button>
                  </td>
                </tr>
              ) : (
                companies.map(company => (
                  <tr key={company.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{company.naam}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{company.kvk || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{company.contactpersoon || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {company.telefoon && <div className="text-gray-600">{company.telefoon}</div>}
                        {company.email && <div className="text-gray-500">{company.email}</div>}
                        {!company.telefoon && !company.email && <span className="text-gray-400">-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {company.stad && <div className="text-gray-600">{company.stad}</div>}
                        {company.postcode && <div className="text-gray-500">{company.postcode}</div>}
                        {!company.stad && !company.postcode && <span className="text-gray-400">-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setSelectedCompany(company); setShowEditModal(true) }}
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded"
                          title="Bewerken"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedCompany(company); setShowDeleteModal(true) }}
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
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nieuw bedrijf"
        size="lg"
      >
        <CompanyForm
          onSave={handleCreate}
          onCancel={() => setShowCreateModal(false)}
          isLoading={isActionLoading}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedCompany(null) }}
        title="Bedrijf bewerken"
        size="lg"
      >
        {selectedCompany && (
          <CompanyForm
            company={selectedCompany}
            onSave={handleUpdate}
            onCancel={() => { setShowEditModal(false); setSelectedCompany(null) }}
            isLoading={isActionLoading}
          />
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmDialog
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedCompany(null) }}
        onConfirm={handleDelete}
        title="Bedrijf verwijderen"
        message={`Weet je zeker dat je "${selectedCompany?.naam}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`}
        confirmText="Verwijderen"
        isLoading={isActionLoading}
      />
    </div>
  )
}
