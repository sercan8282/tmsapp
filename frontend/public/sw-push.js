/**
 * Custom Service Worker for Push Notifications
 * This file is injected into the generated service worker by VitePWA
 */

// Push notification event handler
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received:', event)
  
  if (!event.data) {
    console.log('[SW] Push event has no data')
    return
  }

  try {
    const data = event.data.json()
    console.log('[SW] Push data:', data)

    const options = {
      body: data.body || 'Nieuwe notificatie',
      icon: data.icon || '/icons/icon-192x192.svg',
      badge: data.badge || '/icons/badge-72x72.svg',
      vibrate: [100, 50, 100],
      data: {
        url: data.data?.url || '/',
        ...data.data,
      },
      actions: data.actions || [],
      tag: data.tag || 'tms-notification',
      renotify: true,
      requireInteraction: data.requireInteraction || false,
    }

    event.waitUntil(
      self.registration.showNotification(data.title || 'TMS Notificatie', options)
    )
  } catch (err) {
    console.error('[SW] Error handling push event:', err)
    
    // Fallback: show simple notification
    event.waitUntil(
      self.registration.showNotification('TMS Notificatie', {
        body: event.data.text() || 'Nieuwe notificatie',
        icon: '/icons/icon-192x192.svg',
      })
    )
  }
})

// Notification click event handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event)
  
  event.notification.close()

  // Get URL from notification data
  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window/tab open with the app
      for (const client of windowClients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          // Navigate existing window to the URL and focus it
          client.navigate(urlToOpen)
          return client.focus()
        }
      }
      
      // If no existing window, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

// Notification close event handler
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event)
})

// Push subscription change event handler
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed:', event)
  
  // Re-subscribe with the new subscription
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription?.options || {
      userVisibleOnly: true,
    }).then((subscription) => {
      // Send new subscription to backend
      // Note: This requires the auth token to be stored in IndexedDB or similar
      console.log('[SW] New subscription:', subscription)
    }).catch((err) => {
      console.error('[SW] Failed to re-subscribe:', err)
    })
  )
})

console.log('[SW] Push notification handlers registered')
