type AnalyticsMetadataValue = boolean | Date | number | string;
type AnalyticsMetadata = Record<string, AnalyticsMetadataValue>;

declare global {
  interface Window {
    sa_event?: (eventName: string, metadata?: AnalyticsMetadata) => void;
  }
}

export const analyticsEvents = {
  districtDeselected: "district_deselected",
  districtDeselectAll: "district_deselect_all",
  districtSelected: "district_selected",
  districtSelectAll: "district_select_all",
  appVisitStarted: "app_visit_started",
  exportCompleted: "export_completed",
  exportFailed: "export_failed",
  exportPartial: "export_partial",
  exportRepeatedInVisit: "export_repeated_in_visit",
  exportRetryClicked: "export_retry_clicked",
  exportStarted: "export_started",
  exportSubmitInvalid: "export_submit_invalid",
  keywordAdded: "keyword_added",
  keywordRemoved: "keyword_removed",
  regionRemoved: "region_removed",
  regionSelected: "region_selected",
  regionUnselected: "region_unselected",
  runAnotherExportClicked: "run_another_export_clicked",
  selectionCleared: "selection_cleared",
  stateCleared: "state_cleared",
  stateSelected: "state_selected"
} as const;

const FIRST_SEEN_AT_KEY = "easyed.analytics.firstSeenAt";
const LAST_SEEN_AT_KEY = "easyed.analytics.lastSeenAt";
const VISIT_COUNT_KEY = "easyed.analytics.visitCount";
const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(start: number, end: number) {
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

function bucketVisitCount(visitCount: number) {
  if (visitCount <= 1) return "1";
  if (visitCount <= 3) return "2-3";
  if (visitCount <= 10) return "4-10";
  return "11+";
}

function bucketDays(days: number) {
  if (days === 0) return "0";
  if (days <= 6) return "1-6";
  if (days <= 29) return "7-29";
  return "30+";
}

function readTimestamp(key: string) {
  const value = window.localStorage.getItem(key);
  if (!value) return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readVisitCount() {
  return toCount(window.localStorage.getItem(VISIT_COUNT_KEY));
}

export function getVisitAnalyticsMetadata(): AnalyticsMetadata {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const now = Date.now();
    const firstSeenAt = readTimestamp(FIRST_SEEN_AT_KEY) ?? now;
    const previousSeenAt = readTimestamp(LAST_SEEN_AT_KEY);
    const visitCount = readVisitCount() + 1;

    window.localStorage.setItem(FIRST_SEEN_AT_KEY, String(firstSeenAt));
    window.localStorage.setItem(LAST_SEEN_AT_KEY, String(now));
    window.localStorage.setItem(VISIT_COUNT_KEY, String(visitCount));

    return {
      days_since_first_seen_bucket: bucketDays(daysBetween(firstSeenAt, now)),
      days_since_last_seen_bucket: previousSeenAt === null ? "new" : bucketDays(daysBetween(previousSeenAt, now)),
      returning_browser: previousSeenAt !== null,
      visit_count_bucket: bucketVisitCount(visitCount)
    };
  } catch {
    return {};
  }
}

export function trackEvent(eventName: string, metadata?: AnalyticsMetadata) {
  if (typeof window === "undefined" || typeof window.sa_event !== "function") {
    return;
  }

  window.sa_event(eventName, metadata);
}

export function toCount(value: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
