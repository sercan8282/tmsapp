/**
 * Notification Bell Component
 * Shows bell icon with unread count badge and dropdown with recent notifications
 */
import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { Transition } from '@headlessui/react'
import {
  BellIcon,
  BellAlertIcon,
  CheckIcon,
  TrashIcon,
  ArrowRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'
import {
  pushApi,
  type UserNotification,
  type NotificationInboxResponse,
} from '@/api/push'

// Helper function to format relative time in Dutch
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'zojuist'
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minuut' : 'minuten'} geleden`
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'uur' : 'uur'} geleden`
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'dag' : 'dagen'} geleden`
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

interface NotificationBellProps {
  className?: string
}

export default function NotificationBell({ className = '' }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<NotificationInboxResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pollInterval, setPollInterval] = useState(10000) // Default 10 seconds
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Fetch notifications (silent = no loading state for background polls)
  const fetchNotifications = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      setError(null)
      const response = await pushApi.getRecentNotifications(3)
      setData(response)
    } catch (err: any) {
      console.error('Failed to fetch notifications:', err)
      if (!silent) setError('Kon notificaties niet laden')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // Fetch poll interval from settings on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await pushApi.getConfig()
        // Convert seconds to milliseconds, with minimum of 5 seconds
        const intervalMs = Math.max(5, config.notification_poll_interval || 10) * 1000
        setPollInterval(intervalMs)
      } catch (err) {
        console.error('Failed to fetch push config:', err)
        // Keep default interval
      }
    }
    fetchConfig()
  }, [])

  // Fetch on mount and poll periodically
  useEffect(() => {
    fetchNotifications()
    
    // Poll every X seconds based on settings
    const interval = setInterval(() => fetchNotifications(true), pollInterval)
    return () => clearInterval(interval)
  }, [pollInterval, fetchNotifications])

  // Refresh when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications(true)
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Mark notification as read
  const handleMarkRead = async (notification: UserNotification) => {
    if (notification.is_read) return
    
    try {
      await pushApi.markNotificationRead(notification.id)
      // Update local state
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          unread_count: Math.max(0, prev.unread_count - 1),
          notifications: prev.notifications.map(n =>
            n.id === notification.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
          ),
        }
      })
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await pushApi.markAllNotificationsRead()
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          unread_count: 0,
          notifications: prev.notifications.map(n => ({
            ...n,
            is_read: true,
            read_at: n.read_at || new Date().toISOString(),
          })),
        }
      })
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }

  // Clear all notifications
  const handleClearAll = async () => {
    try {
      await pushApi.clearAllNotifications()
      setData({
        notifications: [],
        unread_count: 0,
        total_count: 0,
        has_more: false,
      })
    } catch (err) {
      console.error('Failed to clear notifications:', err)
    }
  }

  // Navigate to URL and mark as read
  const handleNotificationClick = async (notification: UserNotification) => {
    await handleMarkRead(notification)
    if (notification.url) {
      window.location.href = notification.url
    }
    setIsOpen(false)
  }

  const unreadCount = data?.unread_count || 0
  const hasNotifications = (data?.notifications?.length || 0) > 0

  return (
    <div className={`relative ${className}`}>
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-label={`Notificaties${unreadCount > 0 ? ` (${unreadCount} ongelezen)` : ''}`}
      >
        {unreadCount > 0 ? (
          <BellAlertIcon className="h-6 w-6 text-primary-600" />
        ) : (
          <BellIcon className="h-6 w-6" />
        )}
        
        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <Transition
        show={isOpen}
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-150"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-50"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Notificaties</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  title="Alles als gelezen markeren"
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
              )}
              {hasNotifications && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-gray-500 hover:text-red-600"
                  title="Alle notificaties verwijderen"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {loading && !data ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                Laden...
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center text-red-500 text-sm">
                {error}
              </div>
            ) : !hasNotifications ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <BellIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Geen notificaties</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data?.notifications.map((notification) => (
                  <li key={notification.id}>
                    <button
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                        !notification.is_read ? 'bg-primary-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Unread indicator */}
                        <div className="flex-shrink-0 mt-1">
                          {!notification.is_read ? (
                            <span className="block h-2 w-2 rounded-full bg-primary-500" />
                          ) : (
                            <span className="block h-2 w-2" />
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-500 line-clamp-2">
                            {notification.body}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatTimeAgo(notification.sent_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {data?.has_more && (
            <div className="px-4 py-3 border-t border-gray-100">
              <Link
                to="/notifications"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Toon alle notificaties
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </Transition>
    </div>
  )
}
