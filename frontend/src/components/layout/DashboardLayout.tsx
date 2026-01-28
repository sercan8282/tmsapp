import { useEffect, Fragment } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Dialog, Transition, Menu } from '@headlessui/react'
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  UsersIcon,
  BuildingOfficeIcon,
  TruckIcon,
  ClockIcon,
  CalendarIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  KeyIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useThemeStore } from '@/stores/themeStore'
import { AppSettings } from '@/types'
import clsx from '@/utils/clsx'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: ('admin' | 'gebruiker' | 'chauffeur')[]  // If undefined, all roles can see it
}

// Navigation items with role-based access
const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: HomeIcon, roles: ['admin', 'gebruiker'] },
  { name: 'Bedrijven', href: '/companies', icon: BuildingOfficeIcon, roles: ['admin', 'gebruiker'] },
  { name: 'Chauffeurs', href: '/drivers', icon: UsersIcon, roles: ['admin', 'gebruiker'] },
  { name: 'Vloot', href: '/fleet', icon: TruckIcon, roles: ['admin', 'gebruiker'] },
  { name: 'Urenregistratie', href: '/time-entries', icon: ClockIcon },  // All roles
  { name: 'Mijn Uren', href: '/my-hours', icon: ClipboardDocumentListIcon, roles: ['chauffeur'] },
  { name: 'Ingediende Uren', href: '/submitted-hours', icon: ClipboardDocumentListIcon, roles: ['admin', 'gebruiker'] },
  { name: 'Planning', href: '/planning', icon: CalendarIcon },  // All roles (filtered by backend)
  { name: 'Facturen', href: '/invoices', icon: DocumentTextIcon, roles: ['admin', 'gebruiker'] },
  { name: 'Factuur Templates', href: '/invoices/templates', icon: DocumentDuplicateIcon, roles: ['admin'] },
]

const adminNavigation: NavItem[] = [
  { name: 'Gebruikers', href: '/admin/users', icon: UsersIcon, roles: ['admin'] },
  { name: 'Instellingen', href: '/settings', icon: Cog6ToothIcon, roles: ['admin'] },
]

export default function DashboardLayout() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { settings, sidebarOpen, setSidebarOpen, fetchSettings } = useAppStore()
  const { currentTheme, applyTheme } = useThemeStore()
  
  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])
  
  // Apply theme on mount
  useEffect(() => {
    applyTheme(currentTheme)
  }, [currentTheme, applyTheme])
  
  const handleLogout = () => {
    logout()
    navigate('/login')
  }
  
  const userRole = user?.rol || 'chauffeur'
  
  // Filter navigation items based on user role
  const filterByRole = (items: NavItem[]) => 
    items.filter(item => !item.roles || item.roles.includes(userRole))
  
  const filteredNavigation = filterByRole(navigation)
  const filteredAdminNavigation = filterByRole(adminNavigation)
  const allNavigation = [...filteredNavigation, ...filteredAdminNavigation]
  
  return (
    <div className="h-full flex">
      {/* Mobile sidebar */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                  <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                    <XMarkIcon className="h-6 w-6 text-white" />
                  </button>
                </div>
                
                <SidebarContent 
                  navigation={allNavigation} 
                  settings={settings} 
                  onNavigate={() => setSidebarOpen(false)}
                />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <SidebarContent navigation={allNavigation} settings={settings} />
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-2 sm:gap-x-4 border-b border-gray-200 bg-white px-3 sm:px-4 shadow-sm lg:gap-x-6 lg:px-8">
          <button
            type="button"
            className="p-2.5 text-gray-700 lg:hidden touch-target"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1" />
            
            {/* Profile dropdown */}
            <div className="flex items-center gap-x-2 sm:gap-x-4 lg:gap-x-6">
              <Menu as="div" className="relative">
                <Menu.Button className="flex items-center p-1.5 hover:bg-gray-50 rounded-lg touch-target">
                  <UserCircleIcon className="h-8 w-8 text-gray-400" />
                  <span className="hidden lg:flex lg:items-center">
                    <span className="ml-4 text-sm font-semibold text-gray-900">
                      {user?.full_name}
                    </span>
                    <ChevronDownIcon className="ml-2 h-5 w-5 text-gray-400" />
                  </span>
                </Menu.Button>
                
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 z-10 mt-2.5 w-48 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm text-gray-500">{user?.email}</p>
                      <p className="text-xs text-gray-400 capitalize">{user?.rol}</p>
                    </div>
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => navigate('/profile/password')}
                          className={clsx(
                            active ? 'bg-gray-50' : '',
                            'flex w-full items-center px-4 py-2 text-sm text-gray-700'
                          )}
                        >
                          <KeyIcon className="mr-3 h-5 w-5 text-gray-400" />
                          Wachtwoord wijzigen
                        </button>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={handleLogout}
                          className={clsx(
                            active ? 'bg-gray-50' : '',
                            'flex w-full items-center px-4 py-2 text-sm text-gray-700'
                          )}
                        >
                          <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5 text-gray-400" />
                          Uitloggen
                        </button>
                      )}
                    </Menu.Item>
                  </Menu.Items>
                </Transition>
              </Menu>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

interface SidebarContentProps {
  navigation: NavItem[]
  settings: AppSettings | null
  onNavigate?: () => void
}

function SidebarContent({ navigation, settings, onNavigate }: SidebarContentProps) {
  return (
    <div 
      className="flex grow flex-col gap-y-5 overflow-y-auto px-6 pb-4"
      style={{ backgroundColor: 'var(--color-sidebar)' }}
    >
      <div className="flex h-16 shrink-0 items-center gap-3">
        {settings?.logo_url && (
          <img className="h-8 w-auto" src={settings.logo_url} alt={settings.app_name} />
        )}
        <span className="text-xl font-bold text-white">{settings?.app_name || 'TMS'}</span>
      </div>
      
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {navigation.map((item) => (
                <li key={item.name}>
                  <NavLink
                    to={item.href}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      clsx(
                        'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-colors',
                        isActive
                          ? 'text-white'
                          : 'hover:text-white'
                      )
                    }
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? 'var(--color-sidebar-hover)' : 'transparent',
                      color: isActive ? 'white' : 'var(--color-sidebar-text)',
                    })}
                  >
                    <item.icon className="h-6 w-6 shrink-0" />
                    {item.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  )
}
