# 网页触发云端研报（Cloudflare Worker）

GitHub Pages 是纯静态站，**无法在浏览器里直接调用 GitHub API**（CORS 限制），也无法运行 UZI 的 Python 流水线。

部署本 Worker 后，可在「选股」页一键触发 Actions 生成研报。

## 部署步骤

1. 注册 [Cloudflare Workers](https://workers.cloudflare.com/)（免费档即可）
2. 创建 Worker，粘贴 [`trigger-report.mjs`](trigger-report.mjs)
3. 设置 **Secrets / Variables**：
   - `GITHUB_TOKEN`：GitHub PAT（`actions:write` + `contents:write`）
   - `TRIGGER_KEY`：自定义密钥（如随机 32 位字符串）
   - `GITHUB_REPO`（可选）：`RiddleGo/lcai-portfolio`
4. 部署后记下 URL，例如 `https://lcai-trigger.xxx.workers.dev`
5. 打开 [资产总览 → 选股](https://riddlego.github.io/lcai-portfolio/资产总览.html#screen)，展开 **云端研报设置**，填入 Worker URL 与密钥

## 不部署 Worker 时

网页仍可用：

- **研判**：浏览器秒级 LCAI 分析（已有）
- **云端生成**：打开 GitHub Actions 手动 Run workflow，本页自动轮询 `reports/` 更新

Actions 地址：<https://github.com/RiddleGo/lcai-portfolio/actions/workflows/uzi-reports.yml>
