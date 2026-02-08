import { useState, useRef } from 'react';
import { Upload, X, FileText, Download, Loader2 } from 'lucide-react';

interface PDFDocument {
  url: string;
  s3Key: string;
  name: string;
  uploadedAt?: string;
}

interface PDFUploadSectionProps {
  title: string;
  description: string;
  items: PDFDocument[];
  onUpload: (files: File[]) => Promise<void>;
  onDelete: (s3Key: string) => Promise<void>;
  maxFiles?: number;
  singleFile?: boolean;
}

export default function PDFUploadSection({
  title,
  description,
  items = [],
  onUpload,
  onDelete,
  maxFiles = 10,
  singleFile = false,
}: PDFUploadSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const files = Array.from(e.dataTransfer.files).filter(f => 
      f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    
    if (files.length > 0) {
      await handleFiles(files);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      await handleFiles(files);
    }
  };

  const handleFiles = async (files: File[]) => {
    if (singleFile && files.length > 1) {
      alert('Only one file allowed');
      return;
    }

    if (!singleFile && files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    try {
      setUploading(true);
      await onUpload(files);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (s3Key: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      setDeleting(s3Key);
      await onDelete(s3Key);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete document');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center">
        <FileText className="h-5 w-5 mr-2 text-red-600" />
        {title}
      </h3>
      <p className="text-sm text-gray-600 mb-4">{description}</p>

      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          dragActive ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={!singleFile}
          accept="application/pdf,.pdf"
          onChange={handleFileInput}
          className="hidden"
          disabled={uploading}
        />
        
        <FileText className="h-10 w-10 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-600 mb-2">
          Drag & drop PDF {singleFile ? 'file' : 'files'} here, or{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-red-600 hover:text-red-700 font-semibold"
            disabled={uploading}
          >
            browse
          </button>
        </p>
        <p className="text-xs text-gray-500">
          {singleFile ? '1 PDF file' : `Max ${maxFiles} PDF files`} (up to 100MB each)
        </p>

        {uploading && (
          <div className="mt-4 flex items-center justify-center text-red-600">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Uploading...
          </div>
        )}
      </div>

      {/* Documents List */}
      {items.length > 0 && (
        <div className="mt-4 space-y-2">
          {items.map((doc) => (
            <div
              key={doc.s3Key}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center min-w-0 flex-1">
                <FileText className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                  {doc.uploadedAt && (
                    <p className="text-xs text-gray-500">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="View PDF"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(doc.s3Key)}
                  disabled={deleting === doc.s3Key}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  {deleting === doc.s3Key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && !uploading && (
        <p className="mt-4 text-sm text-gray-500 text-center">No documents uploaded yet</p>
      )}
    </div>
  );
}
