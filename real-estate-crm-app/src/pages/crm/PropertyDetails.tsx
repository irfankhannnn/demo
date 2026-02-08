import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Upload,
  X,
  Image as ImageIcon,
  Video as VideoIcon,
  AlertCircle,
  MapPin,
  Users,
  FileText,
  Plus,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { api } from '../../services/api';
import { CRMProperty, CRMOwner, CRMCustomer, CRMPropertyDocument } from '../../types/crm';
import GoogleMapPicker from '../../components/GoogleMapPicker';
import CreateOwnerModal from '../../components/CreateOwnerModal';
import CreateTenantModal from '../../components/CreateTenantModal';
import Toast from '../../components/Toast';
import NumericInput from '../../components/NumericInput';
import FullscreenMediaViewer from '../../components/FullscreenMediaViewer';

type PropertyType = 'apartment' | 'house' | 'villa' | 'office';
type FurnishingType = 'furnished' | 'semi-furnished' | 'unfurnished';
type PropertyStatus = 'available' | 'on_hold' | 'out_of_stock' | 'rented';
type AgreementStatus = 'pending' | 'done';
type VerificationStatus = 'pending' | 'done' | 'not_done';

export default function PropertyDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = !!id;
  const preselectedOwnerId = searchParams.get('ownerId');

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [owners, setOwners] = useState<CRMOwner[]>([]);
  const [customers, setCustomers] = useState<CRMCustomer[]>([]);
  const [property, setProperty] = useState<CRMProperty | null>(null);
  
  // Search states for dropdowns
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const [isOwnerDropdownOpen, setIsOwnerDropdownOpen] = useState(false);
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  
  // Refs for dropdown containers
  const ownerDropdownRef = useRef<HTMLDivElement>(null);
  const tenantDropdownRef = useRef<HTMLDivElement>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVideos, setUploadingVideos] = useState(false);
  const [documents, setDocuments] = useState<CRMPropertyDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [selectedDocumentFiles, setSelectedDocumentFiles] = useState<File[]>([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState<CRMPropertyDocument['documentType']>('PHOTO');
  const [documentDescription, setDocumentDescription] = useState('');
  const [previewDocument, setPreviewDocument] = useState<CRMPropertyDocument | null>(null);
  const [imageViewer, setImageViewer] = useState<{
    items: { url: string; fileName?: string; mimeType?: string }[];
    index: number;
  } | null>(null);
  
  // New features state
  const [showOwnerModal, setShowOwnerModal] = useState(false);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Document uploads for new properties (before property is created)
  const [pendingAgreementDocs, setPendingAgreementDocs] = useState<File[]>([]);
  const [pendingVerificationDocs, setPendingVerificationDocs] = useState<File[]>([]);

  const [formData, setFormData] = useState<{
    ownerId: string;
    title: string;
    description: string;
    propertyType: PropertyType;
    bhk: number;
    area: string;
    city: string;
    address: string;
    flatNumber: string;
    floor: string;
    buildingName: string;
    latitude: string;
    longitude: string;
    carpetArea: number;
    rentAmount: number;
    depositAmount: number;
    furnishing: FurnishingType;
    amenities: string[];
    availableFrom: string;
    status: PropertyStatus;
    tenantCustomerId: string;
    agreementStatus: AgreementStatus;
    verificationStatus: VerificationStatus;
    featured: boolean;
    verified: boolean;
    tenantMoveInDate: string;
    tenureMonths: number;
  }>({
    ownerId: preselectedOwnerId || '',
    title: '',
    description: '',
    propertyType: 'apartment',
    bhk: 2,
    area: '',
    city: '',
    address: '',
    flatNumber: '',
    floor: '',
    buildingName: '',
    latitude: '',
    longitude: '',
    carpetArea: 0,
    rentAmount: 0,
    depositAmount: 0,
    furnishing: 'semi-furnished',
    amenities: [],
    availableFrom: new Date().toISOString().split('T')[0],
    status: 'available',
    tenantCustomerId: '',
    agreementStatus: 'pending',
    verificationStatus: 'pending',
    featured: false,
    verified: false,
    tenantMoveInDate: '',
    tenureMonths: 11,
  });
  
  // State for staged file uploads during property creation
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingVideos, setPendingVideos] = useState<File[]>([]);

  const amenitiesList = [
    'Parking',
    'Lift',
    'Power Backup',
    'Security',
    'Water Supply',
    'Gym',
    'Swimming Pool',
    'Garden',
    'Play Area',
    'Club House',
    'Wi-Fi',
    'AC',
  ];

  const isImageDoc = (doc: { mimeType: string; fileName: string }) => {
    const mime = doc.mimeType?.toLowerCase() || '';
    const name = doc.fileName?.toLowerCase() || '';
    if (mime.startsWith('image/')) return true;
    return /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp)$/i.test(name);
  };

  const isVideoDoc = (doc: { mimeType: string; fileName: string }) => {
    const mime = doc.mimeType?.toLowerCase() || '';
    const name = doc.fileName?.toLowerCase() || '';
    if (mime.startsWith('video/')) return true;
    return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(name);
  };

  useEffect(() => {
    loadOwners();
    loadCustomers();
    if (isEditing && id) {
      loadProperty();
      loadDocuments();
    }
  }, [id, isEditing]);

  // Click outside handler to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(event.target as Node)) {
        setIsOwnerDropdownOpen(false);
      }
      if (tenantDropdownRef.current && !tenantDropdownRef.current.contains(event.target as Node)) {
        setIsTenantDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadOwners = async () => {
    try {
      const data = await api.getOwners();
      setOwners(data.filter((o: CRMOwner) => o.status === 'active'));
    } catch (error) {
      console.error('Error loading owners:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await api.getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadProperty = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await api.getCRMProperty(id);
      setProperty(data);
      setFormData({
        ownerId: data.ownerId || '',
        title: data.title,
        description: data.description || '',
        propertyType: data.propertyType,
        bhk: data.bhk,
        area: data.area,
        city: data.city,
        address: data.address || '',
        flatNumber: data.flatNumber || '',
        floor: data.floor || '',
        buildingName: data.buildingName || '',
        latitude: data.latitude ? String(data.latitude) : '',
        longitude: data.longitude ? String(data.longitude) : '',
        carpetArea: data.carpetArea,
        rentAmount: data.rentAmount,
        depositAmount: data.depositAmount,
        furnishing: data.furnishing,
        amenities: data.amenities || [],
        availableFrom: data.availableFrom || new Date().toISOString().split('T')[0],
        status: data.status,
        tenantCustomerId: data.tenantCustomerId || '',
        agreementStatus: data.agreementStatus || 'pending',
        verificationStatus: data.verificationStatus || 'pending',
        featured: data.featured || false,
        verified: data.verified || false,
        tenantMoveInDate: data.tenantMoveInDate || '',
        tenureMonths: data.tenureMonths || 11,
      });
    } catch (error) {
      console.error('Error loading property:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    if (!id) return;
    try {
      setLoadingDocuments(true);
      const data = await api.getPropertyDocuments(id);
      setDocuments(data);
    } catch (error) {
      console.error('Error loading property documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Owner is now optional - can create properties without owner (unassigned)

    // Convert form data to API format (string lat/lng to numbers)
    const apiData = {
      ...formData,
      ownerId: formData.ownerId || null, // Allow null for unassigned properties
      latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
      longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
      tenantCustomerId: formData.tenantCustomerId || undefined,
      tenantMoveInDate: formData.tenantMoveInDate || undefined,
      tenureMonths: formData.tenureMonths || undefined,
    };

    try {
      setSaving(true);
      if (isEditing && id) {
        await api.updateCRMProperty(id, apiData);
        // Upload any pending images/videos for editing
        if (pendingImages.length > 0) {
          await api.uploadPropertyImages(id, pendingImages);
          setPendingImages([]);
        }
        if (pendingVideos.length > 0) {
          await api.uploadPropertyVideos(id, pendingVideos);
          setPendingVideos([]);
        }
        setToast({ message: 'Property updated successfully!', type: 'success' });
      } else {
        // Create property first, then upload pending media and documents
        const newProperty = await api.createCRMProperty(apiData);
        const newPropertyId = newProperty.propertyId;

        let hadUploadFailure = false;
        
        // Upload pending images if any
        if (pendingImages.length > 0 && newPropertyId) {
          try {
            await api.uploadPropertyImages(newPropertyId, pendingImages);
          } catch (e) {
            hadUploadFailure = true;
            console.error('Error uploading images during create:', e);
          }
        }
        // Upload pending videos if any
        if (pendingVideos.length > 0 && newPropertyId) {
          try {
            await api.uploadPropertyVideos(newPropertyId, pendingVideos);
          } catch (e) {
            hadUploadFailure = true;
            console.error('Error uploading videos during create:', e);
          }
        }
        
        // Upload agreement document if provided
        if (pendingAgreementDocs.length > 0 && newPropertyId) {
          try {
            await api.uploadPropertyDocuments(newPropertyId, pendingAgreementDocs, 'AGREEMENT', 'Rental Agreement');
          } catch (e) {
            hadUploadFailure = true;
            console.error('Error uploading agreement document during create:', e);
          }
        }
        
        // Upload police verification document if provided
        if (pendingVerificationDocs.length > 0 && newPropertyId) {
          try {
            await api.uploadPropertyDocuments(newPropertyId, pendingVerificationDocs, 'VERIFICATION', 'Police Verification');
          } catch (e) {
            hadUploadFailure = true;
            console.error('Error uploading verification document during create:', e);
          }
        }

        if (hadUploadFailure) {
          setToast({
            message: 'Property created, but some uploads failed. Please edit the property and retry uploads.',
            type: 'error',
          });
          if (newPropertyId) {
            navigate(`/crm/properties/${newPropertyId}`);
          }
          return;
        }

        setToast({ message: 'Property created successfully!', type: 'success' });
      }
      
      // Navigate back after a short delay to show the success message
      setTimeout(() => {
        navigate('/crm/properties');
      }, 1500);
    } catch (error) {
      console.error('Error saving property:', error);
      setToast({ message: 'Failed to save property. Please try again.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !id) return;

    try {
      setUploadingImages(true);
      const files = Array.from(e.target.files);
      await api.uploadPropertyImages(id, files);
      await loadProperty(); // Reload to show new images
      e.target.value = ''; // Reset input
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !id) return;

    try {
      setUploadingVideos(true);
      const files = Array.from(e.target.files);
      await api.uploadPropertyVideos(id, files);
      await loadProperty(); // Reload to show new videos
      e.target.value = ''; // Reset input
    } catch (error) {
      console.error('Error uploading videos:', error);
      if (error instanceof Error && error.message.toLowerCase().includes('token')) {
        navigate('/login');
        return;
      }
      alert('Failed to upload videos');
    } finally {
      setUploadingVideos(false);
    }
  };

  const handleDeleteImage = async (imageKey: string) => {
    if (!id || !confirm('Delete this image?')) return;

    try {
      await api.deletePropertyImage(id, imageKey);
      await loadProperty();
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Failed to delete image');
    }
  };

  const handleDeleteVideo = async (videoKey: string) => {
    if (!id || !confirm('Delete this video?')) return;

    try {
      await api.deletePropertyVideo(id, videoKey);
      await loadProperty();
    } catch (error) {
      console.error('Error deleting video:', error);
      alert('Failed to delete video');
    }
  };

  const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setSelectedDocumentFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleUploadDocument = async () => {
    if (!id || selectedDocumentFiles.length === 0) return;
    try {
      setUploadingDocument(true);
      await api.uploadPropertyDocuments(id, selectedDocumentFiles, selectedDocumentType, documentDescription || undefined);
      setSelectedDocumentFiles([]);
      setDocumentDescription('');
      await loadDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!id || !confirm('Delete this document?')) return;
    try {
      await api.deletePropertyDocument(id, documentId);
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  };

  // Filtered lists based on search
  const filteredOwners = owners.filter(owner => 
    owner.name.toLowerCase().includes(ownerSearchQuery.toLowerCase()) ||
    owner.phone.includes(ownerSearchQuery)
  );

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(tenantSearchQuery.toLowerCase()) ||
    customer.phone.includes(tenantSearchQuery)
  );

  const selectedOwner = owners.find(o => o.ownerId === formData.ownerId);
  const selectedCustomer = customers.find(c => c.customerId === formData.tenantCustomerId);

  const toggleAmenity = (amenity: string) => {
    const current = formData.amenities;
    const updated = current.includes(amenity)
      ? current.filter((a) => a !== amenity)
      : [...current, amenity];
    setFormData({ ...formData, amenities: updated });
  };

  // Handler when new owner is created from modal
  const handleOwnerCreated = async (ownerId: string, ownerName: string) => {
    // Refresh owners list
    await loadOwners();
    // Auto-select the newly created owner
    setFormData((prev) => ({ ...prev, ownerId }));
    setToast({ message: `Owner "${ownerName}" created successfully!`, type: 'success' });
  };

  // Handler when new tenant is created from modal
  const handleTenantCreated = async (tenantId: string, tenantName: string) => {
    setCustomers((prev) => {
      const exists = prev.some((c) => c.customerId === tenantId);
      if (exists) return prev;
      return [...prev, { customerId: tenantId, name: tenantName } as CRMCustomer];
    });
    setFormData((prev) => ({ ...prev, tenantCustomerId: tenantId }));
    setToast({ message: `Tenant "${tenantName}" created successfully!`, type: 'success' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-gray-600 animate-pulse">Loading property...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm/properties')}
                className="p-1.5 sm:p-2 hover:bg-white/50 rounded-xl transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                    {isEditing ? 'Edit Property' : 'New Property'}
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {isEditing ? 'Update property information' : 'Add a new property listing'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              {/* Basic Info */}
              <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 shadow-xl p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Basic Information</h2>

                <div className="space-y-4">
                  {/* Owner Selection - Now Optional */}
                  <div className="relative" ref={ownerDropdownRef}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Owner <span className="text-gray-400 text-xs">(Optional)</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <button
                          type="button"
                          onClick={() => setIsOwnerDropdownOpen(!isOwnerDropdownOpen)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-left bg-white flex items-center justify-between"
                        >
                          <span className={selectedOwner ? 'text-gray-900' : 'text-gray-500'}>
                            {selectedOwner ? `${selectedOwner.name} - ${selectedOwner.phone}` : 'Unassigned / No Owner'}
                          </span>
                          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {isOwnerDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                            <div className="p-2 border-b border-gray-200">
                              <input
                                type="text"
                                placeholder="Search by name or phone..."
                                value={ownerSearchQuery}
                                onChange={(e) => setOwnerSearchQuery(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            <div className="py-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, ownerId: '' });
                                  setIsOwnerDropdownOpen(false);
                                  setOwnerSearchQuery('');
                                }}
                                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${!formData.ownerId ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}`}
                              >
                                Unassigned / No Owner
                              </button>
                              {filteredOwners.map((owner) => (
                                <button
                                  key={owner.ownerId}
                                  type="button"
                                  onClick={() => {
                                    setFormData({ ...formData, ownerId: owner.ownerId });
                                    setIsOwnerDropdownOpen(false);
                                    setOwnerSearchQuery('');
                                  }}
                                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${formData.ownerId === owner.ownerId ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}`}
                                >
                                  {owner.name} - {owner.phone}
                                </button>
                              ))}
                              {filteredOwners.length === 0 && ownerSearchQuery && (
                                <div className="px-4 py-2 text-sm text-gray-500">
                                  No owners found
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowOwnerModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shrink-0"
                        title="Add New Owner"
                      >
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">Add New</span>
                      </button>
                    </div>
                    {!formData.ownerId && (
                      <p className="mt-1 text-xs text-amber-600">
                        Property will be created without an owner. You can assign one later.
                      </p>
                    )}
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Property Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Spacious 2BHK Apartment in Andheri"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Describe the property..."
                    />
                  </div>

                  {/* Property Type & BHK */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Property Type
                      </label>
                      <select
                        value={formData.propertyType}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            propertyType: e.target.value as
                              | 'apartment'
                              | 'house'
                              | 'villa'
                              | 'office',
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="apartment">Apartment</option>
                        <option value="house">House</option>
                        <option value="villa">Villa</option>
                        <option value="office">Office</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        BHK
                      </label>
                      <NumericInput
                        min={1}
                        max={10}
                        value={formData.bhk}
                        onChange={(val) => setFormData({ ...formData, bhk: val || 1 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="2"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Location</h2>

                {/* Map Location Picker - Now at Top */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="inline h-4 w-4 mr-1" />
                    Property Location on Map
                  </label>
                  <GoogleMapPicker
                    latitude={formData.latitude}
                    longitude={formData.longitude}
                    onLocationChange={(lat, lng) => {
                      setFormData({ ...formData, latitude: lat, longitude: lng });
                    }}
                    onAddressExtracted={(address) => {
                      setFormData((prev) => ({
                        ...prev,
                        ...(address.area && { area: address.area }),
                        ...(address.city && { city: address.city }),
                        ...(address.buildingName && { buildingName: address.buildingName }),
                        ...(address.fullAddress && { address: address.fullAddress }),
                      }));
                    }}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Search for location or click on map to set coordinates
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Area <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Andheri West"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Mumbai"
                    />
                  </div>

                  {/* Building Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Building Name
                    </label>
                    <input
                      type="text"
                      value={formData.buildingName}
                      onChange={(e) => setFormData({ ...formData, buildingName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Sunshine Towers"
                    />
                  </div>

                  {/* Floor */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Floor
                    </label>
                    <input
                      type="text"
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="5th Floor"
                    />
                  </div>

                  {/* Flat Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Flat / Unit Number
                    </label>
                    <input
                      type="text"
                      value={formData.flatNumber}
                      onChange={(e) => setFormData({ ...formData, flatNumber: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="501"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Address
                    </label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Street, landmark, directions..."
                    />
                  </div>
                </div>
              </div>

              {/* Pricing & Details */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Pricing & Details</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Carpet Area (sq.ft) <span className="text-red-500">*</span>
                    </label>
                    <NumericInput
                      required
                      min={0}
                      value={formData.carpetArea}
                      onChange={(val) => setFormData({ ...formData, carpetArea: val })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter carpet area"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monthly Rent (₹) <span className="text-red-500">*</span>
                    </label>
                    <NumericInput
                      required
                      min={0}
                      value={formData.rentAmount}
                      onChange={(val) => setFormData({ ...formData, rentAmount: val })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter monthly rent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deposit Amount (₹)
                    </label>
                    <NumericInput
                      min={0}
                      value={formData.depositAmount}
                      onChange={(val) => setFormData({ ...formData, depositAmount: val })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter deposit amount"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Furnishing
                    </label>
                    <select
                      value={formData.furnishing}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          furnishing: e.target.value as
                            | 'furnished'
                            | 'semi-furnished'
                            | 'unfurnished',
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="furnished">Furnished</option>
                      <option value="semi-furnished">Semi-Furnished</option>
                      <option value="unfurnished">Unfurnished</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Available From
                    </label>
                    <input
                      type="date"
                      value={formData.availableFrom}
                      onChange={(e) => setFormData({ ...formData, availableFrom: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as
                            | 'available'
                            | 'on_hold'
                            | 'out_of_stock'
                            | 'rented',
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="available">Available</option>
                      <option value="on_hold">On Hold</option>
                      <option value="out_of_stock">Out of Stock</option>
                      <option value="rented">Rented</option>
                    </select>
                  </div>

                  {/* Tenant Selection */}
                  {formData.status !== 'available' && (
                    <>
                      {/* Tenant Selection */}
                      <div className="relative md:col-span-2" ref={tenantDropdownRef}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Users className="inline h-4 w-4 mr-1" />
                          Tenant (Customer)
                        </label>
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <button
                              type="button"
                              onClick={() => setIsTenantDropdownOpen(!isTenantDropdownOpen)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-left bg-white flex items-center justify-between"
                            >
                              <span className={selectedCustomer ? 'text-gray-900' : 'text-gray-500'}>
                                {selectedCustomer ? `${selectedCustomer.name} - ${selectedCustomer.phone}` : 'No Tenant'}
                              </span>
                              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            
                            {isTenantDropdownOpen && (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                                <div className="p-2 border-b border-gray-200">
                                  <input
                                    type="text"
                                    placeholder="Search by name or phone..."
                                    value={tenantSearchQuery}
                                    onChange={(e) => setTenantSearchQuery(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormData({ ...formData, tenantCustomerId: '' });
                                      setIsTenantDropdownOpen(false);
                                      setTenantSearchQuery('');
                                    }}
                                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${!formData.tenantCustomerId ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}`}
                                  >
                                    No Tenant
                                  </button>
                                  {filteredCustomers.map((customer) => (
                                    <button
                                      key={customer.customerId}
                                      type="button"
                                      onClick={() => {
                                        setFormData({ ...formData, tenantCustomerId: customer.customerId });
                                        setIsTenantDropdownOpen(false);
                                        setTenantSearchQuery('');
                                      }}
                                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${formData.tenantCustomerId === customer.customerId ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}`}
                                    >
                                      {customer.name} - {customer.phone}
                                    </button>
                                  ))}
                                  {filteredCustomers.length === 0 && tenantSearchQuery && (
                                    <div className="px-4 py-2 text-sm text-gray-500">
                                      No tenants found
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowTenantModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                            title="Add New Tenant"
                          >
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">Add New</span>
                          </button>
                        </div>
                      </div>

                      {/* Agreement Status */}
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Agreement Status
                        </label>
                        <select
                          value={formData.agreementStatus}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              agreementStatus: e.target.value as 'pending' | 'done',
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="pending">Pending</option>
                          <option value="done">Done</option>
                        </select>
                      </div>

                      {/* Verification Status */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Verification Status
                        </label>
                        <select
                          value={formData.verificationStatus}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              verificationStatus: e.target.value as 'pending' | 'done' | 'not_done',
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="pending">Pending</option>
                          <option value="done">Done</option>
                          <option value="not_done">Not Done</option>
                        </select>
                      </div>

                      {/* Tenant Move-in Date */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Calendar className="inline h-4 w-4 mr-1" />
                          Tenant Move-in Date
                        </label>
                        <input
                          type="date"
                          value={formData.tenantMoveInDate}
                          onChange={(e) => setFormData({ ...formData, tenantMoveInDate: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>

                      {/* Agreement Tenure */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Agreement Tenure (Months)
                        </label>
                        <NumericInput
                          min={1}
                          max={120}
                          value={formData.tenureMonths}
                          onChange={(val) => setFormData({ ...formData, tenureMonths: val || 11 })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="11"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Common tenures: 11, 22, 33 months
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Amenities */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Amenities</h2>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {amenitiesList.map((amenity) => (
                    <label
                      key={amenity}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.amenities.includes(amenity)}
                        onChange={() => toggleAmenity(amenity)}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">{amenity}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Options */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Options</h2>

                <div className="space-y-3">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Featured Property</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.verified}
                      onChange={(e) => setFormData({ ...formData, verified: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Verified Property</span>
                  </label>
                </div>
              </div>

              {/* Images - Available for both new and editing */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Images</h2>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        if (!e.target.files) return;
                        if (isEditing && id) {
                          handleImageUpload(e);
                        } else {
                          // Store files for upload after property creation
                          const files = Array.from(e.target.files);
                          setPendingImages(prev => [...prev, ...files]);
                          e.target.value = '';
                        }
                      }}
                      className="hidden"
                      disabled={uploadingImages}
                    />
                    <div className="flex items-center space-x-2 px-3 py-1 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">
                        {uploadingImages ? 'Uploading...' : 'Add Images'}
                      </span>
                    </div>
                  </label>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {/* Show pending images for new property */}
                  {!isEditing && pendingImages.length > 0 && (
                    <>
                      {pendingImages.map((file, index) => (
                        <div
                          key={`pending-${index}`}
                          className="relative group rounded-lg overflow-hidden border border-purple-200 bg-purple-50"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const items = pendingImages.map((f) => ({
                                url: URL.createObjectURL(f),
                                fileName: f.name,
                                mimeType: f.type,
                              }));
                              setPreviewDocument(null);
                              setImageViewer({ items, index });
                            }}
                            className="block w-full"
                          >
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Pending ${index + 1}`}
                              className="w-full h-32 object-cover"
                            />
                          </button>
                          <div className="absolute top-2 left-2 px-2 py-1 bg-purple-600 text-white text-xs rounded">
                            Pending
                          </div>
                          <button
                            type="button"
                            onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== index))}
                            className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                  
                  {/* Show uploaded images for existing property */}
                  {isEditing && property && property.images && property.images.length > 0 ? (
                    property.images.map((img) => (
                      <div
                        key={img.key}
                        className="relative group rounded-lg overflow-hidden border border-gray-200"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const items = (property.images || []).map((i) => ({
                              url: i.url,
                              fileName: i.key?.split('/').pop() || 'image',
                              mimeType: 'image/*',
                            }));
                            const idx = items.findIndex((i) => i.url === img.url);
                            setPreviewDocument(null);
                            setImageViewer({ items, index: idx >= 0 ? idx : 0 });
                          }}
                          className="block w-full"
                        >
                          <img
                            src={img.url}
                            alt="Property"
                            className="w-full h-32 object-cover"
                          />
                        </button>
                        {img.url && (
                          <a
                            href={img.url}
                            download={img.key.split('/').pop() || 'image'}
                            className="absolute bottom-2 left-2 px-2 py-1 bg-white/80 text-xs text-gray-700 rounded shadow hover:bg-white"
                          >
                            Download
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(img.key)}
                          className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  ) : (!isEditing && pendingImages.length === 0) || (isEditing && (!property?.images || property.images.length === 0)) ? (
                    <div className="text-center py-8 text-gray-500">
                      <ImageIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">{isEditing ? 'No images yet' : 'Add images to upload'}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Videos - Available for both new and editing */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Videos</h2>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={(e) => {
                        if (!e.target.files) return;
                        if (isEditing && id) {
                          handleVideoUpload(e);
                        } else {
                          // Store files for upload after property creation
                          const files = Array.from(e.target.files);
                          setPendingVideos(prev => [...prev, ...files]);
                          e.target.value = '';
                        }
                      }}
                      className="hidden"
                      disabled={uploadingVideos}
                    />
                    <div className="flex items-center space-x-2 px-3 py-1 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">
                        {uploadingVideos ? 'Uploading...' : 'Add Videos'}
                      </span>
                    </div>
                  </label>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {/* Show pending videos for new property */}
                  {!isEditing && pendingVideos.length > 0 && (
                    <>
                      {pendingVideos.map((file, index) => (
                        <div
                          key={`pending-video-${index}`}
                          className="border border-purple-200 bg-purple-50 rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <VideoIcon className="h-5 w-5 text-purple-600" />
                              <span className="text-sm text-gray-700 truncate">
                                {file.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded">
                                Pending
                              </span>
                              <button
                                type="button"
                                onClick={() => setPendingVideos(prev => prev.filter((_, i) => i !== index))}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Show uploaded videos for existing property */}
                  {isEditing && property && property.videos && property.videos.length > 0 ? (
                    property.videos.map((vid) => (
                      <div
                        key={vid.key}
                        className="border border-gray-200 rounded-lg p-3 space-y-2"
                      >
                        <div className="rounded-md overflow-hidden bg-black">
                          <video
                            src={vid.url}
                            className="w-full h-32"
                            controls
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 truncate mr-2">
                            {vid.key.split('/').pop()}
                          </span>
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            {vid.url && (
                              <a
                                href={vid.url}
                                download={vid.key.split('/').pop() || 'video'}
                                className="text-xs text-purple-600 hover:text-purple-800"
                              >
                                Download
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteVideo(vid.key)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (!isEditing && pendingVideos.length === 0) || (isEditing && (!property?.videos || property.videos.length === 0)) ? (
                    <div className="text-center py-8 text-gray-500">
                      <VideoIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">{isEditing ? 'No videos yet' : 'Add videos to upload'}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {isEditing && (
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex flex-col space-y-1">
                      <label className="text-sm font-medium text-gray-700">
                        Document Type
                      </label>
                      <select
                        value={selectedDocumentType}
                        onChange={(e) =>
                          setSelectedDocumentType(e.target.value as CRMPropertyDocument['documentType'])
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="PHOTO">Photo</option>
                        <option value="VIDEO">Video</option>
                        <option value="AGREEMENT">Agreement</option>
                        <option value="VERIFICATION">Verification</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div className="flex flex-col space-y-1">
                      <label className="text-sm font-medium text-gray-700">
                        Description (optional)
                      </label>
                      <input
                        type="text"
                        value={documentDescription}
                        onChange={(e) => setDocumentDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g. Signed agreement, police verification PDF"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleDocumentFileChange}
                        />
                        <div className="flex items-center space-x-2 px-3 py-1 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100">
                          <Upload className="h-4 w-4" />
                          <span className="text-sm">
                            {selectedDocumentFiles.length > 0
                              ? `${selectedDocumentFiles.length} file(s) selected`
                              : 'Choose file(s)'}
                          </span>
                        </div>
                      </label>
                      <button
                        type="button"
                        onClick={handleUploadDocument}
                        disabled={selectedDocumentFiles.length === 0 || uploadingDocument}
                        className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        {uploadingDocument ? 'Uploading...' : 'Upload'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {loadingDocuments ? (
                      <p className="text-sm text-gray-500">Loading documents...</p>
                    ) : documents.length > 0 ? (
                      (() => {
                        const typeOrder: CRMPropertyDocument['documentType'][] = [
                          'AGREEMENT',
                          'VERIFICATION',
                          'PHOTO',
                          'VIDEO',
                          'OTHER',
                        ];

                        const labelForType = (type: CRMPropertyDocument['documentType']) => {
                          if (type === 'AGREEMENT') return 'Agreement';
                          if (type === 'VERIFICATION') return 'Verification';
                          if (type === 'PHOTO') return 'Photo';
                          if (type === 'VIDEO') return 'Video';
                          return 'Other';
                        };

                        const grouped = documents.reduce((acc, doc) => {
                          const t = (doc.documentType || 'OTHER') as CRMPropertyDocument['documentType'];
                          (acc[t] ||= []).push(doc);
                          return acc;
                        }, {} as Record<CRMPropertyDocument['documentType'], CRMPropertyDocument[]>);

                        const typesWithDocs = typeOrder.filter((t) => (grouped[t] || []).length > 0);

                        return (
                          <div className="space-y-4">
                            {typesWithDocs.map((type) => (
                              <div key={type} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-semibold text-gray-700">
                                    {labelForType(type)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {(grouped[type] || []).length}
                                  </div>
                                </div>

                                {(grouped[type] || []).map((doc) => (
                                  <div
                                    key={doc.documentId}
                                    className="flex items-center justify-between p-2 border border-gray-200 rounded-lg"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => doc.url && setPreviewDocument(doc)}
                                      className="flex items-center space-x-2 flex-1 min-w-0 text-left"
                                    >
                                      {isVideoDoc(doc) ? (
                                        <VideoIcon className="h-4 w-4 text-purple-600 flex-shrink-0" />
                                      ) : isImageDoc(doc) ? (
                                        <ImageIcon className="h-4 w-4 text-purple-600 flex-shrink-0" />
                                      ) : (
                                        <FileText className="h-4 w-4 text-purple-600 flex-shrink-0" />
                                      )}
                                      <span className="text-sm text-gray-700 truncate">{doc.fileName}</span>
                                    </button>
                                    <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                                      {doc.url && (
                                        <a
                                          href={doc.url}
                                          download={doc.fileName}
                                          className="text-xs text-purple-600 hover:text-purple-800"
                                        >
                                          Download
                                        </a>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDocument(doc.documentId)}
                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No documents yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!isEditing && (
                <div className="space-y-6">
                  {/* Agreement Document Upload for New Property */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="h-5 w-5 text-purple-600" />
                      <h2 className="text-lg font-semibold text-gray-900">Agreement Document</h2>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Upload rental agreement during property creation
                    </p>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,image/*"
                          onChange={(e) => {
                            if (!e.target.files || e.target.files.length === 0) return;
                            setPendingAgreementDocs(Array.from(e.target.files));
                            e.target.value = '';
                          }}
                          className="hidden"
                          multiple
                        />
                        <div className="flex flex-col items-center">
                          <Upload className="h-8 w-8 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-600">
                            {pendingAgreementDocs.length > 0 ? (
                              <span className="text-purple-600 font-medium">
                                ✓ {pendingAgreementDocs.length} file(s) selected
                              </span>
                            ) : (
                              'Click to upload agreement'
                            )}
                          </span>
                        </div>
                      </label>
                      {pendingAgreementDocs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPendingAgreementDocs([])}
                          className="mt-2 text-xs text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Police Verification Document Upload for New Property */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldCheck className="h-5 w-5 text-purple-600" />
                      <h2 className="text-lg font-semibold text-gray-900">Police Verification</h2>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Upload police verification document during property creation
                    </p>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,image/*"
                          onChange={(e) => {
                            if (!e.target.files || e.target.files.length === 0) return;
                            setPendingVerificationDocs(Array.from(e.target.files));
                            e.target.value = '';
                          }}
                          className="hidden"
                          multiple
                        />
                        <div className="flex flex-col items-center">
                          <Upload className="h-8 w-8 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-600">
                            {pendingVerificationDocs.length > 0 ? (
                              <span className="text-purple-600 font-medium">
                                ✓ {pendingVerificationDocs.length} file(s) selected
                              </span>
                            ) : (
                              'Click to upload verification'
                            )}
                          </span>
                        </div>
                      </label>
                      {pendingVerificationDocs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPendingVerificationDocs([])}
                          className="mt-2 text-xs text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <AlertCircle className="h-5 w-5 text-blue-600 mb-2" />
                    <p className="text-sm text-blue-800">
                      Documents will be uploaded when you save the property.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <FullscreenMediaViewer
            isOpen={!!(previewDocument && previewDocument.url)}
            onClose={() => setPreviewDocument(null)}
            media={{
              url: previewDocument?.url || '',
              fileName: previewDocument?.fileName,
              mimeType: previewDocument?.mimeType,
            }}
          />

          <FullscreenMediaViewer
            isOpen={!!imageViewer}
            onClose={() => setImageViewer(null)}
            media={{
              url: imageViewer?.items?.[imageViewer.index]?.url || '',
              fileName: imageViewer?.items?.[imageViewer.index]?.fileName,
              mimeType: imageViewer?.items?.[imageViewer.index]?.mimeType,
            }}
            allMedia={imageViewer?.items}
            currentIndex={imageViewer?.index}
            onNavigate={(index) =>
              setImageViewer((prev) => (prev ? { ...prev, index } : prev))
            }
          />

          {/* Submit Actions */}
          <div className="mt-8 flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/crm/properties')}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
              <span>{saving ? 'Saving...' : 'Save Property'}</span>
            </button>
          </div>
        </form>
      </main>

      {/* Modals */}
      {showOwnerModal && (
        <CreateOwnerModal
          onClose={() => setShowOwnerModal(false)}
          onOwnerCreated={handleOwnerCreated}
        />
      )}

      {showTenantModal && (
        <CreateTenantModal
          onClose={() => setShowTenantModal(false)}
          onTenantCreated={handleTenantCreated}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
