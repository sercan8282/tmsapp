import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeftIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { createDossier, getDossierTypes, createDossierType, DossierType } from '@/api/dossiers'
import { getUsers } from '@/api/users'
import { getOrganisaties, createOrganisatie, OrganisatieListItem } from '@/api/organisaties'
import { User } from '@/types'

interface NewOrgForm {
  naam: string
  email: string
  telefoon: string
}

export default function DossierCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [types, setTypes] = useState<DossierType[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [chauffeurs, setChauffeurs] = useState<User[]>([])
  const [organisaties, setOrganisaties] = useState<OrganisatieListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])

  // New organisatie modal
  const [showNewOrg, setShowNewOrg] = useState(false)
  const [newOrgForm, setNewOrgForm] = useState<NewOrgForm>({ naam: '', email: '', telefoon: '' })
  const [savingOrg, setSavingOrg] = useState(false)
  const [newOrgError, setNewOrgError] = useState<string | null>(null)

  // New type modal
  const [showNewType, setShowNewType] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [savingType, setSavingType] = useState(false)
  const [newTypeError, setNewTypeError] = useState<string | null>(null)

  const [form, setForm] = useState({
    onderwerp: '',
    inhoud: '',
    type: '',
    betreft_user: '',
    betreft_chauffeur: '',
    organisatie: '',
  })

  useEffect(() => {
    Promise.all([
      getDossierTypes(),
      getUsers({ is_active: 'true', rol: 'gebruiker', page_size: 200 }),
      getUsers({ is_active: 'true', rol: 'chauffeur', page_size: 200 }),
      getOrganisaties(),
    ]).then(([tp, u, c, orgs]) => {
      setTypes(tp)
      setUsers(u.results)
      setChauffeurs(c.results)
      setOrganisaties(orgs)
    }).catch(() => setError(t('errors.loadError', 'Kon gegevens niet laden')))
  }, [t])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm(prev => {
      const next = { ...prev, [name]: value }
      // Clear the other "betreft" field when one is set
      if (name === 'betreft_user' && value) next.betreft_chauffeur = ''
      if (name === 'betreft_chauffeur' && value) next.betreft_user = ''
      return next
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOrgForm.naam.trim()) return setNewOrgError('Naam is verplicht')
    try {
      setSavingOrg(true)
      setNewOrgError(null)
      const org = await createOrganisatie(newOrgForm)
      setOrganisaties(prev => [...prev, org].sort((a, b) => a.naam.localeCompare(b.naam)))
      setForm(prev => ({ ...prev, organisatie: org.id }))
      setShowNewOrg(false)
      setNewOrgForm({ naam: '', email: '', telefoon: '' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { naam?: string[] } } })?.response?.data?.naam?.[0]
      setNewOrgError(msg || 'Kon organisatie niet aanmaken')
    } finally {
      setSavingOrg(false)
    }
  }

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTypeName.trim()) return setNewTypeError('Naam is verplicht')
    try {
      setSavingType(true)
      setNewTypeError(null)
      const tp = await createDossierType(newTypeName.trim())
      setTypes(prev => [...prev, tp].sort((a, b) => a.naam.localeCompare(b.naam)))
      setForm(prev => ({ ...prev, type: tp.id }))
      setShowNewType(false)
      setNewTypeName('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { naam?: string[] } } })?.response?.data?.naam?.[0]
      setNewTypeError(msg || 'Kon type niet aanmaken')
    } finally {
      setSavingType(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.onderwerp.trim()) return setError(t('dossiers.onderwerpRequired', 'Onderwerp is verplicht'))
    if (!form.type) return setError(t('dossiers.typeRequired', 'Type is verplicht'))
    if (!form.betreft_user && !form.betreft_chauffeur) return setError(t('dossiers.betreftRequired', 'Kies een gebruiker of chauffeur'))

    try {
      setLoading(true)
      setError(null)
      const dossier = await createDossier(
        {
          onderwerp: form.onderwerp,
          inhoud: form.inhoud,
          type: form.type,
          betreft_user: form.betreft_user || null,
          betreft_chauffeur: form.betreft_chauffeur || null,
          organisatie: form.organisatie || null,
        },
        files.length > 0 ? files : undefined,
      )
      navigate(`/dossiers/${dossier.id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || t('errors.saveError', 'Kon dossier niet opslaan'))
    } finally {
      setLoading(false)
    }
  }

  const getUserLabel = (u: User) => u.full_name || u.email

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dossiers')} className="p-1.5 rounded hover:bg-gray-100">
          <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{t('dossiers.newDossier', 'Nieuw dossier')}</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="card p-4 sm:p-6 space-y-4">
        {/* Onderwerp */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('dossiers.subject', 'Onderwerp')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="onderwerp"
            value={form.onderwerp}
            onChange={handleChange}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('dossiers.type', 'Type')} <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              required
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('common.choose', '-- Kies type --')}</option>
              {types.filter(tp => tp.actief).map(tp => (
                <option key={tp.id} value={tp.id}>{tp.naam}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewType(true)}
              className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap"
              title="Nieuw type aanmaken"
            >
              <PlusIcon className="h-4 w-4" />
              Nieuw
            </button>
          </div>
        </div>

        {/* Organisatie */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Organisatie / leverancier
          </label>
          <div className="flex gap-2">
            <select
              name="organisatie"
              value={form.organisatie}
              onChange={handleChange}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Geen organisatie --</option>
              {organisaties.map(org => (
                <option key={org.id} value={org.id}>{org.naam}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewOrg(true)}
              className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap"
              title="Nieuwe organisatie aanmaken"
            >
              <PlusIcon className="h-4 w-4" />
              Nieuw
            </button>
          </div>
        </div>

        {/* Betreft: user or chauffeur */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('dossiers.regardingUser', 'Betreft gebruiker')}
            </label>
            <select
              name="betreft_user"
              value={form.betreft_user}
              onChange={handleChange}
              disabled={!!form.betreft_chauffeur}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">-</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{getUserLabel(u)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('dossiers.regardingDriver', 'Betreft chauffeur')}
            </label>
            <select
              name="betreft_chauffeur"
              value={form.betreft_chauffeur}
              onChange={handleChange}
              disabled={!!form.betreft_user}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">-</option>
              {chauffeurs.map(u => (
                <option key={u.id} value={u.id}>{getUserLabel(u)}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500">{t('dossiers.betreftHint', 'Vul één veld in: gebruiker of chauffeur.')}</p>

        {/* Inhoud */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('dossiers.content', 'Inhoud')}
          </label>
          <textarea
            name="inhoud"
            value={form.inhoud}
            onChange={handleChange}
            rows={5}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
          />
        </div>

        {/* Bijlagen */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('dossiers.attachments', 'Bijlagen')}
          </label>
          <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 cursor-pointer hover:bg-gray-50">
            <PlusIcon className="h-4 w-4" />
            {t('dossiers.addFiles', 'Bestanden toevoegen')}
            <input type="file" multiple className="sr-only" onChange={handleFileChange} />
          </label>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="truncate flex-1">{f.name}</span>
                  <button type="button" onClick={() => removeFile(i)}>
                    <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-red-500" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/dossiers')}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('common.cancel', 'Annuleren')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? t('common.saving', 'Opslaan...') : t('common.save', 'Opslaan')}
          </button>
        </div>
      </form>

      {/* New organisatie modal */}
      {showNewOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Nieuwe organisatie</h2>
              <button onClick={() => setShowNewOrg(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {newOrgError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{newOrgError}</div>
            )}

            <form onSubmit={handleCreateOrg} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Naam <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newOrgForm.naam}
                  onChange={e => setNewOrgForm(p => ({ ...p, naam: e.target.value }))}
                  required
                  autoFocus
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={newOrgForm.email}
                  onChange={e => setNewOrgForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefoon</label>
                <input
                  type="text"
                  value={newOrgForm.telefoon}
                  onChange={e => setNewOrgForm(p => ({ ...p, telefoon: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewOrg(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={savingOrg}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingOrg ? 'Aanmaken...' : 'Aanmaken'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New type modal */}
      {showNewType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Nieuw dossiertype</h2>
              <button onClick={() => setShowNewType(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {newTypeError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{newTypeError}</div>
            )}

            <form onSubmit={handleCreateType} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Naam <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newTypeName}
                  onChange={e => setNewTypeName(e.target.value)}
                  required
                  autoFocus
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewType(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={savingType}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingType ? 'Aanmaken...' : 'Aanmaken'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
