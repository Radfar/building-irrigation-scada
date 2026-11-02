-- Common historian registry additions for Zones 02 and 05.
-- Safe to run more than once. Existing history is not modified.
-- Flow values are stored in canonical gpm, matching the normalized drivers.

BEGIN;

UPDATE tags
SET unit = 'gpm'
WHERE tag_name IN ('Z02_FLOW', 'Z05_FLOW');

INSERT INTO tags (equipment_id, tag_name, description, data_type, unit)
SELECT e.id, v.tag_name, v.description, v.data_type, v.unit
FROM equipment e
JOIN (VALUES
  ('Z02_MOISTURE', 'Zone 02 soil moisture', 'FLOAT', '%'),
  ('Z02_FLOW', 'Zone 02 irrigation flow', 'FLOAT', 'gpm'),
  ('Z02_AUTO', 'Zone 02 automatic mode command', 'BOOLEAN', NULL),
  ('Z02_RUNNING', 'Zone 02 running feedback', 'BOOLEAN', NULL),
  ('Z02_VALVE', 'Zone 02 valve position', 'FLOAT', '%'),
  ('Z02_FAULT', 'Zone 02 fault status', 'BOOLEAN', NULL),
  ('Z02_AUTO_ACTIVE', 'Zone 02 automatic sequence active', 'BOOLEAN', NULL),
  ('Z02_PERMISSIVE', 'Zone 02 start permissive', 'BOOLEAN', NULL),
  ('Z02_COMMANDED', 'Zone 02 run command state', 'BOOLEAN', NULL),
  ('Z02_PUMP_RUN', 'Zone 02 pump running feedback', 'BOOLEAN', NULL),
  ('Z02_PUMP_SPD', 'Zone 02 pump speed', 'FLOAT', '%'),
  ('Z02_SIM_ENABLE', 'Zone 02 simulation enable', 'BOOLEAN', NULL),
  ('Z02_LOW_FLOW', 'Zone 02 low-flow status', 'BOOLEAN', NULL),
  ('Z02_FLOW_OK', 'Zone 02 flow validation status', 'BOOLEAN', NULL),
  ('Z02_PROCESS_OK', 'Zone 02 process status', 'BOOLEAN', NULL),
  ('Z02_COMM_OK', 'Zone 02 communication status', 'BOOLEAN', NULL),
  ('Z02_TOTAL_RUNTIME_SEC', 'Zone 02 total runtime', 'FLOAT', 's')
) AS v(tag_name, description, data_type, unit) ON TRUE
WHERE e.tag_name = 'Z-02'
ON CONFLICT (tag_name) DO UPDATE
SET equipment_id = EXCLUDED.equipment_id,
    description = EXCLUDED.description,
    data_type = EXCLUDED.data_type,
    unit = EXCLUDED.unit;

-- Correct the original Zone 05 records, which were assigned to V-03 (id 5).
INSERT INTO tags (equipment_id, tag_name, description, data_type, unit)
SELECT e.id, v.tag_name, v.description, v.data_type, v.unit
FROM equipment e
JOIN (VALUES
  ('Z05_MOISTURE', 'Zone 05 soil moisture', 'FLOAT', '%'),
  ('Z05_FLOW', 'Zone 05 irrigation flow', 'FLOAT', 'gpm'),
  ('Z05_VALVE', 'Zone 05 valve position', 'FLOAT', '%'),
  ('Z05_TANK_LEVEL', 'Zone 05 tank level', 'FLOAT', '%'),
  ('Z05_RUNNING', 'Zone 05 running feedback', 'BOOLEAN', NULL),
  ('Z05_FAULT', 'Zone 05 fault status', 'BOOLEAN', NULL),
  ('Z05_AUTO', 'Zone 05 automatic mode state', 'BOOLEAN', NULL)
) AS v(tag_name, description, data_type, unit) ON TRUE
WHERE e.tag_name = 'Z-05'
ON CONFLICT (tag_name) DO UPDATE
SET equipment_id = EXCLUDED.equipment_id,
    description = EXCLUDED.description,
    data_type = EXCLUDED.data_type,
    unit = EXCLUDED.unit;

COMMIT;
