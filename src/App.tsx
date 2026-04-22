import { useMemo, useState } from "react";
import type { FormEvent } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function parseKeywords(value: string) {
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function filenameFromDisposition(disposition: string | null) {
  if (!disposition) return "edjoin-export.xlsx";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/);
  if (encoded) return decodeURIComponent(encoded[1]);
  const plain = disposition.match(/filename="?([^"]+)"?/);
  return plain?.[1] ?? "edjoin-export.xlsx";
}

function App() {
  const [location, setLocation] = useState("Alameda");
  const [includeKeywords, setIncludeKeywords] = useState("elementary, kindergarten, tk, sped");
  const [excludeKeywords, setExcludeKeywords] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const canSubmit = useMemo(() => location.trim().length >= 2 && status !== "loading", [location, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus("loading");
    setMessage("Crawling EDJOIN and preparing the workbook...");

    try {
      const response = await fetch(`${API_BASE_URL}/api/edjoin/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          include_keywords: parseKeywords(includeKeywords),
          exclude_keywords: parseKeywords(excludeKeywords)
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Export failed with ${response.status}`);
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

      const recordCount = response.headers.get("X-EDJOIN-Record-Count") ?? "0";
      const warningCount = response.headers.get("X-EDJOIN-Warning-Count") ?? "0";
      setStatus("success");
      setMessage(`Downloaded ${recordCount} records. ${warningCount} warnings were included in the workbook.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Export failed.");
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <div className="heading">
          <p>EDJOIN exporter</p>
          <h1>Build a raw Excel export from live EDJOIN search results.</h1>
        </div>

        <form className="panel" onSubmit={handleSubmit}>
          <label>
            <span>Location</span>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Alameda, San Mateo, Santa Clara..."
            />
          </label>

          <label>
            <span>Include keywords</span>
            <input
              value={includeKeywords}
              onChange={(event) => setIncludeKeywords(event.target.value)}
              placeholder="elementary, kindergarten, tk"
            />
          </label>

          <label>
            <span>Exclude keywords</span>
            <input
              value={excludeKeywords}
              onChange={(event) => setExcludeKeywords(event.target.value)}
              placeholder="substitute, classified"
            />
          </label>

          <button disabled={!canSubmit} type="submit">
            {status === "loading" && <span className="spinner" aria-hidden="true" />}
            Export Excel
          </button>

          {message && (
            <div className={`status ${status}`}>
              <span>{message}</span>
            </div>
          )}
        </form>
      </section>
    </main>
  );
}

export default App;
