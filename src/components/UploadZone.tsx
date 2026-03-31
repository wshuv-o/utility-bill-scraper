import { useCallback, useRef, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UploadZoneProps {
  compact: boolean;
  onFilesSelected: (files: File[]) => void;
  hasFiles: boolean;
  pendingFiles: File[];
  onProcess: () => void;
  processing: boolean;
}

export default function UploadZone({
  compact,
  onFilesSelected,
  hasFiles,
  pendingFiles,
  onProcess,
  processing,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter(
        f => f.type === 'application/pdf',
      );
      if (files.length) onFilesSelected(files);
    },
    [onFilesSelected],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length) onFilesSelected(files);
      e.target.value = '';
    },
    [onFilesSelected],
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }, []);

  // Only show pending list + button when there are actual pending files
  const hasPending = pendingFiles.length > 0;

  // -------------------------------------------------------------------------
  // Compact mode — shown after first upload as a smaller strip
  // -------------------------------------------------------------------------
  if (compact) {
    return (
      <div className="space-y-2.5">
        <div
          role="button"
          tabIndex={0}
          className={`border border-dashed rounded-lg p-3 flex items-center gap-3 cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-border hover:border-blue-400'
          }`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={handleKeyDown}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">
            Drop more PDFs or click to browse
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={handleChange}
          />
        </div>

        {hasPending && (
          <>
            {/* Pending file list — one line per file, truncated */}
            <ul className="space-y-1">
              {pendingFiles.map((file, i) => (
                <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="w-3 h-3 shrink-0" />
                  <span className="truncate">{file.name}</span>
                </li>
              ))}
            </ul>

            <Button
              className="w-full font-semibold"
              onClick={onProcess}
              disabled={processing}
            >
              {processing
                ? 'Processing...'
                : `Process ${pendingFiles.length} PDF${pendingFiles.length > 1 ? 's' : ''}`}
            </Button>
          </>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Full upload zone — shown when no files uploaded yet
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-border hover:border-blue-400'
        }`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={handleKeyDown}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mb-4">
          <Upload className="w-7 h-7 text-blue-600" />
        </div>
        <p className="font-semibold text-base text-foreground">
          Drop utility bill PDFs here
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          or click to browse — PDF files only, multiple allowed
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {hasPending && (
        <>
          <ul className="space-y-1">
            {pendingFiles.map((file, i) => (
              <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="w-3 h-3 shrink-0" />
                <span className="truncate">{file.name}</span>
              </li>
            ))}
          </ul>

          <Button
            className="w-full font-semibold"
            onClick={onProcess}
            disabled={processing}
          >
            {processing
              ? 'Processing...'
              : `Process ${pendingFiles.length} PDF${pendingFiles.length > 1 ? 's' : ''}`}
          </Button>
        </>
      )}
    </div>
  );
}