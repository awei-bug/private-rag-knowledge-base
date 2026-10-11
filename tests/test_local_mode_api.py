from fastapi.testclient import TestClient

from app.main import create_app


def create_client() -> TestClient:
    return TestClient(create_app())


def test_local_mode_allows_documents_without_auth() -> None:
    client = create_client()

    response = client.get("/api/v1/documents")

    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_config_reports_local_mode() -> None:
    client = create_client()

    response = client.get("/config")

    assert response.status_code == 200
    assert response.json()["runtime_mode"] == "local"


def test_query_returns_citation_preview() -> None:
    client = create_client()

    ingest_response = client.post(
        "/api/v1/documents/ingest",
        json={
            "document_id": "local-doc",
            "title": "Local Knowledge",
            "source": "test",
            "content": "Local RAG systems answer questions from indexed files on the current machine.",
            "acl": [],
            "metadata": {},
        },
    )
    assert ingest_response.status_code == 201

    response = client.post(
        "/api/v1/query",
        json={"question": "How does local RAG answer questions?", "filters": {}},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["citations"]
    assert "content_preview" in body["citations"][0]
