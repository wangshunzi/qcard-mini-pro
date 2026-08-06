export type DataDomain =
  | "account"
  | "wallet"
  | "learning"
  | "content"
  | "favorites"
  | "orders"
  | "challenge";

type RefreshTarget = {
  _dataRevisionCheckpoint?: Partial<Record<DataDomain, number>>;
};

const revisions: Record<DataDomain, number> = {
  account: 0,
  wallet: 0,
  learning: 0,
  content: 0,
  favorites: 0,
  orders: 0,
  challenge: 0,
};

const MAX_TIMER_DELAY = 2_147_000_000;
let vipExpiryTimer: ReturnType<typeof setTimeout> | undefined;
let trackedVipExpiry = 0;
let notifiedVipExpiry = 0;
let dayBoundaryTimer: ReturnType<typeof setTimeout> | undefined;
let trackedDay = "";

function localDayKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function invalidateData(...domains: DataDomain[]) {
  new Set(domains).forEach((domain) => {
    revisions[domain] += 1;
  });
}

export function markDataFresh(
  target: RefreshTarget,
  domains: readonly DataDomain[],
) {
  target._dataRevisionCheckpoint = Object.fromEntries(
    domains.map((domain) => [domain, revisions[domain]]),
  );
}

export function shouldRefreshData(
  target: RefreshTarget,
  domains: readonly DataDomain[],
) {
  const checkpoint = target._dataRevisionCheckpoint;
  if (!checkpoint) return true;
  return domains.some((domain) => checkpoint[domain] !== revisions[domain]);
}

function clearVipExpiryTimer() {
  if (vipExpiryTimer) clearTimeout(vipExpiryTimer);
  vipExpiryTimer = undefined;
}

function scheduleVipExpiryCheck() {
  clearVipExpiryTimer();
  if (!trackedVipExpiry || notifiedVipExpiry === trackedVipExpiry) return;
  const remaining = trackedVipExpiry - Date.now();
  if (remaining <= 0) {
    notifiedVipExpiry = trackedVipExpiry;
    invalidateData("wallet", "learning");
    return;
  }
  vipExpiryTimer = setTimeout(
    scheduleVipExpiryCheck,
    Math.min(remaining + 1000, MAX_TIMER_DELAY),
  );
}

export function trackVipExpiry(isVip: boolean, value?: string | null) {
  const expiry = isVip && value ? Date.parse(value) : 0;
  const nextExpiry = Number.isFinite(expiry) && expiry > 0 ? expiry : 0;
  if (nextExpiry === trackedVipExpiry) return;
  trackedVipExpiry = nextExpiry;
  notifiedVipExpiry = 0;
  scheduleVipExpiryCheck();
}

export function trackDayBoundary() {
  const today = localDayKey();
  if (trackedDay && trackedDay !== today) {
    invalidateData("challenge", "wallet");
  }
  trackedDay = today;
  if (dayBoundaryTimer) clearTimeout(dayBoundaryTimer);
  const nextDay = new Date();
  nextDay.setHours(24, 0, 1, 0);
  dayBoundaryTimer = setTimeout(
    trackDayBoundary,
    Math.min(Math.max(1000, nextDay.getTime() - Date.now()), MAX_TIMER_DELAY),
  );
}

export function resetDataInvalidationForTests() {
  clearVipExpiryTimer();
  if (dayBoundaryTimer) clearTimeout(dayBoundaryTimer);
  dayBoundaryTimer = undefined;
  trackedDay = "";
  trackedVipExpiry = 0;
  notifiedVipExpiry = 0;
  (Object.keys(revisions) as DataDomain[]).forEach((domain) => {
    revisions[domain] = 0;
  });
}
