-- Runs once when the Docker MySQL volume is first created.
CREATE DATABASE IF NOT EXISTS medisync_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON medisync_live.* TO 'medisync'@'%';
GRANT ALL PRIVILEGES ON medisync_test.* TO 'medisync'@'%';
FLUSH PRIVILEGES;
