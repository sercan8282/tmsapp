import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeftIcon,
  PaperClipIcon,
  PlusIcon,
  XMarkIcon,
  LockClosedIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { getDossier, addReactie, DossierDetail, DossierReactie } from '@/api/dossiers'
import { stuurDossierMail } from '@/api/organisaties'
import type { Contactpersoon } from '@/api/organisaties'
import { parseEmailInput } from '@/utils/email'

export default function DossierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const isManager = user?.rol === 'admin' || user?.module_permissions?.includes('manage_dossiers')

  const [dossier, setDossier] = useState<DossierDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Reactie form
  const [reactieTekst, setReactieTekst] = useState('')
  const [reactieIntern, setReactieIntern] = useState(false)
  const [reactieFiles, setReactieFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [reactieError, setReactieError] = useState<string | null>(null)

  // Mail dialog
  const [showMailDialog, setShowMailDialog] = useState(false)
  const [mailOnderwerp, setMailOnderwerp] = useState('')
  const [mailInhoud, setMailInhoud] = useState('')
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [handmatigInput, setHandmatigInput] = useState('')
  const [handmatigAdressen, setHandmatigAdressen] = useState<string[]>([])
  const [sendingMail, setSendingMail] = useState(false)
  const [mailError, setMailError] = useState<string | null>(null)
  const [mailSuccess, setMailSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (id) loadDossier()
  }, [id])

  const loadDossier = async () => {
    try {
      setLoading(true)
      const data = await getDossier(id!)
      setDossier(data)
      setError(null)
    } catch {
      setError(t('errors.loadError', 'Kon dossier niet laden'))
    } finally {
      setLoading(false)
    }
  }

  const openMailDialog = () => {
    if (!dossier) return
    setMailOnderwerp(dossier.onderwerp)
    setMailInhoud(dossier.inhoud)
    setSelectedContacts([])
    setHandmatigInput('')
    setHandmatigAdressen([])
    setMailError(null)
    setMailSuccess(null)
    setShowMailDialog(true)
  }

  const toggleContact = (cpId: string) => {
    setSelectedContacts(prev =>
      prev.includes(cpId) ? prev.filter(id => id !== cpId) : [...prev, cpId],
    )
  }

  const addHandmatigAdres = () => {
    const { valid, invalid } = parseEmailInput(handmatigInput)
    if (invalid.length > 0) {
      setMailError(`Ongeldig e-mailadres: ${invalid.join(', ')}`)
      return
    }
    setHandmatigAdressen(prev => [...new Set([...prev, ...valid])])
    setHandmatigInput('')
    setMailError(null)
  }

  const handleSendMail = async () => {
    if (!dossier) return
    if (!mailOnderwerp.trim()) return setMailError('Onderwerp is verplicht')
    const totalRecipients = selectedContacts.length + handmatigAdressen.length
    if (totalRecipients === 0) return setMailError('Voeg minimaal één ontvanger toe')

    try {
      setSendingMail(true)
      setMailError(null)
      const result = await stuurDossierMail(dossier.id, {
        ontvangers: selectedContacts,
        handmatig: handmatigAdressen,
        onderwerp: mailOnderwerp,
        inhoud: mailInhoud,
      })
      setMailSuccess(result.detail)
      // Reload to show maillog
      await loadDossier()
      setTimeout(() => {
        setShowMailDialog(false)
        setMailSuccess(null)
      }, 2000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setMailError(msg || 'Mail kon niet worden verzonden')
    } finally {
      setSendingMail(false)
    }
  }

  const handleAddReactie = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reactieTekst.trim()) return
    try {
      setSubmitting(true)
      setReactieError(null)
      await addReactie(id!, { tekst: reactieTekst, intern: reactieIntern }, reactieFiles.length > 0 ? reactieFiles : undefined)
      setReactieTekst('')
      setReactieIntern(false)
      setReactieFiles([])
      await loadDossier()
    } catch {
      setReactieError(t('errors.saveError', 'Kon reactie niet opslaan'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setReactieFiles(prev => [...prev, ...Array.from(e.target.files!)])
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error || !dossier) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/dossiers')} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeftIcon className="h-4 w-4" /> {t('common.back', 'Terug')}
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">{error || 'Dossier niet gevonden'}</div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Back */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/dossiers')} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeftIcon className="h-4 w-4" /> {t('common.back', 'Terug')}
        </button>
        {isManager && (
          <button
            onClick={openMailDialog}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          >
            <EnvelopeIcon className="h-4 w-4" />
            Mailen
          </button>
        )}
      </div>

      {/* Dossier info */}
      <div className="card p-4 sm:p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{dossier.onderwerp}</h1>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
            <span><span className="font-medium text-gray-700">{t('dossiers.type', 'Type')}:</span> {dossier.type_naam}</span>
            {dossier.betreft_naam && (
              <span><span className="font-medium text-gray-700">{t('dossiers.regarding', 'Betreft')}:</span> {dossier.betreft_naam}</span>
            )}
            {dossier.organisatie_naam && (
              <span><span className="font-medium text-gray-700">Organisatie:</span> {dossier.organisatie_naam}</span>
            )}
            {isManager && dossier.instuurder_naam && (
              <span><span className="font-medium text-gray-700">{t('dossiers.submittedBy', 'Instuurder')}:</span> {dossier.instuurder_naam}</span>
            )}
            <span><span className="font-medium text-gray-700">{t('common.createdAt', 'Aangemaakt')}:</span> {formatDate(dossier.created_at)}</span>
          </div>
        </div>

        {dossier.inhoud && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">{t('dossiers.content', 'Inhoud')}</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{dossier.inhoud}</p>
          </div>
        )}

        {/* Bijlagen */}
        {dossier.bijlagen.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('dossiers.attachments', 'Bijlagen')}</h2>
            <ul className="space-y-1">
              {dossier.bijlagen.map(b => (
                <li key={b.id} className="flex items-center gap-2 text-sm">
                  <PaperClipIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  {b.bestand_url ? (
                    <a href={b.bestand_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">
                      {b.bestandsnaam}
                    </a>
                  ) : (
                    <span className="text-gray-600">{b.bestandsnaam}</span>
                  )}
                  <span className="text-gray-400 text-xs ml-auto flex-shrink-0">{formatSize(b.grootte)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Mail log */}
      {isManager && dossier.maillogs && dossier.maillogs.length > 0 && (
        <div className="card p-4 sm:p-6 space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Verzonden mails</h2>
          {dossier.maillogs.map(log => (
            <div key={log.id} className="text-sm text-gray-600 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
              <span className="font-medium text-gray-700">{formatDate(log.verzonden_op)}</span>
              {' · '}{log.onderwerp}
              {' · '}Aan: {log.ontvangers}
            </div>
          ))}
        </div>
      )}

      {/* Reacties */}
      <div className="card p-4 sm:p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">
          {t('dossiers.reactions', 'Reacties')} ({dossier.reacties.length})
        </h2>

        {dossier.reacties.length === 0 ? (
          <p className="text-sm text-gray-500">{t('dossiers.noReactions', 'Geen reacties')}</p>
        ) : (
          <div className="space-y-3">
            {dossier.reacties.map((r: DossierReactie) => (
              <div
                key={r.id}
                className={`rounded-md p-3 text-sm ${r.intern ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-200'}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-gray-800">{r.auteur_naam || '-'}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {r.intern && isManager && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700 font-medium">
                        <LockClosedIcon className="h-3 w-3" />
                        {t('dossiers.internal', 'Intern')}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
                  </div>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{r.tekst}</p>
                {r.bijlagen.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {r.bijlagen.map(b => (
                      <li key={b.id} className="flex items-center gap-1.5 text-xs">
                        <PaperClipIcon className="h-3.5 w-3.5 text-gray-400" />
                        {b.bestand_url ? (
                          <a href={b.bestand_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{b.bestandsnaam}</a>
                        ) : (
                          <span>{b.bestandsnaam}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add reactie form */}
        <form onSubmit={handleAddReactie} className="border-t pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">{t('dossiers.addReaction', 'Reactie toevoegen')}</h3>

          {reactieError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">{reactieError}</div>
          )}

          <textarea
            value={reactieTekst}
            onChange={e => setReactieTekst(e.target.value)}
            rows={3}
            placeholder={t('dossiers.reactionPlaceholder', 'Typ uw reactie...')}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
          />

          <div className="flex flex-wrap items-center gap-3">
            {/* File upload */}
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded text-xs text-gray-600 cursor-pointer hover:bg-gray-50">
              <PlusIcon className="h-3.5 w-3.5" />
              {t('dossiers.addFiles', 'Bestanden')}
              <input type="file" multiple className="sr-only" onChange={handleFileChange} />
            </label>

            {/* Intern toggle (managers only) */}
            {isManager && (
              <label className="inline-flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reactieIntern}
                  onChange={e => setReactieIntern(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <LockClosedIcon className="h-3.5 w-3.5" />
                {t('dossiers.internalReaction', 'Interne reactie')}
              </label>
            )}

            <button
              type="submit"
              disabled={submitting || !reactieTekst.trim()}
              className="ml-auto px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? t('common.saving', 'Versturen...') : t('common.send', 'Versturen')}
            </button>
          </div>

          {/* Selected files */}
          {reactieFiles.length > 0 && (
            <ul className="space-y-1">
              {reactieFiles.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="truncate flex-1">{f.name}</span>
                  <button type="button" onClick={() => setReactieFiles(prev => prev.filter((_, idx) => idx !== i))}>
                    <XMarkIcon className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
      </div>

      {/* Mail dialog */}
      {showMailDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg space-y-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Dossier mailen</h2>
              <button onClick={() => setShowMailDialog(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {mailError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{mailError}</div>
            )}
            {mailSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">{mailSuccess}</div>
            )}

            {/* Contactpersonen selectie */}
            {dossier.organisatie_contactpersonen && dossier.organisatie_contactpersonen.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contactpersonen van {dossier.organisatie_naam}
                </label>
                <div className="space-y-1 max-h-36 overflow-y-auto border border-gray-200 rounded-md p-2">
                  {dossier.organisatie_contactpersonen.map((cp: Contactpersoon) => (
                    <label key={cp.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(cp.id)}
                        onChange={() => toggleContact(cp.id)}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">{cp.naam}</span>
                      <span className="text-sm text-gray-500">({cp.email})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Handmatige e-mailadressen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Extra e-mailadressen (komma- of enter-gescheiden)
              </label>
              <div className="flex gap-2">
                <textarea
                  value={handmatigInput}
                  onChange={e => setHandmatigInput(e.target.value)}
                  rows={2}
                  placeholder="bijv. jan@bedrijf.nl, piet@bedrijf.nl"
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addHandmatigAdres() } }}
                />
                <button
                  type="button"
                  onClick={addHandmatigAdres}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 self-start"
                >
                  Toevoegen
                </button>
              </div>
              {handmatigAdressen.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {handmatigAdressen.map((email, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">
                      {email}
                      <button type="button" onClick={() => setHandmatigAdressen(prev => prev.filter((_, idx) => idx !== i))}>
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Onderwerp */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Onderwerp <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={mailOnderwerp}
                onChange={e => setMailOnderwerp(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Inhoud */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inhoud</label>
              <textarea
                value={mailInhoud}
                onChange={e => setMailInhoud(e.target.value)}
                rows={6}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
              />
            </div>

            {/* Totale ontvangers samenvatting */}
            {(selectedContacts.length > 0 || handmatigAdressen.length > 0) && (
              <p className="text-xs text-gray-500">
                {selectedContacts.length + handmatigAdressen.length} ontvanger(s) geselecteerd
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowMailDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={handleSendMail}
                disabled={sendingMail}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                <EnvelopeIcon className="h-4 w-4" />
                {sendingMail ? 'Verzenden...' : 'Verzenden'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
