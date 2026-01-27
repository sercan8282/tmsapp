import { useAuthStore } from '@/stores/authStore'
import {
  UsersIcon,
  BuildingOfficeIcon,
  TruckIcon,
  ClockIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'

const stats = [
  { name: 'Gebruikers', value: '-', icon: UsersIcon, href: '/admin/users' },
  { name: 'Bedrijven', value: '-', icon: BuildingOfficeIcon, href: '/companies' },
  { name: 'Voertuigen', value: '-', icon: TruckIcon, href: '/fleet' },
  { name: 'Uren deze week', value: '-', icon: ClockIcon, href: '/time-entries' },
  { name: 'Openstaande facturen', value: '-', icon: DocumentTextIcon, href: '/invoices' },
]

export default function DashboardPage() {
  const { user } = useAuthStore()
  
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
        {stats.map((stat) => (
          <a
            key={stat.name}
            href={stat.href}
            className="card p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <stat.icon className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
      
      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Snelle acties</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <a href="/time-entries" className="btn-primary text-center">
            + Uren registreren
          </a>
          <a href="/planning" className="btn-secondary text-center">
            + Nieuwe planning
          </a>
          <a href="/invoices" className="btn-secondary text-center">
            + Factuur aanmaken
          </a>
          <a href="/companies" className="btn-secondary text-center">
            + Bedrijf toevoegen
          </a>
        </div>
      </div>
      
      {/* Recent activity placeholder */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recente activiteit</h2>
        <div className="card p-6">
          <p className="text-gray-500 text-center py-8">
            Nog geen recente activiteit.
          </p>
        </div>
      </div>
    </div>
  )
}
