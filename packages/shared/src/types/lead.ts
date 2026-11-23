export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'NOT_INTERESTED'
  | 'CALLBACK'
  | 'CONVERTED'
  | 'LOST';

export type ConsentStatus =
  | 'CONSENT_GRANTED'
  | 'CONSENT_REVOKED'
  | 'PENDING_VERIFICATION'
  | 'LAWFUL_BASIS';

export type LeadSource =
  | 'WEBSITE'
  | 'INBOUND'
  | 'COLD_OUTREACH'
  | 'REFERRAL'
  | 'EVENT'
  | 'PAID_ADS'
  | 'CSV_IMPORT'
  | 'OTHER';

export interface Lead {
  id: string;
  tenantId: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  companyName: string | null;
  country: string;
  languagePreference: string;
  leadSource: LeadSource;
  status: LeadStatus;
  notes: string | null;
  assignedAgentId: string | null;
  assignedAgent?: {
    id: string;
    fullName: string | null;
    email: string;
  } | null;
  // Regulatory & Calling Compliance (TRAI / DND / Consent)
  consentStatus: ConsentStatus;
  consentSource: string | null;
  consentDate: string | null;
  isDnc: boolean; // Do Not Call status
  dncReason: string | null;
  dncUpdatedAt: string | null;
  isCallable: boolean; // Derived/Enforced: false if isDnc or consent not valid
  createdAt: string;
  updatedAt: string;
  createdById: string;
}

export interface CreateLeadDto {
  fullName: string;
  phoneNumber: string;
  email?: string | null;
  companyName?: string | null;
  country?: string;
  languagePreference?: string;
  leadSource?: LeadSource;
  status?: LeadStatus;
  notes?: string | null;
  assignedAgentId?: string | null;
  consentStatus?: ConsentStatus;
  consentSource?: string | null;
  isDnc?: boolean;
  dncReason?: string | null;
}

export interface UpdateLeadDto {
  fullName?: string;
  phoneNumber?: string;
  email?: string | null;
  companyName?: string | null;
  country?: string;
  languagePreference?: string;
  leadSource?: LeadSource;
  status?: LeadStatus;
  notes?: string | null;
  assignedAgentId?: string | null;
  consentStatus?: ConsentStatus;
  consentSource?: string | null;
  isDnc?: boolean;
  dncReason?: string | null;
}

export interface LeadFilterQuery {
  search?: string;
  status?: LeadStatus;
  leadSource?: LeadSource;
  languagePreference?: string;
  isDnc?: boolean;
  isCallable?: boolean;
  page?: number;
  limit?: number;
}

export interface LeadListResponse {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CsvLeadRow {
  fullName: string;
  phoneNumber: string;
  email?: string;
  companyName?: string;
  country?: string;
  languagePreference?: string;
  leadSource?: string;
  status?: string;
  notes?: string;
  consentStatus?: string;
  consentSource?: string;
  isDnc?: boolean | string;
}

export interface CsvPreviewItem {
  rowNumber: number;
  data: CsvLeadRow;
  isValid: boolean;
  errors: string[];
  isDuplicateInFile: boolean;
  isDuplicateInDb: boolean;
  duplicateField?: 'phone' | 'email';
  isCallable: boolean;
}

export interface CsvImportPreviewResponse {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  preview: CsvPreviewItem[];
}

export interface CsvImportResultResponse {
  totalImported: number;
  totalSkipped: number;
  duplicatesSkipped: number;
  errors: Array<{ rowNumber: number; reason: string }>;
}
