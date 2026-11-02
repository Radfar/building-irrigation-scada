const { pool } = require("../database");

const SAMPLE_INTERVAL_MS = Number(process.env.HISTORIAN_SAMPLE_INTERVAL_MS) || 5000;
const lastPersistedAt = new Map();
const warnedMissingTags = new Set();

function numericValue(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

/**
 * Persist GOOD observations to the project's existing tag_values table.
 * Boolean values are represented as 0/1 because tag_values.value is NUMERIC.
 * Source timestamps take precedence; received timestamps are the fallback.
 */
async function persistObservations(sourceSystemId, observations, options = {}) {
  if (!Array.isArray(observations) || observations.length === 0) return { inserted: 0, skipped: 0 };

  const now = Date.now();
  const intervalMs = options.intervalMs ?? SAMPLE_INTERVAL_MS;
  const last = lastPersistedAt.get(sourceSystemId) ?? 0;
  if (!options.force && now - last < intervalMs) {
    return { inserted: 0, skipped: observations.length, throttled: true };
  }

  const rows = [];
  for (const observation of observations) {
    if (!observation || observation.quality !== "GOOD") continue;
    const value = numericValue(observation.value);
    if (value === null || !observation.tagName) continue;

    const timestampValue = observation.sourceTimestamp || observation.receivedTimestamp || new Date(now).toISOString();
    const timestamp = new Date(timestampValue);
    if (Number.isNaN(timestamp.getTime())) continue;

    rows.push({
      tagName: observation.tagName,
      value,
      quality: observation.quality,
      timestamp
    });
  }

  if (rows.length === 0) {
    lastPersistedAt.set(sourceSystemId, now);
    return { inserted: 0, skipped: observations.length };
  }

  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query("BEGIN");
    for (const row of rows) {
      const result = await client.query(
        `INSERT INTO tag_values (tag_id, value, quality, timestamp)
         SELECT id, $1, $2, $3
         FROM tags
         WHERE tag_name = $4
         RETURNING id`,
        [row.value, row.quality, row.timestamp, row.tagName]
      );
      if (result.rowCount) {
        inserted += result.rowCount;
      } else if (!warnedMissingTags.has(row.tagName)) {
        warnedMissingTags.add(row.tagName);
        console.warn(`[historian] tag "${row.tagName}" is not registered; observation not stored`);
      }
    }
    await client.query("COMMIT");
    lastPersistedAt.set(sourceSystemId, now);
    return { inserted, skipped: observations.length - inserted };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { persistObservations, SAMPLE_INTERVAL_MS };
