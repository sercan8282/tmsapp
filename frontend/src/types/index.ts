// User types
export interface User {
  id: string
  email: string
  username: string
  voornaam: string
  achternaam: string
  full_name: string
  telefoon: string
  bedrijf: string
  rol: 'admin' | 'gebruiker' | 'chauffeur'
  mfa_enabled: boolean
  is_active: boolean
  date_joined: string
  last_login: string | null
}

export interface UserCreate {
  email: string
  username: string
  password: string
  password_confirm: string
  voornaam: string
  achternaam: string
  telefoon?: string
  bedrijf?: string
  rol: 'admin' | 'gebruiker' | 'chauffeur'
  is_active?: boolean
}

// Auth types
export interface LoginCredentials {
  email: string
  password: string
}

export interface LoginResponse {
  access: string
  refresh: string
  user: User
  requires_2fa?: boolean
  user_id?: string
}

export interface MFAVerifyData {
  user_id: string
  code: string
}

// App Settings
export interface AppSettings {
  app_name: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  company_name: string
}

export interface AppSettingsAdmin extends AppSettings {
  company_address: string
  company_phone: string
  company_email: string
  company_kvk: string
  company_btw: string
  company_iban: string
  smtp_host: string
  smtp_port: number
  smtp_username: string
  smtp_use_tls: boolean
  smtp_from_email: string
  oauth_enabled: boolean
  oauth_client_id: string
  oauth_tenant_id: string
}

// Company types
export interface Company {
  id: string
  naam: string
  kvk: string
  telefoon: string
  contactpersoon: string
  email: string
  adres: string
  postcode: string
  stad: string
  created_at: string
  updated_at: string
}

// Driver types
export interface Driver {
  id: string
  naam: string
  telefoon: string
  bedrijf: string | null
  bedrijf_naam: string | null
  gekoppelde_gebruiker: string | null
  gebruiker_naam: string | null
  adr: boolean
  created_at: string
  updated_at: string
}

// Vehicle types
export interface Vehicle {
  id: string
  kenteken: string
  type_wagen: string
  ritnummer: string
  bedrijf: string
  bedrijf_naam: string
  created_at: string
  updated_at: string
}

// Time Entry types
export interface TimeEntry {
  id: string
  user: string
  user_naam: string
  weeknummer: number
  ritnummer: string
  datum: string
  kenteken: string
  km_start: number
  km_eind: number
  totaal_km: number
  aanvang: string
  eind: string
  pauze: string
  totaal_uren: string
  totaal_uren_display: string
  status: 'concept' | 'ingediend'
  created_at: string
  updated_at: string
}

// Planning types
export interface WeekPlanning {
  id: string
  bedrijf: string
  bedrijf_naam: string
  weeknummer: number
  jaar: number
  entries: PlanningEntry[]
  created_at: string
  updated_at: string
}

export interface PlanningEntry {
  id: string
  planning: string
  vehicle: string
  vehicle_kenteken: string
  vehicle_type: string
  vehicle_ritnummer: string
  dag: 'ma' | 'di' | 'wo' | 'do' | 'vr'
  dag_display: string
  chauffeur: string | null
  chauffeur_naam: string | null
  telefoon: string
  adr: boolean
  created_at: string
  updated_at: string
}

// Invoice types
export interface InvoiceTemplate {
  id: string
  naam: string
  beschrijving: string
  layout: Record<string, unknown>
  variables: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  factuurnummer: string
  type: 'inkoop' | 'verkoop' | 'credit'
  status: 'concept' | 'definitief' | 'verzonden' | 'betaald'
  template: string
  template_naam: string
  bedrijf: string
  bedrijf_naam: string
  factuurdatum: string
  vervaldatum: string
  subtotaal: number
  btw_percentage: number
  btw_bedrag: number
  totaal: number
  opmerkingen: string
  pdf_file: string | null
  created_by: string
  created_by_naam: string
  sent_at: string | null
  lines: InvoiceLine[]
  created_at: string
  updated_at: string
}

export interface InvoiceLine {
  id: string
  invoice: string
  omschrijving: string
  aantal: number
  eenheid: string
  prijs_per_eenheid: number
  totaal: number
  time_entry: string | null
  extra_data: Record<string, unknown>
  volgorde: number
  created_at: string
  updated_at: string
}

// API Response types
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiError {
  detail?: string
  message?: string
  [key: string]: unknown
}
