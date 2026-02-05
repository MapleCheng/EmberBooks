---
name: debug-api
description: Debug Express API issues in EmberBooks
---

# Debug API Skill

系統性排查 EmberBooks Express API 問題。

## 排查步驟

### 1. Route 註冊
- 確認路由檔案存在於 `packages/server/src/routes/`
- 確認路由已在 `src/index.ts` 中註冊（`app.use`）
- 確認路由路徑正確（`/api/xxx`）

### 2. Middleware 順序
- 確認 `express.json()` 在路由之前
- 確認 `errorHandler` 在所有路由之後
- 確認 CORS 設定正確

### 3. MongoDB 連線
- 檢查 `MONGODB_URI` 環境變數
- 確認 MongoDB 服務是否運行
- 檢查連線錯誤日誌

### 4. Mongoose Query
- 確認 Model 是否正確匯入
- 檢查 query 語法
- 確認 populate 路徑正確

### 5. Error Handler
- 確認錯誤是否被 `next(error)` 傳遞
- 檢查 errorHandler 是否正確攔截
- 確認回應格式 `{ success: false, error: message }`

### 6. 回應格式
- 確認所有回應使用統一格式
- 確認 HTTP status code 正確
- 確認 Content-Type 為 application/json

## 常見問題

- **404**：路由未註冊或路徑錯誤
- **500**：未處理的錯誤，檢查 errorHandler
- **連線超時**：MongoDB 連線問題
- **型別錯誤**：shared 和 server 型別不同步
