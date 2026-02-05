import { Link, Outlet, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext.js";

interface NavItem {
  to?: string;
  label: string;
  icon: string;
  children?: { to: string; label: string }[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/records", label: "紀錄", icon: "📝" },
  {
    label: "資產",
    icon: "💰",
    children: [
      { to: "/accounts", label: "帳戶總覽" },
      { to: "/statements", label: "信用卡對帳" },
    ],
  },
  {
    label: "報表",
    icon: "📈",
    children: [
      { to: "/reports/monthly", label: "月報" },
      { to: "/reports/yearly", label: "年報" },
      { to: "/budget", label: "預算追蹤" },
      { to: "/cashflow", label: "現金流量" },
    ],
  },
  { to: "/plans", label: "計畫", icon: "📋" },
  {
    label: "設定",
    icon: "⚙️",
    children: [
      { to: "/settings?tab=accounts", label: "帳戶管理" },
      { to: "/settings?tab=categories", label: "分類管理" },
      { to: "/import", label: "匯入資料" },
      { to: "/profile", label: "個人設定" },
    ],
  },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Close desktop dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleDropdown = useCallback((label: string) => {
    setOpenDropdown((prev) => (prev === label ? null : label));
  }, []);

  const toggleMobileExpanded = useCallback((label: string) => {
    setMobileExpanded((prev) => (prev === label ? null : label));
  }, []);

  const closeAll = useCallback(() => {
    setOpenDropdown(null);
    setMenuOpen(false);
    setMobileExpanded(null);
  }, []);

  const linkClass =
    "px-3 py-2 text-sm font-medium text-gray-600 hover:text-orange-600 rounded-md hover:bg-orange-50 transition-colors";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left: Logo + Nav */}
            <div className="flex items-center" ref={navRef}>
              <Link to="/" className="text-xl font-bold text-orange-600" onClick={closeAll}>
                🔥 EmberBooks
              </Link>

              {/* Desktop nav */}
              <div className="hidden md:ml-8 md:flex md:items-center md:space-x-1">
                {NAV_ITEMS.map((item) =>
                  item.children ? (
                    <DesktopDropdown
                      key={item.label}
                      item={item}
                      isOpen={openDropdown === item.label}
                      onToggle={() => toggleDropdown(item.label)}
                      onNavigate={closeAll}
                      linkClass={linkClass}
                    />
                  ) : (
                    <Link
                      key={item.to}
                      to={item.to!}
                      className={linkClass}
                      onClick={closeAll}
                    >
                      {item.icon} {item.label}
                    </Link>
                  )
                )}
              </div>
            </div>

            {/* Right: user info + logout (desktop) */}
            <div className="hidden md:flex md:items-center md:space-x-4">
              <span className="text-sm text-gray-500">{user?.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-red-600 transition-colors"
              >
                登出
              </button>
            </div>

            {/* Hamburger (mobile) */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="text-gray-600 p-2 text-xl"
              >
                {menuOpen ? "✕" : "☰"}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-3 space-y-1">
              {NAV_ITEMS.map((item) =>
                item.children ? (
                  <MobileDropdown
                    key={item.label}
                    item={item}
                    isExpanded={mobileExpanded === item.label}
                    onToggle={() => toggleMobileExpanded(item.label)}
                    onNavigate={closeAll}
                  />
                ) : (
                  <Link
                    key={item.to}
                    to={item.to!}
                    onClick={closeAll}
                    className="block px-3 py-2 text-sm font-medium text-gray-600 hover:text-orange-600 rounded-md hover:bg-orange-50"
                  >
                    {item.icon} {item.label}
                  </Link>
                )
              )}
              <div className="border-t border-gray-200 pt-2 mt-2">
                <span className="block px-3 py-1 text-sm text-gray-500">
                  {user?.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
                >
                  登出
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}

/* ── Desktop Dropdown ──────────────────────────────── */
function DesktopDropdown({
  item,
  isOpen,
  onToggle,
  onNavigate,
  linkClass,
}: {
  item: NavItem;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  linkClass: string;
}) {
  return (
    <div className="relative">
      <button onClick={onToggle} className={linkClass}>
        {item.icon} {item.label} ▾
      </button>
      {isOpen && (
        <div className="absolute left-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {item.children!.map((child) => (
            <Link
              key={child.to}
              to={child.to}
              onClick={onNavigate}
              className="block px-4 py-2 text-sm text-gray-600 hover:text-orange-600 hover:bg-orange-50"
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Mobile Dropdown ───────────────────────────────── */
function MobileDropdown({
  item,
  isExpanded,
  onToggle,
  onNavigate,
}: {
  item: NavItem;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-600 hover:text-orange-600 rounded-md hover:bg-orange-50"
      >
        <span>
          {item.icon} {item.label}
        </span>
        <span className="text-xs text-gray-400">{isExpanded ? "▲" : "▼"}</span>
      </button>
      {isExpanded && (
        <div className="ml-6 space-y-1">
          {item.children!.map((child) => (
            <Link
              key={child.to}
              to={child.to}
              onClick={onNavigate}
              className="block px-3 py-2 text-sm text-gray-500 hover:text-orange-600 rounded-md hover:bg-orange-50"
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
