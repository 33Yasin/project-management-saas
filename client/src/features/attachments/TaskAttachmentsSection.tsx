import { useState, useRef } from 'react';
import { useTaskAttachments } from './use-attachments';
import { useAuth } from '@/features/auth/use-auth';
import type { Attachment } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Paperclip,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Download,
  Trash2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface TaskAttachmentsSectionProps {
  taskId: string;
  isWorkspaceAdminOrOwner?: boolean;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return <ImageIcon className="size-4 text-purple-500" />;
  }
  if (mimeType === 'application/pdf') {
    return <FileText className="size-4 text-rose-500" />;
  }
  if (
    mimeType.includes('sheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv')
  ) {
    return <FileSpreadsheet className="size-4 text-emerald-500" />;
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return <FileText className="size-4 text-blue-500" />;
  }
  return <File className="size-4 text-muted-foreground" />;
}

export function TaskAttachmentsSection({
  taskId,
  isWorkspaceAdminOrOwner = false,
}: TaskAttachmentsSectionProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    attachments,
    isLoading,
    isError,
    uploadAttachment,
    isUploading,
    deleteAttachment,
  } = useTaskAttachments(taskId);

  const handleFile = async (file: File) => {
    setErrorMessage(null);
    try {
      await uploadAttachment(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to upload file.');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFile(e.target.files[0]);
    }
  };

  const handleDownload = (attachment: Attachment) => {
    // Navigate or trigger download endpoint directly
    window.open(`/api/attachments/${attachment.id}/download`, '_blank');
  };

  const handleDelete = async (attachmentId: string) => {
    setErrorMessage(null);
    try {
      await deleteAttachment(attachmentId);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete attachment.');
    }
  };

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Paperclip className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold tracking-wide">
              Attachments
            </CardTitle>
          </div>
          {attachments.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
              {attachments.length} {attachments.length === 1 ? 'file' : 'files'}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Drag & Drop Upload Zone */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-border/80 hover:border-primary/60 hover:bg-muted/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleChange}
            disabled={isUploading}
          />
          <div className="flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            {isUploading ? (
              <div className="flex items-center gap-2 text-primary font-medium">
                <Loader2 className="size-5 animate-spin" />
                <span>Uploading attachment...</span>
              </div>
            ) : (
              <>
                <div className="p-2 rounded-full bg-muted/60 text-foreground/80">
                  <UploadCloud className="size-5" />
                </div>
                <div>
                  <span className="font-semibold text-foreground">Click to upload</span> or drag and drop
                </div>
                <div className="text-[11px] text-muted-foreground/80">
                  PDF, Images, Word, Excel, Text (max 10MB)
                </div>
              </>
            )}
          </div>
        </div>

        {/* Error alert */}
        {errorMessage && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-md border border-destructive/20">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Attachments List */}
        {isLoading ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            Loading attachments...
          </div>
        ) : isError ? (
          <div className="py-4 text-center text-xs text-destructive">
            Failed to load attachments.
          </div>
        ) : attachments.length === 0 ? (
          <div className="py-2 text-center text-xs text-muted-foreground">
            No attachments yet.
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((att) => {
              const canDelete =
                att.uploadedById === user?.id || isWorkspaceAdminOrOwner;

              return (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors text-xs group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 rounded-md bg-background border border-border/40 shrink-0">
                      {getFileIcon(att.mimeType)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate max-w-[280px] sm:max-w-[380px]" title={att.originalName}>
                        {att.originalName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatBytes(att.sizeBytes)} • {att.uploadedBy?.name || 'Unknown'} •{' '}
                        {new Date(att.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Download file"
                      aria-label={`Download ${att.originalName}`}
                      onClick={() => handleDownload(att)}
                      className="h-7 w-7 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      <Download className="size-3.5" />
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete file"
                        aria-label={`Delete ${att.originalName}`}
                        onClick={() => handleDelete(att.id)}
                        className="h-7 w-7 p-0 cursor-pointer text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
export default TaskAttachmentsSection;
