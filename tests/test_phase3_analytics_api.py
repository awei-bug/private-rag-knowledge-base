from fastapi.testclient import TestClient

from app.db.session import init_db
from app.main import create_app


def create_client() -> TestClient:
    init_db()
    return TestClient(create_app())


def test_analytics_overview_returns_real_metrics() -> None:
    client = create_client()

    response = client.get("/analytics/overview")

    assert response.status_code == 200
    body = response.json()
    assert "document_count" in body
    assert "chunk_count" in body


def test_document_graph_contains_explainable_edges() -> None:
    client = create_client()

    left = client.post(
        "/api/v1/documents/ingest",
        json={
            "document_id": "graph-doc-left",
            "title": "Graph Left",
            "source": "engineering",
            "content": "retrieval graph shared term alpha",
            "acl": [],
            "metadata": {"category": "技术文档"},
        },
    )
    right = client.post(
        "/api/v1/documents/ingest",
        json={
            "document_id": "graph-doc-right",
            "title": "Graph Right",
            "source": "engineering",
            "content": "retrieval graph shared term beta",
            "acl": [],
            "metadata": {"category": "技术文档"},
        },
    )
    assert left.status_code == 201
    assert right.status_code == 201

    response = client.get("/analytics/document-graph")

    assert response.status_code == 200
    body = response.json()
    assert body["nodes"]
    assert body["edges"]
    assert any(edge["reason"] in {"same_category", "same_source", "shared_keywords"} for edge in body["edges"])
