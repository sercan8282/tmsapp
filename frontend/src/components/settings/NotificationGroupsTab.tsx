/**
 * Notification Groups Management Component
 * Admin interface for creating and managing notification groups
 */
import { useState, useEffect, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, Transition } from '@headlessui/react'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UserGroupIcon,
  BellIcon,
  XMarkIcon,
  ArrowPathIcon,
  CheckIcon,
  UserPlusIcon,
  UserMinusIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import {
  pushApi,
  type NotificationGroup,
  type NotificationGroupCreate,
  type AvailableUser,
} from '@/api/push'

interface NotificationGroupsTabProps {
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

export default function NotificationGroupsTab({ onSuccess, onError }: NotificationGroupsTabProps) {
  const { t } = useTranslation()
  const [groups, setGroups] = useState<NotificationGroup[]>([])
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState<NotificationGroup | null>(null)
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState<NotificationGroupCreate>({
    name: '',
    description: '',
    company: null,
    member_ids: [],
    is_active: true,
  })
  
  // Send notification form
  const [sendTitle, setSendTitle] = useState('')
  const [sendBody, setSendBody] = useState('')
  const [sendUrl, setSendUrl] = useState('')
  
  // Loading states
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  // Search for members
  const [memberSearch, setMemberSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [groupsData, usersData] = await Promise.all([
        pushApi.getGroups(),
        pushApi.getAvailableUsers(),
      ])
      setGroups(groupsData)
      setAvailableUsers(usersData)
    } catch (err: any) {
      console.error('Failed to load groups:', err)
      onError?.(t('notifications.loadGroupsError'))
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      setSaving(true)
      await pushApi.createGroup(formData)
      await loadData()
      setShowCreateModal(false)
      resetForm()
      onSuccess?.(t('notifications.groupCreated'))
    } catch (err: any) {
      console.error('Failed to create group:', err)
      onError?.(err.response?.data?.detail || t('notifications.groupCreateError'))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedGroup) return
    try {
      setSaving(true)
      await pushApi.updateGroup(selectedGroup.id, formData)
      await loadData()
      setShowEditModal(false)
      setSelectedGroup(null)
      resetForm()
      onSuccess?.(t('notifications.groupUpdated'))
    } catch (err: any) {
      console.error('Failed to update group:', err)
      onError?.(err.response?.data?.detail || t('notifications.groupUpdateError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedGroup) return
    try {
      setDeleting(true)
      await pushApi.deleteGroup(selectedGroup.id)
      await loadData()
      setShowDeleteConfirm(false)
      setSelectedGroup(null)
      onSuccess?.(t('notifications.groupDeleted'))
    } catch (err: any) {
      console.error('Failed to delete group:', err)
      onError?.(err.response?.data?.detail || t('notifications.groupDeleteError'))
    } finally {
      setDeleting(false)
    }
  }

  const handleAddMember = async (userId: string) => {
    if (!selectedGroup) return
    try {
      const updated = await pushApi.addGroupMembers(selectedGroup.id, [userId])
      setSelectedGroup(updated)
      await loadData()
    } catch (err: any) {
      console.error('Failed to add member:', err)
      onError?.(t('notifications.memberAddError'))
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroup) return
    try {
      const updated = await pushApi.removeGroupMembers(selectedGroup.id, [userId])
      setSelectedGroup(updated)
      await loadData()
    } catch (err: any) {
      console.error('Failed to remove member:', err)
      onError?.(t('notifications.memberRemoveError'))
    }
  }

  const handleSendNotification = async () => {
    if (!selectedGroup) return
    try {
      setSending(true)
      const result = await pushApi.sendToGroup(selectedGroup.id, {
        title: sendTitle,
        body: sendBody,
        url: sendUrl || undefined,
      })
      setShowSendModal(false)
      setSendTitle('')
      setSendBody('')
      setSendUrl('')
      onSuccess?.(t('notifications.notificationSentToDevices', { count: result.success_count }))
    } catch (err: any) {
      console.error('Failed to send notification:', err)
      onError?.(err.response?.data?.detail || t('notifications.sendError'))
    } finally {
      setSending(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      company: null,
      member_ids: [],
      is_active: true,
    })
  }

  const openEditModal = (group: NotificationGroup) => {
    setSelectedGroup(group)
    setFormData({
      name: group.name,
      description: group.description || '',
      company: group.company,
      member_ids: group.member_ids,
      is_active: group.is_active,
    })
    setShowEditModal(true)
  }

  const openMembersModal = async (group: NotificationGroup) => {
    try {
      const fullGroup = await pushApi.getGroup(group.id)
      setSelectedGroup(fullGroup)
      setShowMembersModal(true)
    } catch (err) {
      onError?.(t('notifications.loadGroupDetailsError'))
    }
  }

  const openSendModal = (group: NotificationGroup) => {
    setSelectedGroup(group)
    setShowSendModal(true)
  }

  const openDeleteConfirm = (group: NotificationGroup) => {
    setSelectedGroup(group)
    setShowDeleteConfirm(true)
  }

  const filteredAvailableUsers = availableUsers.filter(user => {
    if (!memberSearch) return true
    const search = memberSearch.toLowerCase()
    return (
      user.email.toLowerCase().includes(search) ||
      user.full_name.toLowerCase().includes(search)
    )
  })

  const nonMembers = filteredAvailableUsers.filter(
    user => !(selectedGroup?.member_ids || []).includes(user.id)
  )

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
          <h3 className="text-lg font-medium text-gray-900">{t('notifications.notificationGroups')}</h3>
          <p className="text-sm text-gray-500">
            {t('notifications.createGroupDescription')}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          {t('notifications.newGroup')}
        </button>
      </div>

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">{t('notifications.noGroups')}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {t('notifications.createGroupPrompt')}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {groups.map((group) => (
              <li key={group.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0 flex-1">
                      <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                        group.is_active ? 'bg-primary-100' : 'bg-gray-100'
                      }`}>
                        <UserGroupIcon className={`h-6 w-6 ${
                          group.is_active ? 'text-primary-600' : 'text-gray-400'
                        }`} />
                      </div>
                      <div className="ml-4 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {group.name}
                          </p>
                          {!group.is_active && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {t('common.inactive')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{t('notifications.membersCount', { count: group.member_count })}</span>
                          {group.company_name && (
                            <span>• {group.company_name}</span>
                          )}
                          {group.schedule_count !== undefined && group.schedule_count > 0 && (
                            <span>• {t('notifications.schedulesCount', { count: group.schedule_count })}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => openMembersModal(group)}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                        title={t('notifications.manageMembers')}
                      >
                        <UserGroupIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => openSendModal(group)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                        title={t('notifications.sendNotification')}
                        disabled={!group.is_active || group.member_count === 0}
                      >
                        <BellIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => openEditModal(group)}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                        title={t('common.edit')}
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(group)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title={t('common.delete')}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Create Modal */}
      <Transition appear show={showCreateModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowCreateModal(false)}>
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
                    {t('notifications.newNotificationGroup')}
                  </Dialog.Title>
                  
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('common.name')}</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="input-field mt-1"
                        placeholder={t('notifications.groupNamePlaceholder')}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('common.description')}</label>
                      <textarea
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="input-field mt-1"
                        rows={3}
                        placeholder={t('notifications.optionalDescription')}
                      />
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                        {t('common.active')}
                      </label>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="btn-secondary"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={saving || !formData.name}
                      className="btn-primary"
                    >
                      {saving ? t('common.saving') : t('common.create')}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Edit Modal */}
      <Transition appear show={showEditModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowEditModal(false)}>
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
                    {t('notifications.editGroup')}
                  </Dialog.Title>
                  
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('common.name')}</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="input-field mt-1"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('common.description')}</label>
                      <textarea
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="input-field mt-1"
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="edit_is_active"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="edit_is_active" className="ml-2 block text-sm text-gray-900">
                        {t('common.active')}
                      </label>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="btn-secondary"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdate}
                      disabled={saving || !formData.name}
                      className="btn-primary"
                    >
                      {saving ? t('common.saving') : t('common.save')}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Members Modal */}
      <Transition appear show={showMembersModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowMembersModal(false)}>
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
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      {t('notifications.membersOf', { name: selectedGroup?.name })}
                    </Dialog.Title>
                    <button
                      onClick={() => setShowMembersModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                  
                  {/* Search */}
                  <div className="relative mb-4">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="input-field pl-10"
                      placeholder={t('notifications.searchUsers')}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Current Members */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        {t('notifications.currentMembers', { count: selectedGroup?.members_detail?.length || 0 })}
                      </h4>
                      <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                        {selectedGroup?.members_detail?.length === 0 ? (
                          <p className="p-4 text-sm text-gray-500 text-center">{t('notifications.noMembers')}</p>
                        ) : (
                          selectedGroup?.members_detail?.map((member) => (
                            <div key={member.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {member.full_name}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{member.email}</p>
                              </div>
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title={t('common.delete')}
                              >
                                <UserMinusIcon className="h-5 w-5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Available Users */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        {t('notifications.availableUsers', { count: nonMembers.length })}
                      </h4>
                      <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                        {nonMembers.length === 0 ? (
                          <p className="p-4 text-sm text-gray-500 text-center">{t('notifications.noUsersAvailable')}</p>
                        ) : (
                          nonMembers.map((user) => (
                            <div key={user.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {user.full_name}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                              </div>
                              <button
                                onClick={() => handleAddMember(user.id)}
                                className="p-1 text-green-400 hover:text-green-600 hover:bg-green-50 rounded"
                                title={t('common.add')}
                              >
                                <UserPlusIcon className="h-5 w-5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowMembersModal(false)}
                      className="btn-primary"
                    >
                      <CheckIcon className="h-5 w-5 mr-2" />
                      {t('notifications.done')}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Send Notification Modal */}
      <Transition appear show={showSendModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowSendModal(false)}>
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
                    {t('notifications.notificationTo', { name: selectedGroup?.name })}
                  </Dialog.Title>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('notifications.sendToMembers', { count: selectedGroup?.member_count })}
                  </p>
                  
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('notifications.notificationTitle')}</label>
                      <input
                        type="text"
                        value={sendTitle}
                        onChange={(e) => setSendTitle(e.target.value)}
                        className="input-field mt-1"
                        placeholder={t('notifications.notificationTitlePlaceholder')}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('notifications.message')}</label>
                      <textarea
                        value={sendBody}
                        onChange={(e) => setSendBody(e.target.value)}
                        className="input-field mt-1"
                        rows={3}
                        placeholder={t('notifications.messagePlaceholder')}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('notifications.linkOptional')}</label>
                      <input
                        type="url"
                        value={sendUrl}
                        onChange={(e) => setSendUrl(e.target.value)}
                        className="input-field mt-1"
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSendModal(false)}
                      className="btn-secondary"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSendNotification}
                      disabled={sending || !sendTitle || !sendBody}
                      className="btn-primary"
                    >
                      {sending ? t('common.sending') : t('common.send')}
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
                    {t('notifications.deleteGroup')}
                  </Dialog.Title>
                  <p className="mt-2 text-sm text-gray-500">
                    {t('notifications.deleteGroupConfirm', { name: selectedGroup?.name })}
                  </p>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="btn-secondary"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="btn-danger"
                    >
                      {deleting ? t('common.deleting') : t('common.delete')}
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
