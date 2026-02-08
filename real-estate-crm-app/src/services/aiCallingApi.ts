// AI Calling Service API Client

import { getTenantHeaders } from '../config/tenant';
import type {
  CallSession,
  TranscriptEntry,
  StartCallRequest,
  StartCallResponse,
  CallStatusResponse,
  CallMetrics,
  KnowledgeDocument,
  UploadUrlResponse,
  AgentConfig,
  SaveAgentConfigRequest,
  KnowledgeCategory,
} from '../types/aiCalling';

// AI Calling Service URL - configured via environment variable
const AI_CALLING_API_URL = import.meta.env.VITE_AI_CALLING_API_URL;

// Feature flag for AI Calling
export const isAICallingEnabled = (): boolean => {
  return import.meta.env.VITE_AI_CALLING_ENABLED === 'true' && !!AI_CALLING_API_URL;
};

class AICallingApiService {
  private getHeaders(): Record<string, string> {
    const token = localStorage.getItem('admin_token');
    return {
      'Content-Type': 'application/json',
      ...getTenantHeaders(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'An error occurred' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  // ============== Call Management ==============

  async startCall(request: StartCallRequest): Promise<StartCallResponse> {
    const response = await fetch(`${AI_CALLING_API_URL}/api/ai-calling/calls/start`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });
    return this.handleResponse(response);
  }

  async getCallStatus(callSessionId: string): Promise<CallStatusResponse> {
    const response = await fetch(`${AI_CALLING_API_URL}/api/ai-calling/calls/${callSessionId}/status`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getCallTranscript(callSessionId: string): Promise<{ transcript: TranscriptEntry[] }> {
    const response = await fetch(`${AI_CALLING_API_URL}/api/ai-calling/calls/${callSessionId}/transcript`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async endCall(callSessionId: string, reason?: string): Promise<{ success: boolean }> {
    const response = await fetch(`${AI_CALLING_API_URL}/api/ai-calling/calls/${callSessionId}/end`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason }),
    });
    return this.handleResponse(response);
  }

  async getCalls(status?: string, limit?: number): Promise<CallSession[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit.toString());
    
    const response = await fetch(`${AI_CALLING_API_URL}/api/ai-calling/calls?${params}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getCallDetails(callSessionId: string): Promise<CallSession> {
    const response = await fetch(`${AI_CALLING_API_URL}/api/ai-calling/calls/${callSessionId}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getCallMetrics(startDate?: string, endDate?: string): Promise<CallMetrics> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await fetch(`${AI_CALLING_API_URL}/api/ai-calling/calls/metrics/summary?${params}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Knowledge Management ==============

  async getUploadUrl(fileName: string, fileType: string, category: KnowledgeCategory): Promise<UploadUrlResponse> {
    const response = await fetch(`${AI_CALLING_API_URL}/api/ai-calling/knowledge/upload-url`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ fileName, fileType, category }),
    });
    return this.handleResponse(response);
  }

  async uploadDocument(file: File, category: KnowledgeCategory): Promise<KnowledgeDocument> {
    // 1. Get presigned URL
    const { documentId, uploadUrl } = await this.getUploadUrl(file.name, file.type, category);
    
    // 2. Upload to S3
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });
    
    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file to S3');
    }
    
    // 3. Confirm upload
    await this.confirmUpload(documentId, file.size);
    
    // 4. Return document info
    return this.getDocument(documentId);
  }

  async confirmUpload(documentId: string, fileSize: number): Promise<{ success: boolean; status: string }> {
    const response = await fetch(`${AI_CALLING_API_URL}/api/ai-calling/knowledge/${documentId}/confirm`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ fileSize }),
    });
    return this.handleResponse(response);
  }

  async getDocuments(category?: KnowledgeCategory): Promise<KnowledgeDocument[]> {
    const params = category ? `?category=${category}` : '';
    const response = await fetch(`${AI_CALLING_API_URL}/api/ai-calling/knowledge${params}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getDocument(documentId: string): Promise<KnowledgeDocument> {
    const response = await fetch(`${AI_CALLING_API_URL}/api/ai-calling/knowledge/${documentId}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async deleteDocument(documentId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${AI_CALLING_API_URL}/api/ai-calling/knowledge/${documentId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // ============== Configuration ==============

  async getAgentConfig(): Promise<AgentConfig> {
    const response = await fetch(`${AI_CALLING_API_URL}/api/ai-calling/config/agent`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async saveAgentConfig(config: SaveAgentConfigRequest): Promise<AgentConfig> {
    const response = await fetch(`${AI_CALLING_API_URL}/api/ai-calling/config/agent`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(config),
    });
    return this.handleResponse(response);
  }
}

export const aiCallingApi = new AICallingApiService();
export default aiCallingApi;
