import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  TableCellsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { Spreadsheet } from '@/types'
import {
  getSpreadsheets,
  deleteSpreadsheet,
  duplicateSpreadsheet,
} from '@/api/spreadsheets'
import { getCompanies } from '@/api/companies'
import { Company } from '@/types'

export default function SpreadsheetListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([])
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<Company[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)

  // Filters
  const [search, setSearch] = useState('')
  const [filterBedrijf, setFilterBedrijf] = useState('')
  const [filterJaar, setFilterJaar] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadCompanies()
  }, [])

  useEffect(() => {
    loadData()
  }, [page, search, filterBedrijf, filterJaar])

  const loadCompanies = async () => {
    try {
      const res = await getCompanies({ page_size: 200 })
      setCompanies(res.results)
    } catch (err) {
      console.error('Failed loading companies', err)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const filters: Record<string, any> = { page, page_size: pageSize }
      if (search) filters.search = search
      if (filterBedrijf) filters.bedrijf = filterBedrijf
      if (filterJaar) filters.jaar = filterJaar
      const res = await getSpreadsheets(filters)
      setSpreadsheets(res.results)
      setTotalCount(res.count)
    } catch (err) {
      console.error('Failed loading spreadsheets', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      setDeleting(true)
      await deleteSpreadsheet(deleteId)
      setDeleteId(null)
      loadData()
    } catch (err) {
      console.error('Delete failed', err)
    } finally {
      setDeleting(false)
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      const dup = await duplicateSpreadsheet(id)
      navigate(`/spreadsheets/${dup.id}`)
    } catch (err) {
      console.error('Duplicate failed', err)
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  const formatDate = (d: string) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const formatCurrency = (v: number | string) => {
    const n = typeof v === 'string' ? parseFloat(v) : v
    return n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header mb-4">
        <div className="flex items-center gap-2">
          <TableCellsIcon className="w-6 h-6 text-primary-600" />
          <h1 className="page-title">{t('spreadsheets.title')}</h1>
          <span className="text-sm text-gray-500">({totalCount})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(s => !s)}
            className={`btn-secondary text-sm ${showFilters ? 'bg-primary-50 text-primary-700' : ''}`}
          >
            <FunnelIcon className="w-4 h-4 mr-1" />
            Filters
          </button>
          <button onClick={() => navigate('/spreadsheets/new')} className="btn-primary text-sm">
            <PlusIcon className="w-4 h-4 mr-1" />
            {t('spreadsheets.newSpreadsheet')}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('common.search')}</label>
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder={t('spreadsheets.searchPlaceholder')}
                  className="input text-sm pl-8"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('spreadsheets.company')}</label>
              <select
                value={filterBedrijf}
                onChange={e => { setFilterBedrijf(e.target.value); setPage(1) }}
                className="input text-sm"
              >
                <option value="">{t('common.all')}</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.naam}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('spreadsheets.year')}</label>
              <select
                value={filterJaar}
                onChange={e => { setFilterJaar(e.target.value); setPage(1) }}
                className="input text-sm"
              >
                <option value="">{t('common.all')}</option>
                {[...new Set([new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2])].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : spreadsheets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <TableCellsIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">{t('spreadsheets.noSpreadsheets')}</p>
            <p className="text-sm mt-1">{t('spreadsheets.noSpreadsheetsDesc')}</p>
            <button onClick={() => navigate('/spreadsheets/new')} className="btn-primary text-sm mt-4">
              <PlusIcon className="w-4 h-4 mr-1" />
              {t('spreadsheets.newSpreadsheet')}
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('spreadsheets.name')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('spreadsheets.company')}</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">{t('spreadsheets.week')}</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">{t('spreadsheets.year')}</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">{t('spreadsheets.totalInvoice')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('spreadsheets.createdBy')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t('spreadsheets.updatedAt')}</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {spreadsheets.map(sheet => (
                    <tr key={sheet.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/spreadsheets/${sheet.id}`)}>
                      <td className="px-4 py-3 font-medium text-gray-900">{sheet.naam}</td>
                      <td className="px-4 py-3 text-gray-600">{sheet.bedrijf_naam}</td>
                      <td className="px-4 py-3 text-center">{sheet.week_nummer}</td>
                      <td className="px-4 py-3 text-center">{sheet.jaar}</td>
                      <td className="px-4 py-3 text-right font-semibold text-primary-600">€ {formatCurrency(sheet.totaal_factuur)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{sheet.created_by_naam}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(sheet.updated_at)}</td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => navigate(`/spreadsheets/${sheet.id}`)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded" title={t('common.edit')}>
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDuplicate(sheet.id)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title={t('spreadsheets.duplicate')}>
                            <DocumentDuplicateIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteId(sheet.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title={t('common.delete')}>
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y">
              {spreadsheets.map(sheet => (
                <div key={sheet.id} className="p-4 hover:bg-gray-50" onClick={() => navigate(`/spreadsheets/${sheet.id}`)}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{sheet.naam}</div>
                      <div className="text-sm text-gray-500">{sheet.bedrijf_naam}</div>
                    </div>
                    <div className="text-right ml-3">
                      <div className="font-bold text-primary-600">€ {formatCurrency(sheet.totaal_factuur)}</div>
                      <div className="text-xs text-gray-400">Wk {sheet.week_nummer} / {sheet.jaar}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                    <span>{sheet.created_by_naam} · {formatDate(sheet.updated_at)}</span>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleDuplicate(sheet.id)} className="text-gray-400 hover:text-blue-600">
                        <DocumentDuplicateIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteId(sheet.id)} className="text-gray-400 hover:text-red-600">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <div className="text-sm text-gray-600">
                  {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalCount)} van {totalCount}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                  </button>
                  <span className="text-sm px-2">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40"
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('spreadsheets.deleteSpreadsheet')}</h3>
            <p className="text-sm text-gray-600 mb-4">{t('spreadsheets.deleteConfirm')}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="btn-secondary text-sm" disabled={deleting}>
                {t('common.cancel')}
              </button>
              <button onClick={handleDelete} className="btn-danger text-sm" disabled={deleting}>
                {deleting ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
