/**
 * frontend/src/lib/apiClient.ts
 *
 * Typed HTTP client communicating with Express backend.
 * Automatically handles Authorization bearer token injection.
 * Supports JSON requests and multipart/form-data uploads.
 */

const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

let authToken: string | null = null;

export function setApiAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    try {
      sessionStorage.setItem('sanjivani_auth_token', token);
    } catch {
      // Ignore in non-browser test environments
    }
  } else {
    try {
      sessionStorage.removeItem('sanjivani_auth_token');
    } catch {
      // Ignore
    }
  }
}

export function getStoredAuthToken(): string | null {
  if (authToken) return authToken;
  try {
    return sessionStorage.getItem('sanjivani_auth_token');
  } catch {
    return null;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isFormData = false
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`;
  const token = getStoredAuthToken();

  const headers: Record<string, string> = {};

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
    });

    const responseBody = (await response.json()) as { message?: string; data?: T } | null;

    if (!response.ok) {
      const errorMessage =
        responseBody && typeof responseBody === 'object' && responseBody.message
          ? String(responseBody.message)
          : `Request failed with status ${response.status}`;

      return { data: null, error: errorMessage, status: response.status };
    }

    // Unpack standard backend response structure: { status: 'success', data: ... }
    const unwrappedData =
      responseBody && typeof responseBody === 'object' && 'data' in responseBody
        ? (responseBody.data as T)
        : (responseBody as unknown as T);

    return { data: unwrappedData, error: null, status: response.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { data: null, error: message, status: 0 };
  }
}

export const apiClient = {
  get<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>('GET', path);
  },
  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>('POST', path, body);
  },
  upload<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
    return request<T>('POST', path, formData, true);
  },
  put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>('PUT', path, body);
  },
  patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>('PATCH', path, body);
  },
  delete<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>('DELETE', path);
  },
};
