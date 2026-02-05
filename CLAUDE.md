# CLAUDE.md

## 專案概述

EmberBooks — 個人記帳系統，AI 驅動財務分析。自架、簡單、直覺。

## 技術棧

- **架構**：pnpm monorepo（workspace）
- **語言**：TypeScript（strict mode，ESM）
- **後端**：Node.js 22 + Express 4 + Mongoose 8
- **前端**：React 19 + Vite 6
- **資料庫**：MongoDB 7
- **驗證**：Zod

## 專案結構

```
EmberBooks/
├── packages/
│   ├── server/     # Express + Mongoose API（@ember-books/server，port 3000）
│   ├── client/     # React SPA（@ember-books/client，Vite dev port 5173）
│   └── shared/     # 共用型別、常數（@ember-books/shared）
├── .devcontainer/  # Node 22 + MongoDB 7（VS Code Dev Container）
├── docker/         # 生產環境 Dockerfile + compose
├── skills/         # AI 輔助功能（Clawdbot skill）
├── tsconfig.json
├── pnpm-workspace.yaml
└── package.json
```

## 開發指令

```bash
pnpm install          # 安裝所有依賴
pnpm dev              # 同時啟動 server + client（parallel）
pnpm -r build         # 建構所有套件（順序：shared → server → client）
pnpm lint             # ESLint 檢查
pnpm --filter @ember-books/server dev   # 只啟動 server
pnpm --filter @ember-books/client dev   # 只啟動 client
```

## 建構順序

shared 必須先建構，server 和 client 依賴它：
1. `packages/shared`（tsc → dist/）
2. `packages/server`（tsc → dist/）+ `packages/client`（vite build → dist/）

## Git 規範

- Commit message：**繁體中文**
- 分支：`feature/*` 開發，PR 合併到 `main`
- 文檔補充可直接在 main

## 編碼風格

- TypeScript strict mode，不用 `any`
- ESM（`"type": "module"`，import 路徑帶 `.js` 後綴）
- 命名：camelCase 變數/函式，PascalCase 型別/元件，UPPER_SNAKE 常數
- Mongoose model 檔名 PascalCase（`Record.ts`），匯出 `RecordModel`

## API 回應格式

統一回應結構：

```typescript
{
  success: boolean;
  data?: T;
  error?: string;
}
```

## 資料庫

- MongoDB 7，Mongoose ODM
- Models 定義在 `packages/server/src/models/`
- 三個核心 model：
  - **Record**：記帳記錄（amount 正=收入 負=支出，ref Category + Account）
  - **Category**：分類（income/expense，含 subcategories、optional budget）
  - **Account**：帳戶（cash/bank/credit/investment，信用卡有 creditLimit/billDay/payDay）

## 重要注意事項

- **shared 是共用契約**：`packages/shared` 的型別同時被 server 和 client 引用，修改前要考慮兩邊影響
- Mongoose schema 不要用 shared 的 interface 做泛型參數（ObjectId 型別衝突）
- server 的 tsconfig 關閉了 `declaration`（避免 Router 匯出型別問題）
- `.env` 不進 git，參考 `packages/server/.env.example`
- `dist/` 和 `node_modules/` 已在 `.gitignore`
