DROP TABLE IF EXISTS phase2_notification_templates;
DROP TABLE IF EXISTS institution_trial_events;
DROP TABLE IF EXISTS driver_sla_events;
DROP TABLE IF EXISTS institution_invoices;
DROP TABLE IF EXISTS member_tracking_tokens;
DROP TABLE IF EXISTS institution_trips;
DROP TABLE IF EXISTS institution_members;
DROP TABLE IF EXISTS institution_routes;
DROP TABLE IF EXISTS institution_admin_users;
DROP TABLE IF EXISTS institutions;
DROP TABLE IF EXISTS pass_route_interests;
DROP TABLE IF EXISTS pass_rides;
DROP TABLE IF EXISTS commuter_passes;
DROP TABLE IF EXISTS driver_subscription_preferences;
ALTER TABLE drivers DROP COLUMN IF EXISTS sla_score;
ALTER TABLE auth_users DROP CONSTRAINT IF EXISTS auth_users_role_check;
UPDATE auth_users SET role = 'admin' WHERE role = 'institution_admin';
ALTER TABLE auth_users
  ADD CONSTRAINT auth_users_role_check CHECK (role IN ('passenger', 'driver', 'admin'));
