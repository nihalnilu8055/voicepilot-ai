import React, { useState } from 'react';
import { X, UploadCloud, FileSpreadsheet, AlertTriangle, CheckCircle2, AlertCircle, ArrowRight, Download } from 'lucide-react';
import type { CsvLeadRow, CsvImportPreviewResponse, CsvImportResultResponse } from '@voicepilot/shared';
import { api } from '../../lib/api';

interface LeadCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
  token: string;
}

export const LeadCsvImportModal: React.FC<LeadCsvImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tenantId,
  token,
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'complete'>('upload');
  const [parsedRows, setParsedRows] = useState<CsvLeadRow[]>([]);
  const [previewData, setPreviewData] = useState<CsvImportPreviewResponse | null>(null);
  const [importResult, setImportResult] = useState<CsvImportResultResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Simple CSV text parser
  const parseCsvText = (text: string): CsvLeadRow[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('CSV must contain a header row and at least one data row.');
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[\s_]+/g, ''));
    const rows: CsvLeadRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const current = lines[i].split(',').map((val) => val.trim().replace(/^["']|["']$/g, ''));
      if (current.length === 0 || (current.length === 1 && !current[0])) continue;

      const rowObj: any = {};
      headers.forEach((header, idx) => {
        const val = current[idx] || '';
        if (header.includes('name') || header === 'fullname') rowObj.fullName = val;
        else if (header.includes('phone') || header === 'phonenumber' || header === 'mobile') rowObj.phoneNumber = val;
        else if (header.includes('email')) rowObj.email = val;
        else if (header.includes('company') || header === 'companyname') rowObj.companyName = val;
        else if (header.includes('country')) rowObj.country = val;
        else if (header.includes('language') || header === 'lang') rowObj.languagePreference = val;
        else if (header.includes('consent')) rowObj.consentStatus = val;
        else if (header.includes('dnc') || header === 'isdnc') rowObj.isDnc = val;
        else if (header.includes('notes')) rowObj.notes = val;
      });

      if (rowObj.fullName || rowObj.phoneNumber) {
        rows.push(rowObj);
      }
    }

    return rows;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const rows = parseCsvText(content);
        if (rows.length === 0) {
          throw new Error('No valid lead rows could be extracted from this CSV file.');
        }

        setParsedRows(rows);
        const preview = await api.previewCsvImport(tenantId, token, rows);
        setPreviewData(preview);
        setStep('preview');
      } catch (err: any) {
        setError(err.message || 'Failed to parse CSV file');
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Error reading file from disk');
      setLoading(false);
    };

    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!parsedRows.length) return;
    setLoading(true);
    setError(null);

    try {
      const result = await api.importCsvLeads(tenantId, token, parsedRows);
      setImportResult(result);
      setStep('complete');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadSampleCsv = () => {
    const csvContent =
      'full_name,phone_number,email,company_name,country,language_preference,consent_status,is_dnc\n' +
      'Rahul Sharma,+919876543210,rahul@sharma.com,Sharma Tech,IN,hi-IN,CONSENT_GRANTED,false\n' +
      'Priya Patel,+919876543211,priya@patel.com,Patel Retail,IN,en-US,LAWFUL_BASIS,false\n' +
      'Arun Kumar,+919876543212,arun@kumar.com,Kumar Logistics,IN,ta-IN,PENDING_VERIFICATION,false\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'voicepilot_leads_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Bulk CSV Lead Import</h2>
              <p className="text-xs text-slate-400">
                Upload contacts with automatic deduplication & regulatory consent verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Select a CSV file containing your leads:</span>
                <button
                  type="button"
                  onClick={downloadSampleCsv}
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Sample CSV
                </button>
              </div>

              <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition-all p-6 text-center group">
                <UploadCloud className="h-10 w-10 text-slate-500 group-hover:text-indigo-400 transition-colors mb-3" />
                <span className="text-sm font-medium text-slate-200">
                  Click to browse or drop your CSV file here
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Supported columns: full_name, phone_number, email, company_name, country, consent_status, is_dnc
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="hidden"
                />
              </label>

              {loading && (
                <div className="text-center py-4 text-xs text-slate-400 animate-pulse">
                  Analyzing file, verifying format and duplicate detection...
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Preview & Validation */}
          {step === 'preview' && previewData && (
            <div className="space-y-4">
              {/* Stat Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
                  <div className="text-lg font-bold text-white">{previewData.totalRows}</div>
                  <div className="text-[11px] text-slate-400">Total Rows</div>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 text-center">
                  <div className="text-lg font-bold text-emerald-400">{previewData.validRows}</div>
                  <div className="text-[11px] text-emerald-300/80">Valid Ready to Import</div>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-center">
                  <div className="text-lg font-bold text-amber-400">{previewData.duplicateRows}</div>
                  <div className="text-[11px] text-amber-300/80">Duplicates Found</div>
                </div>
                <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-3 text-center">
                  <div className="text-lg font-bold text-rose-400">{previewData.invalidRows}</div>
                  <div className="text-[11px] text-rose-300/80">Invalid Format / Skipped</div>
                </div>
              </div>

              {/* Preview Table */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-300">
                  Data Preview ({previewData.preview.length} rows scanned)
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60 text-xs">
                  {previewData.preview.map((p) => (
                    <div
                      key={p.rowNumber}
                      className={`flex items-center justify-between p-3 ${
                        p.isValid ? 'hover:bg-slate-900/50' : 'bg-rose-950/10'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">
                            #{p.rowNumber} {p.data.fullName || '(Missing Name)'}
                          </span>
                          <span className="font-mono text-slate-400">{p.data.phoneNumber}</span>
                          {p.data.companyName && (
                            <span className="text-[10px] text-slate-500">({p.data.companyName})</span>
                          )}
                        </div>
                        {p.errors.length > 0 && (
                          <div className="text-[11px] text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {p.errors.join(' • ')}
                          </div>
                        )}
                      </div>

                      <div>
                        {p.isValid ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-[10px] font-medium border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 text-rose-400 px-2 py-0.5 text-[10px] font-medium border border-rose-500/20">
                            <AlertCircle className="h-3 w-3" />
                            Skip
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="rounded-lg border border-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  Choose Different File
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={loading || previewData.validRows === 0}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {loading ? 'Importing...' : `Import ${previewData.validRows} Valid Leads`}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Complete */}
          {step === 'complete' && importResult && (
            <div className="py-6 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Import Successful!</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Successfully imported{' '}
                  <strong className="text-emerald-400 font-semibold">{importResult.totalImported}</strong> leads into
                  your company workspace.
                </p>
                {importResult.duplicatesSkipped > 0 && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    Skipped {importResult.duplicatesSkipped} duplicate contact(s).
                  </p>
                )}
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-indigo-600 px-6 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500"
                >
                  Done & View Leads
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
