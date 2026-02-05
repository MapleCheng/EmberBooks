import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { IAccount, IRecord, IBillingPeriod } from "@ember-books/shared";
import { fetchAccounts } from "../api/accounts.js";
import { fetchBillingPeriods, saveReconciliation } from "../api/statements.js";

function formatDate(d: string | Date): string {
  const date = new Date(d);
  return date.toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatShortDate(d: string | Date): string {
  const date = new Date(d);
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("zh-TW", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type RecordAction = "confirmed" | "deferred" | null;

export function StatementsPage() {
  const queryClient = useQueryClient();
  const [selectedCard, setSelectedCard] = useState<string>("");

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });

  const creditCards = accounts?.filter((a: IAccount) => a.type === "credit") || [];
  const effectiveCard = selectedCard || creditCards[0]?._id || "";

  const { data: periods, isLoading } = useQuery({
    queryKey: ["billingPeriods", effectiveCard],
    queryFn: () => fetchBillingPeriods(effectiveCard),
    enabled: !!effectiveCard,
  });

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">🧾 信用卡對帳</h1>

      {/* Card selector - Chip/Pill style */}
      <div className="flex flex-wrap gap-2 mb-6">
        {creditCards.length === 0 && (
          <span className="text-gray-400">無信用卡帳戶</span>
        )}
        {creditCards.map((card: IAccount) => (
          <button
            key={card._id}
            onClick={() => setSelectedCard(card._id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              effectiveCard === card._id
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            💳 {card.name}
            {card.billDay ? ` (${card.billDay}日結)` : ""}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">載入帳期中...</div>
      ) : !periods || periods.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">📭</div>
          <p>此信用卡尚無消費紀錄</p>
        </div>
      ) : (
        <div className="space-y-3">
          {periods.map((period: IBillingPeriod) => (
            <PeriodCard
              key={`${period.billingCycleStart}-${period.billingCycleEnd}`}
              period={period}
              accountId={effectiveCard}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PeriodCardProps {
  period: IBillingPeriod;
  accountId: string;
}

function PeriodCard({ period, accountId }: PeriodCardProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  // 每筆紀錄的動作：confirmed / deferred / null (未處理)
  const [actions, setActions] = useState<Map<string, RecordAction>>(() => {
    const map = new Map<string, RecordAction>();
    for (const r of period.records) {
      const rec = r as any;
      if (rec._deferredOut) {
        // 延出去的紀錄永遠顯示為「延期」（不論是否在目標帳期已確認）
        map.set(r._id, "deferred");
      } else if (r.reconciled) {
        map.set(r._id, "confirmed");
      }
      // _deferredIn 且未 reconciled → 預設未處理（不設 action）
    }
    return map;
  });

  const allRecords = useMemo(() => {
    return [...period.records].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [period]);

  const totalRecords = allRecords.length;

  const deferredOutCount = useMemo(() =>
    period.records.filter((r: any) => r._deferredOut).length,
    [period.records]
  );

  const confirmedIds = useMemo(() =>
    allRecords.filter((r) => {
      const rec = r as any;
      const act = actions.get(r._id);
      if (rec._deferredOut && act === "confirmed") return true;
      if (rec._deferredIn && act === "confirmed") return true;
      if (!rec._deferredOut && !rec._deferredIn && act === "confirmed") return true;
      return false;
    }).map((r) => r._id),
    [allRecords, actions]
  );

  const deferredIds = useMemo(() =>
    allRecords.filter((r) => {
      const rec = r as any;
      const act = actions.get(r._id);
      if (rec._deferredOut && act === "deferred") return false;
      if (rec._deferredIn && act === "deferred") return true;
      if (!rec._deferredOut && !rec._deferredIn && act === "deferred") return true;
      return false;
    }).map((r) => r._id),
    [allRecords, actions]
  );

  const unhandledCount = totalRecords - confirmedIds.length - deferredIds.length - deferredOutCount;

  const confirmedTotal = useMemo(() => {
    let total = 0;
    for (const r of allRecords) {
      const rec = r as any;
      if (actions.get(r._id) === "confirmed") {
        if (rec._deferredOut) continue;
        if (rec._isPayment) continue; // 繳款不計入帳單金額
        if (r.type === "refund" || r.type === "reward" || r.type === "discount" || r.type === "balance_adjustment") {
          total -= r.amount;
        } else {
          total += r.amount + (r.fee || 0);
        }
      }
    }
    return Math.round(total * 100) / 100;
  }, [allRecords, actions]);

  const setRecordAction = useCallback((id: string, action: RecordAction) => {
    setActions((prev) => {
      const next = new Map(prev);
      if (action === null) {
        next.delete(id);
      } else {
        next.set(id, action);
      }
      return next;
    });
  }, []);

  const confirmAll = useCallback(() => {
    const next = new Map<string, RecordAction>();
    for (const r of allRecords) {
      next.set(r._id, "confirmed");
    }
    setActions(next);
  }, [allRecords]);

  const clearAll = useCallback(() => {
    setActions(new Map());
  }, []);

  const deferredInCount = useMemo(() =>
    period.records.filter((r: any) => r._deferredIn).length,
    [period.records]
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      saveReconciliation({
        accountId,
        billingCycleStart: period.billingCycleStart,
        billingCycleEnd: period.billingCycleEnd,
        confirmedIds,
        deferredIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billingPeriods", accountId] });
    },
  });

  const allHandled = unhandledCount === 0 && totalRecords > 0;
  const hasAnyAction = confirmedIds.length > 0 || deferredIds.length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {period.status === "confirmed" ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">已對帳 ✅</span>
            ) : period.status === "pending" ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">對帳中 🔄</span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">未對帳</span>
            )}
            <span className="font-medium">
              {formatDate(period.billingCycleStart)} ~ {formatDate(period.billingCycleEnd)}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">
              {totalRecords} 筆
              {deferredOutCount > 0 && <span className="text-gray-400 ml-1">(含 {deferredOutCount} 筆已延期)</span>}
              {deferredInCount > 0 && <span className="text-orange-500 ml-1">(含 {deferredInCount} 筆延遞入)</span>}
            </span>
            <span className="font-semibold">${formatCurrency(period.totalAmount)}</span>
            <span className="text-gray-400">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="text-sm text-gray-600">
              確認 <strong className="text-blue-700">{confirmedIds.length}</strong> 筆
              {deferredIds.length > 0 && (
                <> · 延期 <strong className="text-orange-600">{deferredIds.length}</strong> 筆</>
              )}
              {unhandledCount > 0 && (
                <> · 未處理 <strong className="text-gray-500">{unhandledCount}</strong> 筆</>
              )}
              <span className="ml-2">（確認金額：<strong className="text-blue-700">${formatCurrency(confirmedTotal)}</strong>）</span>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmAll} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors">全部確認</button>
              <button onClick={clearAll} className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors">清除全部</button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
            {allRecords.map((rec) => (
              <RecordRow
                key={rec._id}
                record={rec}
                action={actions.get(rec._id) || null}
                onActionChange={(action) => setRecordAction(rec._id, action)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {allHandled ? "✅ 所有紀錄已處理" : `尚有 ${unhandledCount} 筆未處理`}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !hasAnyAction}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saveMutation.isPending ? "保存中..." : "💾 保存"}
              </button>
            </div>
          </div>

          {saveMutation.isError && (
            <div className="mt-2 text-red-600 text-sm">⚠️ {(saveMutation.error as Error)?.message || "保存失敗"}</div>
          )}
          {saveMutation.isSuccess && (
            <div className="mt-2 text-green-600 text-sm">✅ 已保存</div>
          )}
        </div>
      )}
    </div>
  );
}

function RecordRow({ record, action, onActionChange }: {
  record: IRecord;
  action: RecordAction;
  onActionChange: (action: RecordAction) => void;
}) {
  const rec = record as any;
  const isCredit = record.type === "refund" || record.type === "reward" || record.type === "discount";
  const isPayment = !!rec._isPayment;
  const isCashAdvance = !!rec._isCashAdvance;
  const isDeferredOut = !!rec._deferredOut;
  const isDeferredIn = !!rec._deferredIn;

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0 ${
      isDeferredOut ? "bg-gray-50 opacity-60" : isDeferredIn ? "bg-orange-50" : isPayment ? "bg-green-50" : isCashAdvance ? "bg-purple-50" : ""
    }`}>
      {/* Transfer badges */}
      {isPayment && <span className="text-xs px-1.5 py-0.5 rounded bg-green-200 text-green-700 shrink-0">繳款</span>}
      {isCashAdvance && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-200 text-purple-700 shrink-0">預借現金</span>}
      {/* Deferred badges */}
      {isDeferredOut && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 shrink-0">已延期</span>}
      {isDeferredIn && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-orange-200 text-orange-700 shrink-0">
          延遞 (原 {formatShortDate(record.date)})
        </span>
      )}

      {/* Date */}
      <span className="text-sm text-gray-500 w-12 shrink-0">{formatShortDate(record.date)}</span>

      {/* Merchant */}
      <span className="text-sm text-gray-600 w-24 truncate shrink-0">{record.merchant || "（無商家）"}</span>

      {/* Note / Category */}
      <span className="text-sm text-gray-500 flex-1 truncate">
        {record.note || record.category}{record.subcategory && ` / ${record.subcategory}`}
      </span>

      {/* Amount */}
      <span className={`text-sm font-mono shrink-0 ${isPayment ? "text-green-600" : isCredit ? "text-green-600" : "text-red-600"}`}>
        {isPayment ? "-" : isCredit ? "-" : ""}${formatCurrency(record.amount)}
        {record.fee ? <span className="text-xs text-gray-400 ml-1">(+{record.fee})</span> : null}
      </span>

      {/* Checkboxes (right side) */}
      <div className="flex items-center gap-3 shrink-0 ml-2">
        <label className="flex items-center gap-1 cursor-pointer" title="確認">
          <input
            type="checkbox"
            checked={action === "confirmed"}
            onChange={() => onActionChange(action === "confirmed" ? null : "confirmed")}
            className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-xs text-blue-600">確認</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer" title="延期">
          <input
            type="checkbox"
            checked={action === "deferred"}
            onChange={() => onActionChange(action === "deferred" ? null : "deferred")}
            className="w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-500"
          />
          <span className="text-xs text-orange-600">延期</span>
        </label>
      </div>
    </div>
  );
}
