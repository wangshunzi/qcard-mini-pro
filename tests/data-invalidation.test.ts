import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  invalidateData,
  markDataFresh,
  resetDataInvalidationForTests,
  shouldRefreshData,
  trackDayBoundary,
  trackVipExpiry,
  type DataDomain,
} from "../miniprogram/stores/dataInvalidation";

describe("page data invalidation", () => {
  beforeEach(() => resetDataInvalidationForTests());
  afterEach(() => {
    vi.useRealTimers();
    resetDataInvalidationForTests();
  });

  it("refreshes only pages that depend on the changed domain", () => {
    const target = {};
    const dependencies: DataDomain[] = ["account", "learning"];
    expect(shouldRefreshData(target, dependencies)).toBe(true);
    markDataFresh(target, dependencies);
    expect(shouldRefreshData(target, dependencies)).toBe(false);

    invalidateData("wallet");
    expect(shouldRefreshData(target, dependencies)).toBe(false);
    invalidateData("learning");
    expect(shouldRefreshData(target, dependencies)).toBe(true);
  });

  it("invalidates wallet and learning when a known VIP period expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T10:00:00+08:00"));
    const target = {};
    const dependencies: DataDomain[] = ["wallet", "learning"];
    markDataFresh(target, dependencies);

    trackVipExpiry(true, "2026-08-06T10:00:02+08:00");
    vi.advanceTimersByTime(3001);
    expect(shouldRefreshData(target, dependencies)).toBe(true);
  });

  it("invalidates daily data only after the local date changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T23:59:58+08:00"));
    const target = {};
    const dependencies: DataDomain[] = ["challenge", "wallet"];
    trackDayBoundary();
    markDataFresh(target, dependencies);
    trackDayBoundary();
    expect(shouldRefreshData(target, dependencies)).toBe(false);

    vi.setSystemTime(new Date("2026-08-07T00:00:02+08:00"));
    trackDayBoundary();
    expect(shouldRefreshData(target, dependencies)).toBe(true);
  });
});
