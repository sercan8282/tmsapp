import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { settingsApi, DashboardStats, ActivityItem } from '@/api/settings'
import {
  UsersIcon,
  BuildingOfficeIcon,
  TruckIcon,
  ClockIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

// Chauffeur-specific dashboard
function ChauffeurDashboard({ user }: { user: any }) {
  const { t } = useTranslation()
  
  return (
    <div>
      {/* Welcome message */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('dashboard.welcomeDriver', { name: user?.voornaam })}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('dashboard.manageHours')}
        </p>
      </div>
      
      {/* Quick actions for chauffeur */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Link
          to="/time-entries"
          className="card p-6 hover:shadow-md transition-shadow text-center"
        >
          <div className="flex flex-col items-center">
            <div className="p-4 rounded-full bg-primary-100 mb-4">
              <ClockIcon className="h-8 w-8 text-primary-600" />
            </div>
            <h3 className="font-semibold text-gray-900">{t('nav.timeEntries')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('dashboard.registerHours')}</p>
          </div>
        </Link>
        
        <Link
          to="/my-hours"
          className="card p-6 hover:shadow-md transition-shadow text-center"
        >
          <div className="flex flex-col items-center">
            <div className="p-4 rounded-full bg-green-100 mb-4">
              <ClipboardDocumentListIcon className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">{t('nav.myHours')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('dashboard.viewSubmittedHours')}</p>
          </div>
        </Link>
        
        <Link
          to="/planning"
          className="card p-6 hover:shadow-md transition-shadow text-center"
        >
          <div className="flex flex-col items-center">
            <div className="p-4 rounded-full bg-purple-100 mb-4">
              <CalendarDaysIcon className="h-8 w-8 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900">{t('nav.planning')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('dashboard.viewPlanning')}</p>
          </div>
        </Link>

        <Link
          to="/leave"
          className="card p-6 hover:shadow-md transition-shadow text-center"
        >
          <div className="flex flex-col items-center">
            <div className="p-4 rounded-full bg-orange-100 mb-4">
              <CalendarDaysIcon className="h-8 w-8 text-orange-600" />
            </div>
            <h3 className="font-semibold text-gray-900">{t('nav.leave')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('dashboard.requestLeave')}</p>
          </div>
        </Link>
      </div>
      
      {/* Info card */}
      <div className="card p-6 bg-blue-50 border-blue-200">
        <h3 className="font-medium text-blue-900">💡 {t('dashboard.tip')}</h3>
        <p className="text-sm text-blue-700 mt-1">
          {t('dashboard.tipText')}
        </p>
      </div>
    </div>
  )
}

// Admin/Gebruiker dashboard
function AdminDashboard({ user }: { user: any }) {
  const { t } = useTranslation()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activitiesLoading, setActivitiesLoading] = useState(true)

  useEffect(() => {
    loadStats()
    loadActivities()
  }, [])

  const loadStats = async () => {
    try {
      const data = await settingsApi.getDashboardStats()
      setStats(data)
    } catch (err) {
      console.error('Failed to load dashboard stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadActivities = async () => {
    try {
      const data = await settingsApi.getRecentActivity(8)
      setActivities(data.activities)
    } catch (err) {
      console.error('Failed to load recent activity:', err)
    } finally {
      setActivitiesLoading(false)
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'invoice': return DocumentTextIcon
      case 'planning': return CalendarDaysIcon
      case 'leave': return ClockIcon
      case 'user': return UsersIcon
      case 'company': return BuildingOfficeIcon
      default: return ClipboardDocumentListIcon
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'invoice': return 'text-blue-600 bg-blue-50'
      case 'planning': return 'text-purple-600 bg-purple-50'
      case 'leave': return 'text-orange-600 bg-orange-50'
      case 'user': return 'text-green-600 bg-green-50'
      case 'company': return 'text-indigo-600 bg-indigo-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return t('dashboard.justNow')
    if (diffMins < 60) return t('dashboard.minutesAgo', { count: diffMins })
    if (diffHours < 24) return t('dashboard.hoursAgo', { count: diffHours })
    if (diffDays < 7) return t('dashboard.daysAgo', { count: diffDays })
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  }

  const statCards = [
    { 
      name: t('nav.users'), 
      value: stats?.users ?? '-', 
      icon: UsersIcon, 
      href: '/admin/users',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    { 
      name: t('nav.companies'), 
      value: stats?.companies ?? '-', 
      icon: BuildingOfficeIcon, 
      href: '/companies',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    { 
      name: t('fleet.title'), 
      value: stats?.vehicles ?? '-', 
      icon: TruckIcon, 
      href: '/fleet',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    { 
      name: `${t('dashboard.hoursWeek')} ${stats?.week_number ?? ''}`, 
      value: stats?.hours_this_week ?? '-', 
      icon: ClockIcon, 
      href: '/time-entries',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    { 
      name: t('dashboard.pendingInvoices'), 
      value: stats?.open_invoices ?? '-', 
      icon: DocumentTextIcon, 
      href: '/invoices',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ]
  
  return (
    <div>
      {/* Welcome message */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('dashboard.welcomeDriver', { name: user?.voornaam })}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('dashboard.overview')}
        </p>
      </div>
      
      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((stat) => (
          <Link
            key={stat.name}
            to={stat.href}
            className="card p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center">
              <div className={`flex-shrink-0 p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? (
                    <span className="inline-block w-8 h-6 bg-gray-200 rounded animate-pulse"></span>
                  ) : (
                    stat.value
                  )}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.quickActions')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Link to="/time-entries" className="btn-primary text-center">
            + {t('dashboard.registerHoursAction')}
          </Link>
          <Link to="/leave" className="btn-secondary text-center">
            {t('dashboard.requestLeaveAction')}
          </Link>
          <Link to="/planning" className="btn-secondary text-center">
            + {t('dashboard.newPlanningAction')}
          </Link>
          <Link to="/invoices/new" className="btn-secondary text-center">
            + {t('dashboard.createInvoiceAction')}
          </Link>
          <Link to="/companies" className="btn-secondary text-center">
            + {t('companies.addCompany')}
          </Link>
        </div>
      </div>
      
      {/* Recent activity placeholder */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.recentActivity')}</h2>
          <Link to="/activities" className="text-sm text-primary-600 hover:text-primary-700">
            {t('common.viewAll')} →
          </Link>
        </div>
        <div className="card overflow-hidden">
          {activitiesLoading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
            </div>
          ) : activities.length === 0 ? (
            <div className="p-6">
              <p className="text-gray-500 text-center py-8">
                {t('dashboard.noActivity')}
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {activities.slice(0, 10).map((activity, idx) => {
                  const Icon = getActivityIcon(activity.type)
                  const colorClass = getActivityColor(activity.type)
                  const isClickable = activity.link && activity.link !== '/'
                  
                  return (
                    <li key={activity.id || idx}>
                      {isClickable ? (
                        <Link 
                          to={activity.link} 
                          className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className={`flex-shrink-0 p-2 rounded-lg ${colorClass}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {activity.title}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {activity.description}
                              {activity.user_name && <span className="ml-2 text-gray-400">• {t('dashboard.by')} {activity.user_name}</span>}
                            </p>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-3">
                            <span className="text-xs text-gray-400">
                              {formatTimestamp(activity.timestamp)}
                            </span>
                            <ArrowRightIcon className="h-4 w-4 text-gray-400" />
                          </div>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-4 p-4">
                          <div className={`flex-shrink-0 p-2 rounded-lg ${colorClass}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {activity.title}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {activity.description}
                              {activity.user_name && <span className="ml-2 text-gray-400">• {t('dashboard.by')} {activity.user_name}</span>}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            <span className="text-xs text-gray-400">
                              {formatTimestamp(activity.timestamp)}
                            </span>
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  
  // Show chauffeur-specific dashboard
  if (user?.rol === 'chauffeur') {
    return <ChauffeurDashboard user={user} />
  }
  
  // Show admin/gebruiker dashboard
  return <AdminDashboard user={user} />
}
