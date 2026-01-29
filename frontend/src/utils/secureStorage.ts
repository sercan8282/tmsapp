/**
 * Secure Storage Utility
 * Provides encrypted localStorage for sensitive data
 * 
 * Uses AES-GCM encryption via Web Crypto API
 * The encryption key is derived from a combination of:
 * - App-specific salt
 * - Browser fingerprint (to prevent copying data between browsers)
 */

// App-specific salt (not secret, just adds uniqueness)
const APP_SALT = 'tms-v1-secure-storage'

// Generate a browser fingerprint (non-sensitive, just for key derivation)
async function getBrowserFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
  ]
  
  // Create a hash of the components
  const data = components.join('|')
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Derive encryption key from fingerprint and salt
async function deriveKey(fingerprint: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(fingerprint + APP_SALT),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(APP_SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// Encrypt data
async function encryptData(data: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  )
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encryptedBuffer), iv.length)
  
  // Convert to base64
  return btoa(String.fromCharCode(...combined))
}

// Decrypt data
async function decryptData(encryptedData: string, key: CryptoKey): Promise<string> {
  try {
    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12)
    const data = combined.slice(12)
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    )
    
    const decoder = new TextDecoder()
    return decoder.decode(decryptedBuffer)
  } catch {
    throw new Error('Decryption failed - data may be corrupted or from different browser')
  }
}

// Cache the encryption key
let cachedKey: CryptoKey | null = null

async function getKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    const fingerprint = await getBrowserFingerprint()
    cachedKey = await deriveKey(fingerprint)
  }
  return cachedKey
}

/**
 * Secure Storage API
 */
export const secureStorage = {
  /**
   * Store encrypted data
   */
  async setItem(key: string, value: unknown): Promise<void> {
    try {
      const cryptoKey = await getKey()
      const jsonValue = JSON.stringify(value)
      const encrypted = await encryptData(jsonValue, cryptoKey)
      localStorage.setItem(`secure_${key}`, encrypted)
    } catch (error) {
      console.error('SecureStorage setItem failed:', error)
      // Fallback to regular storage in development
      if (import.meta.env.DEV) {
        localStorage.setItem(key, JSON.stringify(value))
      }
    }
  },
  
  /**
   * Retrieve and decrypt data
   */
  async getItem<T>(key: string): Promise<T | null> {
    try {
      const encrypted = localStorage.getItem(`secure_${key}`)
      if (!encrypted) return null
      
      const cryptoKey = await getKey()
      const decrypted = await decryptData(encrypted, cryptoKey)
      return JSON.parse(decrypted) as T
    } catch (error) {
      console.error('SecureStorage getItem failed:', error)
      // Try fallback for development
      if (import.meta.env.DEV) {
        const value = localStorage.getItem(key)
        return value ? JSON.parse(value) : null
      }
      return null
    }
  },
  
  /**
   * Remove item
   */
  removeItem(key: string): void {
    localStorage.removeItem(`secure_${key}`)
    localStorage.removeItem(key) // Also remove unencrypted version if exists
  },
  
  /**
   * Clear all secure storage
   */
  clear(): void {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('secure_')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  },
  
  /**
   * Check if Web Crypto is available
   */
  isSupported(): boolean {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.subtle.encrypt === 'function'
  }
}

/**
 * Create a Zustand persist storage adapter using secure storage
 */
export const createSecureStorage = () => ({
  getItem: async (name: string): Promise<string | null> => {
    const value = await secureStorage.getItem<unknown>(name)
    return value ? JSON.stringify(value) : null
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await secureStorage.setItem(name, JSON.parse(value))
  },
  removeItem: (name: string): void => {
    secureStorage.removeItem(name)
  },
})
