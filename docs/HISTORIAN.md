# Common PostgreSQL Historian

The application uses the existing `tags` and `tag_values` tables. This service does not create or modify Ignition's `sqlth_*` tables.

## Apply the registry migration

Back up the database first, then apply both migrations in chronological order:

```bash
psql -h <DB_HOST> -p <DB_PORT> -U <DB_USER> -d <DB_NAME> -f database/migrations/2026-11-02_common_historian_registry.sql
psql -h <DB_HOST> -p <DB_PORT> -U <DB_USER> -d <DB_NAME> -f database/migrations/2026-11-03_zone01_modbus_historian.sql
```

Both migrations are safe to rerun and do not delete or rewrite historical rows. The common registry migration registers Zone 02 observations, completes the Zone 05 registry, corrects Zone 05 tag ownership from `V-03` to `Z-05`, and aligns Zone 02/05 flow units with their driver contract (`gpm`). The Zone 01 migration registers its eight pump, tank and valve observations, including `Z01_OPERATOR_STOP_LATCHED`.

## Sampling and quality

- Modbus TCP Zone 01, EtherNet/IP Zone 02, OPC UA Zone 03, and BACnet/IP Zone 05 are sampled at a maximum of once per source every five seconds by default.
- Override the interval with `HISTORIAN_SAMPLE_INTERVAL_MS` (milliseconds).
- MQTT Zone 04 remains event-driven: each validated moisture message is stored.
- Only observations with `GOOD` quality and a finite numeric/Boolean value are stored. Boolean values are represented as `1` and `0`, because `tag_values.value` is PostgreSQL `NUMERIC`.
- A source timestamp is used when available; otherwise the received timestamp is used.
- A disconnected or stale source does not generate repeated NULL historian rows. Live API quality remains the place to inspect current communication state.

## Current tag coverage

- Zone 01: `P01_FREQUENCY`, `P01_SPEED`, `P01_FLOW`, `P01_RUN_FEEDBACK`, `P01_FAULT`, `Z01_OPERATOR_STOP_LATCHED`, `T01_LEVEL`, and `V01_POSITION` (eight observations exposed by the Modbus driver).
- Zone 02: all 17 names in the Micro850 driver's `READ_TAGS`.
- Zone 03: `Z03_MOISTURE`, `Z03_FLOW`, `Z03_VALVE`, `Z03_FAULT`, and `Z03_AUTO`. Other GVL variables remain live-only until they are deliberately added to the registry and historian allow-list.
- Zone 04: `Z04_MOISTURE` (validated MQTT measurement only). Simulated flow and valve outputs are not represented as physical measurements.
- Zone 05: all seven BACnet observations exposed by the driver.

## Verification

After starting the application and confirming each source is connected, run:

```sql
SELECT
    t.tag_name,
    e.tag_name AS equipment,
    t.unit,
    COUNT(tv.id) AS records,
    MAX(tv.timestamp) AS latest_record
FROM tags t
LEFT JOIN equipment e ON e.id = t.equipment_id
LEFT JOIN tag_values tv ON tv.tag_id = t.id
WHERE t.tag_name LIKE 'P01_%'
   OR t.tag_name LIKE 'T01_%'
   OR t.tag_name LIKE 'V01_%'
   OR t.tag_name LIKE 'Z01_%'
   OR t.tag_name LIKE 'Z02_%'
   OR t.tag_name LIKE 'Z03_%'
   OR t.tag_name LIKE 'Z04_%'
   OR t.tag_name LIKE 'Z05_%'
GROUP BY t.id, t.tag_name, e.tag_name, t.unit
ORDER BY t.tag_name;
```

The sampling interval means record counts will not equal the one-second PLC polling count. MQTT counts depend on the incoming message rate.
