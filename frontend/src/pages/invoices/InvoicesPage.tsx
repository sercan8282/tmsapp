import { useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, Transition } from '@headlessui/react'
import {
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
  CurrencyEuroIcon,
  EyeIcon,
  EnvelopeIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { Company, Invoice } from '@/types'
import Pagination, { PageSize } from '@/components/common/Pagination'
import {
  getInvoices,
  deleteInvoice,
  markDefinitief,
  markVerzonden,
  markBetaald,
  sendInvoiceEmail,
  generatePdf,
  changeStatus,
  InvoiceFilters,
} from '@/api/invoices'
import { getCompanies } from '@/api/companies'
import clsx from '@/utils/clsx'

const TYPE_OPTIONS = [
  { value: '', label: 'Alle types' },
  { value: 'verkoop', label: 'Verkoop' },
  { value: 'inkoop', label: 'Inkoop' },
  { value: 'credit', label: 'Credit' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Alle statussen' },
  { value: 'concept', label: 'Concept' },
  { value: 'definitief', label: 'Definitief' },
  { value: 'verzonden', label: 'Verzonden' },
  { value: 'betaald', label: 'Betaald' },
]

const STATUS_COLORS: Record<string, string> = {
  concept: 'bg-gray-100 text-gray-800',
  definitief: 'bg-blue-100 text-blue-800',
  verzonden: 'bg-yellow-100 text-yellow-800',
  betaald: 'bg-green-100 text-green-800',
}

export default function InvoicesPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isReadOnly = user?.rol === 'chauffeur'
  
  // Data state
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  
  // Filter state
  const [filters, setFilters] = useState<InvoiceFilters>({
    page: 1,
    page_size: 30,
    ordering: '-factuurdatum',
  })
  const [searchInput, setSearchInput] = useState('')
  const [pageSize, setPageSize] = useState<PageSize>(30)
  
  // Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [emailAddress, setEmailAddress] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [filters])

  const loadInitialData = async () => {
    try {
      const companiesRes = await getCompanies({ page_size: 100 })
      setCompanies(companiesRes.results)
    } catch (err) {
      console.error('Failed to load initial data:', err)
    }
  }

  const loadInvoices = async () => {
    try {
      setLoading(true)
      const response = await getInvoices(filters)
      setInvoices(response.results)
      setTotalCount(response.count)
    } catch (err) {
      console.error('Failed to load invoices:', err)
      setError('Kon facturen niet laden')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, search: searchInput, page: 1 }))
  }

  const handleSort = (field: string) => {
    setFilters(prev => {
      const currentOrdering = prev.ordering || ''
      // If already sorting by this field, toggle direction
      if (currentOrdering === field) {
        return { ...prev, ordering: `-${field}`, page: 1 }
      } else if (currentOrdering === `-${field}`) {
        return { ...prev, ordering: field, page: 1 }
      } else {
        // New field, default to ascending
        return { ...prev, ordering: field, page: 1 }
      }
    })
  }

  const handleFilterChange = (key: keyof InvoiceFilters, value: string) => {
    setFilters(prev => ({ 
      ...prev, 
      [key]: value || undefined,
      page: 1 
    }))
  }

  const handleDeleteInvoice = async () => {
    if (!selectedInvoice) return
    
    try {
      setSaving(true)
      await deleteInvoice(selectedInvoice.id)
      setShowDeleteModal(false)
      setSelectedInvoice(null)
      loadInvoices()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Kon factuur niet verwijderen')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusAction = async (invoice: Invoice, action: 'definitief' | 'verzonden' | 'betaald') => {
    try {
      setSaving(true)
      setError(null)
      
      if (action === 'definitief') {
        await markDefinitief(invoice.id)
      } else if (action === 'verzonden') {
        await markVerzonden(invoice.id)
      } else if (action === 'betaald') {
        await markBetaald(invoice.id)
      }
      
      loadInvoices()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Kon status niet wijzigen')
    } finally {
      setSaving(false)
    }
  }

  const handleSendEmail = async () => {
    if (!selectedInvoice || !emailAddress) return
    
    try {
      setEmailSending(true)
      setError(null)
      
      const result = await sendInvoiceEmail(selectedInvoice.id, emailAddress)
      
      setShowEmailModal(false)
      setEmailAddress('')
      setSuccessMessage(result.message || 'Factuur succesvol verzonden!')
      loadInvoices()
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Kon e-mail niet versturen')
    } finally {
      setEmailSending(false)
    }
  }

  const openEmailModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setEmailAddress('')
    setShowEmailModal(true)
  }

  const handleDownloadPdf = async (invoice: Invoice) => {
    try {
      setSaving(true)
      setError(null)
      await generatePdf(invoice.id)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Kon PDF niet genereren')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const handlePageSizeChange = (newSize: PageSize) => {
    setPageSize(newSize)
    setFilters(prev => ({ ...prev, page_size: newSize, page: 1 }))
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Facturen</h1>
        {!isReadOnly && (
          <button onClick={() => navigate('/invoices/new')} className="btn-primary">
            <PlusIcon className="h-5 w-5 mr-2" />
            Nieuwe factuur
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-green-500 hover:text-green-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Zoek op factuurnummer of bedrijf..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="input-field pl-10 w-full"
                />
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
            
            {/* Type filter */}
            <select
              value={filters.type || ''}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="input-field w-40"
            >
              {TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            
            {/* Status filter */}
            <select
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="input-field w-40"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            
            {/* Company filter */}
            <select
              value={filters.bedrijf || ''}
              onChange={(e) => handleFilterChange('bedrijf', e.target.value)}
              className="input-field w-48"
            >
              <option value="">Alle bedrijven</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.naam}</option>
              ))}
            </select>
            
            <button onClick={handleSearch} className="btn-primary">
              Zoeken
            </button>
          </div>
        </div>
      </div>

      {/* Invoices table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('factuurnummer')}
                >
                  <div className="flex items-center gap-1">
                    Factuurnummer
                    {filters.ordering?.includes('factuurnummer') && (
                      filters.ordering.startsWith('-') 
                        ? <ChevronDownIcon className="h-4 w-4" />
                        : <ChevronUpIcon className="h-4 w-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('bedrijf__naam')}
                >
                  <div className="flex items-center gap-1">
                    Bedrijf
                    {filters.ordering?.includes('bedrijf__naam') && (
                      filters.ordering.startsWith('-') 
                        ? <ChevronDownIcon className="h-4 w-4" />
                        : <ChevronUpIcon className="h-4 w-4" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('factuurdatum')}
                >
                  <div className="flex items-center gap-1">
                    Datum
                    {filters.ordering?.includes('factuurdatum') && (
                      filters.ordering.startsWith('-') 
                        ? <ChevronDownIcon className="h-4 w-4" />
                        : <ChevronUpIcon className="h-4 w-4" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Totaal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Geen facturen gevonden
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="font-medium text-gray-900">{invoice.factuurnummer}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {invoice.bedrijf_naam}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 capitalize">
                      {invoice.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {new Date(invoice.factuurdatum).toLocaleDateString('nl-NL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      {formatCurrency(invoice.totaal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx(
                        'px-2 py-1 text-xs font-medium rounded-full capitalize',
                        STATUS_COLORS[invoice.status] || 'bg-gray-100 text-gray-800'
                      )}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setSelectedInvoice(invoice); setShowDetailModal(true) }}
                          className="text-gray-600 hover:text-gray-900"
                          title="Bekijken"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        
                        {/* PDF Download - available for all statuses */}
                        <button
                          onClick={() => handleDownloadPdf(invoice)}
                          disabled={saving}
                          className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50"
                          title="Download PDF"
                        >
                          <ArrowDownTrayIcon className="h-5 w-5" />
                        </button>
                        
                        {/* Edit button - available for all statuses */}
                        {!isReadOnly && (
                          <button
                            onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
                            className="text-orange-600 hover:text-orange-900"
                            title="Bewerken"
                          >
                            <PencilSquareIcon className="h-5 w-5" />
                          </button>
                        )}
                        
                        {/* Email button - available for definitief and verzonden */}
                        {!isReadOnly && (invoice.status === 'definitief' || invoice.status === 'verzonden') && (
                          <button
                            onClick={() => openEmailModal(invoice)}
                            className="text-purple-600 hover:text-purple-900"
                            title="Verstuur via e-mail"
                          >
                            <EnvelopeIcon className="h-5 w-5" />
                          </button>
                        )}
                        
                        {/* Status actions based on current status */}
                        {!isReadOnly && invoice.status === 'concept' && (
                          <button
                            onClick={() => handleStatusAction(invoice, 'definitief')}
                            className="text-blue-600 hover:text-blue-900"
                            title="Definitief maken"
                          >
                            <CheckCircleIcon className="h-5 w-5" />
                          </button>
                        )}
                        
                        {!isReadOnly && invoice.status === 'definitief' && (
                          <button
                            onClick={() => handleStatusAction(invoice, 'verzonden')}
                            className="text-yellow-600 hover:text-yellow-900"
                            title="Markeer als verzonden"
                          >
                            <PaperAirplaneIcon className="h-5 w-5" />
                          </button>
                        )}
                        
                        {!isReadOnly && invoice.status === 'verzonden' && (
                          <button
                            onClick={() => handleStatusAction(invoice, 'betaald')}
                            className="text-green-600 hover:text-green-900"
                            title="Markeer als betaald"
                          >
                            <CurrencyEuroIcon className="h-5 w-5" />
                          </button>
                        )}
                        
                        {/* Delete button - available for all statuses */}
                        {!isReadOnly && (
                          <button
                            onClick={() => { setSelectedInvoice(invoice); setShowDeleteModal(true) }}
                            className="text-red-600 hover:text-red-900"
                            title="Verwijderen"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        )}
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
          currentPage={filters.page || 1}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={(page) => setFilters(prev => ({ ...prev, page }))}
          onPageSizeChange={handlePageSizeChange}
        />
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
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-lg bg-white p-6 shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <Dialog.Title className="text-lg font-semibold">
                      Factuur {selectedInvoice?.factuurnummer}
                    </Dialog.Title>
                    <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-500">
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  {selectedInvoice && (
                    <div className="space-y-6">
                      {/* Header info */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500">Bedrijf</div>
                          <div className="font-medium">{selectedInvoice.bedrijf_naam}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Status</div>
                          <select
                            value={selectedInvoice.status}
                            onChange={async (e) => {
                              const newStatus = e.target.value as Invoice['status'];
                              try {
                                await changeStatus(selectedInvoice.id, newStatus);
                                setSelectedInvoice({ ...selectedInvoice, status: newStatus });
                                fetchData();
                                toast.success('Status gewijzigd');
                              } catch (err) {
                                toast.error('Status wijzigen mislukt');
                              }
                            }}
                            className={clsx(
                              'px-2 py-1 text-xs font-medium rounded-full capitalize cursor-pointer border-0',
                              STATUS_COLORS[selectedInvoice.status]
                            )}
                          >
                            <option value="concept">Concept</option>
                            <option value="definitief">Definitief</option>
                            <option value="verzonden">Verzonden</option>
                            <option value="betaald">Betaald</option>
                          </select>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Factuurdatum</div>
                          <div className="font-medium">
                            {new Date(selectedInvoice.factuurdatum).toLocaleDateString('nl-NL')}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Vervaldatum</div>
                          <div className="font-medium">
                            {new Date(selectedInvoice.vervaldatum).toLocaleDateString('nl-NL')}
                          </div>
                        </div>
                      </div>

                      {/* Lines */}
                      <div>
                        <h3 className="font-medium mb-2">Factuurregels</h3>
                        {selectedInvoice.lines && selectedInvoice.lines.length > 0 ? (
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Omschrijving</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Aantal</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Prijs</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Totaal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {selectedInvoice.lines.map((line) => (
                                <tr key={line.id}>
                                  <td className="px-4 py-2 text-sm">{line.omschrijving}</td>
                                  <td className="px-4 py-2 text-sm text-right">{line.aantal} {line.eenheid}</td>
                                  <td className="px-4 py-2 text-sm text-right">{formatCurrency(line.prijs_per_eenheid)}</td>
                                  <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(line.totaal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-gray-500 text-sm">Geen factuurregels</p>
                        )}
                      </div>

                      {/* Totals */}
                      <div className="border-t pt-4">
                        <div className="flex justify-end">
                          <div className="w-64 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Subtotaal:</span>
                              <span>{formatCurrency(selectedInvoice.subtotaal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">BTW ({selectedInvoice.btw_percentage}%):</span>
                              <span>{formatCurrency(selectedInvoice.btw_bedrag)}</span>
                            </div>
                            <div className="flex justify-between font-medium text-lg border-t pt-2">
                              <span>Totaal:</span>
                              <span>{formatCurrency(selectedInvoice.totaal)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {selectedInvoice.opmerkingen && (
                        <div>
                          <div className="text-sm text-gray-500">Opmerkingen</div>
                          <div className="text-sm">{selectedInvoice.opmerkingen}</div>
                        </div>
                      )}
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
                    <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                      <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-gray-900">
                        Factuur verwijderen
                      </Dialog.Title>
                      <p className="mt-2 text-sm text-gray-500">
                        Weet je zeker dat je factuur {selectedInvoice?.factuurnummer} wilt verwijderen?
                        Dit kan niet ongedaan worden gemaakt.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={() => setShowDeleteModal(false)} className="btn-secondary">
                      Annuleren
                    </button>
                    <button onClick={handleDeleteInvoice} disabled={saving} className="btn-danger">
                      {saving ? 'Bezig...' : 'Verwijderen'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Email Modal */}
      <Transition appear show={showEmailModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowEmailModal(false)}>
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
                    <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-purple-100">
                      <EnvelopeIcon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <Dialog.Title className="text-lg font-semibold text-gray-900">
                        Factuur versturen
                      </Dialog.Title>
                      <p className="mt-2 text-sm text-gray-500">
                        Verstuur factuur {selectedInvoice?.factuurnummer} naar onderstaand e-mailadres.
                      </p>
                      
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          E-mailadres
                        </label>
                        <input
                          type="email"
                          value={emailAddress}
                          onChange={(e) => setEmailAddress(e.target.value)}
                          placeholder="voorbeeld@bedrijf.nl"
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        />
                      </div>
                      
                      <p className="mt-3 text-xs text-gray-500">
                        Zorg ervoor dat de SMTP instellingen geconfigureerd zijn in Instellingen → E-mail.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button 
                      type="button" 
                      onClick={() => setShowEmailModal(false)} 
                      className="btn-secondary"
                      disabled={emailSending}
                    >
                      Annuleren
                    </button>
                    <button 
                      onClick={handleSendEmail} 
                      disabled={emailSending || !emailAddress}
                      className="btn-primary flex items-center gap-2"
                    >
                      {emailSending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          Versturen...
                        </>
                      ) : (
                        <>
                          <EnvelopeIcon className="h-4 w-4" />
                          Versturen
                        </>
                      )}
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
