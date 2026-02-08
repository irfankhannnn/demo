import { Upload, Download, FileText, Image as ImageIcon, X } from 'lucide-react';
import { useState } from 'react';

interface PDFViewerModalProps {
  url: string;
  title: string;
  onClose: () => void;
}

function PDFViewerModal({ url, title, onClose }: PDFViewerModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center gap-2">
            <a
              href={url}
              download
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="flex-1 p-4 overflow-hidden">
          <iframe
            src={url}
            title={title}
            className="w-full h-full rounded border"
          />
        </div>
      </div>
    </div>
  );
}

interface DocumentUploadSectionProps {
  entityId: string;
  entityType: 'owner' | 'customer' | 'buyer' | 'seller';
  documents: {
    photoUrl?: string | null;
    panDocUrl?: string | null;
    aadharDocUrl?: string | null;
  };
  onUpload: (docType: 'photo' | 'pan' | 'aadhar', file: File) => Promise<void>;
  uploadingDoc: string | null;
  isNew?: boolean;
}

export default function DocumentUploadSection({
  entityType,
  documents,
  onUpload,
  uploadingDoc,
  isNew = false,
}: DocumentUploadSectionProps) {
  const [viewingPDF, setViewingPDF] = useState<{ url: string; title: string } | null>(null);

  const handleFileChange = async (docType: 'photo' | 'pan' | 'aadhar', file: File) => {
    await onUpload(docType, file);
  };

  const isPDF = (url: string) => url.toLowerCase().includes('.pdf');

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">KYC Documents</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* PAN Card */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
          <div className="text-center">
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 mb-1">PAN Card</p>
            <p className="text-xs text-gray-500 mb-2">Upload PAN document</p>
            {documents.panDocUrl && (
              <div className="mt-2 space-y-2">
                {isPDF(documents.panDocUrl) ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <button
                      onClick={() => setViewingPDF({ url: documents.panDocUrl!, title: 'PAN Card' })}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View PDF
                    </button>
                    <a
                      href={documents.panDocUrl}
                      download
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                    </a>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <img
                      src={documents.panDocUrl}
                      alt="PAN Card"
                      className="w-full h-32 object-contain mx-auto rounded border"
                    />
                    <a
                      href={documents.panDocUrl}
                      download
                      className="text-xs text-blue-600 hover:underline flex items-center justify-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </a>
                  </div>
                )}
              </div>
            )}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              id={`${entityType}-pan-upload`}
              onChange={(e) => e.target.files?.[0] && handleFileChange('pan', e.target.files[0])}
              disabled={uploadingDoc === 'pan' || isNew}
            />
            <label
              htmlFor={`${entityType}-pan-upload`}
              className={`inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 cursor-pointer text-sm mt-2 ${
                uploadingDoc === 'pan' || isNew ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {uploadingDoc === 'pan' ? 'Uploading...' : 'Choose File'}
            </label>
          </div>
        </div>

        {/* Aadhar Card */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
          <div className="text-center">
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 mb-1">Aadhar Card</p>
            <p className="text-xs text-gray-500 mb-2">Upload Aadhar document</p>
            {documents.aadharDocUrl && (
              <div className="mt-2 space-y-2">
                {isPDF(documents.aadharDocUrl) ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <button
                      onClick={() => setViewingPDF({ url: documents.aadharDocUrl!, title: 'Aadhar Card' })}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View PDF
                    </button>
                    <a
                      href={documents.aadharDocUrl}
                      download
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                    </a>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <img
                      src={documents.aadharDocUrl}
                      alt="Aadhar Card"
                      className="w-full h-32 object-contain mx-auto rounded border"
                    />
                    <a
                      href={documents.aadharDocUrl}
                      download
                      className="text-xs text-blue-600 hover:underline flex items-center justify-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </a>
                  </div>
                )}
              </div>
            )}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              id={`${entityType}-aadhar-upload`}
              onChange={(e) => e.target.files?.[0] && handleFileChange('aadhar', e.target.files[0])}
              disabled={uploadingDoc === 'aadhar' || isNew}
            />
            <label
              htmlFor={`${entityType}-aadhar-upload`}
              className={`inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 cursor-pointer text-sm mt-2 ${
                uploadingDoc === 'aadhar' || isNew ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {uploadingDoc === 'aadhar' ? 'Uploading...' : 'Choose File'}
            </label>
          </div>
        </div>

        {/* Photo */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
          <div className="text-center">
            <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 mb-1">Photo</p>
            <p className="text-xs text-gray-500 mb-2">Upload photo</p>
            {documents.photoUrl && (
              <div className="mt-2 space-y-1">
                <img
                  src={documents.photoUrl}
                  alt="Profile"
                  className="w-24 h-24 rounded-full mx-auto object-cover border-2 border-gray-200"
                />
                <a
                  href={documents.photoUrl}
                  download
                  className="text-xs text-blue-600 hover:underline flex items-center justify-center gap-1"
                >
                  <Download className="h-3 w-3" />
                  Download
                </a>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id={`${entityType}-photo-upload`}
              onChange={(e) => e.target.files?.[0] && handleFileChange('photo', e.target.files[0])}
              disabled={uploadingDoc === 'photo' || isNew}
            />
            <label
              htmlFor={`${entityType}-photo-upload`}
              className={`inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 cursor-pointer text-sm mt-2 ${
                uploadingDoc === 'photo' || isNew ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {uploadingDoc === 'photo' ? 'Uploading...' : 'Choose File'}
            </label>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-4">
        Supported formats: Images (JPG, PNG) and PDF for documents
      </p>
      {isNew && (
        <p className="text-xs text-amber-600 mt-2">
          Save the record first to upload documents
        </p>
      )}
      {viewingPDF && (
        <PDFViewerModal
          url={viewingPDF.url}
          title={viewingPDF.title}
          onClose={() => setViewingPDF(null)}
        />
      )}
    </div>
  );
}
