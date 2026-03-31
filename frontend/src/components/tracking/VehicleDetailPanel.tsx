/**
 * Vehicle Detail Panel — Shows trip history & live info for a selected FM-Track vehicle.
 * Displayed below the map when a vehicle is selected on the Track & Trace page.
 */
import { useState, useEffect } from 'react'
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  MapPinIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { trackingApi, type VehicleDetail, type VehicleDetailTrip } from '@/api/tracking'

interface VehicleDetailPanelProps {
  objectId: string
  platNumber: string
  onClose: () => void
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(dtStr: string): string {
  if (!dtStr) return '-'
  const d = new Date(dtStr)
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function VehicleDetailPanel({ objectId, platNumber, onClose }: VehicleDetailPanelProps) {
  const [date, setDate] = useState(todayStr())
  const [detail, setDetail] = useState<VehicleDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isToday = date === todayStr()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await trackingApi.getVehicleDetail(objectId, date)
        if (!cancelled) setDetail(data)
      } catch {
        if (!cancelled) setError('Kan voertuiggegevens niet laden.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [objectId, date])

  const goBack = () => setDate(prev => shiftDate(prev, -1))
  const goForward = () => {
    if (!isToday) setDate(prev => shiftDate(prev, 1))
  }
  const goToday = () => setDate(todayStr())

  const statusLabels: Record<string, { label: string; color: string }> = {
    driving: { label: 'Rijdend', color: 'text-green-600' },
    idle: { label: 'Stationair', color: 'text-amber-600' },
    parked: { label: 'Geparkeerd', color: 'text-gray-500' },
  }

  const pos = detail?.current_position
  const statusInfo = pos ? statusLabels[pos.vehicle_status] || statusLabels.parked : null

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <MapPinIcon className="h-5 w-5 text-primary-600 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {detail?.vehicle?.plate_number || platNumber}
            </h3>
            {detail?.vehicle && (
              <p className="text-xs text-gray-500 truncate">
                {detail.vehicle.make} {detail.vehicle.model}
              </p>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Date navigation */}
      <div className="px-4 py-2 border-b flex items-center justify-between bg-white">
        <button onClick={goBack} className="p-1 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100">
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 capitalize">{formatDate(date)}</span>
          {!isToday && (
            <button
              onClick={goToday}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              Vandaag
            </button>
          )}
        </div>
        <button
          onClick={goForward}
          disabled={isToday}
          className={`p-1 rounded hover:bg-gray-100 ${isToday ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="p-6 flex items-center justify-center">
          <ArrowPathIcon className="h-5 w-5 animate-spin text-primary-600" />
          <span className="ml-2 text-sm text-gray-500">Laden...</span>
        </div>
      )}

      {error && (
        <div className="p-4 text-sm text-red-600 flex items-center gap-2">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Content */}
      {!loading && !error && detail && (
        <div className="divide-y">
          {/* Summary cards */}
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Current speed / status */}
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Snelheid</p>
              <p className="text-lg font-bold text-gray-900">
                {pos && pos.speed > 0 ? `${Math.round(pos.speed)}` : '0'}
                <span className="text-xs font-normal text-gray-500 ml-0.5">km/h</span>
              </p>
              {statusInfo && isToday && (
                <p className={`text-xs font-medium mt-0.5 ${statusInfo.color}`}>
                  {statusInfo.label}
                </p>
              )}
            </div>

            {/* Odometer */}
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Km-stand</p>
              <p className="text-lg font-bold text-gray-900">
                {detail.odometer_km > 0
                  ? detail.odometer_km.toLocaleString('nl-NL')
                  : '-'
                }
                <span className="text-xs font-normal text-gray-500 ml-0.5">km</span>
              </p>
            </div>

            {/* Day distance */}
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Gereden</p>
              <p className="text-lg font-bold text-gray-900">
                {detail.total_distance_km}
                <span className="text-xs font-normal text-gray-500 ml-0.5">km</span>
              </p>
            </div>

            {/* Day duration */}
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Rijtijd</p>
              <p className="text-lg font-bold text-gray-900">
                {detail.total_duration_display || '00:00'}
              </p>
              <p className="text-xs text-gray-400">{detail.trip_count} rit(ten)</p>
            </div>
          </div>

          {/* Max speed banner */}
          {detail.max_speed > 0 && (
            <div className={`px-4 py-2 flex items-center gap-2 text-sm ${detail.max_speed > 130 ? 'bg-red-50' : 'bg-gray-50'}`}>
              <span className="text-gray-600">Max snelheid:</span>
              <span className={`font-bold ${detail.max_speed > 130 ? 'text-red-600' : 'text-gray-900'}`}>
                {detail.max_speed} km/h
              </span>
              {detail.max_speed > 130 && (
                <span className="text-xs text-red-500 flex items-center gap-1">
                  <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                  Snelheidsoverschrijding
                </span>
              )}
            </div>
          )}

          {/* Fuel info (only on today) */}
          {isToday && pos && pos.fuel_level > 0 && (
            <div className="px-4 py-2 flex items-center gap-3 bg-gray-50">
              <span className="text-sm text-gray-600">⛽ Brandstof:</span>
              <div className="flex items-center gap-2 flex-1">
                <div className="flex-1 h-2 bg-gray-200 rounded-full max-w-[120px]">
                  <div
                    className={`h-2 rounded-full ${pos.fuel_level > 25 ? 'bg-green-500' : pos.fuel_level > 10 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(pos.fuel_level, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700">{Math.round(pos.fuel_level)}%</span>
                {pos.fuel_remaining_km && (
                  <span className="text-xs text-gray-400">~{pos.fuel_remaining_km} km</span>
                )}
              </div>
            </div>
          )}

          {/* Current location (only on today) */}
          {isToday && pos && pos.address && (
            <div className="px-4 py-2 flex items-center gap-2 text-sm text-gray-600 bg-gray-50">
              <MapPinIcon className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="truncate">{pos.address}</span>
            </div>
          )}

          {/* Trip table */}
          <div className="p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-gray-500" />
              Ritten ({detail.trip_count})
            </h4>

            {detail.trips.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Geen ritten op deze dag
              </p>
            ) : (
              <div className="space-y-2">
                {detail.trips.map((trip: VehicleDetailTrip, idx: number) => (
                  <TripRow key={idx} trip={trip} index={idx + 1} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TripRow({ trip, index }: { trip: VehicleDetailTrip; index: number }) {
  return (
    <div className={`rounded-lg border p-3 ${trip.is_speeding ? 'border-red-200 bg-red-50/50' : 'border-gray-100 bg-gray-50'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-gray-400 shrink-0">#{index}</span>
          <span className="text-xs text-gray-500">
            {formatTime(trip.start_time)} → {formatTime(trip.end_time)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500">{trip.duration_display}</span>
          <span className="text-xs font-medium text-gray-700">{trip.distance_km} km</span>
        </div>
      </div>

      {/* Route A → B */}
      <div className="flex items-start gap-2 text-xs">
        <div className="flex flex-col items-center mt-0.5 shrink-0">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <div className="w-px h-4 bg-gray-300" />
          <div className="h-2 w-2 rounded-full bg-red-500" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-gray-700 truncate">{trip.start_address || 'Onbekend'}</p>
          <p className="text-gray-700 truncate">{trip.end_address || 'Onbekend'}</p>
        </div>
      </div>

      {/* Speed + km stand */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200/50">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>📍 {trip.start_km.toLocaleString('nl-NL')} → {trip.end_km.toLocaleString('nl-NL')} km</span>
        </div>
        {trip.max_speed > 0 && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trip.is_speeding ? 'text-red-600' : 'text-gray-600'}`}>
            {trip.is_speeding && <ExclamationTriangleIcon className="h-3.5 w-3.5" />}
            <span>Max {trip.max_speed} km/h</span>
          </div>
        )}
      </div>
    </div>
  )
}
