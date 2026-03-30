import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Highlight } from '@/types/utilscraper';
import { getFieldConfig } from '@/types/utilscraper';

interface Props {
  highlights: Highlight[];
}

export default function HighlightLegend({ highlights }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const fields = [...new Set(highlights.map(h => h.field))];

  return (
    <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur border border-border rounded-lg shadow-md p-2 z-10">
      <button className="flex items-center gap-2 text-xs font-semibold text-foreground w-full" onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        Highlighted Fields
      </button>
      {!collapsed && (
        <div className="mt-1.5 space-y-1">
          {fields.map(f => {
            const cfg = getFieldConfig(f);
            return (
              <div key={f} className="flex items-center gap-2 text-xs text-foreground">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: cfg.bgColor, border: `1px solid ${cfg.color}` }} />
                {cfg.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
