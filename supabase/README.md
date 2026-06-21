# Supabase 云同步 · 一次性配置

登录后，健康打卡 / OKR / 决策日记 / 财务勾选 **改完即上云**，换电脑只需 **邮箱 + 密码登录**。

## 1. 创建 Supabase 项目

1. 打开 [supabase.com](https://supabase.com) → New project  
2. 记下 **Project URL** 和 **anon public key**（Settings → API）

## 2. 建表

Dashboard → **SQL Editor** → 粘贴并运行 [`schema.sql`](schema.sql)

## 3. 关闭邮箱验证（个人站推荐）

Authentication → Providers → Email → **Confirm email 关掉**  
这样注册后可直接登录，不用收确认邮件。

## 4. 填写站点配置

编辑仓库根目录 [`supabase-config.js`](../supabase-config.js)：

```javascript
window.SUPABASE_CONFIG = {
  url: "https://你的项目.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6I6...",
};
```

推送到 GitHub Pages 后生效。

## 5. 使用

1. 打开站点 → **数据同步**  
2. **注册**（邮箱 + 密码，仅你自用）  
3. 之后各模块保存自动上传；新设备 **登录** 即恢复  

## 安全说明

- `anonKey` 可公开；数据靠 **Row Level Security** 隔离，每人只能读写自己的行  
- **切勿** 把 `service_role` key 写进前端或提交 git  
- 财务/日记内容存在 Supabase Postgres，不在公开 GitHub 仓库  

## 本地备份

数据同步页仍支持 **导出 / 导入 JSON**，作为额外备份。
