import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, Link } from 'react-router-dom'
import {
  WrenchScrewdriverIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import { MaintenanceTaskList, MaintenanceTask, MaintenanceCategory, MaintenanceType as MType, Vehicle } from '@/types'
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  getCategories,
  getMaintenanceTypes,
  TaskFilters,
} from '@/api/maintenance'
import { getAllVehicles } from '@/api/fleet'
import LicensePlate from '@/components/common/LicensePlate'
import Pagination, { PageSize } from '@/components/common/Pagination'

function Modal({ isOpen, onClose, title, children, size = 'md' }: {
  isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'sm' | 'md' | 'lg'
}) {
  if (!isOpen) return null
  const sizeClasses = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' }
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className={`relative bg-white rounded-xl shadow-xl w-full ${sizeClasses[size]} transform transition-all max-h-[90vh] overflow-y-auto`}>
          <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default function MaintenanceTasksPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [tasks, setTasks] = useState<MaintenanceTaskList[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [categories, setCategories] = useState<MaintenanceCategory[]>([])
  const [maintenanceTypes, setMaintenanceTypes] = useState<MType[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isActionLoading, setIsActionLoading] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(30)
  const [sortField, setSortField] = useState('scheduled_date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null)
  const [selectedListTask, setSelectedListTask] = useState<MaintenanceTaskList | null>(null)

  const fetchTasks = useCallback(async () => {
    setIsLoading(true)
    try {
      const filters: TaskFilters = {
        page,
        page_size: pageSize,
        ordering: `${sortDirection === 'desc' ? '-' : ''}${sortField}`,
      }
      if (search) filters.search = search
      if (statusFilter) filters.status = statusFilter
      if (priorityFilter) filters.priority = priorityFilter
      const data = await getTasks(filters)
      setTasks(data.results)
      setTotalCount(data.count)
    } catch { setError(t('common.error')) }
    finally { setIsLoading(false) }
  }, [page, pageSize, sortField, sortDirection, search, statusFilter, priorityFilter, t])

  const fetchLookups = useCallback(async () => {
    try {
      const [vehiclesData, catsData, typesData] = await Promise.all([
        getAllVehicles(),
        getCategories(),
        getMaintenanceTypes(),
      ])
      setVehicles(vehiclesData)
      setCategories(catsData)
      setMaintenanceTypes(typesData)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchLookups() }, [fetchLookups])
  useEffect(() => { fetchTasks() }, [fetchTasks])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('asc') }
    setPage(1)
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? <ChevronUpIcon className="w-4 h-4 inline" /> : <ChevronDownIcon className="w-4 h-4 inline" />
  }

  const handleCreate = async (data: Partial<MaintenanceTask>) => {
    setIsActionLoading(true)
    try {
      await createTask(data)
      setShowCreateModal(false)
      setSuccessMessage(t('maintenance.tasks.created'))
      fetchTasks()
    } catch { setError(t('common.error')) }
    finally { setIsActionLoading(false) }
  }

  const handleEdit = async (data: Partial<MaintenanceTask>) => {
    if (!selectedTask) return
    setIsActionLoading(true)
    try {
      await updateTask(selectedTask.id, data)
      setShowEditModal(false)
      setSelectedTask(null)
      setSuccessMessage(t('maintenance.tasks.updated'))
      fetchTasks()
    } catch { setError(t('common.error')) }
    finally { setIsActionLoading(false) }
  }

  const handleComplete = async (data: { completed_date?: string; work_performed?: string; technician_notes?: string }) => {
    if (!selectedListTask) return
    setIsActionLoading(true)
    try {
      await completeTask(selectedListTask.id, data)
      setShowCompleteModal(false)
      setSelectedListTask(null)
      setSuccessMessage(t('maintenance.tasks.completed'))
      fetchTasks()
    } catch { setError(t('common.error')) }
    finally { setIsActionLoading(false) }
  }

  const handleDelete = async () => {
    if (!selectedListTask) return
    setIsActionLoading(true)
    try {
      await deleteTask(selectedListTask.id)
      setShowDeleteModal(false)
      setSelectedListTask(null)
      setSuccessMessage(t('maintenance.tasks.deleted'))
      fetchTasks()
    } catch { setError(t('common.error')) }
    finally { setIsActionLoading(false) }
  }

  const openEdit = async (taskId: string) => {
    try {
      const full = await getTask(taskId)
      setSelectedTask(full)
      setShowEditModal(true)
    } catch { setError(t('common.error')) }
  }

  const openDetail = async (taskId: string) => {
    try {
      const full = await getTask(taskId)
      setSelectedTask(full)
      setShowDetailModal(true)
    } catch { setError(t('common.error')) }
  }

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800',
      deferred: 'bg-purple-100 text-purple-800',
    }
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${classes[status] || 'bg-gray-100 text-gray-800'}`}>
        {t(`maintenance.tasks.status.${status}`)}
      </span>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const classes: Record<string, string> = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-gray-100 text-gray-800',
    }
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${classes[priority] || classes.low}`}>
        {t(`maintenance.priority.${priority}`)}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/maintenance" className="hover:text-primary-600 flex items-center gap-1">
          <WrenchScrewdriverIcon className="w-4 h-4" />
          {t('maintenance.title')}
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{t('maintenance.tasks.title')}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <WrenchScrewdriverIcon className="w-7 h-7 text-primary-600" />
            {t('maintenance.tasks.title')}
          </h1>
          <p className="text-gray-500 mt-1">{t('maintenance.tasks.subtitle')}</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          {t('maintenance.tasks.newTask')}
        </button>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5" />{successMessage}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <XCircleIcon className="w-5 h-5" />{error}
          <button onClick={() => setError(null)} className="ml-auto"><XMarkIcon className="w-4 h-4" /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={t('maintenance.tasks.searchPlaceholder')} className="input pl-10" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="input w-auto">
          <option value="">{t('maintenance.tasks.allStatuses')}</option>
          <option value="scheduled">{t('maintenance.tasks.status.scheduled')}</option>
          <option value="in_progress">{t('maintenance.tasks.status.in_progress')}</option>
          <option value="completed">{t('maintenance.tasks.status.completed')}</option>
          <option value="cancelled">{t('maintenance.tasks.status.cancelled')}</option>
        </select>
        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }} className="input w-auto">
          <option value="">{t('maintenance.tasks.allPriorities')}</option>
          <option value="urgent">{t('maintenance.priority.urgent')}</option>
          <option value="high">{t('maintenance.priority.high')}</option>
          <option value="medium">{t('maintenance.priority.medium')}</option>
          <option value="low">{t('maintenance.priority.low')}</option>
        </select>
        <button onClick={fetchTasks} className="btn-secondary flex items-center gap-1">
          <ArrowPathIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('title')}>
                  {t('maintenance.tasks.task')} <SortIcon field="title" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('fleet.licensePlate')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('scheduled_date')}>
                  {t('maintenance.tasks.scheduledDate')} <SortIcon field="scheduled_date" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('maintenance.tasks.priority')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('total_cost')}>
                  {t('maintenance.tasks.cost')} <SortIcon field="total_cost" />
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">{t('common.loading')}</td></tr>
              ) : tasks.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">{t('maintenance.tasks.noTasks')}</td></tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} className={`hover:bg-gray-50 ${task.is_overdue ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="w-2 h-8 rounded-full" style={{ backgroundColor: task.category_color }} title={task.category_name} />
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openDetail(task.id)} className="text-left hover:text-primary-600">
                        <div className="font-medium text-gray-900">{task.title}</div>
                        <div className="text-xs text-gray-500">{task.category_name} — {task.maintenance_type_name}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <LicensePlate kenteken={task.vehicle_kenteken} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {task.scheduled_date ? new Date(task.scheduled_date).toLocaleDateString('nl-NL') : '—'}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(task.status)}</td>
                    <td className="px-4 py-3">{getPriorityBadge(task.priority)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {task.total_cost && parseFloat(task.total_cost) > 0 ? `€ ${parseFloat(task.total_cost).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {task.status === 'scheduled' || task.status === 'in_progress' ? (
                          <button
                            onClick={() => { setSelectedListTask(task); setShowCompleteModal(true) }}
                            className="p-2 text-gray-500 hover:text-green-600 hover:bg-gray-100 rounded"
                            title={t('maintenance.tasks.markComplete')}
                          >
                            <CheckIcon className="w-4 h-4" />
                          </button>
                        ) : null}
                        <button
                          onClick={() => openEdit(task.id)}
                          className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded"
                          title={t('common.edit')}
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedListTask(task); setShowDeleteModal(true) }}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded"
                          title={t('common.delete')}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500">{t('common.loading')}</div>
          ) : tasks.length === 0 ? (
            <div className="p-6 text-center text-gray-500">{t('maintenance.tasks.noTasks')}</div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className={`p-4 hover:bg-gray-50 ${task.is_overdue ? 'bg-red-50/50' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-8 rounded-full" style={{ backgroundColor: task.category_color }} />
                    <div>
                      <button onClick={() => openDetail(task.id)} className="text-left">
                        <div className="font-medium text-gray-900">{task.title}</div>
                      </button>
                      <div className="text-xs text-gray-500">{task.category_name}</div>
                    </div>
                  </div>
                  {getPriorityBadge(task.priority)}
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <LicensePlate kenteken={task.vehicle_kenteken} size="sm" />
                  {getStatusBadge(task.status)}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {task.scheduled_date ? new Date(task.scheduled_date).toLocaleDateString('nl-NL') : '—'}
                  </span>
                  <div className="flex gap-1">
                    {(task.status === 'scheduled' || task.status === 'in_progress') && (
                      <button onClick={() => { setSelectedListTask(task); setShowCompleteModal(true) }}
                        className="p-2 text-green-600 hover:bg-green-50 rounded">
                        <CheckIcon className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => openEdit(task.id)} className="p-2 text-primary-600 hover:bg-primary-50 rounded">
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setSelectedListTask(task); setShowDeleteModal(true) }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {totalCount > pageSize && (
        <Pagination currentPage={page} totalPages={Math.ceil(totalCount / pageSize)} totalCount={totalCount} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title={t('maintenance.tasks.newTask')} size="lg">
        <TaskForm vehicles={vehicles} categories={categories} maintenanceTypes={maintenanceTypes}
          onSave={handleCreate} onCancel={() => setShowCreateModal(false)} isLoading={isActionLoading} t={t} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedTask(null) }} title={t('maintenance.tasks.editTask')} size="lg">
        {selectedTask && (
          <TaskForm task={selectedTask} vehicles={vehicles} categories={categories} maintenanceTypes={maintenanceTypes}
            onSave={handleEdit} onCancel={() => { setShowEditModal(false); setSelectedTask(null) }} isLoading={isActionLoading} t={t} />
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setSelectedTask(null) }} title={t('maintenance.tasks.taskDetail')} size="lg">
        {selectedTask && <TaskDetail task={selectedTask} t={t} />}
      </Modal>

      {/* Complete Modal */}
      <Modal isOpen={showCompleteModal} onClose={() => { setShowCompleteModal(false); setSelectedListTask(null) }} title={t('maintenance.tasks.markComplete')} size="md">
        <CompleteForm onSave={handleComplete} onCancel={() => { setShowCompleteModal(false); setSelectedListTask(null) }} isLoading={isActionLoading} t={t} />
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setSelectedListTask(null) }} title={t('common.delete')} size="sm">
        <p className="text-gray-600 mb-6">{t('maintenance.tasks.deleteConfirm')}</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => { setShowDeleteModal(false); setSelectedListTask(null) }} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            {t('common.cancel')}
          </button>
          <button onClick={handleDelete} className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50" disabled={isActionLoading}>
            {isActionLoading ? t('common.deleting') : t('common.delete')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// Task Form
function TaskForm({ task, vehicles, categories, maintenanceTypes, onSave, onCancel, isLoading, t }: {
  task?: MaintenanceTask
  vehicles: Vehicle[]
  categories: MaintenanceCategory[]
  maintenanceTypes: MType[]
  onSave: (data: Partial<MaintenanceTask>) => void
  onCancel: () => void
  isLoading: boolean
  t: (key: string) => string
}) {
  const [formData, setFormData] = useState({
    vehicle: task?.vehicle || '',
    maintenance_type: task?.maintenance_type || '',
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'scheduled',
    priority: task?.priority || 'normal',
    scheduled_date: task?.scheduled_date || '',
    service_provider: task?.service_provider || '',
    labor_cost: task?.labor_cost || '',
    parts_cost: task?.parts_cost || '',
    work_performed: task?.work_performed || '',
    technician_notes: task?.technician_notes || '',
  })
  const [selectedCategory, setSelectedCategory] = useState('')
  const [filteredTypes, setFilteredTypes] = useState<MType[]>(maintenanceTypes)

  useEffect(() => {
    if (selectedCategory) {
      setFilteredTypes(maintenanceTypes.filter(mt => mt.category === selectedCategory))
    } else {
      setFilteredTypes(maintenanceTypes)
    }
  }, [selectedCategory, maintenanceTypes])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData as Partial<MaintenanceTask>)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('fleet.licensePlate')} *</label>
        <select name="vehicle" value={formData.vehicle} onChange={handleChange} className="input" required>
          <option value="">{t('maintenance.apk.selectVehicle')}</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.kenteken} — {v.type_wagen || v.ritnummer}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.tasks.category')}</label>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="input">
            <option value="">{t('common.all')}</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.tasks.type')} *</label>
          <select name="maintenance_type" value={formData.maintenance_type} onChange={handleChange} className="input" required>
            <option value="">{t('maintenance.tasks.selectType')}</option>
            {filteredTypes.map(mt => <option key={mt.id} value={mt.id}>{mt.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.tasks.taskTitle')} *</label>
        <input type="text" name="title" value={formData.title} onChange={handleChange} className="input" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
        <textarea name="description" value={formData.description} onChange={handleChange} className="input" rows={2} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.tasks.scheduledDate')}</label>
          <input type="date" name="scheduled_date" value={formData.scheduled_date} onChange={handleChange} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.status')}</label>
          <select name="status" value={formData.status} onChange={handleChange} className="input">
            <option value="scheduled">{t('maintenance.tasks.status.scheduled')}</option>
            <option value="in_progress">{t('maintenance.tasks.status.in_progress')}</option>
            <option value="completed">{t('maintenance.tasks.status.completed')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.tasks.priority')}</label>
          <select name="priority" value={formData.priority} onChange={handleChange} className="input">
            <option value="low">{t('maintenance.priority.low')}</option>
            <option value="normal">{t('maintenance.priority.medium')}</option>
            <option value="high">{t('maintenance.priority.high')}</option>
            <option value="urgent">{t('maintenance.priority.urgent')}</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.tasks.serviceProvider')}</label>
          <input type="text" name="service_provider" value={formData.service_provider} onChange={handleChange} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.tasks.laborCost')}</label>
          <input type="number" step="0.01" name="labor_cost" value={formData.labor_cost} onChange={handleChange} placeholder="€ 0.00" className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.tasks.partsCost')}</label>
          <input type="number" step="0.01" name="parts_cost" value={formData.parts_cost} onChange={handleChange} placeholder="€ 0.00" className="input" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200" disabled={isLoading}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? t('common.saving') : task ? t('common.save') : t('common.create')}
        </button>
      </div>
    </form>
  )
}

// Complete Form
function CompleteForm({ onSave, onCancel, isLoading, t }: {
  onSave: (data: { completed_date?: string; work_performed?: string; technician_notes?: string }) => void
  onCancel: () => void; isLoading: boolean; t: (key: string) => string
}) {
  const [formData, setFormData] = useState({
    completed_date: new Date().toISOString().split('T')[0],
    work_performed: '',
    technician_notes: '',
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(formData) }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.tasks.completedDate')}</label>
        <input type="date" value={formData.completed_date}
          onChange={(e) => setFormData(prev => ({ ...prev, completed_date: e.target.value }))} className="input" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.tasks.workPerformed')}</label>
        <textarea value={formData.work_performed}
          onChange={(e) => setFormData(prev => ({ ...prev, work_performed: e.target.value }))} rows={3} className="input" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.tasks.technicianNotes')}</label>
        <textarea value={formData.technician_notes}
          onChange={(e) => setFormData(prev => ({ ...prev, technician_notes: e.target.value }))} rows={2} className="input" />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200" disabled={isLoading}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={isLoading}>
          <CheckIcon className="w-4 h-4" />
          {isLoading ? t('common.saving') : t('maintenance.tasks.markComplete')}
        </button>
      </div>
    </form>
  )
}

// Task Detail
function TaskDetail({ task, t }: { task: MaintenanceTask; t: (key: string) => string }) {
  const formatCurrency = (val: string) => val && parseFloat(val) > 0 ? `€ ${parseFloat(val).toFixed(2)}` : '—'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <LicensePlate kenteken={task.vehicle_kenteken} size="md" />
        <div>
          <div className="text-sm text-gray-500">{task.vehicle_type}</div>
          {task.bedrijf_naam && <div className="text-xs text-gray-400">{task.bedrijf_naam}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">{t('maintenance.tasks.category')}: </span>
          <span className="font-medium">{task.category_name}</span>
        </div>
        <div>
          <span className="text-gray-500">{t('maintenance.tasks.type')}: </span>
          <span className="font-medium">{task.maintenance_type_name}</span>
        </div>
        <div>
          <span className="text-gray-500">{t('maintenance.tasks.scheduledDate')}: </span>
          <span className="font-medium">{task.scheduled_date ? new Date(task.scheduled_date).toLocaleDateString('nl-NL') : '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">{t('maintenance.tasks.completedDate')}: </span>
          <span className="font-medium">{task.completed_date ? new Date(task.completed_date).toLocaleDateString('nl-NL') : '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">{t('maintenance.tasks.serviceProvider')}: </span>
          <span className="font-medium">{task.service_provider || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">{t('maintenance.tasks.mileage')}: </span>
          <span className="font-medium">{task.mileage_at_service ? `${task.mileage_at_service.toLocaleString()} km` : '—'}</span>
        </div>
      </div>

      {task.description && (
        <div>
          <div className="text-sm text-gray-500 mb-1">{t('common.description')}</div>
          <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3">{task.description}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-3">
        <div className="text-center">
          <div className="text-xs text-gray-500">{t('maintenance.tasks.laborCost')}</div>
          <div className="font-bold text-gray-900">{formatCurrency(task.labor_cost)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">{t('maintenance.tasks.partsCost')}</div>
          <div className="font-bold text-gray-900">{formatCurrency(task.parts_cost)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">{t('common.total')}</div>
          <div className="font-bold text-primary-600">{formatCurrency(task.total_cost)}</div>
        </div>
      </div>

      {task.work_performed && (
        <div>
          <div className="text-sm text-gray-500 mb-1">{t('maintenance.tasks.workPerformed')}</div>
          <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3">{task.work_performed}</p>
        </div>
      )}

      {task.parts && task.parts.length > 0 && (
        <div>
          <div className="text-sm text-gray-500 mb-2">{t('maintenance.tasks.usedParts')}</div>
          <div className="space-y-1">
            {task.parts.map(part => (
              <div key={part.id} className="flex items-center justify-between text-sm bg-gray-50 rounded p-2">
                <span>{part.name} {part.part_number ? `(${part.part_number})` : ''}</span>
                <span className="font-medium">{part.quantity}x — € {parseFloat(part.total_price).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
