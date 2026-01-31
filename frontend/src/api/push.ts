import api from './client'

// Types
export interface PushSettings {
  id: string
  provider: 'none' | 'webpush' | 'firebase'
  provider_display: string
  vapid_public_key: string | null
  vapid_admin_email: string | null
  has_vapid_private_key: boolean
  firebase_project_id: string | null
  firebase_sender_id: string | null
  has_firebase_api_key: boolean
  is_configured: boolean
  notification_poll_interval: number
  updated_at: string
}

export interface PushSettingsUpdate {
  provider?: 'none' | 'webpush' | 'firebase'
  vapid_public_key?: string
  vapid_private_key?: string
  vapid_admin_email?: string
  firebase_project_id?: string
  firebase_api_key?: string
  firebase_sender_id?: string
  notification_poll_interval?: number
}

export interface VapidKeys {
  public_key: string
  private_key: string
}

export interface PushConfig {
  is_configured: boolean
  provider: 'none' | 'webpush' | 'firebase'
  public_key?: string
  notification_poll_interval: number
  firebase_config?: {
    projectId: string
    messagingSenderId: string
  }
}

export interface PushSubscription {
  id: string
  endpoint: string
  device_name: string | null
  is_active: boolean
  created_at: string
  last_used_at: string | null
}

export interface SubscriptionStatus {
  is_subscribed: boolean
  subscription_count: number
  push_enabled: boolean
}

export interface SendNotification {
  title: string
  body: string
  icon?: string
  url?: string
  data?: Record<string, unknown>
  user_id?: string
  user_ids?: string[]
  send_to_all?: boolean
}

export interface SendResult {
  success_count: number
  failure_count: number
  error?: string
}

export interface PushNotificationLog {
  id: string
  recipient: string | null
  recipient_email: string | null
  send_to_all: boolean
  group: string | null
  group_name: string | null
  title: string
  body: string
  icon: string | null
  url: string | null
  data: Record<string, unknown> | null
  sent_at: string
  sent_by: string
  sent_by_email: string
  success_count: number
  failure_count: number
}

// Notification Group types
export interface NotificationGroupMember {
  id: string
  email: string
  full_name: string
}

export interface NotificationGroup {
  id: string
  name: string
  description: string | null
  company: string | null
  company_name: string | null
  member_ids: string[]
  members_detail?: NotificationGroupMember[]
  member_count: number
  schedule_count?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface NotificationGroupCreate {
  name: string
  description?: string
  company?: string | null
  member_ids?: string[]
  is_active?: boolean
}

// Schedule types
export type ScheduleFrequency = 'daily' | 'weekdays' | 'weekend' | 'weekly' | 'custom'

export interface NotificationSchedule {
  id: string
  name: string
  group: string
  group_name: string
  frequency: ScheduleFrequency
  frequency_display: string
  weekly_day: number | null
  weekly_day_display: string | null
  custom_days: number[]
  custom_days_display: string[]
  send_time: string
  title: string
  body: string
  icon: string | null
  url: string | null
  is_active: boolean
  last_sent_at: string | null
  next_send_at: string | null
  schedule_display: string
  created_at: string
  updated_at: string
}

export interface NotificationScheduleCreate {
  name: string
  group: string
  frequency: ScheduleFrequency
  weekly_day?: number | null
  custom_days?: number[]
  send_time: string
  title: string
  body: string
  icon?: string
  url?: string
  is_active?: boolean
}

export interface ScheduleFrequencyChoice {
  value: ScheduleFrequency
  label: string
}

export interface WeekDayChoice {
  value: number
  label: string
}

export interface ScheduleChoices {
  frequencies: ScheduleFrequencyChoice[]
  weekdays: WeekDayChoice[]
}

export interface AvailableUser {
  id: string
  email: string
  full_name: string
}

// ============ Notification Inbox Types ============

export interface UserNotification {
  id: string
  notification_id: string
  title: string
  body: string
  icon: string | null
  url: string | null
  is_read: boolean
  read_at: string | null
  sent_at: string
  created_at: string
}

export interface NotificationInboxResponse {
  notifications: UserNotification[]
  unread_count: number
  total_count: number
  has_more: boolean
}

export interface NotificationCount {
  unread_count: number
  total_count: number
}

// ============ Admin: Sent Notifications Types ============

export interface ReadReceipt {
  user_id: string
  user_email: string
  user_full_name: string
  is_read: boolean
  read_at: string | null
  delivered_at?: string
}

export interface SentNotification {
  id: string
  title: string
  body: string
  icon: string | null
  url: string | null
  recipient: string | null
  recipient_email: string | null
  recipient_name: string | null
  group: string | null
  group_name: string | null
  send_to_all: boolean
  sent_by: string | null
  sent_by_email: string | null
  sent_by_name: string | null
  sent_at: string
  success_count: number
  failure_count: number
  total_recipients: number
  read_count: number
  read_receipts?: ReadReceipt[]
}

export const pushApi = {
  // Admin: Get push settings
  getSettings: async (): Promise<PushSettings> => {
    const response = await api.get('/notifications/settings/')
    return response.data
  },

  // Admin: Update push settings
  updateSettings: async (data: PushSettingsUpdate): Promise<PushSettings> => {
    const response = await api.patch('/notifications/settings/', data)
    return response.data
  },

  // Admin: Generate VAPID keys
  generateVapidKeys: async (): Promise<VapidKeys> => {
    const response = await api.post('/notifications/settings/generate-vapid-keys/')
    return response.data
  },

  // Public: Get push config (for subscribing)
  getConfig: async (): Promise<PushConfig> => {
    const response = await api.get('/notifications/config/')
    return response.data
  },

  // User: Subscribe to push notifications
  subscribe: async (subscription: PushSubscriptionJSON, deviceName?: string): Promise<PushSubscription> => {
    const response = await api.post('/notifications/subscriptions/', {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      device_name: deviceName,
    })
    return response.data
  },

  // User: Unsubscribe from push notifications
  unsubscribe: async (endpoint: string): Promise<void> => {
    await api.post('/notifications/subscriptions/unsubscribe/', { endpoint })
  },

  // User: Get subscription status
  getSubscriptionStatus: async (): Promise<SubscriptionStatus> => {
    const response = await api.get('/notifications/subscriptions/status/')
    return response.data
  },

  // User: Get my subscriptions
  getMySubscriptions: async (): Promise<PushSubscription[]> => {
    const response = await api.get('/notifications/subscriptions/')
    return response.data
  },

  // User: Delete a subscription
  deleteSubscription: async (id: string): Promise<void> => {
    await api.delete(`/push/subscriptions/${id}/`)
  },

  // Admin: Send push notification
  send: async (data: SendNotification): Promise<SendResult> => {
    const response = await api.post('/notifications/send/', data)
    return response.data
  },

  // Admin: Get notification logs
  getLogs: async (params?: { recipient?: string }): Promise<PushNotificationLog[]> => {
    const response = await api.get('/notifications/logs/', { params })
    return response.data
  },

  // ============================================
  // Notification Groups
  // ============================================
  
  // Get all notification groups
  getGroups: async (): Promise<NotificationGroup[]> => {
    const response = await api.get('/notifications/groups/')
    return response.data
  },

  // Get a single notification group
  getGroup: async (id: string): Promise<NotificationGroup> => {
    const response = await api.get(`/push/groups/${id}/`)
    return response.data
  },

  // Create a notification group
  createGroup: async (data: NotificationGroupCreate): Promise<NotificationGroup> => {
    const response = await api.post('/notifications/groups/', data)
    return response.data
  },

  // Update a notification group
  updateGroup: async (id: string, data: Partial<NotificationGroupCreate>): Promise<NotificationGroup> => {
    const response = await api.patch(`/push/groups/${id}/`, data)
    return response.data
  },

  // Delete a notification group
  deleteGroup: async (id: string): Promise<void> => {
    await api.delete(`/push/groups/${id}/`)
  },

  // Add members to a group
  addGroupMembers: async (groupId: string, userIds: string[]): Promise<NotificationGroup> => {
    const response = await api.post(`/push/groups/${groupId}/add_members/`, { user_ids: userIds })
    return response.data
  },

  // Remove members from a group
  removeGroupMembers: async (groupId: string, userIds: string[]): Promise<NotificationGroup> => {
    const response = await api.post(`/push/groups/${groupId}/remove_members/`, { user_ids: userIds })
    return response.data
  },

  // Send notification to a group
  sendToGroup: async (groupId: string, notification: { title: string; body: string; icon?: string; url?: string }): Promise<SendResult> => {
    const response = await api.post(`/push/groups/${groupId}/send_notification/`, notification)
    return response.data
  },

  // ============================================
  // Notification Schedules
  // ============================================
  
  // Get schedule choices (frequencies and weekdays)
  getScheduleChoices: async (): Promise<ScheduleChoices> => {
    const response = await api.get('/notifications/schedules/choices/')
    return response.data
  },

  // Get all schedules
  getSchedules: async (params?: { group?: string }): Promise<NotificationSchedule[]> => {
    const response = await api.get('/notifications/schedules/', { params })
    return response.data
  },

  // Get a single schedule
  getSchedule: async (id: string): Promise<NotificationSchedule> => {
    const response = await api.get(`/push/schedules/${id}/`)
    return response.data
  },

  // Create a schedule
  createSchedule: async (data: NotificationScheduleCreate): Promise<NotificationSchedule> => {
    const response = await api.post('/notifications/schedules/', data)
    return response.data
  },

  // Update a schedule
  updateSchedule: async (id: string, data: Partial<NotificationScheduleCreate>): Promise<NotificationSchedule> => {
    const response = await api.patch(`/push/schedules/${id}/`, data)
    return response.data
  },

  // Delete a schedule
  deleteSchedule: async (id: string): Promise<void> => {
    await api.delete(`/push/schedules/${id}/`)
  },

  // Send a scheduled notification now
  sendScheduleNow: async (scheduleId: string): Promise<SendResult> => {
    const response = await api.post(`/push/schedules/${scheduleId}/send_now/`)
    return response.data
  },

  // ============================================
  // Available Users
  // ============================================
  
  // Get users that can be added to groups
  getAvailableUsers: async (): Promise<AvailableUser[]> => {
    const response = await api.get('/notifications/available-users/')
    return response.data
  },

  // ============================================
  // Notification Inbox (User)
  // ============================================

  // Get all notifications for current user
  getInboxNotifications: async (): Promise<UserNotification[]> => {
    const response = await api.get('/notifications/inbox/')
    return response.data
  },

  // Get recent notifications (for dropdown, max 3)
  getRecentNotifications: async (limit: number = 3): Promise<NotificationInboxResponse> => {
    const response = await api.get('/notifications/inbox/recent/', { params: { limit } })
    return response.data
  },

  // Get notification count
  getNotificationCount: async (): Promise<NotificationCount> => {
    const response = await api.get('/notifications/inbox/count/')
    return response.data
  },

  // Mark single notification as read
  markNotificationRead: async (id: string): Promise<UserNotification> => {
    const response = await api.post(`/push/inbox/${id}/mark_read/`)
    return response.data
  },

  // Mark all notifications as read
  markAllNotificationsRead: async (): Promise<{ message: string; count: number }> => {
    const response = await api.post('/notifications/inbox/mark_all_read/')
    return response.data
  },

  // Clear all notifications
  clearAllNotifications: async (): Promise<{ message: string; count: number }> => {
    const response = await api.delete('/notifications/inbox/clear_all/')
    return response.data
  },

  // Clear only read notifications
  clearReadNotifications: async (): Promise<{ message: string; count: number }> => {
    const response = await api.delete('/notifications/inbox/clear_read/')
    return response.data
  },

  // ============================================
  // Sent Notifications (Admin)
  // ============================================

  // Get sent notifications history
  getSentNotifications: async (params?: {
    group?: string
    date_from?: string
    date_to?: string
  }): Promise<SentNotification[]> => {
    const response = await api.get('/notifications/sent/', { params })
    return response.data
  },

  // Get single sent notification with read receipts
  getSentNotification: async (id: string): Promise<SentNotification> => {
    const response = await api.get(`/push/sent/${id}/`)
    return response.data
  },

  // Get read receipts for a notification
  getReadReceipts: async (id: string): Promise<ReadReceipt[]> => {
    const response = await api.get(`/push/sent/${id}/read_receipts/`)
    return response.data
  },

  // Delete a single sent notification
  deleteSentNotification: async (id: string): Promise<void> => {
    await api.delete(`/push/sent/${id}/`)
  },

  // Delete multiple sent notifications
  bulkDeleteSentNotifications: async (ids: string[]): Promise<{ deleted_count: number; message: string }> => {
    const response = await api.post('/notifications/sent/bulk_delete/', { ids })
    return response.data
  },

  // Delete notifications older than X days
  clearOldNotifications: async (days: number): Promise<{ deleted_count: number; message: string }> => {
    const response = await api.post('/notifications/sent/clear_old/', { days })
    return response.data
  },
}

// Helper function to convert VAPID public key for Web Push
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Helper to check if push notifications are supported
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

// Helper to request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied'
  }
  return await Notification.requestPermission()
}

// Helper to get current notification permission
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied'
  }
  return Notification.permission
}
