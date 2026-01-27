/**
 * Invoicing API service
 * CRUD operations for invoice management
 */
import api from './client'
import { Invoice, InvoiceTemplate, InvoiceLine } from '@/types'

// Types
export interface InvoiceCreate {
  template: string
  bedrijf: string
  type: 'inkoop' | 'verkoop' | 'credit'
  factuurdatum: string
  vervaldatum: string
  btw_percentage?: number
  opmerkingen?: string
}

export interface InvoiceUpdate {
  status?: 'concept' | 'definitief' | 'verzonden' | 'betaald'
  btw_percentage?: number
  opmerkingen?: string
  vervaldatum?: string
}

export interface InvoiceLineCreate {
  invoice: string
  omschrijving: string
  aantal: number
  eenheid?: string
  prijs_per_eenheid: number
  time_entry?: string | null
}

export interface InvoiceLineUpdate {
  omschrijving?: string
  aantal?: number
  eenheid?: string
  prijs_per_eenheid?: number
}

export interface InvoicesResponse {
  count: number
  next: string | null
  previous: string | null
  results: Invoice[]
}

export interface InvoiceFilters {
  type?: 'inkoop' | 'verkoop' | 'credit'
  status?: 'concept' | 'definitief' | 'verzonden' | 'betaald'
  bedrijf?: string
  search?: string
  page?: number
  page_size?: number
  ordering?: string
}

export interface TemplatesResponse {
  count: number
  next: string | null
  previous: string | null
  results: InvoiceTemplate[]
}

// Invoice Templates API

export async function getTemplates(activeOnly = true): Promise<TemplatesResponse> {
  const params = activeOnly ? '?is_active=true' : ''
  const response = await api.get(`/invoicing/templates/${params}`)
  return response.data
}

export async function getTemplate(id: string): Promise<InvoiceTemplate> {
  const response = await api.get(`/invoicing/templates/${id}/`)
  return response.data
}

// Invoices API

export async function getInvoices(filters?: InvoiceFilters): Promise<InvoicesResponse> {
  const params = new URLSearchParams()
  
  if (filters?.type) params.append('type', filters.type)
  if (filters?.status) params.append('status', filters.status)
  if (filters?.bedrijf) params.append('bedrijf', filters.bedrijf)
  if (filters?.search) params.append('search', filters.search)
  if (filters?.page) params.append('page', filters.page.toString())
  if (filters?.page_size) params.append('page_size', filters.page_size.toString())
  if (filters?.ordering) params.append('ordering', filters.ordering)
  
  const response = await api.get(`/invoicing/invoices/?${params.toString()}`)
  return response.data
}

export async function getInvoice(id: string): Promise<Invoice> {
  const response = await api.get(`/invoicing/invoices/${id}/`)
  return response.data
}

export async function createInvoice(data: InvoiceCreate): Promise<Invoice> {
  const response = await api.post('/invoicing/invoices/', data)
  return response.data
}

export async function updateInvoice(id: string, data: InvoiceUpdate): Promise<Invoice> {
  const response = await api.patch(`/invoicing/invoices/${id}/`, data)
  return response.data
}

export async function deleteInvoice(id: string): Promise<void> {
  await api.delete(`/invoicing/invoices/${id}/`)
}

// Invoice actions

export async function recalculateInvoice(id: string): Promise<Invoice> {
  const response = await api.post(`/invoicing/invoices/${id}/recalculate/`)
  return response.data
}

export async function markDefinitief(id: string): Promise<Invoice> {
  const response = await api.post(`/invoicing/invoices/${id}/mark_definitief/`)
  return response.data
}

export async function markVerzonden(id: string): Promise<Invoice> {
  const response = await api.post(`/invoicing/invoices/${id}/mark_verzonden/`)
  return response.data
}

export async function markBetaald(id: string): Promise<Invoice> {
  const response = await api.post(`/invoicing/invoices/${id}/mark_betaald/`)
  return response.data
}

export async function generatePdf(id: string): Promise<{ message: string }> {
  const response = await api.post(`/invoicing/invoices/${id}/generate_pdf/`)
  return response.data
}

export async function sendInvoiceEmail(id: string): Promise<{ message: string }> {
  const response = await api.post(`/invoicing/invoices/${id}/send_email/`)
  return response.data
}

// Invoice Lines API

export async function getInvoiceLines(invoiceId: string): Promise<InvoiceLine[]> {
  const response = await api.get(`/invoicing/lines/?invoice=${invoiceId}`)
  return response.data.results || response.data
}

export async function createInvoiceLine(data: InvoiceLineCreate): Promise<InvoiceLine> {
  const response = await api.post('/invoicing/lines/', data)
  return response.data
}

export async function updateInvoiceLine(id: string, data: InvoiceLineUpdate): Promise<InvoiceLine> {
  const response = await api.patch(`/invoicing/lines/${id}/`, data)
  return response.data
}

export async function deleteInvoiceLine(id: string): Promise<void> {
  await api.delete(`/invoicing/lines/${id}/`)
}
