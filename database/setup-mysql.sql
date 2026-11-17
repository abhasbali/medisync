-- One-time manual MySQL setup for MediSync Live (run as root or another admin account).
--   mysql -u root -p < database/setup-mysql.sql
-- Tables and sample data are NOT created here: Flyway migrations create them when the backend starts.

CREATE DATABASE IF NOT EXISTS medisync_live CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS medisync_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'medisync'@'localhost' IDENTIFIED BY 'medisync';
CREATE USER IF NOT EXISTS 'medisync'@'%' IDENTIFIED BY 'medisync';

GRANT ALL PRIVILEGES ON medisync_live.* TO 'medisync'@'localhost';
GRANT ALL PRIVILEGES ON medisync_test.* TO 'medisync'@'localhost';
GRANT ALL PRIVILEGES ON medisync_live.* TO 'medisync'@'%';
GRANT ALL PRIVILEGES ON medisync_test.* TO 'medisync'@'%';
FLUSH PRIVILEGES;
