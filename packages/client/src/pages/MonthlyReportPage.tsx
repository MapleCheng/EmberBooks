import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { fetchMonthlyReport } from "../api/reports.js";
import type { CategoryBreakdown } from "../api/reports.js";

const PIE_COLORS = [
  "#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444",
  "#f59e0b", "#06b6d4", "#ec4899", "#84cc16", "#6366f1",
  "#14b8a6", "#f43f5e",
];

const formatAmount = (n: number) =>
  n.toLocaleString("zh-TW", { minimumFractionDigits: 0 });

export function MonthlyReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: report, isLoading, error } = useQuery({
    queryKey: ["reports", "monthly", year, month],
    queryFn: () => fetchMonthlyReport(year, month),
  });

  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  // Year/month navigation
  const goPrev = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };
  const goNext = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">載入中...</div>;
  }

  if (error || !report) {
    return (
      <div className="text-center py-12 text-gray-500">
        無法載入報表資料
      </div>
    );
  }

  const { summary, byCategory, dailyTrend } = report;

  // Pie data
  const pieData = byCategory.map((c) => ({
    name: c.category,
    value: c.amount,
  }));

  // Line chart: format date labels
  const lineData = dailyTrend.map((d) => ({
    ...d,
    label: d.date.slice(5), // MM-DD
  }));

  return (
    <div className="space-y-6">
      {/* Header with month picker */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">月報</h1>
        <div className="flex items-center space-x-2">
          <button onClick={goPrev} className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50">←</button>
          <span className="text-lg font-semibold text-gray-700">{year} 年 {month} 月</span>
          <button onClick={goNext} className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50">→</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-500">總收入</p>
          <p className="text-2xl font-bold text-green-600">+${formatAmount(summary.totalIncome)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-500">總支出</p>
          <p className="text-2xl font-bold text-red-600">-${formatAmount(summary.totalExpense)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-500">淨額</p>
          <p className={`text-2xl font-bold ${summary.net >= 0 ? "text-green-600" : "text-red-600"}`}>
            {summary.net >= 0 ? "+" : ""}{formatAmount(summary.net)}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">分類支出佔比</h2>
          {pieData.length === 0 ? (
            <p className="text-gray-400 text-center py-8">本月無支出</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[300px]">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }: any) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(1)}%`}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${formatAmount(Number(value))}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Line Chart - Daily Trend */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">每日趨勢</h2>
          {lineData.length === 0 ? (
            <p className="text-gray-400 text-center py-8">無資料</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[400px]">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value) => `$${formatAmount(Number(value))}`} />
                    <Legend />
                    <Line type="monotone" dataKey="income" name="收入" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="expense" name="支出" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category Detail List */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">分類明細</h2>
        {byCategory.length === 0 ? (
          <p className="text-gray-400">無支出分類</p>
        ) : (
          <div className="space-y-2">
            {byCategory.map((cat: CategoryBreakdown) => (
              <div key={cat.category}>
                <button
                  onClick={() => setExpandedCat(expandedCat === cat.category ? null : cat.category)}
                  className="w-full flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="font-medium text-gray-800">{cat.category}</span>
                    <span className="text-xs text-gray-400">({cat.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-700">${formatAmount(cat.amount)}</span>
                    <span className="text-gray-400 text-sm">{expandedCat === cat.category ? "▲" : "▼"}</span>
                  </div>
                </button>
                {expandedCat === cat.category && cat.subcategories && cat.subcategories.length > 0 && (
                  <div className="ml-8 mb-2 space-y-1">
                    {cat.subcategories.map((sub) => (
                      <div key={sub.subcategory} className="flex justify-between py-1.5 px-4 text-sm text-gray-600">
                        <span>{sub.subcategory}</span>
                        <span>${formatAmount(sub.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record Count */}
      <p className="text-sm text-gray-400 text-right">共 {report.recordCount} 筆紀錄</p>
    </div>
  );
}
