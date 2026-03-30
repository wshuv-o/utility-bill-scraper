import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AppHeaderProps {
  provider: string;
  onProviderChange: (v: string) => void;
}

const PROVIDERS = [
  'National Grid Gas',
  'Con Edison',
  'PSEG',
  'National Fuel',
  'KeySpan',
];

export default function AppHeader({ provider, onProviderChange }: AppHeaderProps) {
  return (
    <header className="h-14 flex items-center justify-between px-5 border-b border-border bg-card shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-primary tracking-tight">UtilScraper</h1>
        <span className="text-sm text-muted-foreground hidden sm:inline">Utility Bill PDF Extractor</span>
      </div>
      <Select value={provider} onValueChange={onProviderChange}>
        <SelectTrigger className="w-48 h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROVIDERS.map(p => (
            <SelectItem key={p} value={p}>{p}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </header>
  );
}
