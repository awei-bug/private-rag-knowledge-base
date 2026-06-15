# RAG 系统架构摘要

当前系统由四部分组成：

1. 文档接入层：负责解析 Markdown、TXT、PDF、Word、Excel 等文件。
2. 索引与存储层：负责切块、embedding、PostgreSQL 持久化以及可选 OpenSearch 索引。
3. 检索与生成层：负责 hybrid retrieval、ACL 过滤、重排和基于证据的回答生成。
4. 控制台层：负责文档管理、问答调试、日志审计和系统巡检。

如果数据库未启用 pgvector，系统会自动退化到 JSON 向量加 Python 相似度计算，仍然可以完成本地开发和联调。
