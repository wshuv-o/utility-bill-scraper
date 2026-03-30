import { Check, Loader2, Circle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ProcessingModalProps {
  open: boolean;
  step: number; // 0=uploading, 1=analysing, 2=ocr, 3=finalising, 4=done
  detail?: string;
}

const STEPS = [
  'Uploading PDF',
  'Analysing pages',
  'Running OCR',
  'Finalising...',
];

export default function ProcessingModal({ open, step, detail }: ProcessingModalProps) {
  if (!open) return null;

  const progress = Math.min(((step + 1) / 4) * 100, 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="bg-card rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-foreground mb-4">Processing your PDF...</h3>
        <div className="space-y-2.5 mb-5">
          {STEPS.map((label, i) => {
            const isDone = step > i;
            const isCurrent = step === i;
            return (
              <div key={i} className="flex items-center gap-2.5 text-sm">
                {isDone ? (
                  <Check className="w-4 h-4 text-success" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-accent animate-spin" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground/40" />
                )}
                <span className={isDone ? 'text-foreground' : isCurrent ? 'text-accent font-medium' : 'text-muted-foreground'}>
                  {isCurrent && detail ? detail : label}
                </span>
              </div>
            );
          })}
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    </div>
  );
}
