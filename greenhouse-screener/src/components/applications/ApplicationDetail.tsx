import { Mail, Phone, X, ThumbsDown, ThumbsUp } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResumeViewer } from './ResumeViewer';
import { ScreeningReasoning } from '@/components/screening/ScreeningReasoning';
import { ScreeningBadge } from '@/components/screening/ScreeningBadge';
import type { Application, ScreeningResult } from '@/types';

interface ApplicationDetailProps {
  application: Application | null;
  screeningResult: ScreeningResult | null;
  isOpen: boolean;
  onClose: () => void;
  onReject: () => void;
  onAdvance: () => void;
  isRejecting?: boolean;
  isAdvancing?: boolean;
}

export function ApplicationDetail({
  application,
  screeningResult,
  isOpen,
  onClose,
  onReject,
  onAdvance,
  isRejecting,
  isAdvancing,
}: ApplicationDetailProps) {
  if (!application || !isOpen) return null;

  const { candidate, applied_at, source, current_stage, answers, attachments } = application;
  const fullName = `${candidate.first_name} ${candidate.last_name}`;

  // Default to screening tab if screened, otherwise resume
  const defaultTab = screeningResult ? 'screening' : 'resume';

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-4xl bg-background shadow-xl flex flex-col animate-slide-in-right">
        {/* Header with Actions */}
        <div className="flex items-center justify-between gap-4 p-4 border-b bg-muted/30">
          <div className="flex items-center gap-4 min-w-0">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold truncate">{fullName}</h2>
                {screeningResult && (
                  <ScreeningBadge
                    recommendation={screeningResult.recommendation}
                    confidence={screeningResult.confidence}
                  />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Applied {formatRelativeTime(applied_at)}
                {source && ` via ${source.name}`}
                {current_stage && ` • ${current_stage.name}`}
              </p>
            </div>
          </div>
          
          {/* Action Buttons at Top */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={onReject}
              disabled={isRejecting || isAdvancing}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <ThumbsDown className="h-4 w-4 mr-2" />
              {isRejecting ? 'Rejecting...' : 'Reject'}
            </Button>
            <Button
              variant="default"
              onClick={onAdvance}
              disabled={isRejecting || isAdvancing}
            >
              <ThumbsUp className="h-4 w-4 mr-2" />
              {isAdvancing ? 'Advancing...' : 'Advance'}
            </Button>
          </div>
        </div>

        {/* Contact Info Bar */}
        <div className="flex items-center gap-6 px-6 py-3 border-b text-sm">
          <a
            href={`mailto:${candidate.email}`}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Mail className="h-4 w-4" />
            {candidate.email}
          </a>
          {candidate.phone && (
            <a
              href={`tel:${candidate.phone}`}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Phone className="h-4 w-4" />
              {candidate.phone}
            </a>
          )}
        </div>

        {/* Tabs Content - key forces re-render when application changes */}
        <Tabs key={application.id} defaultValue={defaultTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
            <TabsTrigger 
              value="screening" 
              disabled={!screeningResult}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
            >
              AI Screening
            </TabsTrigger>
            <TabsTrigger 
              value="resume"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
            >
              Resume
            </TabsTrigger>
            <TabsTrigger 
              value="cover_letter"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
            >
              Cover Letter
            </TabsTrigger>
            <TabsTrigger 
              value="answers"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
            >
              Answers ({answers.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="screening" className="m-0 p-6">
              {screeningResult && (
                <div className="max-w-2xl">
                  <ScreeningReasoning result={screeningResult} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="resume" className="m-0 p-6 h-full">
              <ResumeViewer url={attachments.resume} type="resume" />
            </TabsContent>

            <TabsContent value="cover_letter" className="m-0 p-6 h-full">
              <ResumeViewer url={attachments.cover_letter} type="cover_letter" />
            </TabsContent>

            <TabsContent value="answers" className="m-0 p-6">
              {answers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No application answers
                </div>
              ) : (
                <div className="space-y-6 max-w-2xl">
                  {answers.map((qa, index) => (
                    <div key={index} className="space-y-2">
                      <p className="font-medium">{qa.question}</p>
                      <p className="text-muted-foreground">{qa.answer}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </>
  );
}
