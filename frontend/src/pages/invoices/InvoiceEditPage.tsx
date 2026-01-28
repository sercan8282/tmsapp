/**
 * Invoice Edit Page
 * Edit existing invoice details and lines
 */
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { 
  getInvoice, 
  updateInvoice, 
  getInvoiceLines, 
  createInvoiceLine, 
  updateInvoiceLine, 
  deleteInvoiceLine,
  changeStatus 
} from '@/api/invoices'
import { Invoice, InvoiceLine } from '@/types'
import toast from 'react-hot-toast'

// Format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

export default function InvoiceEditPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  
  // Data state
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [lines, setLines] = useState<InvoiceLine[]>([])
  
  // Form state
  const [status, setStatus] = useState<Invoice['status']>('concept')
  const [vervaldatum, setVervaldatum] = useState('')
  const [btwPercentage, setBtwPercentage] = useState(21)
  const [opmerkingen, setOpmerkingen] = useState('')
  
  // UI state
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load invoice data
  useEffect(() => {
    const loadData = async () => {
      if (!id) return
      
      try {
        const [invoiceData, linesData] = await Promise.all([
          getInvoice(id),
          getInvoiceLines(id),
        ])
        
        setInvoice(invoiceData)
        setLines(linesData)
        setStatus(invoiceData.status)
        setVervaldatum(invoiceData.vervaldatum)
        setBtwPercentage(invoiceData.btw_percentage)
        setOpmerkingen(invoiceData.opmerkingen || '')
      } catch (err) {
        setError('Kon factuur niet laden')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [id])

  // Calculate totals
  const calculateTotals = () => {
    const subtotaal = lines.reduce((sum, line) => sum + (line.totaal || 0), 0)
    const btw = subtotaal * (btwPercentage / 100)
    const totaal = subtotaal + btw
    return { subtotaal, btw, totaal }
  }

  const { subtotaal, btw, totaal } = calculateTotals()

  // Update line
  const handleLineUpdate = async (lineId: string, field: keyof InvoiceLine, value: any) => {
    const line = lines.find(l => l.id === lineId)
    if (!line) return

    const updates: any = { [field]: value }
    
    // Recalculate totaal if needed
    if (field === 'aantal' || field === 'prijs_per_eenheid') {
      const aantal = field === 'aantal' ? value : line.aantal
      const prijs = field === 'prijs_per_eenheid' ? value : line.prijs_per_eenheid
      updates.totaal = aantal * prijs
    }

    try {
      const updatedLine = await updateInvoiceLine(lineId, updates)
      setLines(lines.map(l => l.id === lineId ? updatedLine : l))
    } catch (err) {
      toast.error('Regel bijwerken mislukt')
    }
  }

  // Delete line
  const handleDeleteLine = async (lineId: string) => {
    if (!confirm('Weet je zeker dat je deze regel wilt verwijderen?')) return
    
    try {
      await deleteInvoiceLine(lineId)
      setLines(lines.filter(l => l.id !== lineId))
      toast.success('Regel verwijderd')
    } catch (err) {
      toast.error('Regel verwijderen mislukt')
    }
  }

  // Add new line
  const handleAddLine = async () => {
    if (!id) return
    
    try {
      const newLine = await createInvoiceLine({
        invoice: id,
        omschrijving: 'Nieuwe regel',
        aantal: 1,
        prijs_per_eenheid: 0,
      })
      setLines([...lines, newLine])
      toast.success('Regel toegevoegd')
    } catch (err) {
      toast.error('Regel toevoegen mislukt')
    }
  }

  // Save invoice
  const handleSave = async () => {
    if (!id || !invoice) return
    
    setIsSaving(true)
    setError(null)

    try {
      // Update status if changed
      if (status !== invoice.status) {
        await changeStatus(id, status)
      }
      
      // Update invoice details
      await updateInvoice(id, {
        vervaldatum,
        btw_percentage: btwPercentage,
        opmerkingen: opmerkingen || undefined,
      })
      
      toast.success('Factuur opgeslagen')
      navigate('/invoices')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Kon factuur niet opslaan')
      toast.error('Opslaan mislukt')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error || 'Factuur niet gevonden'}</p>
        <button onClick={() => navigate('/invoices')} className="btn-secondary mt-4">
          Terug naar overzicht
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/invoices')}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Factuur {invoice.factuurnummer} bewerken
            </h1>
            <p className="text-gray-500">{invoice.bedrijf_naam}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/invoices')}
            className="btn-secondary"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary"
          >
            {isSaving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - lines */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Factuurregels</h2>
              <button
                onClick={handleAddLine}
                className="btn-secondary flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Regel toevoegen
              </button>
            </div>

            {lines.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Geen factuurregels</p>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Omschrijving</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500 w-24">Aantal</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500 w-32">Prijs</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500 w-32">Totaal</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(line => (
                    <tr key={line.id} className="border-b">
                      <td className="py-2">
                        <input
                          type="text"
                          value={line.omschrijving}
                          onChange={(e) => handleLineUpdate(line.id, 'omschrijving', e.target.value)}
                          className="w-full border-0 bg-transparent focus:ring-0 p-0"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          value={line.aantal}
                          onChange={(e) => handleLineUpdate(line.id, 'aantal', parseFloat(e.target.value) || 0)}
                          className="w-full text-right border-0 bg-transparent focus:ring-0 p-0"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={line.prijs_per_eenheid}
                          onChange={(e) => handleLineUpdate(line.id, 'prijs_per_eenheid', parseFloat(e.target.value) || 0)}
                          className="w-full text-right border-0 bg-transparent focus:ring-0 p-0"
                        />
                      </td>
                      <td className="py-2 text-right font-medium">
                        {formatCurrency(line.totaal || line.aantal * line.prijs_per_eenheid)}
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => handleDeleteLine(line.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Totals */}
            <div className="border-t mt-4 pt-4">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotaal:</span>
                    <span>{formatCurrency(subtotaal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">BTW ({btwPercentage}%):</span>
                    <span>{formatCurrency(btw)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-lg border-t pt-2">
                    <span>Totaal:</span>
                    <span>{formatCurrency(totaal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - invoice details */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Factuurgegevens</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Invoice['status'])}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="concept">Concept</option>
                  <option value="definitief">Definitief</option>
                  <option value="verzonden">Verzonden</option>
                  <option value="betaald">Betaald</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Factuurnummer
                </label>
                <input
                  type="text"
                  value={invoice.factuurnummer}
                  disabled
                  className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Factuurdatum
                </label>
                <input
                  type="date"
                  value={invoice.factuurdatum}
                  disabled
                  className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vervaldatum
                </label>
                <input
                  type="date"
                  value={vervaldatum}
                  onChange={(e) => setVervaldatum(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  BTW percentage
                </label>
                <input
                  type="number"
                  value={btwPercentage}
                  onChange={(e) => setBtwPercentage(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opmerkingen
                </label>
                <textarea
                  value={opmerkingen}
                  onChange={(e) => setOpmerkingen(e.target.value)}
                  rows={4}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Optionele opmerkingen..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
