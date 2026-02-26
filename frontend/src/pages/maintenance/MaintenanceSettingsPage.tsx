import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  WrenchScrewdriverIcon,
  Cog6ToothIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SwatchIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import { MaintenanceCategory, MaintenanceType as MType } from '@/types'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getMaintenanceTypes,
  createMaintenanceType,
  updateMaintenanceType,
  deleteMaintenanceType,
} from '@/api/maintenance'

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

const PRESET_COLORS = [
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
  '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#06B6D4',
  '#0EA5E9', '#64748B', '#059669', '#DC2626', '#7C3AED',
]

export default function MaintenanceSettingsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'categories' | 'types'>('categories')
  const [categories, setCategories] = useState<MaintenanceCategory[]>([])
  const [types, setTypes] = useState<MType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isActionLoading, setIsActionLoading] = useState(false)

  // Category modals
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<MaintenanceCategory | null>(null)
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false)
  const [deletingCategory, setDeletingCategory] = useState<MaintenanceCategory | null>(null)

  // Type modals
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [editingType, setEditingType] = useState<MType | null>(null)
  const [showDeleteTypeModal, setShowDeleteTypeModal] = useState(false)
  const [deletingType, setDeletingType] = useState<MType | null>(null)

  // Expanded categories for types view
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [catsData, typesData] = await Promise.all([
        getCategories(),
        getMaintenanceTypes(),
      ])
      setCategories(catsData)
      setTypes(typesData)
    } catch {
      setError(t('common.error'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // Category handlers
  const handleSaveCategory = async (data: Partial<MaintenanceCategory>) => {
    setIsActionLoading(true)
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, data)
        setSuccessMessage(t('maintenance.settings.categoryUpdated'))
      } else {
        await createCategory(data)
        setSuccessMessage(t('maintenance.settings.categoryCreated'))
      }
      setShowCategoryModal(false)
      setEditingCategory(null)
      fetchData()
    } catch {
      setError(t('common.error'))
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return
    setIsActionLoading(true)
    try {
      await deleteCategory(deletingCategory.id)
      setSuccessMessage(t('maintenance.settings.categoryDeleted'))
      setShowDeleteCategoryModal(false)
      setDeletingCategory(null)
      fetchData()
    } catch {
      setError(t('common.error'))
    } finally {
      setIsActionLoading(false)
    }
  }

  // Type handlers
  const handleSaveType = async (data: Partial<MType>) => {
    setIsActionLoading(true)
    try {
      if (editingType) {
        await updateMaintenanceType(editingType.id, data)
        setSuccessMessage(t('maintenance.settings.typeUpdated'))
      } else {
        await createMaintenanceType(data)
        setSuccessMessage(t('maintenance.settings.typeCreated'))
      }
      setShowTypeModal(false)
      setEditingType(null)
      fetchData()
    } catch {
      setError(t('common.error'))
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleDeleteType = async () => {
    if (!deletingType) return
    setIsActionLoading(true)
    try {
      await deleteMaintenanceType(deletingType.id)
      setSuccessMessage(t('maintenance.settings.typeDeleted'))
      setShowDeleteTypeModal(false)
      setDeletingType(null)
      fetchData()
    } catch {
      setError(t('common.error'))
    } finally {
      setIsActionLoading(false)
    }
  }

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  const getTypesByCategory = (categoryId: string) => types.filter(t => t.category === categoryId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
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
        <span className="text-gray-900 font-medium">{t('maintenance.settings.title')}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Cog6ToothIcon className="w-7 h-7 text-primary-600" />
            {t('maintenance.settings.title')}
          </h1>
          <p className="text-gray-500 mt-1">{t('maintenance.settings.subtitle')}</p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'categories') {
              setEditingCategory(null)
              setShowCategoryModal(true)
            } else {
              setEditingType(null)
              setShowTypeModal(true)
            }
          }}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          {activeTab === 'categories' ? t('maintenance.settings.newCategory') : t('maintenance.settings.newType')}
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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'categories'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <SwatchIcon className="w-4 h-4" />
            {t('maintenance.settings.categories')} ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('types')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'types'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <TagIcon className="w-4 h-4" />
            {t('maintenance.settings.types')} ({types.length})
          </button>
        </nav>
      </div>

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-xl shadow-sm border">
          {categories.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {t('maintenance.settings.noCategories')}
            </div>
          ) : (
            <div className="divide-y">
              {categories.sort((a, b) => a.sort_order - b.sort_order).map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: cat.color || '#3B82F6' }}
                    >
                      {cat.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{cat.name}</div>
                      <div className="text-sm text-gray-500">
                        {cat.description || '—'} · {cat.type_count || 0} {t('maintenance.settings.types').toLowerCase()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!cat.is_active && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                        {t('common.inactive')}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">#{cat.sort_order}</span>
                    <button
                      onClick={() => { setEditingCategory(cat); setShowCategoryModal(true) }}
                      className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setDeletingCategory(cat); setShowDeleteCategoryModal(true) }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Types Tab */}
      {activeTab === 'types' && (
        <div className="space-y-4">
          {categories.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
              {t('maintenance.settings.noCategoriesFirst')}
            </div>
          ) : (
            categories.sort((a, b) => a.sort_order - b.sort_order).map((cat) => {
              const catTypes = getTypesByCategory(cat.id)
              const isExpanded = expandedCategories.has(cat.id)
              return (
                <div key={cat.id} className="bg-white rounded-xl shadow-sm border">
                  <button
                    onClick={() => toggleCategoryExpand(cat.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-t-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                        style={{ backgroundColor: cat.color || '#3B82F6' }}
                      >
                        {cat.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{cat.name}</span>
                      <span className="text-sm text-gray-400">({catTypes.length})</span>
                    </div>
                    {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
                  </button>
                  {isExpanded && (
                    <div className="border-t divide-y">
                      {catTypes.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-400">
                          {t('maintenance.settings.noTypesInCategory')}
                        </div>
                      ) : (
                        catTypes.sort((a, b) => a.sort_order - b.sort_order).map((type) => (
                          <div key={type.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 text-sm">{type.name}</span>
                                {type.is_mandatory && (
                                  <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                                    {t('maintenance.settings.mandatory')}
                                  </span>
                                )}
                                {!type.is_active && (
                                  <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                                    {t('common.inactive')}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3">
                                {type.description && <span>{type.description}</span>}
                                {type.default_interval_km && <span>{type.default_interval_km.toLocaleString()} km</span>}
                                {type.default_interval_days && <span>{type.default_interval_days} {t('maintenance.settings.days')}</span>}
                                {type.estimated_cost && <span>€ {type.estimated_cost}</span>}
                                <span className="text-gray-400">{type.vehicle_type}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => { setEditingType(type); setShowTypeModal(true) }}
                                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                              >
                                <PencilSquareIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setDeletingType(type); setShowDeleteTypeModal(true) }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Category Modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => { setShowCategoryModal(false); setEditingCategory(null) }}
        title={editingCategory ? t('maintenance.settings.editCategory') : t('maintenance.settings.newCategory')}
        size="md"
      >
        <CategoryForm
          category={editingCategory}
          onSave={handleSaveCategory}
          onCancel={() => { setShowCategoryModal(false); setEditingCategory(null) }}
          isLoading={isActionLoading}
          t={t}
        />
      </Modal>

      {/* Type Modal */}
      <Modal
        isOpen={showTypeModal}
        onClose={() => { setShowTypeModal(false); setEditingType(null) }}
        title={editingType ? t('maintenance.settings.editType') : t('maintenance.settings.newType')}
        size="lg"
      >
        <TypeForm
          type={editingType}
          categories={categories}
          onSave={handleSaveType}
          onCancel={() => { setShowTypeModal(false); setEditingType(null) }}
          isLoading={isActionLoading}
          t={t}
        />
      </Modal>

      {/* Delete Category Modal */}
      <Modal
        isOpen={showDeleteCategoryModal}
        onClose={() => { setShowDeleteCategoryModal(false); setDeletingCategory(null) }}
        title={t('common.delete')}
        size="sm"
      >
        <p className="text-gray-600 mb-2">{t('maintenance.settings.deleteCategoryConfirm')}</p>
        {deletingCategory && getTypesByCategory(deletingCategory.id).length > 0 && (
          <p className="text-sm text-red-600 mb-4">
            {t('maintenance.settings.deleteCategoryWarning', { count: getTypesByCategory(deletingCategory.id).length })}
          </p>
        )}
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => { setShowDeleteCategoryModal(false); setDeletingCategory(null) }} className="btn-secondary">
            {t('common.cancel')}
          </button>
          <button onClick={handleDeleteCategory} className="btn-danger" disabled={isActionLoading}>
            {isActionLoading ? t('common.deleting') : t('common.delete')}
          </button>
        </div>
      </Modal>

      {/* Delete Type Modal */}
      <Modal
        isOpen={showDeleteTypeModal}
        onClose={() => { setShowDeleteTypeModal(false); setDeletingType(null) }}
        title={t('common.delete')}
        size="sm"
      >
        <p className="text-gray-600 mb-6">{t('maintenance.settings.deleteTypeConfirm')}</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => { setShowDeleteTypeModal(false); setDeletingType(null) }} className="btn-secondary">
            {t('common.cancel')}
          </button>
          <button onClick={handleDeleteType} className="btn-danger" disabled={isActionLoading}>
            {isActionLoading ? t('common.deleting') : t('common.delete')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// Category Form
function CategoryForm({ category, onSave, onCancel, isLoading, t }: {
  category: MaintenanceCategory | null
  onSave: (data: Partial<MaintenanceCategory>) => void
  onCancel: () => void
  isLoading: boolean
  t: (key: string) => string
}) {
  const [name, setName] = useState(category?.name || '')
  const [nameEn, setNameEn] = useState(category?.name_en || '')
  const [description, setDescription] = useState(category?.description || '')
  const [color, setColor] = useState(category?.color || '#3B82F6')
  const [sortOrder, setSortOrder] = useState(category?.sort_order || 0)
  const [isActive, setIsActive] = useState(category?.is_active ?? true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ name, name_en: nameEn, description, color, sort_order: sortOrder, is_active: isActive })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.settings.categoryName')} *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.settings.categoryNameEn')}</label>
        <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="input" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={2} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.settings.color')}</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-lg border-2 transition-all ${color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-full rounded cursor-pointer" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.settings.sortOrder')}</label>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} className="input" min={0} />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span className="text-sm text-gray-700">{t('common.active')}</span>
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t">
        <button type="button" onClick={onCancel} className="btn-secondary">{t('common.cancel')}</button>
        <button type="submit" className="btn-primary" disabled={isLoading || !name}>
          {isLoading ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </form>
  )
}

// Type Form
function TypeForm({ type, categories, onSave, onCancel, isLoading, t }: {
  type: MType | null
  categories: MaintenanceCategory[]
  onSave: (data: Partial<MType>) => void
  onCancel: () => void
  isLoading: boolean
  t: (key: string) => string
}) {
  const [category, setCategory] = useState(type?.category || '')
  const [name, setName] = useState(type?.name || '')
  const [nameEn, setNameEn] = useState(type?.name_en || '')
  const [description, setDescription] = useState(type?.description || '')
  const [defaultIntervalKm, setDefaultIntervalKm] = useState<string>(type?.default_interval_km?.toString() || '')
  const [defaultIntervalDays, setDefaultIntervalDays] = useState<string>(type?.default_interval_days?.toString() || '')
  const [vehicleType, setVehicleType] = useState<MType['vehicle_type']>(type?.vehicle_type || 'all')
  const [isMandatory, setIsMandatory] = useState(type?.is_mandatory ?? false)
  const [estimatedCost, setEstimatedCost] = useState(type?.estimated_cost || '')
  const [sortOrder, setSortOrder] = useState(type?.sort_order || 0)
  const [isActive, setIsActive] = useState(type?.is_active ?? true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      category,
      name,
      name_en: nameEn,
      description,
      default_interval_km: defaultIntervalKm ? parseInt(defaultIntervalKm) : null,
      default_interval_days: defaultIntervalDays ? parseInt(defaultIntervalDays) : null,
      vehicle_type: vehicleType as MType['vehicle_type'],
      is_mandatory: isMandatory,
      estimated_cost: estimatedCost || null,
      sort_order: sortOrder,
      is_active: isActive,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.tasks.category')} *</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input" required>
          <option value="">{t('maintenance.settings.selectCategory')}</option>
          {categories.filter(c => c.is_active).map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.settings.typeName')} *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.settings.typeNameEn')}</label>
          <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="input" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={2} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.settings.intervalKm')}</label>
          <input type="number" value={defaultIntervalKm} onChange={(e) => setDefaultIntervalKm(e.target.value)} className="input" placeholder="bijv. 30000" min={0} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.settings.intervalDays')}</label>
          <input type="number" value={defaultIntervalDays} onChange={(e) => setDefaultIntervalDays(e.target.value)} className="input" placeholder="bijv. 365" min={0} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.settings.estimatedCost')}</label>
          <input type="number" step="0.01" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} className="input" placeholder="€" min={0} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.settings.vehicleType')}</label>
          <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value as MType['vehicle_type'])} className="input">
            <option value="all">{t('maintenance.settings.vehicleTypeAll')}</option>
            <option value="truck">{t('maintenance.settings.vehicleTypeTruck')}</option>
            <option value="van">{t('maintenance.settings.vehicleTypeVan')}</option>
            <option value="car">{t('maintenance.settings.vehicleTypeCar')}</option>
            <option value="trailer">{t('maintenance.settings.vehicleTypeTrailer')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.settings.sortOrder')}</label>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} className="input" min={0} />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <span className="text-sm text-gray-700">{t('maintenance.settings.mandatory')}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <span className="text-sm text-gray-700">{t('common.active')}</span>
        </label>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t">
        <button type="button" onClick={onCancel} className="btn-secondary">{t('common.cancel')}</button>
        <button type="submit" className="btn-primary" disabled={isLoading || !name || !category}>
          {isLoading ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </form>
  )
}
