import * as XLSX from 'xlsx';
import type { ExtractedRow } from '@/types/utilscraper';
import { getFieldConfig } from '@/types/utilscraper';

export function exportToExcel(data: ExtractedRow[], filename: string, provider: string) {
  const now = new Date();
  const exportDate = now.toISOString().slice(0, 19).replace('T', ' ');
  const dateStr = now.toISOString().slice(0, 16).replace(/[T:]/g, '-');

  const headers = ['Page', 'Property Name', 'Account Number', 'Address', 'Billing Period Start', 'Total Gas Bill', 'Provider', 'Filename', 'Export Date'];

  // Group by page
  const pages = [...new Set(data.map(d => d.page))].sort();
  const rows = pages.map(page => {
    const pageData = data.filter(d => d.page === page);
    const get = (field: string) => pageData.find(d => d.field === field)?.value || '—';
    return [
      page,
      get('property_name'),
      get('account_number'),
      get('address'),
      get('billing_date'),
      get('total_gas_bill'),
      provider,
      filename,
      exportDate,
    ];
  });

  // Summary row
  const gasValues = data
    .filter(d => d.field === 'total_gas_bill' && d.value)
    .map(d => parseFloat((d.value || '0').replace(/[$,]/g, '')))
    .filter(n => !isNaN(n));

  const uniqueProps = new Set(data.filter(d => d.field === 'property_name' && d.value).map(d => d.value)).size;
  const uniqueAccts = new Set(data.filter(d => d.field === 'account_number' && d.value).map(d => d.value)).size;
  const totalGas = gasValues.reduce((a, b) => a + b, 0);

  rows.push(['TOTAL', uniqueProps, uniqueAccts, '—', '—', `$${totalGas.toFixed(2)}`, '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Column widths
  ws['!cols'] = [
    { wch: 8 }, { wch: 25 }, { wch: 18 }, { wch: 40 },
    { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 30 }, { wch: 20 },
  ];

  // Freeze header
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Utility Bills');

  const xlsxName = `UtilScraper_${provider.replace(/\s+/g, '')}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, xlsxName);
}
