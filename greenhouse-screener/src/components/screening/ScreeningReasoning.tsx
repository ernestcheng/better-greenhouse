import { Check, AlertCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { ScreeningBadge } from './ScreeningBadge';
import type { ScreeningResult } from '@/types';

interface ScreeningReasoningProps {
  result: ScreeningResult;
}

export function ScreeningReasoning({ result }: ScreeningReasoningProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI Screening Result</h3>
          <p className="text-sm text-muted-foreground mt-1">{result.summary}</p>
        </div>
        <ScreeningBadge
          recommendation={result.recommendation}
          confidence={result.confidence}
          className="text-sm px-3 py-1"
        />
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-medium text-green-600 mb-2">
            <ThumbsUp className="h-4 w-4" />
            Key Strengths
          </h4>
          <ul className="space-y-2">
            {result.key_factors.map((factor, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>

        {result.concerns.length > 0 && (
          <div>
          <h4 className="flex items-center gap-2 text-sm font-medium text-amber-600 mb-2">
            <ThumbsDown className="h-4 w-4" />
            Concerns
          </h4>
            <ul className="space-y-2">
              {result.concerns.map((concern, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <span>{concern}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">Full Reasoning</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {result.reasoning}
          </p>
        </div>
      </div>
    </div>
  );
}
