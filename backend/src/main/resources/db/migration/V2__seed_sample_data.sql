-- Sample data for the academic demonstration.
--
-- Hospital names, areas, telephone numbers and every total/available count are taken from the
-- project report (Figure 3.3 dashboard screenshot and Figure 3.1). The screenshot was captured
-- after one VENTILATOR unit was transferred from Government General Hospital to Fortis Malar
-- Hospital; the values below are the original seed (before that transfer): 444 available of 1460.
--
-- Latitude/longitude are approximate public locations chosen so that the illustrative allocations
-- of report Table 3.2 are reproduced. These are SYNTHETIC DEMO numbers, not live hospital inventory.
--
-- Idempotent: re-running leaves existing rows untouched (unique keys on name and hospital+type).

INSERT INTO hospitals (name, area, phone, latitude, longitude) VALUES
    ('Apollo Hospitals',               'Greams Road', '044-28290200', 13.060400, 80.249600),
    ('MIOT International',             'Manapakkam',  '044-42002288', 13.021300, 80.185400),
    ('Fortis Malar Hospital',          'Adyar',       '044-42892222', 13.006700, 80.257000),
    ('Kauvery Hospital',               'Alwarpet',    '044-40006000', 13.033600, 80.253500),
    ('Government General Hospital',    'Park Town',   '044-25305000', 13.081500, 80.277700),
    ('Sri Ramachandra Medical Centre', 'Porur',       '044-45928500', 13.038200, 80.142000)
ON DUPLICATE KEY UPDATE name = name;

INSERT INTO inventory (hospital_id, resource_type, total, available)
SELECT h.id, v.resource_type, v.total, v.available
FROM (
    SELECT 'Apollo Hospitals' AS hname, 'EMERGENCY' AS resource_type, 20 AS total, 8 AS available
    UNION ALL SELECT 'Apollo Hospitals', 'ICU', 30, 5
    UNION ALL SELECT 'Apollo Hospitals', 'VENTILATOR', 15, 4
    UNION ALL SELECT 'Apollo Hospitals', 'GENERAL', 120, 40
    UNION ALL SELECT 'Apollo Hospitals', 'OXYGEN', 50, 20

    UNION ALL SELECT 'MIOT International', 'EMERGENCY', 15, 6
    UNION ALL SELECT 'MIOT International', 'ICU', 25, 2
    UNION ALL SELECT 'MIOT International', 'VENTILATOR', 12, 3
    UNION ALL SELECT 'MIOT International', 'GENERAL', 100, 35
    UNION ALL SELECT 'MIOT International', 'OXYGEN', 40, 15

    UNION ALL SELECT 'Fortis Malar Hospital', 'EMERGENCY', 12, 4
    UNION ALL SELECT 'Fortis Malar Hospital', 'ICU', 20, 3
    UNION ALL SELECT 'Fortis Malar Hospital', 'VENTILATOR', 10, 2
    UNION ALL SELECT 'Fortis Malar Hospital', 'GENERAL', 90, 25
    UNION ALL SELECT 'Fortis Malar Hospital', 'OXYGEN', 35, 10

    UNION ALL SELECT 'Kauvery Hospital', 'EMERGENCY', 10, 3
    UNION ALL SELECT 'Kauvery Hospital', 'ICU', 18, 1
    UNION ALL SELECT 'Kauvery Hospital', 'VENTILATOR', 8, 1
    UNION ALL SELECT 'Kauvery Hospital', 'GENERAL', 70, 22
    UNION ALL SELECT 'Kauvery Hospital', 'OXYGEN', 30, 9

    UNION ALL SELECT 'Government General Hospital', 'EMERGENCY', 40, 12
    UNION ALL SELECT 'Government General Hospital', 'ICU', 35, 4
    UNION ALL SELECT 'Government General Hospital', 'VENTILATOR', 20, 5
    UNION ALL SELECT 'Government General Hospital', 'GENERAL', 300, 90
    UNION ALL SELECT 'Government General Hospital', 'OXYGEN', 80, 30

    UNION ALL SELECT 'Sri Ramachandra Medical Centre', 'EMERGENCY', 18, 7
    UNION ALL SELECT 'Sri Ramachandra Medical Centre', 'ICU', 28, 6
    UNION ALL SELECT 'Sri Ramachandra Medical Centre', 'VENTILATOR', 14, 4
    UNION ALL SELECT 'Sri Ramachandra Medical Centre', 'GENERAL', 150, 50
    UNION ALL SELECT 'Sri Ramachandra Medical Centre', 'OXYGEN', 45, 18
) v
JOIN hospitals h ON h.name = v.hname
ON DUPLICATE KEY UPDATE total = inventory.total;

INSERT INTO activity_log (action_type, message, reference_id)
SELECT 'SYSTEM', 'MediSync Live initialised with 6 hospitals and 30 inventory records (synthetic demo data).', NULL
WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE action_type = 'SYSTEM');
