import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import type { IRecord } from "@ember-books/shared";
import { fetchRecords, deleteRecord, type RecordFilters } from "../api/records.js";
import { fetchCategories } from "../api/categories.js";
import { fetchAccounts } from "../api/accounts.js";
import { AccountFilterSelect } from "../components/GroupedAccountSelect.js";
import { RecordFormModal } from "../components/RecordFormModal.js";

const TYPE_LABELS: Record<string, string> = {
  expense: "支出", income: "收入", transfer: "轉帳", receivable: "應收",
  payable: "應付", balance_adjustment: "餘額調整", refund: "退款",
  interest: "利息", reward: "紅利", discount: "折扣",
};

const TYPE_COLORS: Record<string, string> = {
  expense: "bg-red-100 text-red-700", income: "bg-green-100 text-green-700",
  transfer: "bg-blue-100 text-blue-700",
};

/** Determine if a record is "money in" relative to the filtered account */
function isMoneyIn(record: IRecord, filteredAccountId?: string): boolean {
  if (["income", "refund", "reward", "discount"].includes(record.type)) return true;
  if (["expense", "interest", "payable"].includes(record.type)) return false;
  if (record.type === "transfer" && filteredAccountId) {
    return record.toAccount === filteredAccountId;
  }
  if (record.type === "receivable") return true;
  if (record.type === "balance_adjustment") return record.amount >= 0;
  return false;
}

export function RecordsListPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Modal state: null = closed, undefined = new, string = edit recordId
  const [modalRecordId, setModalRecordId] = useState<string | null | undefined>(null);
  const modalOpen = modalRecordId !== null;

  // Read filters from URL
  const filters: RecordFilters = useMemo(() => ({
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    type: searchParams.get("type") || undefined,
    category: searchParams.get("category") || undefined,
    account: searchParams.get("account") || undefined,
  }), [searchParams]);

  const setFilters = useCallback((next: RecordFilters) => {
    const params = new URLSearchParams();
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    if (next.type) params.set("type", next.type);
    if (next.category) params.set("category", next.category);
    if (next.account) params.set("account", next.account);
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  const { data: records, isLoading } = useQuery({
    queryKey: ["records", filters],
    queryFn: () => fetchRecords(filters),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });

  // Account name lookup
  const accountMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts ?? []) m.set(a._id, a.name);
    return m;
  }, [accounts]);

  const deleteMutation = useMutation({
    mutationFn: deleteRecord,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["records"] }),
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("確定要刪除這筆紀錄嗎？")) {
      deleteMutation.mutate(id);
    }
  };

  const formatAmount = (r: IRecord) => {
    const moneyIn = isMoneyIn(r, filters.account);
    const prefix = moneyIn ? "+" : "-";
    return `${prefix}$${r.amount.toLocaleString()}`;
  };

  const amountColor = (r: IRecord) => {
    const moneyIn = isMoneyIn(r, filters.account);
    return moneyIn ? "text-green-600" : "text-red-600";
  };

  /** Build subtitle for a record */
  const recordSubtitle = (r: IRecord) => {
    if (r.type === "transfer" && r.toAccount) {
      const from = accountMap.get(r.account as string) ?? "?";
      const to = accountMap.get(r.toAccount as string) ?? "?";
      const parts = [`${from} → ${to}`];
      if (r.note) parts.push(r.note);
      return parts.join(" · ");
    }
    if (r.type === "payable" || r.type === "receivable") {
      const parts: string[] = [];
      if ((r as any).counterparty) parts.push((r as any).counterparty);
      if (r.note) parts.push(r.note);
      return parts.join(" · ");
    }
    return [r.merchant, r.note].filter(Boolean).join(" · ") || "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">紀錄列表</h1>
        <button onClick={() => setModalRecordId(undefined)} className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm font-medium transition-colors">+ 新增紀錄</button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input type="date" value={filters.from ?? ""} onChange={(e) => setFilters({ ...filters, from: e.target.value || undefined })} className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="開始日期" />
          <input type="date" value={filters.to ?? ""} onChange={(e) => setFilters({ ...filters, to: e.target.value || undefined })} className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" placeholder="結束日期" />
          <select value={filters.type ?? ""} onChange={(e) => setFilters({ ...filters, type: e.target.value || undefined })} className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent">
            <option value="">所有類型</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filters.category ?? ""} onChange={(e) => setFilters({ ...filters, category: e.target.value || undefined })} className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent">
            <option value="">所有分類</option>
            {categories?.map((c) => <option key={c._id} value={c.name}>{c.icon} {c.name}</option>)}
          </select>
          <AccountFilterSelect accounts={accounts ?? []} value={filters.account ?? ""} onChange={(v) => setFilters({ ...filters, account: v || undefined })} className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
        </div>
      </div>

      {/* Records */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">載入中...</div>
      ) : !records || records.length === 0 ? (
        <div className="text-center py-12 text-gray-400">無紀錄</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {records.map((record) => (
              <div key={record._id} onClick={() => setModalRecordId(record._id)} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <span className="text-xs text-gray-400 shrink-0 w-20 leading-tight text-center">
                    <span>{dayjs(record.date).format("MM/DD")}</span>
                    <br />
                    <span>{dayjs(record.date).format("HH:mm")}</span>
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[record.type] ?? "bg-gray-100 text-gray-600"}`}>{TYPE_LABELS[record.type] ?? record.type}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{record.category}{record.subcategory ? ` › ${record.subcategory}` : ""}</p>
                    <p className="text-xs text-gray-400 truncate">{recordSubtitle(record)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 shrink-0 ml-2">
                  <span className={`text-sm font-semibold ${amountColor(record)}`}>{formatAmount(record)}</span>
                  <button onClick={(e) => handleDelete(e, record._id)} className="text-gray-300 hover:text-red-500 transition-colors" title="刪除">🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <RecordFormModal
          recordId={modalRecordId}
          onClose={() => setModalRecordId(null)}
        />
      )}
    </div>
  );
}
