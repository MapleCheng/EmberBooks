建構所有 EmberBooks packages。

## 步驟

1. 執行 `pnpm -r build`
2. 檢查建構結果，回報：
   - ✅ 成功的 packages
   - ❌ 失敗的 packages 及錯誤訊息
3. 如有 TypeScript 編譯錯誤，嘗試分析並建議修正

## 建構順序

shared → server → client（shared 必須先建構）
