from __future__ import annotations

import hashlib
import math
import re
from typing import Protocol

from openai import OpenAI


TOKEN_PATTERN = re.compile(r"\w+", re.UNICODE)


class EmbeddingProvider(Protocol):
    dimensions: int

    def embed_text(self, text: str) -> list[float]:
        ...

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        ...

    def cosine_similarity(self, left: list[float], right: list[float]) -> float:
        ...


class BaseEmbeddingProvider:
    dimensions: int

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [self.embed_text(text) for text in texts]

    def cosine_similarity(self, left: list[float], right: list[float]) -> float:
        if not left or not right:
            return 0.0
        return max(sum(a * b for a, b in zip(left, right)), 0.0)


class HashingEmbedder(BaseEmbeddingProvider):
    def __init__(self, dimensions: int = 128) -> None:
        self.dimensions = dimensions

    def embed_text(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        tokens = TOKEN_PATTERN.findall(text.lower())
        if not tokens:
            return vector

        for token in tokens:
            self._accumulate(vector, token, weight=1.0)
            if len(token) >= 3:
                for index in range(len(token) - 2):
                    self._accumulate(vector, token[index : index + 3], weight=0.35)
        return self._normalize(vector)

    def _accumulate(self, vector: list[float], token: str, weight: float) -> None:
        bucket = self._stable_int(token) % self.dimensions
        sign = -1.0 if self._stable_int(f"{token}:sign") % 2 else 1.0
        vector[bucket] += weight * sign

    def _normalize(self, vector: list[float]) -> list[float]:
        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0:
            return vector
        return [value / norm for value in vector]

    def _stable_int(self, value: str) -> int:
        digest = hashlib.sha1(value.encode("utf-8")).digest()
        return int.from_bytes(digest[:8], byteorder="big", signed=False)


class OpenAICompatibleEmbedder(BaseEmbeddingProvider):
    def __init__(
        self,
        api_key: str,
        model: str,
        dimensions: int,
        base_url: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        self.dimensions = dimensions
        self.model = model
        self.client = OpenAI(api_key=api_key, base_url=base_url, timeout=timeout)

    def embed_text(self, text: str) -> list[float]:
        return self.embed_texts([text])[0]

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        response = self.client.embeddings.create(
            model=self.model,
            input=texts,
            dimensions=self.dimensions,
        )
        return [self._normalize(list(item.embedding)) for item in response.data]

    def _normalize(self, vector: list[float]) -> list[float]:
        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0:
            return vector
        return [value / norm for value in vector]


def create_embedder(
    provider: str,
    dimensions: int,
    model: str,
    api_key: str | None,
    base_url: str | None,
    timeout: float,
) -> EmbeddingProvider:
    normalized_provider = provider.strip().lower()
    if normalized_provider == "hashing":
        return HashingEmbedder(dimensions=dimensions)
    if normalized_provider in {"openai", "openai-compatible"}:
        if not api_key:
            raise ValueError("RAG_EMBEDDING_API_KEY is required for OpenAI-compatible embeddings.")
        return OpenAICompatibleEmbedder(
            api_key=api_key,
            model=model,
            dimensions=dimensions,
            base_url=base_url,
            timeout=timeout,
        )
    raise ValueError(f"Unsupported embedding provider: {provider}")
