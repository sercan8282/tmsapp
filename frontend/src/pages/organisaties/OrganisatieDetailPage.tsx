import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, PlusIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import {
  getOrganisatie,
  createOrganisatie,
  updateOrganisatie,
  createContactpersoon,
  updateContactpersoon,
  deleteContactpersoon,
  Organisatie,
  Contactpersoon,
} from '@/api/organisaties'

interface ContactpersoonForm {
  naam: string
  email: string
  telefoon: string
  functie: string
}

const emptyContactForm = (): ContactpersoonForm => ({ naam: '', email: '', telefoon: '', functie: '' })

export default function OrganisatieDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'nieuw'

  const [organisatie, setOrganisatie] = useState<Organisatie | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Organisatie form
  const [form, setForm] = useState({ naam: '', email: '', telefoon: '', opmerkingen: '' })

  // Contactpersonen
  const [newContacts, setNewContacts] = useState<ContactpersoonForm[]>([emptyContactForm()])
  const [editingContact, setEditingContact] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ContactpersoonForm>(emptyContactForm())

  useEffect(() => {
    if (!isNew && id) load()
  }, [id, isNew])

  const load = async () => {
    try {
      setLoading(true)
      const data = await getOrganisatie(id!)
      setOrganisatie(data)
      setForm({ naam: data.naam, email: data.email, telefoon: data.telefoon, opmerkingen: data.opmerkingen })
      setError(null)
    } catch {
      setError('Kon organisatie niet laden')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.naam.trim()) return setError('Naam is verplicht')
    try {
      setSaving(true)
      setError(null)
      if (isNew) {
        // Filter valid new contacts
        const validContacts = newContacts.filter(c => c.naam.trim() && c.email.trim())
        const org = await createOrganisatie({ ...form, contactpersonen: validContacts })
        navigate(`/dossiers/organisaties/${org.id}`)
      } else {
        const updated = await updateOrganisatie(id!, form)
        setOrganisatie(updated)
        setSuccess('Organisatie opgeslagen')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { naam?: string[] } } })?.response?.data?.naam?.[0]
      setError(msg || 'Kon organisatie niet opslaan')
    } finally {
      setSaving(false)
    }
  }

  const handleAddContact = async () => {
    const last = newContacts[newContacts.length - 1]
    if (!last.naam.trim() || !last.email.trim()) {
      setError('Vul naam en e-mail in van de contactpersoon')
      return
    }
    if (!organisatie) return
    try {
      setSaving(true)
      setError(null)
      const cp = await createContactpersoon({ organisatie: organisatie.id, ...last })
      setOrganisatie(prev => prev ? { ...prev, contactpersonen: [...prev.contactpersonen, cp] } : prev)
      setNewContacts([emptyContactForm()])
      setSuccess('Contactpersoon toegevoegd')
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError('Kon contactpersoon niet opslaan')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteContact = async (cp: Contactpersoon) => {
    if (!confirm(`Weet u zeker dat u ${cp.naam} wilt verwijderen?`)) return
    try {
      await deleteContactpersoon(cp.id)
      setOrganisatie(prev => prev ? { ...prev, contactpersonen: prev.contactpersonen.filter(c => c.id !== cp.id) } : prev)
    } catch {
      setError('Kon contactpersoon niet verwijderen')
    }
  }

  const startEditContact = (cp: Contactpersoon) => {
    setEditingContact(cp.id)
    setEditForm({ naam: cp.naam, email: cp.email, telefoon: cp.telefoon, functie: cp.functie })
  }

  const handleSaveContact = async (cpId: string) => {
    if (!editForm.naam.trim() || !editForm.email.trim()) {
      setError('Naam en e-mail zijn verplicht')
      return
    }
    try {
      setSaving(true)
      setError(null)
      const updated = await updateContactpersoon(cpId, editForm)
      setOrganisatie(prev => prev ? {
        ...prev,
        contactpersonen: prev.contactpersonen.map(c => c.id === cpId ? updated : c),
      } : prev)
      setEditingContact(null)
    } catch {
      setError('Kon contactpersoon niet opslaan')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dossiers/organisaties')} className="p-1.5 rounded hover:bg-gray-100">
          <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {isNew ? 'Nieuwe organisatie' : (form.naam || 'Organisatie')}
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">{success}</div>
      )}

      {/* Organisatie form */}
      <form onSubmit={handleSave} className="card p-4 sm:p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Gegevens</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Naam <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.naam}
            onChange={e => setForm(p => ({ ...p, naam: e.target.value }))}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefoon</label>
            <input
              type="text"
              value={form.telefoon}
              onChange={e => setForm(p => ({ ...p, telefoon: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Opmerkingen</label>
          <textarea
            value={form.opmerkingen}
            onChange={e => setForm(p => ({ ...p, opmerkingen: e.target.value }))}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
          />
        </div>

        {/* Inline contactpersonen for new org */}
        {isNew && (
          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Contactpersonen</h3>
            {newContacts.map((cp, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-gray-50 rounded-md">
                <input
                  type="text"
                  placeholder="Naam"
                  value={cp.naam}
                  onChange={e => setNewContacts(prev => prev.map((c, i) => i === idx ? { ...c, naam: e.target.value } : c))}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="email"
                  placeholder="E-mail *"
                  value={cp.email}
                  onChange={e => setNewContacts(prev => prev.map((c, i) => i === idx ? { ...c, email: e.target.value } : c))}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Telefoon"
                  value={cp.telefoon}
                  onChange={e => setNewContacts(prev => prev.map((c, i) => i === idx ? { ...c, telefoon: e.target.value } : c))}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Functie / rol"
                  value={cp.functie}
                  onChange={e => setNewContacts(prev => prev.map((c, i) => i === idx ? { ...c, functie: e.target.value } : c))}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {newContacts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setNewContacts(prev => prev.filter((_, i) => i !== idx))}
                    className="col-span-full flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" /> Verwijder contactpersoon
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setNewContacts(prev => [...prev, emptyContactForm()])}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
            >
              <PlusIcon className="h-4 w-4" /> Contactpersoon toevoegen
            </button>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/dossiers/organisaties')}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </form>

      {/* Contactpersonen (existing org) */}
      {!isNew && organisatie && (
        <div className="card p-4 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">
            Contactpersonen ({organisatie.contactpersonen.length})
          </h2>

          {organisatie.contactpersonen.length > 0 && (
            <div className="space-y-2">
              {organisatie.contactpersonen.map(cp => (
                <div key={cp.id} className="border border-gray-200 rounded-md p-3">
                  {editingContact === cp.id ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editForm.naam}
                        onChange={e => setEditForm(p => ({ ...p, naam: e.target.value }))}
                        placeholder="Naam"
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                        placeholder="E-mail"
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={editForm.telefoon}
                        onChange={e => setEditForm(p => ({ ...p, telefoon: e.target.value }))}
                        placeholder="Telefoon"
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={editForm.functie}
                        onChange={e => setEditForm(p => ({ ...p, functie: e.target.value }))}
                        placeholder="Functie / rol"
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="col-span-full flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveContact(cp.id)}
                          disabled={saving}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          <CheckIcon className="h-3.5 w-3.5" /> Opslaan
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingContact(null)}
                          className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50"
                        >
                          <XMarkIcon className="h-3.5 w-3.5" /> Annuleren
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{cp.naam}</p>
                        <p className="text-sm text-gray-600">{cp.email}</p>
                        {(cp.telefoon || cp.functie) && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {[cp.functie, cp.telefoon].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => startEditContact(cp)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Bewerken"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(cp)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Verwijderen"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add new contactpersoon */}
          <div className="border-t pt-3 space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Contactpersoon toevoegen</h3>
            {newContacts.map((cp, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-gray-50 rounded-md">
                <input
                  type="text"
                  placeholder="Naam *"
                  value={cp.naam}
                  onChange={e => setNewContacts(prev => prev.map((c, i) => i === idx ? { ...c, naam: e.target.value } : c))}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="email"
                  placeholder="E-mail *"
                  value={cp.email}
                  onChange={e => setNewContacts(prev => prev.map((c, i) => i === idx ? { ...c, email: e.target.value } : c))}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Telefoon"
                  value={cp.telefoon}
                  onChange={e => setNewContacts(prev => prev.map((c, i) => i === idx ? { ...c, telefoon: e.target.value } : c))}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Functie / rol"
                  value={cp.functie}
                  onChange={e => setNewContacts(prev => prev.map((c, i) => i === idx ? { ...c, functie: e.target.value } : c))}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleAddContact}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                <PlusIcon className="h-4 w-4" /> Toevoegen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
