新增 API route 腳手架。

## 使用方式

$ARGUMENTS 應包含 route 名稱（例如：`tags`、`budgets`）

## 步驟

1. 在 `packages/server/src/routes/` 建立 `$ARGUMENTS.ts`
2. 建立基本 CRUD 路由結構（GET list、GET by id、POST create、PUT update、DELETE）
3. 為每個路由定義 Zod validation schema
4. 統一使用 `{ success, data, error }` 回應格式
5. 在 `packages/server/src/index.ts` 註冊新路由
6. 執行 `pnpm --filter @ember-books/server build` 驗證編譯

## 範例

```typescript
import { Router } from "express";
import { z } from "zod";

const router = Router();

// GET /api/$ARGUMENTS
router.get("/", async (req, res, next) => {
  try {
    // TODO: implement
    res.json({ success: true, data: [] });
  } catch (error) {
    next(error);
  }
});

export default router;
```
