# 🔥 EmberBooks

個人記帳系統 — 簡單、直覺、自架。

## 技術棧

- **前端**：React 19 + TypeScript + Vite
- **後端**：Node.js + Express + TypeScript
- **資料庫**：MongoDB 7 + Mongoose
- **架構**：pnpm monorepo

## 專案結構

```
EmberBooks/
├── packages/
│   ├── shared/      # 共用型別與常數
│   ├── server/      # Express API server
│   └── client/      # React 前端
├── docker/          # 生產環境 Docker 設定
├── .devcontainer/   # VS Code Dev Container
└── skills/          # AI 輔助功能
```

## 開發

### 前置需求
- Node.js 22+
- pnpm 9+
- MongoDB 7+（或使用 Dev Container）

### 快速開始

```bash
# 安裝依賴
pnpm install

# 啟動開發環境
pnpm dev

# 建構
pnpm build
```

### Dev Container

使用 VS Code Dev Container 可自動設定 Node.js 和 MongoDB 環境。

### Docker 部署

```bash
cd docker
docker compose -f docker-compose.prod.yml up -d
```

## 授權

MIT License
