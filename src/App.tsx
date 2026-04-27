import { useState } from "react";
import { AppHeader } from "./components/AppHeader/AppHeader";
import { AppIntro } from "./components/AppIntro/AppIntro";
import { ExportForm, type ExportFormValues } from "./components/ExportForm/ExportForm";
import { ExportStatusPanel } from "./components/ExportStatusPanel/ExportStatusPanel";
import { downloadWorkbook, GENERIC_EXPORT_ERROR_MESSAGE, pollExportJob, startExportJob } from "./lib/export-job";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim();
type ExportStatus = "idle" | "loading" | "success" | "error";
const POLL_INTERVAL_MS = 2000;

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function App() {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [activeDistrict, setActiveDistrict] = useState<string | null>(null);
  const [recordCount, setRecordCount] = useState<string | null>(null);
  const [warningCount, setWarningCount] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(values: ExportFormValues) {
    if (!API_BASE_URL) {
      setStatus("error");
      setErrorMessage("Missing VITE_API_BASE_URL. Configure the frontend to point at the project backend.");
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

        if (result.status === "DONE") {
          setStatus("success");
          setErrorMessage("");
        } else {
          setStatus("error");
          setErrorMessage(
            "Export completed with errors. The workbook download contains the parsed rows available so far."
          );
        }

        break;
      }
    } catch (error) {
      setActiveDistrict(null);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : GENERIC_EXPORT_ERROR_MESSAGE);
    }
  }

  function handleReset() {
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
