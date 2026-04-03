import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground
                     hover:bg-muted transition-colors"
          onClick={() => setDark(d => !d)}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {dark ? 'Light mode' : 'Dark mode'}
      </TooltipContent>
    </Tooltip>
  );
}
