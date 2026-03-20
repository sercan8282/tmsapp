/**
 * useGPSTracking hook — manages browser Geolocation API for GPS tracking.
 * 
 * Security:
 * - Requires explicit user permission (browser prompt)
 * - Only sends location when tracking is active
 * - Buffers offline points for retry
 * - Validates GPS accuracy before sending
 * - Uses HTTPS-only API calls (via JWT)
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { trackingApi, type LocationSubmitData } from '@/api/tracking'

interface GPSState {
  isTracking: boolean
  isWatchingGPS: boolean
  lastPosition: GeolocationPosition | null
  error: string | null
  pointsSent: number
  pointsBuffered: number
  accuracy: number | null
}

interface UseGPSTrackingOptions {
  /** Minimum interval between location submissions in ms (default: 10000 = 10s) */
  minInterval?: number
  /** Maximum GPS accuracy to accept in meters (default: 100) */
  maxAccuracy?: number
  /** Enable high accuracy mode (GPS vs WiFi) */
  highAccuracy?: boolean
}

export function useGPSTracking(options: UseGPSTrackingOptions = {}) {
  const {
    minInterval = 10000,
    maxAccuracy = 100,
    highAccuracy = true,
  } = options

  const [state, setState] = useState<GPSState>({
    isTracking: false,
    isWatchingGPS: false,
    lastPosition: null,
    error: null,
    pointsSent: 0,
    pointsBuffered: 0,
    accuracy: null,
  })

  const watchIdRef = useRef<number | null>(null)
  const bufferRef = useRef<LocationSubmitData[]>([])
  const lastSentRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const firstPointSentRef = useRef(false)

  const sendBufferedPoints = useCallback(async () => {
    if (bufferRef.current.length === 0) return

    const pointsToSend = [...bufferRef.current]
    bufferRef.current = []

    try {
      if (pointsToSend.length === 1) {
        await trackingApi.submitLocation(pointsToSend[0])
      } else {
        await trackingApi.submitLocationBatch(pointsToSend)
      }
      setState(prev => ({
        ...prev,
        pointsSent: prev.pointsSent + pointsToSend.length,
        pointsBuffered: bufferRef.current.length,
        error: null,
      }))
    } catch (err: any) {
      // Put points back in buffer for retry
      bufferRef.current = [...pointsToSend, ...bufferRef.current]
      // Keep buffer manageable — drop oldest if > 500
      if (bufferRef.current.length > 500) {
        bufferRef.current = bufferRef.current.slice(-500)
      }
      setState(prev => ({
        ...prev,
        pointsBuffered: bufferRef.current.length,
        error: err.response?.status === 429 ? 'Rate limited' : 'Send failed, buffering...',
      }))
    }
  }, [])

  const handlePosition = useCallback((position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, speed, heading, altitude } = position.coords
    const now = Date.now()

    setState(prev => ({
      ...prev,
      lastPosition: position,
      isWatchingGPS: true,
      accuracy: accuracy,
      error: null,
    }))

    // Skip if accuracy is too poor
    if (accuracy > maxAccuracy) return

    // Throttle: skip if too soon since last send
    if (now - lastSentRef.current < minInterval) return
    lastSentRef.current = now

    const locationData: LocationSubmitData = {
      latitude,
      longitude,
      accuracy,
      speed: speed !== null ? Math.round(speed * 3.6 * 10) / 10 : null, // m/s -> km/h
      heading,
      altitude,
      recorded_at: new Date(position.timestamp).toISOString(),
    }

    bufferRef.current.push(locationData)
    setState(prev => ({
      ...prev,
      pointsBuffered: bufferRef.current.length,
    }))

    // Send first point immediately so user sees their position right away
    if (!firstPointSentRef.current) {
      firstPointSentRef.current = true
      sendBufferedPoints()
    }
  }, [maxAccuracy, minInterval, sendBufferedPoints])

  const handleError = useCallback((error: GeolocationPositionError) => {
    let message: string
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = 'Location permission denied'
        break
      case error.POSITION_UNAVAILABLE:
        message = 'Location unavailable'
        break
      case error.TIMEOUT:
        message = 'Location request timed out'
        break
      default:
        message = 'Unknown GPS error'
    }
    setState(prev => ({ ...prev, error: message, isWatchingGPS: false }))
  }, [])

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, error: 'Geolocation not supported' }))
      return
    }

    // Start watching position
    const watchId = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: highAccuracy,
        maximumAge: 5000,
        timeout: 30000,
      },
    )
    watchIdRef.current = watchId

    // Start periodic buffer flush (every 3s for responsive tracking)
    const interval = setInterval(sendBufferedPoints, 3000)
    intervalRef.current = interval

    setState(prev => ({
      ...prev,
      isTracking: true,
      error: null,
      pointsSent: 0,
      pointsBuffered: 0,
    }))
    bufferRef.current = []
    lastSentRef.current = 0
    firstPointSentRef.current = false
  }, [handlePosition, handleError, highAccuracy, sendBufferedPoints])

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Final flush
    sendBufferedPoints()

    setState(prev => ({
      ...prev,
      isTracking: false,
      isWatchingGPS: false,
    }))
  }, [sendBufferedPoints])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    ...state,
    startTracking,
    stopTracking,
  }
}
