import { describe, expect, it } from "vitest";

import {
  buildPlaceNameData,
  parseGazetteerCsv,
} from "../scripts/update-nz-place-names.mjs";

const GAZETTEER_FIXTURE = `\ufefffeat_id,name,feat_type,status,crd_latitude,crd_longitude,label_hierarchy
1,Wanganui,Locality,Official Approved,-39.930001,175.049999,
1,Whanganui,Locality,Official Approved,-39.930001,175.049999,7
2,Whareama,Locality,Official Assigned,-40.950004,176.009996,
3,Alexandra,Town,Official Approved,-45.2565049,169.394156,6
4,Unofficial Place,Locality,Unofficial Recorded,-41.1,174.8,
5,Former Town,Town,Official Replaced,-41.2,174.9,5
6,Named Bay,Bay,Official Approved,-41.3,175.0,5
7,Australian Town,Town,Official Approved,-33.8,151.2,5
8,Halfmoon Bay / Oban,Locality,Unofficial Recorded,-46.898813,168.127361,9
9,Hairini,Locality,Unofficial Recorded,-37.72269,176.171613,13
`;

describe("NZ Gazetteer place-name generator", () => {
  it("filters and compacts Gazetteer records deterministically", () => {
    const records = parseGazetteerCsv(GAZETTEER_FIXTURE);
    const data = buildPlaceNameData(records, "2026-07-13");

    expect(data.places).toEqual([
      ["Alexandra", -45.2565, 169.39416, true],
      ["Hairini", -37.72269, 176.17161, false],
      ["Halfmoon Bay / Oban", -46.89881, 168.12736, true],
      ["Whanganui", -39.93, 175.05, true],
      ["Whareama", -40.95, 176.01, false],
    ]);
    expect(data.source).toMatchObject({
      licence: "Creative Commons Attribution 4.0 International",
      licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
      retrievedOn: "2026-07-13",
    });
    expect(data.selection.localityRule).toMatch(/numeric label hierarchy/i);
    expect(data.selection.prominenceRule).toMatch(/10 or lower/i);
    expect(data.selection.modifications).toMatch(/filtered/i);
    expect(data.selection.modifications).toMatch(/rounded/i);
  });
});
