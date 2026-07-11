import { useEffect, useRef, useState } from "react";
import { AppHeader } from "./components/AppHeader/AppHeader";
import { AppIntro } from "./components/AppIntro/AppIntro";
import { ExportForm, type ExportFormValues } from "./components/ExportForm/ExportForm";
import { ExportStatusPanel } from "./components/ExportStatusPanel/ExportStatusPanel";
import { analyticsEvents, getVisitAnalyticsMetadata, toCount, trackEvent } from "./lib/analytics";
import { downloadWorkbook, GENERIC_EXPORT_ERROR_MESSAGE, pollExportJob, startExportJob } from "./lib/export-job";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim();
type ExportStatus = "idle" | "loading" | "success" | "error";
const POLL_INTERVAL_MS = 2000;

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function countSelectedDistricts(values: ExportFormValues) {
  return values.state?.children.reduce((sum, region) => sum + region.children.length, 0) ?? 0;
}

function exportMetadata(values: ExportFormValues) {
  return {
    district_count: countSelectedDistricts(values),
    exclude_keyword_count: values.excludeKeywords.length,
    include_keyword_count: values.includeKeywords.length,
    region_count: values.state?.children.length ?? 0
  };
}

function App() {
  const visitStartedAt = useRef(window.performance.now());
  const exportAttemptCount = useRef(0);
  const visitMetadata = useRef<ReturnType<typeof getVisitAnalyticsMetadata> | null>(null);
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [activeDistrict, setActiveDistrict] = useState<string | null>(null);
  const [recordCount, setRecordCount] = useState<string | null>(null);
  const [warningCount, setWarningCount] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    visitMetadata.current = getVisitAnalyticsMetadata();
    trackEvent(analyticsEvents.appVisitStarted, visitMetadata.current);
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(values: ExportFormValues) {
    if (!API_BASE_URL) {
      setStatus("error");
      setErrorMessage("Missing VITE_API_BASE_URL. Configure the frontend to point at the project backend.");
      trackEvent(analyticsEvents.exportFailed, { reason: "missing_api_base_url" });
      return;
    }

    const selectedState = values.state;
    if (!selectedState) return;

    const hasSelectedDistricts = selectedState.children.some((region) => region.children.length > 0);
    if (!hasSelectedDistricts) return;

    setStatus("loading");
    setActiveDistrict(null);
    setErrorMessage("");
    setRecordCount(null);
    setWarningCount(null);

    exportAttemptCount.current += 1;
    const startedAt = window.performance.now();
    const baseMetadata = {
      ...exportMetadata(values),
      ...(visitMetadata.current ?? {}),
      export_attempt_in_visit: exportAttemptCount.current,
      repeat_export_in_visit: exportAttemptCount.current > 1,
      seconds_since_visit_start: Math.round((startedAt - visitStartedAt.current) / 1000)
    };
    if (exportAttemptCount.current > 1) {
      trackEvent(analyticsEvents.exportRepeatedInVisit, baseMetadata);
    }
    trackEvent(analyticsEvents.exportStarted, baseMetadata);

    try {
      const { pollUrl } = await startExportJob(API_BASE_URL, {
        exclude_keywords: values.excludeKeywords,
        include_keywords: values.includeKeywords,
        locations: selectedState
      });

      while (true) {
        const result = await pollExportJob(pollUrl);

        if (result.kind === "progress") {
          setActiveDistrict(result.currentDistrict);
          await sleep(POLL_INTERVAL_MS);
          continue;
        }

        downloadWorkbook(result.blob, result.filename);
        setActiveDistrict(null);
        setRecordCount(result.recordCount ?? "0");
        setWarningCount(result.warningCount ?? "0");

        const resultMetadata = {
          ...baseMetadata,
          duration_seconds: Math.round((window.performance.now() - startedAt) / 1000),
          record_count: toCount(result.recordCount),
          warning_count: toCount(result.warningCount)
        };

        if (result.status === "DONE") {
          setStatus("success");
          setErrorMessage("");
          trackEvent(analyticsEvents.exportCompleted, resultMetadata);
        } else {
          setStatus("error");
          setErrorMessage(
            "Export completed with errors. The workbook download contains the parsed rows available so far."
          );
          trackEvent(analyticsEvents.exportPartial, resultMetadata);
        }

        break;
      }
    } catch (error) {
      setActiveDistrict(null);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : GENERIC_EXPORT_ERROR_MESSAGE);
      trackEvent(analyticsEvents.exportFailed, {
        ...baseMetadata,
        duration_seconds: Math.round((window.performance.now() - startedAt) / 1000),
        reason: error instanceof TypeError ? "network_error" : "request_error"
      });
    }
  }

  function handleReset() {
    if (status === "error") {
      trackEvent(analyticsEvents.exportRetryClicked);
    } else if (status === "success") {
      trackEvent(analyticsEvents.runAnotherExportClicked, {
        record_count: toCount(recordCount),
        warning_count: toCount(warningCount)
      });
    }

    setStatus("idle");
    setActiveDistrict(null);
    setErrorMessage("");
    setRecordCount(null);
    setWarningCount(null);
  }

  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-start px-4 pt-16 pb-16 sm:pt-20 sm:pb-20">
      <div className="flex w-full max-w-4xl flex-col gap-8">
        <AppHeader />
        <AppIntro />
        <ExportForm isLoading={status === "loading"} onSubmit={handleSubmit} />
        <ExportStatusPanel
          activeDistrict={activeDistrict}
          errorMessage={errorMessage}
          onReset={handleReset}
          recordCount={recordCount}
          status={status}
          warningCount={warningCount}
        />
      </div>
    </main>
  );
}

export default App;
