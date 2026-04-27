import { filenameFromDisposition } from "./edjoin";

const EXPORT_ENDPOINT_PATH = "/api/edjoin/export";

export const GENERIC_EXPORT_ERROR_MESSAGE =
  "Export failed. Please try again. If the problem persists, contact support.";

export interface ExportLocationDistrict {
  districtId: number;
  name: string;
}

export interface ExportLocationRegion {
  children: ExportLocationDistrict[];
  name: string;
  searchRegionId: number;
}

export interface ExportLocationState {
  children: ExportLocationRegion[];
  name: string;
  stateId: number;
}

export interface StartExportJobPayload {
  exclude_keywords: string[];
  include_keywords: string[];
  locations: ExportLocationState;
}

interface PollStatusJson {
  currentDistrict?: string | null;
  current_district?: string | null;
  district?: string | null;
  status?: string;
}

interface StartExportJobResponse {
  job_id?: number | string;
  poll_url?: string;
  status?: string;
}

export interface StartedExportJob {
  jobId: string;
  pollUrl: string;
}

export interface InProgressExportJobResult {
  currentDistrict: string | null;
  kind: "progress";
}

export interface CompletedExportJobResult {
  blob: Blob;
  filename: string;
  kind: "terminal";
  recordCount: string | null;
  status: "DONE" | "ERROR";
  warningCount: string | null;
}

export type PollExportJobResult = InProgressExportJobResult | CompletedExportJobResult;

function toAbsoluteUrl(baseUrl: string, value: string) {
  return new URL(value, baseUrl).toString();
}

function normalizeStatus(rawStatus: string | null | undefined) {
  const normalized = rawStatus?.trim().replaceAll("_", " ").toUpperCase();

  if (normalized === "IN PROGRESS" || normalized === "IN PROGRES" || normalized === "DONE" || normalized === "ERROR") {
    return normalized === "IN PROGRES" ? "IN PROGRESS" : normalized;
  }

  return null;
}

function getCurrentDistrict(payload: PollStatusJson) {
  return payload.currentDistrict ?? payload.current_district ?? payload.district ?? null;
}

function getPollUrlFromJson(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidateKeys = ["pollUrl", "poll_url", "statusUrl", "status_url", "url", "href"] as const;

  for (const key of candidateKeys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

function getTerminalStatus(response: Response): "DONE" | "ERROR" {
  const headerStatus =
    normalizeStatus(response.headers.get("X-EDJOIN-Status")) ??
    normalizeStatus(response.headers.get("X-Export-Status")) ??
    normalizeStatus(response.headers.get("X-Job-Status"));

  if (headerStatus === "DONE" || headerStatus === "ERROR") {
    return headerStatus;
  }

  return response.ok ? "DONE" : "ERROR";
}

export async function startExportJob(apiBaseUrl: string, payload: StartExportJobPayload): Promise<StartedExportJob> {
  const response = await fetch(toAbsoluteUrl(apiBaseUrl, EXPORT_ENDPOINT_PATH), {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.error("EDJOIN export start request failed", {
      errorText,
      status: response.status
    });

    throw new Error(GENERIC_EXPORT_ERROR_MESSAGE);
  }

  const startPayload = (await response.json()) as StartExportJobResponse;
  const rawPollUrl =
    typeof startPayload.poll_url === "string" && startPayload.poll_url.trim()
      ? startPayload.poll_url
      : getPollUrlFromJson(startPayload);
  const pollUrl = rawPollUrl ? toAbsoluteUrl(apiBaseUrl, rawPollUrl) : null;
  const jobId = startPayload.job_id == null ? null : String(startPayload.job_id);
  const status = normalizeStatus(startPayload.status);

  if (!jobId || !pollUrl || (status !== "IN PROGRESS" && status !== "DONE")) {
    throw new Error("Export started, but the backend response was missing job metadata.");
  }

  return { jobId, pollUrl };
}

export async function pollExportJob(pollUrl: string): Promise<PollExportJobResult> {
  const response = await fetch(pollUrl);
  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as PollStatusJson;
    const status = normalizeStatus(payload.status);

    if (status === "IN PROGRESS") {
      return {
        currentDistrict: getCurrentDistrict(payload),
        kind: "progress"
      };
    }

    throw new Error("Export polling returned an unexpected JSON response.");
  }

  const blob = await response.blob();

  return {
    blob,
    filename: filenameFromDisposition(response.headers.get("Content-Disposition")),
    kind: "terminal",
    recordCount: response.headers.get("X-EDJOIN-Record-Count"),
    status: getTerminalStatus(response),
    warningCount: response.headers.get("X-EDJOIN-Warning-Count")
  };
}

export function downloadWorkbook(blob: Blob, filename: string) {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = downloadUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(downloadUrl);
}
