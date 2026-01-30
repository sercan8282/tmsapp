/**
 * Leave Requests Admin Page
 * Admin interface for approving/rejecting leave requests
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
  FunnelIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import {
  getPendingLeaveRequests,
  adminLeaveAction,
  LeaveRequest,
  LEAVE_TYPE_OPTIONS,
} from '@/api/leave'

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

const STATUS_BADGES = {
  pending: {
    icon: ClockIcon,
    label: 'In afwachting',
    className: 'bg-yellow-100 text-yellow-700',
  },
  approved: {
    icon: CheckCircleIcon,
    label: 'Goedgekeurd',
    className: 'bg-green-100 text-green-700',
  },
  rejected: {
    icon: XCircleIcon,
    label: 'Afgewezen',
    className: 'bg-red-100 text-red-700',
  },
  cancelled: {
    icon: XMarkIcon,
    label: 'Geannuleerd',
    className: 'bg-gray-100 text-gray-700',
  },
}

export default function LeaveRequestsAdminPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [filteredRequests, setFilteredRequests] = useState<LeaveRequest[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchRequests()
  }, [])

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredRequests(requests)
    } else {
      setFilteredRequests(requests.filter(r => r.status === statusFilter))
    }
  }, [requests, statusFilter])

  const fetchRequests = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getPendingLeaveRequests()
      setRequests(data)
    } catch (err: any) {
      setError(err.message || 'Er is iets misgegaan')
    } finally {
      setIsLoading(false)
    }
  }

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleAction = async (requestId: string, action: 'approve' | 'reject' | 'delete') => {
    setIsProcessing(requestId)
    setError(null)
    try {
      await adminLeaveAction(requestId, action)
      
      if (action === 'delete') {
        setRequests(requests.filter(r => r.id !== requestId))
        showSuccess('Verlofaanvraag verwijderd')
      } else {
        // Refetch to get updated status
        await fetchRequests()
        showSuccess(action === 'approve' ? 'Verlof goedgekeurd' : 'Verlof afgewezen')
      }
    } catch (err: any) {
      setError(err.message || `Kon actie niet uitvoeren`)
    } finally {
      setIsProcessing(null)
    }
  }

  const getLeaveTypeLabel = (type: string): string => {
    const option = LEAVE_TYPE_OPTIONS.find(o => o.value === type)
    return option?.label || type
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link
            to="/settings"
            className="flex items-center text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Terug naar instellingen
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Verlofaanvragen Beheren</h1>
          <p className="text-gray-500">
            {pendingCount > 0 ? (
              <span className="text-yellow-600 font-medium">{pendingCount} aanvragen wachten op goedkeuring</span>
            ) : (
              'Alle aanvragen zijn verwerkt'
            )}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Filter */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <FunnelIcon className="w-5 h-5 text-gray-400" />
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'Alle' },
              { value: 'pending', label: 'In afwachting' },
              { value: 'approved', label: 'Goedgekeurd' },
              { value: 'rejected', label: 'Afgewezen' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value as StatusFilter)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.label}
                {filter.value === 'pending' && pendingCount > 0 && (
                  <span className="ml-1.5 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="card">
        {filteredRequests.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ClockIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Geen aanvragen gevonden</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredRequests.map((request) => {
              const statusInfo = STATUS_BADGES[request.status as keyof typeof STATUS_BADGES] || STATUS_BADGES.pending
              const StatusIcon = statusInfo.icon
              const isCurrentProcessing = isProcessing === request.id
              
              return (
                <div key={request.id} className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Request Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{request.user_naam}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Type:</span>{' '}
                          <span className="text-gray-900">{getLeaveTypeLabel(request.leave_type)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Periode:</span>{' '}
                          <span className="text-gray-900">
                            {new Date(request.start_date).toLocaleDateString('nl-NL')}
                            {request.start_date !== request.end_date && (
                              <> - {new Date(request.end_date).toLocaleDateString('nl-NL')}</>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Uren:</span>{' '}
                          <span className="text-gray-900 font-medium">{request.hours} uur</span>
                        </div>
                      </div>
                      {request.notes && (
                        <p className="text-sm text-gray-600 mt-2">
                          <span className="text-gray-500">Opmerking:</span> {request.notes}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Aangevraagd op {new Date(request.created_at).toLocaleString('nl-NL')}
                      </p>
                    </div>

                    {/* Actions */}
                    {request.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAction(request.id, 'approve')}
                          disabled={isCurrentProcessing}
                          className="btn btn-primary flex items-center gap-2"
                        >
                          <CheckIcon className="w-4 h-4" />
                          Goedkeuren
                        </button>
                        <button
                          onClick={() => handleAction(request.id, 'reject')}
                          disabled={isCurrentProcessing}
                          className="btn btn-secondary flex items-center gap-2"
                        >
                          <XMarkIcon className="w-4 h-4" />
                          Afwijzen
                        </button>
                      </div>
                    )}
                    {request.status === 'approved' && (
                      <button
                        onClick={() => {
                          if (confirm('Weet je zeker dat je dit goedgekeurde verlof wilt verwijderen? De uren worden teruggestort.')) {
                            handleAction(request.id, 'delete')
                          }
                        }}
                        disabled={isCurrentProcessing}
                        className="btn btn-secondary flex items-center gap-2 text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Verwijderen
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
