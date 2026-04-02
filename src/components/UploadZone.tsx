import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DOCUMENT_TYPES, type DocumentType } from '@/types/utilscraper';

interface UploadZoneProps {
  compact: boolean;
  onFilesSelected: (files: File[]) => void;
  hasFiles: boolean;
  pendingFiles: File[];
  docType: DocumentType;
  onDocTypeChange: (t: DocumentType) => void;
  onProcess: () => void;
  processing: boolean;
}

export default function UploadZone({
  compact, onFilesSelected, hasFiles, pendingFiles, docType, onDocTypeChange, onProcess, processing,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (files.length) onFilesSelected(files);
  }, [onFilesSelected]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onFilesSelected(files);
    e.target.value = '';
  }, [onFilesSelected]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); }
  }, []);

  const activeDt = DOCUMENT_TYPES.find(d => d.value === docType)!;
  const hasPending = pendingFiles.length > 0;

  const docTypeDropdown = (
    <DocTypeDropdown docType={docType} onChange={onDocTypeChange} />
  );

  if (compact) {
    return (
      <div className="space-y-2">
        {docTypeDropdown}
        <div
          role="button"
          tabIndex={0}
          className={`border border-dashed rounded-lg p-3 flex items-center gap-2.5 cursor-pointer transition-colors text-sm
            ${dragOver ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400 hover:bg-green-50/50'}`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={handleKeyDown}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="w-4 h-4 text-green-500 shrink-0" />
          <span className="text-gray-500 text-xs">Drop more PDFs or click to browse</span>
          <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleChange} />
        </div>

        {hasPending && (
          <>
            <ul className="space-y-1">
              {pendingFiles.map((file, i) => (
                <li key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <FileText className="w-3 h-3 shrink-0 text-green-500" />
                  <span className="truncate">{file.name}</span>
                </li>
              ))}
            </ul>
            <Button
              className="w-full text-xs font-semibold text-white h-8"
              style={{ backgroundColor: activeDt.color }}
              onClick={onProcess}
              disabled={processing}
            >
              {processing ? 'Processing...' : `Process ${pendingFiles.length} PDF${pendingFiles.length > 1 ? 's' : ''}`}
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {docTypeDropdown}
      <div
        role="button"
        tabIndex={0}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center
                    cursor-pointer transition-colors text-center
          ${dragOver ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400 hover:bg-green-50/40'}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={handleKeyDown}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors
          ${dragOver ? 'bg-green-100' : 'bg-gray-100'}`}>
          <Upload className={`w-6 h-6 transition-colors ${dragOver ? 'text-green-600' : 'text-gray-400'}`} />
        </div>
        <p className="text-sm font-semibold text-gray-700">Click to upload or drag and drop</p>
        <p className="text-xs text-gray-400 mt-1">PDF files only · multiple allowed</p>
        <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleChange} />
      </div>

      {hasPending && (
        <>
          <ul className="space-y-1">
            {pendingFiles.map((file, i) => (
              <li key={i} className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                <FileText className="w-3 h-3 shrink-0 text-green-500" />
                <span className="truncate">{file.name}</span>
              </li>
            ))}
          </ul>
          <Button
            className="w-full text-sm font-semibold text-white"
            style={{ backgroundColor: activeDt.color }}
            onClick={onProcess}
            disabled={processing}
          >
            {processing ? 'Processing...' : `Process ${pendingFiles.length} PDF${pendingFiles.length > 1 ? 's' : ''}`}
          </Button>
        </>
      )}
    </div>
  );
}

function DocTypeDropdown({ docType, onChange }: { docType: DocumentType; onChange: (t: DocumentType) => void }) {
  const [open, setOpen] = useState(false);
  const active = DOCUMENT_TYPES.find(d => d.value === docType)!;

  return (
    <div className="relative">
      <button
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200
                   bg-white text-xs font-medium text-gray-700 hover:border-gray-300 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: active.color }} />
          {active.label}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {DOCUMENT_TYPES.map(dt => (
            <button
              key={dt.value}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors
                ${docType === dt.value ? 'bg-gray-50 font-semibold text-gray-800' : 'text-gray-600 hover:bg-gray-50'}`}
              onClick={() => { onChange(dt.value); setOpen(false); }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dt.color }} />
              {dt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}