import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UploadZoneProps {
  compact: boolean;
  onFilesSelected: (files: File[]) => void;
  hasFiles: boolean;
  pendingFiles: File[];
  onProcess: () => void;
  processing: boolean;
}

export default function UploadZone({ compact, onFilesSelected, hasFiles, pendingFiles, onProcess, processing }: UploadZoneProps) {
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

  if (compact) {
    return (
      <div className="space-y-2.5">
        <div
          className="border border-dashed border-border rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:border-accent transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Drop more PDFs or click to browse</span>
          <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleChange} />
        </div>

        {hasFiles && (
          <>
            <div className="text-xs text-muted-foreground truncate">
              Pending: {pendingFiles.map(file => file.name).join(', ')}
            </div>
            <Button
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
              onClick={onProcess}
              disabled={processing}
            >
              {processing ? 'Processing...' : `Process PDF${pendingFiles.length > 1 ? 's' : ''}`}
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
          dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mb-4">
          <Upload className="w-7 h-7 text-accent" />
        </div>
        <p className="font-semibold text-base text-foreground">Drop utility bill PDFs here</p>
        <p className="text-sm text-muted-foreground mt-1">or click to browse — PDF files only, multiple allowed</p>
        <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleChange} />
      </div>
      {hasFiles && (
        <Button
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
          onClick={onProcess}
          disabled={processing}
        >
          {processing ? 'Processing...' : 'Process PDF'}
        </Button>
      )}
    </div>
  );
}
