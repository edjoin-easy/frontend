import { afterEach, describe, expect, it, vi } from "vitest";
import { pollExportJob, startExportJob } from "./export-job";

describe("export-job", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves the poll URL returned by the start endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ poll_url: "/api/edjoin/export/jobs/123" }), {
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
      pollUrl: "http://localhost:8000/api/edjoin/export/jobs/123"
    });
  });

  it("returns progress details while the job is still running", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ current_district: "Alameda USD", status: "IN PROGRESS" }), {
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    const result = await pollExportJob("http://localhost:8000/api/edjoin/export/jobs/123");

    expect(result).toEqual({
      currentDistrict: "Alameda USD",
      kind: "progress"
    });
  });

  it("returns a terminal blob response with metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Blob(["xlsx-bytes"]), {
        headers: {
          "Content-Disposition": 'attachment; filename="district-export.xlsx"',
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "X-EDJOIN-Record-Count": "42",
          "X-EDJOIN-Warning-Count": "3",
          "X-Export-Status": "ERROR"
        },
        status: 200
      })
    );

    const result = await pollExportJob("http://localhost:8000/api/edjoin/export/jobs/123");

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
