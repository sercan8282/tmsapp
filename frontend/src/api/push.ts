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
}

export interface VapidKeys {
  public_key: string
  private_key: string
}

export interface PushConfig {
  is_configured: boolean
  provider: 'none' | 'webpush' | 'firebase'
  public_key?: string
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

export const pushApi = {
  // Admin: Get push settings
  getSettings: async (): Promise<PushSettings> => {
    const response = await api.get('/push/settings/')
    return response.data
  },

  // Admin: Update push settings
  updateSettings: async (data: PushSettingsUpdate): Promise<PushSettings> => {
    const response = await api.patch('/push/settings/', data)
    return response.data
  },

  // Admin: Generate VAPID keys
  generateVapidKeys: async (): Promise<VapidKeys> => {
    const response = await api.post('/push/settings/generate-vapid-keys/')
    return response.data
  },

  // Public: Get push config (for subscribing)
  getConfig: async (): Promise<PushConfig> => {
    const response = await api.get('/push/config/')
    return response.data
  },

  // User: Subscribe to push notifications
  subscribe: async (subscription: PushSubscriptionJSON, deviceName?: string): Promise<PushSubscription> => {
    const response = await api.post('/push/subscriptions/', {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      device_name: deviceName,
    })
    return response.data
  },

  // User: Unsubscribe from push notifications
  unsubscribe: async (endpoint: string): Promise<void> => {
    await api.post('/push/subscriptions/unsubscribe/', { endpoint })
  },

  // User: Get subscription status
  getSubscriptionStatus: async (): Promise<SubscriptionStatus> => {
    const response = await api.get('/push/subscriptions/status/')
    return response.data
  },

  // User: Get my subscriptions
  getMySubscriptions: async (): Promise<PushSubscription[]> => {
    const response = await api.get('/push/subscriptions/')
    return response.data
  },

  // User: Delete a subscription
  deleteSubscription: async (id: string): Promise<void> => {
    await api.delete(`/push/subscriptions/${id}/`)
  },

  // Admin: Send push notification
  send: async (data: SendNotification): Promise<SendResult> => {
    const response = await api.post('/push/send/', data)
    return response.data
  },

  // Admin: Get notification logs
  getLogs: async (params?: { recipient?: string }): Promise<PushNotificationLog[]> => {
    const response = await api.get('/push/logs/', { params })
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
