from collections import Counter
from pathlib import Path
import shutil

import psutil

from app.ingestion.store import SqlAuditStore, SqlDocumentStore
from app.models.analytics import (
    AnalyticsOverview,
    DocumentGraphResponse,
    GraphEdge,
    GraphNode,
    QueryInsightsResponse,
    SystemMetricsResponse,
    TopicStat,
)


class AnalyticsService:
    def __init__(self, document_store: SqlDocumentStore, audit_store: SqlAuditStore) -> None:
        self.document_store = document_store
        self.audit_store = audit_store

    def get_overview(self) -> AnalyticsOverview:
        documents = self.document_store.list_documents()
        logs = self.audit_store.list_logs(limit=500)
        chunk_count = sum(len(document.chunks) for document in documents)
        average_latency = sum(log.latency_ms for log in logs) / len(logs) if logs else 0.0
        return AnalyticsOverview(
            document_count=len(documents),
            chunk_count=chunk_count,
            query_count=len(logs),
            average_latency_ms=round(average_latency, 2),
        )

    def get_document_graph(self) -> DocumentGraphResponse:
        documents = self.document_store.list_documents()
        nodes = [
            GraphNode(
                id=document.document_id,
                title=document.title,
                category=document.metadata.get("category") or "未分类",
                source=document.source,
                size=max(len(document.chunks), 1),
            )
            for document in documents
        ]

        edges: list[GraphEdge] = []
        for index, left in enumerate(documents):
            left_category = left.metadata.get("category") or ""
            left_keywords = set((left.title + " " + left.source).lower().split())
            for right in documents[index + 1 :]:
                right_category = right.metadata.get("category") or ""
                right_keywords = set((right.title + " " + right.source).lower().split())
                if left_category and left_category == right_category:
                    edges.append(
                        GraphEdge(
                            source=left.document_id,
                            target=right.document_id,
                            reason="same_category",
                            weight=1.0,
                        )
                    )
                elif left.source == right.source:
                    edges.append(
                        GraphEdge(
                            source=left.document_id,
                            target=right.document_id,
                            reason="same_source",
                            weight=0.8,
                        )
                    )
                else:
                    shared_keywords = left_keywords.intersection(right_keywords)
                    if shared_keywords:
                        edges.append(
                            GraphEdge(
                                source=left.document_id,
                                target=right.document_id,
                                reason="shared_keywords",
                                weight=min(0.7, 0.2 + 0.1 * len(shared_keywords)),
                            )
                        )
        return DocumentGraphResponse(nodes=nodes, edges=edges)

    def get_query_insights(self) -> QueryInsightsResponse:
        logs = self.audit_store.list_logs(limit=500)
        query_frequency = Counter()
        hot_topics = Counter()
        hot_documents = Counter()
        retrieval_modes = Counter()

        for log in logs:
            created = log.created_at.isoformat()[:10] if log.created_at else "unknown"
            query_frequency[created] += 1
            for token in log.question.lower().split():
                if len(token) >= 2:
                    hot_topics[token] += 1
            for citation in log.citations:
                hot_documents[citation.document_title] += 1
            retrieval_modes[log.filters.get("retrieval_mode", "hybrid")] += 1

        return QueryInsightsResponse(
            query_frequency=[TopicStat(label=label, count=count) for label, count in query_frequency.most_common(7)],
            hot_topics=[TopicStat(label=label, count=count) for label, count in hot_topics.most_common(8)],
            hot_documents=[TopicStat(label=label, count=count) for label, count in hot_documents.most_common(8)],
            retrieval_modes=[TopicStat(label=label, count=count) for label, count in retrieval_modes.most_common()],
        )

    def get_system_metrics(self) -> SystemMetricsResponse:
        disk = shutil.disk_usage(Path.cwd())
        total = disk.total or 1
        disk_percent = round(disk.used / total * 100, 2)
        cpu_percent = round(psutil.cpu_percent(interval=0.05), 2)
        memory_percent = round(psutil.virtual_memory().percent, 2)
        return SystemMetricsResponse(
            cpu_percent=cpu_percent,
            memory_percent=memory_percent,
            disk_percent=disk_percent,
        )
