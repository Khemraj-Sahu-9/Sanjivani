/**
 * frontend/src/services/documentService.ts
 *
 * Frontend service layer for document uploads, search, extraction review, and file preview.
 */

import { apiClient, ApiResponse } from '../lib/apiClient';
import {
  HealthDocument,
  DocumentCategory,
  DocumentDetailsResponse,
  DocumentExtraction,
  StructuredMedicalFields,
} from '../types/document';

export interface UploadDocumentParams {
  familyId: string;
  patientProfileId: string;
  category: DocumentCategory;
  title: string;
  documentDate?: string;
  file: File;
  bypassDuplicate?: boolean;
}

export interface DocumentFilterParams {
  patientProfileId?: string;
  category?: DocumentCategory;
  processingStatus?: string;
  reviewStatus?: string;
  query?: string;
  startDate?: string;
  endDate?: string;
}

export const documentApiService = {
  async listDocuments(
    familyId: string,
    filters?: DocumentFilterParams
  ): Promise<ApiResponse<HealthDocument[]>> {
    const params = new URLSearchParams();
    if (filters?.patientProfileId) params.append('patientProfileId', filters.patientProfileId);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.processingStatus) params.append('processingStatus', filters.processingStatus);
    if (filters?.reviewStatus) params.append('reviewStatus', filters.reviewStatus);
    if (filters?.query) params.append('query', filters.query);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<HealthDocument[]>(`/api/families/${familyId}/documents${qs}`);
  },

  async uploadDocument(
    params: UploadDocumentParams
  ): Promise<ApiResponse<HealthDocument & { isDuplicateWarning?: boolean; existingDocument?: HealthDocument }>> {
    const formData = new FormData();
    formData.append('patientProfileId', params.patientProfileId);
    formData.append('category', params.category);
    formData.append('title', params.title);
    if (params.documentDate) formData.append('documentDate', params.documentDate);
    if (params.bypassDuplicate) formData.append('bypassDuplicate', 'true');
    formData.append('file', params.file);

    return apiClient.upload<HealthDocument>(
      `/api/families/${params.familyId}/documents/upload`,
      formData
    );
  },

  async getDocumentDetails(documentId: string): Promise<ApiResponse<DocumentDetailsResponse>> {
    return apiClient.get<DocumentDetailsResponse>(`/api/families/documents/details/${documentId}`);
  },

  async getSignedUrl(documentId: string): Promise<ApiResponse<{ url: string }>> {
    return apiClient.get<{ url: string }>(`/api/families/documents/signed-url/${documentId}`);
  },

  getDocumentFileUrl(documentId: string): string {
    const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');
    return `${baseUrl}/api/families/documents/file/${documentId}`;
  },

  async updateMetadata(
    documentId: string,
    updates: { title?: string; category?: DocumentCategory; documentDate?: string | null }
  ): Promise<ApiResponse<HealthDocument>> {
    return apiClient.patch<HealthDocument>(`/api/families/documents/details/${documentId}`, updates);
  },

  async retryExtraction(documentId: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<{ message: string }>(`/api/families/documents/retry/${documentId}`);
  },

  async saveReview(
    documentId: string,
    confirmedFields: StructuredMedicalFields,
    markConfirmed = false
  ): Promise<ApiResponse<{ extraction: DocumentExtraction; document: HealthDocument }>> {
    return apiClient.post<{ extraction: DocumentExtraction; document: HealthDocument }>(
      `/api/families/documents/review/${documentId}`,
      {
        confirmedFields,
        markConfirmed,
      }
    );
  },

  async deleteDocument(documentId: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<{ message: string }>(`/api/families/documents/details/${documentId}`);
  },
};
