from __future__ import annotations

from typing import Protocol
import re

from openai import OpenAI

from app.retrieval.types import RetrievedChunk


class LLMProvider(Protocol):
    def generate(self, question: str, chunks: list[RetrievedChunk]) -> str:
        ...


class TemplateLLMProvider:
    def generate(self, question: str, chunks: list[RetrievedChunk]) -> str:
        if not chunks:
            return "未找到足够证据支持回答，请补充更具体的问题或先导入相关文档。"

        question_terms = {term.lower() for term in re.findall(r"\w+", question)}
        evidence_lines: list[str] = []
        for chunk in chunks[:3]:
            sentence = self._best_sentence(chunk.content, question_terms)
            evidence_lines.append(f"- 《{chunk.document_title}》：{sentence}")

        return (
            f"基于知识库中命中的 {len(chunks)} 个片段，问题“{question}”可从以下证据回答：\n"
            + "\n".join(evidence_lines)
            + "\n\n如果需要更完整的自然语言归纳，建议在设置中切换到 OpenAI 兼容 LLM。"
        )

    def _best_sentence(self, content: str, question_terms: set[str]) -> str:
        sentences = [item.strip() for item in re.split(r"(?<=[。！？.!?])\s+|\n+", content) if item.strip()]
        if not sentences:
            return content[:240]
        ranked = sorted(
            sentences,
            key=lambda sentence: sum(1 for term in question_terms if term and term in sentence.lower()),
            reverse=True,
        )
        return ranked[0][:240]


class OpenAICompatibleLLMProvider:
    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str | None = None,
        timeout: float = 60.0,
        temperature: float = 0.2,
    ) -> None:
        self.model = model
        self.temperature = temperature
        self.client = OpenAI(api_key=api_key, base_url=base_url, timeout=timeout)

    def generate(self, question: str, chunks: list[RetrievedChunk]) -> str:
        if not chunks:
            return "未找到足够证据支持回答，请补充更具体的问题或先导入相关文档。"

        context = "\n\n".join(
            [
                f"[{index}] 文档：{chunk.document_title}\n片段：{chunk.content}"
                for index, chunk in enumerate(chunks, start=1)
            ]
        )
        response = self.client.chat.completions.create(
            model=self.model,
            temperature=self.temperature,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你是企业知识库问答助手。必须基于给定证据回答；"
                        "如果证据不足，明确说明无法从知识库确认。回答要简洁，并保留关键事实。"
                    ),
                },
                {
                    "role": "user",
                    "content": f"问题：{question}\n\n证据：\n{context}",
                },
            ],
        )
        content = response.choices[0].message.content
        return content.strip() if content else "模型未返回有效答案。"


def create_llm_provider(
    provider: str,
    model: str,
    api_key: str | None,
    base_url: str | None,
    timeout: float,
    temperature: float,
) -> LLMProvider:
    normalized_provider = provider.strip().lower()
    if normalized_provider in {"template", "mock"}:
        return TemplateLLMProvider()
    if normalized_provider in {"openai", "openai-compatible"}:
        if not api_key:
            raise ValueError("RAG_LLM_API_KEY is required for OpenAI-compatible LLM generation.")
        return OpenAICompatibleLLMProvider(
            api_key=api_key,
            model=model,
            base_url=base_url,
            timeout=timeout,
            temperature=temperature,
        )
    raise ValueError(f"Unsupported LLM provider: {provider}")
