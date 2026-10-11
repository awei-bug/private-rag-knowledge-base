from fastapi.testclient import TestClient

from app.main import create_app


def create_client() -> TestClient:
    return TestClient(create_app())


def test_query_accepts_retrieval_mode() -> None:
    client = create_client()

    response = client.post(
        "/api/v1/query",
        json={
            "question": "What is RAG?",
            "filters": {},
            "retrieval_mode": "semantic",
        },
    )

    assert response.status_code == 200


def test_local_mode_allows_log_read_access() -> None:
    client = create_client()

    response = client.get("/api/v1/query/logs")

    assert response.status_code == 200


def test_retrieval_modes_change_debug_ranking() -> None:
    client = create_client()
    reset = client.put(
        "/config/preferences",
        json={
            "default_folder_path": "F:/Python_code/RAG 本地知识库问系统/examples/knowledge-base",
            "default_retrieval_mode": "hybrid",
            "top_k": 5,
            "preferred_runtime_mode": "local",
        },
    )
    assert reset.status_code == 200

    first_doc = client.post(
        "/api/v1/documents/ingest",
        json={
            "document_id": "lexical-doc",
            "title": "Lexical Doc",
            "source": "tech",
            "content": "rag retrieval pipeline lexical lexical lexical exact terms",
            "acl": [],
            "metadata": {"category": "技术文档"},
        },
    )
    second_doc = client.post(
        "/api/v1/documents/ingest",
        json={
            "document_id": "semantic-doc",
            "title": "Semantic Doc",
            "source": "notes",
            "content": "knowledge retrieval uses related concepts and embeddings for matching",
            "acl": [],
            "metadata": {"category": "个人笔记"},
        },
    )
    assert first_doc.status_code == 201
    assert second_doc.status_code == 201

    precise = client.post(
        "/api/v1/query/debug?limit=5",
        json={"question": "lexical exact terms", "filters": {}, "retrieval_mode": "precise"},
    )
    semantic = client.post(
        "/api/v1/query/debug?limit=5",
        json={"question": "lexical exact terms", "filters": {}, "retrieval_mode": "semantic"},
    )

    assert precise.status_code == 200
    assert semantic.status_code == 200
    assert precise.json()["chunks"]
    assert semantic.json()["chunks"]
    precise_score = next(
        chunk["score"] for chunk in precise.json()["chunks"] if chunk["document_id"] == "lexical-doc"
    )
    semantic_score = next(
        chunk["score"] for chunk in semantic.json()["chunks"] if chunk["document_id"] == "lexical-doc"
    )
    assert precise_score > semantic_score


def test_query_debug_respects_rewrite_toggle_and_top_k_override() -> None:
    client = create_client()

    saved = client.put(
        "/config/preferences",
        json={
            "default_folder_path": "F:/Python_code/RAG 本地知识库问系统/examples/knowledge-base",
            "default_retrieval_mode": "hybrid",
            "top_k": 1,
            "preferred_runtime_mode": "local",
            "query_rewrite_enabled": False,
            "lexical_weight": 0.7,
            "semantic_weight": 0.3,
        },
    )
    assert saved.status_code == 200

    doc = client.post(
        "/api/v1/documents/ingest",
        json={
            "document_id": "rewrite-toggle-doc",
            "title": "Rewrite Toggle Doc",
            "source": "settings",
            "content": "RAG rewrite toggle exact phrase",
            "acl": [],
            "metadata": {"category": "settings"},
        },
    )
    assert doc.status_code == 201

    debug = client.post(
        "/api/v1/query/debug?limit=5",
        json={"question": "RAG", "filters": {}, "retrieval_mode": "hybrid"},
    )

    assert debug.status_code == 200
    body = debug.json()
    assert body["rewritten_query"] == "RAG"
    assert len(body["chunks"]) == 1


def test_query_request_can_override_rewrite_toggle_and_top_k() -> None:
    client = create_client()

    saved = client.put(
        "/config/preferences",
        json={
            "default_folder_path": "F:/Python_code/RAG 本地知识库问系统/examples/knowledge-base",
            "default_retrieval_mode": "hybrid",
            "top_k": 1,
            "preferred_runtime_mode": "local",
            "query_rewrite_enabled": True,
            "lexical_weight": 0.6,
            "semantic_weight": 0.4,
        },
    )
    assert saved.status_code == 200

    for index in range(3):
        response = client.post(
            "/api/v1/documents/ingest",
            json={
                "document_id": f"query-override-{index}",
                "title": f"Override Doc {index}",
                "source": "override-test",
                "content": f"RAG override test content {index}",
                "acl": [],
                "metadata": {"category": "override", "folder_path": "qa/overrides"},
            },
        )
        assert response.status_code == 201

    debug = client.post(
        "/api/v1/query/debug?limit=10",
        json={
            "question": "RAG",
            "filters": {"category": "override", "folder_path": "qa/overrides"},
            "retrieval_mode": "hybrid",
            "query_rewrite_enabled": False,
            "top_k": 3,
        },
    )

    assert debug.status_code == 200
    body = debug.json()
    assert body["rewritten_query"] == "RAG"
    assert len(body["chunks"]) == 3
