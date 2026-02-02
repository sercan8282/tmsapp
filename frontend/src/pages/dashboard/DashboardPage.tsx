import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
  return (
    <div>
      {/* Welcome message */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welkom terug, {user?.voornaam}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Beheer hier je urenregistraties en bekijk je planning.
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
            <h3 className="font-semibold text-gray-900">Urenregistratie</h3>
            <p className="text-sm text-gray-500 mt-1">Registreer je gewerkte uren</p>
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
            <h3 className="font-semibold text-gray-900">Mijn Uren</h3>
            <p className="text-sm text-gray-500 mt-1">Bekijk je ingediende uren</p>
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
            <h3 className="font-semibold text-gray-900">Planning</h3>
            <p className="text-sm text-gray-500 mt-1">Bekijk je ingeplande ritten</p>
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
            <h3 className="font-semibold text-gray-900">Verlof</h3>
            <p className="text-sm text-gray-500 mt-1">Vraag verlof aan</p>
          </div>
        </Link>
      </div>
      
      {/* Info card */}
      <div className="card p-6 bg-blue-50 border-blue-200">
        <h3 className="font-medium text-blue-900">💡 Tip</h3>
        <p className="text-sm text-blue-700 mt-1">
          Vergeet niet je uren aan het einde van de week in te dienen via de Urenregistratie pagina.
        </p>
      </div>
    </div>
  )
}

// Admin/Gebruiker dashboard
function AdminDashboard({ user }: { user: any }) {
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

    if (diffMins < 1) return 'Zojuist'
    if (diffMins < 60) return `${diffMins} min geleden`
    if (diffHours < 24) return `${diffHours} uur geleden`
    if (diffDays < 7) return `${diffDays} dagen geleden`
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  }

  const statCards = [
    { 
      name: 'Gebruikers', 
      value: stats?.users ?? '-', 
      icon: UsersIcon, 
      href: '/admin/users',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    { 
      name: 'Bedrijven', 
      value: stats?.companies ?? '-', 
      icon: BuildingOfficeIcon, 
      href: '/companies',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    { 
      name: 'Voertuigen', 
      value: stats?.vehicles ?? '-', 
      icon: TruckIcon, 
      href: '/fleet',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    { 
      name: `Uren week ${stats?.week_number ?? ''}`, 
      value: stats?.hours_this_week ?? '-', 
      icon: ClockIcon, 
      href: '/time-entries',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    { 
      name: 'Openstaande facturen', 
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
          Welkom terug, {user?.voornaam}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Hier is een overzicht van je transportmanagement systeem.
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Snelle acties</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Link to="/time-entries" className="btn-primary text-center">
            + Uren registreren
          </Link>
          <Link to="/leave" className="btn-secondary text-center">
            Verlof aanvragen
          </Link>
          <Link to="/planning" className="btn-secondary text-center">
            + Nieuwe planning
          </Link>
          <Link to="/invoices/new" className="btn-secondary text-center">
            + Factuur aanmaken
          </Link>
          <Link to="/companies" className="btn-secondary text-center">
            + Bedrijf toevoegen
          </Link>
        </div>
      </div>
      
      {/* Recent activity placeholder */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recente activiteit</h2>
        <div className="card overflow-hidden">
          {activitiesLoading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
            </div>
          ) : activities.length === 0 ? (
            <div className="p-6">
              <p className="text-gray-500 text-center py-8">
                Nog geen recente activiteit.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {activities.map((activity, idx) => {
                const Icon = getActivityIcon(activity.type)
                const colorClass = getActivityColor(activity.type)
                return (
                  <li key={idx}>
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
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-3">
                        <span className="text-xs text-gray-400">
                          {formatTimestamp(activity.timestamp)}
                        </span>
                        <ArrowRightIcon className="h-4 w-4 text-gray-400" />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
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
