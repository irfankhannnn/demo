import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Video, Loader2, Camera as CameraIcon } from 'lucide-react';
import { canUseNativeCamera, capturePhoto, pickPhotos } from '../lib/nativeCamera';

interface MediaItem {
  url?: string;
  s3Key?: string;
  title?: string;
  type?: 'image' | 'video';
}

interface MediaUploadSectionProps {
  title: string;
  type: 'images' | 'videos';
  items: MediaItem[];
  onUpload: (files: File[]) => Promise<void>;
  onDelete: (s3Key: string) => Promise<void>;
  maxFiles?: number;
  accept?: string;
}

export default function MediaUploadSection({
  title,
  type,
  items = [],
  onUpload,
  onDelete,
  maxFiles = 20,
  accept = type === 'images' ? 'image/*' : 'video/*',
}: MediaUploadSectionProps) {
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

    const files = Array.from(e.dataTransfer.files);
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

  // Camera capture only makes sense for images; video capture would need a
  // different plugin, so video uploads keep the file picker on native too.
  const showCameraActions = canUseNativeCamera() && type === 'images';

  const handleTakePhoto = async () => {
    const photo = await capturePhoto('camera');
    if (photo) await handleFiles([photo]);
  };

  const handlePickFromGallery = async () => {
    const photos = await pickPhotos(maxFiles);
    if (photos.length > 0) await handleFiles(photos);
  };

  const handleFiles = async (files: File[]) => {
    if (files.length > maxFiles) {
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
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      setDeleting(s3Key);
      await onDelete(s3Key);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete item');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        {type === 'images' ? <ImageIcon className="h-5 w-5 mr-2 text-blue-600" /> : <Video className="h-5 w-5 mr-2 text-purple-600" />}
        {title}
      </h3>

      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleFileInput}
          className="hidden"
          disabled={uploading}
        />
        
        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />

        {/*
          On a phone, a broker standing in front of a property should be able to
          photograph it without leaving the app. None of the 21 file inputs in
          the codebase carries a `capture` attribute, so the only route was the
          OS file picker. Drag & drop is meaningless on touch, so native gets a
          camera/gallery pair instead.
        */}
        {showCameraActions ? (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={handleTakePhoto}
              disabled={uploading}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <CameraIcon className="h-4 w-4" />
              Take photo
            </button>
            <button
              type="button"
              onClick={handlePickFromGallery}
              disabled={uploading}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg bg-slate-100 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              <ImageIcon className="h-4 w-4" />
              Choose from gallery
            </button>
          </div>
        ) : (
          <p className="text-gray-600 mb-2">
            Drag &amp; drop {type} here, or{' '}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-blue-600 hover:text-blue-700 font-semibold"
              disabled={uploading}
            >
              browse
            </button>
          </p>
        )}

        <p className="text-sm text-gray-500 mt-2">
          Max {maxFiles} files, {type === 'images' ? 'JPG, PNG, GIF' : 'MP4, MOV, AVI'} (up to 100MB each)
        </p>

        {uploading && (
          <div className="mt-4 flex items-center justify-center text-blue-600">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Uploading...
          </div>
        )}
      </div>

      {/* Media Grid */}
      {items.length > 0 && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.filter(item => item.s3Key && item.url).map((item) => (
            <div key={item.s3Key!} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                {type === 'images' ? (
                  <img
                    src={item.url!}
                    alt={item.title || 'Image'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    src={item.url!}
                    className="w-full h-full object-cover"
                    controls
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(item.s3Key!)}
                disabled={deleting === item.s3Key}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
              >
                {deleting === item.s3Key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </button>
              {item.title && (
                <p className="mt-1 text-xs text-gray-600 truncate">{item.title}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && !uploading && (
        <p className="mt-4 text-sm text-gray-500 text-center">No {type} uploaded yet</p>
      )}
    </div>
  );
}
