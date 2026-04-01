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
  | 'custom';

export interface FieldLabelOption {
  value: FieldLabel;
  label: string;
  color: string;
  bgColor: string;
}

export const FIELD_LABELS: FieldLabelOption[] = [
  // Identity fields — blue family
  { value: 'provider_name',         label: 'Provider Name',       color: '#1d4ed8', bgColor: 'rgba(29,78,216,0.18)'   },
  { value: 'property_name',         label: 'Property Name',       color: '#2563eb', bgColor: 'rgba(37,99,235,0.18)'   },
  { value: 'account_number',        label: 'Account Number',      color: '#0891b2', bgColor: 'rgba(8,145,178,0.18)'   },
  { value: 'address',               label: 'Address',             color: '#0284c7', bgColor: 'rgba(2,132,199,0.18)'   },
  { value: 'billing_date',          label: 'Billing Date',        color: '#7c3aed', bgColor: 'rgba(124,58,237,0.18)'  },
  // Bill amount fields — each a distinct colour so multiple on one page are easy to tell apart
  { value: 'total_gas_bill',        label: 'Total Gas',           color: '#dc2626', bgColor: 'rgba(220,38,38,0.18)'   },
  { value: 'total_electricity_bill',label: 'Total Electricity',   color: '#d97706', bgColor: 'rgba(217,119,6,0.18)'   },
  { value: 'total_water_bill',      label: 'Total Water',         color: '#0ea5e9', bgColor: 'rgba(14,165,233,0.18)'  },
  { value: 'total_sewer_bill',      label: 'Total Sewer',         color: '#0d9488', bgColor: 'rgba(13,148,136,0.18)'  },
  { value: 'total_water_sewer_bill',label: 'Total Water & Sewer', color: '#0369a1', bgColor: 'rgba(3,105,161,0.18)'   },
  { value: 'total_internet_bill',   label: 'Total Internet',      color: '#7c3aed', bgColor: 'rgba(124,58,237,0.18)'  },
  { value: 'total_phone_bill',      label: 'Total Phone',         color: '#9333ea', bgColor: 'rgba(147,51,234,0.18)'  },
  { value: 'total_trash_bill',      label: 'Total Trash',         color: '#65a30d', bgColor: 'rgba(101,163,13,0.18)'  },
  // Fallback
  { value: 'custom',                label: 'Custom',              color: '#64748b', bgColor: 'rgba(100,116,139,0.18)' },
];

// Accepts string (not just FieldLabel) so ExtractedRow.field values work without a cast.
// Falls back to the 'custom' config for any unknown label.
export function getFieldConfig(field: string): FieldLabelOption {
  return FIELD_LABELS.find(f => f.value === field) ?? FIELD_LABELS[5];
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