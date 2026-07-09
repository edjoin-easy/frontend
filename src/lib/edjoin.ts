export interface EdjoinState {
  stateID: number;
  jobs: number;
  name: string | null;
  fullname: string;
}

interface EdjoinStatesResponse {
  data?: EdjoinState[];
  haserrors?: boolean;
}

export interface EdjoinSearchRegion {
  countyID: number;
  countyName: string;
  numberPostings: number;
  state: string;
}

interface EdjoinSearchRegionsResponse {
  data?: EdjoinSearchRegion[];
  haserrors?: boolean;
}

export interface EdjoinDistrict {
  districtID: number;
  districtName: string;
  numberPostings: number;
  countyID: number;
}

interface EdjoinDistrictsResponse {
  data?: EdjoinDistrict[];
  haserrors?: boolean;
}

// Shown when EDJOIN responds with `haserrors`. Thrown (not alerted) so React
// Query surfaces it through each list's inline ErrorState + Retry affordance.
export const EDJOIN_UNAVAILABLE_MESSAGE = "EDJOIN is not available right now. Please try again in a moment.";

function metadataUrl(endpoint: "districts" | "search-regions" | "states") {
  if (import.meta.env.DEV) {
    const localPaths = {
      districts: "LoadDistricts",
      "search-regions": "LoadSearchRegions",
      states: "LoadStates"
    };

    return `/__edjoin_proxy/Home/${localPaths[endpoint]}`;
  }

  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    throw new Error("Missing VITE_API_BASE_URL. Configure the frontend to point at the project backend.");
  }

  const baseUrl = configuredBaseUrl.includes("://") ? configuredBaseUrl : `https://${configuredBaseUrl}`;
  return new URL(`/api/edjoin/metadata/${endpoint}`, baseUrl).toString();
}

export async function loadEdjoinStates() {
  const response = await fetch(metadataUrl("states"));

  if (!response.ok) {
    throw new Error(`LoadStates failed with status ${response.status}`);
  }

  const payload = (await response.json()) as EdjoinStatesResponse;

  if (payload.haserrors) {
    throw new Error(EDJOIN_UNAVAILABLE_MESSAGE);
  }

  return Array.isArray(payload.data) ? payload.data : [];
}

export async function loadEdjoinSearchRegions(stateId: string) {
  const url = new URL(metadataUrl("search-regions"));
  url.searchParams.set("states", stateId);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`LoadSearchRegions failed with status ${response.status}`);
  }

  const payload = (await response.json()) as EdjoinSearchRegionsResponse;

  if (payload.haserrors) {
    throw new Error(EDJOIN_UNAVAILABLE_MESSAGE);
  }

  return Array.isArray(payload.data) ? payload.data : [];
}

export async function loadEdjoinDistricts(countyId: string) {
  const url = new URL(metadataUrl("districts"));
  url.searchParams.set("countyID", countyId);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`LoadDistricts failed with status ${response.status}`);
  }

  const payload = (await response.json()) as EdjoinDistrictsResponse;

  if (payload.haserrors) {
    throw new Error(EDJOIN_UNAVAILABLE_MESSAGE);
  }

  return Array.isArray(payload.data) ? payload.data : [];
}

function sanitizeDownloadFilename(filename: string) {
  const withoutPath = filename.split(/[\\/]/).pop()?.trim() ?? "";
  const withoutControls = Array.from(withoutPath)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 0x20 && code !== 0x7f;
    })
    .join("");
  const cleaned = withoutControls.replace(/^\.+/, "").trim();

  if (!cleaned) {
    return "edjoin-export.xlsx";
  }

  return cleaned.toLowerCase().endsWith(".xlsx") ? cleaned : `${cleaned}.xlsx`;
}

export function filenameFromDisposition(disposition: string | null) {
  if (!disposition) return "edjoin-export.xlsx";

  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded) {
    try {
      return sanitizeDownloadFilename(decodeURIComponent(encoded[1]));
    } catch {
      return "edjoin-export.xlsx";
    }
  }

  const quoted = disposition.match(/filename="([^"]+)"/i);
  if (quoted) {
    return sanitizeDownloadFilename(quoted[1]);
  }

  const plain = disposition.match(/filename=([^;]+)/i);
  return plain ? sanitizeDownloadFilename(plain[1]) : "edjoin-export.xlsx";
}
