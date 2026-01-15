import { useState } from 'react';
import { Check, ChevronsUpDown, Briefcase, MapPin, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import type { Job } from '@/types';

interface JobSelectorProps {
  jobs: Job[] | undefined;
  selectedJobId: number | null;
  onSelectJob: (jobId: number) => void;
  isLoading?: boolean;
}

export function JobSelector({
  jobs,
  selectedJobId,
  onSelectJob,
  isLoading,
}: JobSelectorProps) {
  const [open, setOpen] = useState(false);

  const openJobs = jobs?.filter((job) => job.status === 'open') || [];
  const selectedJob = jobs?.find((job) => job.id === selectedJobId);
  const currentIndex = openJobs.findIndex((job) => job.id === selectedJobId);

  const goToPrevJob = () => {
    if (currentIndex > 0) {
      onSelectJob(openJobs[currentIndex - 1].id);
    }
  };

  const goToNextJob = () => {
    if (currentIndex < openJobs.length - 1) {
      onSelectJob(openJobs[currentIndex + 1].id);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-10 w-[500px]" />;
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={goToPrevJob}
        disabled={currentIndex <= 0}
        className="shrink-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[400px] justify-between"
          >
            {selectedJob ? (
              <div className="flex items-center gap-2 truncate">
                <Briefcase className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate font-medium">{selectedJob.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  ({currentIndex + 1}/{openJobs.length})
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">Select a job to review...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search jobs..." />
            <CommandList>
              <CommandEmpty>No jobs found.</CommandEmpty>
              <CommandGroup heading={`${openJobs.length} open jobs`}>
                {openJobs.map((job, index) => (
                  <CommandItem
                    key={job.id}
                    value={`${job.name} ${job.departments.map(d => d.name).join(' ')} ${job.offices.map(o => o.name).join(' ')}`}
                    onSelect={() => {
                      onSelectJob(job.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedJobId === job.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{job.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          #{index + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {job.departments.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {job.departments.map((d) => d.name).join(', ')}
                          </span>
                        )}
                        {job.offices.length > 0 && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.offices.map((o) => o.name).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="icon"
        onClick={goToNextJob}
        disabled={currentIndex >= openJobs.length - 1 || currentIndex === -1}
        className="shrink-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
