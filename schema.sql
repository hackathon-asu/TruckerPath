-- Drop existing tables to start fresh
DROP TABLE IF EXISTS copilot_alerts;
DROP TABLE IF EXISTS detention_events;
DROP TABLE IF EXISTS parking_stops;
DROP TABLE IF EXISTS dict_drivers; -- mock name
DROP TABLE IF EXISTS dispatch_drivers;
DROP TABLE IF EXISTS loads;

-- Loads
CREATE TABLE loads (
  id TEXT PRIMARY KEY,
  origin JSONB,
  destination JSONB,
  commodity TEXT,
  weight NUMERIC,
  rate NUMERIC,
  miles NUMERIC,
  pickup_window JSONB,
  delivery_window JSONB,
  shipper TEXT,
  receiver TEXT,
  status TEXT,
  notes TEXT,
  assigned_driver_id INTEGER
);

-- Dispatch Drivers
CREATE TABLE dispatch_drivers (
  driver_id INTEGER PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  terminal TEXT,
  current_lat NUMERIC,
  current_lng NUMERIC,
  current_city TEXT,
  hos_remaining NUMERIC,
  hos_drive_remaining NUMERIC,
  status TEXT,
  readiness TEXT,
  truck_type TEXT,
  cost_per_mile NUMERIC
);

-- Parking Stops
CREATE TABLE parking_stops (
  id TEXT PRIMARY KEY,
  name TEXT,
  lat NUMERIC,
  lng NUMERIC,
  city TEXT,
  type TEXT,
  total_spaces INTEGER,
  occupancy_percent NUMERIC,
  reservable BOOLEAN,
  amenities JSONB,
  miles_from_origin NUMERIC
);

-- Detention Events
CREATE TABLE detention_events (
  id TEXT PRIMARY KEY,
  load_id TEXT,
  location TEXT,
  facility_name TEXT,
  delay_minutes INTEGER,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cost_per_hour NUMERIC
);

-- Copilot Alerts
CREATE TABLE copilot_alerts (
  id TEXT PRIMARY KEY,
  type TEXT,
  severity TEXT,
  title TEXT,
  message TEXT,
  load_id TEXT,
  driver_id INTEGER,
  "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  action_label TEXT,
  dismissed BOOLEAN DEFAULT false
);

-- Enable Realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE detention_events;
ALTER PUBLICATION supabase_realtime ADD TABLE copilot_alerts;

-- Insert Mock Data
INSERT INTO loads (id, origin, destination, commodity, weight, rate, miles, pickup_window, delivery_window, shipper, receiver, status, notes, assigned_driver_id) VALUES
('PHX-2847', '{"lat": 33.4484, "lng": -112.074, "name": "Phoenix, AZ"}', '{"lat": 32.7767, "lng": -96.797, "name": "Dallas, TX"}', 'Electronics', 42000, 3850, 1065, '{"start": "2026-04-19T09:16:24.000Z", "end": "2026-04-19T10:46:24.000Z"}', '{"start": "2026-04-20T02:46:24.000Z", "end": "2026-04-20T06:46:24.000Z"}', 'West Valley Distribution', 'DFW Logistics Hub', 'pending', 'High-value freight — temperature monitoring required', NULL),
('TUC-1134', '{"lat": 32.2226, "lng": -110.9747, "name": "Tucson, AZ"}', '{"lat": 35.0844, "lng": -106.6504, "name": "Albuquerque, NM"}', 'Building Materials', 44000, 1420, 450, '{"start": "2026-04-19T11:46:24.000Z", "end": "2026-04-19T13:46:24.000Z"}', '{"start": "2026-04-19T20:46:24.000Z", "end": "2026-04-20T00:46:24.000Z"}', 'Southwest Lumber Co.', 'ABQ Construction Supply', 'assigned', NULL, 1005),
('LV-0921', '{"lat": 36.1699, "lng": -115.1398, "name": "Las Vegas, NV"}', '{"lat": 34.0522, "lng": -118.2437, "name": "Los Angeles, CA"}', 'Consumer Goods', 38000, 1650, 270, '{"start": "2026-04-19T09:46:24.000Z", "end": "2026-04-19T11:46:24.000Z"}', '{"start": "2026-04-19T16:46:24.000Z", "end": "2026-04-19T20:46:24.000Z"}', 'Vegas Wholesale', 'LA Distribution Center', 'pending', NULL, NULL),
('PHX-3310', '{"lat": 33.4484, "lng": -112.074, "name": "Phoenix, AZ"}', '{"lat": 36.7783, "lng": -119.4179, "name": "Fresno, CA"}', 'Produce (Refrigerated)', 39000, 2800, 515, '{"start": "2026-04-19T12:46:24.000Z", "end": "2026-04-19T14:46:24.000Z"}', '{"start": "2026-04-19T22:46:24.000Z", "end": "2026-04-20T02:46:24.000Z"}', 'Arizona Fresh Farms', 'Central Valley Cold Storage', 'pending', 'Reefer required — 34°F', NULL);

INSERT INTO dispatch_drivers (driver_id, first_name, last_name, phone, email, terminal, current_lat, current_lng, current_city, hos_remaining, hos_drive_remaining, status, readiness, truck_type, cost_per_mile) VALUES
(1001, 'Jordan', 'Reyes', '602-555-0142', 'jordan.reyes@fleet.example', 'Phoenix Hub', 32.89, -111.76, 'Casa Grande, AZ', 5.5, 3.5, 'IN_TRANSIT', 'unavailable', 'Dry Van 53ft', 1.85),
(1002, 'Alex', 'Novak', '480-555-0199', 'alex.novak@fleet.example', 'Phoenix Hub', 33.425, -111.94, 'Tempe, AZ', 6.0, 11.0, 'AVAILABLE', 'immediate', 'Dry Van 53ft', 1.72),
(1003, 'Mia', 'Okonkwo', '702-555-0108', 'mia.o@fleet.example', 'Las Vegas Yard', 36.1699, -115.1398, 'Las Vegas, NV', 6.0, 11.0, 'AVAILABLE', 'immediate', 'Flatbed 48ft', 1.95),
(1004, 'Sam', 'Chen', '520-555-0166', 'sam.chen@fleet.example', 'Tucson Depot', 32.2217, -110.9265, 'Tucson, AZ', 14.0, 11.0, 'AVAILABLE', '1hr', 'Dry Van 53ft', 1.68),
(1005, 'Priya', 'Shah', '435-555-0121', 'priya.shah@fleet.example', 'Utah Steel', 37.6775, -113.0619, 'Cedar City, UT', 6.0, 4.0, 'IN_TRANSIT', 'unavailable', 'Dry Van 53ft', 1.90);

INSERT INTO parking_stops (id, name, lat, lng, city, type, total_spaces, occupancy_percent, reservable, amenities, miles_from_origin) VALUES
('pk-1', 'Pilot Travel Center', 32.43, -109.86, 'Lordsburg, NM', 'truck_stop', 120, 55, true, '["Fuel", "Showers", "Restaurant", "WiFi"]', 310),
('pk-2', 'Love''s Travel Stop', 32.34, -107.64, 'Deming, NM', 'truck_stop', 90, 68, true, '["Fuel", "Showers", "Subway"]', 375),
('pk-3', 'Flying J Travel Center', 34.18, -103.33, 'Tucumcari, NM', 'truck_stop', 105, 72, true, '["Fuel", "Showers", "Denny''s", "WiFi"]', 620),
('pk-4', 'TA Travel Center Amarillo', 35.19, -101.83, 'Amarillo, TX', 'truck_stop', 150, 88, true, '["Fuel", "Showers", "TA Restaurant", "WiFi", "Scales"]', 780),
('pk-5', 'Shamrock Truck Stop', 35.22, -100.25, 'Shamrock, TX', 'truck_stop', 65, 45, false, '["Fuel", "Showers"]', 745),
('pk-6', 'Love''s Childress', 34.43, -100.2, 'Childress, TX', 'truck_stop', 80, 52, true, '["Fuel", "Showers", "Arby''s", "WiFi"]', 710);
