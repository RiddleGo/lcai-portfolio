# 云端触发（开发者可选）

日常使用 **Issue 方式** 即可，见选股页说明。本目录仅供将来自建 Worker 时参考，**不必配置**。

- 单票：`[report] 代码` Issue（收藏新票）
- 全量：`[weekly] refresh` Issue（立即更新全部深度分析）
- 自动：每周一 Actions

若需无 Submit 的一键触发，可自行部署 [`trigger-report.mjs`](trigger-report.mjs) 到 Cloudflare Worker 并配置 GitHub PAT（较繁琐，一般不必）。
