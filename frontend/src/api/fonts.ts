/**
 * Fonts API
 * Manages custom font uploads and retrieval
 */
import api from './client'

export interface CustomFont {
  id: string
  family: string
  name: string
  font_url: string
  weight: number
  weight_display: string
  style: 'normal' | 'italic'
  style_display: string
  file_format: string
  css_format: string
  is_system: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FontFamily {
  family: string
  fonts: CustomFont[]
}

export interface CreateFontData {
  family: string
  name: string
  font_file: File
  weight: number
  style: 'normal' | 'italic'
}

export const fontsApi = {
  /**
   * Get all fonts
   */
  async getAll(): Promise<CustomFont[]> {
    const response = await api.get('/core/fonts/')
    return response.data.results || response.data
  },

  /**
   * Get font by ID
   */
  async getById(id: string): Promise<CustomFont> {
    const response = await api.get(`/core/fonts/${id}/`)
    return response.data
  },

  /**
   * Get all font families with their variants
   */
  async getFamilies(): Promise<FontFamily[]> {
    const response = await api.get('/core/fonts/families/')
    return response.data
  },

  /**
   * Get CSS for all fonts (for dynamic loading)
   */
  async getCss(): Promise<string> {
    const response = await api.get('/core/fonts/css/', {
      responseType: 'text',
    })
    return response.data
  },

  /**
   * Upload a new font
   */
  async upload(data: CreateFontData): Promise<CustomFont> {
    const formData = new FormData()
    formData.append('family', data.family)
    formData.append('name', data.name)
    formData.append('font_file', data.font_file)
    formData.append('weight', data.weight.toString())
    formData.append('style', data.style)

    const response = await api.post('/core/fonts/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  /**
   * Update font metadata
   */
  async update(id: string, data: Partial<Pick<CustomFont, 'family' | 'name' | 'is_active'>>): Promise<CustomFont> {
    const response = await api.patch(`/core/fonts/${id}/`, data)
    return response.data
  },

  /**
   * Delete a font
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/core/fonts/${id}/`)
  },
}
