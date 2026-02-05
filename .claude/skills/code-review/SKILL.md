---
name: code-review
description: Review code changes following EmberBooks conventions
---

# Code Review Skill

檢查 EmberBooks 專案的程式碼變更，確保符合專案規範。

## 檢查項目

### TypeScript
- strict mode 是否有 `any` 洩漏
- ESM import 路徑是否帶 `.js` 後綴
- 命名是否符合規範（camelCase 變數、PascalCase 型別）

### API 回應格式
- 所有 API 回應是否使用 `{ success: boolean, data?: T, error?: string }` 格式
- 錯誤是否透過 `next(error)` 傳遞到 errorHandler

### Mongoose 最佳實踐
- 查詢是否使用 `.lean()` 優化（不需要 Mongoose 文件功能時）
- 查詢是否使用 `.select()` 限制回傳欄位
- Schema 沒有用 shared interface 做泛型參數

### React 規範
- 元件是否使用函式元件
- Hooks 是否符合 Rules of Hooks
- Props 是否有明確的 TypeScript 型別

### Shared 型別同步
- 修改 shared 型別後，server 和 client 是否都有對應更新
- 新增欄位是否設為 optional（向後相容）
