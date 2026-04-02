export type DocumentType = 'utility_bill' | 'bank_statement' | 'appraisal';

export const DOCUMENT_TYPES: { value: DocumentType; label: string; color: string }[] = [
  { value: 'utility_bill',   label: 'Utility Bill',    color: '#16a34a' },
  { value: 'bank_statement', label: 'Bank Statement',  color: '#2563eb' },
  { value: 'appraisal',      label: 'Appraisal',       color: '#9333ea' },
];

export interface PageInfo {
  page_number: number;
  is_ocr: boolean;
  char_count: number;
  status: 'native' | 'ocr';
}

export interface PDFSession {
  id: string;
  filename: string;
  file: File | undefined;   // undefined when session is restored without original File object
  docType: DocumentType;
  total_pages: number;
  pages: PageInfo[];
  status: 'uploading' | 'processing' | 'ready' | 'extracted';
  highlights: Record<number, Highlight[]>;
  extractedData: ExtractedRow[];
}

export interface Highlight {
  id: string;
  page: number;
  field: string;             // string (not FieldLabel) so custom labels work without a cast
  x: number;
  y: number;
  width: number;
  height: number;
  extractedValue?: string | null;
  confidence?: 'high' | 'medium' | 'low';
  wasOcr?: boolean;
  isAutoExtracted?: boolean;  // true = coords are approximate, skip on Re-Extract
}

export type FieldLabel =
  | 'provider_name'
  | 'property_name'
  | 'account_number'
  | 'address'
  | 'billing_date'
  | 'total_gas_bill'
  | 'total_electricity_bill'
  | 'total_internet_bill'
  | 'total_phone_bill'
  | 'total_water_bill'
  | 'total_sewer_bill'
  | 'total_water_sewer_bill'
  | 'total_trash_bill'
  // Bank statement fields
  | 'beginning_balance'
  | 'ending_balance'
  | 'statement_date'
  | 'total_credits'
  | 'total_debits'
  // Appraisal fields
  | 'appraised_date'
  | 'appraised_as_is_value'
  | 'custom';

export interface FieldLabelOption {
  value: FieldLabel;
  label: string;
  color: string;
  bgColor: string;
  docTypes: DocumentType[];  // which document types show this field
}

export const FIELD_LABELS: FieldLabelOption[] = [
  // ── Utility bill fields ───────────────────────────────────────────
  { value: 'provider_name',         label: 'Provider Name',       color: '#1d4ed8', bgColor: 'rgba(29,78,216,0.18)',   docTypes: ['utility_bill'] },
  { value: 'property_name',         label: 'Property Name',       color: '#2563eb', bgColor: 'rgba(37,99,235,0.18)',   docTypes: ['utility_bill', 'bank_statement'] },
  { value: 'account_number',        label: 'Account Number',      color: '#0891b2', bgColor: 'rgba(8,145,178,0.18)',   docTypes: ['utility_bill', 'bank_statement'] },
  { value: 'address',               label: 'Address',             color: '#0284c7', bgColor: 'rgba(2,132,199,0.18)',   docTypes: ['utility_bill'] },
  { value: 'billing_date',          label: 'Billing Date',        color: '#7c3aed', bgColor: 'rgba(124,58,237,0.18)',  docTypes: ['utility_bill'] },
  { value: 'total_gas_bill',        label: 'Total Gas',           color: '#dc2626', bgColor: 'rgba(220,38,38,0.18)',   docTypes: ['utility_bill'] },
  { value: 'total_electricity_bill',label: 'Total Electricity',   color: '#d97706', bgColor: 'rgba(217,119,6,0.18)',   docTypes: ['utility_bill'] },
  { value: 'total_water_bill',      label: 'Total Water',         color: '#0ea5e9', bgColor: 'rgba(14,165,233,0.18)',  docTypes: ['utility_bill'] },
  { value: 'total_sewer_bill',      label: 'Total Sewer',         color: '#0d9488', bgColor: 'rgba(13,148,136,0.18)',  docTypes: ['utility_bill'] },
  { value: 'total_water_sewer_bill',label: 'Total Water & Sewer', color: '#0369a1', bgColor: 'rgba(3,105,161,0.18)',   docTypes: ['utility_bill'] },
  { value: 'total_internet_bill',   label: 'Total Internet',      color: '#7c3aed', bgColor: 'rgba(124,58,237,0.18)',  docTypes: ['utility_bill'] },
  { value: 'total_phone_bill',      label: 'Total Phone',         color: '#9333ea', bgColor: 'rgba(147,51,234,0.18)',  docTypes: ['utility_bill'] },
  { value: 'total_trash_bill',      label: 'Total Trash',         color: '#65a30d', bgColor: 'rgba(101,163,13,0.18)',  docTypes: ['utility_bill'] },
  // ── Bank statement fields ─────────────────────────────────────────
  { value: 'beginning_balance',     label: 'Beginning Balance',   color: '#16a34a', bgColor: 'rgba(22,163,74,0.18)',   docTypes: ['bank_statement'] },
  { value: 'ending_balance',        label: 'Ending Balance',      color: '#dc2626', bgColor: 'rgba(220,38,38,0.18)',   docTypes: ['bank_statement'] },
  { value: 'statement_date',        label: 'Statement Date',      color: '#7c3aed', bgColor: 'rgba(124,58,237,0.18)',  docTypes: ['bank_statement'] },
  { value: 'total_credits',         label: 'Total Credits',       color: '#0891b2', bgColor: 'rgba(8,145,178,0.18)',   docTypes: ['bank_statement'] },
  { value: 'total_debits',          label: 'Total Debits',        color: '#d97706', bgColor: 'rgba(217,119,6,0.18)',   docTypes: ['bank_statement'] },
  // ── Appraisal fields ──────────────────────────────────────────────
  { value: 'appraised_date',        label: 'Appraised Date',      color: '#7c3aed', bgColor: 'rgba(124,58,237,0.18)',  docTypes: ['appraisal'] },
  { value: 'appraised_as_is_value', label: 'Appraised As-Is Value', color: '#dc2626', bgColor: 'rgba(220,38,38,0.18)', docTypes: ['appraisal'] },
  // ── Fallback ──────────────────────────────────────────────────────
  { value: 'custom',                label: 'Custom',              color: '#64748b', bgColor: 'rgba(100,116,139,0.18)', docTypes: ['utility_bill', 'bank_statement', 'appraisal'] },
];

// Returns only the field labels relevant to a document type
export function getFieldLabelsForType(docType: DocumentType): FieldLabelOption[] {
  return FIELD_LABELS.filter(f => f.docTypes.includes(docType));
}

// Accepts string (not just FieldLabel) so ExtractedRow.field values work without a cast.
// Falls back to the 'custom' config for any unknown label.
export function getFieldConfig(field: string): FieldLabelOption {
  return FIELD_LABELS.find(f => f.value === field)
    ?? { value: 'custom', label: field, color: '#64748b', bgColor: 'rgba(100,116,139,0.18)', docTypes: ['utility_bill', 'bank_statement', 'appraisal'] };
}

export interface ExtractedRow {
  page: number;
  field: string;
  value: string | null;
  confidence: 'high' | 'medium' | 'low';
  wasOcr: boolean;
  edited?: boolean;
}

export type ViewerTool = 'cursor' | 'highlight' | 'eraser';