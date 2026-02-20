/**
 * Spreadsheet Templates API service
 * CRUD operations for admin-configurable spreadsheet templates
 */
import api from './client'
import { SpreadsheetTemplate, PaginatedResponse } from '@/types'

export interface SpreadsheetTemplateFilters {
  page?: number
  page_size?: number
  search?: string
  ordering?: string
  is_active?: boolean
}

export interface SpreadsheetTemplateCreate {
  naam: string
  beschrijving?: string
  kolommen: SpreadsheetTemplate['kolommen']
  footer?: SpreadsheetTemplate['footer']
  standaard_tarieven?: SpreadsheetTemplate['standaard_tarieven']
  styling?: SpreadsheetTemplate['styling']
  is_active?: boolean
}

export interface SpreadsheetTemplateUpdate extends Partial<SpreadsheetTemplateCreate> {}

// List templates
export async function getSpreadsheetTemplates(
  filters?: SpreadsheetTemplateFilters,
): Promise<PaginatedResponse<SpreadsheetTemplate>> {
  const response = await api.get('/spreadsheets/templates/', { params: filters })
  return response.data
}

// Get single template
export async function getSpreadsheetTemplate(id: string): Promise<SpreadsheetTemplate> {
  const response = await api.get(`/spreadsheets/templates/${id}/`)
  return response.data
}

// Create template
export async function createSpreadsheetTemplate(
  data: SpreadsheetTemplateCreate,
): Promise<SpreadsheetTemplate> {
  const response = await api.post('/spreadsheets/templates/', data)
  return response.data
}

// Update template
export async function updateSpreadsheetTemplate(
  id: string,
  data: SpreadsheetTemplateUpdate,
): Promise<SpreadsheetTemplate> {
  const response = await api.patch(`/spreadsheets/templates/${id}/`, data)
  return response.data
}

// Delete template
export async function deleteSpreadsheetTemplate(id: string): Promise<void> {
  await api.delete(`/spreadsheets/templates/${id}/`)
}

// Duplicate template
export async function duplicateSpreadsheetTemplate(id: string): Promise<SpreadsheetTemplate> {
  const response = await api.post(`/spreadsheets/templates/${id}/duplicate/`)
  return response.data
}
