# Client Package — CLAUDE.md

## 概述

React 19 + Vite 6 + TypeScript 前端 SPA。

## 開發

- Vite dev server 在 port 5173
- API proxy：`/api` → `localhost:3000`（在 vite.config.ts 設定）

## 元件慣例

- 函式元件 + TypeScript
- 一個檔案一個元件
- 元件命名 PascalCase（`TransactionList.tsx`）
- Props 用 interface 定義，命名 `XxxProps`

## 共用型別

從 `@ember-books/shared` 匯入共用型別：

```typescript
import { IRecord, ICategory } from "@ember-books/shared";
```

## 樣式

目前尚未決定樣式方案（placeholder）。

## 建構

```bash
pnpm --filter @ember-books/client build   # vite build → dist/
```

輸出到 `dist/` 目錄。
