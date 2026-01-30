/**
 * Notification Schedules Management Component
 * Admin interface for creating and managing scheduled notifications
 */
import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
  XMarkIcon,
  ArrowPathIcon,
  PlayIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import {
  pushApi,
  type NotificationSchedule,
  type NotificationScheduleCreate,
  type NotificationGroup,
  type ScheduleChoices,
  type ScheduleFrequency,
} from '@/api/push'

interface NotificationSchedulesTabProps {
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

export default function NotificationSchedulesTab({ onSuccess, onError }: NotificationSchedulesTabProps) {
  const [schedules, setSchedules] = useState<NotificationSchedule[]>([])
  const [groups, setGroups] = useState<NotificationGroup[]>([])
  const [choices, setChoices] = useState<ScheduleChoices | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSchedule, setSelectedSchedule] = useState<NotificationSchedule | null>(null)
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState<NotificationScheduleCreate>({
    name: '',
    group: '',
    frequency: 'daily',
    weekly_day: null,
    custom_days: [],
    send_time: '09:00',
    title: '',
    body: '',
    icon: '',
    url: '',
    is_active: true,
  })
  
  // Loading states
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [schedulesData, groupsData, choicesData] = await Promise.all([
        pushApi.getSchedules(),
        pushApi.getGroups(),
        pushApi.getScheduleChoices(),
      ])
      setSchedules(schedulesData)
      setGroups(groupsData)
      setChoices(choicesData)
    } catch (err: any) {
      console.error('Failed to load schedules:', err)
      onError?.('Kon schema\'s niet laden')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      setSaving(true)
      const dataToSend = {
        ...formData,
        weekly_day: formData.frequency === 'weekly' ? formData.weekly_day : null,
        custom_days: formData.frequency === 'custom' ? formData.custom_days : [],
      }
      await pushApi.createSchedule(dataToSend)
      await loadData()
      setShowCreateModal(false)
      resetForm()
      onSuccess?.('Schema aangemaakt')
    } catch (err: any) {
      console.error('Failed to create schedule:', err)
      onError?.(err.response?.data?.detail || 'Kon schema niet aanmaken')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedSchedule) return
    try {
      setSaving(true)
      const dataToSend = {
        ...formData,
        weekly_day: formData.frequency === 'weekly' ? formData.weekly_day : null,
        custom_days: formData.frequency === 'custom' ? formData.custom_days : [],
      }
      await pushApi.updateSchedule(selectedSchedule.id, dataToSend)
      await loadData()
      setShowEditModal(false)
      setSelectedSchedule(null)
      resetForm()
      onSuccess?.('Schema bijgewerkt')
    } catch (err: any) {
      console.error('Failed to update schedule:', err)
      onError?.(err.response?.data?.detail || 'Kon schema niet bijwerken')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedSchedule) return
    try {
      setDeleting(true)
      await pushApi.deleteSchedule(selectedSchedule.id)
      await loadData()
      setShowDeleteConfirm(false)
      setSelectedSchedule(null)
      onSuccess?.('Schema verwijderd')
    } catch (err: any) {
      console.error('Failed to delete schedule:', err)
      onError?.(err.response?.data?.detail || 'Kon schema niet verwijderen')
    } finally {
      setDeleting(false)
    }
  }

  const handleSendNow = async (schedule: NotificationSchedule) => {
    try {
      setSending(schedule.id)
      const result = await pushApi.sendScheduleNow(schedule.id)
      await loadData()
      onSuccess?.(`Notificatie verzonden naar ${result.success_count} apparaten`)
    } catch (err: any) {
      console.error('Failed to send notification:', err)
      onError?.(err.response?.data?.detail || 'Kon notificatie niet verzenden')
    } finally {
      setSending(null)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      group: '',
      frequency: 'daily',
      weekly_day: null,
      custom_days: [],
      send_time: '09:00',
      title: '',
      body: '',
      icon: '',
      url: '',
      is_active: true,
    })
  }

  const openEditModal = (schedule: NotificationSchedule) => {
    setSelectedSchedule(schedule)
    setFormData({
      name: schedule.name,
      group: schedule.group,
      frequency: schedule.frequency,
      weekly_day: schedule.weekly_day,
      custom_days: schedule.custom_days,
      send_time: schedule.send_time,
      title: schedule.title,
      body: schedule.body,
      icon: schedule.icon || '',
      url: schedule.url || '',
      is_active: schedule.is_active,
    })
    setShowEditModal(true)
  }

  const openDeleteConfirm = (schedule: NotificationSchedule) => {
    setSelectedSchedule(schedule)
    setShowDeleteConfirm(true)
  }

  const toggleCustomDay = (day: number) => {
    const current = formData.custom_days || []
    if (current.includes(day)) {
      setFormData({ ...formData, custom_days: current.filter(d => d !== day) })
    } else {
      setFormData({ ...formData, custom_days: [...current, day].sort() })
    }
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('nl-NL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Notificatie Schema's</h3>
          <p className="text-sm text-gray-500">
            Plan automatische notificaties voor groepen
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
          disabled={groups.length === 0}
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Nieuw Schema
        </button>
      </div>

      {groups.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            Maak eerst een notificatie groep aan voordat je schema's kunt maken.
          </p>
        </div>
      )}

      {/* Schedules List */}
      {schedules.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Geen schema's</h3>
          <p className="mt-1 text-sm text-gray-500">
            Maak een nieuw schema om automatische notificaties te plannen.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {schedules.map((schedule) => (
              <li key={schedule.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0 flex-1">
                      <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                        schedule.is_active ? 'bg-primary-100' : 'bg-gray-100'
                      }`}>
                        <CalendarDaysIcon className={`h-6 w-6 ${
                          schedule.is_active ? 'text-primary-600' : 'text-gray-400'
                        }`} />
                      </div>
                      <div className="ml-4 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {schedule.name}
                          </p>
                          {!schedule.is_active && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              Inactief
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{schedule.group_name}</span>
                          <span>• {schedule.schedule_display}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                          {schedule.next_send_at && (
                            <span>Volgende: {formatDateTime(schedule.next_send_at)}</span>
                          )}
                          {schedule.last_sent_at && (
                            <span>Laatst: {formatDateTime(schedule.last_sent_at)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleSendNow(schedule)}
                        disabled={!schedule.is_active || sending === schedule.id}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                        title="Nu versturen"
                      >
                        {sending === schedule.id ? (
                          <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        ) : (
                          <PlayIcon className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={() => openEditModal(schedule)}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                        title="Bewerken"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(schedule)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Verwijderen"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Preview of notification content */}
                  <div className="mt-2 ml-14 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">{schedule.title}</p>
                    <p className="text-sm text-gray-600 line-clamp-2">{schedule.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Transition appear show={showCreateModal || showEditModal} as={Fragment}>
        <Dialog 
          as="div" 
          className="relative z-50" 
          onClose={() => {
            setShowCreateModal(false)
            setShowEditModal(false)
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      {showEditModal ? 'Schema Bewerken' : 'Nieuw Notificatie Schema'}
                    </Dialog.Title>
                    <button
                      onClick={() => {
                        setShowCreateModal(false)
                        setShowEditModal(false)
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Schema Naam</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="input-field mt-1"
                          placeholder="bijv. Dagelijkse Update"
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Groep</label>
                        <select
                          value={formData.group}
                          onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                          className="input-field mt-1"
                        >
                          <option value="">Selecteer een groep...</option>
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name} ({group.member_count} leden)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Schedule Settings */}
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Planning</h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Frequentie</label>
                          <select
                            value={formData.frequency}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              frequency: e.target.value as ScheduleFrequency,
                              weekly_day: null,
                              custom_days: [],
                            })}
                            className="input-field mt-1"
                          >
                            {choices?.frequencies.map((freq) => (
                              <option key={freq.value} value={freq.value}>
                                {freq.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Tijdstip</label>
                          <input
                            type="time"
                            value={formData.send_time}
                            onChange={(e) => setFormData({ ...formData, send_time: e.target.value })}
                            className="input-field mt-1"
                          />
                        </div>
                      </div>

                      {/* Weekly day selector */}
                      {formData.frequency === 'weekly' && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700">Dag van de week</label>
                          <select
                            value={formData.weekly_day ?? ''}
                            onChange={(e) => setFormData({ ...formData, weekly_day: parseInt(e.target.value) })}
                            className="input-field mt-1"
                          >
                            <option value="">Selecteer een dag...</option>
                            {choices?.weekdays.map((day) => (
                              <option key={day.value} value={day.value}>
                                {day.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Custom days selector */}
                      {formData.frequency === 'custom' && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Selecteer dagen</label>
                          <div className="flex flex-wrap gap-2">
                            {choices?.weekdays.map((day) => (
                              <button
                                key={day.value}
                                type="button"
                                onClick={() => toggleCustomDay(day.value)}
                                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                  formData.custom_days?.includes(day.value)
                                    ? 'bg-primary-600 text-white border-primary-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-primary-300'
                                }`}
                              >
                                {day.label.substring(0, 2)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Notification Content */}
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Notificatie Inhoud</h4>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Titel</label>
                          <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="input-field mt-1"
                            placeholder="Notificatie titel"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Bericht</label>
                          <textarea
                            value={formData.body}
                            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                            className="input-field mt-1"
                            rows={3}
                            placeholder="Notificatie bericht"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Link (optioneel)</label>
                          <input
                            type="url"
                            value={formData.url}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                            className="input-field mt-1"
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Active toggle */}
                    <div className="border-t pt-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="schedule_is_active"
                          checked={formData.is_active}
                          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <label htmlFor="schedule_is_active" className="ml-2 block text-sm text-gray-900">
                          Schema actief
                        </label>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Inactieve schema's worden niet automatisch verzonden
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3 border-t pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false)
                        setShowEditModal(false)
                      }}
                      className="btn-secondary"
                    >
                      Annuleren
                    </button>
                    <button
                      type="button"
                      onClick={showEditModal ? handleUpdate : handleCreate}
                      disabled={saving || !formData.name || !formData.group || !formData.title || !formData.body}
                      className="btn-primary"
                    >
                      {saving ? 'Opslaan...' : (showEditModal ? 'Bijwerken' : 'Aanmaken')}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete Confirmation */}
      <Transition appear show={showDeleteConfirm} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowDeleteConfirm(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    Schema Verwijderen
                  </Dialog.Title>
                  <p className="mt-2 text-sm text-gray-500">
                    Weet je zeker dat je het schema <strong>{selectedSchedule?.name}</strong> wilt verwijderen?
                  </p>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="btn-secondary"
                    >
                      Annuleren
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="btn-danger"
                    >
                      {deleting ? 'Verwijderen...' : 'Verwijderen'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  )
}
