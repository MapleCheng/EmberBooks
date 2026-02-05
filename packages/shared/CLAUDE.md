# Shared Package — CLAUDE.md

## 概述

共用型別定義和常數，同時被 server 和 client 引用。

## 結構

```
src/
├── types.ts      # 型別定義（IRecord, ICategory, IAccount 等）
├── constants.ts  # 共用常數
└── index.ts      # Re-export 所有公開 API
```

## 使用方式

其他 package 透過 workspace 依賴引用：

```typescript
import { IRecord, ICategory, IAccount } from "@ember-books/shared";
```

## 新增型別 SOP

1. 在 `src/types.ts` 定義新的 interface/type
2. 在 `src/index.ts` re-export
3. 執行 `pnpm --filter @ember-books/shared build` 重新建構

## ⚠️ 修改注意

這裡的型別是 server 和 client 之間的**共用契約**。修改前必須：
1. 確認 server 端的 Mongoose schema 是否需要同步更新
2. 確認 client 端的元件是否受影響
3. 考慮向後相容性（新增欄位用 optional）
