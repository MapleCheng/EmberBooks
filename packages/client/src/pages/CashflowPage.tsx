import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { fetchCashflowReport } from "../api/reports.js";
import type { CashflowReport, CashflowCreditCard, CategoryRecord, FixedExpenseRecord } from "../api/reports.js";

function fmt(n: number): string {
  return n.toLocaleString("zh-TW");
}


export function CashflowPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const daysInMonth = new Date(year, month, 0).getDate();
  const [cutoffDay, setCutoffDay] = useState<number | null>(null);
  const [selectedCard, setSelectedCard] = useState<CashflowCreditCard | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<{ category: string; records: CategoryRecord[] } | null>(null);
  const [selectedFixed, setSelectedFixed] = useState<{ label: string; records: FixedExpenseRecord[] } | null>(null);
  const effectiveCutoffDay = cutoffDay === null ? daysInMonth : Math.min(cutoffDay, daysInMonth);

  const { data, isLoading, error } = useQuery({
    queryKey: ["cashflow", year, month],
    queryFn: () => fetchCashflowReport(year, month),
  });

  const handlePrevMonth = () => {
    setCutoffDay(null);
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    setCutoffDay(null);
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12 text-gray-500">載入中...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12 text-red-500">載入失敗，請稍後再試</div>
      </div>
    );
  }

  // Compute filtered data based on cutoff day
  const filteredDaily = data.dailyBalance.filter((_, i) => i < effectiveCutoffDay);
  const waterfallIncome = filteredDaily.reduce((sum, d) => sum + d.income, 0);
  const waterfallDirect = filteredDaily.reduce((sum, d) => sum + d.directExpense, 0);
  const waterfallCredit = filteredDaily.reduce((sum, d) => sum + d.creditBillPayment, 0);
  const waterfallFixed = filteredDaily.reduce((sum, d) => sum + d.fixedExpense, 0);
  const waterfallAdjustments = data.expenses?.adjustments?.total ?? 0;
  const closingBalance = (data.openingBalance ?? 0) + waterfallIncome - waterfallDirect - waterfallCredit - waterfallFixed + waterfallAdjustments;
  const chartData = filteredDaily.map((day) => ({ ...day, dateLabel: day.date.slice(5) }));

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header with Month Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold">💰 現金流量</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevMonth}
              className="px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="上個月"
            >
              ←
            </button>
            <span className="text-lg font-semibold min-w-[120px] text-center">
              {year}年{month}月
            </span>
            <button
              onClick={handleNextMonth}
              className="px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="下個月"
            >
              →
            </button>
          </div>
          {data && (
            <div className="flex items-center gap-2">
              <label htmlFor="cutoff-day" className="text-sm text-gray-600">
                截止日：
              </label>
              <select
                id="cutoff-day"
                value={cutoffDay ?? ""}
                onChange={(e) => setCutoffDay(e.target.value === "" ? null : Number(e.target.value))}
                className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">整月</option>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}日
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Period info */}
      <div className="text-sm text-gray-500">
        期間：{data.period.from} ~ {cutoffDay !== null ? `${year}-${String(month).padStart(2, '0')}-${String(cutoffDay).padStart(2, '0')}` : data.period.to}
      </div>

      {/* Hero Section - Disposable Balance */}
      <div
        className={`rounded-xl shadow-sm border-2 p-8 text-center ${
          closingBalance >= 0
            ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200"
            : "bg-gradient-to-br from-red-50 to-rose-50 border-red-200"
        }`}
      >
        <div className="text-sm font-medium text-gray-600 mb-2">
          {year}年{month}月
        </div>
        <div className="text-lg font-semibold text-gray-700 mb-3">
          可支配資本
        </div>
        <div
          className={`text-5xl font-bold ${
            closingBalance >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          ${fmt(closingBalance)}
        </div>
      </div>

      {/* Waterfall Breakdown Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="space-y-4">
          {/* Opening Balance Row */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span>🏦</span>
                <span className="font-medium text-gray-700">前期結餘</span>
              </div>
              <span className="font-semibold text-blue-600 text-lg">
                ${fmt(data.openingBalance ?? 0)}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full" style={{ width: "100%" }} />
            </div>
          </div>

          {/* Income Row */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span>💰</span>
                <span className="font-medium text-gray-700">收入合計</span>
              </div>
              <span className="font-semibold text-green-600 text-lg">
                ${fmt(waterfallIncome)}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Direct Expenses Row */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="ml-4">💵</span>
                <span className="font-medium text-gray-600">直接支出</span>
              </div>
              <span className="font-semibold text-red-600">
                -${fmt(waterfallDirect)}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-400 rounded-full"
                style={{
                  width: `${
                    waterfallIncome > 0
                      ? Math.min(
                          (waterfallDirect / waterfallIncome) * 100,
                          100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Credit Card Bills Row */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="ml-4">💳</span>
                <span className="font-medium text-gray-600">信用卡帳單</span>
              </div>
              <span className="font-semibold text-red-600">
                -${fmt(waterfallCredit)}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-400 rounded-full"
                style={{
                  width: `${
                    waterfallIncome > 0
                      ? Math.min(
                          (waterfallCredit / waterfallIncome) * 100,
                          100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Fixed Expenses Row */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="ml-4">📋</span>
                <span className="font-medium text-gray-600">固定支出/應付</span>
              </div>
              <span className="font-semibold text-red-600">
                -${fmt(waterfallFixed)}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full"
                style={{
                  width: `${
                    waterfallIncome > 0
                      ? Math.min(
                          (waterfallFixed / waterfallIncome) * 100,
                          100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Adjustments Row (only show if non-zero) */}
          {waterfallAdjustments !== 0 && (
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="ml-4">🔄</span>
                <span className="font-medium text-gray-600">其他調整</span>
              </div>
              <span className={`font-semibold ${waterfallAdjustments >= 0 ? "text-green-600" : "text-red-600"}`}>
                {waterfallAdjustments >= 0 ? "" : "-"}${fmt(Math.abs(waterfallAdjustments))}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t-2 border-gray-300 my-4"></div>

          {/* Final Balance Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span className="font-bold text-gray-800">可支配資本</span>
            </div>
            <span
              className={`font-bold text-xl ${
                closingBalance >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              ${fmt(closingBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* Cash Water Level Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">📊 現金水位變化</h2>
        {data.dailyBalance.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={chartData}>
              <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value) => `$${Number(value).toLocaleString("zh-TW")}`}
              />
              <Legend />
              <Bar dataKey="income" name="收入" fill="#22c55e" />
              <Bar dataKey="expense" name="支出" fill="#ef4444" />
              <Line
                type="monotone"
                dataKey="runningBalance"
                name="餘額"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-gray-400 text-sm">本期無交易紀錄</div>
        )}
      </div>

      {/* Income Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">📥 收入</h2>
        {data.income.byCategory.length > 0 ? (
          <div className="space-y-2">
            {data.income.byCategory.map((item) => (
              <div
                key={item.category}
                className="flex justify-between items-center cursor-pointer hover:bg-green-50 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                onClick={() => setSelectedCategory({ category: item.category, records: item.records })}
              >
                <span className="text-gray-600">{item.category}</span>
                <div className="flex items-center gap-1">
                  <span className="font-medium">${fmt(item.amount)}</span>
                  <span className="text-gray-300 text-sm">›</span>
                </div>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>合計</span>
              <span className="text-green-600">${fmt(data.income.total)}</span>
            </div>
          </div>
        ) : (
          <div className="text-gray-400 text-sm">本期無收入紀錄</div>
        )}
      </div>

      {/* Expenses Section */}
      <div className="space-y-6">
        {/* Direct Expenses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">💵 直接支出</h2>
          {data.expenses.direct.byCategory.length > 0 ? (
            <div className="space-y-2">
              {data.expenses.direct.byCategory.map((cat) => (
                <div
                  key={cat.category}
                  className="flex justify-between items-center cursor-pointer hover:bg-red-50 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                  onClick={() => setSelectedCategory({ category: cat.category, records: cat.records })}
                >
                  <span className="text-gray-600">{cat.category}</span>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">${fmt(cat.amount)}</span>
                    <span className="text-gray-300 text-sm">›</span>
                  </div>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>小計</span>
                <span className="text-red-600">${fmt(data.expenses.direct.total)}</span>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-sm">本期無直接支出紀錄</div>
          )}
        </div>

        {/* Credit Card Bills */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">💳 信用卡帳單</h2>
          {data.expenses.creditCardBills.cards.length > 0 ? (
            <div className="space-y-3">
              {data.expenses.creditCardBills.cards.map((card) => (
                <div
                  key={card.accountId + card.dueDate}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-2 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors"
                  onClick={() => setSelectedCard(card)}
                >
                  <div>
                    <div className="font-medium">{card.account}</div>
                    <div className="text-xs text-gray-400">
                      繳費日：{card.dueDate}
                      {card.estimated && <span className="ml-1 text-amber-500">（預估）</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-red-600">${fmt(card.billAmount)}</span>
                    <span className="text-gray-300 text-sm">›</span>
                  </div>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>小計</span>
                <span className="text-red-600">${fmt(data.expenses.creditCardBills.total)}</span>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-sm">本期無信用卡帳單</div>
          )}
        </div>

        {/* Fixed Expenses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">📋 固定支出</h2>
          {data.expenses.fixed.items.length > 0 ? (
            <div className="space-y-2">
              {data.expenses.fixed.items.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center cursor-pointer hover:bg-amber-50 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                  onClick={() => setSelectedFixed({
                    label: `${item.category}${item.subcategory ? ` — ${item.subcategory}` : ""}`,
                    records: item.records,
                  })}
                >
                  <span className="text-gray-600">
                    {item.category}
                    {item.subcategory && ` — ${item.subcategory}`}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">${fmt(item.amount)}</span>
                    <span className="text-gray-300 text-sm">›</span>
                  </div>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>小計</span>
                <span className="text-red-600">${fmt(data.expenses.fixed.total)}</span>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-sm">本期無固定支出紀錄</div>
          )}
        </div>
      </div>

      {/* Credit Card Bill Breakdown Modal */}
      {selectedCard && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedCard(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold">💳 {selectedCard.account}</h3>
                <p className="text-sm text-gray-500">帳單金額：<span className="text-red-600 font-semibold">${fmt(selectedCard.billAmount)}</span></p>
              </div>
              <button
                onClick={() => setSelectedCard(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
              >
                ×
              </button>
            </div>

            {selectedCard.breakdown ? (
              <div className="p-4 space-y-4">
                {/* Plan Items */}
                {selectedCard.breakdown.planItems.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-blue-700 mb-2">📋 固定支出</h4>
                    <div className="space-y-1">
                      {selectedCard.breakdown.planItems.map((item, i) => (
                        <div key={i} className="flex justify-between items-center py-1">
                          <div>
                            <span className="text-sm font-medium text-blue-900">{item.name}</span>
                            <span className="text-xs text-gray-400 ml-2">
                              {item.category}{item.subcategory && ` — ${item.subcategory}`}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-blue-700">${fmt(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 pt-2 border-t border-blue-100 text-sm font-semibold text-blue-700">
                      <span>固定支出小計</span>
                      <span>${fmt(selectedCard.breakdown.planTotal)}</span>
                    </div>
                  </div>
                )}

                {/* Other Expenses by Category */}
                {selectedCard.breakdown.otherByCategory.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-orange-700 mb-2">🛒 其他消費</h4>
                    <div className="space-y-1">
                      {selectedCard.breakdown.otherByCategory.map((item, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center py-1.5 cursor-pointer hover:bg-orange-50 rounded-lg px-2 -mx-2 transition-colors"
                          onClick={() => setSelectedCategory({ category: item.category, records: item.records })}
                        >
                          <span className="text-sm text-gray-700">{item.category}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-semibold text-orange-700">${fmt(item.amount)}</span>
                            <span className="text-gray-300 text-sm">›</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 pt-2 border-t border-orange-100 text-sm font-semibold text-orange-700">
                      <span>其他消費小計</span>
                      <span>${fmt(selectedCard.breakdown.otherTotal)}</span>
                    </div>
                  </div>
                )}

                {/* Total */}
                <div className="flex justify-between pt-3 border-t-2 border-gray-300 font-bold">
                  <span>帳單合計</span>
                  <span className="text-red-600">${fmt(selectedCard.breakdown.planTotal + selectedCard.breakdown.otherTotal)}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 text-gray-400 text-center">無明細資料</div>
            )}
          </div>
        </div>
      )}

      {/* Fixed Expense Detail Modal */}
      {selectedFixed && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedFixed(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold">📋 {selectedFixed.label}</h3>
                <p className="text-sm text-gray-500">
                  共 {selectedFixed.records.length} 筆，合計{" "}
                  <span className="text-amber-600 font-semibold">
                    ${fmt(selectedFixed.records.reduce((s, r) => s + r.amount, 0))}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelectedFixed(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-2">
              {selectedFixed.records.map((rec, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 shrink-0">{rec.date.slice(5)}</span>
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {rec.counterparty || rec.merchant || rec.note || "（無備註）"}
                      </span>
                    </div>
                    {(rec.counterparty || rec.merchant) && rec.note && (
                      <div className="text-xs text-gray-400 ml-12 truncate">{rec.note}</div>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-amber-700 shrink-0 ml-2">
                    ${fmt(rec.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category Detail Modal (second level) */}
      {selectedCategory && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
          onClick={() => setSelectedCategory(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold">🛒 {selectedCategory.category}</h3>
                <p className="text-sm text-gray-500">
                  共 {selectedCategory.records.length} 筆，合計{" "}
                  <span className="text-orange-600 font-semibold">
                    ${fmt(selectedCategory.records.reduce((s, r) => s + r.amount, 0))}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
              >
                ×
              </button>
            </div>

            {/* Records */}
            <div className="p-4 space-y-2">
              {selectedCategory.records.map((rec, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 shrink-0">{rec.date.slice(5)}</span>
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {rec.merchant || rec.note || rec.subcategory || "（無備註）"}
                      </span>
                    </div>
                    {rec.merchant && rec.note && (
                      <div className="text-xs text-gray-400 ml-12 truncate">{rec.note}</div>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-orange-700 shrink-0 ml-2">
                    ${fmt(rec.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
