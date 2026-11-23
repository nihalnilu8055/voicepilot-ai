export type SupportedLanguage =
  | 'en-US'
  | 'es-ES'
  | 'hi-IN'
  | 'fr-FR'
  | 'de-DE'
  | 'pt-BR'
  | 'ar-SA'
  | 'ja-JP';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

export type UserRole = 'owner' | 'admin' | 'sales_agent' | 'viewer';
