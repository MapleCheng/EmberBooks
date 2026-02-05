啟動 EmberBooks 開發環境。

## 步驟

1. 確認 MongoDB 是否可連線（檢查 MONGODB_URI 或嘗試連線 localhost:27017）
2. 安裝依賴：`pnpm install`
3. 建構 shared package：`pnpm --filter @ember-books/shared build`
4. 啟動開發環境：`pnpm dev`

如果 MongoDB 無法連線，提醒使用者啟動 MongoDB（可用 Docker：`docker compose -f docker/compose.yaml up -d mongo`）。
