import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition, Listbox } from '@headlessui/react'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  ChevronUpDownIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
  CurrencyEuroIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { Company, Invoice, InvoiceTemplate } from '@/types'
import {
  getInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getTemplates,
  markDefinitief,
  markVerzonden,
  markBetaald,
  InvoiceFilters,
  InvoiceCreate,
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
  const { user } = useAuthStore()
  const isReadOnly = user?.rol === 'chauffeur'
  
  // Data state
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  
  // Filter state
  const [filters, setFilters] = useState<InvoiceFilters>({
    page: 1,
    page_size: 20,
    ordering: '-factuurdatum',
  })
  const [searchInput, setSearchInput] = useState('')
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState<InvoiceCreate>({
    template: '',
    bedrijf: '',
    type: 'verkoop',
    factuurdatum: new Date().toISOString().split('T')[0],
    vervaldatum: '',
    btw_percentage: 21,
    opmerkingen: '',
  })

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [filters])

  const loadInitialData = async () => {
    try {
      const [companiesRes, templatesRes] = await Promise.all([
        getCompanies({ page_size: 100 }),
        getTemplates(true),
      ])
      setCompanies(companiesRes.results)
      setTemplates(templatesRes.results)
      
      // Set default template
      if (templatesRes.results.length > 0) {
        setFormData(prev => ({ ...prev, template: templatesRes.results[0].id }))
      }
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

  const handleFilterChange = (key: keyof InvoiceFilters, value: string) => {
    setFilters(prev => ({ 
      ...prev, 
      [key]: value || undefined,
      page: 1 
    }))
  }

  const handleCreateInvoice = async () => {
    try {
      setSaving(true)
      setError(null)
      
      await createInvoice(formData)
      
      setShowCreateModal(false)
      resetForm()
      loadInvoices()
    } catch (err: any) {
      setError(err.response?.data?.detail || Object.values(err.response?.data || {}).flat().join(', ') || 'Kon factuur niet aanmaken')
    } finally {
      setSaving(false)
    }
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

  const resetForm = () => {
    const defaultDate = new Date()
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)
    
    setFormData({
      template: templates.length > 0 ? templates[0].id : '',
      bedrijf: '',
      type: 'verkoop',
      factuurdatum: defaultDate.toISOString().split('T')[0],
      vervaldatum: dueDate.toISOString().split('T')[0],
      btw_percentage: 21,
      opmerkingen: '',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const totalPages = Math.ceil(totalCount / (filters.page_size || 20))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Facturen</h1>
        {!isReadOnly && (
          <button onClick={() => { resetForm(); setShowCreateModal(true) }} className="btn-primary">
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Factuurnummer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bedrijf
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Datum
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
                        
                        {!isReadOnly && invoice.status === 'concept' && (
                          <>
                            <button
                              onClick={() => handleStatusAction(invoice, 'definitief')}
                              className="text-blue-600 hover:text-blue-900"
                              title="Definitief maken"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => { setSelectedInvoice(invoice); setShowDeleteModal(true) }}
                              className="text-red-600 hover:text-red-900"
                              title="Verwijderen"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </>
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
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {totalCount} facturen totaal
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                disabled={filters.page === 1}
                className="btn-secondary disabled:opacity-50"
              >
                Vorige
              </button>
              <span className="px-4 py-2 text-sm">
                Pagina {filters.page} van {totalPages}
              </span>
              <button
                onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                disabled={filters.page === totalPages}
                className="btn-secondary disabled:opacity-50"
              >
                Volgende
              </button>
            </div>
          </div>
        )}
      </div>

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
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-lg bg-white p-6 shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <Dialog.Title className="text-lg font-semibold">
                      Nieuwe factuur
                    </Dialog.Title>
                    <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-500">
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Template */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Template *
                      </label>
                      <select
                        value={formData.template}
                        onChange={(e) => setFormData(prev => ({ ...prev, template: e.target.value }))}
                        className="input-field w-full"
                        required
                      >
                        <option value="">Selecteer template...</option>
                        {templates.map(template => (
                          <option key={template.id} value={template.id}>{template.naam}</option>
                        ))}
                      </select>
                    </div>

                    {/* Bedrijf */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bedrijf *
                      </label>
                      <select
                        value={formData.bedrijf}
                        onChange={(e) => setFormData(prev => ({ ...prev, bedrijf: e.target.value }))}
                        className="input-field w-full"
                        required
                      >
                        <option value="">Selecteer bedrijf...</option>
                        {companies.map(company => (
                          <option key={company.id} value={company.id}>{company.naam}</option>
                        ))}
                      </select>
                    </div>

                    {/* Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type *
                      </label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                        className="input-field w-full"
                      >
                        <option value="verkoop">Verkoop</option>
                        <option value="inkoop">Inkoop</option>
                        <option value="credit">Credit</option>
                      </select>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Factuurdatum *
                        </label>
                        <input
                          type="date"
                          value={formData.factuurdatum}
                          onChange={(e) => setFormData(prev => ({ ...prev, factuurdatum: e.target.value }))}
                          className="input-field w-full"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Vervaldatum *
                        </label>
                        <input
                          type="date"
                          value={formData.vervaldatum}
                          onChange={(e) => setFormData(prev => ({ ...prev, vervaldatum: e.target.value }))}
                          className="input-field w-full"
                          required
                        />
                      </div>
                    </div>

                    {/* BTW */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        BTW %
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.btw_percentage}
                        onChange={(e) => setFormData(prev => ({ ...prev, btw_percentage: parseFloat(e.target.value) }))}
                        className="input-field w-full"
                      />
                    </div>

                    {/* Opmerkingen */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Opmerkingen
                      </label>
                      <textarea
                        value={formData.opmerkingen}
                        onChange={(e) => setFormData(prev => ({ ...prev, opmerkingen: e.target.value }))}
                        rows={3}
                        className="input-field w-full"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                      Annuleren
                    </button>
                    <button
                      onClick={handleCreateInvoice}
                      disabled={saving || !formData.template || !formData.bedrijf || !formData.vervaldatum}
                      className="btn-primary disabled:opacity-50"
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
                          <span className={clsx(
                            'px-2 py-1 text-xs font-medium rounded-full capitalize',
                            STATUS_COLORS[selectedInvoice.status]
                          )}>
                            {selectedInvoice.status}
                          </span>
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
    </div>
  )
}
