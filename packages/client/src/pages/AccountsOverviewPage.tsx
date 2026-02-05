import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  fetchAccountBalances,
  type AccountBalanceItem,
} from "../api/accounts.js";
import { extractGroupEmoji } from "../components/GroupedAccountSelect.js";

function formatCurrency(amount: number, currency = "TWD"): string {
  return amount.toLocaleString("zh-TW", {
    minimumFractionDigits: currency === "TWD" ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function AccountsOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["accountBalances"],
    queryFn: fetchAccountBalances,
  });

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
        <div className="text-center py-12 text-red-500">載入失敗</div>
      </div>
    );
  }

  const { summary } = data;

  // Group accounts by `group` field
  const grouped: Record<string, AccountBalanceItem[]> = {};
  for (const acc of data.data) {
    const key = acc.group || "💰 其他";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(acc);
  }

  const groupOrder = Object.keys(grouped);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">💰 帳戶總覽</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">總資產</div>
          <div className="text-2xl font-bold text-green-600">
            ${formatCurrency(summary.totalAssets)}
          </div>
          <div className="text-xs text-gray-400 mt-1">實體帳戶（納入統計）</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">總負債</div>
          <div className="text-2xl font-bold text-red-600">
            ${formatCurrency(summary.totalLiabilities)}
          </div>
          <div className="text-xs text-gray-400 mt-1">信用卡欠款（納入統計）</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">淨值</div>
          <div className={`text-2xl font-bold ${summary.netWorth >= 0 ? "text-blue-600" : "text-red-600"}`}>
            ${formatCurrency(summary.netWorth)}
          </div>
          <div className="text-xs text-gray-400 mt-1">資產 - 負債</div>
        </div>
      </div>

      {/* Account Groups — grouped by `group` field */}
      {groupOrder.map((group) => {
        const accounts = grouped[group];
        if (!accounts || accounts.length === 0) return null;
        const emoji = extractGroupEmoji(group);

        return (
          <div key={group} className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              {group}
            </h2>
            <div className="space-y-2">
              {accounts.map((acc) => (
                <div
                  key={acc.accountId}
                  onClick={() => navigate(`/records?account=${acc.accountId}`)}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{emoji}</span>
                      <div>
                        <h3 className="font-semibold">
                          {acc.name}
                          {!acc.includeInStats && (
                            <span className="ml-2 text-xs text-gray-400 font-normal">（不納入統計）</span>
                          )}
                        </h3>
                        <div className="text-sm text-gray-500">
                          {group}
                          {acc.currency !== "TWD" && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              {acc.currency}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-xl font-bold ${
                          acc.currentBalance > 0
                            ? "text-green-600"
                            : acc.currentBalance < 0
                              ? "text-red-600"
                              : "text-gray-600"
                        }`}
                      >
                        {acc.currentBalance < 0 ? "-" : ""}${formatCurrency(Math.abs(acc.currentBalance), acc.currency)}
                      </div>
                      {acc.type === "credit" && acc.creditLimit && (
                        <div className="text-xs text-gray-400 mt-1">
                          已用 {formatCurrency(Math.abs(acc.currentBalance), acc.currency)} / 額度{" "}
                          {formatCurrency(acc.creditLimit, acc.currency)}
                          {acc.availableCredit !== undefined && (
                            <span className="ml-2 text-green-500">
                              可用 {formatCurrency(acc.availableCredit, acc.currency)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
