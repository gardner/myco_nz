const GAZETTEER_URL =
  "https://data.linz.govt.nz/layer/51681-nz-place-names-nzgb/";
const LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/";

export function GazetteerAttribution() {
  return (
    <>
      <a href={GAZETTEER_URL} target="_blank" rel="noopener noreferrer">
        NZ Gazetteer, Toitū Te Whenua LINZ
        <span className="sr-only"> (opens in a new tab)</span>
      </a>{" "}
      (
      <a href={LICENCE_URL} target="_blank" rel="noopener noreferrer">
        CC BY 4.0
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      ; filtered and coordinate-rounded for myco.nz)
    </>
  );
}
