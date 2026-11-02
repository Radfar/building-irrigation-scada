-- Zone 01 Modbus TCP simulator historian registry.
-- Safe to re-run; existing historical values are not modified.
BEGIN;

INSERT INTO tags (equipment_id, tag_name, description, data_type, unit)
SELECT e.id, v.tag_name, v.description, v.data_type, v.unit
FROM (VALUES
  ('P-01', 'P01_FREQUENCY', 'Zone 01 simulated pump frequency', 'FLOAT', 'Hz'),
  ('P-01', 'P01_SPEED', 'Zone 01 simulated pump speed', 'FLOAT', '%'),
  ('P-01', 'P01_FLOW', 'Zone 01 simulated pump flow', 'FLOAT', 'L/min'),
  ('P-01', 'P01_RUN_FEEDBACK', 'Zone 01 simulated pump run feedback', 'BOOLEAN', NULL),
  ('P-01', 'P01_FAULT', 'Zone 01 simulated pump fault status', 'BOOLEAN', NULL),
  ('T-01', 'T01_LEVEL', 'Zone 01 simulated tank level', 'FLOAT', '%'),
  ('V-01', 'V01_POSITION', 'Zone 01 simulated valve position', 'FLOAT', '%')
) AS v(equipment_tag, tag_name, description, data_type, unit)
JOIN equipment e ON e.tag_name = v.equipment_tag
ON CONFLICT (tag_name) DO UPDATE
SET equipment_id = EXCLUDED.equipment_id,
    description = EXCLUDED.description,
    data_type = EXCLUDED.data_type,
    unit = EXCLUDED.unit;

COMMIT;
