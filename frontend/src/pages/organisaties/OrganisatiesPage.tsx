import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusIcon, MagnifyingGlassIcon, BuildingOfficeIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'
import {
  getOrganisaties,
  deleteOrganisatie,
  OrganisatieListItem,
} from '@/api/organisaties'

export default function OrganisatiesPage() {
  const navigate = useNavigate()
  const [organisaties, setOrganisaties] = useState<OrganisatieListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      const data = await getOrganisaties()
      setOrganisaties(data)
      setError(null)
    } catch {
      setError('Kon organisaties niet laden')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, naam: string) => {
    if (!confirm(`Weet u zeker dat u "${naam}" wilt verwijderen?`)) return
    try {
      setDeleting(id)
      await deleteOrganisatie(id)
      setOrganisaties(prev => prev.filter(o => o.id !== id))
    } catch {
      alert('Kon organisatie niet verwijderen. Mogelijk zijn er nog dossiers gekoppeld.')
    } finally {
      setDeleting(null)
    }
  }

  const filtered = organisaties.filter(o =>
    o.naam.toLowerCase().includes(search.toLowerCase()) ||
    o.email.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Organisaties / leveranciers</h1>
        <button
          onClick={() => navigate('/dossiers/organisaties/nieuw')}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4" />
          Nieuwe organisatie
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>
      )}

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Zoeken op naam of e-mail..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <BuildingOfficeIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {search ? 'Geen organisaties gevonden' : 'Nog geen organisaties aangemaakt'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Naam</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">E-mail</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Telefoon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contactpersonen</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map(org => (
                <tr key={org.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/dossiers/organisaties/${org.id}`)}
                      className="text-sm font-medium text-blue-600 hover:underline text-left"
                    >
                      {org.naam}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{org.email || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{org.telefoon || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{org.contactpersoon_count}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`/dossiers/organisaties/${org.id}`)}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="Bewerken"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(org.id, org.naam)}
                        disabled={deleting === org.id}
                        className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-40"
                        title="Verwijderen"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
