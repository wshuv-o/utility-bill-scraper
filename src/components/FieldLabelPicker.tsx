import { useState } from 'react';
import { FIELD_LABELS, type FieldLabel } from '@/types/utilscraper';
import { Input } from '@/components/ui/input';

interface Props {
  x: number;
  y: number;
  onSelect: (field: FieldLabel, customLabel?: string) => void;
  onCancel: () => void;
}

export default function FieldLabelPicker({ x, y, onSelect, onCancel }: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');

  return (
    <div
      className="absolute z-20 bg-card border border-border rounded-lg shadow-lg p-2 w-48"
      style={{ left: Math.min(x, 200), top: y }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Label this field:</p>
      {FIELD_LABELS.filter(f => f.value !== 'custom').map(f => (
        <button
          key={f.value}
          className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2"
          onClick={() => onSelect(f.value)}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.color }} />
          {f.label}
        </button>
      ))}
      {!showCustom ? (
        <button
          className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted text-muted-foreground"
          onClick={() => setShowCustom(true)}
        >
          Custom...
        </button>
      ) : (
        <div className="px-2 py-1">
          <Input
            className="h-7 text-xs"
            placeholder="Field name..."
            autoFocus
            value={customLabel}
            onChange={e => setCustomLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && customLabel.trim()) onSelect('custom', customLabel.trim());
              if (e.key === 'Escape') onCancel();
            }}
          />
        </div>
      )}
    </div>
  );
}
