-- Dispatcher OS schema + demo seed
-- This schema extends the original TruckerPath demo tables into a production-shaped
-- operations data model while still supporting local/demo-first workflows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS assignment_audit_log;
DROP TABLE IF EXISTS downstream_load_links;
DROP TABLE IF EXISTS fuel_price_snapshots;
DROP TABLE IF EXISTS fuel_partner_locations;
DROP TABLE IF EXISTS facility_entry_images;
DROP TABLE IF EXISTS facility_entry_points;
DROP TABLE IF EXISTS customer_notifications;
DROP TABLE IF EXISTS detention_invoice_drafts;
DROP TABLE IF EXISTS invoice_reconciliation;
DROP TABLE IF EXISTS invoice_drafts;
DROP TABLE IF EXISTS load_documents;
DROP TABLE IF EXISTS document_requirements;
DROP TABLE IF EXISTS dispatcher_notifications;
DROP TABLE IF EXISTS driver_notifications;
DROP TABLE IF EXISTS ai_recommendations;
DROP TABLE IF EXISTS dispatcher_tasks;
DROP TABLE IF EXISTS market_alerts;
DROP TABLE IF EXISTS road_condition_alerts;
DROP TABLE IF EXISTS law_change_alerts;
DROP TABLE IF EXISTS compliance_events;
DROP TABLE IF EXISTS safety_scores;
DROP TABLE IF EXISTS driver_incidents;
DROP TABLE IF EXISTS repair_estimates;
DROP TABLE IF EXISTS repair_shops;
DROP TABLE IF EXISTS maintenance_events;
DROP TABLE IF EXISTS eld_events;
DROP TABLE IF EXISTS hos_snapshots;
DROP TABLE IF EXISTS driver_readiness_scores;
DROP TABLE IF EXISTS route_options;
DROP TABLE IF EXISTS route_plans;
DROP TABLE IF EXISTS trip_events;
DROP TABLE IF EXISTS trip_stops;
DROP TABLE IF EXISTS trips;
DROP TABLE IF EXISTS parking_stops;
DROP TABLE IF EXISTS detention_events;
DROP TABLE IF EXISTS copilot_alerts;
DROP TABLE IF EXISTS loads;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS dispatch_drivers;
DROP TABLE IF EXISTS terminals;
DROP TABLE IF EXISTS customers;

CREATE TABLE terminals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  lat NUMERIC(9, 6),
  lng NUMERIC(9, 6),
  timezone TEXT DEFAULT 'America/Chicago'
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  billing_terms TEXT
);

CREATE TABLE dispatch_drivers (
  driver_id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  terminal_id TEXT REFERENCES terminals(id),
  current_lat NUMERIC(9, 6),
  current_lng NUMERIC(9, 6),
  current_city TEXT,
  current_state TEXT,
  hos_remaining NUMERIC(6, 2),
  hos_drive_remaining NUMERIC(6, 2),
  status TEXT NOT NULL,
  readiness TEXT,
  truck_type TEXT,
  cost_per_mile NUMERIC(8, 2),
  csa_score NUMERIC(5, 2),
  maintenance_score NUMERIC(5, 2),
  trailer_compatibility JSONB DEFAULT '[]'::jsonb,
  tomorrow_available_at TIMESTAMPTZ,
  downstream_dependency_ids JSONB DEFAULT '[]'::jsonb,
  eld_provider TEXT,
  eld_error_code TEXT,
  idle_since TIMESTAMPTZ,
  breakdown_status TEXT DEFAULT 'none',
  repair_eta_minutes INTEGER,
  profitability_score NUMERIC(5, 2),
  fuel_efficiency_loaded NUMERIC(5, 2),
  fuel_efficiency_empty NUMERIC(5, 2),
  notes TEXT
);

CREATE TABLE vehicles (
  id TEXT PRIMARY KEY,
  unit TEXT NOT NULL,
  vin TEXT,
  equipment TEXT NOT NULL,
  trailer_type TEXT,
  status TEXT NOT NULL,
  assigned_driver_id TEXT REFERENCES dispatch_drivers(driver_id),
  home_terminal_id TEXT REFERENCES terminals(id),
  current_fuel_percent NUMERIC(5, 2),
  mpg_loaded NUMERIC(5, 2),
  mpg_empty NUMERIC(5, 2),
  maintenance_score NUMERIC(5, 2),
  csa_score NUMERIC(5, 2),
  eld_provider TEXT,
  eld_error_code TEXT,
  breakdown_status TEXT DEFAULT 'none',
  repair_eta_minutes INTEGER,
  equipment_compatibility JSONB DEFAULT '[]'::jsonb,
  last_service_at TIMESTAMPTZ,
  next_service_due_at TIMESTAMPTZ
);

CREATE TABLE loads (
  id TEXT PRIMARY KEY,
  origin JSONB NOT NULL,
  destination JSONB NOT NULL,
  lane TEXT NOT NULL,
  commodity TEXT,
  weight NUMERIC,
  rate NUMERIC,
  miles NUMERIC,
  pickup_window JSONB NOT NULL,
  delivery_window JSONB NOT NULL,
  shipper TEXT,
  receiver TEXT,
  customer_id TEXT REFERENCES customers(id),
  status TEXT NOT NULL,
  urgency TEXT,
  notes TEXT,
  assigned_driver_id TEXT REFERENCES dispatch_drivers(driver_id),
  assigned_vehicle_id TEXT REFERENCES vehicles(id),
  equipment_required TEXT,
  docs_required JSONB DEFAULT '[]'::jsonb,
  detention_terms TEXT,
  profitability_projection NUMERIC(10, 2),
  best_match_driver_id TEXT REFERENCES dispatch_drivers(driver_id),
  downstream_dependency_ids JSONB DEFAULT '[]'::jsonb,
  route_legality_source JSONB DEFAULT '{}'::jsonb,
  last_mile_facility_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trips (
  id TEXT PRIMARY KEY,
  load_id TEXT REFERENCES loads(id),
  driver_id TEXT REFERENCES dispatch_drivers(driver_id),
  vehicle_id TEXT REFERENCES vehicles(id),
  status TEXT NOT NULL,
  origin_city TEXT,
  destination_city TEXT,
  live_eta TIMESTAMPTZ,
  route_health TEXT,
  fuel_status TEXT,
  parking_stop_plan JSONB DEFAULT '[]'::jsonb,
  detention_state TEXT,
  alert_count INTEGER DEFAULT 0,
  last_mile_plan JSONB DEFAULT '{}'::jsonb,
  downstream_impact TEXT,
  customer_sla_risk TEXT,
  latest_hos_hours NUMERIC(6, 2)
);

CREATE TABLE trip_stops (
  id TEXT PRIMARY KEY,
  trip_id TEXT REFERENCES trips(id),
  sequence_number INTEGER NOT NULL,
  stop_type TEXT NOT NULL,
  facility_name TEXT,
  city TEXT,
  state TEXT,
  planned_arrival TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  planned_departure TIMESTAMPTZ,
  actual_departure TIMESTAMPTZ,
  detention_minutes INTEGER DEFAULT 0,
  required_documents JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE trip_events (
  id TEXT PRIMARY KEY,
  trip_id TEXT REFERENCES trips(id),
  event_type TEXT NOT NULL,
  severity TEXT,
  title TEXT NOT NULL,
  details TEXT,
  happened_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE route_plans (
  id TEXT PRIMARY KEY,
  load_id TEXT REFERENCES loads(id),
  trip_id TEXT REFERENCES trips(id),
  selected_option_label TEXT,
  recommended_option_label TEXT,
  legality_status TEXT,
  source_registry JSONB DEFAULT '[]'::jsonb,
  last_checked_at TIMESTAMPTZ,
  recommended_reasoning TEXT
);

CREATE TABLE route_options (
  id TEXT PRIMARY KEY,
  route_plan_id TEXT REFERENCES route_plans(id),
  label TEXT NOT NULL,
  miles NUMERIC,
  eta_minutes INTEGER,
  fuel_cost NUMERIC(10, 2),
  toll_cost NUMERIC(10, 2),
  fuel_partner_savings NUMERIC(10, 2),
  hos_stop_plan JSONB DEFAULT '[]'::jsonb,
  leftover_hos_hours NUMERIC(6, 2),
  parking_confidence NUMERIC(5, 2),
  parking_predicted_occupancy NUMERIC(5, 2),
  permitted_route_compliance TEXT,
  state_restriction_warnings JSONB DEFAULT '[]'::jsonb,
  weather_closure_risk TEXT,
  detention_sensitivity TEXT,
  downstream_impact TEXT,
  last_mile_confidence NUMERIC(5, 2),
  route_legality_source JSONB DEFAULT '{}'::jsonb,
  deterministic_score NUMERIC(6, 2),
  ai_explanation TEXT,
  structured_factors JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE driver_readiness_scores (
  id TEXT PRIMARY KEY,
  driver_id TEXT REFERENCES dispatch_drivers(driver_id),
  load_id TEXT REFERENCES loads(id),
  route_option_id TEXT REFERENCES route_options(id),
  score NUMERIC(6, 2) NOT NULL,
  deadhead_component NUMERIC(6, 2),
  hos_component NUMERIC(6, 2),
  total_trip_component NUMERIC(6, 2),
  equipment_component NUMERIC(6, 2),
  maintenance_component NUMERIC(6, 2),
  tomorrow_impact_component NUMERIC(6, 2),
  stranded_risk_component NUMERIC(6, 2),
  fuel_component NUMERIC(6, 2),
  parking_component NUMERIC(6, 2),
  ai_explanation TEXT,
  factor_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hos_snapshots (
  id TEXT PRIMARY KEY,
  driver_id TEXT REFERENCES dispatch_drivers(driver_id),
  trip_id TEXT REFERENCES trips(id),
  captured_at TIMESTAMPTZ NOT NULL,
  drive_remaining_hours NUMERIC(6, 2),
  shift_remaining_hours NUMERIC(6, 2),
  cycle_remaining_hours NUMERIC(6, 2),
  break_due_in_minutes INTEGER,
  source TEXT DEFAULT 'eld',
  violation_risk TEXT
);

CREATE TABLE eld_events (
  id TEXT PRIMARY KEY,
  driver_id TEXT REFERENCES dispatch_drivers(driver_id),
  vehicle_id TEXT REFERENCES vehicles(id),
  trip_id TEXT REFERENCES trips(id),
  provider TEXT,
  error_code TEXT,
  severity TEXT,
  title TEXT NOT NULL,
  details TEXT,
  estimated_repair_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE maintenance_events (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT REFERENCES vehicles(id),
  driver_id TEXT REFERENCES dispatch_drivers(driver_id),
  event_type TEXT,
  severity TEXT,
  title TEXT NOT NULL,
  details TEXT,
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE TABLE repair_shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  lat NUMERIC(9, 6),
  lng NUMERIC(9, 6),
  capabilities JSONB DEFAULT '[]'::jsonb,
  phone TEXT,
  avg_turnaround_hours NUMERIC(6, 2)
);

CREATE TABLE repair_estimates (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT REFERENCES vehicles(id),
  driver_id TEXT REFERENCES dispatch_drivers(driver_id),
  repair_shop_id TEXT REFERENCES repair_shops(id),
  issue_code TEXT,
  estimated_minutes INTEGER,
  confidence NUMERIC(5, 2),
  recommendation TEXT
);

CREATE TABLE driver_incidents (
  id TEXT PRIMARY KEY,
  driver_id TEXT REFERENCES dispatch_drivers(driver_id),
  incident_type TEXT,
  severity TEXT,
  happened_at TIMESTAMPTZ,
  details TEXT,
  csa_impact NUMERIC(6, 2)
);

CREATE TABLE safety_scores (
  id TEXT PRIMARY KEY,
  driver_id TEXT REFERENCES dispatch_drivers(driver_id),
  vehicle_id TEXT REFERENCES vehicles(id),
  score_date DATE NOT NULL,
  csa_score NUMERIC(6, 2),
  inspection_score NUMERIC(6, 2),
  maintenance_score NUMERIC(6, 2),
  violation_count INTEGER DEFAULT 0,
  explanation TEXT
);

CREATE TABLE compliance_events (
  id TEXT PRIMARY KEY,
  driver_id TEXT REFERENCES dispatch_drivers(driver_id),
  vehicle_id TEXT REFERENCES vehicles(id),
  event_type TEXT,
  severity TEXT,
  title TEXT NOT NULL,
  details TEXT,
  effective_date DATE,
  status TEXT,
  source_url TEXT
);

CREATE TABLE law_change_alerts (
  id TEXT PRIMARY KEY,
  state_code TEXT,
  title TEXT NOT NULL,
  operational_impact TEXT,
  effective_date DATE,
  publish_date DATE,
  source_url TEXT,
  restriction_type TEXT,
  affected_geometry JSONB DEFAULT '{}'::jsonb,
  review_status TEXT,
  last_checked_date DATE
);

CREATE TABLE road_condition_alerts (
  id TEXT PRIMARY KEY,
  state_code TEXT,
  title TEXT NOT NULL,
  operational_impact TEXT,
  severity TEXT,
  source_url TEXT,
  affected_geometry JSONB DEFAULT '{}'::jsonb,
  effective_date DATE,
  last_checked_date DATE
);

CREATE TABLE market_alerts (
  id TEXT PRIMARY KEY,
  market TEXT,
  title TEXT NOT NULL,
  operational_impact TEXT,
  severity TEXT,
  effective_date DATE,
  source_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE dispatcher_tasks (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  why_it_matters TEXT,
  effort_minutes INTEGER,
  confidence NUMERIC(5, 2),
  primary_cta TEXT,
  primary_action TEXT,
  related_entities JSONB DEFAULT '[]'::jsonb,
  operational_reasons JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'open',
  snoozed_until TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

CREATE TABLE ai_recommendations (
  id TEXT PRIMARY KEY,
  recommendation_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  title TEXT NOT NULL,
  explanation TEXT,
  confidence NUMERIC(5, 2),
  structured_factors JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE driver_notifications (
  id TEXT PRIMARY KEY,
  driver_id TEXT REFERENCES dispatch_drivers(driver_id),
  notification_type TEXT,
  severity TEXT,
  title TEXT NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dispatcher_notifications (
  id TEXT PRIMARY KEY,
  notification_type TEXT,
  severity TEXT,
  title TEXT NOT NULL,
  message TEXT,
  related_entities JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_requirements (
  id TEXT PRIMARY KEY,
  load_id TEXT REFERENCES loads(id),
  stop_type TEXT,
  document_type TEXT NOT NULL,
  required BOOLEAN DEFAULT true,
  billing_blocker BOOLEAN DEFAULT false
);

CREATE TABLE load_documents (
  id TEXT PRIMARY KEY,
  load_id TEXT REFERENCES loads(id),
  trip_id TEXT REFERENCES trips(id),
  driver_id TEXT REFERENCES dispatch_drivers(driver_id),
  document_type TEXT NOT NULL,
  status TEXT NOT NULL,
  file_url TEXT,
  extracted_fields JSONB DEFAULT '{}'::jsonb,
  missing_fields JSONB DEFAULT '[]'::jsonb,
  uploaded_at TIMESTAMPTZ,
  ai_explanation TEXT
);

CREATE TABLE invoice_drafts (
  id TEXT PRIMARY KEY,
  load_id TEXT REFERENCES loads(id),
  customer_id TEXT REFERENCES customers(id),
  draft_type TEXT NOT NULL,
  status TEXT NOT NULL,
  amount NUMERIC(10, 2),
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoice_reconciliation (
  id TEXT PRIMARY KEY,
  load_id TEXT REFERENCES loads(id),
  invoice_draft_id TEXT REFERENCES invoice_drafts(id),
  reconciliation_status TEXT NOT NULL,
  match_confidence NUMERIC(5, 2),
  missing_fields JSONB DEFAULT '[]'::jsonb,
  blockers JSONB DEFAULT '[]'::jsonb,
  ai_explanation TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE detention_events (
  id TEXT PRIMARY KEY,
  load_id TEXT REFERENCES loads(id),
  trip_id TEXT REFERENCES trips(id),
  location TEXT,
  facility_name TEXT,
  delay_minutes INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  cost_per_hour NUMERIC(10, 2),
  shared_clock_state TEXT,
  margin_impact NUMERIC(10, 2),
  tomorrow_load_impact TEXT
);

CREATE TABLE detention_invoice_drafts (
  id TEXT PRIMARY KEY,
  detention_event_id TEXT REFERENCES detention_events(id),
  invoice_draft_id TEXT REFERENCES invoice_drafts(id),
  status TEXT,
  amount NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customer_notifications (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id),
  load_id TEXT REFERENCES loads(id),
  notification_type TEXT,
  draft_message TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE facility_entry_points (
  id TEXT PRIMARY KEY,
  facility_name TEXT NOT NULL,
  destination_city TEXT,
  recommended_entrance TEXT,
  parking_area TEXT,
  avoid_notes JSONB DEFAULT '[]'::jsonb,
  last_mile_confidence NUMERIC(5, 2),
  reasoning TEXT
);

CREATE TABLE facility_entry_images (
  id TEXT PRIMARY KEY,
  facility_entry_point_id TEXT REFERENCES facility_entry_points(id),
  image_url TEXT NOT NULL,
  image_type TEXT,
  provider TEXT,
  annotation JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE fuel_partner_locations (
  id TEXT PRIMARY KEY,
  partner_name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  lat NUMERIC(9, 6),
  lng NUMERIC(9, 6),
  diesel_discount_per_gallon NUMERIC(6, 3),
  amenities JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE fuel_price_snapshots (
  id TEXT PRIMARY KEY,
  fuel_partner_location_id TEXT REFERENCES fuel_partner_locations(id),
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  retail_price NUMERIC(6, 3),
  net_price NUMERIC(6, 3),
  source TEXT
);

CREATE TABLE downstream_load_links (
  id TEXT PRIMARY KEY,
  source_load_id TEXT REFERENCES loads(id),
  downstream_load_id TEXT REFERENCES loads(id),
  impact_type TEXT,
  explanation TEXT
);

CREATE TABLE assignment_audit_log (
  id TEXT PRIMARY KEY,
  load_id TEXT REFERENCES loads(id),
  trip_id TEXT REFERENCES trips(id),
  driver_id TEXT REFERENCES dispatch_drivers(driver_id),
  vehicle_id TEXT REFERENCES vehicles(id),
  action_type TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE parking_stops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat NUMERIC(9, 6),
  lng NUMERIC(9, 6),
  city TEXT,
  state TEXT,
  type TEXT,
  total_spaces INTEGER,
  occupancy_percent NUMERIC(5, 2),
  predicted_occupancy NUMERIC(5, 2),
  parking_confidence NUMERIC(5, 2),
  reservable BOOLEAN,
  amenities JSONB DEFAULT '[]'::jsonb,
  miles_from_origin NUMERIC(8, 2)
);

CREATE TABLE copilot_alerts (
  id TEXT PRIMARY KEY,
  type TEXT,
  severity TEXT,
  title TEXT,
  message TEXT,
  load_id TEXT REFERENCES loads(id),
  driver_id TEXT REFERENCES dispatch_drivers(driver_id),
  "timestamp" TIMESTAMPTZ DEFAULT NOW(),
  action_label TEXT,
  dismissed BOOLEAN DEFAULT false
);

INSERT INTO terminals (id, name, city, state, lat, lng, timezone) VALUES
('term-dal', 'Dallas Hub', 'Dallas', 'TX', 32.7767, -96.7970, 'America/Chicago'),
('term-hou', 'Houston South', 'Houston', 'TX', 29.7604, -95.3698, 'America/Chicago'),
('term-kc', 'Kansas City Yard', 'Kansas City', 'MO', 39.0997, -94.5786, 'America/Chicago'),
('term-mem', 'Memphis Relay', 'Memphis', 'TN', 35.1495, -90.0490, 'America/Chicago'),
('term-phx', 'Phoenix West', 'Phoenix', 'AZ', 33.4484, -112.0740, 'America/Phoenix'),
('term-den', 'Front Range Ops', 'Denver', 'CO', 39.7392, -104.9903, 'America/Denver');

INSERT INTO customers (id, name, tier, contact_name, contact_email, contact_phone, billing_terms) VALUES
('cust-lone-star', 'Lone Star Retail', 'strategic', 'Mia Cardenas', 'mia@lonestar.example', '214-555-1000', 'Net 30'),
('cust-gulf-fresh', 'Gulf Fresh', 'strategic', 'Andre Bell', 'andre@gulffresh.example', '713-555-1100', 'Net 21'),
('cust-metro-cold', 'Metro Cold Chain', 'priority', 'Dana Reid', 'dana@metrocold.example', '817-555-1200', 'Net 21'),
('cust-river-south', 'River South Retail', 'priority', 'Noah Lane', 'noah@riversouth.example', '901-555-1300', 'Net 30'),
('cust-heartland', 'Heartland Distribution', 'core', 'Ava Brooks', 'ava@heartland.example', '816-555-1400', 'Net 30'),
('cust-front-range', 'Front Range Retail', 'core', 'Kai Morgan', 'kai@frontrange.example', '303-555-1500', 'Net 30'),
('cust-border', 'Border Freight', 'core', 'Elena Soto', 'elena@borderfreight.example', '915-555-1600', 'Net 30'),
('cust-desert-tech', 'Desert Electronics', 'priority', 'Luis Ramos', 'luis@deserttech.example', '602-555-1700', 'Net 21'),
('cust-south-gulf', 'South Gulf Intermodal', 'core', 'Jules Wright', 'jules@southgulf.example', '504-555-1800', 'Net 30'),
('cust-ark-steel', 'Ark Valley Steel', 'core', 'Grant Miles', 'grant@arksteel.example', '918-555-1900', 'Net 30');

INSERT INTO dispatch_drivers (
  driver_id, first_name, last_name, phone, email, terminal_id, current_lat, current_lng,
  current_city, current_state, hos_remaining, hos_drive_remaining, status, readiness, truck_type,
  cost_per_mile, csa_score, maintenance_score, trailer_compatibility, tomorrow_available_at,
  downstream_dependency_ids, eld_provider, eld_error_code, idle_since, breakdown_status,
  repair_eta_minutes, profitability_score, fuel_efficiency_loaded, fuel_efficiency_empty, notes
) VALUES
('drv-patel', 'Sanjay', 'Patel', '469-555-2001', 'sanjay.patel@fleet.example', 'term-dal', 32.8041, -96.8467, 'Dallas', 'TX', 11.2, 8.6, 'available', 'ready-now', 'Dry Van 53', 1.71, 91, 92, '["Dry Van 53"]', NOW() + INTERVAL '1 hour', '[]', 'Samsara', NULL, NULL, 'none', NULL, 93, 6.8, 7.4, 'Best match for urgent Dallas outbound'),
('drv-ramirez', 'Ana', 'Ramirez', '713-555-2002', 'ana.ramirez@fleet.example', 'term-hou', 29.4870, -95.1020, 'Baytown', 'TX', 2.2, 1.47, 'active', 'critical', 'Reefer 53', 1.94, 84, 73, '["Reefer 53"]', NOW() + INTERVAL '14 hour', '["LD-4860"]', 'Motive', NULL, NOW() - INTERVAL '24 minutes', 'none', NULL, 77, 5.9, 6.5, 'Fuel plus HOS critical'),
('drv-nguyen', 'Thu', 'Nguyen', '314-555-2003', 'thu.nguyen@fleet.example', 'term-kc', 38.6270, -90.1994, 'St. Louis', 'MO', 7.8, 6.5, 'active', 'watch', 'Dry Van 53', 1.76, 88, 89, '["Dry Van 53"]', NOW() + INTERVAL '10 hour', '["LD-4854"]', 'Samsara', NULL, NULL, 'none', NULL, 86, 6.4, 7.1, 'Weather delay on current trip'),
('drv-chen', 'Leo', 'Chen', '901-555-2004', 'leo.chen@fleet.example', 'term-mem', 35.1174, -89.9711, 'Memphis', 'TN', 8.3, 5.4, 'active', 'attention', 'Dry Van 53', 1.75, 79, 78, '["Dry Van 53"]', NOW() + INTERVAL '12 hour', '[]', 'KeepTruckin', 'ELD-SYNC-401', NULL, 'none', NULL, 81, 6.3, 6.9, 'ELD sync issue needs manual verification'),
('drv-williams', 'Darius', 'Williams', '602-555-2005', 'darius.williams@fleet.example', 'term-phx', 33.6422, -112.1315, 'Phoenix', 'AZ', 6.5, 5.2, 'active', 'risk', 'Flatbed', 1.88, 86, 88, '["Flatbed"]', NOW() + INTERVAL '11 hour', '[]', 'Motive', NULL, NULL, 'none', NULL, 82, 5.8, 6.4, 'Billing blocker after delivered load'),
('drv-martinez', 'Jose', 'Martinez', '303-555-2006', 'jose.martinez@fleet.example', 'term-den', 39.7392, -104.9903, 'Denver', 'CO', 5.2, 4.8, 'breakdown', 'unavailable', 'Dry Van 53', 1.92, 74, 42, '["Dry Van 53"]', NOW() + INTERVAL '18 hour', '[]', 'Samsara', 'P2459', NOW() - INTERVAL '2 hour', 'breakdown', 210, 63, 5.7, 6.2, 'Breakdown with aftertreatment fault'),
('drv-okafor', 'Nia', 'Okafor', '817-555-2007', 'nia.okafor@fleet.example', 'term-dal', 32.8989, -97.0370, 'Grapevine', 'TX', 8.9, 7.1, 'available', 'ready-now', 'Dry Van 53', 1.69, 93, 94, '["Dry Van 53"]', NOW() + INTERVAL '2 hour', '[]', 'Samsara', NULL, NULL, 'none', NULL, 95, 6.9, 7.3, 'Strong relay candidate'),
('drv-reed', 'Marcus', 'Reed', '817-555-2008', 'marcus.reed@fleet.example', 'term-dal', 32.7555, -97.3308, 'Fort Worth', 'TX', 8.1, 6.4, 'available', 'ready-now', 'Reefer 53', 1.97, 92, 91, '["Reefer 53"]', NOW() + INTERVAL '3 hour', '["LD-4860","LD-4855"]', 'Motive', NULL, NULL, 'none', NULL, 90, 6.1, 6.6, 'Tomorrow Dallas reefer surge protection candidate'),
('drv-johnson', 'Tara', 'Johnson', '504-555-2009', 'tara.johnson@fleet.example', 'term-hou', 29.9511, -90.0715, 'New Orleans', 'LA', 7.3, 6.1, 'available', 'ready-60', 'Power Only', 1.83, 87, 86, '["Power Only","Dry Van 53"]', NOW() + INTERVAL '2 hour', '[]', 'KeepTruckin', NULL, NULL, 'none', NULL, 85, 6.0, 6.7, 'Power-only rescue option'),
('drv-davis', 'Quinn', 'Davis', '816-555-2010', 'quinn.davis@fleet.example', 'term-kc', 39.0997, -94.5786, 'Kansas City', 'MO', 9.1, 7.8, 'active', 'good', 'Dry Van 53', 1.73, 90, 95, '["Dry Van 53"]', NOW() + INTERVAL '9 hour', '["LD-4852","LD-4858"]', 'Samsara', NULL, NULL, 'none', NULL, 92, 6.7, 7.1, 'Healthy regional runner'),
('drv-brown', 'Keisha', 'Brown', '918-555-2011', 'keisha.brown@fleet.example', 'term-kc', 36.1540, -95.9928, 'Tulsa', 'OK', 6.0, 5.4, 'maintenance', 'blocked', 'Flatbed', 1.89, 82, 58, '["Flatbed"]', NOW() + INTERVAL '16 hour', '[]', 'Motive', NULL, NULL, 'maintenance', 180, 71, 5.5, 6.1, 'Service window in progress'),
('drv-jackson', 'Eli', 'Jackson', '915-555-2012', 'eli.jackson@fleet.example', 'term-phx', 31.7619, -106.4850, 'El Paso', 'TX', 8.4, 6.9, 'available', 'ready-now', 'Dry Van 53', 1.74, 89, 90, '["Dry Van 53"]', NOW() + INTERVAL '2 hour', '["LD-4856","LD-4857"]', 'Samsara', NULL, NULL, 'none', NULL, 88, 6.8, 7.2, 'Border and long-haul coverage');

INSERT INTO vehicles (
  id, unit, vin, equipment, trailer_type, status, assigned_driver_id, home_terminal_id,
  current_fuel_percent, mpg_loaded, mpg_empty, maintenance_score, csa_score, eld_provider,
  eld_error_code, breakdown_status, repair_eta_minutes, equipment_compatibility,
  last_service_at, next_service_due_at
) VALUES
('veh-05', 'T-05', 'VIN00005', 'Dry Van 53', 'Dry Van 53', 'active', 'drv-patel', 'term-dal', 82, 6.8, 7.4, 92, 91, 'Samsara', NULL, 'none', NULL, '["Dry Van 53"]', NOW() - INTERVAL '12 day', NOW() + INTERVAL '18 day'),
('veh-14', 'T-14', 'VIN00014', 'Reefer 53', 'Reefer 53', 'active', 'drv-ramirez', 'term-hou', 17, 5.9, 6.5, 73, 84, 'Motive', NULL, 'none', NULL, '["Reefer 53"]', NOW() - INTERVAL '20 day', NOW() + INTERVAL '6 day'),
('veh-03', 'T-03', 'VIN00003', 'Dry Van 53', 'Dry Van 53', 'active', 'drv-nguyen', 'term-kc', 61, 6.4, 7.1, 89, 88, 'Samsara', NULL, 'none', NULL, '["Dry Van 53"]', NOW() - INTERVAL '10 day', NOW() + INTERVAL '20 day'),
('veh-12', 'T-12', 'VIN00012', 'Dry Van 53', 'Dry Van 53', 'active', 'drv-chen', 'term-mem', 55, 6.3, 6.9, 78, 79, 'KeepTruckin', 'ELD-SYNC-401', 'none', NULL, '["Dry Van 53"]', NOW() - INTERVAL '18 day', NOW() + INTERVAL '9 day'),
('veh-21', 'T-21', 'VIN00021', 'Flatbed', 'Flatbed', 'active', 'drv-williams', 'term-phx', 74, 5.8, 6.4, 88, 86, 'Motive', NULL, 'none', NULL, '["Flatbed"]', NOW() - INTERVAL '14 day', NOW() + INTERVAL '16 day'),
('veh-08', 'T-08', 'VIN00008', 'Dry Van 53', 'Dry Van 53', 'breakdown', 'drv-martinez', 'term-den', 44, 5.7, 6.2, 42, 74, 'Samsara', 'P2459', 'breakdown', 210, '["Dry Van 53"]', NOW() - INTERVAL '30 day', NOW() + INTERVAL '2 day'),
('veh-09', 'T-09', 'VIN00009', 'Dry Van 53', 'Dry Van 53', 'available', 'drv-okafor', 'term-dal', 79, 6.9, 7.3, 94, 93, 'Samsara', NULL, 'none', NULL, '["Dry Van 53"]', NOW() - INTERVAL '9 day', NOW() + INTERVAL '22 day'),
('veh-16', 'T-16', 'VIN00016', 'Reefer 53', 'Reefer 53', 'available', 'drv-reed', 'term-dal', 68, 6.1, 6.6, 91, 92, 'Motive', NULL, 'none', NULL, '["Reefer 53"]', NOW() - INTERVAL '8 day', NOW() + INTERVAL '24 day'),
('veh-18', 'T-18', 'VIN00018', 'Power Only', 'Power Only', 'available', 'drv-johnson', 'term-hou', 63, 6.0, 6.7, 86, 87, 'KeepTruckin', NULL, 'none', NULL, '["Power Only","Dry Van 53"]', NOW() - INTERVAL '11 day', NOW() + INTERVAL '19 day'),
('veh-11', 'T-11', 'VIN00011', 'Dry Van 53', 'Dry Van 53', 'active', 'drv-davis', 'term-kc', 81, 6.7, 7.1, 95, 90, 'Samsara', NULL, 'none', NULL, '["Dry Van 53"]', NOW() - INTERVAL '6 day', NOW() + INTERVAL '26 day'),
('veh-25', 'T-25', 'VIN00025', 'Flatbed', 'Flatbed', 'maintenance', 'drv-brown', 'term-kc', 37, 5.5, 6.1, 58, 82, 'Motive', NULL, 'maintenance', 180, '["Flatbed"]', NOW() - INTERVAL '28 day', NOW() + INTERVAL '1 day'),
('veh-17', 'T-17', 'VIN00017', 'Dry Van 53', 'Dry Van 53', 'available', 'drv-jackson', 'term-phx', 72, 6.8, 7.2, 90, 89, 'Samsara', NULL, 'none', NULL, '["Dry Van 53"]', NOW() - INTERVAL '7 day', NOW() + INTERVAL '23 day');

INSERT INTO vehicles (
  id, unit, vin, equipment, trailer_type, status, home_terminal_id, current_fuel_percent,
  mpg_loaded, mpg_empty, maintenance_score, csa_score, eld_provider, breakdown_status,
  equipment_compatibility, last_service_at, next_service_due_at
)
SELECT
  'veh-spare-' || LPAD(gs::text, 2, '0'),
  'S-' || LPAD(gs::text, 2, '0'),
  'VINSPARE' || LPAD(gs::text, 4, '0'),
  CASE WHEN gs % 4 = 0 THEN 'Reefer 53' WHEN gs % 3 = 0 THEN 'Flatbed' ELSE 'Dry Van 53' END,
  CASE WHEN gs % 4 = 0 THEN 'Reefer 53' WHEN gs % 3 = 0 THEN 'Flatbed' ELSE 'Dry Van 53' END,
  CASE WHEN gs % 5 = 0 THEN 'maintenance' ELSE 'available' END,
  CASE WHEN gs % 2 = 0 THEN 'term-dal' ELSE 'term-kc' END,
  58 + gs,
  5.8 + (gs * 0.05),
  6.2 + (gs * 0.05),
  70 + gs,
  75 + gs,
  CASE WHEN gs % 2 = 0 THEN 'Samsara' ELSE 'Motive' END,
  'none',
  CASE WHEN gs % 4 = 0 THEN '["Reefer 53"]'::jsonb WHEN gs % 3 = 0 THEN '["Flatbed"]'::jsonb ELSE '["Dry Van 53"]'::jsonb END,
  NOW() - (gs || ' day')::interval,
  NOW() + ((20 - gs) || ' day')::interval
FROM generate_series(1, 12) AS gs;

INSERT INTO loads (
  id, origin, destination, lane, commodity, weight, rate, miles, pickup_window, delivery_window,
  shipper, receiver, customer_id, status, urgency, notes, assigned_driver_id, assigned_vehicle_id,
  equipment_required, docs_required, detention_terms, profitability_projection, best_match_driver_id,
  downstream_dependency_ids, route_legality_source, last_mile_facility_id
) VALUES
('LD-4812', '{"name":"Dallas, TX","lat":32.7767,"lng":-96.7970}', '{"name":"Houston, TX","lat":29.7604,"lng":-95.3698}', 'Dallas -> Houston', 'Consumer packaged goods', 41800, 3260, 239, '{"start":"2026-04-19T12:00:00Z","end":"2026-04-19T15:00:00Z"}', '{"start":"2026-04-20T00:00:00Z","end":"2026-04-20T03:00:00Z"}', 'North Dallas Retail', 'Houston South DC', 'cust-lone-star', 'unassigned', 'critical', 'Patel is the ideal match and pickup window is tightening.', NULL, NULL, 'Dry Van 53', '["Rate confirmation","BOL","POD"]', '$75/hr after 2h', 1125, 'drv-patel', '[]', '{"sourceUrl":"https://www.fmcsa.dot.gov/regulations/federal-register-documents/2025-22192","effectiveDate":"2025-11-18","reviewStatus":"seeded-demo"}', 'fac-houston'),
('LD-4849', '{"name":"Phoenix, AZ","lat":33.4484,"lng":-112.0740}', '{"name":"Tucson, AZ","lat":32.2226,"lng":-110.9747}', 'Phoenix -> Tucson', 'Steel coil', 39000, 2410, 113, '{"start":"2026-04-19T10:30:00Z","end":"2026-04-19T12:30:00Z"}', '{"start":"2026-04-19T18:00:00Z","end":"2026-04-19T21:00:00Z"}', 'Southwest Metals', 'Desert Fabrication', 'cust-ark-steel', 'in_transit', 'high', 'Delivered but billing is blocked by missing BOL/POD.', 'drv-williams', 'veh-21', 'Flatbed', '["BOL","POD","Lumper receipt"]', '$70/hr after 2h', 744, 'drv-williams', '[]', '{"sourceUrl":"https://azdot.gov/sites/default/files/media/2022/07/OversizeandOverweightEnvelopeandSpecialPermitRulesEffective07082022.pdf","effectiveDate":"2022-07-08","reviewStatus":"seeded-demo"}', 'fac-phoenix'),
('LD-4850', '{"name":"St. Louis, MO","lat":38.6270,"lng":-90.1994}', '{"name":"Memphis, TN","lat":35.1495,"lng":-90.0490}', 'St. Louis -> Memphis', 'Dry grocery', 42050, 2110, 284, '{"start":"2026-04-19T09:00:00Z","end":"2026-04-19T11:00:00Z"}', '{"start":"2026-04-19T20:30:00Z","end":"2026-04-19T23:30:00Z"}', 'Gateway Foods', 'Memphis South Retail', 'cust-river-south', 'in_transit', 'high', 'Weather and traffic delay are pressuring ETA.', 'drv-nguyen', 'veh-03', 'Dry Van 53', '["BOL","POD"]', '$75/hr after 2h', 646, 'drv-nguyen', '[]', '{"sourceUrl":"https://www.fmcsa.dot.gov/regulations/federal-register-documents/2025-22192","effectiveDate":"2025-11-18","reviewStatus":"seeded-demo"}', 'fac-memphis'),
('LD-4851', '{"name":"Tulsa, OK","lat":36.1540,"lng":-95.9928}', '{"name":"Little Rock, AR","lat":34.7465,"lng":-92.2896}', 'Tulsa -> Little Rock', 'Steel products', 44000, 1880, 276, '{"start":"2026-04-19T18:00:00Z","end":"2026-04-19T21:00:00Z"}', '{"start":"2026-04-20T03:00:00Z","end":"2026-04-20T05:00:00Z"}', 'Ark Valley Steel', 'Little Rock Fabrication', 'cust-ark-steel', 'open', 'medium', 'Brown is still in maintenance, so this needs monitoring.', NULL, NULL, 'Flatbed', '["BOL","POD"]', '$70/hr after 2h', 603, 'drv-brown', '[]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', NULL),
('LD-4852', '{"name":"Wichita, KS","lat":37.6872,"lng":-97.3301}', '{"name":"Denver, CO","lat":39.7392,"lng":-104.9903}', 'Wichita -> Denver', 'Retail fixtures', 40100, 2980, 525, '{"start":"2026-04-19T21:00:00Z","end":"2026-04-20T00:00:00Z"}', '{"start":"2026-04-20T13:00:00Z","end":"2026-04-20T15:00:00Z"}', 'Prairie Fixtures', 'Front Range Retail', 'cust-front-range', 'open', 'medium', 'Mountain route review is required.', NULL, NULL, 'Dry Van 53', '["BOL","POD"]', '$75/hr after 2h', 975, 'drv-davis', '[]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', 'fac-denver'),
('LD-4853', '{"name":"Kansas City, MO","lat":39.0997,"lng":-94.5786}', '{"name":"Omaha, NE","lat":41.2565,"lng":-95.9345}', 'Kansas City -> Omaha', 'Household goods', 30700, 1490, 186, '{"start":"2026-04-19T17:30:00Z","end":"2026-04-19T19:30:00Z"}', '{"start":"2026-04-20T00:30:00Z","end":"2026-04-20T02:00:00Z"}', 'Heartland Distribution', 'Heartland Wholesale', 'cust-heartland', 'open', 'low', 'Regional filler load.', NULL, NULL, 'Dry Van 53', '["BOL","POD"]', '$65/hr after 2h', 551, 'drv-nguyen', '[]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', NULL),
('LD-4854', '{"name":"St. Louis, MO","lat":38.6270,"lng":-90.1994}', '{"name":"Memphis, TN","lat":35.1495,"lng":-90.0490}', 'St. Louis -> Memphis', 'Retail', 39800, 1930, 284, '{"start":"2026-04-19T23:00:00Z","end":"2026-04-20T01:00:00Z"}', '{"start":"2026-04-20T08:00:00Z","end":"2026-04-20T10:00:00Z"}', 'River South Retail', 'Memphis South Retail', 'cust-river-south', 'planned', 'medium', 'Downstream depends on Nguyen clearing current delay.', NULL, NULL, 'Dry Van 53', '["BOL","POD"]', '$75/hr after 2h', 646, 'drv-nguyen', '[]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', 'fac-memphis'),
('LD-4855', '{"name":"Houston, TX","lat":29.7604,"lng":-95.3698}', '{"name":"New Orleans, LA","lat":29.9511,"lng":-90.0715}', 'Houston -> New Orleans', 'Produce', 40120, 2480, 348, '{"start":"2026-04-19T19:00:00Z","end":"2026-04-19T21:30:00Z"}', '{"start":"2026-04-20T06:00:00Z","end":"2026-04-20T09:00:00Z"}', 'Gulf Fresh', 'South Gulf Intermodal', 'cust-gulf-fresh', 'open', 'high', 'Reed is attractive, but tomorrow reefer demand should be protected.', NULL, NULL, 'Reefer 53', '["BOL","POD","Temp trace"]', '$85/hr after 2h', 812, 'drv-reed', '["LD-4860"]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', NULL),
('LD-4856', '{"name":"Dallas, TX","lat":32.7767,"lng":-96.7970}', '{"name":"Phoenix, AZ","lat":33.4484,"lng":-112.0740}', 'Dallas -> Phoenix', 'Electronics', 41500, 4720, 1062, '{"start":"2026-04-20T01:00:00Z","end":"2026-04-20T03:00:00Z"}', '{"start":"2026-04-21T01:00:00Z","end":"2026-04-21T04:00:00Z"}', 'Lone Star Tech', 'Phoenix Tech Distribution', 'cust-desert-tech', 'open', 'medium', 'Long-haul economics are solid, but tomorrow availability matters.', NULL, NULL, 'Dry Van 53', '["BOL","POD"]', '$80/hr after 2h', 1491, 'drv-jackson', '[]', '{"sourceUrl":"https://azdot.gov/sites/default/files/media/2022/07/OversizeandOverweightEnvelopeandSpecialPermitRulesEffective07082022.pdf","reviewStatus":"seeded-demo"}', 'fac-phoenix'),
('LD-4857', '{"name":"San Antonio, TX","lat":29.4241,"lng":-98.4936}', '{"name":"El Paso, TX","lat":31.7619,"lng":-106.4850}', 'San Antonio -> El Paso', 'Dry goods', 41200, 3110, 551, '{"start":"2026-04-20T11:00:00Z","end":"2026-04-20T13:00:00Z"}', '{"start":"2026-04-21T00:00:00Z","end":"2026-04-21T03:00:00Z"}', 'Border Freight', 'West Texas Consolidation', 'cust-border', 'open', 'medium', 'Good fit for Jackson if Dallas urgent work stays protected.', NULL, NULL, 'Dry Van 53', '["BOL","POD"]', '$75/hr after 2h', 990, 'drv-jackson', '[]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', NULL),
('LD-4858', '{"name":"Omaha, NE","lat":41.2565,"lng":-95.9345}', '{"name":"Kansas City, MO","lat":39.0997,"lng":-94.5786}', 'Omaha -> Kansas City', 'Retail', 32200, 1430, 186, '{"start":"2026-04-20T14:00:00Z","end":"2026-04-20T16:00:00Z"}', '{"start":"2026-04-20T20:00:00Z","end":"2026-04-20T22:00:00Z"}', 'Heartland Wholesale', 'Heartland Distribution', 'cust-heartland', 'open', 'low', 'Regional filler with strong equipment utilization.', NULL, NULL, 'Dry Van 53', '["BOL","POD"]', '$65/hr after 2h', 520, 'drv-davis', '[]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', NULL),
('LD-4859', '{"name":"Dallas, TX","lat":32.7767,"lng":-96.7970}', '{"name":"Shreveport, LA","lat":32.5252,"lng":-93.7502}', 'Dallas -> Shreveport', 'General freight', 36300, 1545, 189, '{"start":"2026-04-19T22:00:00Z","end":"2026-04-20T00:00:00Z"}', '{"start":"2026-04-20T06:00:00Z","end":"2026-04-20T08:00:00Z"}', 'Eastline Goods', 'Shreveport Crossdock', 'cust-lone-star', 'open', 'medium', 'Second-choice Dallas lane if #4812 slips.', NULL, NULL, 'Dry Van 53', '["BOL","POD"]', '$70/hr after 2h', 556, 'drv-patel', '[]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', NULL),
('LD-4860', '{"name":"Fort Worth, TX","lat":32.7555,"lng":-97.3308}', '{"name":"Houston, TX","lat":29.7604,"lng":-95.3698}', 'Fort Worth -> Houston', 'Reefer grocery', 39990, 2420, 271, '{"start":"2026-04-19T20:30:00Z","end":"2026-04-19T22:30:00Z"}', '{"start":"2026-04-20T05:00:00Z","end":"2026-04-20T06:30:00Z"}', 'Metro Cold Chain', 'Houston South DC', 'cust-metro-cold', 'open', 'high', 'Tomorrow-stranding tradeoff should be surfaced if Reed takes this.', NULL, NULL, 'Reefer 53', '["BOL","POD","Temp trace"]', '$85/hr after 2h', 864, 'drv-reed', '["LD-4855"]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', 'fac-houston'),
('LD-4861', '{"name":"Dallas, TX","lat":32.7767,"lng":-96.7970}', '{"name":"Austin, TX","lat":30.2672,"lng":-97.7431}', 'Dallas -> Austin', 'Dry grocery', 41000, 2140, 196, '{"start":"2026-04-19T08:00:00Z","end":"2026-04-19T10:00:00Z"}', '{"start":"2026-04-19T18:00:00Z","end":"2026-04-19T20:00:00Z"}', 'Lone Star Grocery', 'Austin Fresh DC', 'cust-lone-star', 'detained', 'critical', 'Detention exceeds four hours.', 'drv-johnson', 'veh-18', 'Dry Van 53', '["BOL","POD","Detention backup"]', '$85/hr after 2h', 530, 'drv-johnson', '[]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', NULL),
('LD-4862', '{"name":"Fort Worth, TX","lat":32.7555,"lng":-97.3308}', '{"name":"Dallas, TX","lat":32.7767,"lng":-96.7970}', 'Fort Worth -> Dallas', 'Dry grocery', 38900, 1580, 44, '{"start":"2026-04-19T13:00:00Z","end":"2026-04-19T14:30:00Z"}', '{"start":"2026-04-19T19:00:00Z","end":"2026-04-19T21:00:00Z"}', 'DFW Retail Crossdock', 'Dallas Local Sort', 'cust-lone-star', 'detained', 'high', 'Detention invoice draft threshold reached.', 'drv-patel', 'veh-05', 'Dry Van 53', '["BOL","POD","Detention backup"]', '$75/hr after 2h', 300, 'drv-patel', '[]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', NULL),
('LD-4863', '{"name":"Memphis, TN","lat":35.1495,"lng":-90.0490}', '{"name":"Jackson, MS","lat":32.2988,"lng":-90.1848}', 'Memphis -> Jackson', 'Paper products', 40500, 1740, 210, '{"start":"2026-04-19T12:30:00Z","end":"2026-04-19T14:00:00Z"}', '{"start":"2026-04-19T22:00:00Z","end":"2026-04-20T00:00:00Z"}', 'Memphis South DC', 'Jackson Retail', 'cust-river-south', 'detained', 'medium', 'Detention is nearing invoice threshold.', 'drv-chen', 'veh-12', 'Dry Van 53', '["BOL","POD"]', '$70/hr after 2h', 422, 'drv-chen', '[]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', NULL),
('LD-4864', '{"name":"Houston, TX","lat":29.7604,"lng":-95.3698}', '{"name":"Baton Rouge, LA","lat":30.4515,"lng":-91.1871}', 'Houston -> Baton Rouge', 'Produce', 39500, 2050, 269, '{"start":"2026-04-19T16:00:00Z","end":"2026-04-19T18:00:00Z"}', '{"start":"2026-04-20T01:00:00Z","end":"2026-04-20T03:00:00Z"}', 'Gulf Fresh', 'Baton Rouge Cold', 'cust-gulf-fresh', 'planned', 'medium', 'Potential relay if Ramirez can not complete safely.', NULL, NULL, 'Reefer 53', '["BOL","POD","Temp trace"]', '$85/hr after 2h', 650, 'drv-okafor', '[]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', NULL),
('LD-4865', '{"name":"Denver, CO","lat":39.7392,"lng":-104.9903}', '{"name":"Cheyenne, WY","lat":41.1400,"lng":-104.8202}', 'Denver -> Cheyenne', 'Auto parts', 36100, 1390, 104, '{"start":"2026-04-19T15:00:00Z","end":"2026-04-19T17:00:00Z"}', '{"start":"2026-04-19T21:00:00Z","end":"2026-04-19T23:00:00Z"}', 'Front Range Parts', 'Wyoming Auto', 'cust-front-range', 'open', 'medium', 'Colorado route legality review should be visible.', NULL, NULL, 'Dry Van 53', '["BOL","POD"]', '$70/hr after 2h', 430, 'drv-davis', '[]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', NULL),
('LD-4866', '{"name":"Dallas, TX","lat":32.7767,"lng":-96.7970}', '{"name":"Oklahoma City, OK","lat":35.4676,"lng":-97.5164}', 'Dallas -> Oklahoma City', 'Home goods', 38700, 1760, 206, '{"start":"2026-04-19T19:30:00Z","end":"2026-04-19T21:00:00Z"}', '{"start":"2026-04-20T02:00:00Z","end":"2026-04-20T04:00:00Z"}', 'North Texas Home', 'OKC Regional', 'cust-heartland', 'open', 'medium', 'Can consume a Dallas asset needed tomorrow.', NULL, NULL, 'Dry Van 53', '["BOL","POD"]', '$65/hr after 2h', 590, 'drv-okafor', '["LD-4867"]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', NULL),
('LD-4867', '{"name":"Dallas, TX","lat":32.7767,"lng":-96.7970}', '{"name":"Lubbock, TX","lat":33.5779,"lng":-101.8552}', 'Dallas -> Lubbock', 'Retail grocery', 40200, 2280, 345, '{"start":"2026-04-20T12:00:00Z","end":"2026-04-20T14:00:00Z"}', '{"start":"2026-04-20T22:00:00Z","end":"2026-04-21T00:30:00Z"}', 'Lone Star Retail', 'West Plains Grocery', 'cust-lone-star', 'planned', 'high', 'Higher-value tomorrow load used for stranded-risk scenario.', NULL, NULL, 'Dry Van 53', '["BOL","POD"]', '$75/hr after 2h', 830, 'drv-reed', '[]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', NULL),
('LD-4868', '{"name":"Kansas City, MO","lat":39.0997,"lng":-94.5786}', '{"name":"Des Moines, IA","lat":41.5868,"lng":-93.6250}', 'Kansas City -> Des Moines', 'Consumer goods', 37600, 1875, 196, '{"start":"2026-04-19T19:00:00Z","end":"2026-04-19T20:30:00Z"}', '{"start":"2026-04-20T01:00:00Z","end":"2026-04-20T03:00:00Z"}', 'Heartland Distribution', 'Midwest Commerce', 'cust-heartland', 'open', 'low', 'Filler lane for utilization.', NULL, NULL, 'Dry Van 53', '["BOL","POD"]', '$65/hr after 2h', 602, 'drv-davis', '[]', '{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}', NULL);

INSERT INTO trips (
  id, load_id, driver_id, vehicle_id, status, origin_city, destination_city,
  live_eta, route_health, fuel_status, parking_stop_plan, detention_state,
  alert_count, last_mile_plan, downstream_impact, customer_sla_risk, latest_hos_hours
) VALUES
('TR-003', 'LD-4850', 'drv-nguyen', 'veh-03', 'active', 'St. Louis, MO', 'Memphis, TN', NOW() + INTERVAL '4 hour 10 minute', 'delayed', 'nominal', '["Hayti Pilot","Memphis outer staging"]', 'none', 3, '{"facility":"fac-memphis","confidence":0.86}', 'May compress next River South load', 'high', 7.8),
('TR-008', 'LD-4849', 'drv-williams', 'veh-21', 'active', 'Phoenix, AZ', 'Tucson, AZ', NOW() + INTERVAL '2 hour 5 minute', 'watch', 'nominal', '["Casa Grande truck stop"]', 'none', 2, '{"facility":"fac-phoenix","confidence":0.89}', 'Billing blocked until docs complete', 'medium', 5.2),
('TR-011', 'LD-4853', 'drv-davis', 'veh-11', 'active', 'Kansas City, MO', 'Omaha, NE', NOW() + INTERVAL '3 hour 20 minute', 'healthy', 'nominal', '["St. Joseph TA"]', 'none', 1, '{"confidence":0.7}', 'Low', 'low', 8.9),
('TR-012', 'LD-4863', 'drv-chen', 'veh-12', 'active', 'Memphis, TN', 'Jackson, MS', NOW() + INTERVAL '4 hour 50 minute', 'attention', 'nominal', '["Batesville reserve lot"]', 'watch', 4, '{"confidence":0.64}', 'Compliance issue can roll into tomorrow planning', 'medium', 8.3),
('TR-014', 'LD-4864', 'drv-ramirez', 'veh-14', 'active', 'Houston, TX', 'Baton Rouge, LA', NOW() + INTERVAL '5 hour 40 minute', 'critical', 'critical', '["Beaumont Love''s","Lafayette reserve lot"]', 'none', 5, '{"confidence":0.52}', 'Relay may be required to save reefer SLA', 'critical', 1.47),
('TR-021', 'LD-4861', 'drv-johnson', 'veh-18', 'active', 'Dallas, TX', 'Austin, TX', NOW() + INTERVAL '6 hour 15 minute', 'detained', 'nominal', '["Temple reserve lot"]', '4h-plus', 4, '{"confidence":0.68}', 'Tomorrow board compression risk', 'high', 6.5),
('TR-022', 'LD-4862', 'drv-patel', 'veh-05', 'active', 'Fort Worth, TX', 'Dallas, TX', NOW() + INTERVAL '3 hour 0 minute', 'detained', 'nominal', '["None"]', '2h-plus', 2, '{"confidence":0.72}', 'Minimal', 'medium', 8.6),
('TR-023', 'LD-4855', 'drv-reed', 'veh-16', 'planned', 'Houston, TX', 'New Orleans, LA', NOW() + INTERVAL '11 hour', 'watch', 'nominal', '["Lake Charles TA"]', 'none', 1, '{"confidence":0.75}', 'Can hurt Dallas reefer surge tomorrow', 'medium', 8.1),
('TR-024', 'LD-4856', 'drv-jackson', 'veh-17', 'planned', 'Dallas, TX', 'Phoenix, AZ', NOW() + INTERVAL '1 day 4 hour', 'watch', 'nominal', '["Midland fuel stop","Tucson reserve lot"]', 'none', 2, '{"facility":"fac-phoenix","confidence":0.89}', 'Long-haul asset lock', 'medium', 8.4),
('TR-025', 'LD-4865', 'drv-martinez', 'veh-08', 'exception', 'Denver, CO', 'Cheyenne, WY', NOW() + INTERVAL '7 hour', 'breakdown', 'nominal', '[]', 'none', 6, '{"confidence":0.3}', 'Immediate repair and rescue required', 'high', 5.2);

INSERT INTO trip_stops (id, trip_id, sequence_number, stop_type, facility_name, city, state, planned_arrival, actual_arrival, planned_departure, actual_departure, detention_minutes, required_documents) VALUES
('stop-001', 'TR-014', 1, 'pickup', 'Houston Produce Yard', 'Houston', 'TX', NOW() - INTERVAL '2 hour', NOW() - INTERVAL '1 hour 50 minute', NOW() - INTERVAL '1 hour', NULL, 0, '["BOL","Temp trace"]'),
('stop-002', 'TR-014', 2, 'fuel', 'Pilot Beaumont', 'Beaumont', 'TX', NOW() + INTERVAL '45 minute', NULL, NOW() + INTERVAL '1 hour 10 minute', NULL, 0, '[]'),
('stop-003', 'TR-021', 1, 'pickup', 'Lone Star Grocery', 'Dallas', 'TX', NOW() - INTERVAL '5 hour', NOW() - INTERVAL '4 hour 22 minute', NULL, NULL, 262, '["BOL","Detention backup"]'),
('stop-004', 'TR-022', 1, 'pickup', 'DFW Retail Crossdock', 'Fort Worth', 'TX', NOW() - INTERVAL '3 hour', NOW() - INTERVAL '2 hour 26 minute', NULL, NULL, 146, '["BOL","Detention backup"]'),
('stop-005', 'TR-012', 1, 'pickup', 'Memphis South DC', 'Memphis', 'TN', NOW() - INTERVAL '2 hour', NOW() - INTERVAL '1 hour 28 minute', NULL, NULL, 88, '["BOL"]');

INSERT INTO trip_events (id, trip_id, event_type, severity, title, details, happened_at, payload) VALUES
('evt-001', 'TR-014', 'fuel', 'critical', 'Fuel dropped below 20%', 'Ramirez must stop at a partner location before Lafayette.', NOW() - INTERVAL '20 minute', '{"fuelPercent":17}'),
('evt-002', 'TR-014', 'hos', 'critical', 'HOS critical window', 'Only 1h 28m drive time remains.', NOW() - INTERVAL '18 minute', '{"driveHoursRemaining":1.47}'),
('evt-003', 'TR-003', 'weather', 'high', 'Severe weather and traffic delay', 'Nguyen is running behind with customer SLA risk.', NOW() - INTERVAL '35 minute', '{"routeDelayMinutes":54}'),
('evt-004', 'TR-012', 'compliance', 'high', 'ELD sync gap detected', 'Manual entry verification required.', NOW() - INTERVAL '50 minute', '{"errorCode":"ELD-SYNC-401"}'),
('evt-005', 'TR-025', 'breakdown', 'critical', 'Breakdown confirmed', 'P2459 fault likely requires aftertreatment repair.', NOW() - INTERVAL '2 hour', '{"errorCode":"P2459"}');

INSERT INTO route_plans (id, load_id, trip_id, selected_option_label, recommended_option_label, legality_status, source_registry, last_checked_at, recommended_reasoning) VALUES
('rp-4812', 'LD-4812', NULL, NULL, 'Recommended', 'cleared', '[{"sourceUrl":"https://www.fmcsa.dot.gov/regulations/federal-register-documents/2025-22192","effectiveDate":"2025-11-18","reviewStatus":"seeded-demo"}]', NOW(), 'Balanced ETA, partner fuel savings, and Houston last-mile confidence make this the best operational choice.'),
('rp-4855', 'LD-4855', 'TR-023', NULL, 'Recommended', 'cleared', '[{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}]', NOW(), 'Protect reefer service and tomorrow board while preserving delivery confidence.'),
('rp-4856', 'LD-4856', 'TR-024', NULL, 'Recommended', 'review', '[{"sourceUrl":"https://azdot.gov/sites/default/files/media/2022/07/OversizeandOverweightEnvelopeandSpecialPermitRulesEffective07082022.pdf","reviewStatus":"seeded-demo"}]', NOW(), 'Recommended path balances legality review, fuel plan, and Arizona arrival confidence.'),
('rp-4864', 'LD-4864', 'TR-014', NULL, 'Recommended', 'watch', '[{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}]', NOW(), 'Relay option should stay ready because HOS and fuel risk are converging.'),
('rp-4865', 'LD-4865', 'TR-025', NULL, 'Cheapest', 'blocked', '[{"sourceUrl":"https://www.fmcsa.dot.gov/","reviewStatus":"seeded-demo"}]', NOW(), 'Breakdown blocks release until repair path is chosen.');

INSERT INTO route_options (
  id, route_plan_id, label, miles, eta_minutes, fuel_cost, toll_cost, fuel_partner_savings,
  hos_stop_plan, leftover_hos_hours, parking_confidence, parking_predicted_occupancy,
  permitted_route_compliance, state_restriction_warnings, weather_closure_risk,
  detention_sensitivity, downstream_impact, last_mile_confidence, route_legality_source,
  deterministic_score, ai_explanation, structured_factors
) VALUES
('ro-4812-cheap', 'rp-4812', 'Cheapest', 246, 302, 133, 6, 18, '["Pilot Ennis"]', 6.0, 0.79, 0.74, 'permitted', '[]', 'low', 'low', 'Low downstream risk', 0.86, '{"sourceUrl":"https://www.fmcsa.dot.gov/regulations/federal-register-documents/2025-22192"}', 87, 'Lowest blended cost if pickup stays on time.', '{"eta":84,"fuel":92,"parking":79}'),
('ro-4812-fast', 'rp-4812', 'Fastest', 239, 286, 140, 12, 14, '["Houston reserve lot"]', 5.8, 0.74, 0.78, 'permitted', '[]', 'medium', 'medium', 'Low downstream risk', 0.89, '{"sourceUrl":"https://www.fmcsa.dot.gov/regulations/federal-register-documents/2025-22192"}', 88, 'Fastest arrival but with slightly weaker fuel economics.', '{"eta":92,"fuel":81,"parking":74}'),
('ro-4812-short', 'rp-4812', 'Shortest', 236, 296, 137, 8, 16, '["Pilot Ennis"]', 5.9, 0.76, 0.76, 'permitted', '[]', 'low', 'medium', 'Low downstream risk', 0.85, '{"sourceUrl":"https://www.fmcsa.dot.gov/regulations/federal-register-documents/2025-22192"}', 86, 'Shortest mileage with a small congestion tradeoff.', '{"eta":87,"fuel":85,"parking":76}'),
('ro-4812-rec', 'rp-4812', 'Recommended', 241, 290, 136, 7, 19, '["Pilot Ennis","Houston south staging"]', 6.2, 0.83, 0.72, 'permitted', '[]', 'low', 'low', 'Best blend for urgent assignment', 0.92, '{"sourceUrl":"https://www.fmcsa.dot.gov/regulations/federal-register-documents/2025-22192"}', 94, 'Deterministic best blend of ETA, legality confidence, fuel savings, and last-mile confidence.', '{"eta":90,"fuel":89,"parking":83,"lastMile":92}'),
('ro-4855-cheap', 'rp-4855', 'Cheapest', 355, 389, 219, 14, 17, '["Lake Charles TA"]', 3.9, 0.69, 0.81, 'permitted', '[]', 'medium', 'medium', 'Could strand Dallas reefer tomorrow', 0.77, '{"sourceUrl":"https://www.fmcsa.dot.gov/"}', 83, 'Cost-friendly but still threatens tomorrow reefer board.', '{"downstream":52}'),
('ro-4855-fast', 'rp-4855', 'Fastest', 348, 365, 224, 21, 10, '["Lafayette reserve lot"]', 3.6, 0.66, 0.84, 'permitted', '[]', 'medium', 'high', 'Could strand Dallas reefer tomorrow', 0.8, '{"sourceUrl":"https://www.fmcsa.dot.gov/"}', 82, 'Fast but weaker on fuel and tomorrow-board protection.', '{"eta":91,"fuel":72}'),
('ro-4855-short', 'rp-4855', 'Shortest', 345, 379, 220, 18, 13, '["Lake Charles TA"]', 3.4, 0.67, 0.82, 'permitted', '[]', 'medium', 'medium', 'Could strand Dallas reefer tomorrow', 0.78, '{"sourceUrl":"https://www.fmcsa.dot.gov/"}', 81, 'Shortest geometry but not the best operational blend.', '{"eta":86,"parking":67}'),
('ro-4855-rec', 'rp-4855', 'Recommended', 350, 371, 221, 16, 16, '["Lake Charles TA","New Orleans staging"]', 4.2, 0.73, 0.79, 'permitted', '[]', 'medium', 'medium', 'Protects more optionality', 0.84, '{"sourceUrl":"https://www.fmcsa.dot.gov/"}', 89, 'Recommended path preserves reefer service and keeps better buffer if tomorrow priorities shift.', '{"eta":89,"fuel":84,"downstream":70}'),
('ro-4856-cheap', 'rp-4856', 'Cheapest', 1081, 1169, 619, 41, 33, '["Midland partner fuel","Tucson reserve lot"]', 0.8, 0.58, 0.91, 'review-required', '["Arizona Table 4 review required"]', 'medium', 'medium', 'Long-haul asset lock', 0.86, '{"sourceUrl":"https://azdot.gov/sites/default/files/media/2022/07/OversizeandOverweightEnvelopeandSpecialPermitRulesEffective07082022.pdf"}', 72, 'Cheapest option remains gated until Arizona review is complete.', '{"legality":52}'),
('ro-4856-fast', 'rp-4856', 'Fastest', 1062, 1112, 637, 56, 19, '["Midland fuel","Tucson reserve lot"]', 0.3, 0.53, 0.89, 'review-required', '["Arizona Table 4 review required"]', 'medium', 'high', 'Long-haul asset lock', 0.84, '{"sourceUrl":"https://azdot.gov/sites/default/files/media/2022/07/OversizeandOverweightEnvelopeandSpecialPermitRulesEffective07082022.pdf"}', 71, 'Fastest option has the weakest leftover HOS margin.', '{"eta":94,"hos":31}'),
('ro-4856-short', 'rp-4856', 'Shortest', 1054, 1141, 625, 48, 26, '["Midland fuel","Tucson reserve lot"]', 0.2, 0.55, 0.90, 'review-required', '["Arizona Table 4 review required"]', 'medium', 'high', 'Long-haul asset lock', 0.82, '{"sourceUrl":"https://azdot.gov/sites/default/files/media/2022/07/OversizeandOverweightEnvelopeandSpecialPermitRulesEffective07082022.pdf"}', 70, 'Shortest mileage does not materially improve feasibility.', '{"fuel":76,"hos":29}'),
('ro-4856-rec', 'rp-4856', 'Recommended', 1068, 1119, 626, 43, 31, '["Midland partner fuel","Tucson reserve lot","Phoenix lot C"]', 1.0, 0.61, 0.87, 'review-required', '["Arizona Table 4 review required"]', 'medium', 'medium', 'Long-haul asset lock', 0.89, '{"sourceUrl":"https://azdot.gov/sites/default/files/media/2022/07/OversizeandOverweightEnvelopeandSpecialPermitRulesEffective07082022.pdf"}', 80, 'Recommended once legality review clears because it balances cost, HOS viability, and last-mile confidence.', '{"legality":60,"hos":42,"lastMile":89}'),
('ro-4864-cheap', 'rp-4864', 'Cheapest', 276, 336, 171, 5, 11, '["Beaumont partner fuel"]', 0.9, 0.62, 0.78, 'permitted', '[]', 'medium', 'high', 'Relay still likely', 0.63, '{"sourceUrl":"https://www.fmcsa.dot.gov/"}', 68, 'Current Ramirez constraints make the cheap path fragile.', '{"hos":24,"fuel":41}'),
('ro-4864-fast', 'rp-4864', 'Fastest', 269, 309, 176, 11, 8, '["Lafayette reserve lot"]', 0.4, 0.56, 0.82, 'permitted', '[]', 'high', 'high', 'Relay very likely', 0.62, '{"sourceUrl":"https://www.fmcsa.dot.gov/"}', 65, 'Fastest if nothing slips, but it is highly sensitive to HOS and fuel risk.', '{"eta":91,"hos":18}'),
('ro-4864-short', 'rp-4864', 'Shortest', 267, 322, 173, 8, 9, '["Beaumont fuel"]', 0.5, 0.6, 0.8, 'permitted', '[]', 'medium', 'high', 'Relay likely', 0.61, '{"sourceUrl":"https://www.fmcsa.dot.gov/"}', 66, 'Shortest route still leaves little resilience for Ramirez.', '{"fuel":47,"hos":20}'),
('ro-4864-rec', 'rp-4864', 'Recommended', 271, 315, 174, 7, 14, '["Beaumont partner fuel","Lafayette reserve lot"]', 1.3, 0.67, 0.77, 'permitted', '[]', 'medium', 'medium', 'Okafor relay stays available', 0.71, '{"sourceUrl":"https://www.fmcsa.dot.gov/"}', 77, 'Recommended path keeps a fuel stop, preserves relay optionality, and reduces detention sensitivity.', '{"fuel":61,"hos":38,"relay":84}');

INSERT INTO driver_readiness_scores (
  id, driver_id, load_id, route_option_id, score, deadhead_component, hos_component, total_trip_component,
  equipment_component, maintenance_component, tomorrow_impact_component, stranded_risk_component,
  fuel_component, parking_component, ai_explanation, factor_payload
) VALUES
('drs-4812-patel', 'drv-patel', 'LD-4812', 'ro-4812-rec', 96, 19, 19, 9, 10, 9, 10, 10, 5, 5, 'Patel is the cleanest urgent assignment: short deadhead, strong HOS, correct equipment, and no tomorrow-board damage.', '{"deadheadMiles":14,"hosHours":11.2,"equipmentFit":"perfect"}'),
('drs-4812-okafor', 'drv-okafor', 'LD-4812', 'ro-4812-rec', 89, 16, 18, 9, 10, 10, 8, 8, 5, 5, 'Okafor is a strong backup if Patel is consumed elsewhere.', '{"deadheadMiles":29,"hosHours":8.9,"equipmentFit":"perfect"}'),
('drs-4864-ramirez', 'drv-ramirez', 'LD-4864', 'ro-4864-rec', 58, 18, 4, 8, 10, 7, 3, 3, 2, 3, 'Ramirez can technically continue but the risk is too high without intervention.', '{"fuelPercent":17,"driveHours":1.47}'),
('drs-4864-okafor', 'drv-okafor', 'LD-4864', 'ro-4864-rec', 87, 14, 17, 8, 8, 10, 10, 10, 5, 5, 'Okafor is the best relay path if Ramirez must hand off.', '{"relayCandidate":true}'),
('drs-4860-reed', 'drv-reed', 'LD-4860', NULL, 84, 18, 17, 8, 10, 9, 4, 4, 5, 5, 'Reed can cover the load, but the tomorrow reefer surge cost is real.', '{"tomorrowImpact":"high"}'),
('drs-4860-johnson', 'drv-johnson', 'LD-4860', NULL, 72, 12, 16, 7, 3, 8, 8, 7, 5, 6, 'Johnson can rescue if equipment is paired, but not the first-choice match.', '{"equipmentFit":"partial"}');

INSERT INTO hos_snapshots (id, driver_id, trip_id, captured_at, drive_remaining_hours, shift_remaining_hours, cycle_remaining_hours, break_due_in_minutes, source, violation_risk)
SELECT
  'hos-' || LPAD(gs::text, 3, '0'),
  CASE
    WHEN gs <= 5 THEN 'drv-ramirez'
    WHEN gs <= 10 THEN 'drv-nguyen'
    WHEN gs <= 15 THEN 'drv-chen'
    WHEN gs <= 20 THEN 'drv-patel'
    WHEN gs <= 25 THEN 'drv-reed'
    ELSE 'drv-davis'
  END,
  CASE
    WHEN gs <= 5 THEN 'TR-014'
    WHEN gs <= 10 THEN 'TR-003'
    WHEN gs <= 15 THEN 'TR-012'
    WHEN gs <= 20 THEN 'TR-022'
    WHEN gs <= 25 THEN 'TR-023'
    ELSE 'TR-011'
  END,
  NOW() - ((gs * 18) || ' minute')::interval,
  CASE
    WHEN gs <= 5 THEN 1.2 + (gs * 0.05)
    WHEN gs <= 10 THEN 6.4 + (gs * 0.04)
    WHEN gs <= 15 THEN 5.0 + (gs * 0.05)
    WHEN gs <= 20 THEN 8.0 + (gs * 0.03)
    WHEN gs <= 25 THEN 7.0 + (gs * 0.03)
    ELSE 8.4 + (gs * 0.02)
  END,
  8.0 + (gs * 0.1),
  42 - gs,
  90 + gs,
  'eld',
  CASE WHEN gs <= 5 THEN 'high' WHEN gs <= 15 THEN 'medium' ELSE 'low' END
FROM generate_series(1, 30) AS gs;

INSERT INTO eld_events (id, driver_id, vehicle_id, trip_id, provider, error_code, severity, title, details, estimated_repair_minutes, created_at) VALUES
('eld-001', 'drv-chen', 'veh-12', 'TR-012', 'KeepTruckin', 'ELD-SYNC-401', 'high', 'ELD sync gap', 'Manual log verification required before next scale exposure.', 45, NOW() - INTERVAL '50 minute'),
('eld-002', 'drv-martinez', 'veh-08', 'TR-025', 'Samsara', 'P2459', 'critical', 'Aftertreatment fault mapped', 'Likely parked repair event with shop routing required.', 210, NOW() - INTERVAL '2 hour'),
('eld-003', 'drv-ramirez', 'veh-14', 'TR-014', 'Motive', 'LOW-FUEL-WARN', 'high', 'Critical fuel telemetry', 'Fuel partner stop should be dispatched immediately.', 0, NOW() - INTERVAL '20 minute');

INSERT INTO maintenance_events (id, vehicle_id, driver_id, event_type, severity, title, details, due_at, resolved_at) VALUES
('mnt-001', 'veh-25', 'drv-brown', 'service', 'medium', 'Flatbed PM service due', 'Brown cannot release until PM window is complete.', NOW() + INTERVAL '2 hour', NULL),
('mnt-002', 'veh-08', 'drv-martinez', 'repair', 'critical', 'Aftertreatment repair required', 'P2459 indicates likely DPF / aftertreatment service.', NOW() + INTERVAL '1 hour', NULL),
('mnt-003', 'veh-14', 'drv-ramirez', 'inspection', 'medium', 'Reefer inspection due tomorrow', 'Watch if trip slips into next shift.', NOW() + INTERVAL '20 hour', NULL);

INSERT INTO repair_shops (id, name, city, state, lat, lng, capabilities, phone, avg_turnaround_hours) VALUES
('shop-01', 'Rocky Mountain Fleet Repair', 'Denver', 'CO', 39.7400, -104.9800, '["aftertreatment","tow","reefer"]', '303-555-3001', 3.5),
('shop-02', 'I-70 Truck Service', 'Aurora', 'CO', 39.7294, -104.8319, '["engine","electrical"]', '303-555-3002', 4.0),
('shop-03', 'Mile High Diesel', 'Commerce City', 'CO', 39.8083, -104.9339, '["aftertreatment","diagnostics"]', '303-555-3003', 3.8),
('shop-04', 'Front Range Reefer Repair', 'Denver', 'CO', 39.7500, -104.9900, '["reefer","electrical"]', '303-555-3004', 5.0),
('shop-05', 'Bayou Fleet Service', 'Baton Rouge', 'LA', 30.4515, -91.1871, '["reefer","tires"]', '225-555-3005', 4.4);

INSERT INTO repair_shops (id, name, city, state, lat, lng, capabilities, phone, avg_turnaround_hours)
SELECT
  'shop-' || LPAD((gs + 5)::text, 2, '0'),
  'Fleet Repair #' || (gs + 5),
  CASE WHEN gs % 3 = 0 THEN 'Dallas' WHEN gs % 3 = 1 THEN 'Kansas City' ELSE 'Houston' END,
  CASE WHEN gs % 3 = 0 THEN 'TX' WHEN gs % 3 = 1 THEN 'MO' ELSE 'TX' END,
  29.0 + gs,
  -95.0 - gs,
  CASE WHEN gs % 4 = 0 THEN '["aftertreatment","tow"]'::jsonb ELSE '["engine","tires","diagnostics"]'::jsonb END,
  '800-555-' || LPAD((3005 + gs)::text, 4, '0'),
  3.0 + (gs * 0.2)
FROM generate_series(1, 20) AS gs;

INSERT INTO repair_estimates (id, vehicle_id, driver_id, repair_shop_id, issue_code, estimated_minutes, confidence, recommendation) VALUES
('rep-001', 'veh-08', 'drv-martinez', 'shop-01', 'P2459', 210, 0.88, 'Nearest high-confidence aftertreatment repair option.'),
('rep-002', 'veh-08', 'drv-martinez', 'shop-03', 'P2459', 235, 0.81, 'Backup Denver-area option with diagnostics capacity.'),
('rep-003', 'veh-08', 'drv-martinez', 'shop-02', 'P2459', 260, 0.74, 'Longer queue but still viable if towing starts immediately.');

INSERT INTO driver_incidents (id, driver_id, incident_type, severity, happened_at, details, csa_impact) VALUES
('inc-001', 'drv-chen', 'inspection', 'medium', NOW() - INTERVAL '40 day', 'Roadside inspection with logbook counseling.', 3),
('inc-002', 'drv-williams', 'document', 'low', NOW() - INTERVAL '15 day', 'Late POD upload caused billing review.', 1),
('inc-003', 'drv-martinez', 'breakdown', 'high', NOW() - INTERVAL '2 hour', 'Current breakdown event.', 5);

INSERT INTO safety_scores (id, driver_id, vehicle_id, score_date, csa_score, inspection_score, maintenance_score, violation_count, explanation) VALUES
('safe-001', 'drv-patel', 'veh-05', CURRENT_DATE, 91, 94, 92, 0, 'Healthy across safety and maintenance.'),
('safe-002', 'drv-ramirez', 'veh-14', CURRENT_DATE, 84, 83, 73, 1, 'Fuel/HOS risk is operational, not a structural safety failure.'),
('safe-003', 'drv-chen', 'veh-12', CURRENT_DATE, 79, 80, 78, 1, 'ELD sync issue needs follow-up.'),
('safe-004', 'drv-martinez', 'veh-08', CURRENT_DATE, 74, 71, 42, 2, 'Breakdown materially drags safety readiness.');

INSERT INTO compliance_events (id, driver_id, vehicle_id, event_type, severity, title, details, effective_date, status, source_url) VALUES
('comp-001', 'drv-chen', 'veh-12', 'eld', 'high', 'ELD sync issue pending verification', 'Call driver and confirm manual entry for missing period.', CURRENT_DATE, 'open', 'https://www.fmcsa.dot.gov/'),
('comp-002', 'drv-martinez', 'veh-08', 'inspection', 'high', 'Vehicle unavailable pending repair', 'Breakdown flow requires shop selection and reassignment.', CURRENT_DATE, 'open', 'https://www.fmcsa.dot.gov/'),
('comp-003', 'drv-brown', 'veh-25', 'maintenance', 'medium', 'Maintenance window active', 'Flatbed capacity is reduced until PM clears.', CURRENT_DATE, 'open', 'https://www.fmcsa.dot.gov/');

INSERT INTO law_change_alerts (id, state_code, title, operational_impact, effective_date, publish_date, source_url, restriction_type, affected_geometry, review_status, last_checked_date) VALUES
('law-001', 'US', 'FMCSA ELD technical standards update watch', 'Review route plans and manual-entry exceptions before long-haul releases.', DATE '2025-11-18', DATE '2025-10-17', 'https://www.fmcsa.dot.gov/regulations/federal-register-documents/2025-22192', 'eld', '{"corridor":"national"}', 'seeded-demo', CURRENT_DATE),
('law-002', 'AZ', 'Arizona permit rule review required on restricted moves', 'Arizona-bound route recommendations must preserve permit review metadata.', DATE '2022-07-08', DATE '2022-07-08', 'https://azdot.gov/sites/default/files/media/2022/07/OversizeandOverweightEnvelopeandSpecialPermitRulesEffective07082022.pdf', 'permitted-route', '{"corridor":"AZ table 4"}', 'seeded-demo', CURRENT_DATE),
('law-003', 'CO', 'Colorado mountain corridor permit review', 'Denver corridor long-hauls should surface legality review before dispatch.', DATE '2026-04-25', DATE '2026-04-12', 'https://www.fmcsa.dot.gov/', 'mountain-route', '{"corridor":"I-70"}', 'seeded-demo', CURRENT_DATE),
('law-004', 'TX', 'Texas metro oversize review reminder', 'Dallas/Fort Worth releases should show exact source metadata on restricted routes.', DATE '2026-05-01', DATE '2026-04-10', 'https://www.fmcsa.dot.gov/', 'metro-review', '{"corridor":"DFW"}', 'seeded-demo', CURRENT_DATE);

INSERT INTO road_condition_alerts (id, state_code, title, operational_impact, severity, source_url, affected_geometry, effective_date, last_checked_date) VALUES
('road-001', 'MO', 'St. Louis weather corridor delay', 'Nguyen trip ETA is slipping and customer notice should be drafted.', 'high', 'https://www.fmcsa.dot.gov/', '{"corridor":"I-55 south"}', CURRENT_DATE, CURRENT_DATE),
('road-002', 'LA', 'Louisiana rain band near Lafayette', 'Reefer move should preserve extra buffer on fuel and HOS.', 'medium', 'https://www.fmcsa.dot.gov/', '{"corridor":"I-10"}', CURRENT_DATE, CURRENT_DATE),
('road-003', 'CO', 'Denver freight corridor slowdown', 'Breakdown recovery options should avoid stacked city delays.', 'medium', 'https://www.fmcsa.dot.gov/', '{"corridor":"I-70 / I-25"}', CURRENT_DATE, CURRENT_DATE),
('road-004', 'TX', 'DFW metro congestion watch', 'Urgent assignment windows in Dallas are compressing.', 'high', 'https://www.fmcsa.dot.gov/', '{"corridor":"Dallas core"}', CURRENT_DATE, CURRENT_DATE);

INSERT INTO market_alerts (id, market, title, operational_impact, severity, effective_date, source_url, metadata) VALUES
('market-001', 'Dallas Reefer', 'Dallas outbound reefer surge', 'Protect reefer equipment for tomorrow high-margin board.', 'high', CURRENT_DATE, 'https://www.fmcsa.dot.gov/', '{"equipment":"Reefer 53"}'),
('market-002', 'Houston Retail', 'Houston retail inbound softening', 'Margin pressure on non-priority Houston inbound moves.', 'medium', CURRENT_DATE, 'https://www.fmcsa.dot.gov/', '{"lane":"Houston inbound"}'),
('market-003', 'Memphis Regional', 'Memphis regional demand stable', 'Useful filler lanes remain available.', 'low', CURRENT_DATE, 'https://www.fmcsa.dot.gov/', '{"lane":"Memphis regional"}'),
('market-004', 'Denver Mountain', 'Denver mountain corridor premiums rising', 'Strong upside if route legality clears cleanly.', 'medium', CURRENT_DATE, 'https://www.fmcsa.dot.gov/', '{"lane":"Denver westbound"}');

INSERT INTO dispatcher_tasks (
  id, category, severity, title, why_it_matters, effort_minutes, confidence, primary_cta,
  primary_action, related_entities, operational_reasons, status, snoozed_until, dismissed_at
) VALUES
('task-001', 'urgent', 'urgent', 'Assign Patel to load #4812', 'Best-match driver is already in Dallas and the pickup window is tightening.', 2, 0.96, 'Assign Patel', 'assign', '[{"type":"driver","id":"drv-patel"},{"type":"load","id":"LD-4812"}]', '["14 mi deadhead","11.2h HOS remaining","No tomorrow stranding"]', 'open', NULL, NULL),
('task-002', 'urgent', 'urgent', 'Send fuel-stop coordinates to Ramirez', 'Fuel and HOS risk are converging on an active reefer trip.', 1, 0.91, 'Send stop', 'message', '[{"type":"driver","id":"drv-ramirez"},{"type":"trip","id":"TR-014"}]', '["17% fuel","1h28m drive left","Partner discount available"]', 'open', NULL, NULL),
('task-003', 'alerts', 'high', 'Review Nguyen delay customer draft', 'The trip is behind plan and the customer SLA is at risk.', 4, 0.87, 'Open draft', 'draft-message', '[{"type":"trip","id":"TR-003"},{"type":"load","id":"LD-4850"}]', '["54 min weather delay","Tight unload window"]', 'open', NULL, NULL),
('task-004', 'alerts', 'high', 'Call Chen for manual ELD verification', 'Compliance exposure is growing with every mile.', 6, 0.82, 'Call driver', 'open-driver', '[{"type":"driver","id":"drv-chen"}]', '["ELD-SYNC-401","Missing log segment"]', 'open', NULL, NULL),
('task-005', 'alerts', 'high', 'Unblock Williams billing packet', 'Invoice cannot auto-reconcile until POD and BOL are attached.', 5, 0.84, 'Review docs', 'open-docs', '[{"type":"driver","id":"drv-williams"},{"type":"load","id":"LD-4849"}]', '["Missing BOL","Missing POD"]', 'open', NULL, NULL),
('task-006', 'urgent', 'critical', 'Open Martinez repair plan', 'Breakdown is blocking a live trip and rescue options are ready.', 3, 0.9, 'Open repair plan', 'repair', '[{"type":"driver","id":"drv-martinez"},{"type":"trip","id":"TR-025"}]', '["P2459 fault","Nearest shop 14 mi"]', 'open', NULL, NULL),
('task-007', 'ai', 'medium', 'Consider Okafor as relay for Ramirez', 'Relay may save reefer service and customer SLA.', 3, 0.79, 'Compare relay', 'relay', '[{"type":"driver","id":"drv-okafor"},{"type":"trip","id":"TR-014"}]', '["Strong readiness score","Keeps reefer moving"]', 'open', NULL, NULL),
('task-008', 'ai', 'medium', 'Protect Reed for tomorrow reefer surge', 'Using Reed now can leave tomorrow’s Dallas reefer board exposed.', 3, 0.76, 'View downstream impact', 'downstream', '[{"type":"driver","id":"drv-reed"},{"type":"load","id":"LD-4860"},{"type":"load","id":"LD-4855"}]', '["Tomorrow surge alert","Downstream dependency exists"]', 'open', NULL, NULL),
('task-009', 'urgent', 'critical', 'Approve detention escalation for LD-4861', 'The event is above four hours and an invoice draft already exists.', 4, 0.93, 'Review escalation', 'detention', '[{"type":"load","id":"LD-4861"},{"type":"trip","id":"TR-021"}]', '["262 minutes detained","Invoice draft ready","Tomorrow impact visible"]', 'open', NULL, NULL),
('task-010', 'alerts', 'medium', 'Review law-change impact on Arizona routes', 'A seeded law/reg alert is attached to Phoenix-bound planning.', 5, 0.71, 'Open route review', 'route-review', '[{"type":"load","id":"LD-4856"}]', '["Official source stored","Effective date visible"]', 'open', NULL, NULL);

INSERT INTO ai_recommendations (id, recommendation_type, entity_type, entity_id, title, explanation, confidence, structured_factors, created_at) VALUES
('ai-001', 'driver-ranking', 'load', 'LD-4812', 'Patel is the cleanest urgent match', 'Patel leads because deadhead is minimal, HOS is healthy, equipment is exact, and there is no tomorrow-board penalty.', 0.96, '{"deadhead":14,"hosHours":11.2,"equipment":"Dry Van 53"}', NOW()),
('ai-002', 'trip-summary', 'trip', 'TR-014', 'Ramirez trip needs intervention', 'Fuel and HOS risks are stacked; dispatch should send a partner stop now and keep relay options available.', 0.91, '{"fuelPercent":17,"hosDrive":1.47}', NOW()),
('ai-003', 'customer-draft', 'trip', 'TR-003', 'Customer notice draft ready', 'Delay cause is weather/traffic and the draft message preserves trust while offering an updated ETA.', 0.87, '{"delayMinutes":54}', NOW()),
('ai-004', 'driver-profile', 'driver', 'drv-chen', 'Chen profile summary', 'High performer overall, but current ELD sync issue needs direct follow-up before confidence returns to normal.', 0.82, '{"csa":79,"maintenance":78}', NOW()),
('ai-005', 'detention-alternative', 'load', 'LD-4861', 'Excessive detention alternatives', 'Relay, partial reschedule, customer notice, and tomorrow-load reorder are all viable paths once dock release timing is clearer.', 0.88, '{"minutes":262}', NOW());

INSERT INTO driver_notifications (id, driver_id, notification_type, severity, title, message, status, created_at) VALUES
('dn-001', 'drv-ramirez', 'fuel-stop', 'high', 'Proceed to Beaumont partner fuel stop', 'Stop now to preserve reefer service and HOS compliance.', 'draft', NOW()),
('dn-002', 'drv-chen', 'eld-follow-up', 'high', 'Call dispatch to verify missing ELD segment', 'Compliance review requires manual confirmation.', 'draft', NOW()),
('dn-003', 'drv-williams', 'document-upload', 'high', 'Upload BOL and POD', 'Billing is blocked until delivery paperwork is attached.', 'draft', NOW());

INSERT INTO dispatcher_notifications (id, notification_type, severity, title, message, related_entities, status, created_at) VALUES
('not-001', 'assignment', 'critical', 'Load #4812 remains unassigned', 'Patel is the highest-confidence match and the pickup window is closing.', '[{"type":"load","id":"LD-4812"},{"type":"driver","id":"drv-patel"}]', 'new', NOW()),
('not-002', 'detention', 'critical', 'Detention exceeds 4 hours', 'Escalate LD-4861 and review AI alternatives.', '[{"type":"load","id":"LD-4861"}]', 'new', NOW()),
('not-003', 'breakdown', 'critical', 'Martinez repair ETA available', 'Open ranked repair plan and rescue options.', '[{"type":"driver","id":"drv-martinez"}]', 'new', NOW()),
('not-004', 'market', 'high', 'Dallas reefer surge', 'Protect reefer capacity for tomorrow.', '[{"type":"load","id":"LD-4860"},{"type":"driver","id":"drv-reed"}]', 'new', NOW());

INSERT INTO document_requirements (id, load_id, stop_type, document_type, required, billing_blocker) VALUES
('docreq-001', 'LD-4849', 'delivery', 'BOL', true, true),
('docreq-002', 'LD-4849', 'delivery', 'POD', true, true),
('docreq-003', 'LD-4855', 'pickup', 'Temp trace', true, false),
('docreq-004', 'LD-4861', 'detention', 'Detention backup', true, true),
('docreq-005', 'LD-4812', 'dispatch', 'Rate confirmation', true, true);

INSERT INTO load_documents (id, load_id, trip_id, driver_id, document_type, status, file_url, extracted_fields, missing_fields, uploaded_at, ai_explanation) VALUES
('ldoc-001', 'LD-4849', 'TR-008', 'drv-williams', 'BOL', 'missing', NULL, '{}', '["signedBy"]', NULL, 'Billing is blocked until a signed BOL is uploaded.'),
('ldoc-002', 'LD-4849', 'TR-008', 'drv-williams', 'POD', 'missing', NULL, '{}', '["receiverName","timestamp"]', NULL, 'POD is required for invoice release.'),
('ldoc-003', 'LD-4812', NULL, NULL, 'Rate confirmation', 'missing', NULL, '{}', '["rateSheet"]', NULL, 'Dispatch packet should include the current rate confirmation before release.'),
('ldoc-004', 'LD-4855', 'TR-023', 'drv-reed', 'Temp trace', 'uploaded', '/demo/docs/temp-trace-4855.pdf', '{"temp":"34F"}', '[]', NOW() - INTERVAL '30 minute', 'Temp trace is present and usable.'),
('ldoc-005', 'LD-4861', 'TR-021', 'drv-johnson', 'Detention backup', 'uploaded', '/demo/docs/detention-4861.pdf', '{"dockCheckIn":"08:02"}', '[]', NOW() - INTERVAL '15 minute', 'Detention backup supports invoice draft.'),
('ldoc-006', 'LD-4850', 'TR-003', 'drv-nguyen', 'BOL', 'uploaded', '/demo/docs/bol-4850.pdf', '{"loadNumber":"LD-4850"}', '[]', NOW() - INTERVAL '2 hour', 'No issues detected.'),
('ldoc-007', 'LD-4850', 'TR-003', 'drv-nguyen', 'POD', 'pending', NULL, '{}', '["signature"]', NULL, 'POD will be required at destination.'),
('ldoc-008', 'LD-4862', 'TR-022', 'drv-patel', 'Detention backup', 'uploaded', '/demo/docs/detention-4862.pdf', '{"dockCheckIn":"10:11"}', '[]', NOW() - INTERVAL '10 minute', 'Invoice threshold reached and supporting document exists.'),
('ldoc-009', 'LD-4863', 'TR-012', 'drv-chen', 'BOL', 'uploaded', '/demo/docs/bol-4863.pdf', '{"loadNumber":"LD-4863"}', '[]', NOW() - INTERVAL '2 hour', 'No issues detected.'),
('ldoc-010', 'LD-4856', 'TR-024', 'drv-jackson', 'BOL', 'pending', NULL, '{}', '["dispatcherRelease"]', NULL, 'Awaiting dispatch release packet.'),
('ldoc-011', 'LD-4856', 'TR-024', 'drv-jackson', 'POD', 'pending', NULL, '{}', '["signature"]', NULL, 'Destination document placeholder only.'),
('ldoc-012', 'LD-4853', 'TR-011', 'drv-davis', 'BOL', 'uploaded', '/demo/docs/bol-4853.pdf', '{"loadNumber":"LD-4853"}', '[]', NOW() - INTERVAL '1 hour', 'Clean document.'),
('ldoc-013', 'LD-4853', 'TR-011', 'drv-davis', 'POD', 'pending', NULL, '{}', '["signature"]', NULL, 'Pending delivery.'),
('ldoc-014', 'LD-4855', 'TR-023', 'drv-reed', 'BOL', 'uploaded', '/demo/docs/bol-4855.pdf', '{"loadNumber":"LD-4855"}', '[]', NOW() - INTERVAL '1 hour', 'No issues detected.'),
('ldoc-015', 'LD-4855', 'TR-023', 'drv-reed', 'POD', 'pending', NULL, '{}', '["signature"]', NULL, 'Pending delivery.');

INSERT INTO invoice_drafts (id, load_id, customer_id, draft_type, status, amount, explanation, created_at) VALUES
('inv-001', 'LD-4861', 'cust-lone-star', 'detention', 'draft', 371.17, '2+ hour detention auto-draft created from shared clock.', NOW() - INTERVAL '12 minute'),
('inv-002', 'LD-4862', 'cust-lone-star', 'detention', 'draft', 182.50, '2+ hour detention threshold crossed.', NOW() - INTERVAL '9 minute'),
('inv-003', 'LD-4849', 'cust-ark-steel', 'linehaul', 'blocked', 2410.00, 'Missing BOL/POD prevents automatic release.', NOW() - INTERVAL '1 hour'),
('inv-004', 'LD-4850', 'cust-river-south', 'linehaul', 'review', 2110.00, 'Customer notice drafted because of delay.', NOW() - INTERVAL '20 minute');

INSERT INTO invoice_reconciliation (id, load_id, invoice_draft_id, reconciliation_status, match_confidence, missing_fields, blockers, ai_explanation, updated_at) VALUES
('recon-001', 'LD-4849', 'inv-003', 'blocked', 0.41, '["BOL","POD"]', '["Missing signed delivery packet"]', 'Invoice cannot release until Williams uploads the missing documents.', NOW()),
('recon-002', 'LD-4861', 'inv-001', 'review', 0.86, '[]', '[]', 'Detention invoice draft aligns with the shared detention clock and uploaded backup.', NOW()),
('recon-003', 'LD-4862', 'inv-002', 'review', 0.82, '[]', '[]', 'Draft is ready for dispatcher review.', NOW()),
('recon-004', 'LD-4850', 'inv-004', 'review', 0.74, '["updated ETA note"]', '[]', 'Billing can proceed once the final POD and updated ETA note are attached.', NOW()),
('recon-005', 'LD-4812', NULL, 'review', 0.61, '["rate confirmation"]', '["Dispatch packet incomplete"]', 'Commercial terms exist, but rate confirmation should be attached before dispatch release.', NOW()),
('recon-006', 'LD-4855', NULL, 'healthy', 0.91, '[]', '[]', 'Current packet quality is good.', NOW()),
('recon-007', 'LD-4853', NULL, 'healthy', 0.88, '[]', '[]', 'Regional filler load documents are clean so far.', NOW()),
('recon-008', 'LD-4856', NULL, 'review', 0.68, '["dispatch release"]', '["Arizona legality review pending"]', 'Long-haul release should wait for route review and dispatch release packet.', NOW()),
('recon-009', 'LD-4863', NULL, 'review', 0.73, '["final POD"]', '[]', 'Trip is in detention watch but documents are mostly healthy.', NOW()),
('recon-010', 'LD-4851', NULL, 'review', 0.69, '["assignment"]', '["Driver still unresolved"]', 'Billing cannot progress until the load is assigned.', NOW()),
('recon-011', 'LD-4852', NULL, 'review', 0.72, '["route review"]', '["Colorado permit review pending"]', 'Mountain corridor review should complete before release.', NOW()),
('recon-012', 'LD-4854', NULL, 'review', 0.78, '["final POD"]', '[]', 'Downstream is manageable if Nguyen closes cleanly.', NOW()),
('recon-013', 'LD-4858', NULL, 'healthy', 0.89, '[]', '[]', 'No current blockers.', NOW()),
('recon-014', 'LD-4865', NULL, 'blocked', 0.44, '["repair completion"]', '["Vehicle unavailable"]', 'Breakdown blocks billing until route recovery is chosen.', NOW()),
('recon-015', 'LD-4867', NULL, 'review', 0.75, '["assignment","dispatch packet"]', '[]', 'Tomorrow priority load is waiting on dispatcher choice.', NOW());

INSERT INTO detention_events (id, load_id, trip_id, location, facility_name, delay_minutes, started_at, cost_per_hour, shared_clock_state, margin_impact, tomorrow_load_impact) VALUES
('det-001', 'LD-4861', 'TR-021', 'Dock 4', 'Lone Star Grocery', 262, NOW() - INTERVAL '4 hour 22 minute', 85, '4h 22m at dock', -388, 'Pushes one Dallas reefer opportunity to overflow board'),
('det-002', 'LD-4862', 'TR-022', 'Dock 2', 'DFW Retail Crossdock', 146, NOW() - INTERVAL '2 hour 26 minute', 75, '2h 26m at dock', -146, 'Minimal'),
('det-003', 'LD-4863', 'TR-012', 'Dock 7', 'Memphis South DC', 88, NOW() - INTERVAL '1 hour 28 minute', 70, '1h 28m at dock', -74, 'Low'),
('det-004', 'LD-4850', 'TR-003', 'Unload yard', 'Memphis South Retail', 34, NOW() - INTERVAL '34 minute', 75, '34m', -21, 'Customer ETA notice already needed'),
('det-005', 'LD-4855', 'TR-023', 'Cold dock', 'South Gulf Intermodal', 0, NOW(), 85, '0m', 0, 'None'),
('det-006', 'LD-4849', 'TR-008', 'Delivery bay', 'Desert Fabrication', 22, NOW() - INTERVAL '22 minute', 70, '22m', -12, 'Billing follow-up only'),
('det-007', 'LD-4856', 'TR-024', 'Staging', 'Phoenix Tech Distribution', 0, NOW(), 80, '0m', 0, 'None'),
('det-008', 'LD-4864', 'TR-014', 'Pickup queue', 'Houston Produce Yard', 12, NOW() - INTERVAL '12 minute', 85, '12m', -9, 'Relay watch');

INSERT INTO detention_invoice_drafts (id, detention_event_id, invoice_draft_id, status, amount, created_at) VALUES
('detinv-001', 'det-001', 'inv-001', 'draft', 371.17, NOW() - INTERVAL '12 minute'),
('detinv-002', 'det-002', 'inv-002', 'draft', 182.50, NOW() - INTERVAL '9 minute');

INSERT INTO customer_notifications (id, customer_id, load_id, notification_type, draft_message, status, created_at) VALUES
('custnote-001', 'cust-river-south', 'LD-4850', 'delay', 'Thu Nguyen is experiencing a weather and traffic delay. Updated ETA is 10:40 PM local and we will continue to monitor route conditions.', 'draft', NOW() - INTERVAL '15 minute'),
('custnote-002', 'cust-lone-star', 'LD-4861', 'detention', 'Your load is currently detained beyond four hours. We are preparing detention documentation and alternative recovery options.', 'draft', NOW() - INTERVAL '10 minute');

INSERT INTO facility_entry_points (id, facility_name, destination_city, recommended_entrance, parking_area, avoid_notes, last_mile_confidence, reasoning) VALUES
('fac-houston', 'Houston South DC', 'Houston, TX', 'Use the east-side truck gate off Supply Row', 'Stage in the striped south lot before backing', '["Do not use the office entrance on Harbor Way","Cars block the north apron at shift change"]', 0.92, 'Truck entrance lanes and trailer staging markings are visible on the east approach.'),
('fac-dallas', 'Dallas Crossdock 9', 'Dallas, TX', 'Enter via Gate B on Industrial Ave', 'Overflow staging on the west fence line', '["Avoid Gate A during noon vendor traffic"]', 0.88, 'Gate B aligns with the marked truck queue and widest turning radius.'),
('fac-memphis', 'Memphis South Retail', 'Memphis, TN', 'Use the south truck apron on Shelby Industrial', 'Hold on the painted dock-call line', '["Avoid the customer office circle"]', 0.86, 'Truck lane paint and dock-call signage align with the south apron.'),
('fac-phoenix', 'Phoenix Tech Distribution', 'Phoenix, AZ', 'Enter from the 51st Ave freight gate', 'Stage in lot C until dock assignment arrives', '["Avoid visitor gate - height bar present"]', 0.89, 'Freight gate geometry and lot C trailer markings support the truck move.'),
('fac-denver', 'Front Range Grocery', 'Denver, CO', 'Take the truck-only ramp from Warehouse Loop', 'Cold-chain staging pad 2', '["Avoid south retail lot entrance"]', 0.84, 'Trailer staging pads and reefer hookups are visible on the warehouse-loop side.');

INSERT INTO facility_entry_images (id, facility_entry_point_id, image_url, image_type, provider, annotation) VALUES
('fimg-001', 'fac-houston', '/facilities/houston-terminal.svg', 'reference', 'demo', '{"annotated":true}'),
('fimg-002', 'fac-dallas', '/facilities/dallas-crossdock.svg', 'reference', 'demo', '{"annotated":true}'),
('fimg-003', 'fac-memphis', '/facilities/memphis-retail.svg', 'reference', 'demo', '{"annotated":true}'),
('fimg-004', 'fac-phoenix', '/facilities/phoenix-tech.svg', 'reference', 'demo', '{"annotated":true}'),
('fimg-005', 'fac-denver', '/facilities/denver-grocery.svg', 'reference', 'demo', '{"annotated":true}');

INSERT INTO fuel_partner_locations (id, partner_name, city, state, lat, lng, diesel_discount_per_gallon, amenities) VALUES
('fuel-001', 'Pilot', 'Ennis', 'TX', 32.3293, -96.6253, 0.18, '["fuel","showers","parking"]'),
('fuel-002', 'TA', 'Beaumont', 'TX', 30.0860, -94.1018, 0.24, '["fuel","parking","service"]'),
('fuel-003', 'Love''s', 'Lake Charles', 'LA', 30.2266, -93.2174, 0.19, '["fuel","parking","food"]'),
('fuel-004', 'Pilot', 'Midland', 'TX', 31.9974, -102.0779, 0.21, '["fuel","parking"]'),
('fuel-005', 'TA', 'Lafayette', 'LA', 30.2241, -92.0198, 0.17, '["fuel","parking","service"]');

INSERT INTO fuel_price_snapshots (id, fuel_partner_location_id, captured_at, retail_price, net_price, source) VALUES
('fps-001', 'fuel-001', NOW() - INTERVAL '30 minute', 4.159, 3.979, 'seeded-demo'),
('fps-002', 'fuel-002', NOW() - INTERVAL '25 minute', 4.219, 3.979, 'seeded-demo'),
('fps-003', 'fuel-003', NOW() - INTERVAL '20 minute', 4.179, 3.989, 'seeded-demo'),
('fps-004', 'fuel-004', NOW() - INTERVAL '15 minute', 4.089, 3.879, 'seeded-demo'),
('fps-005', 'fuel-005', NOW() - INTERVAL '10 minute', 4.199, 4.029, 'seeded-demo');

INSERT INTO downstream_load_links (id, source_load_id, downstream_load_id, impact_type, explanation) VALUES
('down-001', 'LD-4860', 'LD-4855', 'asset-protection', 'Assigning Reed too early can expose tomorrow reefer demand.'),
('down-002', 'LD-4866', 'LD-4867', 'stranded-risk', 'Using the wrong Dallas dry-van asset can leave the higher-priority tomorrow load uncovered.'),
('down-003', 'LD-4855', 'LD-4860', 'reefer-capacity', 'These two reefer loads compete for the same scarce equipment pool.');

INSERT INTO assignment_audit_log (id, load_id, trip_id, driver_id, vehicle_id, action_type, details, created_at) VALUES
('audit-001', 'LD-4849', 'TR-008', 'drv-williams', 'veh-21', 'assignment-created', '{"source":"demo-seed"}', NOW() - INTERVAL '6 hour'),
('audit-002', 'LD-4850', 'TR-003', 'drv-nguyen', 'veh-03', 'reroute-drafted', '{"reason":"weather-delay"}', NOW() - INTERVAL '30 minute'),
('audit-003', 'LD-4861', 'TR-021', 'drv-johnson', 'veh-18', 'detention-escalated', '{"invoiceDraft":"inv-001"}', NOW() - INTERVAL '12 minute');

INSERT INTO parking_stops (id, name, lat, lng, city, state, type, total_spaces, occupancy_percent, predicted_occupancy, parking_confidence, reservable, amenities, miles_from_origin) VALUES
('pk-001', 'Pilot Ennis', 32.3293, -96.6253, 'Ennis', 'TX', 'truck_stop', 120, 58, 72, 0.84, true, '["fuel","showers","food","wifi"]', 34),
('pk-002', 'TA Beaumont', 30.0860, -94.1018, 'Beaumont', 'TX', 'truck_stop', 140, 74, 86, 0.78, true, '["fuel","service","parking"]', 86),
('pk-003', 'Love''s Lake Charles', 30.2266, -93.2174, 'Lake Charles', 'LA', 'truck_stop', 108, 69, 81, 0.8, true, '["fuel","showers","food"]', 138),
('pk-004', 'Midland Partner Fuel', 31.9974, -102.0779, 'Midland', 'TX', 'partner_fuel', 62, 46, 58, 0.87, true, '["fuel","parking"]', 318),
('pk-005', 'Memphis Outer Staging', 35.1030, -89.9070, 'Memphis', 'TN', 'staging', 36, 61, 73, 0.76, false, '["staging","security"]', 4);

INSERT INTO parking_stops (id, name, lat, lng, city, state, type, total_spaces, occupancy_percent, predicted_occupancy, parking_confidence, reservable, amenities, miles_from_origin)
SELECT
  'pk-' || LPAD((gs + 5)::text, 3, '0'),
  'Operations Parking #' || (gs + 5),
  29.5 + (gs * 0.35),
  -95.2 - (gs * 0.22),
  CASE WHEN gs % 4 = 0 THEN 'Dallas' WHEN gs % 4 = 1 THEN 'Houston' WHEN gs % 4 = 2 THEN 'Kansas City' ELSE 'Memphis' END,
  CASE WHEN gs % 4 = 0 THEN 'TX' WHEN gs % 4 = 1 THEN 'TX' WHEN gs % 4 = 2 THEN 'MO' ELSE 'TN' END,
  CASE WHEN gs % 3 = 0 THEN 'staging' ELSE 'truck_stop' END,
  45 + (gs * 4),
  40 + gs,
  50 + gs,
  0.62 + (gs * 0.01),
  gs % 2 = 0,
  CASE WHEN gs % 2 = 0 THEN '["fuel","parking"]'::jsonb ELSE '["parking","showers"]'::jsonb END,
  25 + (gs * 16)
FROM generate_series(1, 15) AS gs;

INSERT INTO copilot_alerts (id, type, severity, title, message, load_id, driver_id, "timestamp", action_label, dismissed) VALUES
('alert-001', 'assignment', 'critical', 'Load #4812 remains unassigned', 'Patel is the strongest match and the pickup window is closing.', 'LD-4812', 'drv-patel', NOW(), 'Assign now', false),
('alert-002', 'fuel', 'critical', 'Ramirez fuel and HOS critical', 'Send Beaumont partner stop or prepare relay.', 'LD-4864', 'drv-ramirez', NOW(), 'Send stop', false),
('alert-003', 'delay', 'high', 'Nguyen delay threatens SLA', 'Weather and traffic are compressing the delivery window.', 'LD-4850', 'drv-nguyen', NOW(), 'Draft notice', false),
('alert-004', 'compliance', 'high', 'Chen ELD sync issue', 'Manual verification is needed before the next compliance touchpoint.', 'LD-4863', 'drv-chen', NOW(), 'Open driver', false),
('alert-005', 'breakdown', 'critical', 'Martinez repair ETA 3.5h', 'Nearby repair shops have already been ranked.', 'LD-4865', 'drv-martinez', NOW(), 'Open repair plan', false);

BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE loads;
ALTER PUBLICATION supabase_realtime ADD TABLE trips;
ALTER PUBLICATION supabase_realtime ADD TABLE dispatcher_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE dispatcher_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE detention_events;
ALTER PUBLICATION supabase_realtime ADD TABLE copilot_alerts;
