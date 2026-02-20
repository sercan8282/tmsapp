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
  mfa_required: boolean
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
  requires_2fa_setup?: boolean
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
  login_background_color: string
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
  smtp_password?: string // Write-only
  smtp_use_tls: boolean
  smtp_from_email: string
  oauth_enabled: boolean
  oauth_client_id: string
  oauth_client_secret?: string // Write-only
  oauth_tenant_id: string
  invoice_payment_text: string
  invoice_start_number_verkoop: number
  invoice_start_number_inkoop: number
  invoice_start_number_credit: number
  email_signature: string
  // AI Settings
  ai_provider: 'github' | 'openai' | 'azure' | 'none'
  ai_github_token?: string // Write-only
  ai_openai_api_key?: string // Write-only
  ai_azure_endpoint?: string
  ai_azure_api_key?: string // Write-only
  ai_azure_deployment?: string
  ai_model?: string
  ai_status?: {
    configured: boolean
    provider?: string
    message: string
  }
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
  mailing_contacts: MailingListContact[]
  mailing_contacts_count: number
  created_at: string
  updated_at: string
}

export interface MailingListContact {
  id: string
  bedrijf: string
  naam: string
  email: string
  functie: string
  is_active: boolean
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
  gekoppelde_gebruiker_naam: string | null
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
  user_bedrijf?: string
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

// Template Field Types
export type TemplateFieldType = 'text' | 'image' | 'amount' | 'date' | 'variable'
export type TextAlignment = 'left' | 'center' | 'right'

export interface TemplateFieldStyle {
  alignment: TextAlignment
  bold: boolean
  italic: boolean
  color: string
  fontFamily: string
  fontSize: number
}

export interface TemplateField {
  id: string
  type: TemplateFieldType
  content: string // tekst of variabele naam
  style: TemplateFieldStyle
  imageUrl?: string
  imageWidth?: number // pixels
  imageHeight?: number // pixels
}

// Section with 3 columns (header, subheader, footer)
export interface TemplateSection {
  left: TemplateField | null
  center: TemplateField | null
  right: TemplateField | null
}

// Table column types
export type ColumnType = 'text' | 'aantal' | 'km' | 'uren' | 'prijs' | 'btw' | 'percentage' | 'berekend'

export interface TemplateColumn {
  id: string  // unieke naam voor berekeningen
  naam: string // display naam
  type: ColumnType
  breedte: number // percentage
  // Voor berekende kolommen
  formule?: string // bijv. "kolom_a * kolom_b" of "kolom_c * 0.21"
}

// Standaard tarieven
export interface TemplateDefaults {
  uurtarief: number
  dotPrijs: number
  dotIsPercentage: boolean
  kmTarief: number
}

// Footer totalen configuratie
export interface TemplateTotals {
  showSubtotaal: boolean
  showBtw: boolean
  showTotaal: boolean
  btwPercentage: number
}

// Tabel styling configuratie
export interface TemplateTableStyle {
  headerBackground: string
  headerTextColor: string
  headerFont: string
  evenRowBackground: string
  oddRowBackground: string
  rowTextColor: string
  rowFont: string
}

// Volledige template layout
export interface TemplateLayout {
  header: TemplateSection
  subheader: TemplateSection
  columns: TemplateColumn[]
  footer: TemplateSection
  defaults: TemplateDefaults
  totals: TemplateTotals
  tableStyle?: TemplateTableStyle
}

export interface InvoiceTemplate {
  id: string
  naam: string
  beschrijving: string
  layout: TemplateLayout
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
  week_number: number | null
  week_year: number | null
  chauffeur: string | null
  chauffeur_naam: string | null
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

// Spreadsheet types
export interface SpreadsheetRij {
  ritnr: string
  volgnummer: string
  chauffeur: string
  datum: string
  begin_tijd: number | null
  eind_tijd: number | null
  pauze: number | null
  correctie: number | null
  begin_km: number | null
  eind_km: number | null
  overnachting: number | null
  overige_kosten: number | null
}

export interface Spreadsheet {
  id: string
  naam: string
  bedrijf: string
  bedrijf_naam: string
  week_nummer: number
  jaar: number
  tarief_per_uur: number
  tarief_per_km: number
  tarief_dot: number
  rijen: SpreadsheetRij[]
  notities: string
  totaal_factuur: number
  created_by: string | null
  created_by_naam: string | null
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
