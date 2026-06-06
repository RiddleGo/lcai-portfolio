# Cloudflare Worker + GitHub 一键触发 Actions

配置完成后，选股页点 **「🔄 立即更新全部深度分析」** 或收藏新票时，**不用再开 Issue、不用再点 Submit**。

---

## 原理（一句话）

网页不能直接调 GitHub API（无令牌 + CORS）。  
你在 Cloudflare 上放一个小程序（Worker），里面存 **GitHub 令牌**；网页只带 **你自己设的密钥** 去敲 Worker，Worker 再替你去启动 Actions。

```
浏览器 ──POST+密钥──▶ Cloudflare Worker ──PAT──▶ GitHub Actions
```

---

## 第一步：创建 GitHub 令牌（PAT）

1. 打开 [GitHub → Settings → Developer settings → Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. **Generate new token**
3. 设置：
   - **Token name**：例如 `lcai-worker-trigger`
   - **Expiration**：建议 90 天或 Custom，到期前记得续
   - **Repository access**：Only select repositories → 选 **`lcai-portfolio`**
   - **Permissions**（仅这一仓库）：
     - **Actions**：Read and write
     - **Contents**：Read and write（Actions 跑完要 push `reports/`）
4. 生成后 **复制 token**（只显示一次，妥善保存）

> 经典 PAT（classic）也可以：勾选 `repo` + `workflow`  scope，权限更大，不如 fine-grained 安全。

---

## 第二步：部署 Cloudflare Worker

### 2.1 注册 / 登录

打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → 左侧 **Workers & Pages**。

### 2.2 创建 Worker

1. **Create** → **Create Worker**
2. 名称随意，例如 `lcai-trigger`
3. 在代码编辑器里 **删掉默认代码**，粘贴本仓库 [`trigger-report.mjs`](trigger-report.mjs) 全部内容
4. **Deploy**

### 2.3 配置 Secrets（重要）

进入该 Worker → **Settings** → **Variables and Secrets** → **Add**

| 名称 | 类型 | 值 |
|------|------|-----|
| `GITHUB_TOKEN` | **Secret** | 第一步复制的 PAT |
| `TRIGGER_KEY` | **Secret** | 自设一长串随机字符，例如用密码生成器 32 位 |
| `GITHUB_REPO` | Text（可选） | `RiddleGo/lcai-portfolio`，默认已是这个可省略 |

**Save** 后建议再 **Deploy** 一次（部分账号改 Secret 需重新部署）。

### 2.4 记下 Worker 地址

部署成功后地址类似：

`https://lcai-trigger.你的子域.workers.dev`

复制完整 URL，不要带路径。

---

## 第三步：在 LCAI 网页里填配置

1. 打开 [资产总览 · 选股](https://riddlego.github.io/lcai-portfolio/资产总览.html#screen)
2. 展开 **「高级：Worker 一键触发（可选）」**
3. 填入：
   - **Worker 地址**：上一步的 `https://….workers.dev`
   - **触发密钥**：与 Worker 里 `TRIGGER_KEY` **完全一致**
4. 点 **保存**

配置存在你浏览器 **localStorage**，不会进 GitHub 仓库。

---

## 第四步：验证

1. 点 **「🔄 立即更新全部深度分析」**
2. 若成功，顶部提示：**「已通过 Worker 触发 Actions…」**（不再打开 GitHub Issue 页）
3. 打开仓库 [Actions → Generate UZI reports](https://github.com/RiddleGo/lcai-portfolio/actions/workflows/uzi-reports.yml)，应看到新跑的任务
4. 约 **30–60 分钟** 后刷新选股页，「查看 UZI 完整 HTML」在 UZI 就绪后可点

### 单票触发

收藏 **新票** 时，若已配置 Worker，也会优先走 Worker（传股票代码），不再开 Issue。

---

## 故障排查

| 现象 | 可能原因 |
|------|----------|
| `Unauthorized` | 网页里的密钥与 Worker `TRIGGER_KEY` 不一致 |
| `GITHUB_TOKEN not configured` | Worker 未设 Secret 或未 Redeploy |
| `404` / `Not Found` | PAT 无 Actions 权限，或仓库名写错 |
| `422` workflow | 工作流文件名变了；Worker 里 `WORKFLOW` 应为 `uzi-reports.yml` |
| 浏览器仍打开 Issue | Worker 未保存或 URL 填错，会自动 **回退 Issue 方式** |

---

## 安全说明

- **PAT 只放在 Cloudflare Secret**，切勿写进网页、切勿提交 GitHub
- **TRIGGER_KEY** 相当于 Worker 大门的钥匙；别公开分享
- Worker 代码是公开的，安全靠 **密钥 + PAT 在服务端**
- PAT 泄露后立即在 GitHub 撤销并换新

---

## 与 Issue 方式对比

| | Issue + Submit | Worker + PAT |
|--|----------------|--------------|
| 点击次数 | 2 次 | 1 次 |
| 需要 PAT | 否 | 是（放 Cloudflare） |
| 适合 | 偶尔用 | 经常手动全量更新 |

未配置 Worker 时，系统自动用 Issue 方式，不影响使用。
