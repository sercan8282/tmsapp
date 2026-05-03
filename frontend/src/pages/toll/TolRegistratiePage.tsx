import { useState, useEffect, useRef } from 'react'
import {
  PlusIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  PaperClipIcon,
} from '@heroicons/react/24/outline'
import { TolRegistratie, createTolRegistratie, getTolRegistraties, deleteTolRegistratie, getTolDownloadUrl } from '@/api/tolregistratie'
import { getVehiclesForDropdown } from '@/api/fleet'
import { Vehicle } from '@/types'
import toast from 'react-hot-toast'
import api from '@/api/client'
import { formatBedrag, formatDate } from './utils'

export default function TolRegistratiePage() {
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0])
  const [kenteken, setKenteken] = useState('')
  const [totaalBedrag, setTotaalBedrag] = useState('')
  const [bijlage, setBijlage] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [registraties, setRegistraties] = useState<TolRegistratie[]>([])
  const [loading, setLoading] = useState(true)

  const [vehicles, setVehicles] = useState<Vehicle[]>([])

  useEffect(() => {
    loadRegistraties()
    loadVehicles()
  }, [])

  const loadRegistraties = async () => {
    try {
      setLoading(true)
      const response = await getTolRegistraties({ page_size: 100, ordering: '-datum' })
      setRegistraties(response.results)
    } catch {
      toast.error('Fout bij laden van tolregistraties')
    } finally {
      setLoading(false)
    }
  }

  const loadVehicles = async () => {
    try {
      const data = await getVehiclesForDropdown()
      setVehicles(data)
    } catch {
      // not critical
    }
  }

  const handleBedragChange = (value: string) => {
    const converted = value.replace(/\./g, ',')
    const cleaned = converted.replace(/[^0-9,]/g, '')
    const parts = cleaned.split(',')
    const result = parts.length > 2 ? parts[0] + ',' + parts.slice(1).join('') : cleaned
    setTotaalBedrag(result)
  }

  const normalizeBedrag = (value: string): string => {
    return value.replace(',', '.')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!bijlage) {
      setFormError('Bijlage is verplicht. Upload de tolfactuur.')
      return
    }
    if (!kenteken.trim()) {
      setFormError('Selecteer of voer een kenteken in.')
      return
    }
    if (!totaalBedrag) {
      setFormError('Voer het totaalbedrag in.')
      return
    }

    setSubmitting(true)
    try {
      await createTolRegistratie({
        datum,
        kenteken: kenteken.toUpperCase(),
        totaal_bedrag: normalizeBedrag(totaalBedrag),
        bijlage,
      })
      toast.success('Tolregistratie ingediend!')
      setDatum(new Date().toISOString().split('T')[0])
      setKenteken('')
      setTotaalBedrag('')
      setBijlage(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      loadRegistraties()
    } catch (err: any) {
      const msg = err.response?.data?.bijlage?.[0] || err.response?.data?.detail || 'Fout bij indienen'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze registratie wilt verwijderen?')) return
    try {
      await deleteTolRegistratie(id)
      toast.success('Verwijderd')
      setRegistraties(prev => prev.filter(r => r.id !== id))
    } catch {
      toast.error('Fout bij verwijderen')
    }
  }

  const handleViewBijlage = (reg: TolRegistratie) => {
    if (reg.bijlage_url) {
      window.open(reg.bijlage_url, '_blank')
    }
  }

  const handleDownload = async (reg: TolRegistratie) => {
    try {
      const response = await api.get(getTolDownloadUrl(reg.id), { responseType: 'blob' })
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = reg.bijlage_naam || `tol-${reg.id}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Fout bij downloaden')
    }
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Tolregistratie</h1>
        <p className="text-sm text-gray-500">Registreer tolkosten en upload de tolfactuur</p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Nieuwe tolregistratie</h2>
        <form onSubmit={handleSubmit}>
          {formError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Datum */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Datum *</label>
              <input
                type="date"
                value={datum}
                onChange={e => setDatum(e.target.value)}
                required
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm py-2 px-3 border"
              />
            </div>

            {/* Kenteken / Wagen */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Wagen *</label>
              {vehicles.length > 0 ? (
                <select
                  value={kenteken}
                  onChange={e => setKenteken(e.target.value)}
                  required
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm py-2 px-3 border"
                >
                  <option value="">Selecteer wagen...</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.kenteken}>{v.kenteken}{v.ritnummer ? ` (${v.ritnummer})` : ''}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={kenteken}
                  onChange={e => setKenteken(e.target.value.toUpperCase())}
                  placeholder="Bijv. AB-123-CD"
                  required
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm py-2 px-3 border"
                />
              )}
            </div>

            {/* Bedrag */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Totaal bedrag *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={totaalBedrag}
                  onChange={e => handleBedragChange(e.target.value)}
                  placeholder="0,00"
                  required
                  className="w-full pl-7 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm py-2 px-3 border"
                />
              </div>
            </div>

            {/* Bijlage */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tolfactuur (bijlage) *</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                onChange={e => setBijlage(e.target.files?.[0] || null)}
                required
                className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 border border-gray-300 rounded-md py-1.5 px-2"
              />
              {bijlage && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <PaperClipIcon className="w-3 h-3" /> {bijlage.name}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <PlusIcon className="w-4 h-4" />
              {submitting ? 'Indienen...' : 'Indienen'}
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Mijn tolregistraties</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : registraties.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <PaperClipIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Nog geen tolregistraties</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Wagen</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Bedrag</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Bijlage</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {registraties.map(reg => (
                  <tr key={reg.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(reg.datum)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{reg.kenteken}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatBedrag(reg.totaal_bedrag)}</td>
                    <td className="px-4 py-2 text-center">
                      {reg.bijlage_url ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewBijlage(reg)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Bekijken"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownload(reg)}
                            className="p-1 text-gray-500 hover:text-gray-700"
                            title="Downloaden"
                          >
                            <ArrowDownTrayIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        reg.gefactureerd
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {reg.gefactureerd ? 'Gefactureerd' : 'Ingediend'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {!reg.gefactureerd && (
                        <button
                          onClick={() => handleDelete(reg.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Verwijderen"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
