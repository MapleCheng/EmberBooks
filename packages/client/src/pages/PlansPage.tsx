import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { IPaymentPlan, IAccount, ICategory, IRecord } from "@ember-books/shared";
import {
  fetchPlans,
  createPlan,
  updatePlan,
  deletePlan,
  fetchPlanDetail,
  extendPlan,
  updatePlanRecord,
  confirmRecord,
  deletePlanRecord,
  addPlanRecord,
  type PlanDetail,
} from "../api/plans.js";
import { fetchAccounts } from "../api/accounts.js";
import { fetchCategories } from "../api/categories.js";
import { GroupedAccountSelect, extractGroupEmoji } from "../components/GroupedAccountSelect.js";
import { CategoryChipSelector } from "../components/CategoryChipSelector.js";

// ─── Helpers ───────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString("zh-TW");
}

function fmtDate(d: string | Date): string {
  const date = new Date(d);
  return date.toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function getAccountIcon(acct: IAccount): string {
  return extractGroupEmoji(acct.group);
}

const STATUS_BADGE: Record<string, { icon: string; label: string; cls: string }> = {
  confirmed: { icon: "✅", label: "已繳", cls: "bg-green-100 text-green-700" },
  scheduled: { icon: "⏳", label: "排定", cls: "bg-yellow-100 text-yellow-700" },
};

type PlanFormType = "installment" | "recurring";
type FrequencyType = "monthly" | "yearly" | "weekly";

// ─── Form Modal ────────────────────────────────────────────────

interface FormData {
  name: string;
  type: PlanFormType;
  amount: string;
  totalPeriods: string;
  frequency: FrequencyType;
  paymentDay: string;
  startDate: string;
  accountId: string;
  category: string;
  subcategory: string;
  counterparty: string;
  note: string;
}

const emptyForm: FormData = {
  name: "",
  type: "installment",
  amount: "",
  totalPeriods: "",
  frequency: "monthly",
  paymentDay: "",
  startDate: new Date().toISOString().slice(0, 10),
  accountId: "",
  category: "",
  subcategory: "",
  counterparty: "",
  note: "",
};

function PlanFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  accounts,
  categories,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  initialData?: FormData;
  accounts: IAccount[];
  categories: ICategory[];
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState<FormData>(initialData || emptyForm);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const categoryType = form.type === "installment" ? "payable" : "expense";
  const totalAmount = form.amount && form.totalPeriods
    ? Number(form.amount) * Number(form.totalPeriods)
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">
              {initialData ? "編輯" : "新增"}付款計畫
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">類型</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: "installment" })}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.type === "installment"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  📋 分期付款
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: "recurring" })}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.type === "recurring"
                      ? "bg-green-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  🔄 循環支付
                </button>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">名稱</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={form.type === "installment" ? "例：車貸分期" : "例：健身房會員"}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Amount + Periods */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">每期金額</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="每期金額"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              {form.type === "installment" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">總期數</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={form.totalPeriods}
                    onChange={(e) => setForm({ ...form, totalPeriods: e.target.value })}
                    placeholder="期數"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}
            </div>

            {/* Preview total amount */}
            {form.type === "installment" && totalAmount > 0 && (
              <div className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-md">
                總金額：${fmt(totalAmount)}（{form.totalPeriods} 期 × ${fmt(Number(form.amount))}）
              </div>
            )}
            {form.type === "recurring" && (
              <div className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-md">
                將自動產生 12 期（一年份），之後可延展
              </div>
            )}

            {/* Frequency + Payment Day */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">頻率</label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value as FrequencyType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="monthly">每月</option>
                  <option value="weekly">每週</option>
                  <option value="yearly">每年</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">扣款日</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="28"
                  value={form.paymentDay}
                  onChange={(e) => setForm({ ...form, paymentDay: e.target.value })}
                  placeholder="1-28"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Account */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">扣款帳戶</label>
              <GroupedAccountSelect
                accounts={accounts}
                value={form.accountId}
                onChange={(v) => setForm({ ...form, accountId: v })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">分類</label>
              <CategoryChipSelector
                categories={categories}
                selectedCategory={form.category}
                selectedSubcategory={form.subcategory}
                onCategoryChange={(v) => setForm({ ...form, category: v, subcategory: "" })}
                onSubcategoryChange={(v) => setForm({ ...form, subcategory: v })}
                type={categoryType}
              />
            </div>

            {/* Counterparty */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">對象（選填）</label>
              <input
                type="text"
                value={form.counterparty}
                onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
                placeholder="例：XX 銀行、健身房"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備註（選填）</label>
              <input
                type="text"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "建立中..." : "建立計畫"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Edit Amount ────────────────────────────────────────

function InlineEditAmount({
  value,
  onSave,
}: {
  value: number;
  onSave: (newVal: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:text-orange-600 hover:underline"
        onClick={() => { setEditValue(String(value)); setEditing(true); }}
        title="點擊編輯"
      >
        ${fmt(value)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        className="w-24 px-1 py-0.5 border border-orange-400 rounded text-sm focus:outline-none"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(Number(editValue)); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        onClick={() => { onSave(Number(editValue)); setEditing(false); }}
        className="text-green-600 text-xs"
      >✓</button>
      <button onClick={() => setEditing(false)} className="text-gray-400 text-xs">✕</button>
    </span>
  );
}

// ─── Inline Edit Date ──────────────────────────────────────────

function InlineEditDate({
  value,
  onSave,
}: {
  value: string | Date;
  onSave: (newDate: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const dateStr = new Date(value).toISOString().slice(0, 10);
  const [editValue, setEditValue] = useState(dateStr);

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:text-orange-600 hover:underline"
        onClick={() => { setEditValue(dateStr); setEditing(true); }}
        title="點擊修改日期"
      >
        {fmtDate(value)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="date"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        className="px-1 py-0.5 border border-orange-400 rounded text-sm focus:outline-none"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(editValue); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        onClick={() => { onSave(editValue); setEditing(false); }}
        className="text-green-600 text-xs"
      >✓</button>
      <button onClick={() => setEditing(false)} className="text-gray-400 text-xs">✕</button>
    </span>
  );
}

// ─── Plan Detail Panel ─────────────────────────────────────────

function PlanDetailModal({
  planId,
  accounts,
  onClose,
}: {
  planId: string;
  accounts: IAccount[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const invalidateDetail = () => {
    queryClient.invalidateQueries({ queryKey: ["planDetail", planId] });
    queryClient.invalidateQueries({ queryKey: ["plans"] });
  };

  const { data, isLoading } = useQuery({
    queryKey: ["planDetail", planId],
    queryFn: () => fetchPlanDetail(planId),
  });

  const confirmMutation = useMutation({
    mutationFn: ({ recordId }: { recordId: string }) => confirmRecord(planId, recordId),
    onSuccess: invalidateDetail,
  });

  const deleteRecordMutation = useMutation({
    mutationFn: ({ recordId }: { recordId: string }) => deletePlanRecord(planId, recordId),
    onSuccess: invalidateDetail,
  });

  const addRecordMutation = useMutation({
    mutationFn: (payload: { amount?: number; date?: string } | void) =>
      addPlanRecord(planId, payload || undefined),
    onSuccess: invalidateDetail,
  });

  const updateRecordMutation = useMutation({
    mutationFn: ({ recordId, data: d }: { recordId: string; data: Record<string, unknown> }) =>
      updatePlanRecord(planId, recordId, d),
    onSuccess: invalidateDetail,
  });

  const extendMutation = useMutation({
    mutationFn: () => extendPlan(planId),
    onSuccess: invalidateDetail,
  });

  const plan = data?.plan;
  const records = data?.records;
  const summary = data?.summary;
  const acct = plan ? accounts.find((a) => a._id === plan.accountId) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">載入中...</div>
        ) : !data ? (
          <div className="text-center py-12 text-gray-400">無資料</div>
        ) : (
          <>
            {/* Header */}
            <div className="p-5 border-b border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold">{plan!.name}</h3>
                  <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                    {plan!.counterparty && <span>📎 {plan!.counterparty}</span>}
                    {acct && <span>{getAccountIcon(acct)} {acct.name}</span>}
                    <span>{plan!.type === "installment" ? "📋 分期" : "🔄 循環"}</span>
                  </div>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>

              {/* Amount summary */}
              <div className="grid grid-cols-3 gap-3 mt-4 bg-gray-50 rounded-lg p-3 text-center">
                <div>
                  <div className="text-xs text-gray-500">總額</div>
                  <div className="text-base font-bold">${fmt(summary!.totalAmount)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">已繳</div>
                  <div className="text-base font-bold text-green-600">${fmt(summary!.paidAmount)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">未繳餘額</div>
                  <div className="text-base font-bold text-red-600">${fmt(summary!.unpaidAmount)}</div>
                </div>
              </div>

              {/* Period progress */}
              <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                <div>
                  <div className="text-xs text-gray-500">已繳</div>
                  <div className="text-lg font-bold text-green-600">{summary!.paidCount} 期</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">待繳</div>
                  <div className="text-lg font-bold text-yellow-600">{summary!.remainingCount} 期</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">總期數</div>
                  <div className="text-lg font-bold">{summary!.totalPeriods} 期</div>
                </div>
              </div>

              {/* Progress bar */}
              {summary!.totalPeriods > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>第 {summary!.paidCount}/{summary!.totalPeriods} 期</span>
                    <span>{Math.round((summary!.paidCount / summary!.totalPeriods) * 100)}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.min((summary!.paidCount / summary!.totalPeriods) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Records table */}
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">期數</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">日期</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">金額</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">狀態</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {records!.map((rec: IRecord) => {
                    const status = STATUS_BADGE[rec.paymentStatus || "scheduled"] || STATUS_BADGE.scheduled;
                    return (
                      <tr key={rec._id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-600">
                          {summary!.totalPeriods
                            ? `${(rec.periodIndex ?? 0) + 1}/${summary!.totalPeriods}`
                            : rec.periodIndex}
                        </td>
                        <td className="px-4 py-2 text-gray-600">
                          <InlineEditDate
                            value={rec.date}
                            onSave={(newDate) => updateRecordMutation.mutate({
                              recordId: rec._id,
                              data: { date: newDate },
                            })}
                          />
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          <InlineEditAmount
                            value={rec.amount}
                            onSave={(newVal) => updateRecordMutation.mutate({
                              recordId: rec._id,
                              data: { amount: newVal },
                            })}
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${status.cls}`}>
                            {status.icon} {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {rec.paymentStatus === "scheduled" && (
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => confirmMutation.mutate({ recordId: rec._id })}
                                disabled={confirmMutation.isPending}
                                className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                              >
                                確認
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm("確定刪除此期紀錄？")) {
                                    deleteRecordMutation.mutate({ recordId: rec._id });
                                  }
                                }}
                                disabled={deleteRecordMutation.isPending}
                                className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                              >
                                刪除
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer actions */}
            <div className="p-4 border-t border-gray-100 flex flex-col gap-2">
              <button
                onClick={() => addRecordMutation.mutate()}
                disabled={addRecordMutation.isPending}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {addRecordMutation.isPending ? "新增中..." : "＋ 新增一期"}
              </button>
              {plan!.type === "recurring" && (
                <button
                  onClick={() => extendMutation.mutate()}
                  disabled={extendMutation.isPending}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  {extendMutation.isPending ? "延展中..." : "🔄 延展一年（+12 期）"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Installment Card ──────────────────────────────────────────

function InstallmentCard({
  item,
  accounts,
  onView,
  onEdit,
  onDelete,
}: {
  item: IPaymentPlan;
  accounts: IAccount[];
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const acct = accounts.find((a) => a._id === item.accountId);

  // Estimate end date
  const endDate = new Date(item.startDate);
  if (item.frequency === "monthly" && item.totalPeriods) {
    endDate.setMonth(endDate.getMonth() + item.totalPeriods);
  }

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:border-orange-300 transition-colors"
      onClick={onView}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-lg">{item.name}</h3>
          {item.counterparty && (
            <span className="text-sm text-gray-500">{item.counterparty}</span>
          )}
        </div>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={onEdit} title="編輯" className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors">✏️</button>
          <button onClick={onDelete} title="刪除" className="p-1.5 text-gray-400 hover:text-red-600 transition-colors">🗑️</button>
        </div>
      </div>

      {/* Amount info */}
      <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
        <div>
          <span className="text-gray-500">每期</span>
          <div className="font-semibold text-lg">${fmt(item.amount)}</div>
        </div>
        <div>
          <span className="text-gray-500">總額</span>
          <div className="font-semibold text-lg">${fmt(item.totalAmount || 0)}</div>
        </div>
        <div>
          <span className="text-gray-500">總期數</span>
          <div className="font-semibold text-lg">{item.totalPeriods || "∞"} 期</div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
        {acct && (
          <div>
            <span className="text-gray-400">扣款帳戶：</span>
            <span>{getAccountIcon(acct)} {acct.name}</span>
          </div>
        )}
        <div>
          <span className="text-gray-400">預計完成：</span>
          <span className="font-medium">{fmtDate(endDate)}</span>
        </div>
      </div>

      {item.status !== "active" && (
        <div className="mt-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            item.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
          }`}>
            {item.status === "completed" ? "✅ 已完成" : "⏸️ 已暫停"}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Recurring Card ────────────────────────────────────────────

function RecurringCard({
  item,
  accounts,
  onView,
  onEdit,
  onDelete,
}: {
  item: IPaymentPlan;
  accounts: IAccount[];
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const acct = accounts.find((a) => a._id === item.accountId);
  const yearlyAmount = item.frequency === "monthly" ? item.amount * 12
    : item.frequency === "weekly" ? item.amount * 52
    : item.amount;

  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer hover:border-orange-300 transition-colors"
      onClick={onView}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold truncate">{item.name}</h3>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            item.status === "active" ? "bg-green-100 text-green-700" :
            item.status === "paused" ? "bg-yellow-100 text-yellow-700" :
            "bg-gray-100 text-gray-500"
          }`}>
            {item.status === "active" ? "進行中" : item.status === "paused" ? "已暫停" : "已完成"}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
          <span className="font-semibold text-gray-800">
            ${fmt(item.amount)} / {item.frequency === "monthly" ? "月" : item.frequency === "weekly" ? "週" : "年"}
          </span>
          {acct && <span>{getAccountIcon(acct)} {acct.name}</span>}
          <span>年度花費：${fmt(yearlyAmount)}</span>
          {item.counterparty && <span>對象：{item.counterparty}</span>}
        </div>
      </div>
      <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button onClick={onEdit} title="編輯" className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-md hover:bg-gray-50">✏️</button>
        <button onClick={onDelete} title="刪除" className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-md hover:bg-gray-50">🗑️</button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export function PlansPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"installment" | "recurring">("installment");
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<IPaymentPlan | null>(null);
  const [viewingPlanId, setViewingPlanId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");

  // Queries
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans", statusFilter],
    queryFn: () => fetchPlans(statusFilter || undefined),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<IPaymentPlan> }) =>
      updatePlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      setEditingPlan(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      if (viewingPlanId) setViewingPlanId(null);
    },
  });

  // Handlers
  const handleCreate = (form: FormData) => {
    const payload: Record<string, unknown> = {
      name: form.name,
      type: form.type,
      amount: Number(form.amount),
      frequency: form.frequency,
      paymentDay: Number(form.paymentDay),
      startDate: form.startDate,
      accountId: form.accountId,
      category: form.category,
      subcategory: form.subcategory || undefined,
      counterparty: form.counterparty || undefined,
      note: form.note || undefined,
    };

    if (form.type === "installment") {
      payload.totalPeriods = Number(form.totalPeriods);
    }

    createMutation.mutate(payload);
  };

  const handleEditSubmit = (form: FormData) => {
    if (!editingPlan) return;
    updateMutation.mutate({
      id: editingPlan._id,
      data: {
        name: form.name,
        accountId: form.accountId,
        category: form.category,
        subcategory: form.subcategory || undefined,
        counterparty: form.counterparty || undefined,
        note: form.note || undefined,
      } as Partial<IPaymentPlan>,
    });
  };

  const handleDelete = (item: IPaymentPlan) => {
    if (confirm(`確定要刪除「${item.name}」嗎？已繳的紀錄會保留，排定中的會一併刪除。`)) {
      deleteMutation.mutate(item._id);
    }
  };

  // Split by type
  const installments = plans.filter((p) => p.type === "installment");
  const recurrings = plans.filter((p) => p.type === "recurring");
  const displayList = activeTab === "installment" ? installments : recurrings;

  // Edit form data
  const editFormData: FormData | undefined = editingPlan
    ? {
        name: editingPlan.name,
        type: editingPlan.type as PlanFormType,
        amount: String(editingPlan.amount),
        totalPeriods: String(editingPlan.totalPeriods || ""),
        frequency: editingPlan.frequency as FrequencyType,
        paymentDay: String(editingPlan.paymentDay),
        startDate: new Date(editingPlan.startDate).toISOString().slice(0, 10),
        accountId: editingPlan.accountId,
        category: editingPlan.category,
        subcategory: editingPlan.subcategory || "",
        counterparty: editingPlan.counterparty || "",
        note: editingPlan.note || "",
      }
    : undefined;

  // Summary stats
  const totalMonthlyInstallment = installments
    .filter((p) => p.status === "active")
    .reduce((s, p) => s + p.amount, 0);
  const totalMonthlyRecurring = recurrings
    .filter((p) => p.status === "active")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold">📋 分期 / 循環支付</h1>
        <button
          onClick={() => { setEditingPlan(null); setShowForm(true); }}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          ＋ 新增計畫
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        <button
          onClick={() => setActiveTab("installment")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "installment"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📋 分期付款 ({installments.length})
        </button>
        <button
          onClick={() => setActiveTab("recurring")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "recurring"
              ? "border-green-500 text-green-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          🔄 循環支付 ({recurrings.length})
        </button>
      </div>

      {/* Filter + Summary */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2">
          {[
            { value: "active", label: "進行中" },
            { value: "", label: "全部" },
            { value: "completed", label: "已完成" },
            { value: "paused", label: "已暫停" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === opt.value
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex-1 flex justify-end gap-4 text-sm text-gray-600">
          <span>分期 ${fmt(totalMonthlyInstallment)}/月</span>
          <span>循環 ${fmt(totalMonthlyRecurring)}/月</span>
          <span className="font-semibold text-gray-800">
            合計 ${fmt(totalMonthlyInstallment + totalMonthlyRecurring)}/月
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-gray-500">載入中...</div>
      )}

      {/* Detail modal */}
      {viewingPlanId && (
        <PlanDetailModal
          planId={viewingPlanId}
          accounts={accounts}
          onClose={() => setViewingPlanId(null)}
        />
      )}

      {/* Cards */}
      {!isLoading && activeTab === "installment" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {installments.map((item) => (
            <InstallmentCard
              key={item._id}
              item={item}
              accounts={accounts}
              onView={() => setViewingPlanId(viewingPlanId === item._id ? null : item._id)}
              onEdit={() => setEditingPlan(item)}
              onDelete={() => handleDelete(item)}
            />
          ))}
        </div>
      )}

      {!isLoading && activeTab === "recurring" && (
        <div className="space-y-3">
          {recurrings.map((item) => (
            <RecurringCard
              key={item._id}
              item={item}
              accounts={accounts}
              onView={() => setViewingPlanId(viewingPlanId === item._id ? null : item._id)}
              onEdit={() => setEditingPlan(item)}
              onDelete={() => handleDelete(item)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && displayList.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">{activeTab === "installment" ? "📋" : "🔄"}</div>
          <p className="text-lg mb-2">
            尚無{statusFilter === "active" ? "進行中的" : ""}
            {activeTab === "installment" ? "分期付款" : "循環支付"}
          </p>
          <p className="text-sm">點擊「＋ 新增計畫」來建立</p>
        </div>
      )}

      {/* Form Modal - New */}
      <PlanFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreate}
        accounts={accounts}
        categories={categories}
        isSubmitting={createMutation.isPending}
      />

      {/* Form Modal - Edit */}
      <PlanFormModal
        isOpen={!!editingPlan}
        onClose={() => setEditingPlan(null)}
        onSubmit={handleEditSubmit}
        initialData={editFormData}
        accounts={accounts}
        categories={categories}
        isSubmitting={updateMutation.isPending}
      />
    </div>
  );
}
