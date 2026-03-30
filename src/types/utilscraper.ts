export interface PageInfo {
  page_number: number;
  is_ocr: boolean;
  char_count: number;
  status: 'native' | 'ocr';
}

export interface PDFSession {
  id: string;
  filename: string;
  file: File;
  total_pages: number;
  pages: PageInfo[];
  status: 'uploading' | 'processing' | 'ready' | 'extracted';
  highlights: Record<number, Highlight[]>;
  extractedData: ExtractedRow[];
}

export interface Highlight {
  id: string;
  page: number;
  field: FieldLabel;
  x: number;
  y: number;
  width: number;
  height: number;
  extractedValue?: string | null;
  confidence?: 'high' | 'medium' | 'low';
  wasOcr?: boolean;
}

export type FieldLabel =
  | 'property_name'
  | 'account_number'
  | 'address'
  | 'billing_date'
  | 'total_gas_bill'
  | 'custom';

export interface FieldLabelOption {
  value: FieldLabel;
  label: string;
  color: string;
  bgColor: string;
}

export const FIELD_LABELS: FieldLabelOption[] = [
  { value: 'property_name', label: 'Property Name', color: '#2563eb', bgColor: 'rgba(37,99,235,0.25)' },
  { value: 'account_number', label: 'Account Number', color: '#16a34a', bgColor: 'rgba(22,163,74,0.25)' },
  { value: 'address', label: 'Address', color: '#ea580c', bgColor: 'rgba(234,88,12,0.25)' },
  { value: 'billing_date', label: 'Billing Date', color: '#9333ea', bgColor: 'rgba(147,51,234,0.25)' },
  { value: 'total_gas_bill', label: 'Total Gas Bill', color: '#dc2626', bgColor: 'rgba(220,38,38,0.25)' },
  { value: 'custom', label: 'Custom', color: '#64748b', bgColor: 'rgba(100,116,139,0.25)' },
];

export function getFieldConfig(field: FieldLabel): FieldLabelOption {
  return FIELD_LABELS.find(f => f.value === field) || FIELD_LABELS[5];
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
