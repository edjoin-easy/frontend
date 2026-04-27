import { afterEach, describe, expect, it, vi } from "vitest";
import { pollExportJob, startExportJob } from "./export-job";

describe("export-job", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves the poll URL returned by the start endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ job_id: 123, poll_url: "/api/edjoin/export/123", status: "IN PROGRESS" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 202
      })
    );

    const result = await startExportJob("http://localhost:8000", {
      exclude_keywords: ["temp"],
      include_keywords: ["teacher"],
      locations: {
        children: [],
        name: "California",
        stateId: 5
      }
    });

    expect(result).toEqual({
      jobId: "123",
      pollUrl: "http://localhost:8000/api/edjoin/export/123"
    });
  });

  it("accepts a base URL without an explicit scheme in local development", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ job_id: 123, poll_url: "/api/edjoin/export/123", status: "IN PROGRESS" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 202
      })
    );

    const result = await startExportJob("localhost:8000", {
      exclude_keywords: ["temp"],
      include_keywords: ["teacher"],
      locations: {
        children: [],
        name: "California",
        stateId: 5
      }
    });

    expect(result).toEqual({
      jobId: "123",
      pollUrl: "http://localhost:8000/api/edjoin/export/123"
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/edjoin/export",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("fails cleanly on an invalid backend base URL", async () => {
    await expect(
      startExportJob("://bad-url", {
        exclude_keywords: [],
        include_keywords: [],
        locations: {
          children: [],
          name: "California",
          stateId: 5
        }
      })
    ).rejects.toThrow("Invalid VITE_API_BASE_URL. Use a full origin such as http://localhost:8000.");
  });

  it("returns progress details while the job is still running", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ current_district: "Alameda USD", status: "IN PROGRESS" }), {
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    const result = await pollExportJob("http://localhost:8000/api/edjoin/export/123");

    expect(result).toEqual({
      currentDistrict: "Alameda USD",
      kind: "progress"
    });
  });

  it("fails cleanly on an unexpected JSON poll response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ERROR" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 200
      })
    );

    await expect(pollExportJob("http://localhost:8000/api/edjoin/export/123")).rejects.toThrow(
      "Export polling returned an unexpected JSON response."
    );
  });

  it("returns a terminal blob response with metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Blob(["xlsx-bytes"]), {
        headers: {
          "Content-Disposition": 'attachment; filename="district-export.xlsx"',
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "X-EDJOIN-Record-Count": "42",
          "X-EDJOIN-Warning-Count": "3",
          "X-EDJOIN-Status": "ERROR"
        },
        status: 200
      })
    );

    const result = await pollExportJob("http://localhost:8000/api/edjoin/export/123");

    expect(result.kind).toBe("terminal");
    if (result.kind !== "terminal") {
      throw new Error("Expected a terminal poll result");
    }
    expect(result.status).toBe("ERROR");
    expect(result.filename).toBe("district-export.xlsx");
    expect(result.recordCount).toBe("42");
    expect(result.warningCount).toBe("3");
    expect(await result.blob.text()).toBe("xlsx-bytes");
  });
});
