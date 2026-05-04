import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  getDossierTypes,
  createDossierType,
  updateDossierType,
  deleteDossierType,
  DossierType,
} from '@/api/dossiers'

export default function DossierTypesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [types, setTypes] = useState<DossierType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // New type
  const [newNaam, setNewNaam] = useState('')
  const [creating, setCreating] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNaam, setEditNaam] = useState('')

  const loadTypes = async () => {
    try {
      setLoading(true)
      setTypes(await getDossierTypes())
      setError(null)
    } catch {
      setError(t('errors.loadError', 'Kon types niet laden'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTypes() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNaam.trim()) return
    try {
      setCreating(true)
      await createDossierType(newNaam.trim())
      setNewNaam('')
      await loadTypes()
    } catch {
      setError(t('errors.saveError', 'Kon type niet aanmaken'))
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (tp: DossierType) => {
    setEditingId(tp.id)
    setEditNaam(tp.naam)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditNaam('')
  }

  const handleSaveEdit = async (id: string) => {
    if (!editNaam.trim()) return
    try {
      await updateDossierType(id, { naam: editNaam.trim() })
      setEditingId(null)
      await loadTypes()
    } catch {
      setError(t('errors.saveError', 'Kon type niet bijwerken'))
    }
  }

  const handleToggleActief = async (tp: DossierType) => {
    try {
      await updateDossierType(tp.id, { actief: !tp.actief })
      await loadTypes()
    } catch {
      setError(t('errors.saveError', 'Kon status niet wijzigen'))
    }
  }

  const handleDelete = async (tp: DossierType) => {
    if (!confirm(t('dossiers.deleteTypeConfirm', `Type "${tp.naam}" verwijderen?`))) return
    try {
      await deleteDossierType(tp.id)
      await loadTypes()
    } catch {
      setError(t('errors.deleteError', 'Kon type niet verwijderen'))
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dossiers')} className="p-1.5 rounded hover:bg-gray-100">
          <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{t('dossiers.manageTypes', 'Dossiertypen beheren')}</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><XMarkIcon className="h-4 w-4" /></button>
        </div>
      )}

      {/* Add new type */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('dossiers.addType', 'Nieuw type toevoegen')}</h2>
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newNaam}
            onChange={e => setNewNaam(e.target.value)}
            placeholder={t('dossiers.typeName', 'Naam')}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={creating || !newNaam.trim()}
            className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            {t('common.add', 'Toevoegen')}
          </button>
        </form>
      </div>

      {/* Types list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : types.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">{t('dossiers.noTypes', 'Geen types gevonden')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">{t('common.name', 'Naam')}</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">{t('common.active', 'Actief')}</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">{t('dossiers.inUse', 'In gebruik')}</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">{t('common.actions', 'Acties')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {types.map(tp => (
                <tr key={tp.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    {editingId === tp.id ? (
                      <input
                        type="text"
                        value={editNaam}
                        onChange={e => setEditNaam(e.target.value)}
                        autoFocus
                        className="border border-blue-400 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveEdit(tp.id)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                      />
                    ) : (
                      <span className={tp.actief ? 'text-gray-900 font-medium' : 'text-gray-400 line-through'}>{tp.naam}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => handleToggleActief(tp)}
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${tp.actief ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                    >
                      {tp.actief ? '✓' : '✗'}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${tp.in_gebruik ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-400'}`}>
                      {tp.in_gebruik ? t('common.yes', 'Ja') : t('common.no', 'Nee')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {editingId === tp.id ? (
                      <div className="inline-flex gap-1">
                        <button onClick={() => handleSaveEdit(tp.id)} className="p-1 rounded hover:bg-green-50 text-green-600">
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button onClick={cancelEdit} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex gap-1">
                        <button onClick={() => startEdit(tp)} className="p-1 rounded hover:bg-blue-50 text-blue-600">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tp)}
                          className="p-1 rounded hover:bg-red-50 text-red-500"
                          title={tp.in_gebruik ? t('dossiers.typeInUseHint', 'Wordt gedeactiveerd') : t('common.delete', 'Verwijderen')}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
