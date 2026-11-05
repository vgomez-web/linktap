-- LinkTap Business: registro de perfiles EXISTENTES de Clinica Monteverde.
-- Ejecutar una sola vez en linktap-business-db. No modifica HTML ni URLs publicadas.
INSERT OR IGNORE INTO lb_companies (id, name)
VALUES ('monteverde', 'Clínica Dental Monteverde');

INSERT OR IGNORE INTO lb_profiles (id, company_id, slug, full_name, job_title, public_url, active) VALUES
('mv-alexis', 'monteverde', 'monteverde-alexis', 'Alexis Cariman', 'Ejecutivo de ventas', 'https://linktap.cl/monteverde/alexis/', 1),
('mv-stefano', 'monteverde', 'monteverde-stefano', 'Stefano Daniel Jijón Varas', 'Ejecutivo de ventas', 'https://linktap.cl/monteverde/stefano/', 1),
('mv-lissette', 'monteverde', 'monteverde-lissette', 'Lissette Mariangel', 'Ejecutiva de ventas', 'https://linktap.cl/monteverde/lissette/', 1),
('mv-recepcion', 'monteverde', 'monteverde-recepcion', 'Recepción Clínica Monteverde', 'Recepción y contacto', 'https://linktap.cl/monteverde/', 1);

SELECT id, full_name, job_title, public_url, active
FROM lb_profiles WHERE company_id = 'monteverde' ORDER BY full_name;
