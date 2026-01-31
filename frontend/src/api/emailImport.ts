import api from './client';

// ============================================
// Types
// ============================================

export interface MailboxConfig {
  id: string;
  name: string;
  description: string;
  protocol: 'imap' | 'ms365';
  protocol_display: string;
  status: 'active' | 'inactive' | 'error';
  status_display: string;
  email_address: string;
  folder_name: string;
  folder_display_name: string;
  default_invoice_type: 'purchase' | 'credit' | 'sales';
  default_invoice_type_display: string;
  auto_fetch_enabled: boolean;
  auto_fetch_interval_minutes: number;
  last_fetch_at?: string;
  total_emails_processed: number;
  total_invoices_imported: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface MailboxConfigDetail extends MailboxConfig {
  imap_server: string;
  imap_port: number;
  imap_use_ssl: boolean;
  has_credentials: boolean;
  ms365_client_id: string;
  ms365_tenant_id: string;
  has_ms365_secret: boolean;
  mark_as_read: boolean;
  move_to_folder: string;
  move_to_folder_display_name: string;
  default_invoice_type: 'purchase' | 'credit' | 'sales';
  only_unread: boolean;
  subject_filter: string;
  sender_filter: string;
  last_error: string;
}

export interface MailboxConfigInput {
  name: string;
  description?: string;
  protocol: 'imap' | 'ms365';
  email_address: string;
  imap_server?: string;
  imap_port?: number;
  imap_use_ssl?: boolean;
  username?: string;
  password?: string;
  ms365_client_id?: string;
  ms365_client_secret?: string;
  ms365_tenant_id?: string;
  folder_name?: string;
  folder_display_name?: string;
  default_invoice_type?: 'purchase' | 'credit' | 'sales';
  mark_as_read?: boolean;
  move_to_folder?: string;
  move_to_folder_display_name?: string;
  only_unread?: boolean;
  subject_filter?: string;
  sender_filter?: string;
  auto_fetch_enabled?: boolean;
  auto_fetch_interval_minutes?: number;
}

export interface EmailAttachment {
  id: string;
  original_filename: string;
  file_url: string;
  file_size: number;
  content_type: string;
  invoice_import_id?: string;
  invoice_import_status?: string;
  is_processed: boolean;
  error_message?: string;
  created_at: string;
  extracted_data?: {
    invoice_number?: string;
    invoice_date?: string;
    due_date?: string;
    supplier_name?: string;
    supplier_address?: string;
    supplier_vat?: string;
    supplier_kvk?: string;
    supplier_iban?: string;
    total_amount?: number;
    vat_amount?: number;
    net_amount?: number;
    currency?: string;
    line_items?: Array<{
      description?: string;
      quantity?: number;
      unit_price?: number;
      total?: number;
      vat_rate?: number;
    }>;
    [key: string]: any;
  };
}

export interface EmailImport {
  id: string;
  mailbox_name: string;
  default_invoice_type: 'purchase' | 'credit' | 'sales';
  email_subject: string;
  email_from: string;
  email_date: string;
  email_body_preview: string;
  status: 'pending' | 'processing' | 'awaiting_review' | 'approved' | 'rejected' | 'completed' | 'failed';
  status_display: string;
  attachment_count: number;
  attachments: EmailAttachment[];
  first_invoice_import_id?: string;
  processed_at?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailImportDetail extends EmailImport {
  attachments: EmailAttachment[];
  error_message?: string;
  review_notes?: string;
}

export interface FetchEmailsResult {
  success: boolean;
  stats: {
    emails_found: number;
    emails_processed: number;
    attachments_found: number;
    attachments_processed: number;
    errors: string[];
  };
}

export interface EmailImportStats {
  total: number;
  today: number;
  by_status: {
    pending: number;
    processing: number;
    awaiting_review: number;
    approved: number;
    rejected: number;
    completed: number;
    failed: number;
  };
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ============================================
// Mailbox Config API
// ============================================

export const getMailboxConfigs = async (): Promise<MailboxConfig[]> => {
  const response = await api.get<PaginatedResponse<MailboxConfig>>('/invoicing/email-import/mailboxes/');
  return response.data.results || response.data as unknown as MailboxConfig[];
};

export const getMailboxConfig = async (id: string): Promise<MailboxConfigDetail> => {
  const response = await api.get<MailboxConfigDetail>(`/invoicing/email-import/mailboxes/${id}/`);
  return response.data;
};

export const createMailboxConfig = async (data: MailboxConfigInput): Promise<MailboxConfigDetail> => {
  const response = await api.post<MailboxConfigDetail>('/invoicing/email-import/mailboxes/', data);
  return response.data;
};

export const updateMailboxConfig = async (id: string, data: Partial<MailboxConfigInput>): Promise<MailboxConfigDetail> => {
  const response = await api.patch<MailboxConfigDetail>(`/invoicing/email-import/mailboxes/${id}/`, data);
  return response.data;
};

export const deleteMailboxConfig = async (id: string): Promise<void> => {
  await api.delete(`/invoicing/email-import/mailboxes/${id}/`);
};

export const testMailboxConnection = async (id: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.post<{ success: boolean; message: string }>(
      `/invoicing/email-import/mailboxes/${id}/test_connection/`
    );
    return response.data;
  } catch (error: any) {
    // Handle 400 response with success/message body
    if (error.response?.status === 400 && error.response?.data?.message) {
      return {
        success: false,
        message: error.response.data.message
      };
    }
    throw error;
  }
};

export interface MailboxFolder {
  id: string;
  name: string;
  display_name: string;
  depth: number;
  has_children: boolean;
  total_items?: number;
  unread_items?: number;
}

export const listMailboxFolders = async (id: string): Promise<{ success: boolean; folders: MailboxFolder[]; message?: string }> => {
  try {
    const response = await api.get<{ success: boolean; folders: MailboxFolder[] }>(
      `/invoicing/email-import/mailboxes/${id}/list_folders/`
    );
    return response.data;
  } catch (error: any) {
    // Handle 400 response with error message
    if (error.response?.status === 400 && error.response?.data?.message) {
      return {
        success: false,
        folders: [],
        message: error.response.data.message
      };
    }
    throw error;
  }
};

export const fetchMailboxEmails = async (id: string, limit: number = 50): Promise<FetchEmailsResult> => {
  const response = await api.post<FetchEmailsResult>(
    `/invoicing/email-import/mailboxes/${id}/fetch_emails/`,
    { limit }
  );
  return response.data;
};

// ============================================
// Email Import API
// ============================================

export const getEmailImports = async (params?: {
  status?: string;
  mailbox?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}): Promise<PaginatedResponse<EmailImport>> => {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, String(value));
      }
    });
  }
  const response = await api.get<PaginatedResponse<EmailImport>>(
    `/invoicing/email-import/imports/?${queryParams}`
  );
  return response.data;
};

export const getEmailImport = async (id: string): Promise<EmailImportDetail> => {
  const response = await api.get<EmailImportDetail>(`/invoicing/email-import/imports/${id}/`);
  return response.data;
};

export const getPendingReviewImports = async (page: number = 1, pageSize: number = 20): Promise<PaginatedResponse<EmailImport>> => {
  const response = await api.get<PaginatedResponse<EmailImport>>(
    `/invoicing/email-import/imports/pending_review/?page=${page}&page_size=${pageSize}`
  );
  return response.data;
};

export const reviewEmailImport = async (
  id: string, 
  action: 'approve' | 'reject', 
  notes?: string,
  invoiceType?: 'purchase' | 'credit' | 'sales'
): Promise<{ success: boolean; message: string }> => {
  const response = await api.post<{ success: boolean; message: string }>(
    `/invoicing/email-import/imports/${id}/review/`,
    { action, notes, invoice_type: invoiceType }
  );
  return response.data;
};

export const bulkDeleteEmailImports = async (ids: string[]): Promise<{ success: boolean; deleted_count: number; message: string }> => {
  const response = await api.post<{ success: boolean; deleted_count: number; message: string }>(
    '/invoicing/email-import/imports/bulk_delete/',
    { ids }
  );
  return response.data;
};

export const getEmailImportStats = async (): Promise<EmailImportStats> => {
  const response = await api.get<EmailImportStats>('/invoicing/email-import/imports/statistics/');
  return response.data;
};
