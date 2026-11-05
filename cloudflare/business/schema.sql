-- LinkTap Business · esquema D1 aislado de las tablas actuales.
-- Ejecutar primero en D1 de pruebas. No elimina ni modifica tablas existentes.
CREATE TABLE IF NOT EXISTS lb_companies (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS lb_memberships (
 email TEXT NOT NULL COLLATE NOCASE,
 company_id TEXT NOT NULL REFERENCES lb_companies(id),
 role TEXT NOT NULL DEFAULT 'admin' CHECK(role='admin'),
 PRIMARY KEY(email, company_id)
);
CREATE TABLE IF NOT EXISTS lb_profiles (
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES lb_companies(id),
 slug TEXT NOT NULL UNIQUE,
 full_name TEXT NOT NULL,
 job_title TEXT NOT NULL DEFAULT '',
 public_url TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lb_profiles_company ON lb_profiles(company_id);
CREATE TABLE IF NOT EXISTS lb_events (
 id TEXT PRIMARY KEY,
 profile_id TEXT NOT NULL REFERENCES lb_profiles(id),
 kind TEXT NOT NULL CHECK(kind IN ('view','whatsapp','call','email','save_contact','other_link')),
 recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lb_events_profile_time ON lb_events(profile_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_lb_events_time ON lb_events(recorded_at);
CREATE TABLE IF NOT EXISTS lb_audit (
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES lb_companies(id),
 profile_id TEXT NOT NULL REFERENCES lb_profiles(id),
 actor_email TEXT NOT NULL,
 previous_active INTEGER NOT NULL,
 new_active INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lb_audit_company_time ON lb_audit(company_id, created_at DESC);
-- IMPORTANTE: insertar empresas/perfiles/miembros manualmente desde un entorno seguro,
-- después de verificar sus permisos y sus URL reales. No insertar datos ficticios en producción.
