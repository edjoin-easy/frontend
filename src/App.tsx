import { useState } from "react";
import { AppHeader } from "./components/AppHeader/AppHeader";
import { AppIntro } from "./components/AppIntro/AppIntro";
import { ExportForm, type ExportFormValues } from "./components/ExportForm/ExportForm";
import { ExportStatusPanel } from "./components/ExportStatusPanel/ExportStatusPanel";
import { filenameFromDisposition } from "./lib/edjoin";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim();
const GENERIC_EXPORT_ERROR_MESSAGE = "Export failed. Please try again. If the problem persists, contact support.";

type ExportStatus = "idle" | "loading" | "success" | "error";

function App() {
  const [status, setStatus] = useState<ExportStatus>("idle");
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
    setErrorMessage("");
    setRecordCount(null);
    setWarningCount(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/edjoin/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locations: selectedState,
          include_keywords: values.includeKeywords,
          exclude_keywords: values.excludeKeywords
        })
      });

      if (!response.ok) {
        const errorText = await response.text();

        console.error("EDJOIN export request failed", {
          errorText,
          status: response.status
        });

        throw new Error(GENERIC_EXPORT_ERROR_MESSAGE);
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = filenameFromDisposition(response.headers.get("Content-Disposition"));
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);

      setRecordCount(response.headers.get("X-EDJOIN-Record-Count") ?? "0");
      setWarningCount(response.headers.get("X-EDJOIN-Warning-Count") ?? "0");
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : GENERIC_EXPORT_ERROR_MESSAGE);
    }
  }

  function handleReset() {
    setStatus("idle");
    setErrorMessage("");
    setRecordCount(null);
    setWarningCount(null);
  }

  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-start px-4 pt-16 pb-16 sm:pt-20 sm:pb-20">
      <div className="flex w-full max-w-4xl flex-col gap-8">
        <AppHeader />
        <AppIntro />
        <ExportForm
          isError={status === "error"}
          isIdle={status === "idle"}
          isLoading={status === "loading"}
          onSubmit={handleSubmit}
        />
        <ExportStatusPanel
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
