---
name: accounting
description: >
  EmberBooks 記帳系統操作。觸發條件：使用者提到記帳、花費、收入、
  帳戶餘額、月報、預算等財務相關話題時載入。
globs: []
---

# EmberBooks 記帳 Skill

透過自然語言與 EmberBooks API 互動，快速記帳、查詢、分析財務資料。

## API 連線資訊

- **Base URL**: 環境變數 `EMBERBOOKS_API_URL`（預設 `http://localhost:3000`）
- **認證**: Header `X-API-Key`，值從環境變數 `EMBERBOOKS_API_KEY` 取得
- **執行方式**: 使用 `exec` 執行 `curl`，或使用 `web_fetch`

### curl 範例

```bash
# 環境變數
API_URL="${EMBERBOOKS_API_URL:-http://localhost:3000}"
API_KEY="$EMBERBOOKS_API_KEY"

# GET 請求
curl -s -H "X-API-Key: $API_KEY" "$API_URL/api/accounts"

# POST 請求
curl -s -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"type":"expense","amount":120,"category":"飲食","subcategory":"午餐","date":"2025-07-19"}' \
  "$API_URL/api/records"
```

---

## 自然語言解析

### 解析流程

1. 辨識意圖：記帳（建立紀錄）/ 查詢 / 分析
2. 提取關鍵資訊：金額、分類、帳戶、日期、備註
3. 對應 API 端點與參數
4. 執行並回報結果

### 快速記帳範例

| 使用者說的 | 解析結果 |
|---|---|
| 午餐 120 | `POST /api/records` `{ type: "expense", amount: 120, category: "飲食", subcategory: "午餐", date: "today" }` |
| 加油 1500 信用卡 | `{ type: "expense", amount: 1500, category: "交通", subcategory: "加油費" }` + 查帳戶名含「信用卡」的 ID |
| 薪水 75000 | `{ type: "income", amount: 75000, category: "收入", subcategory: "薪資" }` |
| 轉帳 5000 從銀行A到銀行B | `{ type: "transfer", amount: 5000, account: 銀行A_ID, toAccount: 銀行B_ID }` |
| 健身房會費 1288 信用卡A | `{ type: "expense", amount: 1288, category: "娛樂", subcategory: "健身" }` + 查帳戶名含「信用卡A」的 ID |
| 咖啡 85 備註拿鐵 | `{ type: "expense", amount: 85, category: "飲食", subcategory: "飲料", note: "拿鐵" }` |
| 昨天晚餐 350 | `{ type: "expense", amount: 350, category: "飲食", subcategory: "晚餐", date: "yesterday" }` |
| 退費 串流影音 390 | `{ type: "refund", amount: 390, category: "娛樂", subcategory: "訂閱", merchant: "串流影音" }` |

### 解析規則

- **金額**：數字一律解析為正數
- **日期**：沒提到就用今天；「昨天」= 昨天；「上週五」= 計算對應日期
- **帳戶**：有提到銀行/卡片名稱 → 先 `GET /api/accounts` 找 ID；沒提到就不帶 account 欄位
- **分類**：根據下方「分類對照表」自動歸類
- **類型**：根據下方「Record 類型對照表」判斷

### 帳戶查找流程

當使用者提到帳戶名時（如「信用卡」「銀行A」「銀行B」）：

1. `GET /api/accounts` 取得所有帳戶
2. 模糊比對 `name` 欄位
3. 找到 → 用其 `_id`
4. 找不到 → 告知使用者，列出現有帳戶供選擇

### 查詢範例

| 使用者說的 | 操作 |
|---|---|
| 這個月花多少 | `GET /api/reports/monthly?year=YYYY&month=MM` → 加總 expense |
| 帳戶餘額 | `GET /api/accounts` → 列出各帳戶 name + balance |
| 最近 5 筆消費 | `GET /api/records?type=expense` → 取前 5 筆 |
| 食物花太多了嗎 | 查飲食分類支出 + 與預算比較 + 給建議 |
| 上個月跟這個月比 | 查兩個月 monthly → 比較差異 |
| 交通費花了多少 | `GET /api/records?type=expense&category=交通&from=月初&to=今天` → 加總 |

### 分析與月報

月報摘要格式：

```
📊 YYYY年MM月 財務摘要

💰 收入：$XX,XXX
💸 支出：$XX,XXX
📈 淨額：$±X,XXX

📂 支出分類 TOP 5：
  1. 飲食 $X,XXX（XX%）
  2. 交通 $X,XXX（XX%）
  ...

📋 預算執行：
  飲食：$X,XXX / $X,XXX（XX%）⚠️ 超支
  交通：$X,XXX / $X,XXX（XX%）✅

📉 同比上月：支出 ↑↓XX%
```

---

## API 端點完整列表

### 認證 Auth

| 方法 | 端點 | 說明 | 認證 |
|---|---|---|---|
| POST | /api/auth/login | 登入（email + password）→ JWT token | ❌ |
| GET | /api/auth/me | 取得當前使用者資訊 | ✅ |

> Skill 使用 API Key 認證，不需要 login。

### 記錄 Records

| 方法 | 端點 | 說明 |
|---|---|---|
| GET | /api/records | 查詢記錄（支援 filter） |
| GET | /api/records/:id | 取得單筆記錄 |
| POST | /api/records | 建立記錄 |
| PUT | /api/records/:id | 更新記錄 |
| DELETE | /api/records/:id | 刪除記錄 |

**GET /api/records 查詢參數：**
- `type` — 記錄類型（expense/income/transfer/...）
- `category` — 主分類名稱
- `account` — 帳戶 ID
- `from` — 起始日期（ISO 格式，如 2025-07-01）
- `to` — 結束日期（ISO 格式）

**POST /api/records Body 欄位：**

| 欄位 | 類型 | 必填 | 說明 |
|---|---|---|---|
| type | string | ✅ | expense/income/transfer/receivable/payable/refund/... |
| amount | number | ✅ | 金額（正數） |
| category | string | ✅ | 主分類 |
| subcategory | string | ❌ | 子分類 |
| date | string | ❌ | ISO 日期（預設今天） |
| note | string | ❌ | 備註 |
| account | string | ✅ | 帳戶 ID（ObjectId） |
| toAccount | string | ❌ | 轉入帳戶 ID（transfer 專用） |
| fee | number | ❌ | 手續費 |
| discount | number | ❌ | 折扣 |
| merchant | string | ❌ | 商家名稱 |
| counterparty | string | ❌ | 對象 |
| project | string | ❌ | 專案標籤 |
| tags | string[] | ❌ | 標籤陣列 |
| recurring | boolean | ❌ | 是否週期性 |

### 分類 Categories

| 方法 | 端點 | 說明 |
|---|---|---|
| GET | /api/categories | 列出所有分類 |
| GET | /api/categories/:id | 取得單一分類 |
| POST | /api/categories | 建立分類 |
| PUT | /api/categories/:id | 更新分類 |
| DELETE | /api/categories/:id | 刪除分類 |

**Category 欄位：** name, icon, type, subcategories (string[]), budget (number)

### 帳戶 Accounts

| 方法 | 端點 | 說明 |
|---|---|---|
| GET | /api/accounts | 列出所有帳戶 |
| GET | /api/accounts/:id | 取得單一帳戶 |
| POST | /api/accounts | 建立帳戶 |
| PUT | /api/accounts/:id | 更新帳戶 |
| DELETE | /api/accounts/:id | 刪除帳戶 |

**Account 欄位：** name, type (cash/bank/credit/investment/ewallet), balance, currency, creditLimit, billDay, payDay

### 報表 Reports

| 方法 | 端點 | 說明 |
|---|---|---|
| GET | /api/reports/monthly | 月報（回傳該月所有記錄） |

**月報參數：** `year`（年）、`month`（月，1-12）

> 月報回傳的是該月原始記錄陣列，需自行依 type 分組加總。

### 匯入 Import

| 方法 | 端點 | 說明 |
|---|---|---|
| POST | /api/import/moze | 匯入 MOZE CSV（multipart/form-data, field: file） |

### 系統

| 方法 | 端點 | 說明 |
|---|---|---|
| GET | /api/health | 健康檢查 |

---

## Record 類型對照表

| 自然語言關鍵字 | type 值 | 說明 |
|---|---|---|
| 花、買、付、支出、消費 | expense | 支出 |
| 賺、收、薪水、入帳、進帳 | income | 收入 |
| 轉、匯、轉帳 | transfer | 轉帳（需 account + toAccount） |
| 借出、應收 | receivable | 應收帳款 |
| 借入、應付、貸款 | payable | 應付帳款 |
| 退款、退費 | refund | 退款 |
| 利息 | interest | 利息收入 |
| 紅利、回饋 | reward | 紅利回饋 |
| 折扣 | discount | 折扣 |
| 餘額調整 | balance_adjustment | 餘額調整 |

> 預設類型：沒有明確線索時，以 `expense`（支出）為主。

---

## 常見分類對照表

### 支出分類

| 主分類 | 子分類 | 觸發關鍵字 |
|---|---|---|
| 飲食 | 早餐、午餐、晚餐、飲料、零食、外送 | 吃、喝、餐、飯、便當、咖啡、茶、手搖、外送 |
| 交通 | 加油費、停車費、大眾運輸、計程車、通行費、維修保養 | 加油、停車、捷運、公車、Uber、高鐵、火車、ETC、保養 |
| 居住 | 房租、水費、電費、瓦斯、管理費、網路 | 房租、水電、瓦斯、管理費、WiFi、網路 |
| 娛樂 | 電影、遊戲、訂閱、健身、旅遊 | 電影、串流影音、音樂訂閱、遊戲、健身、健身房、旅行 |
| 購物 | 衣服、3C、家用品、日用品 | 買、購、衣服、手機、電腦、清潔用品 |
| 醫療 | 看診、藥品、保健 | 看醫生、掛號、藥局、維他命 |
| 教育 | 書籍、課程、學費 | 書、課、補習、Udemy |
| 社交 | 聚餐、禮物、紅包 | 聚餐、AA、禮物、紅包、婚禮 |
| 保險 | 壽險、車險、醫療險 | 保險、保費 |
| 其他 | 手續費、罰款、雜項 | 手續費、罰單 |

### 收入分類

| 主分類 | 子分類 |
|---|---|
| 收入 | 薪資、獎金、兼職、投資收益、股利、利息 |

### 轉帳分類

| 主分類 | 子分類 |
|---|---|
| 轉帳 | 帳戶互轉、信用卡繳款 |

---

## 注意事項

1. **金額一律正數** — API 只接受正數
2. **日期預設今天** — 使用者沒說日期就用當天
3. **帳戶可省略** — 但 API 的 account 欄位是必填的，沒指定帳戶時先問使用者或用預設帳戶
4. **成功回應格式** — 用 emoji + 簡潔文字確認：
   - 記帳成功：`✅ 午餐 $120 已記錄`
   - 查詢結果：簡潔列表
   - 錯誤：`❌ 記帳失敗：原因`
5. **查詢結果簡潔呈現** — 不要把 API 原始回傳全部貼出來
6. **模糊指令要確認** — 如果無法判斷分類或帳戶，主動詢問使用者
7. **帳戶 ID 快取** — 第一次查詢後記住帳戶列表，避免每次都重新查
8. **金額格式** — 回覆時加千分位分隔：`$1,288` 而非 `$1288`
9. **Discord 格式** — 不用 markdown 表格（Discord 不支援），改用 bullet list 或 code block
