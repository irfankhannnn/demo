import { useEffect, useCallback } from 'react';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';

interface MediaItem {
  url: string;
  fileName?: string;
  mimeType?: string;
  type?: 'image' | 'video' | 'pdf' | 'document';
}

interface FullscreenMediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem;
  allMedia?: MediaItem[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
}

export default function FullscreenMediaViewer({
  isOpen,
  onClose,
  media,
  allMedia,
  currentIndex = 0,
  onNavigate,
}: FullscreenMediaViewerProps) {
  const detectMediaType = (item: MediaItem): 'image' | 'video' | 'pdf' | 'document' => {
    if (item.type) return item.type;
    
    const mime = item.mimeType?.toLowerCase() || '';
    const name = item.fileName?.toLowerCase() || item.url?.toLowerCase() || '';
    
    if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(name)) {
      return 'video';
    }
    if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|svg)$/i.test(name)) {
      return 'image';
    }
    if (mime === 'application/pdf' || /\.pdf$/i.test(name)) {
      return 'pdf';
    }
    return 'document';
  };

  const mediaType = detectMediaType(media);
  const hasNavigation = allMedia && allMedia.length > 1 && onNavigate;
  const canGoPrev = hasNavigation && currentIndex > 0;
  const canGoNext = hasNavigation && currentIndex < (allMedia?.length || 0) - 1;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowLeft' && canGoPrev && onNavigate) {
      onNavigate(currentIndex - 1);
    } else if (e.key === 'ArrowRight' && canGoNext && onNavigate) {
      onNavigate(currentIndex + 1);
    }
  }, [onClose, canGoPrev, canGoNext, currentIndex, onNavigate]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !media?.url) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderMedia = () => {
    switch (mediaType) {
      case 'video':
        return (
          <video
            src={media.url}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] w-auto h-auto rounded-lg shadow-2xl"
          />
        );
      case 'image':
        return (
          <img
            src={media.url}
            alt={media.fileName || 'Media'}
            className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
          />
        );
      case 'pdf':
        return (
          <iframe
            src={media.url}
            title={media.fileName || 'PDF Document'}
            className="w-[90vw] h-[85vh] max-w-5xl bg-white rounded-lg shadow-2xl"
          />
        );
      default:
        return (
          <div className="bg-white rounded-lg p-8 shadow-2xl text-center max-w-md">
            <div className="text-6xl mb-4">📄</div>
            <p className="text-gray-700 font-medium mb-4">{media.fileName || 'Document'}</p>
            <p className="text-gray-500 text-sm mb-6">
              This document type cannot be previewed. Please download to view.
            </p>
            <a
              href={media.url}
              download={media.fileName}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Download className="w-5 h-5" />
              Download File
            </a>
          </div>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors group"
        title="Close (Esc)"
      >
        <X className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
      </button>

      {/* Navigation - Previous */}
      {canGoPrev && (
        <button
          onClick={() => onNavigate?.(currentIndex - 1)}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors group"
          title="Previous (←)"
        >
          <ChevronLeft className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Navigation - Next */}
      {canGoNext && (
        <button
          onClick={() => onNavigate?.(currentIndex + 1)}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors group"
          title="Next (→)"
        >
          <ChevronRight className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Media Content */}
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {renderMedia()}
      </div>

      {/* Bottom bar with filename and download */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="text-white">
            <p className="font-medium truncate max-w-md">
              {media.fileName || 'Media file'}
            </p>
            {hasNavigation && (
              <p className="text-sm text-white/60 mt-1">
                {currentIndex + 1} of {allMedia?.length}
              </p>
            )}
          </div>
          <a
            href={media.url}
            download={media.fileName}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <Download className="w-5 h-5" />
            <span>Download</span>
          </a>
        </div>
      </div>

      {/* Click hint */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/40 text-sm">
        Click outside or press Esc to close
      </div>
    </div>
  );
}
