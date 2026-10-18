"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PieChart,
  ScanBarcode,
  ScrollText,
  Search,
  Settings,
  Tags,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { useAuth } from "@/components/providers";
import { useI18n, useSettings } from "@/lib/settings";
import { api } from "@/lib/client";
import type { PageResult, LowStockRow } from "@/lib/types";
import { cx } from "./ui";

const groups = [
  {
    label: "nav.inventory",
    items: [
      { href: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
      { href: "/products", label: "nav.products", icon: Package },
      { href: "/categories", label: "nav.categories", icon: Tags },
      { href: "/inventory", label: "nav.inventoryPage", icon: Warehouse },
      { href: "/low-stock", label: "nav.lowStock", icon: AlertTriangle },
    ],
  },
  {
    label: "nav.operations",
    items: [
      { href: "/purchase-orders", label: "nav.purchase", icon: ClipboardList },
      { href: "/sales-orders", label: "nav.sales", icon: ClipboardList },
      { href: "/stock-transfers", label: "nav.transfers", icon: ArrowLeftRight },
      { href: "/scanner", label: "nav.scanner", icon: ScanBarcode },
    ],
  },
  {
    label: "nav.people",
    items: [
      { href: "/customers", label: "nav.customers", icon: Users },
      { href: "/suppliers", label: "nav.suppliers", icon: Truck },
      { href: "/users", label: "nav.users", icon: UserCog },
    ],
  },
  {
    label: "nav.insights",
    items: [
      { href: "/reports", label: "nav.reports", icon: PieChart },
      { href: "/forecasting", label: "nav.forecast", icon: TrendingUp },
      { href: "/audit-logs", label: "nav.audit", icon: ScrollText },
    ],
  },
];

const tabs = [
  { href: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
  { href: "/scanner", label: "nav.scanner", icon: ScanBarcode },
  { href: "/orders", label: "nav.orders", icon: ClipboardList },
  { href: "/reports", label: "nav.reports", icon: PieChart },
  { href: "/settings", label: "nav.settings", icon: Settings },
];

function active(pathname: string, href: string) {
  if (href === "/orders") {
    return ["/orders", "/purchase-orders", "/sales-orders", "/stock-transfers"].some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Mark() {
  return <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest font-serif text-lg text-white">ស</span>;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState<Record<string, boolean>>({
    "nav.inventory": true,
    "nav.operations": true,
    "nav.people": true,
    "nav.insights": true,
  });
  return (
    <div className="grid gap-5">
      {groups.map((group) => (
        <div key={group.label}>
          <button
            type="button"
            className="mb-1 flex w-full items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40"
            onClick={() => setOpen((current) => ({ ...current, [group.label]: !current[group.label] }))}
          >
            {t(group.label)}
            <span>{open[group.label] ? "–" : "+"}</span>
          </button>
          {open[group.label] ? (
            <div className="grid gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const on = active(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cx(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                      on ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon size={16} />
                    {t(item.label)}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function BellButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LowStockRow[]>([]);
  useEffect(() => {
    api<PageResult<LowStockRow>>("/api/low-stock?pageSize=5")
      .then((result) => setRows(result.data))
      .catch(() => setRows([]));
  }, []);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink" aria-label={t("bell.title")}>
        <Bell size={16} />
        {rows.length ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-copper" /> : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-line bg-card p-3 shadow-xl">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">{t("bell.title")}</p>
          {rows.length === 0 ? <p className="px-2 py-3 text-sm text-ink-soft">{t("bell.empty")}</p> : rows.map((row) => (
            <Link key={row.id} href="/low-stock" onClick={() => setOpen(false)} className="block rounded-xl px-2 py-2 hover:bg-mist">
              <p className="text-sm font-medium">{row.product}</p>
              <p className="text-xs text-ink-soft">{row.warehouse} · {row.quantity} / {row.minStock}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// The products page listens for this event so a header search works even
// when the user is already on /products.
export const PRODUCT_SEARCH_EVENT = "ims:product-search";

function TopSearch() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (active(pathname, "/products")) {
      window.dispatchEvent(new CustomEvent(PRODUCT_SEARCH_EVENT, { detail: q }));
    } else {
      // The products page can mount before the URL updates, so hand the
      // query over through session storage as well.
      try {
        sessionStorage.setItem(PRODUCT_SEARCH_EVENT, q);
      } catch {}
      router.push(q ? `/products?search=${encodeURIComponent(q)}` : "/products");
    }
  }

  return (
    <form onSubmit={onSubmit} role="search" className="relative w-full max-w-xl">
      <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("top.search")}
        aria-label={t("top.search")}
        className="h-11 w-full rounded-full border border-line bg-white pl-11 pr-4 text-sm outline-none placeholder:text-ink-soft/80 focus:border-forest"
      />
    </form>
  );
}

function LanguageSwitch() {
  const { prefs, updatePrefs } = useSettings();
  const options = [
    { value: "en", label: "EN" },
    { value: "km", label: "ខ្មែរ" },
  ] as const;
  return (
    <div className="flex rounded-full border border-line bg-white p-1" role="group" aria-label="Language">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => updatePrefs({ ...prefs, language: option.value })}
          aria-pressed={prefs.language === option.value}
          className={cx(
            "rounded-full px-3 py-1 text-xs font-semibold",
            prefs.language === option.value ? "bg-forest text-white" : "text-ink-soft hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function UserBadge() {
  const { user } = useAuth();
  const { t } = useI18n();
  if (!user) return null;
  return (
    <div className="flex items-center gap-3">
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
      ) : (
        <span className="grid h-10 w-10 place-items-center rounded-full bg-forest font-serif text-lg text-white">{user.name.slice(0, 1)}</span>
      )}
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
        <p className="truncate text-xs text-ink-soft">{t(`role.${user.role}`)}</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { system } = useSettings();
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const title = [...groups.flatMap((group) => group.items), { href: "/settings", label: "nav.settings" }, { href: "/orders", label: "nav.orders" }]
    .find((item) => active(pathname, item.href));

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);
  useEffect(() => setDrawer(false), [pathname]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper">
        <div className="text-center">
          <Mark />
          <p className="mt-4 font-serif text-3xl">{system.name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-sidebar px-4 py-5 text-white lg:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-3 px-2">
          <Mark />
          <span>
            <span className="block font-serif text-xl leading-none">{system.name}</span>
            <span className="mt-1 block text-xs text-white/50">{system.subtitle}</span>
          </span>
        </Link>
        <div className="flex-1 overflow-y-auto pr-1">
          <NavLinks />
        </div>
        <div className="mt-4 grid gap-1 border-t border-white/10 pt-4">
          <Link href="/settings" className={cx("flex items-center gap-3 rounded-xl px-3 py-2 text-sm", active(pathname, "/settings") ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5")}>
            <Settings size={16} /> {t("nav.settings")}
          </Link>
          <button type="button" onClick={logout} className="flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/70 hover:bg-white/5">
            <LogOut size={16} /> {t("nav.logout")}
          </button>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setDrawer(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-white" aria-label="Menu">
            <Menu size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-lg">{title ? t(title.label) : system.name}</p>
          </div>
          <BellButton />
        </header>

        <div className="sticky top-0 z-20 hidden items-center gap-6 border-b border-line/80 bg-paper/85 px-6 py-3 backdrop-blur lg:flex xl:px-10">
          <TopSearch />
          <div className="ml-auto flex items-center gap-4">
            <BellButton />
            <UserBadge />
            <LanguageSwitch />
          </div>
        </div>

        <main className="mx-auto w-full min-w-0 max-w-[1180px] px-4 py-5 pb-[calc(6.25rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-8 lg:pb-10">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-card/95 px-1 pt-1.5 backdrop-blur lg:hidden pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const on = active(pathname, tab.href);
          return (
            <Link key={tab.href} href={tab.href} className={cx("flex min-w-0 flex-col items-center gap-0.5 rounded-2xl px-0.5 py-1 text-[10px] leading-tight sm:text-[11px]", on ? "text-forest" : "text-ink-soft")}>
              <Icon size={18} className="shrink-0" />
              <span className="w-full truncate text-center">{t(tab.label)}</span>
            </Link>
          );
        })}
      </nav>

      {drawer ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} aria-label="Close menu" />
          <div className="absolute inset-y-0 left-0 flex w-[min(86vw,280px)] max-w-full flex-col bg-sidebar px-4 py-5 text-white">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mark />
                <span className="font-serif text-xl">{system.name}</span>
              </div>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setDrawer(false)} />
            </div>
            <button type="button" onClick={logout} className="mt-4 flex items-center gap-3 border-t border-white/10 px-3 py-4 text-sm text-white/70">
              <LogOut size={16} /> {t("nav.logout")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
