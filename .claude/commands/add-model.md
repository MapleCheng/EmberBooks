新增 Mongoose model 及對應的 shared 型別。

## 使用方式

$ARGUMENTS 應包含 model 名稱和欄位描述（例如：`Tag name:string color:string`）

## 步驟

1. 解析 $ARGUMENTS 取得 model 名稱和欄位
2. 在 `packages/shared/src/types.ts` 新增 interface（如 `ITag`）
3. 在 `packages/shared/src/index.ts` re-export 新型別
4. 在 `packages/server/src/models/` 建立 Model 檔案（如 `Tag.ts`）
5. 定義 Mongoose schema（不要用 shared interface 做泛型參數）
6. 匯出為 `XxxModel`（如 `TagModel`）
7. 建構 shared：`pnpm --filter @ember-books/shared build`
8. 建構 server：`pnpm --filter @ember-books/server build`
9. 驗證編譯通過

## 命名慣例

- Interface：`IXxx`（如 `ITag`）
- Model 檔名：PascalCase（如 `Tag.ts`）
- 匯出名：`XxxModel`（如 `TagModel`）
