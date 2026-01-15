import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Recommendation, Confidence } from '@/types';

interface ScreeningBadgeProps {
  recommendation: Recommendation;
  confidence: Confidence;
  className?: string;
}

const confidenceLabels: Record<Confidence, string> = {
  HIGH: 'High confidence',
  MEDIUM: 'Medium confidence',
  LOW: 'Low confidence',
};

export function ScreeningBadge({
  recommendation,
  confidence,
  className,
}: ScreeningBadgeProps) {
  const isGreen = recommendation === 'GREEN';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
            isGreen
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white',
            className
          )}
        >
          {isGreen ? (
            <Check className="h-3 w-3" />
          ) : (
            <X className="h-3 w-3" />
          )}
          {recommendation}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{confidenceLabels[confidence]}</p>
      </TooltipContent>
    </Tooltip>
  );
}
