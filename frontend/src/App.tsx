import { FormEvent, useEffect, useMemo, useState } from "react";

import type { DocumentItem, RetrievalEvaluationCase, RetrievalMode } from "./api";
import { getDocumentDownloadUrl } from "./api";
import { ToastStack } from "./components";
import { AppProvider, type ActivityItem, type AppView, type CategoryStat, useAppState } from "./state";

type Citation = {
  document_id: string;
  document_title: string;
  chunk_id: string;
  score: number;
  content_preview: string;
};

type GraphNode = {
  id: string;
  title: string;
  category: string;
  source: string;
  size: number;
};

type GraphEdge = {
  source: string;
  target: string;
  reason: string;
  weight: number;
};

type BarsItem = {
  label: string;
  count: number;
};

type NavigationItem = {
  id: AppView;
  label: string;
  description: string;
  icon: string;
};

type DocumentListItem = DocumentItem;

type FolderNode = {
  key: string;
  name: string;
  path: string;
  count: number;
};

type WidgetKey = "stats" | "categories" | "insights" | "activity";
type WidgetPrefs = Record<WidgetKey, boolean>;
type CollapseState = Record<string, boolean>;
type ThemeMode = "light" | "dark";

const NAV_ITEMS: NavigationItem[] = [
  { id: "overview", label: "概览", description: "统计、分类与快速入口", icon: "概" },
  { id: "documents", label: "文档库", description: "目录筛选、批量管理与重命名", icon: "文" },
  { id: "qa", label: "问答台", description: "多会话问答、调试评测与日志导出", icon: "问" },
  { id: "maintenance", label: "系统维护", description: "索引、备份与清理操作", icon: "维" },
  { id: "settings", label: "设置", description: "运行模式、检索参数与主题", icon: "设" },
];

const DEFAULT_WIDGET_PREFS: WidgetPrefs = {
  stats: true,
  categories: true,
  insights: true,
  activity: true,
};

const DEFAULT_COLLAPSE: CollapseState = {
  stats: false,
  categories: false,
  insights: false,
  activity: false,
  folders: false,
  documents: false,
  maintenance: false,
  qaTips: false,
  systemStatus: false,
  qaDebug: false,
  qaEvaluate: false,
  qaHistory: false,
};

const ROOT_FOLDER_KEY = "__all__";

export function App() {
  return (
    <AppProvider>
      <KnowledgeBasePage />
    </AppProvider>
  );
}

function KnowledgeBasePage() {
  const {
    busy,
    error,
    appStatus,
    dbStatus,
    appVersion,
    modeLabel,
    retrievalMode,
    filteredDocuments,
    documents,
    documentSearch,
    selectedCategory,
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
    notices,
    defaultFolderPath,
    topK,
    queryRewriteEnabled,
    lexicalWeight,
    semanticWeight,
    embeddingProvider,
    llmProvider,
    preferredRuntimeMode,
    lastLatencyMs,
    analyticsOverview,
    documentGraph,
    queryInsights,
    systemMetrics,
    retrievalDebug,
    retrievalEvaluation,
    backupVersions,
    currentUser,
    authToken,
    uploadFile,
    syncDirectory,
    askQuestion,
    debugRetrieval,
    evaluateRetrieval,
    exportQueryLogs,
    deleteDocument,
    updateDocument,
    batchDeleteDocuments,
    batchUpdateDocuments,
    moveDocuments,
    renameDocumentFile,
    rebuildIndexes,
    exportBackup,
    createBackupVersion,
    listBackupVersions,
    verifyBackupVersion,
    restoreBackup,
    cleanupDuplicates,
    cleanupOrphans,
    login,
    logout,
    refreshAnalytics,
    savePreferences,
    setCurrentView,
    setDocumentSearch,
    setSelectedCategory,
    setRetrievalMode,
    setDefaultFolderPath,
    setTopK,
    setQueryRewriteEnabled,
    setLexicalWeight,
    setSemanticWeight,
    setPreferredRuntimeMode,
    createChatSession,
    setActiveSession,
    clearActiveSession,
  } = useAppState();

  const [theme, setTheme] = useState<ThemeMode>("light");
  const [widgetPrefs, setWidgetPrefs] = useState<WidgetPrefs>(DEFAULT_WIDGET_PREFS);
  const [collapsed, setCollapsed] = useState<CollapseState>(DEFAULT_COLLAPSE);
  const [question, setQuestion] = useState("");
  const [syncPath, setSyncPath] = useState(defaultFolderPath);
  const [folderFilter, setFolderFilter] = useState(ROOT_FOLDER_KEY);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [batchCategory, setBatchCategory] = useState("");
  const [batchFolder, setBatchFolder] = useState("");
  const [dashboardQuery, setDashboardQuery] = useState("");
  const [qaCategoryFilter, setQaCategoryFilter] = useState("");
  const [qaFolderFilter, setQaFolderFilter] = useState("");
  const [qaExpectedDocumentId, setQaExpectedDocumentId] = useState("");
  const [loginUsername, setLoginUsername] = useState("admin");
  const [loginPassword, setLoginPassword] = useState("rag-console");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(new Date().toISOString());

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("rag-theme");
    const savedWidgets = window.localStorage.getItem("rag-dashboard-widgets");
    const savedCollapse = window.localStorage.getItem("rag-dashboard-collapse-v2");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
    if (savedWidgets) {
      try {
        setWidgetPrefs({ ...DEFAULT_WIDGET_PREFS, ...JSON.parse(savedWidgets) });
      } catch {}
    }
    if (savedCollapse) {
      try {
        setCollapsed({ ...DEFAULT_COLLAPSE, ...JSON.parse(savedCollapse) });
      } catch {}
    }
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem("rag-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("rag-dashboard-widgets", JSON.stringify(widgetPrefs));
  }, [widgetPrefs]);

  useEffect(() => {
    window.localStorage.setItem("rag-dashboard-collapse-v2", JSON.stringify(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setSyncPath(defaultFolderPath);
  }, [defaultFolderPath]);

  useEffect(() => {
    void refreshAnalytics().finally(() => setLastUpdatedAt(new Date().toISOString()));
  }, []);

  useEffect(() => {
    setSelectedDocumentIds((prev) =>
      prev.filter((id) => filteredDocuments.some((document) => document.document_id === id)),
    );
  }, [filteredDocuments]);

  const folders = useMemo(() => buildFolders(documents), [documents]);
  const visibleDocuments = useMemo(
    () => filterDocumentsByFolder(filteredDocuments, folderFilter, dashboardQuery),
    [filteredDocuments, folderFilter, dashboardQuery],
  );
  const latestAssistantMessage = [...chatMessages].reverse().find((message) => message.role === "assistant");
  const qaCitations = latestAssistantMessage?.citations ?? [];
  const currentRelatedDocuments = useMemo(
    () =>
      qaCitations
        .map((citation) => documents.find((document) => document.document_id === citation.document_id))
        .filter((item): item is DocumentListItem => item !== undefined),
    [documents, qaCitations],
  );
  const documentGraphNodes = documentGraph?.nodes ?? [];
  const documentGraphEdges = documentGraph?.edges ?? [];

  const qaFilters = useMemo(() => {
    const filters: Record<string, string> = {};
    if (qaCategoryFilter.trim()) {
      filters.category = qaCategoryFilter.trim();
    }
    if (qaFolderFilter.trim()) {
      filters.folder_path = qaFolderFilter.trim();
    }
    return filters;
  }, [qaCategoryFilter, qaFolderFilter]);

  async function handleAsk(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }
    await askQuestion(trimmed, {
      filters: qaFilters,
      topK,
      queryRewriteEnabled,
    });
    setQuestion("");
  }

  async function handleDebug() {
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }
    await debugRetrieval(trimmed, {
      filters: qaFilters,
      topK,
      queryRewriteEnabled,
    });
  }

  async function handleEvaluate() {
    const trimmed = question.trim();
    const expectedDocumentId = qaExpectedDocumentId.trim();
    if (!trimmed || !expectedDocumentId) {
      return;
    }
    const cases: RetrievalEvaluationCase[] = [
      {
        question: trimmed,
        expected_document_id: expectedDocumentId,
        retrieval_mode: retrievalMode,
        filters: qaFilters,
      },
    ];
    await evaluateRetrieval(cases);
  }

  async function handleExportLogs() {
    await exportQueryLogs({
      question: question.trim() || undefined,
      limit: 200,
    });
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    await login(loginUsername.trim(), loginPassword);
  }

  async function handleSync() {
    const path = syncPath.trim();
    if (!path) {
      return;
    }
    await syncDirectory(path);
  }

  async function handleBatchCategoryUpdate() {
    if (!selectedDocumentIds.length || !batchCategory.trim()) {
      return;
    }
    await batchUpdateDocuments(selectedDocumentIds, { category: batchCategory.trim() });
    setBatchCategory("");
    setSelectedDocumentIds([]);
  }

  async function handleBatchMove() {
    if (!selectedDocumentIds.length || !batchFolder.trim()) {
      return;
    }
    await moveDocuments(selectedDocumentIds, batchFolder.trim());
    setBatchFolder("");
    setSelectedDocumentIds([]);
  }

  async function handleBatchDelete() {
    if (!selectedDocumentIds.length) {
      return;
    }
    if (!window.confirm(`确认删除选中的 ${selectedDocumentIds.length} 个文档？`)) {
      return;
    }
    await batchDeleteDocuments(selectedDocumentIds);
    setSelectedDocumentIds([]);
  }

  async function handleRename(document: DocumentListItem) {
    const currentName = document.metadata.file_name || document.title;
    const nextName = window.prompt("输入新的文件名", currentName);
    if (!nextName || nextName === currentName) {
      return;
    }
    await renameDocumentFile(document.document_id, nextName.trim());
  }

  async function handleRecategorize(document: DocumentListItem) {
    const currentCategory = document.metadata.category || document.source || "";
    const nextCategory = window.prompt("输入新的分类", currentCategory);
    if (!nextCategory || nextCategory === currentCategory) {
      return;
    }
    await updateDocument(document.document_id, {
      metadata: {
        ...document.metadata,
        category: nextCategory.trim(),
      },
    });
  }

  async function handleDelete(document: DocumentListItem) {
    if (!window.confirm(`确认删除文档“${document.title}”？`)) {
      return;
    }
    await deleteDocument(document.document_id);
  }

  function toggleWidget(key: WidgetKey) {
    setWidgetPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleCollapse(key: keyof CollapseState) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="dashboard-shell">
      <aside className="left-rail">
        <div className="brand-block">
          <span className="brand-kicker">私有检索控制台</span>
          <h1>我的知识库</h1>
          <p>本地知识库问答、文档治理与索引维护统一工作台。</p>
        </div>

        <nav className="nav-list">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${currentView === item.id ? "nav-item-active" : ""}`}
              onClick={() => setCurrentView(item.id)}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-copy">
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="rail-footer">
          <AuthPanel
            currentUser={currentUser}
            authToken={authToken}
            username={loginUsername}
            password={loginPassword}
            busy={busy}
            onUsernameChange={setLoginUsername}
            onPasswordChange={setLoginPassword}
            onSubmit={(event) => void handleLogin(event)}
            onLogout={logout}
          />

          <StatusCard
            appStatus={appStatus}
            dbStatus={dbStatus}
            appVersion={appVersion}
            modeLabel={modeLabel}
            lastUpdatedAt={lastUpdatedAt}
          />
        </div>
      </aside>

      <main className="center-stage">
        <section className="topbar">
          <div>
            <span className="topbar-kicker">{currentViewLabel(currentView)}</span>
            <h2>私有检索控制台</h2>
            <p>数据优先在本地处理，支持按需切换外部 API，围绕文档入库、问答检索、索引维护和运行状态形成闭环。</p>
          </div>
          <div className="topbar-actions user-actions">
            <button type="button" className="action-button action-button-primary sticky-ask" onClick={() => setCurrentView("qa")}>
              开始提问
            </button>
            <button type="button" className="action-button action-button-secondary" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
              {theme === "light" ? "夜间模式" : "浅色模式"}
            </button>
            <button type="button" className="action-button action-button-secondary" onClick={() => setCurrentView("settings")}>
              设置
            </button>
            <span className="user-chip">{currentUser?.display_name || currentUser?.username || "未登录"}</span>
          </div>
        </section>

        <section className="main-panel">
          {currentView === "overview" ? (
            <OverviewView
              widgetPrefs={widgetPrefs}
              toggleWidget={toggleWidget}
              collapsed={collapsed}
              toggleCollapse={toggleCollapse}
              documentCount={documentCount}
              chunkCount={chunkCount}
              averageChunks={averageChunks}
              dominantCategory={dominantCategory}
              dominantCategoryCount={dominantCategoryCount}
              categoryStats={categoryStats}
              analyticsOverview={analyticsOverview}
              queryInsights={queryInsights}
              setCurrentView={setCurrentView}
              setSelectedCategory={setSelectedCategory}
              uploadFile={uploadFile}
              busy={busy}
            />
          ) : null}

          {currentView === "documents" ? (
            <DocumentsView
              documents={visibleDocuments}
              categoryStats={categoryStats}
              selectedCategory={selectedCategory}
              documentSearch={documentSearch}
              dashboardQuery={dashboardQuery}
              selectedDocumentIds={selectedDocumentIds}
              folders={folders}
              folderFilter={folderFilter}
              batchCategory={batchCategory}
              batchFolder={batchFolder}
              collapsed={collapsed}
              busy={busy}
              onToggleCollapse={toggleCollapse}
              onSetSelectedCategory={setSelectedCategory}
              onSetDocumentSearch={setDocumentSearch}
              onSetDashboardQuery={setDashboardQuery}
              onSetFolderFilter={setFolderFilter}
              onToggleDocumentSelect={(documentId) =>
                setSelectedDocumentIds((prev) =>
                  prev.includes(documentId) ? prev.filter((id) => id !== documentId) : [...prev, documentId],
                )
              }
              onToggleAll={() =>
                setSelectedDocumentIds((prev) =>
                  prev.length === visibleDocuments.length ? [] : visibleDocuments.map((item) => item.document_id),
                )
              }
              onSetBatchCategory={setBatchCategory}
              onSetBatchFolder={setBatchFolder}
              onBatchCategoryUpdate={() => void handleBatchCategoryUpdate()}
              onBatchMove={() => void handleBatchMove()}
              onBatchDelete={() => void handleBatchDelete()}
              onRename={handleRename}
              onRecategorize={handleRecategorize}
              onDelete={handleDelete}
            />
          ) : null}

          {currentView === "qa" ? (
            <QaView
              question={question}
              retrievalMode={retrievalMode}
              chatMessages={chatMessages}
              chatSessions={chatSessions}
              activeSessionId={activeSessionId}
              busy={busy}
              queryRewriteEnabled={queryRewriteEnabled}
              lastLatencyMs={lastLatencyMs}
              categoryStats={categoryStats}
              folders={folders}
              qaCategoryFilter={qaCategoryFilter}
              qaFolderFilter={qaFolderFilter}
              qaExpectedDocumentId={qaExpectedDocumentId}
              topK={topK}
              retrievalDebug={retrievalDebug}
              retrievalEvaluation={retrievalEvaluation}
              onQuestionChange={setQuestion}
              onRetrievalModeChange={setRetrievalMode}
              onQueryRewriteChange={setQueryRewriteEnabled}
              onTopKChange={setTopK}
              onQaCategoryFilterChange={setQaCategoryFilter}
              onQaFolderFilterChange={setQaFolderFilter}
              onQaExpectedDocumentIdChange={setQaExpectedDocumentId}
              onSubmit={(event) => void handleAsk(event)}
              onDebug={() => void handleDebug()}
              onEvaluate={() => void handleEvaluate()}
              onExportLogs={() => void handleExportLogs()}
              onCreateSession={createChatSession}
              onSetActiveSession={setActiveSession}
              onClearSession={clearActiveSession}
              collapsed={collapsed}
              onToggleCollapse={toggleCollapse}
            />
          ) : null}

          {currentView === "maintenance" ? (
            <MaintenanceView
              syncPath={syncPath}
              systemMetrics={systemMetrics}
              busy={busy}
              collapsed={collapsed}
              onToggleCollapse={toggleCollapse}
              onSyncPathChange={setSyncPath}
              onSync={() => void handleSync()}
              onRebuild={() => void rebuildIndexes()}
              onExport={() => void exportBackup()}
              onCreateBackupVersion={() => void createBackupVersion()}
              onListBackupVersions={() => void listBackupVersions()}
              onVerifyBackupVersion={(filename) => void verifyBackupVersion(filename)}
              backupVersions={backupVersions}
              onRestore={(file) => void restoreBackup(file)}
              onDedupe={() => void cleanupDuplicates()}
              onCleanupOrphans={() => void cleanupOrphans()}
            />
          ) : null}

          {currentView === "settings" ? (
            <SettingsView
              defaultFolderPath={defaultFolderPath}
              topK={topK}
              queryRewriteEnabled={queryRewriteEnabled}
              lexicalWeight={lexicalWeight}
              semanticWeight={semanticWeight}
              embeddingProvider={embeddingProvider}
              llmProvider={llmProvider}
              preferredRuntimeMode={preferredRuntimeMode}
              widgetPrefs={widgetPrefs}
              theme={theme}
              onDefaultFolderPathChange={setDefaultFolderPath}
              onTopKChange={setTopK}
              onQueryRewriteEnabledChange={setQueryRewriteEnabled}
              onLexicalWeightChange={setLexicalWeight}
              onSemanticWeightChange={setSemanticWeight}
              onPreferredRuntimeModeChange={setPreferredRuntimeMode}
              onSave={() => void savePreferences()}
              onToggleWidget={toggleWidget}
              onThemeChange={setTheme}
            />
          ) : null}
        </section>
      </main>

      <aside className="right-rail">
        <RightSidebar
          currentView={currentView}
          recentActivities={recentActivities}
          queryInsights={queryInsights}
          citations={qaCitations}
          relatedDocuments={currentRelatedDocuments}
          systemMetrics={systemMetrics}
          graphNodes={documentGraphNodes}
          graphEdges={documentGraphEdges}
        />
      </aside>

      {error ? <div className="floating-error">{error}</div> : null}
      <ToastStack notices={notices} />
    </div>
  );
}

function OverviewView({
  widgetPrefs,
  toggleWidget,
  collapsed,
  toggleCollapse,
  documentCount,
  chunkCount,
  averageChunks,
  dominantCategory,
  dominantCategoryCount,
  categoryStats,
  analyticsOverview,
  queryInsights,
  setCurrentView,
  setSelectedCategory,
  uploadFile,
  busy,
}: {
  widgetPrefs: WidgetPrefs;
  toggleWidget: (key: WidgetKey) => void;
  collapsed: CollapseState;
  toggleCollapse: (key: keyof CollapseState) => void;
  documentCount: number;
  chunkCount: number;
  averageChunks: number;
  dominantCategory: string;
  dominantCategoryCount: number;
  categoryStats: CategoryStat[];
  analyticsOverview: { query_count: number; average_latency_ms: number } | null;
  queryInsights: {
    query_frequency: BarsItem[];
    hot_topics: BarsItem[];
    hot_documents: BarsItem[];
    retrieval_modes: BarsItem[];
  } | null;
  setCurrentView: (view: AppView) => void;
  setSelectedCategory: (value: string) => void;
  uploadFile: (file: File) => Promise<void>;
  busy: string;
}) {
  const totalTopics = queryInsights?.hot_topics.reduce((sum, item) => sum + item.count, 0) ?? 0;
  return (
    <div className="view-stack">
      <section className="hero-banner">
        <div>
          <span className="section-kicker">概览</span>
          <h3>私有知识库运行总览</h3>
          <p>本地优先处理，文档、检索、问答和维护状态集中呈现。</p>
          <p className="hero-subcopy">隐私保护 · 来源可追溯 · 支持本地模型与外部 API 切换</p>
        </div>
        <div className="hero-banner-actions quick-actions">
          <button type="button" className="cta-button cta-button-large" onClick={() => setCurrentView("qa")}>
            开始提问
          </button>
          <button type="button" className="action-button action-button-secondary" onClick={() => setCurrentView("documents")}>
            管理文档
          </button>
          <label className="ghost-button upload-inline">
            {busy === "upload" ? "上传中" : "上传文档"}
            <input
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void uploadFile(file);
                  event.currentTarget.value = "";
                }
              }}
            />
          </label>
          <button type="button" className="ghost-button" onClick={() => setCurrentView("settings")}>
            系统设置
          </button>
        </div>
      </section>

      <div className="widget-toolbar">
        {([
          ["stats", "统计卡片"],
          ["categories", "分类图表"],
          ["insights", "热门分析"],
          ["activity", "最近活动"],
        ] as Array<[WidgetKey, string]>).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`chip-toggle ${widgetPrefs[key] ? "chip-toggle-active" : ""}`}
            onClick={() => toggleWidget(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {widgetPrefs.stats ? (
        <section className="dashboard-metrics">
          <div className="dashboard-metrics-head">
            <div>
              <span className="section-kicker">实时仪表盘</span>
              <h3>知识库核心指标</h3>
              <p>进入页面即可看到最关键的运行数据，不再折叠隐藏。</p>
            </div>
          </div>
          <div className="stats-grid">
            <StatCard
              icon="DOC"
              label="文档总数"
              value={String(documentCount)}
              hint="当前可检索文档总量"
              trend="up"
              actionLabel="查看详情"
              onAction={() => setCurrentView("documents")}
            />
            <StatCard
              icon="IDX"
              label="索引大小"
              value={`${chunkCount}`}
              hint="已建立的切片数量"
              trend="up"
              actionLabel="查看详情"
              onAction={() => setCurrentView("maintenance")}
            />
            <StatCard
              icon="LAT"
              label="平均响应时间"
              value={`${analyticsOverview?.average_latency_ms ?? 0} ms`}
              hint="最近一次统计结果"
              trend="stable"
              actionLabel="查看详情"
              onAction={() => setCurrentView("qa")}
            />
            <StatCard
              icon="OK"
              label="查询成功率"
              value={`${documentCount ? 100 : 0}%`}
              hint="以当前文档可命中状态近似展示"
              trend="up"
              actionLabel="查看详情"
              onAction={() => setCurrentView("qa")}
            />
          </div>
        </section>
      ) : null}

      <div className="split-grid">
        {widgetPrefs.categories ? (
          <CollapsibleCard
            title={`文档分类 (${categoryStats.length} 类)`}
            subtitle={categoryStats.length ? `主分类：${dominantCategory}，${dominantCategoryCount} 个文档。` : "上传文档后自动生成分类分布。"}
            collapsed={collapsed.categories}
            onToggle={() => toggleCollapse("categories")}
          >
            <div className="category-chart-layout">
              {categoryStats.length ? (
                <>
                  <DonutChart items={categoryStats} />
                  <div className="category-list compact-list">
                    {categoryStats.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className="category-row"
                        onClick={() => {
                          setSelectedCategory(item.label);
                          setCurrentView("documents");
                        }}
                      >
                        <div className="category-row-head">
                          <strong>{item.label}</strong>
                          <span>{item.count}</span>
                        </div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${toPercent(item.count, categoryStats[0]?.count ?? 1)}%` }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState
                  title="还没有分类统计"
                  description="上传或同步文档后，这里会展示环形图、分类占比和筛选入口。"
                  actionLabel="去上传文档"
                  onAction={() => setCurrentView("documents")}
                  visual="donut"
                />
              )}
            </div>
            <div className="section-footer-row">
              <button type="button" className="ghost-button" onClick={() => setCurrentView("documents")}>
                新增文档
              </button>
            </div>
          </CollapsibleCard>
        ) : null}

        {widgetPrefs.insights ? (
          <CollapsibleCard
            title={`检索分析 (${analyticsOverview?.query_count ?? 0} 次查询)`}
            subtitle="查询频率、热门主题与模式分布。"
            collapsed={collapsed.insights}
            onToggle={() => toggleCollapse("insights")}
          >
            <div className="mini-stats">
              <MetricMini
                label="累计查询"
                value={String(analyticsOverview?.query_count ?? 0)}
                hint="按实际查询日志统计"
              />
              <MetricMini
                label="平均延迟"
                value={`${analyticsOverview?.average_latency_ms ?? 0} ms`}
                hint="回答生成耗时"
              />
              <MetricMini label="热门主题" value={String(totalTopics)} hint="标签云累计频次" />
            </div>
            {hasQueryInsightData(queryInsights) ? (
              <>
                <div className="analysis-grid">
                  <BarsBlock title="查询频率" items={queryInsights?.query_frequency ?? []} variant="line" />
                  <BarsBlock title="模式分布" items={queryInsights?.retrieval_modes ?? []} variant="pie" />
                </div>
                <div className="tag-cloud">
                  {queryInsights?.hot_topics.map((item) => (
                    <button key={item.label} type="button" className="tag-cloud-item" style={{ fontSize: `${Math.min(18, 12 + item.count)}px` }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                title="还没有检索分析"
                description="完成一次问答后，这里会生成查询趋势、模式分布和热门主题。"
                actionLabel="开始提问"
                onAction={() => setCurrentView("qa")}
                visual="bars"
              />
            )}
          </CollapsibleCard>
        ) : null}
      </div>
    </div>
  );
}

function AuthPanel({
  currentUser,
  authToken,
  username,
  password,
  busy,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onLogout,
}: {
  currentUser: { username: string; role: string; display_name?: string | null } | null;
  authToken: string;
  username: string;
  password: string;
  busy: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onLogout: () => void;
}) {
  if (currentUser || authToken) {
    return (
      <div className="auth-panel">
        <span>当前身份</span>
        <strong>{currentUser?.display_name || currentUser?.username || "已登录用户"}</strong>
        <small>{currentUser?.role || "authenticated"}</small>
        <button type="button" className="auth-button" onClick={onLogout}>
          退出登录
        </button>
      </div>
    );
  }

  return (
    <form className="auth-panel" onSubmit={onSubmit}>
      <span>登录鉴权</span>
      <input value={username} onChange={(event) => onUsernameChange(event.target.value)} placeholder="用户名" />
      <input
        type="password"
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
        placeholder="密码"
      />
      <button type="submit" className="auth-button" disabled={busy === "login"}>
        {busy === "login" ? "登录中" : "登录"}
      </button>
      <small>默认：admin / rag-console</small>
    </form>
  );
}

function DocumentsView({
  documents,
  categoryStats,
  selectedCategory,
  documentSearch,
  dashboardQuery,
  selectedDocumentIds,
  folders,
  folderFilter,
  batchCategory,
  batchFolder,
  collapsed,
  busy,
  onToggleCollapse,
  onSetSelectedCategory,
  onSetDocumentSearch,
  onSetDashboardQuery,
  onSetFolderFilter,
  onToggleDocumentSelect,
  onToggleAll,
  onSetBatchCategory,
  onSetBatchFolder,
  onBatchCategoryUpdate,
  onBatchMove,
  onBatchDelete,
  onRename,
  onRecategorize,
  onDelete,
}: {
  documents: DocumentListItem[];
  categoryStats: CategoryStat[];
  selectedCategory: string;
  documentSearch: string;
  dashboardQuery: string;
  selectedDocumentIds: string[];
  folders: FolderNode[];
  folderFilter: string;
  batchCategory: string;
  batchFolder: string;
  collapsed: CollapseState;
  busy: string;
  onToggleCollapse: (key: keyof CollapseState) => void;
  onSetSelectedCategory: (value: string) => void;
  onSetDocumentSearch: (value: string) => void;
  onSetDashboardQuery: (value: string) => void;
  onSetFolderFilter: (value: string) => void;
  onToggleDocumentSelect: (documentId: string) => void;
  onToggleAll: () => void;
  onSetBatchCategory: (value: string) => void;
  onSetBatchFolder: (value: string) => void;
  onBatchCategoryUpdate: () => void;
  onBatchMove: () => void;
  onBatchDelete: () => void;
  onRename: (document: DocumentListItem) => Promise<void>;
  onRecategorize: (document: DocumentListItem) => Promise<void>;
  onDelete: (document: DocumentListItem) => Promise<void>;
}) {
  return (
    <div className="view-stack">
      <section className="toolbar-card">
        <div className="toolbar-grid">
          <input
            value={documentSearch}
            onChange={(event) => onSetDocumentSearch(event.target.value)}
            placeholder="搜索标题、ID、文件路径、分类"
          />
          <input
            value={dashboardQuery}
            onChange={(event) => onSetDashboardQuery(event.target.value)}
            placeholder="当前结果内快速筛选"
          />
          <select value={selectedCategory} onChange={(event) => onSetSelectedCategory(event.target.value)}>
            <option value="全部">全部分类</option>
            {categoryStats.map((item) => (
              <option key={item.label} value={item.label}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="documents-layout">
        <CollapsibleCard
          title="目录导航"
          subtitle="次要目录信息放到左侧折叠面板。"
          collapsed={collapsed.folders}
          onToggle={() => onToggleCollapse("folders")}
          className="folder-card"
        >
          <div className="folder-panel">
            {folders.map((folder) => (
              <button
                key={folder.key}
                type="button"
                className={`folder-item ${folderFilter === folder.key ? "folder-item-active" : ""}`}
                onClick={() => onSetFolderFilter(folder.key)}
              >
                <span>{folder.name}</span>
                <strong>{folder.count}</strong>
              </button>
            ))}
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="文档表格"
          subtitle="紧凑表格支持批量分类、移动、删除与单文档重命名。"
          collapsed={collapsed.documents}
          onToggle={() => onToggleCollapse("documents")}
        >
          <div className="batch-toolbar">
            <span className="selection-pill">已选 {selectedDocumentIds.length} 项</span>
            <input
              value={batchCategory}
              onChange={(event) => onSetBatchCategory(event.target.value)}
              placeholder="批量改分类"
            />
            <button type="button" className="ghost-button" onClick={onBatchCategoryUpdate} disabled={!selectedDocumentIds.length}>
              应用分类
            </button>
            <input
              value={batchFolder}
              onChange={(event) => onSetBatchFolder(event.target.value)}
              placeholder="移动到目录，如 archive/2026"
            />
            <button type="button" className="ghost-button" onClick={onBatchMove} disabled={!selectedDocumentIds.length}>
              移动目录
            </button>
            <button type="button" className="danger-button" onClick={onBatchDelete} disabled={!selectedDocumentIds.length}>
              批量删除
            </button>
          </div>

          <div className="table-wrap">
            <table className="document-table compact-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={documents.length > 0 && selectedDocumentIds.length === documents.length}
                      onChange={onToggleAll}
                    />
                  </th>
                  <th>文档</th>
                  <th>分类</th>
                  <th>目录</th>
                  <th>切片</th>
                  <th>来源</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {documents.length ? (
                  documents.map((document) => {
                    const checked = selectedDocumentIds.includes(document.document_id);
                    return (
                      <tr key={document.document_id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleDocumentSelect(document.document_id)}
                          />
                        </td>
                        <td>
                          <div className="table-primary">
                            <strong>{document.title}</strong>
                            <span>{document.metadata.file_name || document.document_id}</span>
                            {document.file_path ? <span className="path-cell">{document.file_path}</span> : null}
                          </div>
                        </td>
                        <td>{document.metadata.category || "未分类"}</td>
                        <td>{document.metadata.folder_path || "根目录"}</td>
                        <td>{document.chunks.length}</td>
                        <td>{document.source}</td>
                        <td>
                          <div className="table-actions">
                            <button type="button" className="table-button" onClick={() => void onRename(document)}>
                              重命名
                            </button>
                            <button type="button" className="table-button" onClick={() => void onRecategorize(document)}>
                              改分类
                            </button>
                            <button type="button" className="table-button danger-text" onClick={() => void onDelete(document)}>
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <EmptyBlock
                        title={busy ? "正在加载文档" : "没有匹配结果"}
                        description="调整搜索、分类或目录筛选后，这里会显示真实文档数据。"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CollapsibleCard>
      </div>
    </div>
  );
}

function QaView({
  question,
  retrievalMode,
  chatMessages,
  chatSessions,
  activeSessionId,
  busy,
  queryRewriteEnabled,
  lastLatencyMs,
  categoryStats,
  folders,
  qaCategoryFilter,
  qaFolderFilter,
  qaExpectedDocumentId,
  topK,
  retrievalDebug,
  retrievalEvaluation,
  onQuestionChange,
  onRetrievalModeChange,
  onQueryRewriteChange,
  onTopKChange,
  onQaCategoryFilterChange,
  onQaFolderFilterChange,
  onQaExpectedDocumentIdChange,
  onSubmit,
  onDebug,
  onEvaluate,
  onExportLogs,
  onCreateSession,
  onSetActiveSession,
  onClearSession,
  collapsed,
  onToggleCollapse,
}: {
  question: string;
  retrievalMode: RetrievalMode;
  chatMessages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    citations: Citation[];
    confidence?: number;
    latencyMs?: number;
    createdAt: string;
    rewrittenQuery?: string;
  }>;
  chatSessions: Array<{ id: string; title: string; updatedAt: string }>;
  activeSessionId: string;
  busy: string;
  queryRewriteEnabled: boolean;
  lastLatencyMs: number | null;
  categoryStats: CategoryStat[];
  folders: FolderNode[];
  qaCategoryFilter: string;
  qaFolderFilter: string;
  qaExpectedDocumentId: string;
  topK: number;
  retrievalDebug: {
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
  } | null;
  retrievalEvaluation: {
    cases: Array<{
      question: string;
      expected_document_id: string;
      matched: boolean;
      top_document_id: string | null;
      rewritten_query: string;
    }>;
  } | null;
  onQuestionChange: (value: string) => void;
  onRetrievalModeChange: (value: RetrievalMode) => void;
  onQueryRewriteChange: (value: boolean) => void;
  onTopKChange: (value: number) => void;
  onQaCategoryFilterChange: (value: string) => void;
  onQaFolderFilterChange: (value: string) => void;
  onQaExpectedDocumentIdChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onDebug: () => void;
  onEvaluate: () => void;
  onExportLogs: () => void;
  onCreateSession: () => void;
  onSetActiveSession: (sessionId: string) => void;
  onClearSession: () => void;
  collapsed: CollapseState;
  onToggleCollapse: (key: keyof CollapseState) => void;
}) {
  return (
    <div className="view-stack">
      <section className="qa-card">
        <div className="card-head">
          <div>
            <span className="section-kicker">Chat Workspace</span>
            <h3>问答台</h3>
            <p>支持多会话、真实检索过滤、来源引用、检索调试、评测与日志导出。</p>
          </div>
          <div className="tag-row">
            <span className="tag">隐私保护</span>
            <span className="tag">本地处理</span>
            <span className="tag">{queryRewriteEnabled ? "查询改写已启用" : "查询改写已关闭"}</span>
          </div>
        </div>

        <div className="qa-toolbar-grid">
          <select value={qaCategoryFilter} onChange={(event) => onQaCategoryFilterChange(event.target.value)}>
            <option value="">全部分类</option>
            {categoryStats.map((item) => (
              <option key={item.label} value={item.label}>
                {item.label}
              </option>
            ))}
          </select>
          <select value={qaFolderFilter} onChange={(event) => onQaFolderFilterChange(event.target.value)}>
            <option value="">全部目录</option>
            {folders
              .filter((folder) => folder.key !== ROOT_FOLDER_KEY)
              .map((folder) => (
                <option key={folder.key} value={folder.path}>
                  {folder.name}
                </option>
              ))}
          </select>
          <input
            type="number"
            min={1}
            max={20}
            value={topK}
            onChange={(event) => onTopKChange(Number(event.target.value) || 1)}
            placeholder="Top-K"
          />
          <select
            value={queryRewriteEnabled ? "on" : "off"}
            onChange={(event) => onQueryRewriteChange(event.target.value === "on")}
          >
            <option value="on">启用改写</option>
            <option value="off">关闭改写</option>
          </select>
        </div>

        <div className="chat-feed">
          {chatMessages.length ? (
            chatMessages.map((message) => (
              <article key={message.id} className={`message-row message-row-${message.role}`}>
                <div className="message-bubble">
                  <span className="message-role">{message.role === "user" ? "提问" : "回答"}</span>
                  <p>{message.content}</p>
                  {message.rewrittenQuery ? <div className="message-meta"><span>改写查询：{message.rewrittenQuery}</span></div> : null}
                  {message.role === "assistant" && message.citations.length ? (
                    <div className="citation-list">
                      {message.citations.map((citation) => (
                        <div key={`${message.id}-${citation.chunk_id}`} className="citation-card">
                          <strong>{citation.document_title}</strong>
                          <span>
                            片段 {citation.chunk_id} · 相关度 {(citation.score * 100).toFixed(0)}%
                          </span>
                          <p>{citation.content_preview}</p>
                          <div className="table-actions">
                            <a
                              className="table-button link-button"
                              href={getDocumentDownloadUrl(citation.document_id)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              打开原文
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {message.role === "assistant" ? (
                    <div className="message-meta">
                      <span>置信度：{((message.confidence ?? 0) * 100).toFixed(0)}%</span>
                      <span>响应：{message.latencyMs ?? lastLatencyMs ?? 0} ms</span>
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <EmptyBlock title="开始第一轮提问" description="输入自然语言问题，系统会给出答案、来源引用、改写结果和置信度。" />
          )}
        </div>

        <form className="composer-panel" onSubmit={onSubmit}>
          <div className="mode-tabs">
            {([
              ["precise", "精确检索"],
              ["semantic", "语义搜索"],
              ["hybrid", "混合模式"],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`mode-button ${retrievalMode === mode ? "mode-button-active" : ""}`}
                onClick={() => onRetrievalModeChange(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="composer-row">
            <textarea
              value={question}
              onChange={(event) => onQuestionChange(event.target.value)}
              placeholder="例如：总结合同义务，列出风险条款，并给出来源片段。"
            />
            <button type="submit" className="cta-button cta-button-compact" disabled={busy === "ask"}>
              {busy === "ask" ? "生成中" : "发送"}
            </button>
          </div>

          <div className="settings-actions">
            <button type="button" className="ghost-button" onClick={onDebug}>
              检索调试
            </button>
            <button type="button" className="ghost-button" onClick={onExportLogs}>
              导出日志
            </button>
            <button type="button" className="ghost-button" onClick={onCreateSession}>
              新建对话
            </button>
            <button type="button" className="ghost-button" onClick={onClearSession}>
              清空当前
            </button>
          </div>
        </form>
      </section>

      <CollapsibleCard
        title="历史会话"
        subtitle="支持多会话切换，本地持久化保存。"
        collapsed={collapsed.qaHistory}
        onToggle={() => onToggleCollapse("qaHistory")}
      >
        <div className="compact-list">
          {chatSessions.length ? (
            chatSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className={`session-item ${session.id === activeSessionId ? "session-item-active" : ""}`}
                onClick={() => onSetActiveSession(session.id)}
              >
                <strong>{session.title}</strong>
                <span>{formatDateTime(session.updatedAt)}</span>
              </button>
            ))
          ) : (
            <EmptyBlock title="暂无会话" description="发起提问后，这里会保存你的对话历史。" />
          )}
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="检索调试"
        subtitle="展示改写查询、命中文档、词法分与语义分。"
        collapsed={collapsed.qaDebug}
        onToggle={() => onToggleCollapse("qaDebug")}
      >
        {retrievalDebug ? (
          <div className="compact-list">
            <div className="mini-metric">
              <strong>{retrievalDebug.rewritten_query}</strong>
              <span>当前改写查询</span>
            </div>
            {retrievalDebug.chunks.map((chunk) => (
              <div key={`${chunk.document_id}-${chunk.chunk_id}`} className="citation-card">
                <strong>{chunk.document_title}</strong>
                <span>
                  片段 {chunk.chunk_id} · 总分 {chunk.score.toFixed(3)} · 词法 {chunk.lexical_score.toFixed(3)} · 语义{" "}
                  {chunk.semantic_score.toFixed(3)}
                </span>
                <p>{chunk.content_preview}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyBlock title="暂无调试结果" description="输入问题后点击“检索调试”，这里会展示命中细节。" />
        )}
      </CollapsibleCard>

      <CollapsibleCard
        title="检索评测"
        subtitle="对当前问题执行单条评测，验证预期文档是否命中。"
        collapsed={collapsed.qaEvaluate}
        onToggle={() => onToggleCollapse("qaEvaluate")}
      >
        <div className="form-grid">
          <div className="field-block">
            <span>预期文档 ID</span>
            <input
              value={qaExpectedDocumentId}
              onChange={(event) => onQaExpectedDocumentIdChange(event.target.value)}
              placeholder="例如 local-xxxx 或上传文档 ID"
            />
          </div>
          <button type="button" className="ghost-button" onClick={onEvaluate}>
            执行评测
          </button>
        </div>
        {retrievalEvaluation?.cases.length ? (
          <div className="compact-list">
            {retrievalEvaluation.cases.map((item, index) => (
              <div key={`${item.expected_document_id}-${index}`} className="mini-metric">
                <strong>{item.matched ? "命中" : "未命中"}</strong>
                <span>期望：{item.expected_document_id}</span>
                <span>实际：{item.top_document_id || "无结果"}</span>
                <small>改写：{item.rewritten_query}</small>
              </div>
            ))}
          </div>
        ) : null}
      </CollapsibleCard>

      <CollapsibleCard
        title="问答提示"
        subtitle="将次要说明收纳为折叠卡片，避免主区域过载。"
        collapsed={collapsed.qaTips}
        onToggle={() => onToggleCollapse("qaTips")}
      >
        <div className="compact-list">
          <div className="mini-metric">
            <strong>建议输入</strong>
            <span>问题、约束、输出格式分行写，回答更稳定。</span>
          </div>
          <div className="mini-metric">
            <strong>来源追踪</strong>
            <span>每个回答都会附带文档片段、片段编号和相关度，并可直接打开原文。</span>
          </div>
        </div>
      </CollapsibleCard>
    </div>
  );
}

function MaintenanceView({
  syncPath,
  systemMetrics,
  backupVersions,
  busy,
  collapsed,
  onToggleCollapse,
  onSyncPathChange,
  onSync,
  onRebuild,
  onExport,
  onCreateBackupVersion,
  onListBackupVersions,
  onVerifyBackupVersion,
  onRestore,
  onDedupe,
  onCleanupOrphans,
}: {
  syncPath: string;
  systemMetrics: { cpu_percent: number; memory_percent: number; disk_percent: number } | null;
  backupVersions: {
    items: Array<{
      filename: string;
      created_at: string;
      size_bytes: number;
      document_count: number;
      query_log_count: number;
      valid: boolean;
    }>;
  } | null;
  busy: string;
  collapsed: CollapseState;
  onToggleCollapse: (key: keyof CollapseState) => void;
  onSyncPathChange: (value: string) => void;
  onSync: () => void;
  onRebuild: () => void;
  onExport: () => void;
  onCreateBackupVersion: () => void;
  onListBackupVersions: () => void;
  onVerifyBackupVersion: (filename: string) => void;
  onRestore: (file: File) => void;
  onDedupe: () => void;
  onCleanupOrphans: () => void;
}) {
  return (
    <div className="view-stack">
      <section className="maintenance-grid">
        <div className="content-card">
          <div className="card-head">
            <div>
              <h3>目录同步</h3>
              <p>把真实本地目录重新扫描到知识库。</p>
            </div>
          </div>
          <div className="form-grid">
            <div className="field-block">
              <span>目录路径</span>
              <input value={syncPath} onChange={(event) => onSyncPathChange(event.target.value)} />
            </div>
            <button type="button" className="cta-button" onClick={onSync} disabled={busy === "sync"}>
              {busy === "sync" ? "同步中" : "同步目录"}
            </button>
          </div>
        </div>

        <div className="content-card">
          <div className="card-head">
            <div>
              <h3>索引与备份</h3>
              <p>低频管理动作独立收纳，不再平铺到主页。</p>
            </div>
          </div>
          <div className="settings-actions">
            <button type="button" className="ghost-button" onClick={onRebuild}>
              重建索引
            </button>
            <button type="button" className="ghost-button" onClick={onExport}>
              导出备份
            </button>
            <button type="button" className="ghost-button" onClick={onCreateBackupVersion}>
              创建版本
            </button>
            <button type="button" className="ghost-button" onClick={onListBackupVersions}>
              刷新版本
            </button>
            <label className="action-button action-button-secondary">
              恢复备份
              <input
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    onRestore(file);
                    event.currentTarget.value = "";
                  }
                }}
              />
            </label>
          </div>
          <div className="backup-list compact-list">
            {backupVersions?.items.length ? (
              backupVersions.items.slice(0, 6).map((item) => (
                <div key={item.filename} className="mini-metric">
                  <strong>{item.filename}</strong>
                  <span>
                    {item.document_count} 文档 · {item.query_log_count} 日志 ·{" "}
                    {Math.round(item.size_bytes / 1024)} KB
                  </span>
                  <small>{item.valid ? "校验通过" : "校验失败"} · {formatDateTime(item.created_at)}</small>
                  <button type="button" className="table-button" onClick={() => onVerifyBackupVersion(item.filename)}>
                    校验
                  </button>
                </div>
              ))
            ) : (
              <EmptyBlock title="暂无备份版本" description="点击“创建版本”后，这里会列出可校验的备份文件。" />
            )}
          </div>
        </div>
      </section>

      <CollapsibleCard
        title="清理任务"
        subtitle="批量维护操作放到折叠区，避免主界面视觉噪音。"
        collapsed={collapsed.maintenance}
        onToggle={() => onToggleCollapse("maintenance")}
      >
        <div className="settings-actions">
          <button type="button" className="ghost-button" onClick={onDedupe}>
            去重清理
          </button>
          <button type="button" className="ghost-button" onClick={onCleanupOrphans}>
            清理孤儿文件
          </button>
        </div>
      </CollapsibleCard>

      <div className="mini-stats">
        <MetricMini label="CPU" value={`${systemMetrics?.cpu_percent ?? 0}%`} hint="当前进程占用" />
        <MetricMini label="内存" value={`${systemMetrics?.memory_percent ?? 0}%`} hint="系统内存使用率" />
        <MetricMini label="磁盘" value={`${systemMetrics?.disk_percent ?? 0}%`} hint="磁盘占用率" />
      </div>
    </div>
  );
}

function SettingsView({
  defaultFolderPath,
  topK,
  queryRewriteEnabled,
  lexicalWeight,
  semanticWeight,
  embeddingProvider,
  llmProvider,
  preferredRuntimeMode,
  widgetPrefs,
  theme,
  onDefaultFolderPathChange,
  onTopKChange,
  onQueryRewriteEnabledChange,
  onLexicalWeightChange,
  onSemanticWeightChange,
  onPreferredRuntimeModeChange,
  onSave,
  onToggleWidget,
  onThemeChange,
}: {
  defaultFolderPath: string;
  topK: number;
  queryRewriteEnabled: boolean;
  lexicalWeight: number;
  semanticWeight: number;
  embeddingProvider: string;
  llmProvider: string;
  preferredRuntimeMode: "local" | "api";
  widgetPrefs: WidgetPrefs;
  theme: ThemeMode;
  onDefaultFolderPathChange: (value: string) => void;
  onTopKChange: (value: number) => void;
  onQueryRewriteEnabledChange: (value: boolean) => void;
  onLexicalWeightChange: (value: number) => void;
  onSemanticWeightChange: (value: number) => void;
  onPreferredRuntimeModeChange: (value: "local" | "api") => void;
  onSave: () => void;
  onToggleWidget: (key: WidgetKey) => void;
  onThemeChange: (value: ThemeMode) => void;
}) {
  return (
    <div className="settings-grid">
      <div className="content-card">
        <div className="card-head">
          <div>
            <h3>检索参数</h3>
            <p>本地运行和外部 API 两种模式都可以配置。</p>
          </div>
        </div>
        <div className="form-grid">
          <div className="field-block">
            <span>默认知识目录</span>
            <input value={defaultFolderPath} onChange={(event) => onDefaultFolderPathChange(event.target.value)} />
          </div>
          <div className="field-block">
            <span>Top-K</span>
            <input
              type="number"
              min={1}
              max={20}
              value={topK}
              onChange={(event) => onTopKChange(Number(event.target.value) || 1)}
            />
          </div>
          <div className="field-block">
            <span>运行模式</span>
            <select
              value={preferredRuntimeMode}
              onChange={(event) => onPreferredRuntimeModeChange(event.target.value as "local" | "api")}
            >
              <option value="local">本地</option>
              <option value="api">API</option>
            </select>
          </div>
          <div className="field-block">
            <span>查询改写</span>
            <select
              value={queryRewriteEnabled ? "on" : "off"}
              onChange={(event) => onQueryRewriteEnabledChange(event.target.value === "on")}
            >
              <option value="on">开启</option>
              <option value="off">关闭</option>
            </select>
          </div>
          <div className="field-block">
            <span>词法权重</span>
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={lexicalWeight}
              onChange={(event) => onLexicalWeightChange(Number(event.target.value) || 0)}
            />
          </div>
          <div className="field-block">
            <span>语义权重</span>
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={semanticWeight}
              onChange={(event) => onSemanticWeightChange(Number(event.target.value) || 0)}
            />
          </div>
        </div>
        <div className="settings-actions">
          <button type="button" className="cta-button" onClick={onSave}>
            保存设置
          </button>
          <span className="helper-copy">
            Embedding：{embeddingProvider} · LLM：{llmProvider}
          </span>
        </div>
      </div>

      <div className="content-card">
        <div className="card-head">
          <div>
            <h3>界面偏好</h3>
            <p>支持夜间模式和自定义仪表板模块显示。</p>
          </div>
        </div>
        <div className="form-grid">
          <div className="field-block">
            <span>主题</span>
            <div className="theme-row">
              <button
                type="button"
                className={`chip-toggle ${theme === "light" ? "chip-toggle-active" : ""}`}
                onClick={() => onThemeChange("light")}
              >
                浅色
              </button>
              <button
                type="button"
                className={`chip-toggle ${theme === "dark" ? "chip-toggle-active" : ""}`}
                onClick={() => onThemeChange("dark")}
              >
                夜间
              </button>
            </div>
          </div>
          <div className="field-block">
            <span>概览模块</span>
            <div className="widget-toolbar">
              {([
                ["stats", "统计卡片"],
                ["categories", "分类图表"],
                ["insights", "热门分析"],
                ["activity", "最近活动"],
              ] as Array<[WidgetKey, string]>).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`chip-toggle ${widgetPrefs[key] ? "chip-toggle-active" : ""}`}
                  onClick={() => onToggleWidget(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RightSidebar({
  currentView,
  recentActivities,
  queryInsights,
  citations,
  relatedDocuments,
  systemMetrics,
  graphNodes,
  graphEdges,
}: {
  currentView: AppView;
  recentActivities: ActivityItem[];
  queryInsights: {
    hot_topics: BarsItem[];
    hot_documents: BarsItem[];
    retrieval_modes: BarsItem[];
  } | null;
  citations: Citation[];
  relatedDocuments: DocumentListItem[];
  systemMetrics: { cpu_percent: number; memory_percent: number; disk_percent: number } | null;
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
}) {
  const [activityFilter, setActivityFilter] = useState<"all" | ActivityItem["kind"]>("all");
  const [topicSearch, setTopicSearch] = useState("");
  const [topicSort, setTopicSort] = useState<"count" | "label">("count");
  const [clearedAt, setClearedAt] = useState<string>("");
  const filteredActivities = recentActivities.filter(
    (item) => activityFilter === "all" || item.kind === activityFilter,
  );
  const topicRows = [...(queryInsights?.hot_topics ?? [])]
    .filter((item) => item.label.toLowerCase().includes(topicSearch.trim().toLowerCase()))
    .sort((a, b) => (topicSort === "count" ? b.count - a.count : a.label.localeCompare(b.label)));

  if (currentView === "qa") {
    return (
      <div className="context-stack">
        <SidebarCard title="来源引用" subtitle="当前回答使用的片段">
          <div className="source-preview-list compact-list">
            {citations.length ? (
              citations.map((citation) => (
                <div key={`${citation.document_id}-${citation.chunk_id}`} className="source-preview-card">
                  <strong>{citation.document_title}</strong>
                  <span>片段 {citation.chunk_id}</span>
                  <p>{citation.content_preview}</p>
                  <a
                    className="table-button link-button"
                    href={getDocumentDownloadUrl(citation.document_id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开原文
                  </a>
                </div>
              ))
            ) : (
              <EmptyBlock title="暂无引用" description="发起提问后，这里会展示本轮回答引用的文档片段。" />
            )}
          </div>
        </SidebarCard>

        <SidebarCard title="相关文档" subtitle="当前问答命中的文档">
          <div className="compact-list">
            {relatedDocuments.length ? (
              relatedDocuments.map((document) => (
                <div key={document.document_id} className="mini-metric">
                  <strong>{document.title}</strong>
                  <span>{document.metadata.category || document.source}</span>
                  <small>{document.metadata.folder_path || "根目录"}</small>
                </div>
              ))
            ) : (
              <EmptyBlock title="暂无相关文档" description="等待首次检索结果。" />
            )}
          </div>
        </SidebarCard>
      </div>
    );
  }

  if (currentView === "maintenance") {
    return (
      <div className="context-stack">
        <SidebarCard title="性能指标" subtitle="响应时间与资源使用情况">
          <div className="mini-stats">
            <MetricMini label="CPU" value={`${systemMetrics?.cpu_percent ?? 0}%`} hint="实时使用率" />
            <MetricMini label="内存" value={`${systemMetrics?.memory_percent ?? 0}%`} hint="实时使用率" />
            <MetricMini label="磁盘" value={`${systemMetrics?.disk_percent ?? 0}%`} hint="实时使用率" />
          </div>
        </SidebarCard>

        <SidebarCard title="文档关系" subtitle="文档间关系的图形展示">
          <MiniGraph nodes={graphNodes} edges={graphEdges} />
        </SidebarCard>
      </div>
    );
  }

  return (
    <div className="context-stack">
      <SidebarCard title="最近活动" subtitle="次要动态已移动到右侧栏">
        <div className="sidebar-tools">
          <select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value as "all" | ActivityItem["kind"])}>
            <option value="all">全部类型</option>
            <option value="upload">上传</option>
            <option value="sync">同步</option>
            <option value="query">问答</option>
            <option value="delete">删除</option>
            <option value="maintenance">维护</option>
          </select>
          <button
            type="button"
            className="table-button"
            onClick={() => {
              setClearedAt(new Date().toISOString());
            }}
          >
            清空记录
          </button>
        </div>
        {clearedAt ? <div className="helper-copy">本地显示已清空：{formatDateTime(clearedAt)}</div> : null}
        <div className="activity-list compact-list">
          {filteredActivities.length ? (
            filteredActivities.map((item) => <ActivityRow key={item.id} item={item} />)
          ) : (
            <EmptyBlock title="暂无活动" description="上传、同步和问答后，这里会出现真实操作时间线。" />
          )}
        </div>
      </SidebarCard>

      <SidebarCard title="热门主题" subtitle="查询频率与文档热度">
        <div className="sidebar-tools">
          <input placeholder="搜索主题" value={topicSearch} onChange={(event) => setTopicSearch(event.target.value)} />
          <button type="button" className="table-button" onClick={() => setTopicSort(topicSort === "count" ? "label" : "count")}>
            {topicSort === "count" ? "按字母" : "按频率"}
          </button>
        </div>
        <div className="bars-list compact-list">
          <BarsBlock title="主题" items={topicRows} variant="line" />
          <BarsBlock title="文档" items={queryInsights?.hot_documents ?? []} />
          <BarsBlock title="模式" items={queryInsights?.retrieval_modes ?? []} />
        </div>
      </SidebarCard>
    </div>
  );
}

function CollapsibleCard({
  title,
  subtitle,
  collapsed,
  onToggle,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`content-card ${className}`.trim()}>
      <div className="card-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <button type="button" className="panel-toggle" onClick={onToggle}>
          {collapsed ? "展开" : "折叠"}
        </button>
      </div>
      {!collapsed ? children : null}
    </section>
  );
}

function SidebarCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="context-card">
      <div className="card-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function StatusCard({
  appStatus,
  dbStatus,
  appVersion,
  modeLabel,
  lastUpdatedAt,
}: {
  appStatus: string;
  dbStatus: string;
  appVersion: string;
  modeLabel: string;
  lastUpdatedAt: string;
}) {
  const appOk = isOkStatus(appStatus);
  const dbOk = isOkStatus(dbStatus);
  return (
    <div className="status-card">
      <div className="status-card-head">
        <span className="status-card-title">状态</span>
        <span className="status-pill status-pill-neutral">私有</span>
      </div>
      <div className="status-line">
        <span className={`status-dot ${appOk ? "status-dot-ok" : "status-dot-fail"}`} />
        <span>应用 {appStatus}</span>
      </div>
      <div className="status-line">
        <span className={`status-dot ${dbOk ? "status-dot-ok" : "status-dot-fail"}`} />
        <span>数据库 {dbStatus}</span>
      </div>
      <div className="status-line">
        <span className="status-dot status-dot-ok" />
        <span>{modeLabel}</span>
      </div>
      <div className="status-meta">
        <span>版本 v{appVersion}</span>
        <span>最后更新 {formatDateTime(lastUpdatedAt)}</span>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  trend,
  actionLabel,
  onAction,
}: {
  icon: string;
  label: string;
  value: string;
  hint: string;
  trend: "up" | "down" | "stable";
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-icon">{icon}</span>
        <span className={`trend-pill trend-${trend}`}>{trend === "up" ? "↑" : trend === "down" ? "↓" : "—"}</span>
      </div>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{hint}</small>
      <button type="button" className="table-button stat-action" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}

function MetricMini({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="mini-metric">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{hint}</small>
    </div>
  );
}

function DonutChart({ items }: { items: CategoryStat[] }) {
  if (!items.length) {
    return <EmptyBlock title="暂无图表" description="分类数据不足时不显示环形图。" />;
  }
  const total = items.reduce((sum, item) => sum + item.count, 0);
  let offset = 0;
  const stops = items
    .slice(0, 6)
    .map((item, index) => {
      const color = ["#c96c30", "#398774", "#6c78d2", "#d18054", "#4e9ab7", "#8c6bcc"][index];
      const start = offset;
      const ratio = item.count / total;
      offset += ratio * 100;
      return `${color} ${start}% ${offset}%`;
    })
    .join(", ");

  return (
    <div className="donut-wrap">
      <div className="donut-chart" style={{ background: `conic-gradient(${stops})` }}>
        <div className="donut-core">
          <strong>{total}</strong>
          <span>文档</span>
        </div>
      </div>
    </div>
  );
}

function BarsBlock({ title, items, variant = "bar" }: { title: string; items: BarsItem[]; variant?: "bar" | "line" | "pie" }) {
  const max = items[0]?.count ?? 1;
  return (
    <div className="bars-block">
      <strong>{title}</strong>
      {items.length ? (
        items.map((item) => (
          <div key={`${title}-${item.label}`} className="bar-row">
            <span>{item.label}</span>
            <div className={`bar-track bar-track-${variant}`}>
              <div className="bar-fill" style={{ width: `${toPercent(item.count, max)}%` }} />
            </div>
            <strong>{item.count}</strong>
          </div>
        ))
      ) : (
        <EmptyBlock title="暂无数据" description="等待真实查询行为后生成统计。" />
      )}
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <article className="activity-row">
      <span className={`activity-dot activity-dot-${item.kind}`} />
      <div className="activity-copy">
        <strong>{item.text}</strong>
        <span>{formatDateTime(item.createdAt)}</span>
      </div>
    </article>
  );
}

function isOkStatus(value: string) {
  return /ok|正常|healthy|ready/i.test(value);
}

function MiniGraph({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  if (!nodes.length) {
    return <EmptyBlock title="暂无关系图" description="文档关系生成后，这里会展示图形化结果。" />;
  }

  const viewNodes = nodes.slice(0, 6).map((node, index) => ({
    ...node,
    x: 48 + (index % 3) * 92,
    y: 56 + Math.floor(index / 3) * 86,
  }));
  const nodeMap = new Map(viewNodes.map((node) => [node.id, node]));
  const viewEdges = edges.filter((edge) => nodeMap.has(edge.source) && nodeMap.has(edge.target)).slice(0, 8);

  return (
    <svg className="mini-graph" viewBox="0 0 320 220" role="img" aria-label="document graph">
      {viewEdges.map((edge, index) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) {
          return null;
        }
        return (
          <line
            key={`${edge.source}-${edge.target}-${index}`}
            className="mini-graph-edge"
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
          />
        );
      })}
      {viewNodes.map((node) => (
        <g key={node.id} className="mini-graph-node" transform={`translate(${node.x}, ${node.y})`}>
          <circle r={24} />
          <text textAnchor="middle" dy="4">
            {node.title.slice(0, 4)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-block">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  visual,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  visual: "donut" | "bars";
}) {
  return (
    <div className="empty-state">
      <div className={`empty-visual empty-visual-${visual}`} aria-hidden="true">
        {visual === "bars" ? (
          <>
            <span />
            <span />
            <span />
          </>
        ) : null}
      </div>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <button type="button" className="cta-button cta-button-small" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}

function buildFolders(documents: DocumentListItem[]) {
  const counts = new Map<string, number>();
  counts.set(ROOT_FOLDER_KEY, documents.length);
  for (const document of documents) {
    const path = document.metadata.folder_path?.trim() || "根目录";
    counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([path, count]) => ({
      key: path === ROOT_FOLDER_KEY ? ROOT_FOLDER_KEY : path,
      path,
      name: path === ROOT_FOLDER_KEY ? "全部目录" : path,
      count,
    }))
    .sort((left, right) => {
      if (left.key === ROOT_FOLDER_KEY) {
        return -1;
      }
      if (right.key === ROOT_FOLDER_KEY) {
        return 1;
      }
      return right.count - left.count || left.name.localeCompare(right.name);
    });
}

function filterDocumentsByFolder(documents: DocumentListItem[], folderFilter: string, dashboardQuery: string) {
  const keyword = dashboardQuery.trim().toLowerCase();
  return documents.filter((document) => {
    const folderPath = document.metadata.folder_path?.trim() || "根目录";
    const folderMatch = folderFilter === ROOT_FOLDER_KEY || folderPath === folderFilter;
    if (!folderMatch) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    const searchTargets = [
      document.title,
      document.document_id,
      document.metadata.file_name ?? "",
      folderPath,
      document.metadata.category ?? "",
    ];
    return searchTargets.some((item) => item.toLowerCase().includes(keyword));
  });
}

function toPercent(value: number, total: number) {
  if (!total) {
    return 0;
  }
  return Math.max(8, Math.round((value / total) * 100));
}

function hasQueryInsightData(
  queryInsights: {
    query_frequency: BarsItem[];
    hot_topics: BarsItem[];
    hot_documents: BarsItem[];
    retrieval_modes: BarsItem[];
  } | null,
) {
  if (!queryInsights) {
    return false;
  }
  return (
    queryInsights.query_frequency.length > 0 ||
    queryInsights.hot_topics.length > 0 ||
    queryInsights.hot_documents.length > 0 ||
    queryInsights.retrieval_modes.length > 0
  );
}

function currentViewLabel(view: AppView) {
  return NAV_ITEMS.find((item) => item.id === view)?.label ?? "工作台";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
