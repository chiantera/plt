export type FileStatus = 'pending' | 'uploading' | 'complete' | 'error' | 'alreadyExists'

/**
 * Wrapper object for the file upload with progress and status
 */
export interface FileUpload {
  id: string
  file: File
  status: FileStatus
  progress: number
  error?: Error
}
