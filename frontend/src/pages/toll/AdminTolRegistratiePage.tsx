import { useState, useEffect } from 'react'
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  PaperClipIcon,
} from '@heroicons/react/24/outline'
import { TolRegistratie, getTolRegistraties, getTolDownloadUrl } from '@/api/tolregistratie'
import toast from 'react-hot-toast'
import api from '@/api/client'
import Pagination, { PageSize } from '@/components/common/Pagination'
import { formatBedrag, formatDate } from './utils'

export default function AdminTolRegistratiePage() {
  const [registraties, setRegistraties] = useState<TolRegistratie[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [datumVan, setDatumVan] = useState('')
  const [datumTot, setDatumTot] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize, setPageSize] = useState<PageSize>(30)

  useEffect(() => {
    loadRegistraties()
  }, [currentPage, pageSize, datumVan, datumTot, searchTerm])

  const loadRegistraties = async () => {
    try {
      setLoading(true)
      const filters: Record<string, any> = {
        page: currentPage,
        page_size: pageSize,
        ordering: '-datum',
      }
      if (datumVan) filters['datum__gte'] = datumVan
      if (datumTot) filters['datum__lte'] = datumTot
      if (searchTerm) filters['search'] = searchTerm

      const response = await getTolRegistraties(filters)
      setRegistraties(response.results)
      setTotalCount(response.count)
    } catch {
      toast.error('Fout bij laden')
    } finally {
      setLoading(false)
    }
  }

  const filtered = registraties

  const handleViewBijlage = (reg: TolRegistratie) => {
    if (reg.bijlage_url) window.open(reg.bijlage_url, '_blank')
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

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Tolregistratie — Overzicht</h1>
        <p className="text-sm text-gray-500">Alle tolregistraties van chauffeurs</p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            placeholder="Zoek op chauffeur of kenteken..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Van:</label>
          <input
            type="date"
            value={datumVan}
            onChange={e => { setDatumVan(e.target.value); setCurrentPage(1) }}
            className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Tot:</label>
          <input
            type="date"
            value={datumTot}
            onChange={e => { setDatumTot(e.target.value); setCurrentPage(1) }}
            className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <PaperClipIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Geen tolregistraties gevonden</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Chauffeur</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Wagen</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Bedrag</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Bijlage</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(reg => (
                  <tr key={reg.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{reg.user_naam || '—'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(reg.datum)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{reg.kenteken}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatBedrag(reg.totaal_bedrag)}</td>
                    <td className="px-4 py-2 text-center">
                      {reg.bijlage_url ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewBijlage(reg)}
                            title="Bekijken"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                          >
                            <EyeIcon className="w-3 h-3" /> Inzien
                          </button>
                          <button
                            onClick={() => handleDownload(reg)}
                            title="Downloaden"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-50 text-gray-700 rounded hover:bg-gray-100"
                          >
                            <ArrowDownTrayIcon className="w-3 h-3" /> Download
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t px-4 py-3">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1) }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
