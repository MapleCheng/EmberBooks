新增 React 元件腳手架。

## 使用方式

$ARGUMENTS 應包含元件名稱（例如：`TransactionList`、`CategoryPicker`）

## 步驟

1. 解析 $ARGUMENTS 取得元件名稱
2. 在 `packages/client/src/components/` 建立元件檔案（如 `TransactionList.tsx`）
3. 使用函式元件 + TypeScript 模板：
   - 定義 Props interface
   - 建立函式元件
   - 預設 export

## 範例

```tsx
interface TransactionListProps {
  // TODO: define props
}

export default function TransactionList({ }: TransactionListProps) {
  return (
    <div>
      <h2>TransactionList</h2>
      {/* TODO: implement */}
    </div>
  );
}
```

## 慣例

- 一個檔案一個元件
- 檔名 PascalCase（`TransactionList.tsx`）
- Props interface 命名 `XxxProps`
- 共用型別從 `@ember-books/shared` 匯入
