from __future__ import annotations

from typing import Protocol

import httpx

from app.core.config import get_settings
from app.models.document import DocumentResponse


class FullTextSearch(Protocol):
    def index_document(self, document: DocumentResponse) -> None:
        ...

    def delete_document(self, document_id: str) -> None:
        ...

    def search(self, query: str, limit: int) -> dict[str, float]:
        ...


class NoopFullTextSearch:
    def index_document(self, document: DocumentResponse) -> None:
        return None

    def delete_document(self, document_id: str) -> None:
        return None

    def search(self, query: str, limit: int) -> dict[str, float]:
        return {}


class OpenSearchFullTextSearch:
    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.opensearch_url.rstrip("/")
        self.index = settings.opensearch_index
        self.timeout = settings.opensearch_timeout

    def index_document(self, document: DocumentResponse) -> None:
        self._ensure_index()
        with httpx.Client(timeout=self.timeout) as client:
            for chunk in document.chunks:
                payload = {
                    "document_id": document.document_id,
                    "document_title": document.title,
                    "chunk_id": chunk.chunk_id,
                    "content": chunk.content,
                    "metadata": chunk.metadata,
                    "acl": chunk.acl or document.acl,
                }
                url = f"{self.base_url}/{self.index}/_doc/{chunk.chunk_id}"
                client.put(url, json=payload).raise_for_status()

    def delete_document(self, document_id: str) -> None:
        payload = {"query": {"term": {"document_id.keyword": document_id}}}
        url = f"{self.base_url}/{self.index}/_delete_by_query"
        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(url, json=payload)
            if response.status_code != 404:
                response.raise_for_status()

    def search(self, query: str, limit: int) -> dict[str, float]:
        payload = {
            "size": limit,
            "query": {
                "multi_match": {
                    "query": query,
                    "fields": ["content^3", "document_title^2"],
                }
            },
        }
        url = f"{self.base_url}/{self.index}/_search"
        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(url, json=payload)
            if response.status_code == 404:
                return {}
            response.raise_for_status()
            data = response.json()

        hits = data.get("hits", {}).get("hits", [])
        max_score = max((float(hit.get("_score") or 0.0) for hit in hits), default=0.0)
        if max_score <= 0:
            return {}
        return {
            hit["_source"]["chunk_id"]: float(hit.get("_score") or 0.0) / max_score
            for hit in hits
            if hit.get("_source", {}).get("chunk_id")
        }

    def _ensure_index(self) -> None:
        url = f"{self.base_url}/{self.index}"
        mapping = {
            "mappings": {
                "properties": {
                    "document_id": {"type": "keyword"},
                    "document_title": {"type": "text"},
                    "chunk_id": {"type": "keyword"},
                    "content": {"type": "text"},
                    "metadata": {"type": "object", "enabled": True},
                    "acl": {"type": "keyword"},
                }
            }
        }
        with httpx.Client(timeout=self.timeout) as client:
            response = client.head(url)
            if response.status_code == 404:
                client.put(url, json=mapping).raise_for_status()
            elif response.status_code >= 400:
                response.raise_for_status()


def create_full_text_search() -> FullTextSearch:
    settings = get_settings()
    if not settings.opensearch_enabled:
        return NoopFullTextSearch()
    return OpenSearchFullTextSearch()
