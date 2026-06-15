# 员工知识库接入说明

企业内部知识库在导入文档时，建议统一补充以下 metadata：

- `department`
- `owner`
- `updated_at`
- `source_system`

问答系统在检索阶段会优先根据 ACL 和 metadata 过滤，再进行词法召回和向量召回融合。

如果一份文档只允许财务部门访问，可以在文档级 ACL 中设置 `finance`，也可以在 chunk metadata 中设置 `chunk_acl=finance`。
