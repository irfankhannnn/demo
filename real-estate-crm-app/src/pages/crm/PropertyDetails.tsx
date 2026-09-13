import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
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
  Key,
} from 'lucide-react';
import { api } from '../../services/api';
import { CRMProperty, CRMOwner, CRMCustomer, CRMPropertyDocument } from '../../types/crm';
import { KhataPartyType } from '../../types/khata';
import GoogleMapPicker from '../../components/GoogleMapPicker';
import CreateTenantModal from '../../components/CreateTenantModal';
import Toast from '../../components/Toast';
import NumericInput from '../../components/NumericInput';
import FullscreenMediaViewer from '../../components/FullscreenMediaViewer';
import { PermissionGuard } from '../../components/PermissionGuard';
import PropertyPublishControl from '../../components/PropertyPublishControl';

type PropertyType = 'apartment' | 'house' | 'villa' | 'office';
type FurnishingType = 'furnished' | 'semi-furnished' | 'unfurnished';
type PropertyStatus = 'inactive' | 'not-listed' | 'available' | 'for-sale' | 'for-rent' | 'rented' | 'sold' | 'on-hold' | 'out-of-stock' | 'archived';
type AgreementStatus = 'pending' | 'done';
type VerificationStatus = 'pending' | 'done' | 'not_done';

function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function getActiveRentalEntry(property?: Pick<CRMProperty, 'rentalHistory'> | null) {
  const history = property?.rentalHistory;
  if (!Array.isArray(history) || history.length === 0) return null;
  return history.find((entry) => !entry.leaseEndDate) || history[history.length - 1];
}

function isRentalListingStatus(status: PropertyStatus): boolean {
  return status === 'for-rent' || status === 'available' || status === 'not-listed';
}

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
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  
  // Refs for dropdown containers
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
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Sale Modal States
  const [buyers, setBuyers] = useState<any[]>([]);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [savingRental, setSavingRental] = useState(false);
  const [saleForm, setSaleForm] = useState<{
    saleType: 'direct' | 'third_party';
    soldPrice: number;
    buyerId: string;
    brokerageAmount: number;
    brokerageLost: number;
    reasonLost: string;
    customReasonLost: string;
    notes: string;
  }>({
    saleType: 'direct',
    soldPrice: 0,
    buyerId: '',
    brokerageAmount: 0,
    brokerageLost: 0,
    reasonLost: '',
    customReasonLost: '',
    notes: ''
  });
  const [rentalForm, setRentalForm] = useState({
    customerId: '',
    monthlyRent: 0,
    securityDeposit: 0,
    brokeragePaid: 0,
    leaseStartDate: new Date().toISOString().split('T')[0],
    leaseEndDate: '',
    notes: '',
  });
  
  // Track original status to detect changes for auto-brokerage
  const [originalStatus, setOriginalStatus] = useState<string>('');
  
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
    salePrice: number;
    furnishing: FurnishingType;
    amenities: string[];
    availableFrom: string;
    status: PropertyStatus;
    tenantCustomerId: string;
    brokerageAmount: number;
    expectedBrokerage: number;
    agreementStatus: AgreementStatus;
    verificationStatus: VerificationStatus;
    featured: boolean;
    verified: boolean;
    tenantMoveInDate: string;
    leaseEndDate: string;
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
    salePrice: 0,
    furnishing: 'semi-furnished',
    amenities: [],
    availableFrom: new Date().toISOString().split('T')[0],
    status: 'available',
    tenantCustomerId: '',
    brokerageAmount: 0,
    expectedBrokerage: 0,
    agreementStatus: 'pending',
    verificationStatus: 'pending',
    featured: false,
    verified: false,
    tenantMoveInDate: '',
    leaseEndDate: '',
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
    if (!isEditing && preselectedOwnerId) {
      loadOwners();
    }
    loadCustomers();
    loadBuyers();
    if (isEditing && id) {
      loadProperty();
      loadDocuments();
    }
  }, [id, isEditing, preselectedOwnerId]);

  // Click outside handler to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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
      // Include all current owners (active + inactive shells that still own property)
      const data = await api.getOwners({ status: 'all' });
      setOwners(data);
    } catch (error) {
      console.error('Error loading owners:', error);
    }
  };

  const ensureOwnerInDropdown = async (propertyData: typeof property) => {
    if (!propertyData) return;
    let ownerId = propertyData.ownerId || '';
    if (!ownerId && propertyData.currentOwnerContactId) {
      try {
        const contact = await api.getContact(propertyData.currentOwnerContactId);
        ownerId = contact?.linkedOwnerId || '';
      } catch {
        /* best-effort */
      }
    }
    if (!ownerId && propertyData.ownershipHistory?.length) {
      const latest = propertyData.ownershipHistory[propertyData.ownershipHistory.length - 1];
      ownerId = latest?.toOwnerId || '';
    }
    if (!ownerId) return;

    setOwners((prev) => {
      if (prev.some((o) => o.ownerId === ownerId)) return prev;
      const snapshot = propertyData.ownerSnapshot;
      return [
        ...prev,
        {
          ownerId,
          name: propertyData.ownerName || snapshot?.name || 'Current owner',
          phone: propertyData.ownerPhone || snapshot?.phone || '',
          // ownerSnapshot carries only { name, phone, contactId } — the
          // backend never writes an email onto it, so this was always ''.
          email: '',
          status: 'inactive',
          address: '',
          createdAt: propertyData.updatedAt || propertyData.createdAt || '',
        } as CRMOwner,
      ];
    });
    setFormData((prev) => ({ ...prev, ownerId }));
  };

  const loadCustomers = async () => {
    try {
      // getCustomers() goes through fetchAllPaginated, which already unwraps
      // the { customers, total, limit, offset } envelope and follows every
      // page — so this is a flat array. The old `Array.isArray(data) ? data :
      // data.customers` guard predated that and its else-branch was
      // unreachable, which is what tsc was reporting as `type 'never'`.
      setCustomers(await api.getCustomers());
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadBuyers = async () => {
    try {
      const data = await api.getBuyers();
      setBuyers(Array.isArray(data) ? data : (data.buyers || []));
    } catch (error) {
      console.error('Error loading buyers:', error);
    }
  };

  const loadProperty = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await api.getCRMProperty(id);
      setProperty(data);
      setOriginalStatus(data.status);

      // Normalize legacy post-sale status for the form
      const normalizedStatus = (data.status === 'sold' || data.status === 'available' || data.status === 'inactive')
        && data.listingStatus !== 'active'
        ? 'not-listed'
        : data.status;

      let currentOwnerId = data.ownerId || '';
      if (!currentOwnerId && data.currentOwnerContactId) {
        try {
          const contact = await api.getContact(data.currentOwnerContactId);
          currentOwnerId = contact?.linkedOwnerId || data.ownerId || '';
        } catch {
          currentOwnerId = data.ownerId || '';
        }
      }
      if (!currentOwnerId && data.ownershipHistory?.length) {
        const latestOwnership = data.ownershipHistory[data.ownershipHistory.length - 1];
        if (latestOwnership.toOwnerId) {
          currentOwnerId = latestOwnership.toOwnerId;
        }
      }

      const activeRental = getActiveRentalEntry(data);
      const isRented = data.status === 'rented';
      const rentAmount = isRented
        ? (data.rentalInfo?.currentRent ?? activeRental?.monthlyRent ?? data.rentAmount ?? 0)
        : (data.rentalInfo?.expectedRent ?? data.rentAmount ?? 0);
      const depositAmount = data.rentalInfo?.securityDeposit ?? activeRental?.securityDeposit ?? data.depositAmount ?? 0;
      const leaseStartDate = toDateInputValue(
        data.tenantMoveInDate || data.rentalInfo?.leaseStartDate || activeRental?.leaseStartDate,
      );
      const leaseEndDate = toDateInputValue(
        data.rentalInfo?.leaseEndDate || activeRental?.leaseEndDate,
      );

      setFormData({
        ownerId: currentOwnerId,
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
        rentAmount,
        depositAmount,
        salePrice: data.saleInfo?.listedPrice ?? 0,
        furnishing: data.furnishing,
        amenities: data.amenities || [],
        availableFrom: isRentalListingStatus(normalizedStatus as PropertyStatus)
          ? toDateInputValue(data.availableFrom) || new Date().toISOString().split('T')[0]
          : '',
        status: normalizedStatus,
        tenantCustomerId: data.tenantCustomerId || data.rentalInfo?.currentTenantId || '',
        brokerageAmount: isRented
          ? (data.brokerageAmount || activeRental?.brokeragePaid || 0)
          : (data.brokerageAmount || 0),
        expectedBrokerage: isRented ? 0 : (data.expectedBrokerage || 0),
        agreementStatus: data.agreementStatus || 'pending',
        verificationStatus: data.verificationStatus || 'pending',
        featured: data.featured || false,
        verified: data.verified || false,
        tenantMoveInDate: leaseStartDate,
        leaseEndDate,
        tenureMonths: data.tenureMonths || 11,
      });
      await ensureOwnerInDropdown({ ...data, ownerId: currentOwnerId, status: normalizedStatus });
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

  const handleMarkAsSoldConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!saleForm.soldPrice) {
      alert('Please enter the sold price.');
      return;
    }

    if (saleForm.saleType === 'direct' && !saleForm.buyerId) {
      alert('Please select a buyer.');
      return;
    }

    try {
      setSavingSale(true);
      
      const finalReasonLost = saleForm.reasonLost === 'other' 
        ? saleForm.customReasonLost 
        : saleForm.reasonLost;

      const payload = {
        soldPrice: Number(saleForm.soldPrice) || 0,
        buyerId: saleForm.saleType === 'direct' ? saleForm.buyerId : null,
        saleType: saleForm.saleType,
        brokerageAmount: saleForm.brokerageAmount || undefined,
        brokerageLost: saleForm.saleType === 'third_party' ? (saleForm.brokerageLost || undefined) : undefined,
        reasonLost: saleForm.saleType === 'third_party' ? finalReasonLost : null,
        notes: saleForm.notes || null,
      };

      const updatedProp = await api.markPropertySold(id, payload);
      
      const createdBrokerage = (saleForm.saleType === 'direct' && Number(saleForm.soldPrice) > 0) || 
                               (saleForm.saleType === 'third_party' && saleForm.brokerageLost && Number(saleForm.brokerageLost) > 0);

      setProperty(updatedProp);
      setOriginalStatus('sold');
      setFormData(prev => ({
        ...prev,
        status: 'sold',
        ownerId: updatedProp.ownerId || '',
      }));

      setShowSaleModal(false);
      setToast({ 
        message: `Property successfully marked as sold!${createdBrokerage ? ' Auto-created brokerage entry in Khata.' : ''}`, 
        type: 'success' 
      });
    } catch (err) {
      console.error('Error marking property as sold:', err);
      setToast({ message: 'Failed to mark property as sold.', type: 'error' });
    } finally {
      setSavingSale(false);
    }
  };

  const openRentalModal = () => {
    const activeRental = getActiveRentalEntry(property);
    setRentalForm({
      customerId: '',
      monthlyRent: formData.rentAmount
        || property?.rentalInfo?.currentRent
        || property?.rentalInfo?.expectedRent
        || activeRental?.monthlyRent
        || 0,
      securityDeposit: formData.depositAmount
        || property?.rentalInfo?.securityDeposit
        || activeRental?.securityDeposit
        || 0,
      brokeragePaid: 0,
      leaseStartDate: new Date().toISOString().split('T')[0],
      leaseEndDate: '',
      notes: '',
    });
    setShowRentalModal(true);
  };

  const handleMarkAsRentedConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!rentalForm.customerId || !rentalForm.monthlyRent || !rentalForm.leaseStartDate) {
      alert('Please select a tenant and enter the monthly rent and lease start date.');
      return;
    }

    try {
      setSavingRental(true);
      await api.markPropertyRented(id, {
        customerId: rentalForm.customerId,
        rentalDetails: {
          monthlyRent: Number(rentalForm.monthlyRent),
          leaseStartDate: rentalForm.leaseStartDate,
          leaseEndDate: rentalForm.leaseEndDate || undefined,
          securityDeposit: Number(rentalForm.securityDeposit) || 0,
          brokeragePaid: Number(rentalForm.brokeragePaid) || 0,
          notes: rentalForm.notes || undefined,
        },
      });
      await loadProperty();
      setShowRentalModal(false);
      setToast({ message: 'Tenant assigned and property marked as occupied.', type: 'success' });
    } catch (err) {
      console.error('Error assigning tenant:', err);
      setToast({ message: 'Failed to assign tenant to this property.', type: 'error' });
    } finally {
      setSavingRental(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Owner is now optional - can create properties without owner (unassigned)

    // Convert form data to API format (string lat/lng to numbers)
    const isSaleStatus = formData.status === 'for-sale' || formData.status === 'sold';
    const isRentedStatus = formData.status === 'rented';
    const apiData: any = {
      ...formData,
      latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
      longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
      tenantCustomerId: formData.tenantCustomerId || undefined,
      tenantMoveInDate: formData.tenantMoveInDate || undefined,
      tenureMonths: formData.tenureMonths || undefined,
      availableFrom: !isRentedStatus && formData.availableFrom
        ? new Date(formData.availableFrom).toISOString()
        : undefined,
      brokerageAmount: formData.brokerageAmount || undefined,
      expectedBrokerage: isRentalListingStatus(formData.status) ? (formData.expectedBrokerage || undefined) : undefined,
    };

    // Ownership is set at creation or via Mark as Sold — never changed on edit
    if (isEditing) {
      delete apiData.ownerId;
    } else {
      apiData.ownerId = preselectedOwnerId || formData.ownerId || null;
    }

    if (isSaleStatus) {
      apiData.saleInfo = {
        listedPrice: formData.salePrice || 0,
        soldPrice: formData.status === 'sold' ? (property?.saleInfo?.soldPrice || 0) : null,
        soldDate: formData.status === 'sold' ? (property?.saleInfo?.soldDate || null) : null,
        soldToBuyerId: formData.status === 'sold' ? (property?.saleInfo?.soldToBuyerId || null) : null,
      };
    } else if (isRentedStatus) {
      apiData.rentalInfo = {
        ...(property?.rentalInfo || {}),
        currentRent: formData.rentAmount || property?.rentalInfo?.currentRent || 0,
        securityDeposit: formData.depositAmount || property?.rentalInfo?.securityDeposit || 0,
        currentTenantId: formData.tenantCustomerId || property?.rentalInfo?.currentTenantId || null,
        leaseStartDate: formData.tenantMoveInDate || property?.rentalInfo?.leaseStartDate || null,
        leaseEndDate: formData.leaseEndDate || property?.rentalInfo?.leaseEndDate || null,
      };
      delete apiData.rentalInfo.expectedRent;
    } else {
      apiData.rentalInfo = {
        expectedRent: formData.rentAmount || 0,
        securityDeposit: formData.depositAmount || 0,
      };
    }

    // Remove local-only form fields from API payload
    delete apiData.salePrice;
    delete apiData.rentAmount;
    delete apiData.depositAmount;

    try {
      setSaving(true);
      if (isEditing && id) {
        await api.updateCRMProperty(id, apiData);
        
        // Auto-create brokerage khata entry when property status changes to 'sold' or 'rented'
        if ((formData.status === 'sold' || formData.status === 'rented') && originalStatus !== formData.status && formData.ownerId) {
          try {
            let brokerageAmount = 0;
            let partyType: KhataPartyType = 'OWNER';
            let description = '';

            if (formData.status === 'sold') {
              // Calculate brokerage as 1% of sale price
              const salePrice = formData.salePrice || property?.saleInfo?.listedPrice || 0;
              brokerageAmount = salePrice > 0 ? Math.round(salePrice * 0.01) : 0;
              partyType = 'SELLER';
              description = `Auto-generated brokerage for property sale: ${formData.title}`;
            } else if (formData.status === 'rented') {
              // Use manual brokerage if provided, otherwise default to 1 month rent
              brokerageAmount = formData.brokerageAmount > 0 ? formData.brokerageAmount : (formData.rentAmount || 0);
              partyType = 'OWNER';
              description = `Auto-generated brokerage for property rental: ${formData.title}`;
            }
            
            if (brokerageAmount > 0) {
              await api.createKhataEntry({
                propertyId: id,
                partyType,
                partyId: formData.ownerId,
                partyName: selectedOwner?.name || 'Owner',
                transactionType: 'TO_TAKE',
                amount: brokerageAmount,
                categoryId: 'predefined-0', // Brokerage category
                categoryName: 'Brokerage',
                description,
                lineItems: [{
                  categoryId: 'predefined-0',
                  categoryName: 'Brokerage',
                  amount: brokerageAmount,
                }],
                sourceRef: `property-status-change:${id}:${formData.status}`,
              });
              setToast({ message: `Property updated! Auto-created ${formData.status === 'sold' ? 'sale' : 'rental'} brokerage entry.`, type: 'success' });
            } else {
              setToast({ message: 'Property updated successfully!', type: 'success' });
            }
          } catch (khataError) {
            console.error('Error creating auto-brokerage entry:', khataError);
            setToast({ message: 'Property updated, but failed to create brokerage entry.', type: 'error' });
          }
        } else if (formData.status === 'rented' && originalStatus === 'rented' && formData.ownerId) {
          // Tenant changed or brokerage changed on already-rented property
          const tenantChanged = property?.tenantCustomerId !== formData.tenantCustomerId;
          const brokerageChanged = (property?.brokerageAmount || 0) !== formData.brokerageAmount;
          if ((tenantChanged || brokerageChanged) && formData.brokerageAmount > 0) {
            try {
              await api.createKhataEntry({
                propertyId: id,
                partyType: 'OWNER',
                partyId: formData.ownerId,
                partyName: selectedOwner?.name || 'Owner',
                transactionType: 'TO_TAKE',
                amount: formData.brokerageAmount,
                categoryId: 'predefined-0',
                categoryName: 'Brokerage',
                description: `Brokerage for property rental${tenantChanged ? ' (new tenant)' : ' (brokerage updated)'}: ${formData.title}`,
                lineItems: [{
                  categoryId: 'predefined-0',
                  categoryName: 'Brokerage',
                  amount: formData.brokerageAmount,
                }],
                sourceRef: `property-rental-update:${id}:${Date.now()}`,
              });
              setToast({ message: `Property updated! Auto-created rental brokerage entry${tenantChanged ? ' for new tenant' : ''}.`, type: 'success' });
            } catch (khataError) {
              console.error('Error creating rental brokerage khata entry:', khataError);
              setToast({ message: 'Property updated, but failed to create brokerage entry.', type: 'error' });
            }
          } else {
            setToast({ message: 'Property updated successfully!', type: 'success' });
          }
        } else {
          setToast({ message: 'Property updated successfully!', type: 'success' });
        }
        
        // Upload any pending images/videos for editing
        if (pendingImages.length > 0) {
          await api.uploadPropertyImages(id, pendingImages);
          setPendingImages([]);
        }
        if (pendingVideos.length > 0) {
          await api.uploadPropertyVideos(id, pendingVideos);
          setPendingVideos([]);
        }
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
      setToast({ message: 'Failed to upload images', type: 'error' });
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
      setToast({ message: 'Failed to upload videos', type: 'error' });
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
      setToast({ message: 'Failed to delete image', type: 'error' });
    }
  };

  const handleDeleteVideo = async (videoKey: string) => {
    if (!id || !confirm('Delete this video?')) return;

    try {
      await api.deletePropertyVideo(id, videoKey);
      await loadProperty();
    } catch (error) {
      console.error('Error deleting video:', error);
      setToast({ message: 'Failed to delete video', type: 'error' });
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
      setToast({ message: 'Failed to upload document', type: 'error' });
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
      setToast({ message: 'Failed to delete document', type: 'error' });
    }
  };

  // Filtered lists based on search
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(tenantSearchQuery.toLowerCase()) ||
    customer.phone.includes(tenantSearchQuery)
  );

  const selectedOwner = formData.ownerId
    ? (owners.find((o) => o.ownerId === formData.ownerId)
      || (property?.ownerName
        ? {
            ownerId: formData.ownerId,
            name: property.ownerName,
            phone: property.ownerPhone || property.ownerSnapshot?.phone || '',
          } as CRMOwner
        : undefined))
    : undefined;
  const selectedCustomer = customers.find(c => c.customerId === formData.tenantCustomerId);
  const availableTenants = customers.filter((customer) => !customer.currentRental?.propertyId);
  const canTransferOwnership = isEditing && (formData.status === 'for-sale' || formData.status === 'available');
  const canAssignTenant = isEditing && (formData.status === 'for-rent' || formData.status === 'available');

  const toggleAmenity = (amenity: string) => {
    const current = formData.amenities;
    const updated = current.includes(amenity)
      ? current.filter((a) => a !== amenity)
      : [...current, amenity];
    setFormData({ ...formData, amenities: updated });
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
        <LoadingSpinner message="Loading property..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="glass-premium border-b border-white/30 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm/properties')}
                className="flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-manipulation p-1.5 sm:p-2 hover:bg-white/60 rounded-xl transition-all duration-200 flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-slate-500" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 flex-shrink-0 animate-gentlePulse">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight truncate">
                    {isEditing ? 'Edit Property' : 'New Property'}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 font-semibold">
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
              <div className="glass-premium rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Basic Information</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => {
                        const newStatus = e.target.value as PropertyStatus;
                        if (newStatus === 'sold') {
                          if (!id) {
                            alert('Please save the property details first before marking it as sold.');
                            return;
                          }
                          setSaleForm({
                            saleType: 'direct',
                            soldPrice: formData.salePrice || property?.saleInfo?.listedPrice || property?.rentAmount || 0,
                            buyerId: '',
                            brokerageAmount: 0,
                            brokerageLost: 0,
                            reasonLost: '',
                            customReasonLost: '',
                            notes: ''
                          });
                          setShowSaleModal(true);
                        } else {
                          setFormData({
                            ...formData,
                            status: newStatus,
                          });
                        }
                      }}
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="not-listed">Not Listed</option>
                      <option value="for-sale">Available for Sale</option>
                      <option value="for-rent">Available for Rent</option>
                      <option value="rented">Occupied</option>
                      {(formData.status === 'sold' || formData.status === 'inactive' || formData.status === 'available' || formData.status === 'on-hold' || formData.status === 'out-of-stock' || formData.status === 'archived') && (
                        <option value={formData.status}>
                          {formData.status === 'sold' ? 'Sold (legacy)'
                            : formData.status === 'inactive' || formData.status === 'available' || formData.status === 'on-hold'
                              ? 'Not Listed (legacy)'
                              : formData.status}
                        </option>
                      )}
                    </select>
                    {isEditing && (canTransferOwnership || canAssignTenant) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canTransferOwnership && (
                          <button
                            type="button"
                            onClick={() => {
                              setSaleForm({
                                saleType: 'direct',
                                soldPrice: formData.salePrice || property?.saleInfo?.listedPrice || 0,
                                buyerId: '',
                                brokerageAmount: 0,
                                brokerageLost: 0,
                                reasonLost: '',
                                customReasonLost: '',
                                notes: '',
                              });
                              setShowSaleModal(true);
                            }}
                            className="inline-flex items-center justify-center min-h-[44px] touch-manipulation gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-semibold"
                          >
                            Transfer Ownership / Sell
                          </button>
                        )}
                        {canAssignTenant && (
                          <button
                            type="button"
                            onClick={openRentalModal}
                            className="inline-flex items-center justify-center min-h-[44px] touch-manipulation gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-semibold"
                          >
                            Assign Tenant
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Owner — read-only; ownership changes via Mark as Sold only */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {formData.status === 'sold' ? 'Current Owner' : 'Owner'}
                    </label>
                    {selectedOwner ? (
                      <>
                        <p className="text-gray-900 font-medium">
                          {selectedOwner.name}
                          {selectedOwner.phone ? ` · ${selectedOwner.phone}` : ''}
                        </p>
                        <div className="flex flex-wrap gap-3 mt-2">
                          {formData.ownerId && (
                            <button
                              type="button"
                              onClick={() => navigate(`/crm/owners/${formData.ownerId}`)}
                              className="inline-flex items-center min-h-[44px] sm:min-h-0 touch-manipulation text-xs font-semibold text-purple-700 hover:text-purple-900 underline"
                            >
                              View owner profile
                            </button>
                          )}
                          {property?.currentOwnerContactId && (
                            <button
                              type="button"
                              onClick={() => navigate(`/crm/contacts/${property.currentOwnerContactId}`)}
                              className="inline-flex items-center min-h-[44px] sm:min-h-0 touch-manipulation text-xs font-semibold text-purple-700 hover:text-purple-900 underline"
                            >
                              View contact
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">
                        {isEditing
                          ? 'No owner linked to this property.'
                          : preselectedOwnerId
                            ? 'Owner will be linked from the owner profile you started from.'
                            : 'Unassigned — create this property from an Owner/Seller profile to link ownership.'}
                      </p>
                    )}
                    {property?.previousOwnerContactId && formData.status !== 'sold' && (
                      <p className="text-xs text-gray-500 mt-2">
                        Previous owner:{' '}
                        <button
                          type="button"
                          className="underline text-purple-700"
                          onClick={() => navigate(`/crm/contacts/${property.previousOwnerContactId}`)}
                        >
                          view contact
                        </button>
                      </p>
                    )}
                  </div>

                  {/* Publish to public site — only meaningful once the property exists */}
                  {isEditing && property && id && (
                    <PropertyPublishControl
                      propertyId={id}
                      title={property.title || formData.title}
                      status={property.status}
                      publicVisibility={property.publicVisibility}
                      onVisibilityChange={(next) =>
                        setProperty((prev) => (prev ? { ...prev, publicVisibility: next } : prev))
                      }
                    />
                  )}

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
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Describe the property..."
                    />
                  </div>

                  {/* Property Type & BHK */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                        className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="2"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Location</h2>

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
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Street, landmark, directions..."
                    />
                  </div>
                </div>
              </div>

              {/* Pricing & Details */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Pricing & Details</h2>

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
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter carpet area"
                    />
                  </div>

                  {formData.status === 'for-sale' || formData.status === 'sold' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Selling Price (₹) <span className="text-red-500">*</span>
                      </label>
                      <NumericInput
                        required
                        min={0}
                        value={formData.salePrice}
                        onChange={(val) => setFormData({ ...formData, salePrice: val })}
                        className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Enter selling price"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {formData.status === 'rented' ? 'Current Monthly Rent (₹)' : 'Monthly Rent (₹)'}
                        <span className="text-red-500"> *</span>
                      </label>
                      <NumericInput
                        required
                        min={0}
                        value={formData.rentAmount}
                        onChange={(val) => setFormData({ ...formData, rentAmount: val })}
                        className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Enter monthly rent"
                      />
                    </div>
                  )}

                  {formData.status !== 'for-sale' && formData.status !== 'sold' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Deposit Amount (₹)
                      </label>
                      <NumericInput
                        min={0}
                        value={formData.depositAmount}
                        onChange={(val) => setFormData({ ...formData, depositAmount: val })}
                        className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Enter deposit amount"
                      />
                    </div>
                  )}

                  {isRentalListingStatus(formData.status) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expected Brokerage (₹)
                    </label>
                    <NumericInput
                      min={0}
                      value={formData.expectedBrokerage}
                      onChange={(val) => setFormData({ ...formData, expectedBrokerage: val })}
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter expected brokerage"
                    />
                  </div>
                  )}

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
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="furnished">Furnished</option>
                      <option value="semi-furnished">Semi-Furnished</option>
                      <option value="unfurnished">Unfurnished</option>
                    </select>
                  </div>

                  {isRentalListingStatus(formData.status) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Available From
                    </label>
                    <input
                      type="date"
                      value={formData.availableFrom}
                      onChange={(e) => setFormData({ ...formData, availableFrom: e.target.value })}
                      className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  )}

                  {/* Tenant Selection */}
                  {(formData.status === 'rented' || formData.status === 'on-hold') && (
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
                              className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-left bg-white flex items-center justify-between"
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
                                    className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                                    className={`w-full min-h-[44px] px-4 py-2 text-left text-sm hover:bg-gray-100 ${!formData.tenantCustomerId ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}`}
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
                                      className={`w-full min-h-[44px] px-4 py-2 text-left text-sm hover:bg-gray-100 ${formData.tenantCustomerId === customer.customerId ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}`}
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
                            className="flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] touch-manipulation px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                            title="Add New Tenant"
                          >
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">Add New</span>
                          </button>
                        </div>
                      </div>

                      {/* Brokerage (for rental deals) */}
                      {formData.status === 'rented' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Brokerage Paid (&#x20B9;)
                          </label>
                          <NumericInput
                            value={formData.brokerageAmount}
                            onChange={(val) => setFormData({ ...formData, brokerageAmount: val })}
                            placeholder="0"
                            className="w-full"
                          />
                        </div>
                      )}

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
                          className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                          className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="pending">Pending</option>
                          <option value="done">Done</option>
                          <option value="not_done">Not Done</option>
                        </select>
                      </div>

                      {/* Tenant Move-in / Lease Start */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Calendar className="inline h-4 w-4 mr-1" />
                          {formData.status === 'rented' ? 'Lease Start Date' : 'Tenant Move-in Date'}
                        </label>
                        <input
                          type="date"
                          value={formData.tenantMoveInDate}
                          onChange={(e) => setFormData({ ...formData, tenantMoveInDate: e.target.value })}
                          className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>

                      {formData.status === 'rented' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Calendar className="inline h-4 w-4 mr-1" />
                            Lease End Date
                          </label>
                          <input
                            type="date"
                            value={formData.leaseEndDate}
                            onChange={(e) => setFormData({ ...formData, leaseEndDate: e.target.value })}
                            className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      )}

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
                          className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Amenities</h2>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {amenitiesList.map((amenity) => (
                    <label
                      key={amenity}
                      className="flex items-center space-x-2 cursor-pointer min-h-[44px] sm:min-h-0"
                    >
                      <input
                        type="checkbox"
                        checked={formData.amenities.includes(amenity)}
                        onChange={() => toggleAmenity(amenity)}
                        className="w-5 h-5 sm:w-4 sm:h-4 flex-shrink-0 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">{amenity}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-4 sm:space-y-6">
              {/* Options */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Options</h2>

                <div className="space-y-3">
                  <label className="flex items-center space-x-2 cursor-pointer min-h-[44px] sm:min-h-0">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                      className="w-5 h-5 sm:w-4 sm:h-4 flex-shrink-0 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Featured Property</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer min-h-[44px] sm:min-h-0">
                    <input
                      type="checkbox"
                      checked={formData.verified}
                      onChange={(e) => setFormData({ ...formData, verified: e.target.checked })}
                      className="w-5 h-5 sm:w-4 sm:h-4 flex-shrink-0 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Verified Property</span>
                  </label>
                </div>
              </div>

              {/* Images - Available for both new and editing */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">Images</h2>
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
                    <div className="flex items-center justify-center space-x-2 min-h-[44px] sm:min-h-0 px-3 py-2 sm:py-1 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100">
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
                            className="absolute top-2 right-2 p-2 sm:p-1 bg-red-600 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
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
                        <PermissionGuard permission="delete">
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(img.key)}
                            className="absolute top-2 right-2 p-2 sm:p-1 bg-red-600 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </PermissionGuard>
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
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">Videos</h2>
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
                    <div className="flex items-center justify-center space-x-2 min-h-[44px] sm:min-h-0 px-3 py-2 sm:py-1 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100">
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
                                className="flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-manipulation p-2 sm:p-1 text-red-600 hover:bg-red-50 rounded"
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
                                className="inline-flex items-center min-h-[44px] sm:min-h-0 touch-manipulation text-xs text-purple-600 hover:text-purple-800"
                              >
                                Download
                              </a>
                            )}
                            <PermissionGuard permission="delete">
                              <button
                                type="button"
                                onClick={() => handleDeleteVideo(vid.key)}
                                className="flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-manipulation p-2 sm:p-1 text-red-600 hover:bg-red-50 rounded"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </PermissionGuard>
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
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900">Documents</h2>
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
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g. Signed agreement, police verification PDF"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleDocumentFileChange}
                        />
                        <div className="flex items-center justify-center space-x-2 min-h-[44px] sm:min-h-0 px-3 py-2 sm:py-1 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100">
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
                        className="min-h-[44px] sm:min-h-0 touch-manipulation px-3 py-2 sm:py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
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
                                          className="inline-flex items-center min-h-[44px] sm:min-h-0 touch-manipulation text-xs text-purple-600 hover:text-purple-800"
                                        >
                                          Download
                                        </a>
                                      )}
                                      <PermissionGuard permission="delete">
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteDocument(doc.documentId)}
                                          className="flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-manipulation p-2 sm:p-1 text-red-600 hover:bg-red-50 rounded"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </PermissionGuard>
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

              {/* Ownership History */}
              {isEditing && property?.ownershipHistory && property.ownershipHistory.length > 0 && (
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    Ownership History
                  </h2>
                  <div className="space-y-4">
                    {property.ownershipHistory.map((entry, idx) => (
                      <div key={idx} className="relative pl-6 border-l-2 border-gray-200">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-purple-600 border-2 border-white" />
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-purple-700 uppercase tracking-wide">
                              {entry.soldVia === 'direct' ? 'Sold via Us' : 'Third-Party Sale'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(entry.saleDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 font-medium">
                            {entry.fromOwnerName || 'Unassigned'}
                            <span className="text-gray-400 mx-1">&rarr;</span>
                            {entry.toOwnerName || 'Third-Party'}
                          </p>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs">
                            {(entry.fromContactId || entry.sellerContactId) && (
                              <button
                                type="button"
                                className="inline-flex items-center min-h-[44px] sm:min-h-0 touch-manipulation text-purple-700 underline"
                                onClick={() => navigate(`/crm/contacts/${entry.fromContactId || entry.sellerContactId}`)}
                              >
                                Seller contact
                              </button>
                            )}
                            {(entry.toContactId || entry.buyerContactId) && (
                              <button
                                type="button"
                                className="inline-flex items-center min-h-[44px] sm:min-h-0 touch-manipulation text-purple-700 underline"
                                onClick={() => navigate(`/crm/contacts/${entry.toContactId || entry.buyerContactId}`)}
                              >
                                Buyer / new owner
                              </button>
                            )}
                          </div>
                          {entry.salePrice && (
                            <p className="text-sm text-gray-600 mt-1">
                              Sold for <span className="font-semibold text-gray-900">&#x20B9;{entry.salePrice.toLocaleString()}</span>
                            </p>
                          )}
                          {entry.reasonLost && (
                            <p className="text-sm text-red-600 mt-1">
                              Reason: {entry.reasonLost}
                            </p>
                          )}
                          {entry.notes && (
                            <p className="text-sm text-gray-500 mt-1 italic">
                              &ldquo;{entry.notes}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rental History */}
              {isEditing && property?.rentalHistory && property.rentalHistory.length > 0 && (
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Key className="h-5 w-5 text-teal-600" />
                    Rental History
                  </h2>
                  <div className="space-y-4">
                    {property.rentalHistory.slice().reverse().map((entry, idx) => (
                      <div key={idx} className="relative pl-6 border-l-2 border-gray-200">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-teal-600 border-2 border-white" />
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-teal-700 uppercase tracking-wide">
                              {entry.leaseEndDate && new Date(entry.leaseEndDate) < new Date() ? 'Lease Completed' : 'Active Lease'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {entry.leaseStartDate ? new Date(entry.leaseStartDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                              {entry.leaseEndDate ? ` - ${new Date(entry.leaseEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ' (Ongoing)'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 font-medium">
                            Tenant: <span className="text-gray-900 font-semibold">{entry.tenantName || 'Unknown Tenant'}</span>
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mt-2 text-sm text-gray-600">
                            {entry.monthlyRent && (
                              <p>
                                Rent: <span className="font-semibold text-gray-900">&#x20B9;{entry.monthlyRent.toLocaleString()}</span> /mo
                              </p>
                            )}
                            {entry.securityDeposit && (
                              <p>
                                Deposit: <span className="font-semibold text-gray-900">&#x20B9;{entry.securityDeposit.toLocaleString()}</span>
                              </p>
                            )}
                            {entry.brokeragePaid && (
                              <p className="sm:col-span-2">
                                Brokerage Paid: <span className="font-semibold text-green-700">&#x20B9;{entry.brokeragePaid.toLocaleString()}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isEditing && (
                <div className="space-y-4 sm:space-y-6">
                  {/* Agreement Document Upload for New Property */}
                  <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="h-5 w-5 text-purple-600" />
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900">Agreement Document</h2>
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
                          className="mt-2 inline-flex items-center min-h-[44px] sm:min-h-0 touch-manipulation text-xs text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Police Verification Document Upload for New Property */}
                  <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldCheck className="h-5 w-5 text-purple-600" />
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900">Police Verification</h2>
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
                          className="mt-2 inline-flex items-center min-h-[44px] sm:min-h-0 touch-manipulation text-xs text-red-600 hover:text-red-800"
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
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => navigate('/crm/properties')}
              className="w-full sm:w-auto min-h-[44px] touch-manipulation px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto min-h-[44px] touch-manipulation flex items-center justify-center space-x-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
              <span>{saving ? 'Saving...' : 'Save Property'}</span>
            </button>
          </div>
        </form>
      </main>

      {/* Modals */}
      {showTenantModal && (
        <CreateTenantModal
          onClose={() => setShowTenantModal(false)}
          onTenantCreated={handleTenantCreated}
        />
      )}

      {/* Rental Assignment Modal */}
      {showRentalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-2 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Assign Tenant</h2>
                <button
                  type="button"
                  onClick={() => setShowRentalModal(false)}
                  className="flex-shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-manipulation p-2 sm:p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleMarkAsRentedConfirm} className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Tenant <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={rentalForm.customerId}
                    onChange={(e) => setRentalForm({ ...rentalForm, customerId: e.target.value })}
                    className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    required
                  >
                    <option value="">Choose a tenant...</option>
                    {availableTenants.map((customer) => (
                      <option key={customer.customerId} value={customer.customerId}>
                        {customer.name} {customer.phone ? `(${customer.phone})` : ''}
                      </option>
                    ))}
                  </select>
                  {availableTenants.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">No tenants without an active rental are available.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monthly Rent (₹) <span className="text-red-500">*</span>
                  </label>
                  <NumericInput
                    value={rentalForm.monthlyRent}
                    onChange={(value) => setRentalForm({ ...rentalForm, monthlyRent: value })}
                    placeholder="Enter monthly rent"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Security Deposit (₹)</label>
                  <NumericInput
                    value={rentalForm.securityDeposit}
                    onChange={(value) => setRentalForm({ ...rentalForm, securityDeposit: value })}
                    placeholder="0"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brokerage Paid (₹)</label>
                  <NumericInput
                    value={rentalForm.brokeragePaid}
                    onChange={(value) => setRentalForm({ ...rentalForm, brokeragePaid: value })}
                    placeholder="0"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lease Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={rentalForm.leaseStartDate}
                    onChange={(e) => setRentalForm({ ...rentalForm, leaseStartDate: e.target.value })}
                    className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lease End Date</label>
                  <input
                    type="date"
                    value={rentalForm.leaseEndDate}
                    onChange={(e) => setRentalForm({ ...rentalForm, leaseEndDate: e.target.value })}
                    className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={rentalForm.notes}
                    onChange={(e) => setRentalForm({ ...rentalForm, notes: e.target.value })}
                    placeholder="Any additional notes about this rental..."
                    rows={3}
                    className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRentalModal(false)}
                    className="flex-1 min-h-[44px] touch-manipulation px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingRental || !rentalForm.customerId}
                    className="flex-1 min-h-[44px] touch-manipulation px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium"
                  >
                    {savingRental ? 'Assigning...' : 'Assign Tenant'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Sale Modal */}
      {showSaleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-2 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Transfer Ownership / Sell Property</h2>
                <button
                  type="button"
                  onClick={() => setShowSaleModal(false)}
                  className="flex-shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-manipulation p-2 sm:p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleMarkAsSoldConfirm} className="space-y-4 sm:space-y-5">
                {/* Sale Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sale Type</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSaleForm({ ...saleForm, saleType: 'direct' })}
                      className={`min-h-[44px] touch-manipulation px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        saleForm.saleType === 'direct'
                          ? 'border-purple-600 bg-purple-50 text-purple-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      Sold via Us
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaleForm({ ...saleForm, saleType: 'third_party' })}
                      className={`min-h-[44px] touch-manipulation px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        saleForm.saleType === 'third_party'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      Third-Party Sale
                    </button>
                  </div>
                </div>

                {/* Sold Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sold Price (&#x20B9;)
                  </label>
                  <NumericInput
                    value={saleForm.soldPrice}
                    onChange={(value) => setSaleForm({ ...saleForm, soldPrice: value })}
                    placeholder="Enter final sold price"
                    className="w-full"
                  />
                </div>

                {/* Brokerage Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brokerage (&#x20B9;) <span className="text-xs text-gray-400 font-normal">— leave 0 for auto 1%</span>
                  </label>
                  <NumericInput
                    value={saleForm.brokerageAmount}
                    onChange={(value) => setSaleForm({ ...saleForm, brokerageAmount: value })}
                    placeholder="0"
                    className="w-full"
                  />
                </div>

                {/* Direct Sale: Buyer Selection */}
                {saleForm.saleType === 'direct' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Buyer <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={saleForm.buyerId}
                      onChange={(e) => setSaleForm({ ...saleForm, buyerId: e.target.value })}
                      className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    >
                      <option value="">Choose a buyer...</option>
                      {buyers.map((b: any) => (
                        <option key={b.buyerId} value={b.buyerId}>
                          {b.name} {b.phone ? `(${b.phone})` : ''}
                        </option>
                      ))}
                    </select>
                    {buyers.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">No buyers found. Please create a buyer first.</p>
                    )}
                  </div>
                )}

                {/* Third-Party: Reason Lost */}
                {saleForm.saleType === 'third_party' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason We Couldn&apos;t Serve
                      </label>
                      <select
                        value={saleForm.reasonLost}
                        onChange={(e) => setSaleForm({ ...saleForm, reasonLost: e.target.value })}
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">Select a reason...</option>
                        <option value="Client went with competitor">Client went with competitor</option>
                        <option value="Price too high">Price too high</option>
                        <option value="Client decided not to sell">Client decided not to sell</option>
                        <option value="Property not suitable for buyer">Property not suitable for buyer</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {saleForm.reasonLost === 'other' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Specify Reason
                        </label>
                        <input
                          type="text"
                          value={saleForm.customReasonLost}
                          onChange={(e) => setSaleForm({ ...saleForm, customReasonLost: e.target.value })}
                          placeholder="Enter custom reason..."
                          className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Brokerage Lost (&#x20B9;)
                      </label>
                      <NumericInput
                        value={saleForm.brokerageLost}
                        onChange={(value) => setSaleForm({ ...saleForm, brokerageLost: value })}
                        placeholder="Enter brokerage amount lost"
                        className="w-full"
                      />
                    </div>
                  </>
                )}

                {/* Notes (for both types) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={saleForm.notes}
                    onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
                    placeholder="Any additional notes about this sale..."
                    rows={3}
                    className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSaleModal(false)}
                    className="flex-1 min-h-[44px] touch-manipulation px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSale || (saleForm.saleType === 'direct' && !saleForm.buyerId)}
                    className="flex-1 min-h-[44px] touch-manipulation px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                  >
                    {savingSale ? 'Saving...' : 'Confirm Sale'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
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
