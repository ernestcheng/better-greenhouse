import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { Header } from '@/components/layout/Header';
import { JobSelector } from '@/components/jobs/JobSelector';
import { ApplicationTable } from '@/components/applications/ApplicationTable';
import { ApplicationDetail } from '@/components/applications/ApplicationDetail';
import { BulkActionBar } from '@/components/applications/BulkActionBar';
import { FilterBar } from '@/components/applications/FilterBar';
import { SearchBar } from '@/components/SearchBar';
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcutsDialog';
import { BulkRejectDialog } from '@/components/BulkRejectDialog';
import { ScreeningSettingsDialog } from '@/components/ScreeningSettingsDialog';
import { DisagreementDialog } from '@/components/DisagreementDialog';

import { useJobs, useJobStages } from '@/hooks/useJobs';
import {
  useApplications,
  useRejectApplication,
  useBulkReject,
  useAdvanceApplication,
  useRejectionReasons,
} from '@/hooks/useApplications';
import { useScreening, useScreeningResults } from '@/hooks/useScreening';
import { useSelection } from '@/hooks/useSelection';
import { useFeedback } from '@/hooks/useFeedback';

import type { Application, Filters, RejectionSettings } from '@/types';

function App() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-based state
  const selectedJobId = searchParams.get('job') ? parseInt(searchParams.get('job')!) : null;
  const currentPage = parseInt(searchParams.get('page') || '1');
  const pageSize = 20;

  // Local state
  const [filters, setFilters] = useState<Filters>({ status: 'active' });
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showBulkRejectDialog, setShowBulkRejectDialog] = useState(false);
  const [showScreeningSettings, setShowScreeningSettings] = useState(false);
  
  // Persisted settings (load from localStorage)
  const [jobRequirements, setJobRequirements] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem('greenhouse-job-requirements');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [rejectionSettings, setRejectionSettings] = useState<RejectionSettings>(() => {
    try {
      const saved = localStorage.getItem('greenhouse-rejection-settings');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [searchResults, setSearchResults] = useState<Array<{ application_id: number; score: number }> | null>(null);
  
  // Disagreement dialog state
  const [pendingAction, setPendingAction] = useState<{
    type: 'ADVANCE' | 'REJECT';
    application: Application;
    llmRecommendation: 'GREEN' | 'RED';
    llmConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
    llmSummary: string;
  } | null>(null);

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem('greenhouse-job-requirements', JSON.stringify(jobRequirements));
  }, [jobRequirements]);

  useEffect(() => {
    localStorage.setItem('greenhouse-rejection-settings', JSON.stringify(rejectionSettings));
  }, [rejectionSettings]);

  // URL navigation helpers
  const setSelectedJobId = useCallback((jobId: number | null) => {
    if (jobId) {
      setSearchParams({ job: jobId.toString(), page: '1' });
    } else {
      setSearchParams({});
    }
    setFocusedIndex(0);
  }, [setSearchParams]);

  const setCurrentPage = useCallback((page: number) => {
    if (selectedJobId) {
      setSearchParams({ job: selectedJobId.toString(), page: page.toString() });
    }
    setFocusedIndex(0);
  }, [selectedJobId, setSearchParams]);

  // Queries
  const { data: jobs, isLoading: isLoadingJobs } = useJobs();
  const { data: stages } = useJobStages(selectedJobId);
  const { data: rejectionReasons } = useRejectionReasons();
  
  // Find Application Review stage ID
  const applicationReviewStage = stages?.find(
    (s) => s.name.toLowerCase().includes('application review')
  );
  
  // Use stage filter if we found Application Review
  const effectiveFilters = {
    ...filters,
    stage_id: applicationReviewStage?.id || filters.stage_id,
  };
  
  const {
    data: applicationsData,
    isLoading: isLoadingApplications,
  } = useApplications(selectedJobId, effectiveFilters, currentPage, pageSize);

  // Screening
  const { data: screeningResults = {} } = useScreeningResults();
  const {
    mutate: screen,
    isPending: isScreening,
    progress: screeningProgress,
  } = useScreening();

  // Actions
  const { mutate: rejectApplication, isPending: isRejecting } = useRejectApplication();
  const { mutate: bulkReject, isPending: isBulkRejecting } = useBulkReject();
  const { mutate: advanceApplication, isPending: isAdvancing } = useAdvanceApplication();

  // Selection
  const selection = useSelection();

  // Feedback tracking
  const { addDisagreement, getJobFeedback } = useFeedback();

  // Get applications from query
  const applications = useMemo(() => {
    return applicationsData?.applications ?? [];
  }, [applicationsData]);
  
  const totalCount = applicationsData?.total ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Apply client-side filters and search
  const filteredApplications = useMemo(() => {
    let result = applications;

    // Apply screening filter
    if (filters.screening && filters.screening !== 'all') {
      result = result.filter((app) => {
        const screenResult = screeningResults[app.id];
        if (filters.screening === 'unscreened') {
          return !screenResult;
        }
        if (filters.screening === 'green') {
          return screenResult?.recommendation === 'GREEN';
        }
        if (filters.screening === 'red') {
          return screenResult?.recommendation === 'RED';
        }
        return true;
      });
    }

    // Apply semantic search results (filter and reorder by relevance)
    if (searchResults && searchResults.length > 0) {
      const searchMap = new Map(searchResults.map(r => [r.application_id, r.score]));
      result = result
        .filter(app => searchMap.has(app.id))
        .sort((a, b) => (searchMap.get(b.id) || 0) - (searchMap.get(a.id) || 0));
    }

    return result;
  }, [applications, screeningResults, filters.screening, searchResults]);

  // Get selected job for screening
  const selectedJob = jobs?.find((j) => j.id === selectedJobId);

  // Handlers
  const handleScreen = useCallback(() => {
    if (!selectedJob || !selectedJobId) return;

    const idsToScreen = selection.hasSelection
      ? selection.selectedArray
      : filteredApplications.map((a) => a.id);

    const appsToScreen = filteredApplications.filter((a) =>
      idsToScreen.includes(a.id)
    );

    if (appsToScreen.length === 0) {
      toast({
        title: 'No applications to screen',
        description: 'Select applications or load more to screen.',
        variant: 'destructive',
      });
      return;
    }

    // Get feedback for this job to calibrate Claude
    const jobFeedback = getJobFeedback(selectedJobId);
    const feedbackForPrompt = jobFeedback.slice(-10).map(f => ({
      candidate_name: f.candidate_name,
      llm_recommendation: f.llm_recommendation,
      user_decision: f.user_decision,
      user_reason: f.user_reason,
    }));

    screen(
      {
        job_id: selectedJobId,
        job_title: selectedJob.name,
        job_requirements: jobRequirements[selectedJobId] || '',
        applications: appsToScreen.map((app) => ({
          application_id: app.id,
          candidate_name: `${app.candidate.first_name} ${app.candidate.last_name}`,
          resume_url: app.attachments.resume,
          cover_letter_url: app.attachments.cover_letter,
          answers: app.answers,
        })),
        feedback: feedbackForPrompt.length > 0 ? feedbackForPrompt : undefined,
      },
      {
        onSuccess: (data) => {
          toast({
            title: 'Screening complete',
            description: `Screened ${data.results.length} applications.`,
            variant: 'success',
          });
          selection.clear();
        },
        onError: (error) => {
          toast({
            title: 'Screening failed',
            description: error.message,
            variant: 'destructive',
          });
        },
      }
    );
  }, [selectedJob, selectedJobId, selection, filteredApplications, screen, toast, getJobFeedback, jobRequirements]);

  // Execute rejection (called directly or after disagreement feedback)
  const executeReject = useCallback((application: Application) => {
    const skillsReason = rejectionReasons?.find(r => 
      r.name.toLowerCase().includes('skill') || r.name.toLowerCase().includes('qualification')
    );
    const rejectionReasonId = skillsReason?.id || rejectionReasons?.[0]?.id;
    
    if (!rejectionReasonId) {
      toast({
        title: 'Error',
        description: 'No rejection reasons available',
        variant: 'destructive',
      });
      return;
    }

    rejectApplication(
      {
        applicationId: application.id,
        rejection_reason_id: rejectionReasonId,
        email_template_id: rejectionSettings.emailTemplateId,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Application rejected',
            description: `${application.candidate.first_name} ${application.candidate.last_name} has been rejected.`,
          });
          setSelectedApplication(null);
        },
        onError: (error) => {
          toast({
            title: 'Rejection failed',
            description: error.message,
            variant: 'destructive',
          });
        },
      }
    );
  }, [rejectionReasons, rejectionSettings, rejectApplication, toast]);

  const handleSingleReject = useCallback(() => {
    if (!selectedApplication) return;

    const screeningResult = screeningResults[selectedApplication.id];
    
    // Check if this is a disagreement (rejecting a GREEN recommendation)
    if (screeningResult && screeningResult.recommendation === 'GREEN') {
      setPendingAction({
        type: 'REJECT',
        application: selectedApplication,
        llmRecommendation: screeningResult.recommendation,
        llmConfidence: screeningResult.confidence,
        llmSummary: screeningResult.summary,
      });
      return;
    }

    // No disagreement, proceed directly
    executeReject(selectedApplication);
  }, [selectedApplication, screeningResults, executeReject]);

  const handleBulkReject = useCallback(
    (rejectionReasonId: number) => {
      bulkReject(
        {
          application_ids: selection.selectedArray,
          rejection_reason_id: rejectionReasonId,
          email_template_id: rejectionSettings.emailTemplateId,
        },
        {
          onSuccess: (data) => {
            toast({
              title: 'Applications rejected',
              description: `${data.rejected.length} applications rejected${
                data.failed.length > 0
                  ? `, ${data.failed.length} failed`
                  : ''
              }.`,
            });
            selection.clear();
            setShowBulkRejectDialog(false);
          },
          onError: (error) => {
            toast({
              title: 'Bulk rejection failed',
              description: error.message,
              variant: 'destructive',
            });
          },
        }
      );
    },
    [selection, bulkReject, rejectionSettings, toast]
  );

  // Execute advance (called directly or after disagreement feedback)
  const executeAdvance = useCallback((application: Application) => {
    if (!application.current_stage) return;

    advanceApplication(
      {
        applicationId: application.id,
        fromStageId: application.current_stage.id,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Application advanced',
            description: `${application.candidate.first_name} ${application.candidate.last_name} has been advanced.`,
            variant: 'success',
          });
          setSelectedApplication(null);
        },
        onError: (error) => {
          toast({
            title: 'Advance failed',
            description: error.message,
            variant: 'destructive',
          });
        },
      }
    );
  }, [advanceApplication, toast]);

  const handleAdvance = useCallback(() => {
    if (!selectedApplication?.current_stage) return;

    const screeningResult = screeningResults[selectedApplication.id];
    
    // Check if this is a disagreement (advancing a RED recommendation)
    if (screeningResult && screeningResult.recommendation === 'RED') {
      setPendingAction({
        type: 'ADVANCE',
        application: selectedApplication,
        llmRecommendation: screeningResult.recommendation,
        llmConfidence: screeningResult.confidence,
        llmSummary: screeningResult.summary,
      });
      return;
    }

    // No disagreement, proceed directly
    executeAdvance(selectedApplication);
  }, [selectedApplication, screeningResults, executeAdvance]);

  // Handle disagreement confirmation
  const handleDisagreementConfirm = useCallback((reason: string) => {
    if (!pendingAction || !selectedJobId) return;

    const { type, application, llmRecommendation, llmConfidence, llmSummary } = pendingAction;
    const candidateName = `${application.candidate.first_name} ${application.candidate.last_name}`;

    // Save feedback if reason provided
    if (reason) {
      addDisagreement({
        application_id: application.id,
        candidate_name: candidateName,
        job_id: selectedJobId,
        llm_recommendation: llmRecommendation,
        llm_confidence: llmConfidence,
        llm_summary: llmSummary,
        user_decision: type,
        user_reason: reason,
      });
    }

    // Execute the action
    if (type === 'REJECT') {
      executeReject(application);
    } else {
      executeAdvance(application);
    }

    setPendingAction(null);
  }, [pendingAction, selectedJobId, addDisagreement, executeReject, executeAdvance]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Don't handle shortcuts when dialogs are open (except Escape)
      if ((showBulkRejectDialog || showScreeningSettings || showKeyboardShortcuts || pendingAction) && e.key !== 'Escape') {
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (selectedApplication) {
            // Move to next application and open it
            const currentIdx = filteredApplications.findIndex(a => a.id === selectedApplication.id);
            if (currentIdx < filteredApplications.length - 1) {
              setSelectedApplication(filteredApplications[currentIdx + 1]);
              setFocusedIndex(currentIdx + 1);
            }
          } else {
            setFocusedIndex((prev) =>
              Math.min(prev + 1, filteredApplications.length - 1)
            );
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (selectedApplication) {
            // Move to previous application and open it
            const currentIdx = filteredApplications.findIndex(a => a.id === selectedApplication.id);
            if (currentIdx > 0) {
              setSelectedApplication(filteredApplications[currentIdx - 1]);
              setFocusedIndex(currentIdx - 1);
            }
          } else {
            setFocusedIndex((prev) => Math.max(prev - 1, 0));
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (!selectedApplication && filteredApplications[focusedIndex]) {
            setSelectedApplication(filteredApplications[focusedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          if (pendingAction) {
            setPendingAction(null);
          } else if (showKeyboardShortcuts) {
            setShowKeyboardShortcuts(false);
          } else if (showBulkRejectDialog) {
            setShowBulkRejectDialog(false);
          } else if (showScreeningSettings) {
            setShowScreeningSettings(false);
          } else if (selectedApplication) {
            setSelectedApplication(null);
          } else {
            selection.clear();
          }
          break;
        case 's':
          e.preventDefault();
          handleScreen();
          break;
        case 'x':
          e.preventDefault();
          if (selectedApplication) {
            handleSingleReject();
          } else if (selection.hasSelection) {
            setShowBulkRejectDialog(true);
          }
          break;
        case 'z':
          e.preventDefault();
          if (selectedApplication) {
            handleAdvance();
          }
          break;
        case 'a':
          e.preventDefault();
          if (!selectedApplication) {
            selection.selectAll(filteredApplications.map((a) => a.id));
          }
          break;
        case '[':
          e.preventDefault();
          if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
          }
          break;
        case ']':
          e.preventDefault();
          if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
          }
          break;
        case '?':
          e.preventDefault();
          setShowKeyboardShortcuts(true);
          break;
        case ',':
          e.preventDefault();
          setShowScreeningSettings(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    filteredApplications,
    focusedIndex,
    selectedApplication,
    selection,
    handleScreen,
    handleSingleReject,
    handleAdvance,
    showBulkRejectDialog,
    showScreeningSettings,
    showKeyboardShortcuts,
    pendingAction,
    currentPage,
    totalPages,
    setCurrentPage,
  ]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <Header
          onKeyboardShortcutsClick={() => setShowKeyboardShortcuts(true)}
          onSettingsClick={() => setShowScreeningSettings(true)}
        />

        <main className="container py-6 space-y-6">
          {/* Job Selector */}
          <div className="flex items-center gap-4">
            <JobSelector
              jobs={jobs}
              selectedJobId={selectedJobId}
              onSelectJob={(jobId) => {
                setSelectedJobId(jobId);
                selection.clear();
                setSearchResults(null);
              }}
              isLoading={isLoadingJobs}
            />
          </div>

          {/* Semantic Search */}
          {selectedJobId && (
            <SearchBar
              jobId={selectedJobId}
              onSearchResults={setSearchResults}
              isSearchActive={searchResults !== null}
            />
          )}

          {/* Filters */}
          {selectedJobId && (
            <FilterBar
              filters={filters}
              onFiltersChange={setFilters}
              totalCount={searchResults ? filteredApplications.length : totalCount}
            />
          )}

          {/* Applications Table */}
          <ApplicationTable
            applications={filteredApplications}
            screeningResults={screeningResults}
            selectedIds={selection.selected}
            focusedIndex={focusedIndex}
            onToggleSelect={selection.toggle}
            onSelectAll={() => {
              const allIds = filteredApplications.map(a => a.id);
              const allSelected = allIds.every(id => selection.selected.has(id));
              if (allSelected) {
                selection.clear();
              } else {
                selection.selectAll(allIds);
              }
            }}
            onOpenDetail={setSelectedApplication}
            onFocusChange={setFocusedIndex}
            isLoading={isLoadingApplications}
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
          />
        </main>

        {/* Application Detail Panel */}
        <ApplicationDetail
          application={selectedApplication}
          screeningResult={
            selectedApplication
              ? screeningResults[selectedApplication.id] || null
              : null
          }
          isOpen={selectedApplication !== null}
          onClose={() => setSelectedApplication(null)}
          onReject={handleSingleReject}
          onAdvance={handleAdvance}
          isRejecting={isRejecting}
          isAdvancing={isAdvancing}
        />

        {/* Bulk Action Bar */}
        <BulkActionBar
          selectedCount={selection.selectedCount}
          onScreen={handleScreen}
          onReject={() => setShowBulkRejectDialog(true)}
          onClear={selection.clear}
          isScreening={isScreening}
          screeningProgress={screeningProgress}
        />

        {/* Dialogs */}
        <KeyboardShortcutsDialog
          isOpen={showKeyboardShortcuts}
          onClose={() => setShowKeyboardShortcuts(false)}
        />

        <BulkRejectDialog
          isOpen={showBulkRejectDialog}
          onClose={() => setShowBulkRejectDialog(false)}
          onConfirm={handleBulkReject}
          selectedCount={selection.selectedCount}
          rejectionReasons={rejectionReasons || []}
          isLoading={isBulkRejecting}
        />

        <ScreeningSettingsDialog
          isOpen={showScreeningSettings}
          onClose={() => setShowScreeningSettings(false)}
          jobRequirements={selectedJobId ? jobRequirements[selectedJobId] || '' : ''}
          rejectionSettings={rejectionSettings}
          onSave={(requirements, newRejectionSettings) => {
            if (selectedJobId) {
              setJobRequirements((prev) => ({
                ...prev,
                [selectedJobId]: requirements,
              }));
            }
            setRejectionSettings(newRejectionSettings);
          }}
          jobTitle={selectedJob?.name}
        />

        <DisagreementDialog
          isOpen={pendingAction !== null}
          onClose={() => setPendingAction(null)}
          onConfirm={handleDisagreementConfirm}
          candidateName={pendingAction ? `${pendingAction.application.candidate.first_name} ${pendingAction.application.candidate.last_name}` : ''}
          llmRecommendation={pendingAction?.llmRecommendation || 'GREEN'}
          userAction={pendingAction?.type || 'REJECT'}
          isLoading={isRejecting || isAdvancing}
        />

        <Toaster />
      </div>
    </TooltipProvider>
  );
}

export default App;
