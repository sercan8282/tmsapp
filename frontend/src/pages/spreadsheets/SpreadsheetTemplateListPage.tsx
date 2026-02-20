import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  TableCellsIcon,
  SwatchIcon,
} from '@heroicons/react/24/outline'
import { SpreadsheetTemplate } from '@/types'
import {
  getSpreadsheetTemplates,
  deleteSpreadsheetTemplate,
  duplicateSpreadsheetTemplate,
} from '@/api/spreadsheetTemplates'

export default function SpreadsheetTemplateListPage() {
  const navigate = useNavigate()

  const [templates, setTemplates] = useState<SpreadsheetTemplate[]>([])
  const [loading, setLoading] = useState(true)

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await getSpreadsheetTemplates({ page_size: 100 })
      setTemplates(res.results)
    } catch (err) {
      console.error('Failed loading templates', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      setDeleting(true)
      await deleteSpreadsheetTemplate(deleteId)
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
      const dup = await duplicateSpreadsheetTemplate(id)
      navigate(`/spreadsheets/templates/${dup.id}/edit`)
    } catch (err) {
      console.error('Duplicate failed', err)
    }
  }

  const formatDate = (d: string) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header mb-4">
        <div className="flex items-center gap-2">
          <SwatchIcon className="w-6 h-6 text-primary-600" />
          <h1 className="page-title">Spreadsheet Templates</h1>
          <span className="text-sm text-gray-500">({templates.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/spreadsheets')}
            className="btn-secondary text-sm"
          >
            <TableCellsIcon className="w-4 h-4 mr-1" />
            Ritregistraties
          </button>
          <button
            onClick={() => navigate('/spreadsheets/templates/new')}
            className="btn-primary text-sm"
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            Nieuw Template
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <SwatchIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">Geen templates gevonden</p>
            <p className="text-sm mt-1">
              Maak een template aan om kolommen, formules en styling te configureren.
            </p>
            <button
              onClick={() => navigate('/spreadsheets/templates/new')}
              className="btn-primary text-sm mt-4"
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              Nieuw Template
            </button>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Naam</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Beschrijving</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Kolommen</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Bijgewerkt</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Acties</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {templates.map((tpl) => (
                    <tr
                      key={tpl.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() =>
                        navigate(`/spreadsheets/templates/${tpl.id}/edit`)
                      }
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {tpl.naam}
                      </td>
                      <td className="px-4 py-3 text-gray-600 truncate max-w-xs">
                        {tpl.beschrijving || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {tpl.kolommen?.length || 0} kolommen
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            tpl.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {tpl.is_active ? 'Actief' : 'Inactief'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {formatDate(tpl.updated_at)}
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() =>
                              navigate(
                                `/spreadsheets/templates/${tpl.id}/edit`,
                              )
                            }
                            className="p-1.5 text-gray-400 hover:text-primary-600 rounded"
                            title="Bewerken"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(tpl.id)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                            title="Dupliceren"
                          >
                            <DocumentDuplicateIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(tpl.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                            title="Verwijderen"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-4 hover:bg-gray-50"
                  onClick={() =>
                    navigate(`/spreadsheets/templates/${tpl.id}/edit`)
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {tpl.naam}
                      </div>
                      <div className="text-sm text-gray-500">
                        {tpl.beschrijving || '—'}
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {tpl.kolommen?.length || 0} kolommen
                      </span>
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-between mt-2 text-xs text-gray-400"
                  >
                    <span>{formatDate(tpl.updated_at)}</span>
                    <div
                      className="flex gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleDuplicate(tpl.id)}
                        className="text-gray-400 hover:text-blue-600"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(tpl.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Delete modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Template verwijderen
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Weet je zeker dat je dit template wilt verwijderen? Dit kan niet
              ongedaan worden gemaakt.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="btn-secondary text-sm"
                disabled={deleting}
              >
                Annuleren
              </button>
              <button
                onClick={handleDelete}
                className="btn-danger text-sm"
                disabled={deleting}
              >
                {deleting ? 'Verwijderen...' : 'Verwijderen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
