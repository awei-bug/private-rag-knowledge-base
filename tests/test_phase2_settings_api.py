from fastapi.testclient import TestClient

from app.db.session import init_db
from app.main import create_app


def create_client() -> TestClient:
    init_db()
    return TestClient(create_app())


def test_update_preferences_persists_values() -> None:
    client = create_client()

    response = client.put(
        "/config/preferences",
        json={
            "default_folder_path": "F:/kb",
            "default_retrieval_mode": "semantic",
            "top_k": 8,
            "preferred_runtime_mode": "api",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["preferences"]["top_k"] == 8
    assert body["preferences"]["default_folder_path"] == "F:/kb"


def test_top_k_preference_limits_query_results() -> None:
    client = create_client()

    for index in range(3):
        response = client.post(
            "/api/v1/documents/ingest",
            json={
                "document_id": f"settings-doc-{index}",
                "title": f"Settings Doc {index}",
                "source": "settings-test",
                "content": f"rag retrieval settings document {index}",
                "acl": [],
                "metadata": {},
            },
        )
        assert response.status_code == 201

    saved = client.put(
        "/config/preferences",
        json={
            "default_folder_path": "F:/kb",
            "default_retrieval_mode": "hybrid",
            "top_k": 1,
            "preferred_runtime_mode": "local",
        },
    )
    assert saved.status_code == 200

    debug = client.post(
        "/api/v1/query/debug?limit=10",
        json={"question": "rag retrieval settings", "filters": {}, "retrieval_mode": "hybrid"},
    )

    assert debug.status_code == 200
    assert len(debug.json()["chunks"]) == 1
