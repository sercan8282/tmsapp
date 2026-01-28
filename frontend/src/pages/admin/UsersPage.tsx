import { useState, useEffect, useCallback } from 'react'
import { 
  MagnifyingGlassIcon, 
  PlusIcon, 
  PencilSquareIcon, 
  TrashIcon,
  KeyIcon,
  ShieldCheckIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { User, UserCreate } from '@/types'
import { 
  getUsers, 
  createUser, 
  updateUser, 
  deleteUser, 
  resetUserPassword, 
  toggleUserActive, 
  disableUserMFA,
  UserFilters,
  UserUpdate,
} from '@/api/users'
import Pagination, { PageSize } from '@/components/common/Pagination'

// Role labels and colors
const roleLabels: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'bg-purple-100 text-purple-800' },
  gebruiker: { label: 'Gebruiker', color: 'bg-blue-100 text-blue-800' },
  chauffeur: { label: 'Chauffeur', color: 'bg-green-100 text-green-800' },
}

// Modal component
function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children,
  size = 'md'
}: { 
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className={`relative bg-white rounded-xl shadow-xl w-full ${sizeClasses[size]} transform transition-all`}>
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// Confirm dialog component
function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Bevestigen',
  confirmColor = 'red',
  isLoading = false,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  confirmColor?: 'red' | 'blue' | 'green'
  isLoading?: boolean
}) {
  const colorClasses = {
    red: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    blue: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    green: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          disabled={isLoading}
        >
          Annuleren
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 text-white rounded-lg focus:ring-2 focus:ring-offset-2 ${colorClasses[confirmColor]} disabled:opacity-50`}
          disabled={isLoading}
        >
          {isLoading ? 'Bezig...' : confirmText}
        </button>
      </div>
    </Modal>
  )
}

// User form component
function UserForm({
  user,
  onSave,
  onCancel,
  isLoading,
}: {
  user?: User
  onSave: (data: UserCreate | UserUpdate) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    email: user?.email || '',
    username: user?.username || '',
    voornaam: user?.voornaam || '',
    achternaam: user?.achternaam || '',
    telefoon: user?.telefoon || '',
    bedrijf: user?.bedrijf || '',
    rol: user?.rol || 'gebruiker',
    is_active: user?.is_active ?? true,
    mfa_required: user?.mfa_required ?? false,
    password: '',
    password_confirm: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    setFormData(prev => ({ ...prev, [name]: newValue }))
    setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.email) newErrors.email = 'E-mail is verplicht'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Ongeldig e-mailadres'
    
    if (!formData.username) newErrors.username = 'Gebruikersnaam is verplicht'
    if (!formData.voornaam) newErrors.voornaam = 'Voornaam is verplicht'
    if (!formData.achternaam) newErrors.achternaam = 'Achternaam is verplicht'
    
    if (!user) {
      // Password required for new users
      if (!formData.password) newErrors.password = 'Wachtwoord is verplicht'
      else if (formData.password.length < 8) newErrors.password = 'Minimaal 8 karakters'
      
      if (formData.password !== formData.password_confirm) {
        newErrors.password_confirm = 'Wachtwoorden komen niet overeen'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    if (user) {
      // Update - don't send password
      const { password, password_confirm, ...updateData } = formData
      onSave(updateData)
    } else {
      // Create - send all data
      onSave(formData as UserCreate)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Voornaam *
          </label>
          <input
            type="text"
            name="voornaam"
            value={formData.voornaam}
            onChange={handleChange}
            className={`input ${errors.voornaam ? 'border-red-500' : ''}`}
          />
          {errors.voornaam && <p className="text-red-500 text-xs mt-1">{errors.voornaam}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Achternaam *
          </label>
          <input
            type="text"
            name="achternaam"
            value={formData.achternaam}
            onChange={handleChange}
            className={`input ${errors.achternaam ? 'border-red-500' : ''}`}
          />
          {errors.achternaam && <p className="text-red-500 text-xs mt-1">{errors.achternaam}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          E-mail *
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`input ${errors.email ? 'border-red-500' : ''}`}
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Gebruikersnaam *
        </label>
        <input
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
          className={`input ${errors.username ? 'border-red-500' : ''}`}
        />
        {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
      </div>

      {!user && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wachtwoord *
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`input ${errors.password ? 'border-red-500' : ''}`}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bevestig wachtwoord *
            </label>
            <input
              type="password"
              name="password_confirm"
              value={formData.password_confirm}
              onChange={handleChange}
              className={`input ${errors.password_confirm ? 'border-red-500' : ''}`}
            />
            {errors.password_confirm && <p className="text-red-500 text-xs mt-1">{errors.password_confirm}</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Telefoon
          </label>
          <input
            type="tel"
            name="telefoon"
            value={formData.telefoon}
            onChange={handleChange}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bedrijf
          </label>
          <input
            type="text"
            name="bedrijf"
            value={formData.bedrijf}
            onChange={handleChange}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rol
          </label>
          <select
            name="rol"
            value={formData.rol}
            onChange={handleChange}
            className="input"
          >
            <option value="gebruiker">Gebruiker</option>
            <option value="chauffeur">Chauffeur</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex items-center pt-6">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
            />
            <span className="ml-2 text-sm text-gray-700">Actief</span>
          </label>
        </div>
        <div className="flex items-center pt-6">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="mfa_required"
              checked={formData.mfa_required}
              onChange={handleChange}
              className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
            />
            <span className="ml-2 text-sm text-gray-700">2FA Verplicht</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          disabled={isLoading}
        >
          Annuleren
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={isLoading}
        >
          {isLoading ? 'Bezig...' : user ? 'Opslaan' : 'Aanmaken'}
        </button>
      </div>
    </form>
  )
}

// Password reset form
function PasswordResetForm({
  user,
  onSave,
  onCancel,
  isLoading,
}: {
  user: User
  onSave: (password: string) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password.length < 8) {
      setError('Wachtwoord moet minimaal 8 karakters zijn')
      return
    }
    if (password !== passwordConfirm) {
      setError('Wachtwoorden komen niet overeen')
      return
    }
    
    onSave(password)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-gray-600">
        Reset het wachtwoord voor <strong>{user.full_name}</strong>
      </p>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nieuw wachtwoord
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError('') }}
          className="input"
          placeholder="Minimaal 8 karakters"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bevestig wachtwoord
        </label>
        <input
          type="password"
          value={passwordConfirm}
          onChange={(e) => { setPasswordConfirm(e.target.value); setError('') }}
          className="input"
        />
      </div>
      
      {error && <p className="text-red-500 text-sm">{error}</p>}
      
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          disabled={isLoading}
        >
          Annuleren
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={isLoading}
        >
          {isLoading ? 'Bezig...' : 'Reset wachtwoord'}
        </button>
      </div>
    </form>
  )
}

// Main UsersPage component
export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<string>('achternaam')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [pageSize, setPageSize] = useState<PageSize>(30)

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [showMfaModal, setShowMfaModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const filters: UserFilters = {
        page,
        page_size: pageSize,
        ordering: sortDirection === 'asc' ? sortField : `-${sortField}`,
      }
      if (search) filters.search = search
      if (roleFilter) filters.rol = roleFilter
      if (statusFilter) filters.is_active = statusFilter
      
      const response = await getUsers(filters)
      setUsers(response.results || [])
      setTotalCount(response.count || 0)
    } catch (err) {
      setError('Fout bij ophalen gebruikers')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, search, roleFilter, statusFilter, sortField, sortDirection])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Show success message temporarily
  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  // Handle sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Handle create user
  // Helper to extract error message from response
  const getErrorMessage = (err: any, defaultMsg: string): string => {
    if (err.response?.data) {
      const data = err.response.data
      // Handle {error: "message"} format
      if (data.error) return data.error
      // Handle {message: "message"} format
      if (data.message) return data.message
      // Handle {detail: "message"} format
      if (data.detail) return data.detail
      // Handle field errors {field: ["error"]}
      const firstField = Object.keys(data)[0]
      if (firstField && Array.isArray(data[firstField])) {
        return data[firstField][0]
      }
    }
    return defaultMsg
  }

  // Handle create user
  const handleCreateUser = async (data: UserCreate | UserUpdate) => {
    setIsActionLoading(true)
    try {
      await createUser(data as UserCreate)
      setShowCreateModal(false)
      showSuccess('Gebruiker succesvol aangemaakt')
      fetchUsers()
    } catch (err: any) {
      setError(getErrorMessage(err, 'Fout bij aanmaken gebruiker'))
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle update user
  const handleUpdateUser = async (data: UserCreate | UserUpdate) => {
    if (!selectedUser) return
    setIsActionLoading(true)
    try {
      await updateUser(selectedUser.id, data as UserUpdate)
      setShowEditModal(false)
      setSelectedUser(null)
      showSuccess('Gebruiker succesvol bijgewerkt')
      fetchUsers()
    } catch (err: any) {
      setError(getErrorMessage(err, 'Fout bij bijwerken gebruiker'))
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!selectedUser) return
    setIsActionLoading(true)
    try {
      await deleteUser(selectedUser.id)
      setShowDeleteModal(false)
      setSelectedUser(null)
      showSuccess('Gebruiker succesvol verwijderd')
      fetchUsers()
    } catch (err: any) {
      setError(getErrorMessage(err, 'Fout bij verwijderen gebruiker'))
      setShowDeleteModal(false)
      setSelectedUser(null)
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle password reset
  const handlePasswordReset = async (password: string) => {
    if (!selectedUser) return
    setIsActionLoading(true)
    try {
      await resetUserPassword(selectedUser.id, password)
      setShowPasswordModal(false)
      setSelectedUser(null)
      showSuccess('Wachtwoord succesvol gereset')
    } catch (err: any) {
      setError(getErrorMessage(err, 'Fout bij resetten wachtwoord'))
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle toggle active
  const handleToggleActive = async () => {
    if (!selectedUser) return
    setIsActionLoading(true)
    try {
      await toggleUserActive(selectedUser.id)
      setShowBlockModal(false)
      setSelectedUser(null)
      showSuccess(`Gebruiker succesvol ${selectedUser.is_active ? 'geblokkeerd' : 'geactiveerd'}`)
      fetchUsers()
    } catch (err: any) {
      setError(getErrorMessage(err, 'Fout bij wijzigen status'))
      setShowBlockModal(false)
      setSelectedUser(null)
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle disable MFA
  const handleDisableMfa = async () => {
    if (!selectedUser) return
    setIsActionLoading(true)
    try {
      await disableUserMFA(selectedUser.id)
      setShowMfaModal(false)
      setSelectedUser(null)
      showSuccess('2FA succesvol uitgeschakeld')
      fetchUsers()
    } catch (err: any) {
      setError(getErrorMessage(err, 'Fout bij uitschakelen 2FA'))
      setShowMfaModal(false)
      setSelectedUser(null)
    } finally {
      setIsActionLoading(false)
    }
  }

  // Pagination
  const totalPages = Math.ceil(totalCount / pageSize)

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Sort icon
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' 
      ? <ChevronUpIcon className="w-4 h-4 inline ml-1" />
      : <ChevronDownIcon className="w-4 h-4 inline ml-1" />
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Gebruikersbeheer</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Nieuwe gebruiker
        </button>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center">
          <CheckCircleIcon className="w-5 h-5 mr-2" />
          {successMessage}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex-1 min-w-64">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zoeken
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Zoek op naam, e-mail..."
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Role filter */}
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rol
              </label>
              <select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
                className="input"
              >
                <option value="">Alle rollen</option>
                <option value="admin">Admin</option>
                <option value="gebruiker">Gebruiker</option>
                <option value="chauffeur">Chauffeur</option>
              </select>
            </div>

            {/* Status filter */}
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className="input"
              >
                <option value="">Alle statussen</option>
                <option value="true">Actief</option>
                <option value="false">Geblokkeerd</option>
              </select>
            </div>

            {/* Refresh button */}
            <button
              onClick={() => fetchUsers()}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="Vernieuwen"
            >
              <ArrowPathIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('achternaam')}
                >
                  Naam <SortIcon field="achternaam" />
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('email')}
                >
                  E-mail <SortIcon field="email" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Rol
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  2FA
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('last_login')}
                >
                  Laatste login <SortIcon field="last_login" />
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                      <span className="ml-3">Laden...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    Geen gebruikers gevonden
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">{user.full_name}</div>
                        <div className="text-sm text-gray-500">@{user.username}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${roleLabels[user.rol]?.color}`}>
                        {roleLabels[user.rol]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.is_active ? (
                        <span className="flex items-center text-green-600">
                          <CheckCircleIcon className="w-4 h-4 mr-1" />
                          Actief
                        </span>
                      ) : (
                        <span className="flex items-center text-red-600">
                          <NoSymbolIcon className="w-4 h-4 mr-1" />
                          Geblokkeerd
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.mfa_enabled ? (
                        <span className="flex items-center text-green-600">
                          <ShieldCheckIcon className="w-4 h-4 mr-1" />
                          Aan
                        </span>
                      ) : user.mfa_required ? (
                        <span className="flex items-center text-orange-600">
                          <ShieldCheckIcon className="w-4 h-4 mr-1" />
                          Verplicht
                        </span>
                      ) : (
                        <span className="text-gray-400">Uit</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(user.last_login)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setSelectedUser(user); setShowEditModal(true) }}
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded"
                          title="Bewerken"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedUser(user); setShowPasswordModal(true) }}
                          className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-gray-100 rounded"
                          title="Wachtwoord resetten"
                        >
                          <KeyIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedUser(user); setShowBlockModal(true) }}
                          className={`p-1.5 hover:bg-gray-100 rounded ${user.is_active ? 'text-gray-500 hover:text-orange-600' : 'text-gray-500 hover:text-green-600'}`}
                          title={user.is_active ? 'Blokkeren' : 'Activeren'}
                        >
                          {user.is_active ? <NoSymbolIcon className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
                        </button>
                        {user.mfa_enabled && (
                          <button
                            onClick={() => { setSelectedUser(user); setShowMfaModal(true) }}
                            className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-gray-100 rounded"
                            title="2FA uitschakelen"
                          >
                            <ShieldCheckIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => { setSelectedUser(user); setShowDeleteModal(true) }}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded"
                          title="Verwijderen"
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

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); }}
        />
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nieuwe gebruiker"
        size="lg"
      >
        <UserForm
          onSave={handleCreateUser}
          onCancel={() => setShowCreateModal(false)}
          isLoading={isActionLoading}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedUser(null) }}
        title="Gebruiker bewerken"
        size="lg"
      >
        {selectedUser && (
          <UserForm
            user={selectedUser}
            onSave={handleUpdateUser}
            onCancel={() => { setShowEditModal(false); setSelectedUser(null) }}
            isLoading={isActionLoading}
          />
        )}
      </Modal>

      {/* Password Reset Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => { setShowPasswordModal(false); setSelectedUser(null) }}
        title="Wachtwoord resetten"
        size="sm"
      >
        {selectedUser && (
          <PasswordResetForm
            user={selectedUser}
            onSave={handlePasswordReset}
            onCancel={() => { setShowPasswordModal(false); setSelectedUser(null) }}
            isLoading={isActionLoading}
          />
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmDialog
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedUser(null) }}
        onConfirm={handleDeleteUser}
        title="Gebruiker verwijderen"
        message={`Weet je zeker dat je ${selectedUser?.full_name} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`}
        confirmText="Verwijderen"
        confirmColor="red"
        isLoading={isActionLoading}
      />

      {/* Block/Unblock Confirm Modal */}
      <ConfirmDialog
        isOpen={showBlockModal}
        onClose={() => { setShowBlockModal(false); setSelectedUser(null) }}
        onConfirm={handleToggleActive}
        title={selectedUser?.is_active ? 'Gebruiker blokkeren' : 'Gebruiker activeren'}
        message={selectedUser?.is_active 
          ? `Weet je zeker dat je ${selectedUser?.full_name} wilt blokkeren? De gebruiker kan dan niet meer inloggen.`
          : `Weet je zeker dat je ${selectedUser?.full_name} wilt activeren?`
        }
        confirmText={selectedUser?.is_active ? 'Blokkeren' : 'Activeren'}
        confirmColor={selectedUser?.is_active ? 'red' : 'green'}
        isLoading={isActionLoading}
      />

      {/* Disable MFA Confirm Modal */}
      <ConfirmDialog
        isOpen={showMfaModal}
        onClose={() => { setShowMfaModal(false); setSelectedUser(null) }}
        onConfirm={handleDisableMfa}
        title="2FA uitschakelen"
        message={`Weet je zeker dat je 2FA voor ${selectedUser?.full_name} wilt uitschakelen? De gebruiker moet 2FA opnieuw instellen om het weer te activeren.`}
        confirmText="Uitschakelen"
        confirmColor="red"
        isLoading={isActionLoading}
      />
    </div>
  )
}
