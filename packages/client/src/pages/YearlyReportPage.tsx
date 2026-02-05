import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { fetchYearlyReport } from "../api/reports.js";

const formatAmount = (n: number) =>
  n.toLocaleString("zh-TW", { minimumFractionDigits: 0 });

const MONTH_LABELS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

export function YearlyReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: report, isLoading, error } = useQuery({
    queryKey: ["reports", "yearly", year],
    queryFn: () => fetchYearlyReport(year),
  });

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">載入中...</div>;
  }

  if (error || !report) {
    return <div className="text-center py-12 text-gray-500">無法載入年度報表</div>;
  }

  const { summary, monthlyTrend, byCategory, topExpenses } = report;

  // Bar chart data with month labels
  const barData = monthlyTrend.map((m) => ({
    ...m,
    label: MONTH_LABELS[m.month - 1] ?? `${m.month}月`,
  }));

  // Category ranking - sort by amount desc
  const sortedCategories = [...byCategory].sort((a, b) => b.amount - a.amount);
  const maxCatAmount = sortedCategories.length > 0 ? sortedCategories[0].amount : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">年報</h1>
        <div className="flex items-center space-x-2">
          <button onClick={() => setYear(year - 1)} className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50">←</button>
          <span className="text-lg font-semibold text-gray-700">{year} 年</span>
          <button onClick={() => setYear(year + 1)} className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50">→</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-500">年度收入</p>
          <p className="text-2xl font-bold text-green-600">+${formatAmount(summary.totalIncome)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-500">年度支出</p>
          <p className="text-2xl font-bold text-red-600">-${formatAmount(summary.totalExpense)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-500">年度淨額</p>
          <p className={`text-2xl font-bold ${summary.net >= 0 ? "text-green-600" : "text-red-600"}`}>
            {summary.net >= 0 ? "+" : ""}{formatAmount(summary.net)}
          </p>
        </div>
      </div>

      {/* Monthly Trend BarChart */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">月度趨勢</h2>
        {barData.length === 0 ? (
          <p className="text-gray-400 text-center py-8">無資料</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => `$${formatAmount(Number(value))}`} />
                  <Legend />
                  <Bar dataKey="income" name="收入" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="支出" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Two Column: Category Ranking + Top Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Ranking */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">分類排行</h2>
          {sortedCategories.length === 0 ? (
            <p className="text-gray-400">無支出分類</p>
          ) : (
            <div className="space-y-3">
              {sortedCategories.map((cat, idx) => {
                const barWidth = maxCatAmount > 0 ? (cat.amount / maxCatAmount) * 100 : 0;
                return (
                  <div key={cat.category} className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-500 w-5 text-right">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 truncate">{cat.category}</span>
                        <span className="text-sm font-semibold text-gray-800 ml-2">${formatAmount(cat.amount)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-orange-500 h-2 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 w-12 text-right">{cat.percentage.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top 10 Expenses */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">前 10 大支出</h2>
          {topExpenses.length === 0 ? (
            <p className="text-gray-400">無資料</p>
          ) : (
            <div className="space-y-2">
              {topExpenses.slice(0, 10).map((item, idx) => (
                <div key={`${item.category}-${item.subcategory}-${idx}`} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-500 w-5 text-right">{idx + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.category}</p>
                      <p className="text-xs text-gray-400">{item.subcategory}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-red-600">${formatAmount(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
