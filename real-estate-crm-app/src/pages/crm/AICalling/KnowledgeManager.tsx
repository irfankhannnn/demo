import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { aiCallingApi } from '../../../services/aiCallingApi';
import type { KnowledgeDocument, KnowledgeCategory, DocumentStatus } from '../../../types/aiCalling';

const categories: { value: KnowledgeCategory; label: string; description: string }[] = [
  { value: 'faq', label: 'FAQs', description: 'Frequently asked questions' },
  { value: 'policies', label: 'Policies', description: 'Rental policies and rules' },
  { value: 'agency_info', label: 'Agency Info', description: 'About your agency' },
  { value: 'pricing', label: 'Pricing', description: 'Pricing guidelines' },
];

const statusConfig: Record<DocumentStatus, { color: string; icon: React.ReactNode; label: string }> = {
  uploading: { color: 'text-blue-600', icon: <Loader2 className="w-4 h-4 animate-spin" />, label: 'Uploading' },
  processing: { color: 'text-yellow-600', icon: <Clock className="w-4 h-4" />, label: 'Processing' },
  indexed: { color: 'text-green-600', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Indexed' },
  failed: { color: 'text-red-600', icon: <XCircle className="w-4 h-4" />, label: 'Failed' },
};

export default function KnowledgeManager() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory | 'all'>('all');
  const [uploadCategory, setUploadCategory] = useState<KnowledgeCategory>('faq');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const docs = await aiCallingApi.getDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error('Error loading documents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);

      await aiCallingApi.uploadDocument(file, uploadCategory);
      
      // Reload documents
      await loadDocuments();
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error uploading document:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      await aiCallingApi.deleteDocument(documentId);
      setDocuments(docs => docs.filter(d => d.documentId !== documentId));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting document:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const filteredDocuments = selectedCategory === 'all'
    ? documents
    : documents.filter(d => d.category === selectedCategory);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm/ai-calling')}
                className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 rounded-xl hover:bg-white/50 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Knowledge Base</h1>
                <p className="text-xs sm:text-sm text-gray-500">Upload documents for AI agent to reference</p>
              </div>
            </div>
            <button
              onClick={loadDocuments}
              className="p-2 sm:p-2.5 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white transition-all shadow-sm"
              title="Refresh"
             aria-label="Refresh data">
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-bold text-gray-900 mb-4">Upload Document</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setUploadCategory(cat.value)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      uploadCategory === cat.value
                        ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900 text-sm">{cat.label}</p>
                    <p className="text-xs text-gray-500">{cat.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">File</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`h-full min-h-[120px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  uploading
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                }`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                    <p className="text-sm text-indigo-600">Uploading...</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Click to upload</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, TXT, DOCX (max 10MB)</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.docx,.doc"
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading}
              />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All ({documents.length})
          </button>
          {categories.map((cat) => {
            const count = documents.filter(d => d.category === cat.value).length;
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Documents List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
              <p className="text-gray-500">Loading documents...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="p-12 text-center">
              <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No documents</h3>
              <p className="text-gray-500">Upload documents to train your AI agent</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredDocuments.map((doc) => {
                const status = statusConfig[doc.status];
                return (
                  <div key={doc.documentId} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <FileText className="w-6 h-6 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{doc.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-500 capitalize">{doc.category}</span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500">{formatFileSize(doc.fileSize)}</span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500">{formatDate(doc.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`flex items-center gap-1 text-sm ${status.color}`}>
                          {status.icon}
                          {status.label}
                        </span>
                        {deleteConfirm === doc.documentId ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDelete(doc.documentId)}
                              className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(doc.documentId)}
                            className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
