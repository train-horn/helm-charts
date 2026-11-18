/*
 * Train horn loudness at distance: dB calculator
 * Pure math first (testable in Node), DOM wiring second (browser only).
 * MIT License.
 */

const HornDb = (() => {
  const FT_PER_M = 3.28084;

  // Approximate atmospheric absorption: ~5 dB per km at 1 kHz, 20 °C, 70 % RH
  // (order of magnitude from ISO 9613-1 tables). Real values depend strongly on
  // frequency, temperature and humidity; this is a rough illustration only.
  const ABSORPTION_DB_PER_KM = 5;

  const LIMITS = { minDb: 0, maxDb: 200, maxDistanceM: 100000 };

  // Reference points for the comparison scale (approximate, typical values).
  const SCALE = [
    { db: 150, label: "Jet engine at ~25 m / eardrum rupture risk" },
    { db: 140, label: "Threshold of pain; OSHA impulse-noise ceiling (140 dB peak)" },
    { db: 130, label: "Jackhammer at close range" },
    { db: 120, label: "Rock concert near the speakers" },
    { db: 110, label: "Chainsaw; damage in about a minute" },
    { db: 100, label: "Subway train, motorcycle at close range" },
    { db: 90, label: "OSHA permissible limit, 8 h (90 dBA)" },
    { db: 85, label: "OSHA action level / NIOSH limit, 8 h (85 dBA)" },
    { db: 70, label: "Busy street traffic" },
    { db: 60, label: "Normal conversation" },
    { db: 30, label: "Whisper" },
  ];

  function toMeters(value, unit) {
    if (unit === "m") return value;
    if (unit === "ft") return value / FT_PER_M;
    throw new RangeError("Unknown unit: " + unit);
  }

  function fromMeters(value, unit) {
    if (unit === "m") return value;
    if (unit === "ft") return value * FT_PER_M;
    throw new RangeError("Unknown unit: " + unit);
  }

  /** Geometric spreading loss in dB from r1 to r2 (inverse-square law). */
  function spreadingLoss(r1, r2) {
    return 20 * Math.log10(r2 / r1);
  }

  /** Extra loss from air absorption over the path beyond the reference distance. */
  function absorptionLoss(r1M, r2M, dbPerKm = ABSORPTION_DB_PER_KM) {
    return (dbPerKm * (r2M - r1M)) / 1000;
  }

  function toNumber(v) {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "") return Number(v);
    return NaN;
  }

  /**
   * Main calculation. Never throws on bad user input; returns
   * { ok: true, db, spreading, absorption, warnings } or { ok: false, error }.
   */
  function levelAtDistance(input) {
    const sourceDb = toNumber(input.sourceDb);
    const refDist = toNumber(input.refDistance);
    const dist = toNumber(input.distance);
    const unit = input.unit || "ft";
    const absorption = Boolean(input.absorption);

    if (unit !== "ft" && unit !== "m") return { ok: false, error: "Unit must be ft or m." };
    if (!Number.isFinite(sourceDb)) return { ok: false, error: "Enter the source level as a number." };
    if (sourceDb < LIMITS.minDb || sourceDb > LIMITS.maxDb)
      return { ok: false, error: `Source level must be between ${LIMITS.minDb} and ${LIMITS.maxDb} dB.` };
    if (!Number.isFinite(refDist) || refDist <= 0)
      return { ok: false, error: "Reference distance must be a number greater than 0." };
    if (!Number.isFinite(dist) || dist <= 0)
      return { ok: false, error: "Listener distance must be a number greater than 0." };

    const refM = toMeters(refDist, unit);
    const distM = toMeters(dist, unit);
    if (distM > LIMITS.maxDistanceM || refM > LIMITS.maxDistanceM)
      return { ok: false, error: "Distances above 100 km are out of range." };

    const spreading = spreadingLoss(refM, distM);
    const air = absorption ? absorptionLoss(refM, distM) : 0;
    const warnings = [];
    if (distM < refM)
      warnings.push("The listener is closer than the reference distance. Close to a horn the far-field model is unreliable.");
    if (distM > 1000)
      warnings.push("Beyond about 1 km, wind, temperature gradients, terrain and ground effects can change the result by 10 dB or more.");

    return { ok: true, db: sourceDb - spreading - air, spreading, absorption: air, warnings };
  }

  /** Closest scale entry at or below the given level (or the lowest one). */
  function compareTo(db) {
    if (!Number.isFinite(db)) return null;
    return SCALE.find((s) => db >= s.db) || SCALE[SCALE.length - 1];
  }

  function round1(x) {
    return Math.round(x * 10) / 10;
  }

  return {
    FT_PER_M, ABSORPTION_DB_PER_KM, LIMITS, SCALE,
    toMeters, fromMeters, spreadingLoss, absorptionLoss, levelAtDistance, compareTo, round1,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = HornDb;

/* ---------------- Browser UI ---------------- */
if (typeof document !== "undefined") {
  (function initUi() {
    const $ = (id) => document.getElementById(id);
    const form = $("calc");
    const els = {
      source: $("source-db"), ref: $("ref-distance"), dist: $("listener-distance"),
      absorption: $("absorption"), label: $("source-label"),
      result: $("result-db"), resultText: $("result-text"), breakdown: $("breakdown"),
      error: $("error"), warnings: $("warnings"), scale: $("scale"), table: $("table-body"),
      labelNote: $("label-note"), refUnit: $("ref-unit"), distUnit: $("dist-unit"),
    };
    let unit = "ft";

    const LABEL_NOTES = {
      mfr: "Manufacturer claim: a marketing number, often measured close-up, unweighted, at peak and under ideal conditions. It is not an independent measurement; real horns are often quieter.",
      ind: "Independent measurement: still check the distance, the weighting (dBA vs dBC vs unweighted) and whether it is a peak or an average reading.",
      stat: "Statutory limit: a legal maximum at the distance the statute specifies. Use that distance as the reference.",
    };

    const TABLE_DISTANCES = { ft: [25, 50, 100, 250, 500, 1000, 2640], m: [5, 15, 30, 75, 150, 300, 800] };

    function fmt(n, digits = 1) {
      return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
    }

    function buildScale() {
      els.scale.innerHTML = "";
      HornDb.SCALE.forEach((s) => {
        const li = document.createElement("li");
        li.dataset.db = s.db;
        li.innerHTML = `<span class="scale-db">${s.db} dB</span><span class="scale-label">${s.label}</span>`;
        els.scale.appendChild(li);
      });
    }

    function render() {
      const input = {
        sourceDb: els.source.value, refDistance: els.ref.value, distance: els.dist.value,
        unit, absorption: els.absorption.checked,
      };
      const r = HornDb.levelAtDistance(input);
      els.labelNote.textContent = LABEL_NOTES[els.label.value];

      if (!r.ok) {
        els.error.textContent = r.error;
        els.error.hidden = false;
        els.result.textContent = "—";
        els.resultText.textContent = "Fix the input to see a result.";
        els.breakdown.textContent = "";
        els.warnings.innerHTML = "";
        els.table.innerHTML = "";
        [...els.scale.children].forEach((li) => li.classList.remove("here"));
        return;
      }
      els.error.hidden = true;
      els.result.textContent = fmt(r.db);
      const c = HornDb.compareTo(r.db);
      els.resultText.textContent = `at ${fmt(Number(els.dist.value), 0)} ${unit}. Roughly comparable to: ${c.label}.`;
      els.breakdown.textContent =
        `Spreading loss −${fmt(r.spreading)} dB` + (els.absorption.checked ? `, air absorption −${fmt(r.absorption, 2)} dB` : "");
      els.warnings.innerHTML = r.warnings.map((w) => `<li>${w}</li>`).join("");

      [...els.scale.children].forEach((li) => li.classList.toggle("here", Number(li.dataset.db) === c.db));

      els.table.innerHTML = TABLE_DISTANCES[unit]
        .map((d) => {
          const row = HornDb.levelAtDistance({ ...input, distance: d });
          return row.ok ? `<tr><td>${fmt(d, 0)} ${unit}</td><td>${fmt(row.db)} dB</td></tr>` : "";
        })
        .join("");
    }

    function setUnit(next) {
      if (next === unit) return;
      [els.ref, els.dist].forEach((el) => {
        const v = Number(el.value);
        if (el.value !== "" && Number.isFinite(v)) {
          const converted = HornDb.fromMeters(HornDb.toMeters(v, unit), next);
          el.value = String(Math.round(converted * 100) / 100);
        }
      });
      unit = next;
      els.refUnit.textContent = unit;
      els.distUnit.textContent = unit;
      render();
    }

    form.addEventListener("input", (e) => {
      if (e.target.name === "unit") setUnit(e.target.value);
      else render();
    });
    form.addEventListener("submit", (e) => e.preventDefault());
    buildScale();
    render();
  })();
}
