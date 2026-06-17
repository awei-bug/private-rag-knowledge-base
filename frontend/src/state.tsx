import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  api,
  getAuthToken,
  setAuthToken,
  type AnalyticsOverview,
  type BackupManifestResponse,
  type ConfigResponse,
  type DocumentGraphResponse,
  type DocumentItem,
  type QueryInsightsResponse,
  type QueryLog,
  type RetrievalDebugResponse,
  type RetrievalEvaluationCase,
  type RetrievalEvaluationResponse,
  type RetrievalMode,
  type SyncResponse,
  type SystemMetricsResponse,
  type UserProfile,
} from "./api";

export type Notice = {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
};

export type CategoryStat = {
  label: string;
  count: number;
};

export type ActivityItem = {
  id: string;
  kind: "upload" | "sync" | "delete" | "query" | "maintenance";
  text: string;
  createdAt: string;
};

export type CitationItem = {
  document_id: string;
  document_title: string;
  chunk_id: string;
  score: number;
  content_preview: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: CitationItem[];
  confidence?: number;
  latencyMs?: number;
  createdAt: string;
  rewrittenQuery?: string;
  filters?: Record<string, string>;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  retrievalMode: RetrievalMode;
  topK: number;
  queryRewriteEnabled: boolean;
  filters: Record<string, string>;
};

export type AppView = "overview" | "documents" | "qa" | "maintenance" | "settings";

type DocumentUpdatePayload = {
  title?: string;
  source?: string;
  metadata?: Record<string, string>;
};

type AskQuestionOptions = {
  filters: Record<string, string>;
  topK: number;
  queryRewriteEnabled: boolean;
};

type AppContextValue = {
  busy: string;
  error: string;
  appStatus: string;
  dbStatus: string;
  appVersion: string;
  modeLabel: string;
  retrievalMode: RetrievalMode;
  documents: DocumentItem[];
  documentSearch: string;
  selectedCategory: string;
  filteredDocuments: DocumentItem[];
  currentView: AppView;
  documentCount: number;
  chunkCount: number;
  averageChunks: number;
  dominantCategory: string;
  dominantCategoryCount: number;
  categoryStats: CategoryStat[];
  recentActivities: ActivityItem[];
  chatMessages: ChatMessage[];
  chatSessions: ChatSession[];
  activeSessionId: string;
  syncResult: SyncResponse | null;
  notices: Notice[];
  defaultFolderPath: string;
  topK: number;
  queryRewriteEnabled: boolean;
  lexicalWeight: number;
  semanticWeight: number;
  embeddingProvider: string;
  llmProvider: string;
  preferredRuntimeMode: "local" | "api";
  isSettingsOpen: boolean;
  lastLatencyMs: number | null;
  analyticsOverview: AnalyticsOverview | null;
  documentGraph: DocumentGraphResponse | null;
  queryInsights: QueryInsightsResponse | null;
  systemMetrics: SystemMetricsResponse | null;
  retrievalDebug: RetrievalDebugResponse | null;
  retrievalEvaluation: RetrievalEvaluationResponse | null;
  backupVersions: BackupManifestResponse | null;
  currentUser: UserProfile | null;
  authToken: string;
  canAccessPrivateData: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshAnalytics: () => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  syncDirectory: (rootPath: string) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  updateDocument: (documentId: string, payload: DocumentUpdatePayload) => Promise<void>;
  batchDeleteDocuments: (documentIds: string[]) => Promise<void>;
  batchUpdateDocuments: (documentIds: string[], metadataUpdates: Record<string, string>) => Promise<void>;
  moveDocuments: (documentIds: string[], folderPath: string) => Promise<void>;
  renameDocumentFile: (documentId: string, filename: string) => Promise<void>;
  askQuestion: (question: string, options: AskQuestionOptions) => Promise<void>;
  debugRetrieval: (question: string, options: AskQuestionOptions, limit?: number) => Promise<void>;
  evaluateRetrieval: (cases: RetrievalEvaluationCase[]) => Promise<void>;
  exportQueryLogs: (params: { question?: string; role?: string; user_id?: string; limit?: number }) => Promise<void>;
  rebuildIndexes: () => Promise<void>;
  exportBackup: () => Promise<void>;
  createBackupVersion: () => Promise<void>;
  listBackupVersions: () => Promise<void>;
  verifyBackupVersion: (filename: string) => Promise<void>;
  restoreBackup: (file: File) => Promise<void>;
  cleanupDuplicates: () => Promise<void>;
  cleanupOrphans: () => Promise<void>;
  setRetrievalMode: (mode: RetrievalMode) => void;
  setDefaultFolderPath: (path: string) => void;
  setTopK: (value: number) => void;
  setQueryRewriteEnabled: (value: boolean) => void;
  setLexicalWeight: (value: number) => void;
  setSemanticWeight: (value: number) => void;
  setPreferredRuntimeMode: (value: "local" | "api") => void;
  setCurrentView: (value: AppView) => void;
  setDocumentSearch: (value: string) => void;
  setSelectedCategory: (value: string) => void;
  savePreferences: () => Promise<void>;
  openSettings: () => void;
  closeSettings: () => void;
  createChatSession: () => void;
  setActiveSession: (sessionId: string) => void;
  clearActiveSession: () => void;
};

const DEFAULT_PREFERENCES: ConfigResponse["preferences"] = {
  default_folder_path: "F:/Python_code/RAG 本地知识库问系统/examples/knowledge-base",
  default_retrieval_mode: "hybrid",
  top_k: 5,
  preferred_runtime_mode: "local",
  query_rewrite_enabled: true,
  lexical_weight: 0.45,
  semantic_weight: 0.55,
};

const ALL_CATEGORY = "全部";
const UNKNOWN_CATEGORY = "未分类";
const CHAT_SESSIONS_STORAGE_KEY = "rag-chat-sessions";
const ACTIVE_CHAT_SESSION_STORAGE_KEY = "rag-active-chat-session";

const AppContext = createContext<AppContextValue | null>(null);

function toIsoNow() {
  return new Date().toISOString();
}

function normalizeCategoryLabel(value: string | undefined) {
  const label = value?.trim() || UNKNOWN_CATEGORY;
  return label.includes("?") ? UNKNOWN_CATEGORY : label;
}

function buildCategoryStats(documents: DocumentItem[]): CategoryStat[] {
  const counts = new Map<string, number>();
  for (const document of documents) {
    const label = normalizeCategoryLabel(document.metadata.category?.trim() || document.source?.trim());
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function mapLogsToActivities(logs: QueryLog[]): ActivityItem[] {
  return logs.map((log) => ({
    id: log.log_id ?? `${log.user_id}-${log.created_at ?? log.question}`,
    kind: "query",
    text: `查询了“${log.question}”`,
    createdAt: log.created_at ?? toIsoNow(),
  }));
}

function normalizePreferences(configResponse: ConfigResponse): ConfigResponse["preferences"] {
  const incoming = configResponse.preferences ?? DEFAULT_PREFERENCES;
  return {
    default_folder_path: incoming.default_folder_path || DEFAULT_PREFERENCES.default_folder_path,
    default_retrieval_mode: incoming.default_retrieval_mode || DEFAULT_PREFERENCES.default_retrieval_mode,
    top_k: typeof incoming.top_k === "number" ? incoming.top_k : DEFAULT_PREFERENCES.top_k,
    preferred_runtime_mode: incoming.preferred_runtime_mode || DEFAULT_PREFERENCES.preferred_runtime_mode,
    query_rewrite_enabled:
      typeof incoming.query_rewrite_enabled === "boolean"
        ? incoming.query_rewrite_enabled
        : DEFAULT_PREFERENCES.query_rewrite_enabled,
    lexical_weight:
      typeof incoming.lexical_weight === "number" ? incoming.lexical_weight : DEFAULT_PREFERENCES.lexical_weight,
    semantic_weight:
      typeof incoming.semantic_weight === "number" ? incoming.semantic_weight : DEFAULT_PREFERENCES.semantic_weight,
  };
}

function createSession(
  retrievalMode: RetrievalMode,
  topK: number,
  queryRewriteEnabled: boolean,
  filters: Record<string, string> = {},
): ChatSession {
  const now = toIsoNow();
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "新对话",
    createdAt: now,
    updatedAt: now,
    messages: [],
    retrievalMode,
    topK,
    queryRewriteEnabled,
    filters,
  };
}

function safeReadChatSessions() {
  if (typeof window === "undefined") {
    return { sessions: [] as ChatSession[], activeSessionId: "" };
  }
  try {
    const raw = window.localStorage.getItem(CHAT_SESSIONS_STORAGE_KEY);
    const activeSessionId = window.localStorage.getItem(ACTIVE_CHAT_SESSION_STORAGE_KEY) ?? "";
    if (!raw) {
      return { sessions: [] as ChatSession[], activeSessionId };
    }
    const sessions = JSON.parse(raw) as ChatSession[];
    return { sessions, activeSessionId };
  } catch {
    return { sessions: [] as ChatSession[], activeSessionId: "" };
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [appStatus, setAppStatus] = useState("--");
  const [dbStatus, setDbStatus] = useState("--");
  const [appVersion, setAppVersion] = useState("--");
  const [modeLabel, setModeLabel] = useState("加载中");
  const [retrievalMode, setRetrievalMode] = useState<RetrievalMode>(DEFAULT_PREFERENCES.default_retrieval_mode);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentSearch, setDocumentSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [currentView, setCurrentView] = useState<AppView>("overview");
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [defaultFolderPath, setDefaultFolderPath] = useState(DEFAULT_PREFERENCES.default_folder_path);
  const [topK, setTopK] = useState(DEFAULT_PREFERENCES.top_k);
  const [queryRewriteEnabled, setQueryRewriteEnabled] = useState(DEFAULT_PREFERENCES.query_rewrite_enabled);
  const [lexicalWeight, setLexicalWeight] = useState(DEFAULT_PREFERENCES.lexical_weight);
  const [semanticWeight, setSemanticWeight] = useState(DEFAULT_PREFERENCES.semantic_weight);
  const [embeddingProvider, setEmbeddingProvider] = useState("hashing");
  const [llmProvider, setLlmProvider] = useState("template");
  const [preferredRuntimeMode, setPreferredRuntimeMode] = useState<"local" | "api">(
    DEFAULT_PREFERENCES.preferred_runtime_mode,
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(null);
  const [documentGraph, setDocumentGraph] = useState<DocumentGraphResponse | null>(null);
  const [queryInsights, setQueryInsights] = useState<QueryInsightsResponse | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetricsResponse | null>(null);
  const [retrievalDebug, setRetrievalDebug] = useState<RetrievalDebugResponse | null>(null);
  const [retrievalEvaluation, setRetrievalEvaluation] = useState<RetrievalEvaluationResponse | null>(null);
  const [backupVersions, setBackupVersions] = useState<BackupManifestResponse | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authTokenState, setAuthTokenState] = useState(getAuthToken());

  useEffect(() => {
    const stored = safeReadChatSessions();
    if (stored.sessions.length) {
      setChatSessions(stored.sessions);
      setActiveSessionId(stored.activeSessionId || stored.sessions[0].id);
    }
    if (getAuthToken()) {
      void refreshAuth();
    }
    void refresh();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(chatSessions));
    if (activeSessionId) {
      window.localStorage.setItem(ACTIVE_CHAT_SESSION_STORAGE_KEY, activeSessionId);
    }
  }, [chatSessions, activeSessionId]);

  useEffect(() => {
    if (!chatSessions.length) {
      return;
    }
    const active = chatSessions.find((session) => session.id === activeSessionId) ?? chatSessions[0];
    setRetrievalMode(active.retrievalMode);
    setTopK(active.topK);
    setQueryRewriteEnabled(active.queryRewriteEnabled);
  }, [activeSessionId, chatSessions]);

  function notify(kind: Notice["kind"], message: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotices((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setNotices((prev) => prev.filter((item) => item.id !== id));
    }, 3000);
  }

  function normalizeError(err: unknown, fallback: string) {
    return err instanceof Error ? err.message : fallback;
  }

  function prependActivity(item: ActivityItem) {
    setRecentActivities((prev) => [item, ...prev].slice(0, 10));
  }

  async function login(username: string, password: string) {
    setBusy("login");
    setError("");
    try {
      const response = await api.login({ username, password });
      setAuthToken(response.access_token);
      setAuthTokenState(response.access_token);
      setCurrentUser(response.user);
      notify("success", `已登录：${response.user.display_name || response.user.username}`);
      await refresh();
    } catch (err) {
      const message = normalizeError(err, "登录失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  function logout() {
    setAuthToken("");
    setAuthTokenState("");
    setCurrentUser(null);
    notify("info", "已退出登录。");
  }

  async function refreshAuth() {
    if (!getAuthToken()) {
      return;
    }
    setBusy("refresh-auth");
    try {
      const response = await api.refreshToken();
      setAuthToken(response.access_token);
      setAuthTokenState(response.access_token);
      setCurrentUser(response.user);
    } catch {
      setAuthToken("");
      setAuthTokenState("");
      setCurrentUser(null);
    } finally {
      setBusy("");
    }
  }

  function updateActiveSession(mutator: (session: ChatSession) => ChatSession) {
    setChatSessions((prev) => {
      if (!prev.length) {
        const fresh = createSession(retrievalMode, topK, queryRewriteEnabled);
        const updated = mutator(fresh);
        setActiveSessionId(updated.id);
        return [updated];
      }
      const targetId = activeSessionId || prev[0].id;
      return prev.map((session) => (session.id === targetId ? mutator(session) : session));
    });
  }

  function ensureSession() {
    setChatSessions((prev) => {
      if (prev.length) {
        return prev;
      }
      const fresh = createSession(retrievalMode, topK, queryRewriteEnabled);
      setActiveSessionId(fresh.id);
      return [fresh];
    });
  }

  const refresh = useCallback(async () => {
    setBusy("refresh");
    setError("");
    try {
      const [appHealth, dbHealth] = await Promise.all([api.getHealth(), api.getDbHealth()]);
      setAppStatus(appHealth.status);
      setDbStatus(dbHealth.status);
      if (!getAuthToken()) {
        setAppVersion("--");
        setModeLabel("登录后访问");
        setDocuments([]);
        setRecentActivities([]);
        setAnalyticsOverview(null);
        setDocumentGraph(null);
        setQueryInsights(null);
        setSystemMetrics(null);
        return;
      }
      const [configResponse, docs, logs] = await Promise.all([api.getConfig(), api.listDocuments(), api.listLogs(8)]);
      const preferences = normalizePreferences(configResponse);
      setAppVersion(configResponse.app_version);
      setModeLabel(configResponse.runtime_mode === "local" ? "本地处理" : "API 模式");
      setEmbeddingProvider(configResponse.embedding_provider);
      setLlmProvider(configResponse.llm_provider);
      setDefaultFolderPath(preferences.default_folder_path);
      setRetrievalMode(preferences.default_retrieval_mode);
      setTopK(preferences.top_k);
      setQueryRewriteEnabled(preferences.query_rewrite_enabled);
      setLexicalWeight(preferences.lexical_weight);
      setSemanticWeight(preferences.semantic_weight);
      setPreferredRuntimeMode(preferences.preferred_runtime_mode);
      setDocuments(docs);
      setRecentActivities(mapLogsToActivities(logs));
      ensureSession();
    } catch (err) {
      const message = normalizeError(err, "加载系统状态失败。");
      setError(message);
      notify("error", message);
    } finally {
      setBusy("");
    }
  }, [queryRewriteEnabled, retrievalMode, topK]);

  const refreshAnalytics = useCallback(async () => {
    setBusy("analytics");
    setError("");
    try {
      if (!getAuthToken()) {
        setAnalyticsOverview(null);
        setDocumentGraph(null);
        setQueryInsights(null);
        setSystemMetrics(null);
        return;
      }
      const [overview, graph, insights, metrics] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getDocumentGraph(),
        api.getQueryInsights(),
        api.getSystemMetrics(),
      ]);
      setAnalyticsOverview(overview);
      setDocumentGraph(graph);
      setQueryInsights(insights);
      setSystemMetrics(metrics);
    } catch (err) {
      const message = normalizeError(err, "加载分析数据失败。");
      setError(message);
      notify("error", message);
    } finally {
      setBusy("");
    }
  }, []);

  async function uploadFile(file: File) {
    setBusy("upload");
    setError("");
    try {
      await api.uploadDocument({ file });
      prependActivity({
        id: `upload-${Date.now()}`,
        kind: "upload",
        text: `上传了“${file.name}”`,
        createdAt: toIsoNow(),
      });
      notify("success", `已导入文件：${file.name}`);
      await refresh();
    } catch (err) {
      const message = normalizeError(err, "文件上传失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function syncDirectory(rootPath: string) {
    setBusy("sync");
    setError("");
    try {
      const result = await api.syncLocalDir({ root_path: rootPath });
      setSyncResult(result);
      prependActivity({
        id: `sync-${Date.now()}`,
        kind: "sync",
        text: `同步了目录“${rootPath}”`,
        createdAt: toIsoNow(),
      });
      notify("success", `目录同步完成，导入 ${result.imported_documents} 个文档。`);
      await refresh();
    } catch (err) {
      const message = normalizeError(err, "目录同步失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function deleteDocument(documentId: string) {
    setBusy("delete");
    setError("");
    try {
      await api.deleteDocument(documentId);
      setDocuments((prev) => prev.filter((item) => item.document_id !== documentId));
      prependActivity({
        id: `delete-${Date.now()}`,
        kind: "delete",
        text: `删除了文档“${documentId}”`,
        createdAt: toIsoNow(),
      });
      notify("success", "文档已删除。");
    } catch (err) {
      const message = normalizeError(err, "删除文档失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function updateDocument(documentId: string, payload: DocumentUpdatePayload) {
    setBusy("update-document");
    setError("");
    try {
      const updated = await api.updateDocument(documentId, payload);
      setDocuments((prev) => prev.map((item) => (item.document_id === documentId ? updated : item)));
      prependActivity({
        id: `update-${Date.now()}`,
        kind: "maintenance",
        text: `更新了文档“${updated.title}”`,
        createdAt: toIsoNow(),
      });
      notify("success", "文档已更新。");
    } catch (err) {
      const message = normalizeError(err, "更新文档失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function batchDeleteDocuments(documentIds: string[]) {
    setBusy("batch-delete");
    setError("");
    try {
      const result = await api.batchDeleteDocuments(documentIds);
      setDocuments((prev) => prev.filter((item) => !documentIds.includes(item.document_id)));
      prependActivity({
        id: `batch-delete-${Date.now()}`,
        kind: "delete",
        text: `批量删除了 ${result.deleted_count} 个文档`,
        createdAt: toIsoNow(),
      });
      notify("success", `已批量删除 ${result.deleted_count} 个文档。`);
    } catch (err) {
      const message = normalizeError(err, "批量删除文档失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function batchUpdateDocuments(documentIds: string[], metadataUpdates: Record<string, string>) {
    setBusy("batch-update");
    setError("");
    try {
      const result = await api.batchUpdateDocuments({
        document_ids: documentIds,
        metadata_updates: metadataUpdates,
      });
      await refresh();
      prependActivity({
        id: `batch-update-${Date.now()}`,
        kind: "maintenance",
        text: `批量更新了 ${result.updated_count} 个文档`,
        createdAt: toIsoNow(),
      });
      notify("success", `已批量更新 ${result.updated_count} 个文档。`);
    } catch (err) {
      const message = normalizeError(err, "批量更新文档失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function moveDocuments(documentIds: string[], folderPath: string) {
    setBusy("move-documents");
    setError("");
    try {
      const result = await api.moveDocuments({
        document_ids: documentIds,
        folder_path: folderPath,
      });
      await refresh();
      prependActivity({
        id: `move-documents-${Date.now()}`,
        kind: "maintenance",
        text: `移动了 ${result.moved_count} 个文档到 ${folderPath}`,
        createdAt: toIsoNow(),
      });
      notify("success", `已移动 ${result.moved_count} 个文档。`);
    } catch (err) {
      const message = normalizeError(err, "移动文档失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function renameDocumentFile(documentId: string, filename: string) {
    setBusy("rename-file");
    setError("");
    try {
      const updated = await api.renameDocumentFile({ document_id: documentId, filename });
      setDocuments((prev) => prev.map((item) => (item.document_id === documentId ? updated : item)));
      prependActivity({
        id: `rename-file-${Date.now()}`,
        kind: "maintenance",
        text: `重命名了文件“${filename}”`,
        createdAt: toIsoNow(),
      });
      notify("success", "文件已重命名。");
    } catch (err) {
      const message = normalizeError(err, "重命名文件失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function askQuestion(question: string, options: AskQuestionOptions) {
    setBusy("ask");
    setError("");
    ensureSession();
    const askedAt = toIsoNow();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
      citations: [],
      createdAt: askedAt,
      filters: options.filters,
    };
    updateActiveSession((session) => ({
      ...session,
      title: session.messages.length ? session.title : question.slice(0, 24),
      updatedAt: askedAt,
      retrievalMode,
      topK: options.topK,
      queryRewriteEnabled: options.queryRewriteEnabled,
      filters: options.filters,
      messages: [...session.messages, userMessage],
    }));

    try {
      const started = performance.now();
      const response = await api.ask({
        question,
        filters: options.filters,
        retrieval_mode: retrievalMode,
        query_rewrite_enabled: options.queryRewriteEnabled,
        top_k: options.topK,
      });
      const latencyMs = Math.round(performance.now() - started);
      setLastLatencyMs(latencyMs);
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.answer,
        citations: response.citations,
        confidence: response.confidence,
        latencyMs,
        createdAt: toIsoNow(),
        rewrittenQuery: response.rewritten_query,
        filters: options.filters,
      };
      updateActiveSession((session) => ({
        ...session,
        updatedAt: assistantMessage.createdAt,
        retrievalMode,
        topK: options.topK,
        queryRewriteEnabled: options.queryRewriteEnabled,
        filters: options.filters,
        messages: [...session.messages, assistantMessage],
      }));
      prependActivity({
        id: `query-${Date.now()}`,
        kind: "query",
        text: `查询了“${question}”`,
        createdAt: askedAt,
      });
      notify("success", "已生成回答。");
    } catch (err) {
      const message = normalizeError(err, "提问失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function debugRetrieval(question: string, options: AskQuestionOptions, limit = 20) {
    setBusy("debug-retrieval");
    setError("");
    try {
      const response = await api.debugRetrieval(
        {
          question,
          filters: options.filters,
          retrieval_mode: retrievalMode,
          query_rewrite_enabled: options.queryRewriteEnabled,
          top_k: options.topK,
        },
        limit,
      );
      setRetrievalDebug(response);
      notify("success", "已生成检索调试结果。");
    } catch (err) {
      const message = normalizeError(err, "检索调试失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function evaluateRetrieval(cases: RetrievalEvaluationCase[]) {
    setBusy("evaluate-retrieval");
    setError("");
    try {
      const response = await api.evaluateRetrieval(cases);
      setRetrievalEvaluation(response);
      notify("success", "已完成检索评测。");
    } catch (err) {
      const message = normalizeError(err, "检索评测失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function exportQueryLogs(params: { question?: string; role?: string; user_id?: string; limit?: number }) {
    setBusy("export-query-logs");
    setError("");
    try {
      const blob = await api.exportQueryLogs(params);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "query-logs.csv";
      anchor.click();
      window.URL.revokeObjectURL(url);
      notify("success", "查询日志已导出。");
    } catch (err) {
      const message = normalizeError(err, "导出查询日志失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function rebuildIndexes() {
    setBusy("rebuild-indexes");
    setError("");
    try {
      const result = await api.rebuildIndexes();
      prependActivity({
        id: `maintenance-rebuild-${Date.now()}`,
        kind: "maintenance",
        text: `重建了索引，覆盖 ${result.document_count} 个文档`,
        createdAt: toIsoNow(),
      });
      notify("success", "索引已重建。");
      await refresh();
    } catch (err) {
      const message = normalizeError(err, "重建索引失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function exportBackup() {
    setBusy("export-backup");
    setError("");
    try {
      const blob = await api.exportBackup();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "rag-backup.json";
      anchor.click();
      window.URL.revokeObjectURL(url);
      prependActivity({
        id: `maintenance-export-${Date.now()}`,
        kind: "maintenance",
        text: "导出了知识库备份",
        createdAt: toIsoNow(),
      });
      notify("success", "备份已导出。");
    } catch (err) {
      const message = normalizeError(err, "导出备份失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function createBackupVersion() {
    setBusy("create-backup-version");
    setError("");
    try {
      const result = await api.createBackupVersion();
      await listBackupVersions();
      notify("success", `备份版本已创建：${result.filename}`);
    } catch (err) {
      const message = normalizeError(err, "创建备份版本失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function listBackupVersions() {
    setBusy("list-backups");
    setError("");
    try {
      const result = await api.listBackupVersions();
      setBackupVersions(result);
    } catch (err) {
      const message = normalizeError(err, "加载备份版本失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function verifyBackupVersion(filename: string) {
    setBusy("verify-backup");
    setError("");
    try {
      const result = await api.verifyBackupVersion(filename);
      notify(result.valid ? "success" : "error", result.message);
      await listBackupVersions();
    } catch (err) {
      const message = normalizeError(err, "校验备份失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function restoreBackup(file: File) {
    setBusy("restore-backup");
    setError("");
    try {
      const result = await api.restoreBackup(file);
      prependActivity({
        id: `maintenance-restore-${Date.now()}`,
        kind: "maintenance",
        text: `恢复了备份，导入 ${result.document_count} 个文档`,
        createdAt: toIsoNow(),
      });
      notify("success", "备份已恢复。");
      await refresh();
    } catch (err) {
      const message = normalizeError(err, "恢复备份失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function cleanupDuplicates() {
    setBusy("cleanup-duplicates");
    setError("");
    try {
      const result = await api.cleanupDuplicates();
      prependActivity({
        id: `maintenance-dedupe-${Date.now()}`,
        kind: "maintenance",
        text: `执行了去重清理，当前保留 ${result.document_count} 个文档`,
        createdAt: toIsoNow(),
      });
      notify("success", "重复文档已清理。");
      await refresh();
    } catch (err) {
      const message = normalizeError(err, "去重清理失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function cleanupOrphans() {
    setBusy("cleanup-orphans");
    setError("");
    try {
      const result = await api.cleanupOrphans();
      prependActivity({
        id: `maintenance-orphans-${Date.now()}`,
        kind: "maintenance",
        text: `清理了 ${result.document_count} 个孤儿文件`,
        createdAt: toIsoNow(),
      });
      notify("success", "孤儿文件已清理。");
      await refresh();
    } catch (err) {
      const message = normalizeError(err, "孤儿文件清理失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  const documentCount = documents.length;
  const chunkCount = documents.reduce((sum, item) => sum + item.chunks.length, 0);
  const averageChunks = documentCount > 0 ? Math.round((chunkCount / documentCount) * 10) / 10 : 0;
  const categoryStats = useMemo(() => buildCategoryStats(documents), [documents]);
  const dominantCategory = categoryStats[0]?.label ?? UNKNOWN_CATEGORY;
  const dominantCategoryCount = categoryStats[0]?.count ?? 0;
  const filteredDocuments = useMemo(() => {
    const keyword = documentSearch.trim().toLowerCase();
    return documents.filter((document) => {
      const normalizedCategory = normalizeCategoryLabel(document.metadata.category?.trim() || document.source?.trim());
      const matchCategory = selectedCategory === ALL_CATEGORY || normalizedCategory === selectedCategory;
      if (!matchCategory) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const haystacks = [
        document.title,
        document.source,
        document.document_id,
        document.file_path ?? "",
        document.metadata.folder_path ?? "",
        normalizedCategory,
        document.metadata.file_name ?? "",
      ];
      return haystacks.some((item) => item.toLowerCase().includes(keyword));
    });
  }, [documents, documentSearch, selectedCategory]);

  const activeSession =
    chatSessions.find((session) => session.id === activeSessionId) ??
    chatSessions[0] ??
    createSession(retrievalMode, topK, queryRewriteEnabled);
  const chatMessages = activeSession.messages;
  const canAccessPrivateData = Boolean(currentUser || authTokenState);

  function openSettings() {
    setCurrentView("settings");
    setIsSettingsOpen(true);
  }

  function closeSettings() {
    setIsSettingsOpen(false);
    setCurrentView((prev) => (prev === "settings" ? "overview" : prev));
  }

  async function savePreferences() {
    setBusy("save-settings");
    setError("");
    try {
      const response = await api.updatePreferences({
        default_folder_path: defaultFolderPath,
        default_retrieval_mode: retrievalMode,
        top_k: topK,
        preferred_runtime_mode: preferredRuntimeMode,
        query_rewrite_enabled: queryRewriteEnabled,
        lexical_weight: lexicalWeight,
        semantic_weight: semanticWeight,
      });
      const preferences = normalizePreferences(response);
      setDefaultFolderPath(preferences.default_folder_path);
      setRetrievalMode(preferences.default_retrieval_mode);
      setTopK(preferences.top_k);
      setQueryRewriteEnabled(preferences.query_rewrite_enabled);
      setLexicalWeight(preferences.lexical_weight);
      setSemanticWeight(preferences.semantic_weight);
      setPreferredRuntimeMode(preferences.preferred_runtime_mode);
      notify("success", "设置已保存。");
      setCurrentView("overview");
      setIsSettingsOpen(false);
    } catch (err) {
      const message = normalizeError(err, "保存设置失败。");
      setError(message);
      notify("error", message);
      throw err;
    } finally {
      setBusy("");
    }
  }

  function createChatSession() {
    const fresh = createSession(retrievalMode, topK, queryRewriteEnabled);
    setChatSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
  }

  function setActiveSession(sessionId: string) {
    setActiveSessionId(sessionId);
  }

  function clearActiveSession() {
    updateActiveSession((session) => ({
      ...session,
      title: "新对话",
      updatedAt: toIsoNow(),
      messages: [],
    }));
    setRetrievalDebug(null);
    setRetrievalEvaluation(null);
  }

  const value = useMemo<AppContextValue>(
    () => ({
      busy,
      error,
      appStatus,
      dbStatus,
      appVersion,
      modeLabel,
      retrievalMode,
      documents,
      documentSearch,
      selectedCategory,
      filteredDocuments,
      currentView,
      documentCount,
      chunkCount,
      averageChunks,
      dominantCategory,
      dominantCategoryCount,
      categoryStats,
      recentActivities,
      chatMessages,
      chatSessions,
      activeSessionId,
      syncResult,
      notices,
      defaultFolderPath,
      topK,
      queryRewriteEnabled,
      lexicalWeight,
      semanticWeight,
      embeddingProvider,
      llmProvider,
      preferredRuntimeMode,
      isSettingsOpen,
      lastLatencyMs,
      analyticsOverview,
      documentGraph,
      queryInsights,
      systemMetrics,
      retrievalDebug,
      retrievalEvaluation,
      backupVersions,
      currentUser,
      authToken: authTokenState,
      canAccessPrivateData,
      login,
      logout,
      refreshAuth,
      refresh,
      refreshAnalytics,
      uploadFile,
      syncDirectory,
      deleteDocument,
      updateDocument,
      batchDeleteDocuments,
      batchUpdateDocuments,
      moveDocuments,
      renameDocumentFile,
      askQuestion,
      debugRetrieval,
      evaluateRetrieval,
      exportQueryLogs,
      rebuildIndexes,
      exportBackup,
      createBackupVersion,
      listBackupVersions,
      verifyBackupVersion,
      restoreBackup,
      cleanupDuplicates,
      cleanupOrphans,
      setRetrievalMode,
      setDefaultFolderPath,
      setTopK,
      setQueryRewriteEnabled,
      setLexicalWeight,
      setSemanticWeight,
      setPreferredRuntimeMode,
      setCurrentView,
      setDocumentSearch,
      setSelectedCategory,
      savePreferences,
      openSettings,
      closeSettings,
      createChatSession,
      setActiveSession,
      clearActiveSession,
    }),
    [
      busy,
      error,
      appStatus,
      dbStatus,
      appVersion,
      modeLabel,
      retrievalMode,
      documents,
      documentSearch,
      selectedCategory,
      filteredDocuments,
      currentView,
      documentCount,
      chunkCount,
      averageChunks,
      dominantCategory,
      dominantCategoryCount,
      categoryStats,
      recentActivities,
      chatMessages,
      chatSessions,
      activeSessionId,
      syncResult,
      notices,
      defaultFolderPath,
      topK,
      queryRewriteEnabled,
      lexicalWeight,
      semanticWeight,
      embeddingProvider,
      llmProvider,
      preferredRuntimeMode,
      isSettingsOpen,
      lastLatencyMs,
      analyticsOverview,
      documentGraph,
      queryInsights,
      systemMetrics,
      retrievalDebug,
      retrievalEvaluation,
      backupVersions,
      currentUser,
      authTokenState,
      canAccessPrivateData,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppState must be used within AppProvider.");
  }
  return context;
}
