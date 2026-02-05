# Server Package — CLAUDE.md

## 概述

Express API 服務，預設 port 3000。

## 結構

```
src/
├── index.ts              # 進入點，Express app 設定 + MongoDB 連線
├── routes/               # 路由（按資源分檔）
│   ├── records.ts        # 記帳記錄 CRUD
│   ├── categories.ts     # 分類 CRUD
│   ├── accounts.ts       # 帳戶 CRUD
│   └── reports.ts        # 報表查詢
├── models/               # Mongoose models
│   ├── Record.ts         # 記帳記錄
│   ├── Category.ts       # 分類
│   └── Account.ts        # 帳戶
└── middleware/
    └── errorHandler.ts   # 全域錯誤處理 middleware
```

## 環境變數

參考 `.env.example`：
- `MONGODB_URI` — MongoDB 連線字串
- `PORT` — 服務埠號（預設 3000）

## API 慣例

- RESTful 命名
- 使用 Zod 做 request validation
- 統一回應格式：`{ success: boolean, data?: T, error?: string }`
- 錯誤處理：用 next(error) 拋到 errorHandler middleware
- Mongoose 查詢建議用 .lean() 和 .select() 優化效能

## 新增路由 SOP

1. 在 src/routes/ 建立新的路由檔案
2. 定義 Zod schema 驗證請求
3. 實作路由處理函式
4. 在 src/index.ts 註冊路由

## 注意事項

- Mongoose schema 不要用 shared 的 interface 做泛型參數
- tsconfig 關閉了 declaration
- 所有 model 匯出命名為 XxxModel
