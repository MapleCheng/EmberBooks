import { useQuery } from "@tanstack/react-query";
import { fetchBudgetReport } from "../api/reports.js";
import type { BudgetCategory } from "../api/reports.js";

const formatAmount = (n: number) =>
  n.toLocaleString("zh-TW", { minimumFractionDigits: 0 });

function statusColor(status: BudgetCategory["status"]) {
  switch (status) {
    case "ok": return "bg-green-500";
    case "warning": return "bg-yellow-500";
    case "over": return "bg-red-500";
    default: return "bg-gray-400";
  }
}

function statusBg(status: BudgetCategory["status"]) {
  switch (status) {
    case "ok": return "bg-green-100";
    case "warning": return "bg-yellow-100";
    case "over": return "bg-red-100";
    default: return "bg-gray-100";
  }
}

function statusText(status: BudgetCategory["status"]) {
  switch (status) {
    case "ok": return "text-green-700";
    case "warning": return "text-yellow-700";
    case "over": return "text-red-700";
    default: return "text-gray-600";
  }
}

const CATEGORY_ICONS: Record<string, string> = {
  "飲食": "🍽️",
  "交通": "🚗",
  "娛樂": "🎮",
  "購物": "🛍️",
  "居住": "🏠",
  "醫療": "🏥",
  "教育": "📚",
  "通訊": "📱",
  "保險": "🛡️",
  "投資": "📈",
  "其他": "📦",
};

export function BudgetPage() {
  const { data: report, isLoading, error } = useQuery({
    queryKey: ["reports", "budget"],
    queryFn: fetchBudgetReport,
  });

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">載入中...</div>;
  }

  if (error || !report) {
    return <div className="text-center py-12 text-gray-500">無法載入預算資料</div>;
  }

  const { categories, totalBudget, totalSpent, totalRemaining } = report;
  const totalPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const totalStatus: BudgetCategory["status"] =
    totalPercentage > 100 ? "over" : totalPercentage >= 80 ? "warning" : "ok";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">預算追蹤</h1>
        <span className="text-sm text-gray-500">{report.year} 年 {report.month} 月</span>
      </div>

      {/* Total Budget Progress */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-800">總預算</h2>
          <span className={`text-sm font-medium ${statusText(totalStatus)}`}>
            {totalPercentage.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
          <div
            className={`h-4 rounded-full transition-all ${statusColor(totalStatus)}`}
            style={{ width: `${Math.min(totalPercentage, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">已花 <span className="font-semibold">${formatAmount(totalSpent)}</span></span>
          <span className="text-gray-600">預算 <span className="font-semibold">${formatAmount(totalBudget)}</span></span>
        </div>
        <div className="mt-1 text-right">
          {totalRemaining >= 0 ? (
            <span className="text-sm text-green-600">剩餘 ${formatAmount(totalRemaining)}</span>
          ) : (
            <span className="text-sm text-red-600 font-semibold">超支 ${formatAmount(Math.abs(totalRemaining))}</span>
          )}
        </div>
      </div>

      {/* Category Budget Cards */}
      {categories.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 border border-gray-200 text-center">
          <p className="text-gray-500 mb-2">尚未設定分類預算</p>
          <p className="text-sm text-gray-400">請到設定頁設定各分類的預算金額</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const icon = CATEGORY_ICONS[cat.category] ?? "📦";
            const barWidth = Math.min(cat.percentage, 100);
            return (
              <div key={cat.category} className={`rounded-lg shadow-sm p-5 border border-gray-200 ${statusBg(cat.status)}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">{icon}</span>
                    <span className="font-semibold text-gray-800">{cat.category}</span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    cat.status === "ok" ? "bg-green-200 text-green-800" :
                    cat.status === "warning" ? "bg-yellow-200 text-yellow-800" :
                    "bg-red-200 text-red-800"
                  }`}>
                    {cat.status === "ok" ? "正常" : cat.status === "warning" ? "注意" : "超支"}
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-white/60 rounded-full h-2.5 mb-2">
                  <div
                    className={`h-2.5 rounded-full transition-all ${statusColor(cat.status)}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">${formatAmount(cat.spent)} / ${formatAmount(cat.budget)}</span>
                  <span className={`font-medium ${statusText(cat.status)}`}>{cat.percentage.toFixed(0)}%</span>
                </div>
                <div className="text-right text-sm">
                  {cat.remaining >= 0 ? (
                    <span className="text-green-600">剩餘 ${formatAmount(cat.remaining)}</span>
                  ) : (
                    <span className="text-red-600 font-semibold">超支 ${formatAmount(Math.abs(cat.remaining))}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
