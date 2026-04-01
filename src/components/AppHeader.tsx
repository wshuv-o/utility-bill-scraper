import { FileText } from 'lucide-react';

export default function AppHeader() {
  return (
    <header className="h-12 bg-card border-b border-border flex items-center px-4 gap-3 shrink-0">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-blue-600" />
        <span className="font-semibold text-sm text-foreground">UtilScraper</span>
      </div>
      <span className="text-xs text-muted-foreground">
        Upload a utility bill PDF, draw boxes over the values you want, then click Extract
      </span>
    </header>
  );
}