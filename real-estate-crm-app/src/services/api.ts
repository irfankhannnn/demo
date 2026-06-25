import { getTenantHeaders } from '../config/tenant';
import type {
  CreateCustomerData,
  UpdateCustomerData,
  CreateOwnerData,
  UpdateOwnerData,
  CreatePropertyData,
  UpdatePropertyData,
} from '../types/crm';
import type { ConversationSummary, WhatsAppConversation } from '../types/whatsapp';
import { setTokens, type AuthTokens } from '../utils/authStorage';
import { refreshTokens } from '../utils/cognitoAuth';

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error('VITE_API_URL (or VITE_API_BASE_URL) is not defined. Set it in your frontend .env file.');
}

class ApiService {
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  private get token(): string | null {
    return localStorage.getItem('auth_id_token');
  }

  private subscribeTokenRefresh(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  private onTokenRefreshed(token: string) {
    this.refreshSubscribers.forEach(callback => callback(token));
    this.refreshSubscribers = [];
  }

  async getEnquiryNotes(enquiryId: string) {
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}/notes`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createEnquiryNote(enquiryId: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}/notes`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateEnquiryNote(enquiryId: string, noteId: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}/notes/${noteId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteEnquiryNote(enquiryId: string, noteId: string) {
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}/notes/${noteId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  setToken(token: string) {
    localStorage.setItem('auth_id_token', token);
  }

  clearToken() {
    localStorage.removeItem('auth_id_token');
    localStorage.removeItem('auth_access_token');
    localStorage.removeItem('auth_refresh_token');
    localStorage.removeItem('auth_token_expiry');
    localStorage.removeItem('auth_user_profile');
    localStorage.removeItem('admin_token');
  }

  private getHeaders(isFormData = false): Record<string, string> {
    const headers: Record<string, string> = {
      ...getTenantHeaders(), // Include tenant ID in all requests
    };
    
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  private async refreshWithRetry(maxRetries = 3): Promise<AuthTokens> {
    let lastError: unknown;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await refreshTokens();
      } catch (err) {
        lastError = err;
        if (i < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 500 * (i + 1)));
        }
      }
    }
    throw lastError;
  }

  private async handleResponse(response: Response) {
    if (!response.ok) {
      if (response.status === 401) {
        // Attempt to refresh using the httpOnly cookie (server-managed)
        try {
          if (!this.isRefreshing) {
            this.isRefreshing = true;
            const newTokens = await this.refreshWithRetry();
            setTokens(newTokens);
            this.isRefreshing = false;
            this.onTokenRefreshed(newTokens.idToken);
            // Retry the original request with new token
            return this.retryRequest(response);
          } else {
            // Wait for the refresh to complete
            return new Promise((resolve) => {
              this.subscribeTokenRefresh(() => {
                resolve(this.retryRequest(response));
              });
            });
          }
        } catch (refreshError) {
          console.error('[ApiService] Token refresh failed:', refreshError);
          this.isRefreshing = false;
          this.clearToken();
          window.location.href = '/login';
          throw new Error('Session expired. Please log in again.');
        }
      }
      if (response.status === 402) {
        const error = await response.json().catch(() => ({ error: 'insufficient_credits' }));
        if (error.error === 'insufficient_credits') {
          window.dispatchEvent(new CustomEvent('insufficient-credits', { detail: error }));
        }
        const err = new Error(error.message || 'Out of credits');
        (err as any).code = 'insufficient_credits';
        (err as any).balance = error.balance;
        (err as any).required = error.required;
        throw err;
      }
      const error = await response.json().catch(() => ({ error: 'An error occurred' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  private async retryRequest(originalResponse: Response): Promise<any> {
    // NOTE: We can't reliably determine the original HTTP method from the
    // Response object, so we retry as GET (safe for read endpoints).
    // Write endpoints will need the user to retry manually.
    const url = originalResponse.url;
    const options: RequestInit = {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include',
    };

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Request failed after token refresh (${response.status})`);
    }
    return response.json();
  }

  private stripDynamoFields<T extends Record<string, any>>(data: T): Partial<T> {
    const cleaned: Record<string, any> = { ...(data || {}) };

    // Never send DynamoDB keys / index keys back to update endpoints
    delete cleaned.PK;
    delete cleaned.SK;
    delete cleaned.EntityType;
    delete cleaned.tenantId;
    delete cleaned.createdAt;
    delete cleaned.updatedAt;

    // Derived/presigned URL fields should never be persisted
    delete cleaned.photoUrl;
    delete cleaned.panDocUrl;
    delete cleaned.aadharDocUrl;

    // Remove any GSI* attributes
    Object.keys(cleaned).forEach((key) => {
      if (key.startsWith('GSI')) {
        delete cleaned[key];
      }
    });

    return cleaned as Partial<T>;
  }

  // Dashboard
  async getDashboardMetrics() {
    const response = await fetch(`${API_BASE_URL}/dashboard/metrics`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== CRM Endpoints ==============

  // CRM Metrics
  async getCRMMetrics() {
    const response = await fetch(`${API_BASE_URL}/crm/metrics`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Customer endpoints
  async getCustomers() {
    const response = await fetch(`${API_BASE_URL}/crm/customers`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getCustomer(customerId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createCustomer(data: CreateCustomerData) {
    const response = await fetch(`${API_BASE_URL}/crm/customers`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateCustomer(customerId: string, data: UpdateCustomerData) {
    const safeData = this.stripDynamoFields(data as any);
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(safeData),
    });
    return this.handleResponse(response);
  }

  async deleteCustomer(customerId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getCustomerNotes(customerId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}/notes`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createCustomerNote(customerId: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}/notes`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateCustomerNote(customerId: string, noteId: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}/notes/${noteId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteCustomerNote(customerId: string, noteId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}/notes/${noteId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Phone lookup for auto-fill
  async getCustomerByPhone(phone: string) {
    const response = await fetch(`${API_BASE_URL}/crm/customers/lookup/by-phone?phone=${encodeURIComponent(phone)}`, {
      headers: this.getHeaders(),
    });
    if (response.status === 404) return null;
    return this.handleResponse(response);
  }

  async getOwnerByPhone(phone: string) {
    const response = await fetch(`${API_BASE_URL}/crm/owners/lookup/by-phone?phone=${encodeURIComponent(phone)}`, {
      headers: this.getHeaders(),
    });
    if (response.status === 404) return null;
    return this.handleResponse(response);
  }

  // Owner endpoints
  async getOwners() {
    const response = await fetch(`${API_BASE_URL}/crm/owners`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse(response);
    // Backend now returns { owners: [...], sellerCount: N }
    // For backward compatibility, return just the owners array but store sellerCount
    if (result && typeof result === 'object' && 'owners' in result) {
      (this as any)._cachedSellerCount = result.sellerCount || 0;
      return result.owners;
    }
    return result;
  }

  async getSellerCount() {
    // Return cached seller count from last getOwners call
    return (this as any)._cachedSellerCount || 0;
  }

  async getOwner(ownerId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getOwnerNotes(ownerId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}/notes`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createOwnerNote(ownerId: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}/notes`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateOwnerNote(ownerId: string, noteId: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}/notes/${noteId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteOwnerNote(ownerId: string, noteId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}/notes/${noteId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createOwner(data: CreateOwnerData) {
    const response = await fetch(`${API_BASE_URL}/crm/owners`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateOwner(ownerId: string, data: UpdateOwnerData) {
    const safeData = this.stripDynamoFields(data as any);
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(safeData),
    });
    return this.handleResponse(response);
  }

  async deleteOwner(ownerId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getOwnerProperties(ownerId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}/properties`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Property endpoints (CRM)
  async getCRMProperties(status?: string) {
    const url = status 
      ? `${API_BASE_URL}/crm/properties?status=${status}`
      : `${API_BASE_URL}/crm/properties`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    const data = await this.handleResponse(response);
    return Array.isArray(data) ? data : (data.properties || []);
  }

  async getCRMProperty(propertyId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getPropertyRentalHistory(propertyId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/rental-history`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createCRMProperty(data: CreatePropertyData) {
    const response = await fetch(`${API_BASE_URL}/crm/properties`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateCRMProperty(propertyId: string, data: UpdatePropertyData) {
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteCRMProperty(propertyId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async uploadPropertyImages(propertyId: string, files: File[]) {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/images`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    });
    return this.handleResponse(response);
  }

  async uploadPropertyVideos(propertyId: string, files: File[]) {
    // API Gateway/custom domains typically enforce a ~10MB request size limit.
    // Avoid a failing request (413) by blocking obviously-too-large uploads.
    const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
    const maxBytes = 9 * 1024 * 1024; // keep margin under 10MB
    if (totalBytes > maxBytes) {
      throw new Error('Video upload too large. Please upload smaller video(s) (max ~9MB total) or reduce/compress before uploading.');
    }

    const formData = new FormData();
    files.forEach(file => formData.append('videos', file));
    
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/videos`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    });
    return this.handleResponse(response);
  }

  async deletePropertyImage(propertyId: string, imageKey: string) {
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/images/${encodeURIComponent(imageKey)}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async deletePropertyVideo(propertyId: string, videoKey: string) {
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/videos/${encodeURIComponent(videoKey)}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Public property endpoints (for /properties page)
  async getPublicProperties() {
    const response = await fetch(`${API_BASE_URL}/crm/properties/public/list`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getPublicProperty(propertyId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/properties/public/${propertyId}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Owner Document Upload ==============
  
  async uploadOwnerDocuments(ownerId: string, files: { photo?: File; pan?: File; aadhar?: File }) {
    const formData = new FormData();
    if (files.photo) formData.append('photo', files.photo);
    if (files.pan) formData.append('pan', files.pan);
    if (files.aadhar) formData.append('aadhar', files.aadhar);

    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}/documents`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    });
    return this.handleResponse(response);
  }

  async getOwnerWithDocuments(ownerId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}/with-documents`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Customer/Tenant Document Upload ==============

  async uploadCustomerDocuments(customerId: string, files: { photo?: File; pan?: File; aadhar?: File }) {
    const formData = new FormData();
    if (files.photo) formData.append('photo', files.photo);
    if (files.pan) formData.append('pan', files.pan);
    if (files.aadhar) formData.append('aadhar', files.aadhar);

    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}/documents`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    });
    return this.handleResponse(response);
  }

  async getCustomerWithDocuments(customerId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}/with-documents`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Buyer Document Upload ==============

  async uploadBuyerDocuments(buyerId: string, files: { photo?: File; pan?: File; aadhar?: File }) {
    const formData = new FormData();
    if (files.photo) formData.append('photo', files.photo);
    if (files.pan) formData.append('pan', files.pan);
    if (files.aadhar) formData.append('aadhar', files.aadhar);

    const response = await fetch(`${API_BASE_URL}/crm/buyers/${buyerId}/documents`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    });
    return this.handleResponse(response);
  }

  async getBuyerWithDocuments(buyerId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/buyers/${buyerId}/with-documents`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createBuyerListing(buyerId: string, propertyId: string, listingType: 'rent' | 'sale') {
    const response = await fetch(`${API_BASE_URL}/crm/buyers/${buyerId}/list-property`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ propertyId, listingType }),
    });
    return this.handleResponse(response);
  }

  // Seller document methods removed - use Owner document methods instead

  // ============== Properties with Details (for Dashboard) ==============

  async getCRMPropertiesDetailed() {
    const response = await fetch(`${API_BASE_URL}/crm/properties/list/detailed`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Property Agreements ==============

  async getPropertyAgreements(propertyId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/agreements`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createPropertyAgreement(propertyId: string, data: Record<string, unknown>, document?: File) {
    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    if (document) formData.append('document', document);
    
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/agreements`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    });
    return this.handleResponse(response);
  }

  async updatePropertyAgreement(propertyId: string, agreementId: string, data: Record<string, unknown>, document?: File) {
    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    if (document) formData.append('document', document);
    
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/agreements/${agreementId}`, {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: formData,
    });
    return this.handleResponse(response);
  }

  // ============== Property Verifications ==============

  async getPropertyVerifications(propertyId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/verifications`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createPropertyVerification(propertyId: string, data: Record<string, unknown>, document?: File) {
    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    if (document) formData.append('document', document);
    
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/verifications`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    });
    return this.handleResponse(response);
  }

  async updatePropertyVerification(propertyId: string, verificationId: string, data: Record<string, unknown>, document?: File) {
    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    if (document) formData.append('document', document);
    
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/verifications/${verificationId}`, {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: formData,
    });
    return this.handleResponse(response);
  }

  // ============== Property Documents ==============

  async getPropertyDocuments(propertyId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/documents`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async uploadPropertyDocuments(propertyId: string, files: File[], documentType: string, description?: string) {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('documentType', documentType);
    if (description) formData.append('description', description);

    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/documents/upload`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    });
    return this.handleResponse(response);
  }

  async uploadPropertyDocument(propertyId: string, file: File, documentType: string, description?: string) {
    const result = await this.uploadPropertyDocuments(propertyId, [file], documentType, description);
    if (Array.isArray(result)) return result[0];
    return result;
  }

  async deletePropertyDocument(propertyId: string, documentId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/documents/${documentId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Property Status Management Endpoints ==============

  async listPropertyForSale(propertyId: string, listedPrice: number) {
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/list-for-sale`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ listedPrice }),
    });
    return this.handleResponse(response);
  }

  async listPropertyForRent(propertyId: string, expectedRent: number, securityDeposit: number) {
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/list-for-rent`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ expectedRent, securityDeposit }),
    });
    return this.handleResponse(response);
  }

  async markPropertySold(propertyId: string, data: {
    soldPrice: number;
    buyerId?: string | null;
    saleType?: 'direct' | 'third_party';
    reasonLost?: string | null;
    notes?: string | null;
    brokerageAmount?: number;
    brokerageLost?: number;
  }) {
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/mark-sold`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async markPropertyRented(propertyId: string, data: {
    customerId: string;
    rentalDetails: {
      monthlyRent: number;
      leaseStartDate?: string;
      leaseEndDate?: string;
      securityDeposit?: number;
      brokeragePaid?: number;
      notes?: string;
    };
  }) {
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/mark-rented`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // ============== Enquiry Endpoints ==============

  // Get all enquiries
  async getEnquiries(status?: string) {
    const url = status
      ? `${API_BASE_URL}/enquiries?status=${status}`
      : `${API_BASE_URL}/enquiries`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get enquiry metrics
  async getEnquiryMetrics() {
    const response = await fetch(`${API_BASE_URL}/enquiries/metrics`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get single enquiry
  async getEnquiry(enquiryId: string) {
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Create enquiry manually (CRM)
  async createEnquiry(data: {
    formType?: string;
    name: string;
    email?: string;
    phone: string;
    message?: string;
    userType?: string;
    propertyType?: string;
    wantPropertyManagement?: boolean;
    source?: string;
    notes?: string;
    status?: 'new' | 'contacted' | 'converted' | 'closed';
    assignedTo?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/enquiries`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Update enquiry
  async updateEnquiry(enquiryId: string, data: { status?: string; notes?: string; assignedTo?: string }) {
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Convert enquiry to owner or tenant
  async convertEnquiry(enquiryId: string, convertTo: 'owner' | 'tenant') {
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}/convert`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ convertTo }),
    });
    return this.handleResponse(response);
  }

  // Close enquiry
  async closeEnquiry(enquiryId: string, reason?: string) {
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}/close`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason }),
    });
    return this.handleResponse(response);
  }

  // Reopen enquiry
  async reopenEnquiry(enquiryId: string) {
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}/reopen`, {
      method: 'PUT',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Lookup by Phone Endpoints ==============

  // Lookup owner by phone (for auto-fill)
  async lookupOwnerByPhone(phone: string) {
    const response = await fetch(`${API_BASE_URL}/crm/owners/lookup/by-phone?phone=${encodeURIComponent(phone)}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Lookup customer/tenant by phone (for auto-fill)
  async lookupCustomerByPhone(phone: string) {
    const response = await fetch(`${API_BASE_URL}/crm/customers/lookup/by-phone?phone=${encodeURIComponent(phone)}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== B2B Leads Endpoints ==============

  async getB2BLeads() {
    const response = await fetch(`${API_BASE_URL}/b2b-leads`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getB2BLead(leadId: string) {
    const response = await fetch(`${API_BASE_URL}/b2b-leads/${leadId}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async updateB2BLead(leadId: string, data: { status?: string; priority?: string; notes?: string }) {
    const response = await fetch(`${API_BASE_URL}/b2b-leads/${leadId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async addB2BLeadNote(leadId: string, note: string) {
    const response = await fetch(`${API_BASE_URL}/b2b-leads/${leadId}/notes`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ note }),
    });
    return this.handleResponse(response);
  }

  // ============== Business Analytics Endpoints ==============

  async getBusinessAnalytics() {
    const response = await fetch(`${API_BASE_URL}/crm/analytics/business`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Khata Book Endpoints ==============

  // Categories
  async getKhataCategories() {
    const response = await fetch(`${API_BASE_URL}/khata/categories`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createKhataCategory(name: string) {
    const response = await fetch(`${API_BASE_URL}/khata/categories`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name }),
    });
    return this.handleResponse(response);
  }

  async deleteKhataCategory(categoryId: string) {
    const response = await fetch(`${API_BASE_URL}/khata/categories/${categoryId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Entries
  async getKhataEntries(filters?: {
    propertyId?: string;
    partyType?: string;
    partyId?: string;
    transactionType?: string;
    settlementStatus?: string;
    categoryId?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
    }
    const url = queryParams.toString() 
      ? `${API_BASE_URL}/khata/entries?${queryParams}`
      : `${API_BASE_URL}/khata/entries`;
    
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getKhataEntry(entryId: string) {
    const response = await fetch(`${API_BASE_URL}/khata/entries/${entryId}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createKhataEntry(data: {
    propertyId: string;
    partyType: string;
    partyId: string;
    partyName: string;
    transactionType: string;
    amount?: number;
    categoryId?: string;
    categoryName?: string;
    lineItems?: Array<{ categoryId: string; categoryName: string; amount: number }>;
    description?: string;
    reminderAt?: string;
    reminderNote?: string;
    sourceRef?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/khata/entries`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateKhataEntry(entryId: string, data: {
    propertyId?: string;
    partyType?: string;
    partyId?: string;
    partyName?: string;
    transactionType?: string;
    amount?: number;
    categoryId?: string;
    categoryName?: string;
    lineItems?: Array<{ categoryId: string; categoryName: string; amount: number }>;
    description?: string;
    reminderAt?: string;
    reminderNote?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/khata/entries/${entryId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async settleKhataEntry(entryId: string, settlementNotes?: string) {
    const response = await fetch(`${API_BASE_URL}/khata/entries/${entryId}/settle`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ settlementNotes }),
    });
    return this.handleResponse(response);
  }

  async unsettleKhataEntry(entryId: string) {
    const response = await fetch(`${API_BASE_URL}/khata/entries/${entryId}/unsettle`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async deleteKhataEntry(entryId: string) {
    const response = await fetch(`${API_BASE_URL}/khata/entries/${entryId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Summary & Analytics
  async getKhataSummary() {
    const response = await fetch(`${API_BASE_URL}/khata/summary`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getKhataBifurcation(settlementStatus?: string) {
    const url = settlementStatus 
      ? `${API_BASE_URL}/khata/bifurcation?settlementStatus=${settlementStatus}`
      : `${API_BASE_URL}/khata/bifurcation`;
    
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Settlement Intelligence
  async getKhataAging() {
    const response = await fetch(`${API_BASE_URL}/khata/settlement/aging`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getKhataSettlementTrends() {
    const response = await fetch(`${API_BASE_URL}/khata/settlement/trends`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getKhataSettlementHistory(limit?: number) {
    const url = limit
      ? `${API_BASE_URL}/khata/settlement/history?limit=${limit}`
      : `${API_BASE_URL}/khata/settlement/history`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Search parties by name or phone
  async searchKhataParties(query: string, partyType?: string) {
    const queryParams = new URLSearchParams({ query });
    if (partyType) {
      queryParams.append('partyType', partyType);
    }
    const response = await fetch(`${API_BASE_URL}/khata/parties/search?${queryParams}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get properties for a specific party
  async getKhataPartyProperties(partyType: string, partyId: string) {
    const response = await fetch(`${API_BASE_URL}/khata/parties/${partyType}/${partyId}/properties`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Meeting/Calendar Endpoints ==============

  // Get all meetings with optional filters
  async getMeetings(filters?: { startDate?: string; endDate?: string; status?: string }) {
    const queryParams = new URLSearchParams();
    if (filters) {
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.status) queryParams.append('status', filters.status);
    }
    const url = queryParams.toString()
      ? `${API_BASE_URL}/crm/meetings?${queryParams}`
      : `${API_BASE_URL}/crm/meetings`;
    
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get upcoming meetings
  async getUpcomingMeetings(days?: number) {
    const url = days
      ? `${API_BASE_URL}/crm/meetings/upcoming?days=${days}`
      : `${API_BASE_URL}/crm/meetings/upcoming`;
    
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get meeting metrics
  async getMeetingMetrics() {
    const response = await fetch(`${API_BASE_URL}/crm/meetings/metrics`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get meetings for a specific entity
  async getMeetingsByEntity(entityType: string, entityId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/meetings/entity/${entityType}/${entityId}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get single meeting
  async getMeeting(meetingId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/meetings/${meetingId}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get meeting history/events
  async getMeetingHistory(meetingId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/meetings/${meetingId}/history`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Create meeting
  async createMeeting(data: {
    title: string;
    description?: string;
    meetingDate: string;
    meetingTime: string;
    duration?: number;
    location?: string;
    relatedEntityType: string;
    relatedEntityId: string;
    relatedEntityName?: string;
    relatedEntityPhone?: string;
    attendeeName?: string;
    attendeePhone?: string;
    attendeeEmail?: string;
    notes?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/crm/meetings`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Update meeting
  async updateMeeting(meetingId: string, data: {
    title?: string;
    description?: string;
    meetingDate?: string;
    meetingTime?: string;
    duration?: number;
    location?: string;
    status?: string;
    outcome?: string;
    notes?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/crm/meetings/${meetingId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Delete meeting
  async deleteMeeting(meetingId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Notification Endpoints ==============

  // Get all notifications with optional filters
  async getNotifications(options?: {
    category?: string;
    unreadOnly?: boolean;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (options?.category) queryParams.append('category', options.category);
    if (options?.unreadOnly) queryParams.append('unreadOnly', 'true');
    if (options?.limit) queryParams.append('limit', String(options.limit));

    const url = queryParams.toString()
      ? `${API_BASE_URL}/notifications?${queryParams}`
      : `${API_BASE_URL}/notifications`;

    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get notification counts (for badge display)
  async getNotificationCounts() {
    const response = await fetch(`${API_BASE_URL}/notifications/counts`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Mark a notification as read
  async markNotificationAsRead(notificationId: string) {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Mark all notifications as read
  async markAllNotificationsAsRead() {
    const response = await fetch(`${API_BASE_URL}/notifications/mark-all-read`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Process scheduled notifications (manual trigger)
  async processScheduledNotifications() {
    const response = await fetch(`${API_BASE_URL}/notifications/process-scheduled`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Generate rent expiry notifications (manual trigger)
  async generateRentExpiryNotifications() {
    const response = await fetch(`${API_BASE_URL}/notifications/generate-rent-expiry`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Process all notifications (scheduled + rent expiry)
  async processAllNotifications() {
    const response = await fetch(`${API_BASE_URL}/notifications/process-all`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get notification settings
  async getNotificationSettings() {
    const response = await fetch(`${API_BASE_URL}/notifications/settings`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Update notification settings
  async updateNotificationSettings(settings: {
    rentedExpiryThresholdDays?: number;
    meetingReminderMinutes?: number;
    enableRentExpiryNotifications?: boolean;
    enableMeetingReminders?: boolean;
    enableKhataReminders?: boolean;
  }) {
    const response = await fetch(`${API_BASE_URL}/notifications/settings`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(settings),
    });
    return this.handleResponse(response);
  }

  // Delete old notifications (cleanup)
  async cleanupOldNotifications(daysOld?: number) {
    const url = daysOld
      ? `${API_BASE_URL}/notifications/cleanup?daysOld=${daysOld}`
      : `${API_BASE_URL}/notifications/cleanup`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Contact Endpoints ==============

  // Get all contacts with optional filters
  async getContacts(filters?: { role?: string; status?: string }) {
    const queryParams = new URLSearchParams();
    if (filters?.role) queryParams.append('role', filters.role);
    if (filters?.status) queryParams.append('status', filters.status);

    const url = queryParams.toString()
      ? `${API_BASE_URL}/crm/contacts?${queryParams}`
      : `${API_BASE_URL}/crm/contacts`;

    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get contacts by specific role (convenience method)
  async getContactsByRole(role: 'owner' | 'buyer' | 'tenant') {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${role}s`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get contacts by role (convenience methods)
  async getContactOwners() {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/owners`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // getContactSellers removed - sellers are now owners with properties for sale

  async getContactBuyers() {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/buyers`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getContactTenants() {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/tenants`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Lookup contact by phone
  async lookupContactByPhone(phone: string) {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/lookup/by-phone?phone=${encodeURIComponent(phone)}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get single contact
  async getContact(contactId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get contact with document URLs
  async getContactWithDocuments(contactId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}/with-documents`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Create contact
  async createContact(data: {
    name: string;
    email?: string;
    phone: string;
    address?: string;
    roles?: { owner?: boolean; buyer?: boolean; tenant?: boolean };
    ownerProfile?: Record<string, unknown>;
    buyerProfile?: Record<string, unknown>;
    tenantProfile?: Record<string, unknown>;
    panNumber?: string;
    aadharNumber?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    source?: string;
    tags?: string[];
    notes?: string;
    status?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/crm/contacts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Create or update contact by phone (dedupe)
  async upsertContactByPhone(data: {
    name: string;
    email?: string;
    phone: string;
    address?: string;
    roles?: { owner?: boolean; buyer?: boolean; tenant?: boolean };
    ownerProfile?: Record<string, unknown>;
    buyerProfile?: Record<string, unknown>;
    tenantProfile?: Record<string, unknown>;
    source?: string;
    notes?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/upsert-by-phone`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Update contact
  async updateContact(contactId: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(this.stripDynamoFields(data)),
    });
    return this.handleResponse(response);
  }

  // Update contact role
  async updateContactRole(contactId: string, role: string, enabled: boolean, profileData?: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}/role`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ role, enabled, profileData }),
    });
    return this.handleResponse(response);
  }

  // Delete contact
  async deleteContact(contactId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Upload contact documents
  async uploadContactDocuments(contactId: string, files: { photo?: File; pan?: File; aadhar?: File }) {
    const formData = new FormData();
    if (files.photo) formData.append('photo', files.photo);
    if (files.pan) formData.append('pan', files.pan);
    if (files.aadhar) formData.append('aadhar', files.aadhar);

    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}/documents`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    });
    return this.handleResponse(response);
  }

  // Contact notes
  async getContactNotes(contactId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}/notes`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createContactNote(contactId: string, data: { content: string }) {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateContactNote(contactId: string, noteId: string, data: { content: string }) {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}/notes/${noteId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteContactNote(contactId: string, noteId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}/notes/${noteId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Contact activity timeline
  async getContactActivity(contactId: string, entityType?: string, entityId?: string) {
    const params = new URLSearchParams();
    if (entityType && entityId) {
      params.append('entityType', entityType);
      params.append('entityId', entityId);
    }
    const queryString = params.toString();
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}/activity${queryString ? `?${queryString}` : ''}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Migration endpoints
  async migrateOwnerToContact(ownerId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/migrate/owner/${ownerId}`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async migrateCustomerToContact(customerId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/migrate/customer/${customerId}`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async migrateAllToContacts() {
    const response = await fetch(`${API_BASE_URL}/crm/contacts/migrate/all`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Lead Endpoints ==============

  // Get all leads with optional filters
  async getLeads(filters?: { leadType?: string; status?: string; priority?: string; excludeConverted?: boolean }) {
    const queryParams = new URLSearchParams();
    if (filters?.leadType) queryParams.append('leadType', filters.leadType);
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.priority) queryParams.append('priority', filters.priority);
    if (filters?.excludeConverted) queryParams.append('excludeConverted', 'true');

    const url = queryParams.toString()
      ? `${API_BASE_URL}/crm/leads?${queryParams}`
      : `${API_BASE_URL}/crm/leads`;

    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get leads by type (convenience methods)
  async getBuyerLeads(excludeConverted?: boolean) {
    const url = excludeConverted
      ? `${API_BASE_URL}/crm/leads/buyers?excludeConverted=true`
      : `${API_BASE_URL}/crm/leads/buyers`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // getSellerLeads removed - seller-type leads now convert to owners

  async getTenantLeads(excludeConverted?: boolean) {
    const url = excludeConverted
      ? `${API_BASE_URL}/crm/leads/tenants?excludeConverted=true`
      : `${API_BASE_URL}/crm/leads/tenants`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getOwnerLeads(excludeConverted?: boolean) {
    const url = excludeConverted
      ? `${API_BASE_URL}/crm/leads/owners?excludeConverted=true`
      : `${API_BASE_URL}/crm/leads/owners`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get lead metrics
  async getLeadMetrics() {
    const response = await fetch(`${API_BASE_URL}/crm/leads/metrics`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get single lead
  async getLead(leadId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Create lead
  async createLead(data: {
    leadType: 'buyer' | 'seller' | 'tenant' | 'owner';
    name: string;
    email?: string;
    phone?: string;
    source?: string;
    status?: string;
    priority?: string;
    assignedTo?: string;
    buyerRequirement?: { requirement?: string; budget?: number; preferredArea?: string; bhk?: number; propertyType?: string; timeline?: string };
    sellerProperty?: { propertyType?: string; area?: string; expectedPrice?: number; timeline?: string; notes?: string };
    tenantRequirement?: { requirement?: string; budget?: number; preferredArea?: string; moveInDate?: string };
    ownerProperty?: { propertyType?: string; area?: string; rentExpected?: number; notes?: string };
    notes?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/crm/leads`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Update lead
  async updateLead(leadId: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(this.stripDynamoFields(data)),
    });
    return this.handleResponse(response);
  }

  // Convert lead to buyer/tenant/owner/seller based on lead type
  async convertLead(leadId: string, options: Record<string, unknown> = {}) {
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}/convert`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(options),
    });
    return this.handleResponse(response);
  }

  // Get matching contacts for lead conversion
  async getMatchingContactsForLead(leadId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}/matching-contacts`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Delete lead
  async deleteLead(leadId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Lead notes
  async getLeadNotes(leadId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}/notes`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createLeadNote(leadId: string, data: { content: string }) {
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}/notes`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateLeadNote(leadId: string, noteId: string, data: { content: string }) {
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}/notes/${noteId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteLeadNote(leadId: string, noteId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}/notes/${noteId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Search leads by name, phone, or email
  async searchLeads(q: string) {
    const response = await fetch(`${API_BASE_URL}/crm/leads/search?q=${encodeURIComponent(q)}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Get available agents for assignedTo dropdown
  async getLeadAgents(): Promise<Array<{ userId: string; username: string; label: string; role?: string }>> {
    const response = await fetch(`${API_BASE_URL}/crm/leads/agents`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Buyer Endpoints ==============

  async getBuyers(filters?: { status?: string; priority?: string; propertyType?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.propertyType) params.append('propertyType', filters.propertyType);
    
    const url = `${API_BASE_URL}/crm/buyers${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getBuyer(buyerId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/buyers/${buyerId}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createBuyer(data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/crm/buyers`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateBuyer(buyerId: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/crm/buyers/${buyerId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(this.stripDynamoFields(data)),
    });
    return this.handleResponse(response);
  }

  async getBuyerNotes(buyerId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/buyers/${buyerId}/notes`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createBuyerNote(buyerId: string, data: { content: string }) {
    const response = await fetch(`${API_BASE_URL}/crm/buyers/${buyerId}/notes`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async getBuyerMetrics() {
    const response = await fetch(`${API_BASE_URL}/crm/buyers/metrics/summary`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Seller Endpoints REMOVED ==============
  // Sellers are now managed as OWNERS with properties listed for sale
  // Use getOwners() and filter properties by status='for-sale' instead

  // Cross-role phone lookup
  async lookupPersonByPhone(phone: string) {
    const response = await fetch(`${API_BASE_URL}/crm/buyers/lookup/by-phone?phone=${encodeURIComponent(phone)}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Search Endpoints ==============

  // Search owners by name or phone
  async searchOwners(query: string) {
    const response = await fetch(`${API_BASE_URL}/crm/search/owners?q=${encodeURIComponent(query)}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Search customers/tenants by name or phone
  async searchCustomers(query: string) {
    const response = await fetch(`${API_BASE_URL}/crm/search/customers?q=${encodeURIComponent(query)}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Search properties with filters
  async searchProperties(query: string, filters?: {
    status?: string;
    propertyType?: string;
    bhk?: string;
    furnishing?: string;
    minRent?: string;
    maxRent?: string;
  }) {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.propertyType) params.append('propertyType', filters.propertyType);
    if (filters?.bhk) params.append('bhk', filters.bhk);
    if (filters?.furnishing) params.append('furnishing', filters.furnishing);
    if (filters?.minRent) params.append('minRent', filters.minRent);
    if (filters?.maxRent) params.append('maxRent', filters.maxRent);
    
    const response = await fetch(`${API_BASE_URL}/crm/search/properties?${params.toString()}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Real Estate Management - Projects ==============

  async getProjects(filters?: { status?: string; developerId?: string; areaId?: string; lifecycleStatus?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.developerId) params.append('developerId', filters.developerId);
    if (filters?.areaId) params.append('areaId', filters.areaId);
    if (filters?.lifecycleStatus) params.append('lifecycleStatus', filters.lifecycleStatus);
    
    const url = `${API_BASE_URL}/crm/projects${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse(response);
    return result.data || result;
  }

  async getProject(projectId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse(response);
    return result.data || result;
  }

  async getProjectBySlug(slug: string) {
    const response = await fetch(`${API_BASE_URL}/crm/projects/slug/${slug}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createProject(data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/crm/projects`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateProject(projectId: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(this.stripDynamoFields(data)),
    });
    return this.handleResponse(response);
  }

  async deleteProject(projectId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async updateProjectStatus(projectId: string, status: string, metadata?: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/status`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ status, ...metadata }),
    });
    return this.handleResponse(response);
  }

  async updateProjectInventory(projectId: string, inventoryData: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/inventory`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(inventoryData),
    });
    return this.handleResponse(response);
  }

  async markProjectUnitSold(projectId: string, unitType?: string, quantity?: number) {
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/units/sold`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ unitType, quantity }),
    });
    return this.handleResponse(response);
  }

  async incrementProjectViews(projectId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/views`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async incrementProjectEnquiries(projectId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/enquiries`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async searchProjects(query: string) {
    const response = await fetch(`${API_BASE_URL}/crm/projects/search?q=${encodeURIComponent(query)}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getProjectMetrics() {
    const response = await fetch(`${API_BASE_URL}/crm/projects/metrics`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse(response);
    return result.data || result;
  }

  async getProjectDetailedMetrics(projectId: string) {
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/metrics`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse(response);
    return result.data || result;
  }

  // ============== Developer Media Upload ==============

  async uploadDeveloperLogo(developerId: string, file: File) {
    const formData = new FormData();
    formData.append('logo', file);
    
    const headers = this.getHeaders(true);
    
    const response = await fetch(`${API_BASE_URL}/crm/developers/${developerId}/logo`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const result = await this.handleResponse(response);
    return result.data || result;
  }

  async uploadDeveloperImages(developerId: string, files: File[]) {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    
    const headers = this.getHeaders(true);
    
    const response = await fetch(`${API_BASE_URL}/crm/developers/${developerId}/images`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const result = await this.handleResponse(response);
    return result.data || result;
  }

  async uploadDeveloperVideos(developerId: string, files: File[]) {
    const formData = new FormData();
    files.forEach(file => formData.append('videos', file));
    
    const headers = this.getHeaders(true);
    
    const response = await fetch(`${API_BASE_URL}/crm/developers/${developerId}/videos`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const result = await this.handleResponse(response);
    return result.data || result;
  }

  async deleteDeveloperImage(developerId: string, s3Key: string) {
    const response = await fetch(`${API_BASE_URL}/crm/developers/${developerId}/images`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ s3Key }),
    });
    return this.handleResponse(response);
  }

  async deleteDeveloperVideo(developerId: string, s3Key: string) {
    const response = await fetch(`${API_BASE_URL}/crm/developers/${developerId}/videos`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ s3Key }),
    });
    return this.handleResponse(response);
  }

  // ============== Area Media Upload ==============

  async uploadAreaImages(areaId: string, files: File[]) {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    
    const headers = this.getHeaders(true);
    
    const response = await fetch(`${API_BASE_URL}/crm/real-estate-areas/${areaId}/images`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const result = await this.handleResponse(response);
    return result.data || result;
  }

  async uploadAreaVideos(areaId: string, files: File[]) {
    const formData = new FormData();
    files.forEach(file => formData.append('videos', file));
    
    const headers = this.getHeaders(true);
    
    const response = await fetch(`${API_BASE_URL}/crm/real-estate-areas/${areaId}/videos`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const result = await this.handleResponse(response);
    return result.data || result;
  }

  async deleteAreaImage(areaId: string, s3Key: string) {
    const response = await fetch(`${API_BASE_URL}/crm/real-estate-areas/${areaId}/images`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ s3Key }),
    });
    return this.handleResponse(response);
  }

  async deleteAreaVideo(areaId: string, s3Key: string) {
    const response = await fetch(`${API_BASE_URL}/crm/real-estate-areas/${areaId}/videos`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ s3Key }),
    });
    return this.handleResponse(response);
  }

  // ============== Project Media & Document Upload ==============

  async uploadProjectImages(projectId: string, files: File[]) {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    
    const headers = this.getHeaders(true);
    
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/images`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const result = await this.handleResponse(response);
    return result.data || result;
  }

  async uploadProjectVideos(projectId: string, files: File[]) {
    const formData = new FormData();
    files.forEach(file => formData.append('videos', file));
    
    const headers = this.getHeaders(true);
    
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/videos`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const result = await this.handleResponse(response);
    return result.data || result;
  }

  async uploadProjectBrochure(projectId: string, file: File) {
    const formData = new FormData();
    formData.append('brochure', file);
    
    const headers = this.getHeaders(true);
    
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/brochure`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const result = await this.handleResponse(response);
    return result.data || result;
  }

  async uploadProjectFloorPlans(projectId: string, files: File[]) {
    const formData = new FormData();
    files.forEach(file => formData.append('floorPlans', file));
    
    const headers = this.getHeaders(true);
    
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/floor-plans`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const result = await this.handleResponse(response);
    return result.data || result;
  }

  async deleteProjectImage(projectId: string, s3Key: string) {
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/images`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ s3Key }),
    });
    return this.handleResponse(response);
  }

  async deleteProjectVideo(projectId: string, s3Key: string) {
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/videos`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ s3Key }),
    });
    return this.handleResponse(response);
  }

  async deleteProjectFloorPlan(projectId: string, s3Key: string) {
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/floor-plans`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ s3Key }),
    });
    return this.handleResponse(response);
  }

  // ============== AI Employee ==============

  async getAgentActivity(params?: { limit?: number; agentId?: string }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.agentId) query.set('agentId', params.agentId);
    const response = await fetch(`${API_BASE_URL}/crm/agents/activity?${query}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getAiEmployeeConfig() {
    const response = await fetch(`${API_BASE_URL}/crm/config/ai-employee`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async updateAiEmployeeConfig(config: {
    aiEmployeeEnabled?: boolean;
    followupAgentMode?: 'draft' | 'autosend';
    followupAgentAutoSendChannels?: string[];
    aiPersonality?: 'professional' | 'friendly' | 'direct';
    autoReply?: boolean;
    businessHoursStart?: string;
    businessHoursEnd?: string;
    timezone?: string;
    connectedWhatsAppPhone?: string | null;
  }) {
    const response = await fetch(`${API_BASE_URL}/crm/config/ai-employee`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(config),
    });
    return this.handleResponse(response);
  }

  async getAiEmployeeProvisioningStatus() {
    const response = await fetch(`${API_BASE_URL}/ai-employee/status`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async sendTestAiMessage() {
    const response = await fetch(`${API_BASE_URL}/ai-employee/test-message`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== WhatsApp Inbox ==============

  async getWhatsAppConversations(): Promise<ConversationSummary[]> {
    const response = await fetch(`${API_BASE_URL}/api/whatsapp/conversations`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse(response);
    return result.conversations || result.data || result || [];
  }

  async getWhatsAppConversation(phone: string): Promise<WhatsAppConversation> {
    const encodedPhone = encodeURIComponent(phone);
    const response = await fetch(`${API_BASE_URL}/api/whatsapp/conversations/${encodedPhone}`, {
      headers: this.getHeaders(),
    });
    const result = await this.handleResponse(response);
    return result.data || result;
  }

  async markWhatsAppConversationRead(phone: string): Promise<void> {
    const encodedPhone = encodeURIComponent(phone);
    const response = await fetch(`${API_BASE_URL}/api/whatsapp/conversations/${encodedPhone}/read`, {
      method: 'PATCH',
      headers: this.getHeaders(),
    });
    await this.handleResponse(response);
  }

  async sendWhatsAppMessage(phone: string, text: string): Promise<{ success: boolean; sent: boolean; messageId: string }> {
    const encodedPhone = encodeURIComponent(phone);
    const response = await fetch(`${API_BASE_URL}/api/whatsapp/conversations/${encodedPhone}/messages`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ text }),
    });
    return this.handleResponse(response);
  }

  async getWhatsAppConnectionStatus(phone: string): Promise<{ connected: boolean; state?: string; error?: string; sessionId?: string | null }> {
    const encodedPhone = encodeURIComponent(phone);
    const response = await fetch(`${API_BASE_URL}/api/whatsapp/status/${encodedPhone}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      return { connected: false, error: 'status_check_failed' };
    }
    const result = await this.handleResponse(response);
    return result.data || result;
  }
}

export const api = new ApiService();


