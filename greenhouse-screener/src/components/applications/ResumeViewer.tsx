import { Download, ExternalLink, FileText, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResumeViewerProps {
  url?: string;
  type?: 'resume' | 'cover_letter';
}

function getProxyUrl(url: string): string {
  return `/api/attachments/proxy?url=${encodeURIComponent(url)}`;
}

function getFileExtension(url: string): string {
  // Extract filename from URL (before query params)
  const urlPath = url.split('?')[0];
  const filename = urlPath.split('/').pop() || '';
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext;
}

function isPdfViewable(url: string): boolean {
  const ext = getFileExtension(url);
  return ext === 'pdf';
}

function getFileTypeName(url: string): string {
  const ext = getFileExtension(url);
  switch (ext) {
    case 'pdf': return 'PDF';
    case 'doc': return 'Word Document (.doc)';
    case 'docx': return 'Word Document (.docx)';
    case 'txt': return 'Text File';
    case 'rtf': return 'Rich Text Format';
    default: return ext.toUpperCase() || 'Document';
  }
}

export function ResumeViewer({ url, type = 'resume' }: ResumeViewerProps) {
  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-muted/50 rounded-lg">
        <FileText className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">
          No {type === 'resume' ? 'resume' : 'cover letter'} attached
        </p>
      </div>
    );
  }

  const proxyUrl = getProxyUrl(url);
  const canDisplayInline = isPdfViewable(url);
  const fileType = getFileTypeName(url);

  // For non-PDF files, show a download prompt
  if (!canDisplayInline) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-muted/50 rounded-lg">
        <FileWarning className="h-12 w-12 text-amber-500 mb-3" />
        <p className="text-lg font-medium mb-1">{fileType}</p>
        <p className="text-muted-foreground mb-6 text-center max-w-md">
          This file type cannot be previewed in the browser. 
          Download to view in Microsoft Word or another application.
        </p>
        <Button asChild>
          <a href={proxyUrl} download>
            <Download className="mr-2 h-4 w-4" />
            Download {type === 'resume' ? 'Resume' : 'Cover Letter'}
          </a>
        </Button>
      </div>
    );
  }

  // For PDFs, show inline viewer
  const viewerUrl = `${proxyUrl}#view=FitH&toolbar=1`;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" asChild>
          <a href={proxyUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open in new tab
          </a>
        </Button>
      </div>
      <object
        data={viewerUrl}
        type="application/pdf"
        className="w-full h-[600px] rounded-lg border bg-white"
      >
        <div className="flex flex-col items-center justify-center h-[600px] bg-muted/50 rounded-lg">
          <FileText className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">
            Unable to display PDF inline
          </p>
          <Button variant="outline" asChild>
            <a href={proxyUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open PDF in new tab
            </a>
          </Button>
        </div>
      </object>
    </div>
  );
}
