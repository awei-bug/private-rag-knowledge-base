from pydantic import BaseModel, Field


class AnalyticsOverview(BaseModel):
    document_count: int
    chunk_count: int
    query_count: int
    average_latency_ms: float


class GraphNode(BaseModel):
    id: str
    title: str
    category: str
    source: str
    size: int


class GraphEdge(BaseModel):
    source: str
    target: str
    reason: str
    weight: float


class DocumentGraphResponse(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)


class TopicStat(BaseModel):
    label: str
    count: int


class QueryInsightsResponse(BaseModel):
    query_frequency: list[TopicStat] = Field(default_factory=list)
    hot_topics: list[TopicStat] = Field(default_factory=list)
    hot_documents: list[TopicStat] = Field(default_factory=list)
    retrieval_modes: list[TopicStat] = Field(default_factory=list)


class SystemMetricsResponse(BaseModel):
    cpu_percent: float
    memory_percent: float
    disk_percent: float
