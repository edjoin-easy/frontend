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

const EDJOIN_STATES_URL = "/__edjoin_proxy/Home/LoadStates";
const EDJOIN_SEARCH_REGIONS_URL = "/__edjoin_proxy/Home/LoadSearchRegions";
const EDJOIN_DISTRICTS_URL = "/__edjoin_proxy/Home/LoadDistricts";

export async function loadEdjoinStates() {
  const response = await fetch(EDJOIN_STATES_URL);

  if (!response.ok) {
    throw new Error(`LoadStates failed with status ${response.status}`);
  }

  const payload = (await response.json()) as EdjoinStatesResponse;

  if (payload.haserrors) {
    alert("edjoin is not available now");
    return [];
  }

  return Array.isArray(payload.data) ? payload.data : [];
}

export async function loadEdjoinSearchRegions(stateId: string) {
  const response = await fetch(`${EDJOIN_SEARCH_REGIONS_URL}?states=${encodeURIComponent(stateId)}`);

  if (!response.ok) {
    throw new Error(`LoadSearchRegions failed with status ${response.status}`);
  }

  const payload = (await response.json()) as EdjoinSearchRegionsResponse;

  if (payload.haserrors) {
    alert("edjoin is not available now");
    return [];
  }

  return Array.isArray(payload.data) ? payload.data : [];
}

export async function loadEdjoinDistricts(countyId: string) {
  const response = await fetch(`${EDJOIN_DISTRICTS_URL}?countyID=${encodeURIComponent(countyId)}`);

  if (!response.ok) {
    throw new Error(`LoadDistricts failed with status ${response.status}`);
  }

  const payload = (await response.json()) as EdjoinDistrictsResponse;

  if (payload.haserrors) {
    alert("edjoin is not available now");
    return [];
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
