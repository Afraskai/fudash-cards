// History-/Statistics-Fetcher fuer Home Assistant.
// - kurze Zeitraeume (<= HISTORY_MAX_HOURS): history/history_during_period
//   (Roh-State-Changes, voller Detailgrad)
// - laengere Zeitraeume: recorder/statistics_during_period
//   (auf 5-Minuten- bzw. Stunden-Buckets vorverdichtet, schonend fuer die DB)
// Cache auf Modulebene, damit mehrere Karten denselben Sensor nur einmal
// anfragen.

const HISTORY_MAX_HOURS = 24;

const cache = new Map(); // key = entityId+range+bucket -> { expires, promise }
const CACHE_TTL_MS = 30_000;

const cacheKey = (entityId, hours, bucket) => `${entityId}|${hours}|${bucket}`;

const pickStatisticsPeriod = (hours) => {
  // HA unterstuetzt "5minute", "hour", "day", "week", "month".
  if (hours <= 48) return "5minute";
  if (hours <= 24 * 14) return "hour";
  return "day";
};

// Rohe History (nur State-Changes) - voller Detailgrad.
const fetchRawHistory = async (hass, entityId, startIso, endIso) => {
  const res = await hass.callWS({
    type: "history/history_during_period",
    start_time: startIso,
    end_time: endIso,
    entity_ids: [entityId],
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: false,
  });
  const rows = res?.[entityId] || [];
  const out = [];
  for (const row of rows) {
    const v = parseFloat(row.s);
    if (!Number.isFinite(v)) continue;
    out.push({ t: row.lu ? row.lu * 1000 : Date.parse(row.lc || 0), v });
  }
  return out.sort((a, b) => a.t - b.t);
};

// Aggregierte Statistiken - HA Recorder Long-Term-Statistics.
const fetchStatistics = async (hass, entityId, startIso, endIso, period) => {
  const res = await hass.callWS({
    type: "recorder/statistics_during_period",
    start_time: startIso,
    end_time: endIso,
    statistic_ids: [entityId],
    period,
    units: {},
    types: ["mean", "state"],
  });
  const rows = res?.[entityId] || [];
  const out = [];
  for (const row of rows) {
    const v = row.mean ?? row.state;
    if (!Number.isFinite(v)) continue;
    const t = typeof row.start === "number" ? row.start : Date.parse(row.start);
    out.push({ t, v });
  }
  return out;
};

// Oeffentliche API: holt Punkte fuer eine Entity ueber die letzten 'hours' Stunden.
// Bei hours <= 24 kommen Roh-State-Changes, sonst Long-Term-Statistics.
FuDash.fetchSeries = async (hass, entityId, hours) => {
  if (!hass || !entityId) return [];
  const now = Date.now();
  const start = now - hours * 3_600_000;
  const useStats = hours > HISTORY_MAX_HOURS;
  const bucket = useStats ? pickStatisticsPeriod(hours) : "raw";
  const key = cacheKey(entityId, hours, bucket);
  const cached = cache.get(key);
  if (cached && cached.expires > now) return cached.promise;

  const startIso = new Date(start).toISOString();
  const endIso = new Date(now).toISOString();
  const promise = useStats
    ? fetchStatistics(hass, entityId, startIso, endIso, bucket)
    : fetchRawHistory(hass, entityId, startIso, endIso);
  cache.set(key, { expires: now + CACHE_TTL_MS, promise });
  try {
    return await promise;
  } catch (err) {
    cache.delete(key);
    throw err;
  }
};

// Erlaubt z.B. dem Editor, den Cache zu leeren, wenn sich Entities aendern.
FuDash.clearSeriesCache = () => cache.clear();
