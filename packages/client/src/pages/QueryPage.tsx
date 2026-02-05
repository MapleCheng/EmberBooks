import { useState } from "react";
import { apiClient } from "../api/client.js";

const COLLECTIONS = [
  { value: "records", label: "Records（記帳記錄）" },
  { value: "accounts", label: "Accounts（帳戶）" },
  { value: "categories", label: "Categories（分類）" },
  { value: "paymentplans", label: "PaymentPlans（付款計劃）" },
  { value: "creditcardstatements", label: "CreditCardStatements（信用卡帳單）" },
];

export function QueryPage() {
  const [collection, setCollection] = useState("records");
  const [filter, setFilter] = useState("{}");
  const [projection, setProjection] = useState("");
  const [sort, setSort] = useState("{}");
  const [limit, setLimit] = useState(100);
  const [result, setResult] = useState<unknown[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleQuery = async () => {
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      let parsedFilter: object;
      try {
        parsedFilter = JSON.parse(filter || "{}");
      } catch {
        setError("Filter JSON 格式錯誤");
        setLoading(false);
        return;
      }

      let parsedProjection: object | undefined;
      if (projection.trim()) {
        try {
          parsedProjection = JSON.parse(projection);
        } catch {
          setError("Projection JSON 格式錯誤");
          setLoading(false);
          return;
        }
      }

      let parsedSort: object;
      try {
        parsedSort = JSON.parse(sort || "{}");
      } catch {
        setError("Sort JSON 格式錯誤");
        setLoading(false);
        return;
      }

      const data = await apiClient<unknown[]>("/query", {
        method: "POST",
        body: JSON.stringify({
          collection,
          filter: parsedFilter,
          projection: parsedProjection,
          sort: parsedSort,
          limit,
        }),
      });

      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "查詢失敗";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">🔍 資料庫查詢工具</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Collection</label>
          <select
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {COLLECTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter（JSON）</label>
          <textarea
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            rows={3}
            placeholder='例如：{ "type": "expense" }'
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Projection（JSON，可選）</label>
          <textarea
            value={projection}
            onChange={(e) => setProjection(e.target.value)}
            rows={2}
            placeholder='例如：{ "name": 1, "amount": 1 }'
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sort（JSON）</label>
          <textarea
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            rows={2}
            placeholder='例如：{ "date": -1 }'
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Limit</label>
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 100)}
            min={1}
            max={1000}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="ml-2 text-xs text-gray-400">最大 1000</span>
        </div>

        <div>
          <button
            onClick={handleQuery}
            disabled={loading}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {loading ? "查詢中..." : "查詢"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="mt-4 bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">查詢結果</h2>
            <span className="text-sm text-gray-500">共 {result.length} 筆</span>
          </div>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-[600px] text-sm font-mono">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
