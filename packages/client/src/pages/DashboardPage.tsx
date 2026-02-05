import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { IRecord } from "@ember-books/shared";
import { fetchMonthlyReport, fetchBudgetReport } from "../api/reports.js";
import { fetchRecords } from "../api/records.js";

const TYPE_LABELS: Record<string, string> = {
  expense: "支出", income: "收入", transfer: "轉帳",
  receivable: "應收", payable: "應付", balance_adjustment: "餘額調整",
  refund: "退款", interest: "利息", reward: "紅利", discount: "折扣",
};

const TYPE_COLORS: Record<string, string> = {
  expense: "text-red-600", income: "text-green-600", transfer: "text-blue-600",
};

const PIE_COLORS = [
  "#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444",
  "#f59e0b", "#06b6d4", "#ec4899", "#84cc16", "#6366f1",
];

const formatAmount = (n: number) =>
  n.toLocaleString("zh-TW", { minimumFractionDigits: 0 });

export function DashboardPage() {
  const now = dayjs();
  const year = now.year();
  const month = now.month() + 1;

  const { data: monthlyReport, isLoading: monthlyLoading } = useQuery({
    queryKey: ["reports", "monthly", year, month],
    queryFn: () => fetchMonthlyReport(year, month),
  });

  const { data: budgetReport } = useQuery({
    queryKey: ["reports", "budget"],
    queryFn: fetchBudgetReport,
  });

  const { data: recentRecords, isLoading: recentLoading } = useQuery({
    queryKey: ["records", "recent"],
    queryFn: () => fetchRecords(),
    select: (data) => data.slice(0, 10),
  });

  const totalIncome = monthlyReport?.summary.totalIncome ?? 0;
  const totalExpense = monthlyReport?.summary.totalExpense ?? 0;
  const net = monthlyReport?.summary.net ?? 0;

  // Pie chart data from byCategory
  const pieData = (monthlyReport?.byCategory ?? []).map((c) => ({
    name: c.category,
    value: c.amount,
  }));

  // Budget warnings - categories over budget
  const overBudgetCats = (budgetReport?.categories ?? []).filter((c) => c.status === "over" || c.status === "warning");

  if (monthlyLoading || recentLoading) {
    return <div className="text-center py-12 text-gray-500">載入中...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">{year} 年 {month} 月概覽</h1>

      {/* Budget Warnings */}
      {overBudgetCats.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-lg">⚠️</span>
            <span className="font-semibold text-yellow-800">預算提醒</span>
          </div>
          <div className="space-y-1">
            {overBudgetCats.map((cat) => (
              <p key={cat.category} className="text-sm text-yellow-700">
                <span className="font-medium">{cat.category}</span>
                {cat.status === "over"
                  ? ` 已超支 $${formatAmount(Math.abs(cat.remaining))}（${cat.percentage.toFixed(0)}%）`
                  : ` 已達 ${cat.percentage.toFixed(0)}%（剩餘 $${formatAmount(cat.remaining)}）`
                }
              </p>
            ))}
          </div>
          <Link to="/budget" className="inline-block mt-2 text-sm text-orange-600 hover:text-orange-700 font-medium">
            查看預算詳情 →
          </Link>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-500">總收入</p>
          <p className="text-2xl font-bold text-green-600">+${formatAmount(totalIncome)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-500">總支出</p>
          <p className="text-2xl font-bold text-red-600">-${formatAmount(totalExpense)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-500">淨額</p>
          <p className={`text-2xl font-bold ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
            {net >= 0 ? "+" : ""}{formatAmount(net)}
          </p>
        </div>
      </div>

      {/* Pie Chart + Category List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mini Pie Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">支出分類佔比</h2>
            <Link to="/reports/monthly" className="text-sm text-orange-600 hover:text-orange-700">詳細報表 →</Link>
          </div>
          {pieData.length === 0 ? (
            <p className="text-gray-400 text-center py-8">本月無支出紀錄</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[280px]">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={50}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${formatAmount(Number(value))}`} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {pieData.map((entry, i) => (
                    <div key={entry.name} className="flex items-center space-x-1">
                      <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-gray-600">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Category Breakdown List */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">支出分類明細</h2>
          {(monthlyReport?.byCategory ?? []).length === 0 ? (
            <p className="text-gray-400">本月無支出紀錄</p>
          ) : (
            <div className="space-y-3">
              {(monthlyReport?.byCategory ?? []).map((cat) => {
                const pct = totalExpense > 0 ? (cat.amount / totalExpense) * 100 : 0;
                return (
                  <div key={cat.category} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-700 truncate">{cat.category}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="ml-4 text-right shrink-0">
                      <span className="text-sm font-medium text-gray-800">${formatAmount(cat.amount)}</span>
                      <span className="text-xs text-gray-400 ml-1">({pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Records */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">最近紀錄</h2>
          <Link to="/records" className="text-sm text-orange-600 hover:text-orange-700">全部紀錄 →</Link>
        </div>
        {!recentRecords || recentRecords.length === 0 ? (
          <p className="text-gray-400">尚無紀錄</p>
        ) : (
          <div className="space-y-2">
            {recentRecords.map((record: IRecord) => (
              <div key={record._id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center space-x-3">
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{TYPE_LABELS[record.type] ?? record.type}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{record.category}{record.subcategory ? ` › ${record.subcategory}` : ""}</p>
                    <p className="text-xs text-gray-400">{dayjs(record.date).format("MM/DD")} {record.merchant ? `· ${record.merchant}` : ""}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${TYPE_COLORS[record.type] ?? "text-gray-600"}`}>
                  {record.type === "income" ? "+" : record.type === "expense" ? "-" : ""}${formatAmount(record.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
