-- ============================================================
-- Building Irrigation SCADA
-- PostgreSQL Database Schema
-- ============================================================


-- ============================================================
-- EQUIPMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS equipment (

    id SERIAL PRIMARY KEY,

    tag_name VARCHAR(50) UNIQUE NOT NULL,

    description VARCHAR(150),

    equipment_type VARCHAR(50),

    location VARCHAR(100),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);


-- ============================================================
-- TAGS
-- ============================================================

CREATE TABLE IF NOT EXISTS tags (

    id SERIAL PRIMARY KEY,

    equipment_id INTEGER
        REFERENCES equipment(id),

    tag_name VARCHAR(100) UNIQUE NOT NULL,

    description VARCHAR(200),

    data_type VARCHAR(30) NOT NULL,

    unit VARCHAR(20),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);


-- ============================================================
-- TAG VALUES / HISTORIAN
-- ============================================================

CREATE TABLE IF NOT EXISTS tag_values (

    id BIGSERIAL PRIMARY KEY,

    tag_id INTEGER
        REFERENCES tags(id),

    value NUMERIC,

    quality VARCHAR(20) DEFAULT 'GOOD',

    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);


-- ============================================================
-- ALARMS
-- ============================================================

CREATE TABLE IF NOT EXISTS alarms (

    id BIGSERIAL PRIMARY KEY,

    tag_id INTEGER
        REFERENCES tags(id),

    alarm_type VARCHAR(50),

    message VARCHAR(255),

    severity VARCHAR(20),

    active BOOLEAN DEFAULT TRUE,

    acknowledged BOOLEAN DEFAULT FALSE,

    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);


-- ============================================================
-- EVENTS / OPERATOR LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS events (

    id BIGSERIAL PRIMARY KEY,

    event_type VARCHAR(50),

    description VARCHAR(255),

    operator_name VARCHAR(100),

    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);


-- ============================================================
-- EQUIPMENT DATA
-- ============================================================

INSERT INTO equipment
    (tag_name, description, equipment_type, location)
VALUES

    ('P-01',
     'Main Irrigation Pump',
     'PUMP',
     'Mechanical Room'),

    ('T-01',
     'Main Water Tank',
     'TANK',
     'Basement'),

    ('V-01',
     'Irrigation Valve 01',
     'VALVE',
     'Main Entrance'),

    ('V-02',
     'Irrigation Valve 02',
     'VALVE',
     'Courtyard'),

    ('V-03',
     'Irrigation Valve 03',
     'VALVE',
     'Roof Garden'),

    ('Z-01',
     'Main Entrance Irrigation Zone',
     'ZONE',
     'Main Entrance'),

    ('Z-02',
     'Courtyard Irrigation Zone',
     'ZONE',
     'Courtyard'),

    ('Z-03',
     'Roof Garden Irrigation Zone',
     'ZONE',
     'Roof Garden'),

    ('Z-04',
     'East Garden Irrigation Zone',
     'ZONE',
     'East Garden'),

    ('Z-05',
     'West Garden Irrigation Zone',
     'ZONE',
     'West Garden'),

    ('Z-06',
     'Parking Landscape Irrigation Zone',
     'ZONE',
     'Parking')

ON CONFLICT (tag_name) DO NOTHING;


-- ============================================================
-- TAG DATA
-- ============================================================

INSERT INTO tags
    (equipment_id, tag_name, description, data_type, unit)
VALUES

    (
        (SELECT id FROM equipment WHERE tag_name = 'P-01'),
        'P01_RUN_FEEDBACK',
        'Pump running feedback',
        'BOOLEAN',
        NULL
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'P-01'),
        'P01_FREQUENCY',
        'Pump VFD output frequency',
        'FLOAT',
        'Hz'
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'P-01'),
        'P01_SPEED',
        'Pump speed command',
        'FLOAT',
        '%'
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'P-01'),
        'P01_FLOW',
        'Main irrigation flow',
        'FLOAT',
        'L/min'
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'P-01'),
        'P01_FAULT',
        'Pump/VFD fault status',
        'BOOLEAN',
        NULL
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'T-01'),
        'T01_LEVEL',
        'Water tank level',
        'FLOAT',
        '%'
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'V-01'),
        'V01_POSITION',
        'Valve position',
        'FLOAT',
        '%'
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'V-02'),
        'V02_POSITION',
        'Valve position',
        'FLOAT',
        '%'
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'V-03'),
        'V03_POSITION',
        'Valve position',
        'FLOAT',
        '%'
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'Z-01'),
        'Z01_MOISTURE',
        'Zone 01 soil moisture',
        'FLOAT',
        '%'
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'Z-01'),
        'Z01_FLOW',
        'Zone 01 irrigation flow',
        'FLOAT',
        'L/min'
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'Z-01'),
        'Z01_VALVE',
        'Zone 01 valve position',
        'FLOAT',
        '%'
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'Z-02'),
        'Z02_MOISTURE',
        'Zone 02 soil moisture',
        'FLOAT',
        '%'
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'Z-02'),
        'Z02_FLOW',
        'Zone 02 irrigation flow',
        'FLOAT',
        'L/min'
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'Z-02'),
        'Z02_VALVE',
        'Zone 02 valve position',
        'FLOAT',
        '%'
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'Z-03'),
        'Z03_MOISTURE',
        'Zone 03 soil moisture',
        'FLOAT',
        '%'
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'Z-03'),
        'Z03_FLOW',
        'Zone 03 irrigation flow',
        'FLOAT',
        'L/min'
    ),

    (
        (SELECT id FROM equipment WHERE tag_name = 'Z-03'),
        'Z03_VALVE',
        'Zone 03 valve position',
        'FLOAT',
        '%'
    )

ON CONFLICT (tag_name) DO NOTHING;