import { useState, useEffect } from 'react';
import { Image as ImageIcon, Upload, X } from 'lucide-react';
import { api } from '../../services/api';
import type { FlatDetails, Document } from '../../types/admin';

interface DocumentsTabProps {
  flat: FlatDetails;
  onUpdate: () => void;
}

export default function DocumentsTab({ flat, onUpdate }: DocumentsTabProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  // Close preview on Escape key
  useEffect(() => {
    if (!previewDoc) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewDoc(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewDoc]);

  const isImageDoc = (doc: Document) => {
    const mime = doc.mimeType?.toLowerCase() || '';
    const name = doc.fileName?.toLowerCase() || '';
    if (mime.startsWith('image/')) return true;
    return /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp)$/i.test(name);
  };

  const isVideoDoc = (doc: Document) => {
    const mime = doc.mimeType?.toLowerCase() || '';
    const name = doc.fileName?.toLowerCase() || '';
    if (mime.startsWith('video/')) return true;
    return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(name);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    try {
      setUploading(true);
      for (const file of selectedFiles) {
        await api.uploadDocument(flat.flatId, file, 'flat_image');
      }
      setSelectedFiles([]);
      onUpdate();
      alert('Documents uploaded successfully');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to upload documents');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      await api.deleteDocument(flat.flatId, 'flat_image', docId);
      onUpdate();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete document');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Flat Images & Videos</h2>
      </div>

      {/* Upload Section */}
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6">
        <div className="text-center">
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <label className="cursor-pointer">
            <span className="text-blue-600 hover:text-blue-700 font-medium">Choose files</span>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
          <p className="text-sm text-gray-500 mt-2">or drag and drop</p>
          <p className="text-xs text-gray-400 mt-1">Images and videos up to 50MB</p>
        </div>

        {selectedFiles.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Selected: {selectedFiles.length} file(s)
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedFiles.map((file, index) => (
                <span key={index} className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  {file.name}
                </span>
              ))}
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium"
            >
              {uploading ? 'Uploading...' : 'Upload Files'}
            </button>
          </div>
        )}
      </div>

      {/* Gallery */}
      {flat.documents && flat.documents.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {flat.documents.map((doc) => {
            const isImage = isImageDoc(doc);
            const isVideo = isVideoDoc(doc);

            return (
              <div key={doc.documentId} className="relative group">
                <div
                  className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200"
                >
                  {isImage && doc.url ? (
                    <img
                      src={doc.url}
                      alt={doc.fileName}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setPreviewDoc(doc)}
                    />
                  ) : isVideo && doc.url ? (
                    <div
                      className="w-full h-full cursor-pointer"
                      onClick={() => setPreviewDoc(doc)}
                    >
                      <video
                        src={doc.url}
                        className="w-full h-full object-cover"
                        muted
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => doc.url && setPreviewDoc(doc)}
                    >
                      <ImageIcon className="w-12 h-12 text-gray-400 mb-1" />
                      <span className="text-xs text-gray-600 px-2 text-center truncate max-w-full">
                        {doc.fileName || 'View document'}
                      </span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1 truncate">{doc.fileName}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No documents uploaded yet</p>
        </div>
      )}

      {/* Document Preview Modal (image or video) */}
      {previewDoc && previewDoc.url && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewDoc(null)}
              className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100"
            >
              <X className="w-6 h-6" />
            </button>

            {isVideoDoc(previewDoc) ? (
              <video
                src={previewDoc.url}
                controls
                autoPlay
                className="w-full max-h-[70vh] bg-black rounded-lg"
              />
            ) : isImageDoc(previewDoc) ? (
              <img
                src={previewDoc.url}
                alt={previewDoc.fileName}
                className="w-full max-h-[70vh] object-contain rounded-lg"
              />
            ) : (
              <iframe
                src={previewDoc.url}
                title={previewDoc.fileName || 'Document preview'}
                className="w-full max-h-[70vh] bg-white rounded-lg"
              />
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-white">
              <span className="truncate max-w-xs md:max-w-md">{previewDoc.fileName}</span>
              <a
                href={previewDoc.url}
                download={previewDoc.fileName}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium"
              >
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
