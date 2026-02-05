import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type { ICategory, IAccount, AccountType } from "@ember-books/shared";
import { ACCOUNT_TYPES } from "@ember-books/shared";
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../api/categories.js";
import {
  fetchAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
} from "../api/accounts.js";
import {
  GroupedAccountList,
  extractGroupEmoji,
} from "../components/GroupedAccountSelect.js";

const SUGGESTED_GROUPS = [
  "🏦 銀行帳戶",
  "💵 現金",
  "📱 電子錢包",
  "📈 投資帳戶",
  "💳 信用卡",
];

type Tab = "categories" | "accounts";

const VALID_TABS: Tab[] = ["categories", "accounts"];

export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : "categories"
  );

  // Sync tab with URL query param changes
  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">設定</h1>

      <div className="mb-4">
        <a
          href="/settings/query"
          className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
        >
          🔍 資料庫查詢工具
        </a>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "categories"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
            onClick={() => setActiveTab("categories")}
          >
            分類管理
          </button>
          <button
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "accounts"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
            onClick={() => setActiveTab("accounts")}
          >
            帳戶管理
          </button>
        </nav>
      </div>

      {activeTab === "categories" && <CategoriesTab />}
      {activeTab === "accounts" && <AccountsTab />}
    </div>
  );
}

// ─── Categories Tab (unchanged) ────────────────────────────────
function CategoriesTab() {
  const queryClient = useQueryClient();
  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    icon: "",
    type: "expense",
    subcategories: "",
  });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsAdding(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ICategory> }) =>
      updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingId(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", icon: "", type: "expense", subcategories: "" });
  };

  const handleEdit = (category: ICategory) => {
    setEditingId(category._id);
    setFormData({
      name: category.name,
      icon: category.icon,
      type: category.type,
      subcategories: category.subcategories.join(", "),
    });
  };

  const handleSave = () => {
    const data = {
      name: formData.name,
      icon: formData.icon,
      type: formData.type,
      subcategories: formData.subcategories
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    resetForm();
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">載入中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">分類列表</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            新增分類
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold mb-3">新增分類</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <input
              type="text"
              placeholder="名稱"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="圖示 (emoji)"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="expense">支出</option>
              <option value="income">收入</option>
              <option value="transfer">轉帳</option>
            </select>
            <input
              type="text"
              placeholder="子分類 (逗號分隔)"
              value={formData.subcategories}
              onChange={(e) => setFormData({ ...formData, subcategories: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              儲存
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {categories?.map((category) => (
          <div
            key={category._id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            {editingId === category._id ? (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="expense">支出</option>
                    <option value="income">收入</option>
                    <option value="transfer">轉帳</option>
                  </select>
                  <input
                    type="text"
                    value={formData.subcategories}
                    onChange={(e) => setFormData({ ...formData, subcategories: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    儲存
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-3xl">{category.icon}</span>
                  <div>
                    <h3 className="font-semibold text-lg">{category.name}</h3>
                    <p className="text-sm text-gray-600">
                      類型：{category.type === "expense" ? "支出" : category.type === "income" ? "收入" : "轉帳"}
                    </p>
                    {category.subcategories.length > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        子分類：{category.subcategories.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(category)}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    編輯
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`確定要刪除「${category.name}」嗎？`)) {
                        deleteMutation.mutate(category._id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
                  >
                    刪除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Accounts Tab ──────────────────────────────────────────────
function AccountsTab() {
  const queryClient = useQueryClient();
  const { data: accounts, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "physical" as AccountType,
    group: "🏦 銀行帳戶",
    includeInStats: true,
    initialBalance: "0",
    currency: "TWD",
    creditLimit: "",
    billDay: "",
    payDay: "",
  });

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setIsAdding(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<IAccount> }) =>
      updateAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setEditingId(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      type: "physical",
      group: "🏦 銀行帳戶",
      includeInStats: true,
      initialBalance: "0",
      currency: "TWD",
      creditLimit: "",
      billDay: "",
      payDay: "",
    });
  };

  const handleEdit = (account: IAccount) => {
    setEditingId(account._id);
    setFormData({
      name: account.name,
      type: account.type,
      group: account.group || "",
      includeInStats: account.includeInStats !== false,
      initialBalance: String(account.initialBalance || 0),
      currency: account.currency || "TWD",
      creditLimit: account.creditLimit ? String(account.creditLimit) : "",
      billDay: account.billDay ? String(account.billDay) : "",
      payDay: account.payDay ? String(account.payDay) : "",
    });
  };

  const handleSave = () => {
    const data: any = {
      name: formData.name,
      type: formData.type,
      group: formData.group,
      includeInStats: formData.includeInStats,
      initialBalance: parseFloat(formData.initialBalance) || 0,
      currency: formData.currency,
    };
    if (formData.creditLimit) {
      data.creditLimit = parseFloat(formData.creditLimit) || undefined;
    }
    if (formData.billDay) {
      data.billDay = Number(formData.billDay);
    }
    if (formData.payDay) {
      data.payDay = Number(formData.payDay);
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    resetForm();
  };

  const getAccountTypeLabel = (type: AccountType) => {
    return type === "credit" ? "信用帳戶" : "實體帳戶";
  };

  // Auto-set group when type changes
  const handleTypeChange = (type: AccountType) => {
    const defaultGroup = type === "credit" ? "💳 信用卡" : "🏦 銀行帳戶";
    setFormData({ ...formData, type, group: defaultGroup });
  };

  const renderAccountForm = () => (
    <>
      <input
        type="text"
        placeholder="名稱"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <select
        value={formData.type}
        onChange={(e) => handleTypeChange(e.target.value as AccountType)}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {ACCOUNT_TYPES.map((type) => (
          <option key={type} value={type}>
            {getAccountTypeLabel(type)}
          </option>
        ))}
      </select>
      <div>
        <input
          type="text"
          placeholder="分組（如 🏦 銀行帳戶）"
          value={formData.group}
          onChange={(e) => setFormData({ ...formData, group: e.target.value })}
          list="group-suggestions"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <datalist id="group-suggestions">
          {SUGGESTED_GROUPS.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>
      <input
        type="number"
        placeholder="初始餘額"
        value={formData.initialBalance}
        onChange={(e) => setFormData({ ...formData, initialBalance: e.target.value })}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <input
        type="text"
        placeholder="幣別"
        value={formData.currency}
        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {formData.type === "credit" && (
        <input
          type="number"
          placeholder="信用額度"
          value={formData.creditLimit}
          onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      )}
      {formData.type === "credit" && (
        <select
          value={formData.billDay}
          onChange={(e) => setFormData({ ...formData, billDay: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">結帳日（每月幾號）- 可選</option>
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d} 日
            </option>
          ))}
        </select>
      )}
      {formData.type === "credit" && (
        <select
          value={formData.payDay}
          onChange={(e) => setFormData({ ...formData, payDay: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">繳費日（每月幾號）- 可選</option>
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d} 日
            </option>
          ))}
        </select>
      )}
      <label className="flex items-center gap-2 col-span-full">
        <input
          type="checkbox"
          checked={formData.includeInStats}
          onChange={(e) => setFormData({ ...formData, includeInStats: e.target.checked })}
          className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">納入統計（總資產/總負債/淨值）</span>
      </label>
    </>
  );

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">載入中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">帳戶列表</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            新增帳戶
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold mb-3">新增帳戶</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            {renderAccountForm()}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              儲存
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <GroupedAccountList
        accounts={accounts ?? []}
        renderAccount={(account) => (
          <div
            key={account._id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            {editingId === account._id ? (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  {renderAccountForm()}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    儲存
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{extractGroupEmoji(account.group)}</span>
                  <div>
                    <h3 className="font-semibold text-lg">
                      {account.name}
                      {!account.includeInStats && (
                        <span className="ml-2 text-xs text-gray-400 font-normal">（不納入統計）</span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {account.group || getAccountTypeLabel(account.type)}
                      {account.initialBalance ? (
                        <span className="ml-2 text-gray-400">
                          (初始餘額: {account.initialBalance.toLocaleString()})
                        </span>
                      ) : null}
                      {account.currency && account.currency !== "TWD" && (
                        <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {account.currency}
                        </span>
                      )}
                      {account.type === "credit" && account.creditLimit && (
                        <span className="ml-2 text-gray-400">
                          額度: {account.creditLimit.toLocaleString()}
                        </span>
                      )}
                      {account.type === "credit" && (account.billDay || account.payDay) && (
                        <span className="ml-2 text-gray-400">
                          {account.billDay && `結帳日: ${account.billDay}`}
                          {account.billDay && account.payDay && " · "}
                          {account.payDay && `繳費日: ${account.payDay}`}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(account)}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    編輯
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`確定要刪除「${account.name}」嗎？`)) {
                        deleteMutation.mutate(account._id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
                  >
                    刪除
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}
