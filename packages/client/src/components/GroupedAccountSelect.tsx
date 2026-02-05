import { useMemo } from "react";
import type { IAccount } from "@ember-books/shared";

/** Extract emoji prefix from group string (e.g. "🏦 銀行帳戶" → "🏦") */
function extractGroupEmoji(group: string): string {
  if (!group) return "💰";
  // Match leading emoji(s) — handles multi-codepoint emoji
  const match = group.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u);
  return match ? match[0] : "💰";
}

function accountLabel(a: IAccount): string {
  const icon = extractGroupEmoji(a.group);
  const currency =
    a.currency && a.currency !== "TWD" ? ` (${a.currency})` : "";
  return `${icon} ${a.name}${currency}`;
}

// ── Select (with optgroup) ──────────────────────────
interface GroupedAccountSelectProps {
  accounts: IAccount[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  excludeId?: string;
  placeholder?: string;
}

export function GroupedAccountSelect({
  accounts,
  value,
  onChange,
  className,
  required,
  excludeId,
  placeholder = "選擇帳戶",
}: GroupedAccountSelectProps) {
  const grouped = useMemo(() => {
    const filtered = excludeId
      ? accounts.filter((a) => a._id !== excludeId)
      : accounts;
    const groups: Record<string, IAccount[]> = {};
    for (const a of filtered) {
      const key = a.group || "💰 其他";
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    return Object.entries(groups);
  }, [accounts, excludeId]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      required={required}
    >
      <option value="">{placeholder}</option>
      {grouped.map(([group, accts]) => (
        <optgroup key={group} label={group}>
          {accts.map((a) => (
            <option key={a._id} value={a._id}>
              {accountLabel(a)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ── Grouped list display (for SettingsPage) ──────────
interface GroupedAccountListProps {
  accounts: IAccount[];
  renderAccount: (account: IAccount) => React.ReactNode;
}

export function GroupedAccountList({
  accounts,
  renderAccount,
}: GroupedAccountListProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, IAccount[]> = {};
    for (const a of accounts) {
      const key = a.group || "💰 其他";
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    return Object.entries(groups);
  }, [accounts]);

  return (
    <div className="space-y-6">
      {grouped.map(([group, accts]) => (
        <div key={group}>
          <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
            <span>{group}</span>
            <span className="text-xs text-gray-400 font-normal">
              ({accts.length})
            </span>
          </h3>
          <div className="space-y-2">{accts.map(renderAccount)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Filter chips for RecordsListPage ──────────────────
interface AccountFilterSelectProps {
  accounts: IAccount[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function AccountFilterSelect({
  accounts,
  value,
  onChange,
  className,
}: AccountFilterSelectProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, IAccount[]> = {};
    for (const a of accounts) {
      const key = a.group || "💰 其他";
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    return Object.entries(groups);
  }, [accounts]);

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">所有帳戶</option>
      {grouped.map(([group, accts]) => (
        <optgroup key={group} label={group}>
          {accts.map((a) => (
            <option key={a._id} value={a._id}>
              {accountLabel(a)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export { extractGroupEmoji, accountLabel };
