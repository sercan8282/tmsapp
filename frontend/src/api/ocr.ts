import api from './client';

// Types
export interface InvoiceImport {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  original_file_url?: string;
  status: 'pending' | 'processing' | 'extracted' | 'review' | 'completed' | 'failed';
  error_message?: string;
  ocr_text?: string;
  ocr_confidence?: number;
  extracted_data?: ExtractedData;
  user_corrections?: Record<string, unknown>;
  uploaded_by_name?: string;
  pattern_name?: string;
  lines: ImportedLine[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface ExtractedData {
  fields: Record<string, unknown>;
  line_items: LineItem[];
  ocr_pages: OCRPage[];
}

export interface OCRPage {
  page_number: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
  lines: OCRLine[];
  image_path?: string;
}

export interface OCRLine {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  words: OCRWord[];
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface LineItem {
  raw_text: string;
  numbers_found?: string[];
  position?: BoundingBox;
}

export interface ImportedLine {
  id: string;
  omschrijving: string;
  aantal?: number;
  eenheid?: string;
  prijs_per_eenheid?: number;
  totaal?: number;
  btw_percentage?: number;
  raw_text: string;
  position: BoundingBox;
  volgorde: number;
  is_verified: boolean;
}

export interface InvoicePattern {
  id: string;
  name: string;
  description?: string;
  company: string;
  company_name?: string;
  is_active: boolean;
  visual_signature?: Record<string, unknown>;
  times_used: number;
  times_corrected: number;
  accuracy_score: number;
  field_mappings: FieldMapping[];
  created_at: string;
  last_used_at?: string;
}

export interface FieldMapping {
  id: string;
  field_type: string;
  field_type_display: string;
  extraction_method: string;
  extraction_method_display: string;
  config: Record<string, unknown>;
  data_type: string;
  validation_rules?: Record<string, unknown>;
  correct_extractions: number;
  incorrect_extractions: number;
  accuracy: number;
  priority: number;
  is_active: boolean;
}

export interface UploadResponse {
  id: string;
  file_name: string;
  status: string;
  extracted_data?: ExtractedData;
}

export interface CorrectionData {
  corrections: Record<string, { value: unknown; region?: BoundingBox }>;
  create_pattern?: boolean;
  pattern_name?: string;
  pattern_keywords?: string[];
  company_id?: string;
}

export interface RegionExtractionResult {
  text: string;
  region: BoundingBox;
}

export interface ConvertToInvoiceData {
  invoice_type: 'inkoop' | 'verkoop' | 'credit';
  template_id?: string | null;
  bedrijf_id?: string | null;
  factuurnummer?: string;
  factuurdatum?: string;
  vervaldatum?: string;
  omschrijving?: string;
  leverancier?: string;
  leverancier_id?: string;
  subtotaal?: number;
  btw_percentage?: number;
  btw_bedrag?: number;
  totaal?: number;
  line_items?: Record<string, unknown>[];
}

// API Functions

/**
 * Get list of invoice imports
 */
export const getInvoiceImports = async (status?: string): Promise<InvoiceImport[]> => {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  
  const response = await api.get(`/invoicing/ocr/imports/?${params}`);
  // Handle both paginated and non-paginated responses
  const data = response.data;
  if (Array.isArray(data)) {
    return data;
  }
  // Paginated response
  return data.results || [];
};

/**
 * Get single invoice import details
 */
export const getInvoiceImport = async (id: string): Promise<InvoiceImport> => {
  const response = await api.get<InvoiceImport>(`/invoicing/ocr/imports/${id}/`);
  return response.data;
};

/**
 * Upload a new invoice file for OCR processing
 */
export const uploadInvoice = async (file: File): Promise<InvoiceImport> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post<InvoiceImport>('/invoicing/ocr/imports/upload/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Submit corrections for extracted data
 */
export const submitCorrections = async (
  id: string,
  data: CorrectionData
): Promise<InvoiceImport> => {
  const response = await api.post<InvoiceImport>(
    `/invoicing/ocr/imports/${id}/corrections/`,
    data
  );
  return response.data;
};

/**
 * Extract text from a specific region
 */
export const extractFromRegion = async (
  id: string,
  region: { page: number; x: number; y: number; width: number; height: number }
): Promise<RegionExtractionResult> => {
  const response = await api.post<RegionExtractionResult>(
    `/invoicing/ocr/imports/${id}/extract_region/`,
    region
  );
  return response.data;
};

/**
 * Download the original imported file as a blob (for PDF preview)
 */
export const downloadImportFile = async (id: string): Promise<Blob> => {
  const response = await api.get(`/invoicing/ocr/imports/${id}/download_file/`, {
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Get the OCR page image URL (through API, authenticated)
 */
export const getImportPageImageUrl = (id: string, page: number): string => {
  return `${api.defaults.baseURL}/invoicing/ocr/imports/${id}/page_image/?page=${page}`;
};

/**
 * Convert import to invoice or expense
 */
export const convertToInvoice = async (
  id: string,
  data: ConvertToInvoiceData
): Promise<{ success: boolean; type: string; id?: string; message: string }> => {
  const response = await api.post(`/invoicing/ocr/imports/${id}/convert/`, data);
  return response.data;
};

/**
 * Re-extract line items from OCR text using improved extraction logic
 */
export const reextractLines = async (
  id: string,
  text?: string
): Promise<InvoiceImport> => {
  const response = await api.post(`/invoicing/ocr/imports/${id}/reextract_lines/`, 
    text ? { text } : {}
  );
  return response.data;
};

/**
 * Update imported lines
 */
export const updateImportedLines = async (
  id: string,
  lines: Partial<ImportedLine>[]
): Promise<InvoiceImport> => {
  const response = await api.patch<InvoiceImport>(
    `/invoicing/ocr/imports/${id}/update_lines/`,
    { lines }
  );
  return response.data;
};

/**
 * Delete an import
 */
export const deleteInvoiceImport = async (id: string): Promise<void> => {
  await api.delete(`/invoicing/ocr/imports/${id}/`);
};

/**
 * Bulk delete multiple imports
 */
export const bulkDeleteInvoiceImports = async (ids: string[]): Promise<{ success: boolean; deleted_count: number; message: string }> => {
  const response = await api.post('/invoicing/ocr/imports/bulk_delete/', { ids });
  return response.data;
};

/**
 * Bulk convert multiple imports to invoices
 */
export const bulkConvertInvoiceImports = async (
  ids: string[], 
  invoice_type: 'inkoop' | 'verkoop' | 'credit'
): Promise<{ 
  success: boolean; 
  converted_count: number; 
  total_count: number;
  results: Array<{ import_id: string; success: boolean; invoice_id?: string; factuurnummer?: string; error?: string }>;
  message: string 
}> => {
  const response = await api.post('/invoicing/ocr/imports/bulk_convert/', { ids, invoice_type });
  return response.data;
};

// Patterns API

/**
 * Get list of patterns
 */
export const getInvoicePatterns = async (companyId?: string): Promise<InvoicePattern[]> => {
  const params = new URLSearchParams();
  if (companyId) params.append('company', companyId);
  
  const response = await api.get<InvoicePattern[]>(`/invoicing/ocr/patterns/?${params}`);
  return response.data;
};

/**
 * Get single pattern
 */
export const getInvoicePattern = async (id: string): Promise<InvoicePattern> => {
  const response = await api.get<InvoicePattern>(`/invoicing/ocr/patterns/${id}/`);
  return response.data;
};

/**
 * Create pattern
 */
export const createInvoicePattern = async (
  data: Partial<InvoicePattern>
): Promise<InvoicePattern> => {
  const response = await api.post<InvoicePattern>('/invoicing/ocr/patterns/', data);
  return response.data;
};

/**
 * Update pattern
 */
export const updateInvoicePattern = async (
  id: string,
  data: Partial<InvoicePattern>
): Promise<InvoicePattern> => {
  const response = await api.patch<InvoicePattern>(`/invoicing/ocr/patterns/${id}/`, data);
  return response.data;
};

/**
 * Delete pattern
 */
export const deleteInvoicePattern = async (id: string): Promise<void> => {
  await api.delete(`/invoicing/ocr/patterns/${id}/`);
};

/**
 * Test pattern with a file
 */
export const testPattern = async (
  patternId: string,
  file: File
): Promise<{ success: boolean; extracted: Record<string, unknown>; confidence: number }> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post(`/invoicing/ocr/patterns/${patternId}/test/`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};
