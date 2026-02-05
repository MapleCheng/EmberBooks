import { useState, useEffect, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import type { RecordType } from "@ember-books/shared";
import { fetchRecord, createRecord, updateRecord } from "../api/records.js";
import { fetchCategories } from "../api/categories.js";
import { fetchAccounts } from "../api/accounts.js";
import { CategoryChipSelector } from "./CategoryChipSelector.js";
import { GroupedAccountSelect } from "./GroupedAccountSelect.js";
import { RECORD_TYPES } from "@ember-books/shared";

const TYPE_LABELS: Record<string, string> = {
  expense: "支出", income: "收入", transfer: "轉帳", receivable: "應收",
  payable: "應付", balance_adjustment: "餘額調整", refund: "退款",
  interest: "利息", reward: "紅利", discount: "折扣",
};

interface Props {
  recordId?: string | null;
  onClose: () => void;
}

export function RecordFormModal({ recordId, onClose }: Props) {
  const isEdit = Boolean(recordId);
  const queryClient = useQueryClient();

  const [type, setType] = useState<RecordType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [time, setTime] = useState(dayjs().format("HH:mm"));
  const [account, setAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [fee, setFee] = useState("");
  const [discount, setDiscount] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [project, setProject] = useState("");
  const [error, setError] = useState("");

  const { data: existingRecord } = useQuery({
    queryKey: ["record", recordId],
    queryFn: () => fetchRecord(recordId!),
    enabled: isEdit,
  });

  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: accounts } = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });

  useEffect(() => {
    if (existingRecord) {
      setType(existingRecord.type);
      setAmount(String(existingRecord.amount));
      setCategory(existingRecord.category);
      setSubcategory(existingRecord.subcategory ?? "");
      setDate(dayjs(existingRecord.date).format("YYYY-MM-DD"));
      setTime(dayjs(existingRecord.date).format("HH:mm"));
      setAccount(existingRecord.account);
      setToAccount(existingRecord.toAccount ?? "");
      setMerchant(existingRecord.merchant ?? "");
      setFee(existingRecord.fee ? String(existingRecord.fee) : "");
      setDiscount(existingRecord.discount ? String(existingRecord.discount) : "");
      setNote(existingRecord.note ?? "");
      setTags(existingRecord.tags?.join(", ") ?? "");
      setCounterparty(existingRecord.counterparty ?? "");
      setProject(existingRecord.project ?? "");
    }
  }, [existingRecord]);

  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof createRecord>[0]) =>
      isEdit ? updateRecord(recordId!, data) : createRecord(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records"] });
      queryClient.invalidateQueries({ queryKey: ["accountBalances"] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const data = {
      type,
      amount: parseFloat(amount),
      category,
      subcategory: subcategory || undefined,
      date: new Date(`${date}T${time || "00:00"}`),
      account,
      toAccount: type === "transfer" ? toAccount || undefined : undefined,
      merchant: merchant || undefined,
      fee: fee ? parseFloat(fee) : undefined,
      discount: discount ? parseFloat(discount) : undefined,
      note: note || undefined,
      tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      counterparty: counterparty || undefined,
      project: project || undefined,
    };
    saveMutation.mutate(data);
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 animate-in fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">{isEdit ? "編輯紀錄" : "新增紀錄"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>類型 *</label>
              <select value={type} onChange={(e) => { setType(e.target.value as RecordType); setCategory(""); setSubcategory(""); }} className={inputClass} required>
                {RECORD_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>金額 *</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} required placeholder="0" />
            </div>
          </div>

          <div>
            <label className={labelClass}>分類 *</label>
            <CategoryChipSelector
              categories={categories ?? []}
              selectedCategory={category}
              selectedSubcategory={subcategory}
              onCategoryChange={(name) => { setCategory(name); setSubcategory(""); }}
              onSubcategoryChange={setSubcategory}
              type={type}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>日期 *</label>
              <div className="flex space-x-2">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} flex-1`} required />
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${inputClass} w-28`} />
              </div>
            </div>
            <div>
              <label className={labelClass}>帳戶 *</label>
              <GroupedAccountSelect accounts={accounts ?? []} value={account} onChange={setAccount} className={inputClass} required />
            </div>
          </div>

          {type === "transfer" && (
            <div>
              <label className={labelClass}>轉入帳戶</label>
              <GroupedAccountSelect accounts={accounts ?? []} value={toAccount} onChange={setToAccount} className={inputClass} excludeId={account} />
            </div>
          )}

          <div>
            <label className={labelClass}>商家</label>
            <input type="text" value={merchant} onChange={(e) => setMerchant(e.target.value)} className={inputClass} placeholder="商家名稱" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>手續費</label>
              <input type="number" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} className={inputClass} placeholder="0" />
            </div>
            <div>
              <label className={labelClass}>折扣</label>
              <input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputClass} placeholder="0" />
            </div>
          </div>

          <div>
            <label className={labelClass}>備註</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} rows={2} placeholder="備註..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>標籤</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} placeholder="逗號分隔" />
            </div>
            <div>
              <label className={labelClass}>對象</label>
              <input type="text" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} className={inputClass} placeholder="交易對象" />
            </div>
            <div>
              <label className={labelClass}>專案</label>
              <input type="text" value={project} onChange={(e) => setProject(e.target.value)} className={inputClass} placeholder="專案名稱" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors">取消</button>
            <button type="submit" disabled={saveMutation.isPending} className="px-4 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors">
              {saveMutation.isPending ? "儲存中..." : "儲存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
