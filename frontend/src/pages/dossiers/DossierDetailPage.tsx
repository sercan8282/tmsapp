import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeftIcon,
  PaperClipIcon,
  PlusIcon,
  XMarkIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { getDossier, addReactie, DossierDetail, DossierReactie } from '@/api/dossiers'

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
      <button onClick={() => navigate('/dossiers')} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeftIcon className="h-4 w-4" /> {t('common.back', 'Terug')}
      </button>

      {/* Dossier info */}
      <div className="card p-4 sm:p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{dossier.onderwerp}</h1>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
            <span><span className="font-medium text-gray-700">{t('dossiers.type', 'Type')}:</span> {dossier.type_naam}</span>
            {dossier.betreft_naam && (
              <span><span className="font-medium text-gray-700">{t('dossiers.regarding', 'Betreft')}:</span> {dossier.betreft_naam}</span>
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
    </div>
  )
}
