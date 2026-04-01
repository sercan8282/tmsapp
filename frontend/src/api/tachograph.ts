/**
 * Tachograph API service
 * FM-Track / Linqo tachograph data
 */
import api from './client'

export interface TachographTrip {
  start_time: string
  end_time: string
  start_km: number
  end_km: number
  distance_km: number
  duration_seconds: number
  duration_display: string
  drivers: { id: string; name: string }[]
  start_address: string
  end_address: string
}

export interface TachographVehicle {
  object_id: string
  vehicle_name: string
  vehicle_make: string
  vehicle_model: string
  plate_number: string
  first_start: string | null
  last_end: string | null
  first_km: number
  last_km: number
  total_km: number
  total_duration_seconds: number
  total_hours: number
  total_hours_display: string
  overtime_hours: number
  overtime_display: string | null
  has_overtime: boolean
  drivers: { id: string; name: string }[]
  trips: TachographTrip[]
  trip_count: number
}

export interface TachographOverview {
  date: string
  vehicles: TachographVehicle[]
  count: number
}

export interface TachographOvertimeRecord {
  id: string
  driver_id: string
  driver_naam: string
  date: string
  overtime_hours: number
  vehicle_name: string
  fm_driver_name: string
  created_at: string
}

export async function getTachographOverview(date: string): Promise<TachographOverview> {
  const response = await api.get(`/tracking/tachograph/?date=${date}`)
  return response.data
}

export async function writeOvertime(data: {
  driver_id: string
  date: string
  overtime_hours: number
  vehicle_name: string
  fm_driver_name: string
}): Promise<{ success: boolean; message: string; created: boolean }> {
  const response = await api.post('/tracking/tachograph/overtime/', data)
  return response.data
}

export async function getOvertimeList(params?: {
  driver_id?: string
  date_from?: string
  date_till?: string
}): Promise<{ results: TachographOvertimeRecord[]; count: number }> {
  const searchParams = new URLSearchParams()
  if (params?.driver_id) searchParams.append('driver_id', params.driver_id)
  if (params?.date_from) searchParams.append('date_from', params.date_from)
  if (params?.date_till) searchParams.append('date_till', params.date_till)
  const response = await api.get(`/tracking/tachograph/overtime/list/?${searchParams.toString()}`)
  return response.data
}

export interface TachoVehicle {
  object_id: string
  name: string
  plate_number: string
  make: string
  model: string
}

export async function getTachographVehicles(): Promise<{ vehicles: TachoVehicle[]; count: number }> {
  const response = await api.get('/tracking/tachograph/vehicles/')
  return response.data
}

export async function triggerTachographSync(force = false): Promise<{
  status: string
  reason?: string
  dates_processed?: number
  entries_created?: number
  overtime_created?: number
  force_resync?: boolean
  deleted_entries?: number
  deleted_overtime?: number
  deleted_logs?: number
}> {
  const response = await api.post('/tracking/tachograph/sync/', { force })
  return response.data
}
