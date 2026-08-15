import { getTenantHeaders } from '../config/tenant';
import type {
  CreateCustomerData,
  UpdateCustomerData,
  CreateOwnerData,
  UpdateOwnerData,
  CreatePropertyData,
  UpdatePropertyData,
  BuyerRequirement,
  SellerProperty,
  TenantRequirement,
  OwnerProperty,
} from '../types/crm';
import type { ConversationSummary } from '../types/whatsapp';
import type { UploadUrlResponse } from '../types/callIntelligence';
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

  async get(path: string) {
    const init = { headers: this.getHeaders() };
    const response = await fetch(`${API_BASE_URL}${path}`, init);
    return this.handleResponse(response, init);
  }

  async post(path: string, data?: Record<string, unknown>) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    };
    const response = await fetch(`${API_BASE_URL}${path}`, init);
    return this.handleResponse(response, init);
  }

  async delete(path: string) {
    const init = { method: 'DELETE', headers: this.getHeaders() };
    const response = await fetch(`${API_BASE_URL}${path}`, init);
    return this.handleResponse(response, init);
  }

  async getEnquiryNotes(enquiryId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}/notes`, init);
    return this.handleResponse(response, init);
  }

  async createEnquiryNote(enquiryId: string, data: Record<string, unknown>) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}/notes`, init);
    return this.handleResponse(response, init);
  }

  async updateEnquiryNote(enquiryId: string, noteId: string, data: Record<string, unknown>) {
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}/notes/${noteId}`, init);
    return this.handleResponse(response, init);
  }

  async deleteEnquiryNote(enquiryId: string, noteId: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}/notes/${noteId}`, init);
    return this.handleResponse(response, init);
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

  private async handleResponse(response: Response, init?: RequestInit) {
    // Express ETag → 304 has no body. Retry once with cache bypass (never recurse).
    if (response.status === 304) {
      const sep = response.url.includes('?') ? '&' : '?';
      const retry = await fetch(`${response.url}${sep}_nc=${Date.now()}`, {
        method: init?.method || 'GET',
        cache: 'no-store',
        credentials: 'include',
        headers: {
          ...this.getHeaders(),
          ...(init?.headers as Record<string, string> | undefined),
        },
        body: init?.body,
      });
      if (!retry.ok) {
        const error = await retry.json().catch(() => ({ error: `HTTP ${retry.status}` }));
        throw new Error(error.error || `HTTP ${retry.status}`);
      }
      return retry.json();
    }

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
            return this.retryRequest(response, init);
          } else {
            // Wait for the refresh to complete
            return new Promise((resolve) => {
              this.subscribeTokenRefresh(() => {
                resolve(this.retryRequest(response, init));
              });
            });
          }
        } catch (refreshError) {
          console.error('[ApiService] Token refresh failed:', refreshError);
          this.isRefreshing = false;
          this.clearToken();
          // Signal the auth state machine in App.tsx rather than hard-navigating.
          // A location assignment triggers a full document load, which the web
          // app only survives because CloudFront rewrites unknown paths to
          // index.html. Capacitor's local server has no such rule, so on mobile
          // this was a white screen. clearToken() does not dispatch this itself,
          // unlike clearAuth() in authStorage.
          window.dispatchEvent(new Event('auth-changed'));
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
      const err = new Error(error.message || error.error || `HTTP ${response.status}`) as Error & {
        code?: string;
        convertedTo?: unknown;
      };
      if (error.code) err.code = error.code;
      if (error.convertedTo) err.convertedTo = error.convertedTo;
      throw err;
    }
    return response.json();
  }

  private async retryRequest(originalResponse: Response, init?: RequestInit): Promise<any> {
    const url = originalResponse.url;
    const options: RequestInit = {
      method: init?.method || 'GET',
      headers: this.getHeaders(),
      credentials: 'include',
    };

    // For non-GET retries, preserve the original body. If the body was a stream or
    // FormData it may not be reusable, so we throw a clear error instead of silently
    // changing the method.
    if (options.method !== 'GET' && options.method !== 'HEAD') {
      if (init?.body) {
        options.body = init.body;
      } else {
        throw new Error(
          `Session expired during a ${options.method} request. Please retry your action after logging in again.`
        );
      }
    }

    const response = await fetch(url, options);
    return this.handleResponse(response, options);
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

  /** Unwrap paginated list responses `{ items, total }` or return arrays as-is. */
  private unwrapList<T>(data: unknown, listKey: string): T[] {
    if (Array.isArray(data)) return data as T[];
    if (data && typeof data === 'object' && listKey in data) {
      const list = (data as Record<string, unknown>)[listKey];
      return Array.isArray(list) ? (list as T[]) : [];
    }
    return [];
  }

  /** Fetch all pages from a paginated CRM list endpoint. */
  private async fetchAllPaginated<T>(
    buildUrl: (offset: number, limit: number) => string,
    listKey: string,
    pageSize = 200,
  ): Promise<T[]> {
    const all: T[] = [];
    let offset = 0;
    let total = Infinity;

    while (offset < total) {
      const init: RequestInit = {
        headers: this.getHeaders(),
        cache: 'no-store',
        credentials: 'include',
      };
      const response = await fetch(buildUrl(offset, pageSize), init);
      const data = await this.handleResponse(response, init);
      const page = this.unwrapList<T>(data, listKey);
      const pageTotal = (data as { total?: number })?.total;
      all.push(...page);
      total = typeof pageTotal === 'number' ? pageTotal : all.length;
      offset += pageSize;
      if (page.length === 0) break;
    }

    return all;
  }

  // ============== CRM Endpoints ==============

  // CRM Metrics
  async getCRMMetrics() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/metrics`, init);
    return this.handleResponse(response, init);
  }

  // Customer endpoints
  async getCustomers() {
    return this.fetchAllPaginated<import('../types/crm').CRMCustomer>(
      (offset, limit) => `${API_BASE_URL}/crm/customers?limit=${limit}&offset=${offset}`,
      'customers',
    );
  }

  async getCustomer(customerId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}`, init);
    return this.handleResponse(response, init);
  }

  async createCustomer(data: CreateCustomerData) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/customers`, init);
    return this.handleResponse(response, init);
  }

  async updateCustomer(customerId: string, data: UpdateCustomerData) {
    const safeData = this.stripDynamoFields(data as any);
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(safeData),
    };
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}`, init);
    return this.handleResponse(response, init);
  }

  async deleteCustomer(customerId: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}`, init);
    return this.handleResponse(response, init);
  }

  async getCustomerNotes(customerId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}/notes`, init);
    return this.handleResponse(response, init);
  }

  async createCustomerNote(customerId: string, data: Record<string, unknown>) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}/notes`, init);
    return this.handleResponse(response, init);
  }

  async updateCustomerNote(customerId: string, noteId: string, data: Record<string, unknown>) {
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}/notes/${noteId}`, init);
    return this.handleResponse(response, init);
  }

  async deleteCustomerNote(customerId: string, noteId: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}/notes/${noteId}`, init);
    return this.handleResponse(response, init);
  }

  // Phone lookup for auto-fill
  async getCustomerByPhone(phone: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/customers/lookup/by-phone?phone=${encodeURIComponent(phone)}`, init);
    return this.handleResponse(response, init);
  }

  async getOwnerByPhone(phone: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/owners/lookup/by-phone?phone=${encodeURIComponent(phone)}`, init);
    return this.handleResponse(response, init);
  }

  // Owner endpoints
  async getOwners(filters?: { status?: string; seller?: boolean }) {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') {
      params.set('status', filters.status);
    } else if (filters?.status === 'all') {
      params.set('status', 'all');
    }
    if (filters?.seller) {
      params.set('seller', 'true');
    }
    const query = params.toString();
    const suffix = query ? `&${query}` : '';
    return this.fetchAllPaginated<import('../types/crm').CRMOwner>(
      (offset, limit) => `${API_BASE_URL}/crm/owners?limit=${limit}&offset=${offset}${suffix}`,
      'owners',
    );
  }

  async getOwnerNotes(ownerId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}/notes`, init);
    return this.handleResponse(response, init);
  }

  async createOwnerNote(ownerId: string, data: Record<string, unknown>) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}/notes`, init);
    return this.handleResponse(response, init);
  }

  async updateOwnerNote(ownerId: string, noteId: string, data: Record<string, unknown>) {
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}/notes/${noteId}`, init);
    return this.handleResponse(response, init);
  }

  async deleteOwnerNote(ownerId: string, noteId: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}/notes/${noteId}`, init);
    return this.handleResponse(response, init);
  }

  async createOwner(data: CreateOwnerData) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/owners`, init);
    return this.handleResponse(response, init);
  }

  async updateOwner(ownerId: string, data: UpdateOwnerData) {
    const safeData = this.stripDynamoFields(data as any);
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(safeData),
    };
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}`, init);
    return this.handleResponse(response, init);
  }

  async deleteOwner(ownerId: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}`, init);
    return this.handleResponse(response, init);
  }

  async getOwnerProperties(ownerId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}/properties`, init);
    return this.handleResponse(response, init);
  }

  // Property endpoints (CRM)
  async getCRMProperties(status?: string) {
    return this.fetchAllPaginated<import('../types/crm').CRMProperty>(
      (offset, limit) => {
        const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
        if (status) params.set('status', status);
        return `${API_BASE_URL}/crm/properties?${params}`;
      },
      'properties',
    );
  }

  async getCRMProperty(propertyId: string) {
    const init: RequestInit = {
      headers: this.getHeaders(),
      cache: 'no-store',
      credentials: 'include',
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}`, init);
    return this.handleResponse(response, init);
  }

  async getPropertyRentalHistory(propertyId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/rental-history`, init);
    return this.handleResponse(response, init);
  }

  async createCRMProperty(data: CreatePropertyData) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties`, init);
    return this.handleResponse(response, init);
  }

  async updateCRMProperty(propertyId: string, data: UpdatePropertyData) {
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}`, init);
    return this.handleResponse(response, init);
  }

  async deleteCRMProperty(propertyId: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}`, init);
    return this.handleResponse(response, init);
  }

  async uploadPropertyImages(propertyId: string, files: File[]) {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    
    const init = {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/images`, init);
    return this.handleResponse(response, init);
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
    
    const init = {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/videos`, init);
    return this.handleResponse(response, init);
  }

  async deletePropertyImage(propertyId: string, imageKey: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/images/${encodeURIComponent(imageKey)}`, init);
    return this.handleResponse(response, init);
  }

  async deletePropertyVideo(propertyId: string, videoKey: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/videos/${encodeURIComponent(videoKey)}`, init);
    return this.handleResponse(response, init);
  }

  // Public property endpoints (for /properties page)
  async getPublicProperties() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/public/list`, init);
    return this.handleResponse(response, init);
  }

  async getPublicProperty(propertyId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/public/${propertyId}`, init);
    return this.handleResponse(response, init);
  }

  // ============== Owner Document Upload ==============
  
  async uploadOwnerDocuments(ownerId: string, files: { photo?: File; pan?: File; aadhar?: File }) {
    const formData = new FormData();
    if (files.photo) formData.append('photo', files.photo);
    if (files.pan) formData.append('pan', files.pan);
    if (files.aadhar) formData.append('aadhar', files.aadhar);

    const init = {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    };
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}/documents`, init);
    return this.handleResponse(response, init);
  }

  async getOwnerWithDocuments(ownerId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/owners/${ownerId}/with-documents`, init);
    return this.handleResponse(response, init);
  }

  // ============== Customer/Tenant Document Upload ==============

  async uploadCustomerDocuments(customerId: string, files: { photo?: File; pan?: File; aadhar?: File }) {
    const formData = new FormData();
    if (files.photo) formData.append('photo', files.photo);
    if (files.pan) formData.append('pan', files.pan);
    if (files.aadhar) formData.append('aadhar', files.aadhar);

    const init = {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    };
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}/documents`, init);
    return this.handleResponse(response, init);
  }

  async getCustomerWithDocuments(customerId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/customers/${customerId}/with-documents`, init);
    return this.handleResponse(response, init);
  }

  // ============== Buyer Document Upload ==============

  async uploadBuyerDocuments(buyerId: string, files: { photo?: File; pan?: File; aadhar?: File }) {
    const formData = new FormData();
    if (files.photo) formData.append('photo', files.photo);
    if (files.pan) formData.append('pan', files.pan);
    if (files.aadhar) formData.append('aadhar', files.aadhar);

    const init = {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    };
    const response = await fetch(`${API_BASE_URL}/crm/buyers/${buyerId}/documents`, init);
    return this.handleResponse(response, init);
  }

  async getBuyerWithDocuments(buyerId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/buyers/${buyerId}/with-documents`, init);
    return this.handleResponse(response, init);
  }

  async createBuyerListing(buyerId: string, propertyId: string, listingType: 'rent' | 'sale') {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ propertyId, listingType }),
    };
    const response = await fetch(`${API_BASE_URL}/crm/buyers/${buyerId}/list-property`, init);
    return this.handleResponse(response, init);
  }

  // Seller document methods removed - use Owner document methods instead

  // ============== Properties with Details (for Dashboard) ==============

  async getCRMPropertiesDetailed() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/list/detailed`, init);
    return this.handleResponse(response, init);
  }

  // ============== Property Agreements ==============

  async getPropertyAgreements(propertyId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/agreements`, init);
    return this.handleResponse(response, init);
  }

  async createPropertyAgreement(propertyId: string, data: Record<string, unknown>, document?: File) {
    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    if (document) formData.append('document', document);
    
    const init = {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/agreements`, init);
    return this.handleResponse(response, init);
  }

  async updatePropertyAgreement(propertyId: string, agreementId: string, data: Record<string, unknown>, document?: File) {
    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    if (document) formData.append('document', document);
    
    const init = {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: formData,
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/agreements/${agreementId}`, init);
    return this.handleResponse(response, init);
  }

  // ============== Property Verifications ==============

  async getPropertyVerifications(propertyId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/verifications`, init);
    return this.handleResponse(response, init);
  }

  async createPropertyVerification(propertyId: string, data: Record<string, unknown>, document?: File) {
    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    if (document) formData.append('document', document);
    
    const init = {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/verifications`, init);
    return this.handleResponse(response, init);
  }

  async updatePropertyVerification(propertyId: string, verificationId: string, data: Record<string, unknown>, document?: File) {
    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    if (document) formData.append('document', document);
    
    const init = {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: formData,
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/verifications/${verificationId}`, init);
    return this.handleResponse(response, init);
  }

  // ============== Property Documents ==============

  async getPropertyDocuments(propertyId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/documents`, init);
    return this.handleResponse(response, init);
  }

  async uploadPropertyDocuments(propertyId: string, files: File[], documentType: string, description?: string) {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('documentType', documentType);
    if (description) formData.append('description', description);

    const init = {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/documents/upload`, init);
    return this.handleResponse(response, init);
  }

  async uploadPropertyDocument(propertyId: string, file: File, documentType: string, description?: string) {
    const result = await this.uploadPropertyDocuments(propertyId, [file], documentType, description);
    if (Array.isArray(result)) return result[0];
    return result;
  }

  async deletePropertyDocument(propertyId: string, documentId: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/documents/${documentId}`, init);
    return this.handleResponse(response, init);
  }

  // ============== Property Status Management Endpoints ==============

  async listPropertyForSale(propertyId: string, listedPrice: number) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ listedPrice }),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/list-for-sale`, init);
    return this.handleResponse(response, init);
  }

  async getListings(filters?: {
    status?: string;
    listingType?: string;
    propertyId?: string;
    listedByContactId?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.listingType) queryParams.append('listingType', filters.listingType);
    if (filters?.propertyId) queryParams.append('propertyId', filters.propertyId);
    if (filters?.listedByContactId) queryParams.append('listedByContactId', filters.listedByContactId);
    const qs = queryParams.toString();
    const init = { headers: this.getHeaders() };
    const response = await fetch(
      `${API_BASE_URL}/crm/listings${qs ? `?${qs}` : ''}`,
      init
    );
    return this.handleResponse(response, init);
  }

  async withdrawListing(listingId: string, reason?: string) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason: reason || 'withdrawn' }),
    };
    const response = await fetch(`${API_BASE_URL}/crm/listings/${listingId}/withdraw`, init);
    return this.handleResponse(response, init);
  }

  async listPropertyForRent(propertyId: string, expectedRent: number, securityDeposit: number) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ expectedRent, securityDeposit }),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/list-for-rent`, init);
    return this.handleResponse(response, init);
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
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/mark-sold`, init);
    return this.handleResponse(response, init);
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
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/properties/${propertyId}/mark-rented`, init);
    return this.handleResponse(response, init);
  }

  // ============== Enquiry Endpoints ==============

  // Get all enquiries
  async getEnquiries(status?: string) {
    const url = status
      ? `${API_BASE_URL}/enquiries?status=${status}`
      : `${API_BASE_URL}/enquiries`;
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(url, init);
    return this.handleResponse(response, init);
  }

  // Get enquiry metrics
  async getEnquiryMetrics() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/enquiries/metrics`, init);
    return this.handleResponse(response, init);
  }

  // Get single enquiry
  async getEnquiry(enquiryId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}`, init);
    return this.handleResponse(response, init);
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
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/enquiries`, init);
    return this.handleResponse(response, init);
  }

  // Update enquiry
  async updateEnquiry(enquiryId: string, data: { status?: string; notes?: string; assignedTo?: string }) {
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}`, init);
    return this.handleResponse(response, init);
  }

  // Convert enquiry to owner or tenant
  async convertEnquiry(enquiryId: string, convertTo: 'owner' | 'tenant') {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ convertTo }),
    };
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}/convert`, init);
    return this.handleResponse(response, init);
  }

  // Close enquiry
  async closeEnquiry(enquiryId: string, reason?: string) {
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason }),
    };
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}/close`, init);
    return this.handleResponse(response, init);
  }

  // Reopen enquiry
  async reopenEnquiry(enquiryId: string) {
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/enquiries/${enquiryId}/reopen`, init);
    return this.handleResponse(response, init);
  }

  // ============== Lookup by Phone Endpoints ==============

  // Lookup owner by phone (for auto-fill)
  async lookupOwnerByPhone(phone: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/owners/lookup/by-phone?phone=${encodeURIComponent(phone)}`, init);
    return this.handleResponse(response, init);
  }

  // Lookup customer/tenant by phone (for auto-fill)
  async lookupCustomerByPhone(phone: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/customers/lookup/by-phone?phone=${encodeURIComponent(phone)}`, init);
    return this.handleResponse(response, init);
  }

  // ============== B2B Leads Endpoints ==============

  async getB2BLeads() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/b2b-leads`, init);
    return this.handleResponse(response, init);
  }

  async getB2BLead(leadId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/b2b-leads/${leadId}`, init);
    return this.handleResponse(response, init);
  }

  async updateB2BLead(leadId: string, data: { status?: string; priority?: string; notes?: string }) {
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/b2b-leads/${leadId}`, init);
    return this.handleResponse(response, init);
  }

  async addB2BLeadNote(leadId: string, note: string) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ note }),
    };
    const response = await fetch(`${API_BASE_URL}/b2b-leads/${leadId}/notes`, init);
    return this.handleResponse(response, init);
  }

  // ============== Business Analytics Endpoints ==============

  async getBusinessAnalytics() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/analytics/business`, init);
    return this.handleResponse(response, init);
  }

  // ============== Khata Book Endpoints ==============

  // Categories
  async getKhataCategories() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/khata/categories`, init);
    return this.handleResponse(response, init);
  }

  async createKhataCategory(name: string) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name }),
    };
    const response = await fetch(`${API_BASE_URL}/khata/categories`, init);
    return this.handleResponse(response, init);
  }

  async deleteKhataCategory(categoryId: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/khata/categories/${categoryId}`, init);
    return this.handleResponse(response, init);
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
    
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(url, init);
    return this.handleResponse(response, init);
  }

  async getKhataEntry(entryId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/khata/entries/${entryId}`, init);
    return this.handleResponse(response, init);
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
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/khata/entries`, init);
    return this.handleResponse(response, init);
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
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/khata/entries/${entryId}`, init);
    return this.handleResponse(response, init);
  }

  async settleKhataEntry(entryId: string, settlementNotes?: string) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ settlementNotes }),
    };
    const response = await fetch(`${API_BASE_URL}/khata/entries/${entryId}/settle`, init);
    return this.handleResponse(response, init);
  }

  async unsettleKhataEntry(entryId: string) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/khata/entries/${entryId}/unsettle`, init);
    return this.handleResponse(response, init);
  }

  async deleteKhataEntry(entryId: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/khata/entries/${entryId}`, init);
    return this.handleResponse(response, init);
  }

  // Summary & Analytics
  async getKhataSummary() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/khata/summary`, init);
    return this.handleResponse(response, init);
  }

  async getKhataBifurcation(settlementStatus?: string) {
    const url = settlementStatus 
      ? `${API_BASE_URL}/khata/bifurcation?settlementStatus=${settlementStatus}`
      : `${API_BASE_URL}/khata/bifurcation`;
    
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(url, init);
    return this.handleResponse(response, init);
  }

  // Settlement Intelligence
  async getKhataAging() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/khata/settlement/aging`, init);
    return this.handleResponse(response, init);
  }

  async getKhataSettlementTrends() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/khata/settlement/trends`, init);
    return this.handleResponse(response, init);
  }

  async getKhataSettlementHistory(limit?: number) {
    const url = limit
      ? `${API_BASE_URL}/khata/settlement/history?limit=${limit}`
      : `${API_BASE_URL}/khata/settlement/history`;
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(url, init);
    return this.handleResponse(response, init);
  }

  // Search parties by name or phone
  async searchKhataParties(query: string, partyType?: string) {
    const queryParams = new URLSearchParams({ query });
    if (partyType) {
      queryParams.append('partyType', partyType);
    }
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/khata/parties/search?${queryParams}`, init);
    return this.handleResponse(response, init);
  }

  // Get properties for a specific party
  async getKhataPartyProperties(partyType: string, partyId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/khata/parties/${partyType}/${partyId}/properties`, init);
    return this.handleResponse(response, init);
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
    
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(url, init);
    return this.handleResponse(response, init);
  }

  // Get upcoming meetings
  async getUpcomingMeetings(days?: number) {
    const url = days
      ? `${API_BASE_URL}/crm/meetings/upcoming?days=${days}`
      : `${API_BASE_URL}/crm/meetings/upcoming`;
    
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(url, init);
    return this.handleResponse(response, init);
  }

  // Get meeting metrics
  async getMeetingMetrics() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/meetings/metrics`, init);
    return this.handleResponse(response, init);
  }

  // Get meetings for a specific entity
  async getMeetingsByEntity(entityType: string, entityId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/meetings/entity/${entityType}/${entityId}`, init);
    return this.handleResponse(response, init);
  }

  // Get single meeting
  async getMeeting(meetingId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/meetings/${meetingId}`, init);
    return this.handleResponse(response, init);
  }

  // Get meeting history/events
  async getMeetingHistory(meetingId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/meetings/${meetingId}/history`, init);
    return this.handleResponse(response, init);
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
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/meetings`, init);
    return this.handleResponse(response, init);
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
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/meetings/${meetingId}`, init);
    return this.handleResponse(response, init);
  }

  // Delete meeting
  async deleteMeeting(meetingId: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/meetings/${meetingId}`, init);
    return this.handleResponse(response, init);
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

    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(url, init);
    return this.handleResponse(response, init);
  }

  // Get notification counts (for badge display)
  async getNotificationCounts() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/notifications/counts`, init);
    return this.handleResponse(response, init);
  }

  // Mark a notification as read
  async markNotificationAsRead(notificationId: string) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, init);
    return this.handleResponse(response, init);
  }

  // Mark all notifications as read
  async markAllNotificationsAsRead() {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/notifications/mark-all-read`, init);
    return this.handleResponse(response, init);
  }

  // Process scheduled notifications (manual trigger)
  async processScheduledNotifications() {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/notifications/process-scheduled`, init);
    return this.handleResponse(response, init);
  }

  // Generate rent expiry notifications (manual trigger)
  async generateRentExpiryNotifications() {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/notifications/generate-rent-expiry`, init);
    return this.handleResponse(response, init);
  }

  // Process all notifications (scheduled + rent expiry)
  async processAllNotifications() {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/notifications/process-all`, init);
    return this.handleResponse(response, init);
  }

  // Get notification settings
  async getNotificationSettings() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/notifications/settings`, init);
    return this.handleResponse(response, init);
  }

  // Update notification settings
  async updateNotificationSettings(settings: {
    rentedExpiryThresholdDays?: number;
    meetingReminderMinutes?: number;
    enableRentExpiryNotifications?: boolean;
    enableMeetingReminders?: boolean;
    enableKhataReminders?: boolean;
  }) {
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(settings),
    };
    const response = await fetch(`${API_BASE_URL}/notifications/settings`, init);
    return this.handleResponse(response, init);
  }

  // Delete old notifications (cleanup)
  async cleanupOldNotifications(daysOld?: number) {
    const url = daysOld
      ? `${API_BASE_URL}/notifications/cleanup?daysOld=${daysOld}`
      : `${API_BASE_URL}/notifications/cleanup`;

    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(url, init);
    return this.handleResponse(response, init);
  }

  // ============== Contact Endpoints ==============

  // Get all contacts with optional filters
  async getContacts(filters?: {
    role?: string;
    status?: string;
    sellerLifecycle?: string;
    ownerLifecycle?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (filters?.role) queryParams.append('role', filters.role);
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.sellerLifecycle) queryParams.append('sellerLifecycle', filters.sellerLifecycle);
    if (filters?.ownerLifecycle) queryParams.append('ownerLifecycle', filters.ownerLifecycle);

    const url = queryParams.toString()
      ? `${API_BASE_URL}/crm/contacts?${queryParams}`
      : `${API_BASE_URL}/crm/contacts`;

    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(url, init);
    return this.handleResponse(response, init);
  }

  // Get contacts by specific role (convenience method)
  async getContactsByRole(role: 'owner' | 'buyer' | 'tenant' | 'seller') {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${role}s`, init);
    return this.handleResponse(response, init);
  }

  // Get contacts by role (convenience methods)
  async getContactOwners() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/owners`, init);
    return this.handleResponse(response, init);
  }

  // getContactSellers removed - sellers are now owners with properties for sale

  async getContactBuyers() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/buyers`, init);
    return this.handleResponse(response, init);
  }

  async getContactTenants() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/tenants`, init);
    return this.handleResponse(response, init);
  }

  // Lookup contact by phone
  async lookupContactByPhone(phone: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/lookup/by-phone?phone=${encodeURIComponent(phone)}`, init);
    return this.handleResponse(response, init);
  }

  // Get single contact
  async getContact(contactId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}`, init);
    return this.handleResponse(response, init);
  }

  // Get contact with document URLs
  async getContactWithDocuments(contactId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}/with-documents`, init);
    return this.handleResponse(response, init);
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
  }) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts`, init);
    return this.handleResponse(response, init);
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
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/upsert-by-phone`, init);
    return this.handleResponse(response, init);
  }

  // Update contact
  async updateContact(contactId: string, data: Record<string, unknown>) {
    const { status: _derivedStatus, ...updateData } = this.stripDynamoFields(data);
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updateData),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}`, init);
    return this.handleResponse(response, init);
  }

  // Update contact role
  async updateContactRole(contactId: string, role: string, enabled: boolean, profileData?: Record<string, unknown>) {
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ role, enabled, profileData }),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}/role`, init);
    return this.handleResponse(response, init);
  }

  // Delete contact
  async deleteContact(contactId: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}`, init);
    return this.handleResponse(response, init);
  }

  // Upload contact documents
  async uploadContactDocuments(contactId: string, files: { photo?: File; pan?: File; aadhar?: File }) {
    const formData = new FormData();
    if (files.photo) formData.append('photo', files.photo);
    if (files.pan) formData.append('pan', files.pan);
    if (files.aadhar) formData.append('aadhar', files.aadhar);

    const init = {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}/documents`, init);
    return this.handleResponse(response, init);
  }

  // Contact notes
  async getContactNotes(contactId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}/notes`, init);
    return this.handleResponse(response, init);
  }

  async createContactNote(contactId: string, data: { content: string }) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}/notes`, init);
    return this.handleResponse(response, init);
  }

  async updateContactNote(contactId: string, noteId: string, data: { content: string }) {
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}/notes/${noteId}`, init);
    return this.handleResponse(response, init);
  }

  async deleteContactNote(contactId: string, noteId: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}/notes/${noteId}`, init);
    return this.handleResponse(response, init);
  }

  // Contact activity timeline
  async getContactActivity(contactId: string, entityType?: string, entityId?: string) {
    const params = new URLSearchParams();
    if (entityType && entityId) {
      params.append('entityType', entityType);
      params.append('entityId', entityId);
    }
    const queryString = params.toString();
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/${contactId}/activity${queryString ? `?${queryString}` : ''}`, init);
    return this.handleResponse(response, init);
  }

  async getContactActivityPreviews(contactIds: string[], limit = 3) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ contactIds, limit }),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/activity-previews`, init);
    return this.handleResponse(response, init);
  }

  // Migration endpoints
  async migrateOwnerToContact(ownerId: string) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/migrate/owner/${ownerId}`, init);
    return this.handleResponse(response, init);
  }

  async migrateCustomerToContact(customerId: string) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/migrate/customer/${customerId}`, init);
    return this.handleResponse(response, init);
  }

  async migrateAllToContacts() {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/contacts/migrate/all`, init);
    return this.handleResponse(response, init);
  }

  // ============== Lead Endpoints ==============

  // Get all leads with optional filters (paginated envelope)
  async getLeads(filters?: {
    leadType?: string;
    status?: string;
    temperature?: 'hot' | 'warm' | 'cold' | 'unscored' | 'all';
    excludeConverted?: boolean;
    converted?: boolean;
    assignedTo?: string;
    unassigned?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ leads: import('../types/crm').CRMLead[]; total: number; limit: number; offset: number }> {
    const queryParams = new URLSearchParams();
    if (filters?.leadType) queryParams.append('leadType', filters.leadType);
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.temperature && filters.temperature !== 'all') queryParams.append('temperature', filters.temperature);
    if (filters?.excludeConverted) queryParams.append('excludeConverted', 'true');
    if (filters?.converted) queryParams.append('converted', 'true');
    if (filters?.assignedTo) queryParams.append('assignedTo', filters.assignedTo);
    if (filters?.unassigned) queryParams.append('unassigned', 'true');
    if (filters?.search) queryParams.append('search', filters.search);
    if (filters?.limit != null) queryParams.append('limit', String(filters.limit));
    if (filters?.offset != null) queryParams.append('offset', String(filters.offset));
    if (filters?.sortBy) queryParams.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) queryParams.append('sortOrder', filters.sortOrder);

    const url = queryParams.toString()
      ? `${API_BASE_URL}/crm/leads?${queryParams}`
      : `${API_BASE_URL}/crm/leads`;

    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(url, init);
    const data = await this.handleResponse(response, init);
    if (Array.isArray(data)) {
      return { leads: data, total: data.length, limit: data.length, offset: 0 };
    }
    if (data && typeof data === 'object' && 'leads' in data) {
      const envelope = data as { leads?: import('../types/crm').CRMLead[]; total?: number; limit?: number; offset?: number };
      const leads = Array.isArray(envelope.leads) ? envelope.leads : [];
      return {
        leads,
        total: envelope.total ?? leads.length,
        limit: envelope.limit ?? leads.length,
        offset: envelope.offset ?? 0,
      };
    }
    return { leads: [], total: 0, limit: 50, offset: 0 };
  }

  // Get leads by type (convenience methods)
  async getBuyerLeads(excludeConverted?: boolean) {
    const url = excludeConverted
      ? `${API_BASE_URL}/crm/leads/buyers?excludeConverted=true`
      : `${API_BASE_URL}/crm/leads/buyers`;
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(url, init);
    return this.handleResponse(response, init);
  }

  // getSellerLeads removed - seller-type leads now convert to owners

  async getTenantLeads(excludeConverted?: boolean) {
    const url = excludeConverted
      ? `${API_BASE_URL}/crm/leads/tenants?excludeConverted=true`
      : `${API_BASE_URL}/crm/leads/tenants`;
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(url, init);
    return this.handleResponse(response, init);
  }

  async getOwnerLeads(excludeConverted?: boolean) {
    const url = excludeConverted
      ? `${API_BASE_URL}/crm/leads/owners?excludeConverted=true`
      : `${API_BASE_URL}/crm/leads/owners`;
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(url, init);
    return this.handleResponse(response, init);
  }

  // Get lead metrics
  async getLeadMetrics() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/leads/metrics`, init);
    return this.handleResponse(response, init);
  }

  // Get single lead
  async getLead(leadId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}`, init);
    return this.handleResponse(response, init);
  }

  // Create lead
  async createLead(data: {
    leadType: 'buyer' | 'seller' | 'tenant' | 'owner';
    name: string;
    email?: string;
    phone?: string;
    source?: string;
    status?: string;
    assignedTo?: string;
    buyerRequirement?: BuyerRequirement;
    sellerProperty?: SellerProperty;
    tenantRequirement?: TenantRequirement;
    ownerProperty?: OwnerProperty;
    notes?: string;
  }) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/leads`, init);
    return this.handleResponse(response, init);
  }

  // Update lead
  async updateLead(leadId: string, data: Record<string, unknown>) {
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(this.stripDynamoFields(data)),
    };
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}`, init);
    return this.handleResponse(response, init);
  }

  // Trigger an on-demand AI qualification call for a lead ("Call now to qualify")
  async triggerQualifyCall(leadId: string): Promise<{ callSessionId: string; status: string }> {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}/qualify-call`, init);
    return this.handleResponse(response, init);
  }

  // Convert lead to buyer/tenant/owner/seller based on lead type
  async convertLead(leadId: string, options: Record<string, unknown> = {}) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(options),
    };
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}/convert`, init);
    return this.handleResponse(response, init);
  }

  async getLeadConversionHistory(filters?: { leadType?: string; search?: string }) {
    const queryParams = new URLSearchParams();
    if (filters?.leadType) queryParams.append('leadType', filters.leadType);
    if (filters?.search) queryParams.append('search', filters.search);
    const qs = queryParams.toString();
    const init = { headers: this.getHeaders() };
    const response = await fetch(
      `${API_BASE_URL}/crm/leads/conversions/history${qs ? `?${qs}` : ''}`,
      init,
    );
    return this.handleResponse(response, init);
  }

  async getLeadConversionSnapshot(leadId: string) {
    const init = { headers: this.getHeaders() };
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}/conversion`, init);
    return this.handleResponse(response, init);
  }

  // Get matching contacts for lead conversion
  async getMatchingContactsForLead(leadId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}/matching-contacts`, init);
    return this.handleResponse(response, init);
  }

  // Delete lead
  async deleteLead(leadId: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}`, init);
    return this.handleResponse(response, init);
  }

  // Lead notes
  async getLeadNotes(leadId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}/notes`, init);
    return this.handleResponse(response, init);
  }

  async createLeadNote(leadId: string, data: { content: string }) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}/notes`, init);
    return this.handleResponse(response, init);
  }

  async updateLeadNote(leadId: string, noteId: string, data: { content: string }) {
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}/notes/${noteId}`, init);
    return this.handleResponse(response, init);
  }

  async deleteLeadNote(leadId: string, noteId: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/leads/${leadId}/notes/${noteId}`, init);
    return this.handleResponse(response, init);
  }

  // Search leads by name, phone, or email
  async searchLeads(q: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/leads/search?q=${encodeURIComponent(q)}`, init);
    return this.handleResponse(response, init);
  }

  // Get available agents for assignedTo dropdown
  async getLeadAgents(): Promise<Array<{ userId: string; username: string; label: string; role?: string }>> {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/leads/agents`, init);
    return this.handleResponse(response, init);
  }

  // ============== Buyer Endpoints ==============

  async getBuyers(filters?: { status?: string; priority?: string; propertyType?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.propertyType) params.append('propertyType', filters.propertyType);
    
    const url = `${API_BASE_URL}/crm/buyers${params.toString() ? `?${params.toString()}` : ''}`;
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(url, init);
    return this.handleResponse(response, init);
  }

  async getBuyer(buyerId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/buyers/${buyerId}`, init);
    return this.handleResponse(response, init);
  }

  async createBuyer(data: Record<string, unknown>) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/buyers`, init);
    return this.handleResponse(response, init);
  }

  async updateBuyer(buyerId: string, data: Record<string, unknown>) {
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(this.stripDynamoFields(data)),
    };
    const response = await fetch(`${API_BASE_URL}/crm/buyers/${buyerId}`, init);
    return this.handleResponse(response, init);
  }

  async getBuyerNotes(buyerId: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/buyers/${buyerId}/notes`, init);
    return this.handleResponse(response, init);
  }

  async createBuyerNote(buyerId: string, data: { content: string }) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/buyers/${buyerId}/notes`, init);
    return this.handleResponse(response, init);
  }

  async getBuyerMetrics() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/buyers/metrics/summary`, init);
    return this.handleResponse(response, init);
  }

  // ============== Seller Endpoints REMOVED ==============
  // Sellers are now managed as OWNERS with properties listed for sale
  // Use getOwners() and filter properties by status='for-sale' instead

  // Cross-role phone lookup
  async lookupPersonByPhone(phone: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/buyers/lookup/by-phone?phone=${encodeURIComponent(phone)}`, init);
    return this.handleResponse(response, init);
  }

  // ============== Search Endpoints ==============

  // Search owners by name or phone
  async searchOwners(query: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/search/owners?q=${encodeURIComponent(query)}`, init);
    return this.handleResponse(response, init);
  }

  // Search customers/tenants by name or phone
  async searchCustomers(query: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/search/customers?q=${encodeURIComponent(query)}`, init);
    return this.handleResponse(response, init);
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
    
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/search/properties?${params.toString()}`, init);
    return this.handleResponse(response, init);
  }

  // ============== Real Estate Management - Projects ==============

  async getProjects(filters?: { status?: string; developerId?: string; areaId?: string; lifecycleStatus?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.developerId) params.append('developerId', filters.developerId);
    if (filters?.areaId) params.append('areaId', filters.areaId);
    if (filters?.lifecycleStatus) params.append('lifecycleStatus', filters.lifecycleStatus);
    
    const url = `${API_BASE_URL}/crm/projects${params.toString() ? `?${params.toString()}` : ''}`;
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(url, init);
    return this.handleResponse(response, init);
  }

  async createProject(data: Record<string, unknown>) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/projects`, init);
    return this.handleResponse(response, init);
  }

  async updateProject(projectId: string, data: Record<string, unknown>) {
    const init = {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(this.stripDynamoFields(data)),
    };
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}`, init);
    return this.handleResponse(response, init);
  }

  async deleteProject(projectId: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}`, init);
    return this.handleResponse(response, init);
  }

  async updateProjectStatus(projectId: string, status: string, metadata?: Record<string, unknown>) {
    const init = {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ status, ...metadata }),
    };
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/status`, init);
    return this.handleResponse(response, init);
  }

  async updateProjectInventory(projectId: string, inventoryData: Record<string, unknown>) {
    const init = {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(inventoryData),
    };
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/inventory`, init);
    return this.handleResponse(response, init);
  }

  async markProjectUnitSold(projectId: string, unitType?: string, quantity?: number) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ unitType, quantity }),
    };
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/units/sold`, init);
    return this.handleResponse(response, init);
  }

  async incrementProjectViews(projectId: string) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/views`, init);
    return this.handleResponse(response, init);
  }

  async incrementProjectEnquiries(projectId: string) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/enquiries`, init);
    return this.handleResponse(response, init);
  }

  async searchProjects(query: string) {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/projects/search?q=${encodeURIComponent(query)}`, init);
    return this.handleResponse(response, init);
  }

  async getProjectMetrics() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/projects/metrics`, init);
    return this.handleResponse(response, init);
  }

  async deleteDeveloperVideo(developerId: string, s3Key: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ s3Key }),
    };
    const response = await fetch(`${API_BASE_URL}/crm/developers/${developerId}/videos`, init);
    return this.handleResponse(response, init);
  }

  // ============== Area Media Upload ==============

  async uploadAreaImages(areaId: string, files: File[]) {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    
    const headers = this.getHeaders(true);
    
    const init = {
      method: 'POST',
      headers,
      body: formData,
    };
    const response = await fetch(`${API_BASE_URL}/crm/real-estate-areas/${areaId}/images`, init);
    return this.handleResponse(response, init);
  }

  async deleteAreaVideo(areaId: string, s3Key: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ s3Key }),
    };
    const response = await fetch(`${API_BASE_URL}/crm/real-estate-areas/${areaId}/videos`, init);
    return this.handleResponse(response, init);
  }

  // ============== Project Media & Document Upload ==============

  async uploadProjectImages(projectId: string, files: File[]) {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    
    const headers = this.getHeaders(true);
    
    const init = {
      method: 'POST',
      headers,
      body: formData,
    };
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/images`, init);
    return this.handleResponse(response, init);
  }

  async deleteProjectVideo(projectId: string, s3Key: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ s3Key }),
    };
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/videos`, init);
    return this.handleResponse(response, init);
  }

  async deleteProjectFloorPlan(projectId: string, s3Key: string) {
    const init = {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ s3Key }),
    };
    const response = await fetch(`${API_BASE_URL}/crm/projects/${projectId}/floor-plans`, init);
    return this.handleResponse(response, init);
  }

  // ============== AI Employee ==============

  async getAgentActivity(params?: { limit?: number; agentId?: string }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.agentId) query.set('agentId', params.agentId);
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/agents/activity?${query}`, init);
    return this.handleResponse(response, init);
  }

  async getAiEmployeeConfig() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/crm/config/ai-employee`, init);
    return this.handleResponse(response, init);
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
    const init = {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(config),
    };
    const response = await fetch(`${API_BASE_URL}/crm/config/ai-employee`, init);
    return this.handleResponse(response, init);
  }

  async getAiEmployeeProvisioningStatus() {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/ai-employee/status`, init);
    return this.handleResponse(response, init);
  }

  async sendTestAiMessage() {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/ai-employee/test-message`, init);
    return this.handleResponse(response, init);
  }

  // ============== WhatsApp Inbox ==============

  async getWhatsAppConversations(): Promise<ConversationSummary[]> {
    const init = {
      headers: this.getHeaders(),
    };
    const response = await fetch(`${API_BASE_URL}/api/whatsapp/conversations`, init);
    return this.handleResponse(response, init);
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

  // ============== Call Intelligence (call recordings) ==============

  /** Step 1 of the upload: reserve a recording and get a pre-signed S3 URL. */
  async createCallRecordingUploadUrl(data: {
    filename: string;
    contentType: string;
    sizeBytes?: number;
    phone?: string;
    callDate?: string;
  }): Promise<UploadUrlResponse> {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/call-recordings/upload-url`, init);
    return this.handleResponse(response, init);
  }

  /**
   * Step 2: PUT the file straight to S3.
   * Deliberately bypasses `getHeaders()` — sending an Authorization header to a
   * pre-signed URL makes S3 reject the request.
   *
   * `contentType` must be the exact value the URL was signed with, otherwise S3
   * answers 403 SignatureDoesNotMatch.
   */
  async uploadCallRecordingToS3(
    uploadUrl: string,
    file: File,
    onProgress?: (percent: number) => void,
    contentType?: string,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', contentType || file.type);

      xhr.upload.onprogress = (event) => {
        if (onProgress && event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed with status ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
      xhr.onabort = () => reject(new Error('Upload cancelled'));
      xhr.send(file);
    });
  }

  /** Step 3: confirm the upload so the transcription pipeline starts. */
  async confirmCallRecordingUpload(recordingId: string, data: { callDate?: string } = {}) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/call-recordings/${recordingId}/confirm`, init);
    return this.handleResponse(response, init);
  }

  async getCallRecordings(params: { limit?: number; cursor?: string; status?: string } = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.status) query.set('status', params.status);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    const init = { headers: this.getHeaders() };
    const response = await fetch(`${API_BASE_URL}/crm/call-recordings${suffix}`, init);
    return this.handleResponse(response, init);
  }

  async getCallRecording(recordingId: string) {
    const init = { headers: this.getHeaders() };
    const response = await fetch(`${API_BASE_URL}/crm/call-recordings/${recordingId}`, init);
    return this.handleResponse(response, init);
  }

  async getCallRecordingTranscript(recordingId: string) {
    const init = { headers: this.getHeaders() };
    const response = await fetch(`${API_BASE_URL}/crm/call-recordings/${recordingId}/transcript`, init);
    return this.handleResponse(response, init);
  }

  async getCallRecordingAudioUrl(recordingId: string) {
    const init = { headers: this.getHeaders() };
    const response = await fetch(`${API_BASE_URL}/crm/call-recordings/${recordingId}/audio-url`, init);
    return this.handleResponse(response, init);
  }

  async linkCallRecordingEntity(
    recordingId: string,
    data: { entityType: string; entityId: string; reanalyze?: boolean },
  ) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    };
    const response = await fetch(`${API_BASE_URL}/crm/call-recordings/${recordingId}/link`, init);
    return this.handleResponse(response, init);
  }

  async reanalyzeCallRecording(recordingId: string) {
    const init = { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({}) };
    const response = await fetch(`${API_BASE_URL}/crm/call-recordings/${recordingId}/reanalyze`, init);
    return this.handleResponse(response, init);
  }

  async approveCallRecordingAction(
    recordingId: string,
    actionId: string,
    args?: Record<string, unknown>,
  ) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(args ? { arguments: args } : {}),
    };
    const response = await fetch(
      `${API_BASE_URL}/crm/call-recordings/${recordingId}/actions/${actionId}/approve`,
      init,
    );
    return this.handleResponse(response, init);
  }

  async rejectCallRecordingAction(recordingId: string, actionId: string, reason?: string) {
    const init = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(reason ? { reason } : {}),
    };
    const response = await fetch(
      `${API_BASE_URL}/crm/call-recordings/${recordingId}/actions/${actionId}/reject`,
      init,
    );
    return this.handleResponse(response, init);
  }

  async deleteCallRecording(recordingId: string) {
    const init = { method: 'DELETE', headers: this.getHeaders() };
    const response = await fetch(`${API_BASE_URL}/crm/call-recordings/${recordingId}`, init);
    return this.handleResponse(response, init);
  }
}

export const api = new ApiService();


