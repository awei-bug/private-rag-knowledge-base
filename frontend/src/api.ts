export type HealthResponse = {
  status: string;
  detail?: string;
};

export type UserProfile = {
  username: string;
  role: string;
  allowed_acl: string[];
  display_name?: string | null;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserProfile;
};

export type ConfigResponse = {
  app_name: string;
  app_version: string;
  environment: string;
  top_k: number;
  chunk_size: number;
  chunk_overlap: number;
  database_backend: string;
  pgvector_enabled: string;
  runtime_mode: string;
  embedding_provider: string;
  llm_provider: string;
  preferences: {
    default_folder_path: string;
    default_retrieval_mode: RetrievalMode;
    top_k: number;
    preferred_runtime_mode: "local" | "api";
    query_rewrite_enabled: boolean;
    lexical_weight: number;
    semantic_weight: number;
  };
};

export type DocumentChunk = {
  chunk_id: string;
  content: string;
  acl: string[];
  metadata: Record<string, string>;
};

export type DocumentItem = {
  document_id: string;
  title: string;
  source: string;
  acl: string[];
  metadata: Record<string, string>;
  file_path?: string | null;
  chunks: DocumentChunk[];
};

export type DocumentUpdatePayload = {
  title?: string;
  source?: string;
  metadata?: Record<string, string>;
};

export type DocumentBatchDeleteResponse = {
  deleted_count: number;
  missing_document_ids: string[];
};

export type DocumentBatchUpdateResponse = {
  updated_count: number;
  missing_document_ids: string[];
};

export type DocumentMoveResponse = {
  moved_count: number;
  missing_document_ids: string[];
};

export type SyncResponse = {
  root_path: string;
  scanned_files: number;
  imported_documents: number;
  skipped_files: number;
  document_ids: string[];
  skipped_reasons: string[];
};

export type RetrievalMode = "precise" | "semantic" | "hybrid";

export type QueryResponse = {
  answer: string;
  confidence: number;
  rewritten_query: string;
  citations: Array<{
    document_id: string;
    document_title: string;
    chunk_id: string;
    score: number;
    content_preview: string;
  }>;
};

export type QueryRequestPayload = {
  question: string;
  filters: Record<string, string>;
  retrieval_mode: RetrievalMode;
  query_rewrite_enabled?: boolean;
  top_k?: number;
};

export type RetrievalDebugResponse = {
  rewritten_query: string;
  chunks: Array<{
    document_id: string;
    document_title: string;
    chunk_id: string;
    score: number;
    lexical_score: number;
    semantic_score: number;
    metadata: Record<string, string>;
    content_preview: string;
  }>;
};

export type RetrievalEvaluationCase = {
  question: string;
  expected_document_id: string;
  retrieval_mode: RetrievalMode;
  filters: Record<string, string>;
};

export type RetrievalEvaluationResponse = {
  cases: Array<{
    question: string;
    expected_document_id: string;
    matched: boolean;
    top_document_id: string | null;
    rewritten_query: string;
  }>;
};

export type QueryLog = {
  log_id?: string;
  user_id: string;
  role?: string | null;
  question: string;
  rewritten_query: string;
  answer: string;
  confidence: number;
  filters: Record<string, string>;
  citations: Array<{
    document_id: string;
    document_title: string;
    chunk_id: string;
    score: number;
    content_preview: string;
  }>;
  latency_ms: number;
  created_at?: string;
};

export type AnalyticsOverview = {
  document_count: number;
  chunk_count: number;
  query_count: number;
  average_latency_ms: number;
};

export type DocumentGraphResponse = {
  nodes: Array<{
    id: string;
    title: string;
    category: string;
    source: string;
    size: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
    reason: string;
    weight: number;
  }>;
};

export type QueryInsightsResponse = {
  query_frequency: Array<{ label: string; count: number }>;
  hot_topics: Array<{ label: string; count: number }>;
  hot_documents: Array<{ label: string; count: number }>;
  retrieval_modes: Array<{ label: string; count: number }>;
};

export type SystemMetricsResponse = {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
};

export type MaintenanceActionResponse = {
  action: string;
  success: boolean;
  document_count: number;
  chunk_count: number;
  message: string;
};

export type BackupValidationResponse = {
  filename: string;
  valid: boolean;
  document_count: number;
  query_log_count: number;
  message: string;
};

export type BackupManifestResponse = {
  items: Array<{
    filename: string;
    path: string;
    created_at: string;
    size_bytes: number;
    document_count: number;
    query_log_count: number;
    valid: boolean;
  }>;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const AUTH_TOKEN_STORAGE_KEY = "rag-auth-token";

let authToken = typeof window === "undefined" ? "" : window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? "";

export function getAuthToken() {
  return authToken;
}

export function setAuthToken(token: string) {
  authToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  }
}

export function getDocumentDownloadUrl(documentId: string) {
  return `${API_BASE}/api/v1/documents/${documentId}/file`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  login: (payload: { username: string; password: string }) =>
    request<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: () => request<UserProfile>("/api/v1/auth/me"),
  refreshToken: () =>
    request<LoginResponse>("/api/v1/auth/refresh", {
      method: "POST",
    }),
  getHealth: () => request<HealthResponse>("/health"),
  getDbHealth: () => request<HealthResponse>("/health/db"),
  getConfig: () => request<ConfigResponse>("/config"),
  listDocuments: () => request<DocumentItem[]>("/api/v1/documents"),
  listLogs: (limit = 6) => request<QueryLog[]>(`/api/v1/query/logs?limit=${limit}`),
  deleteDocument: (documentId: string) =>
    request<void>(`/api/v1/documents/${documentId}`, { method: "DELETE" }),
  updateDocument: (documentId: string, payload: DocumentUpdatePayload) =>
    request<DocumentItem>(`/api/v1/documents/${documentId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  batchDeleteDocuments: (documentIds: string[]) =>
    request<DocumentBatchDeleteResponse>("/api/v1/documents/batch-delete", {
      method: "POST",
      body: JSON.stringify({ document_ids: documentIds }),
    }),
  batchUpdateDocuments: (payload: {
    document_ids: string[];
    metadata_updates: Record<string, string>;
    source?: string;
  }) =>
    request<DocumentBatchUpdateResponse>("/api/v1/documents/batch-update", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  moveDocuments: (payload: { document_ids: string[]; folder_path: string }) =>
    request<DocumentMoveResponse>("/api/v1/documents/move", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  renameDocumentFile: (payload: { document_id: string; filename: string }) =>
    request<DocumentItem>("/api/v1/documents/rename-file", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  uploadDocument: (payload: { file: File; source?: string; title?: string }) => {
    const formData = new FormData();
    formData.append("file", payload.file);
    formData.append("source", payload.source ?? "web-upload");
    formData.append("acl", "");
    formData.append("metadata_json", "{}");
    if (payload.title) {
      formData.append("title", payload.title);
    }
    return request<DocumentItem>("/api/v1/documents/upload", {
      method: "POST",
      body: formData,
    });
  },
  syncLocalDir: (payload: { root_path: string }) =>
    request<SyncResponse>("/api/v1/documents/sync/local-dir", {
      method: "POST",
      body: JSON.stringify({
        root_path: payload.root_path,
        recursive: true,
        extensions: [".md", ".txt", ".json", ".pdf", ".docx", ".xlsx", ".xlsm"],
        default_acl: [],
        default_metadata: {},
        source_label: "local-folder",
        max_files: 500,
      }),
    }),
  ask: (payload: QueryRequestPayload) =>
    request<QueryResponse>("/api/v1/query", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  debugRetrieval: (payload: QueryRequestPayload, limit = 20) =>
    request<RetrievalDebugResponse>(`/api/v1/query/debug?limit=${limit}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  evaluateRetrieval: (cases: RetrievalEvaluationCase[]) =>
    request<RetrievalEvaluationResponse>("/api/v1/query/evaluate", {
      method: "POST",
      body: JSON.stringify({ cases }),
    }),
  exportQueryLogs: async (params: {
    limit?: number;
    user_id?: string;
    role?: string;
    question?: string;
  }) => {
    const search = new URLSearchParams();
    if (params.limit) {
      search.set("limit", String(params.limit));
    }
    if (params.user_id) {
      search.set("user_id", params.user_id);
    }
    if (params.role) {
      search.set("role", params.role);
    }
    if (params.question) {
      search.set("question", params.question);
    }
    const headers = new Headers();
    if (authToken) {
      headers.set("Authorization", `Bearer ${authToken}`);
    }
    const response = await fetch(`${API_BASE}/api/v1/query/logs/export?${search.toString()}`, { headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
    return response.blob();
  },
  updatePreferences: (payload: ConfigResponse["preferences"]) =>
    request<ConfigResponse>("/config/preferences", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  getAnalyticsOverview: () => request<AnalyticsOverview>("/analytics/overview"),
  getDocumentGraph: () => request<DocumentGraphResponse>("/analytics/document-graph"),
  getQueryInsights: () => request<QueryInsightsResponse>("/analytics/query-insights"),
  getSystemMetrics: () => request<SystemMetricsResponse>("/analytics/system-metrics"),
  rebuildIndexes: () =>
    request<MaintenanceActionResponse>("/maintenance/rebuild-indexes", {
      method: "POST",
    }),
  exportBackup: async () => {
    const headers = new Headers();
    if (authToken) {
      headers.set("Authorization", `Bearer ${authToken}`);
    }
    const response = await fetch(`${API_BASE}/maintenance/backup/export`, { headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
    return response.blob();
  },
  createBackupVersion: () =>
    request<BackupValidationResponse>("/maintenance/backup/create", {
      method: "POST",
    }),
  listBackupVersions: () => request<BackupManifestResponse>("/maintenance/backup/list"),
  verifyBackupVersion: (filename: string) =>
    request<BackupValidationResponse>(`/maintenance/backup/verify/${encodeURIComponent(filename)}`, {
      method: "POST",
    }),
  restoreBackup: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<MaintenanceActionResponse>("/maintenance/backup/restore", {
      method: "POST",
      body: formData,
    });
  },
  cleanupDuplicates: () =>
    request<MaintenanceActionResponse>("/maintenance/cleanup-duplicates", {
      method: "POST",
    }),
  cleanupOrphans: () =>
    request<MaintenanceActionResponse>("/maintenance/cleanup-orphans", {
      method: "POST",
      body: JSON.stringify({}),
    }),
};
