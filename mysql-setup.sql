-- MySQL setup for clinic app
CREATE DATABASE clinic_db;
CREATE USER 'clinic_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON clinic_db.* TO 'clinic_user'@'localhost';
FLUSH PRIVILEGES;

USE clinic_db;

CREATE TABLE IF NOT EXISTS clinics (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  address VARCHAR(255) DEFAULT '',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS clinic_admins (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  clinic_id VARCHAR(64) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_clinic_admins_clinic
    FOREIGN KEY (clinic_id) REFERENCES clinics(id)
    ON DELETE CASCADE,
  UNIQUE KEY uniq_clinic_admin_email (clinic_id, email)
);

CREATE TABLE IF NOT EXISTS patients (
  id VARCHAR(64) PRIMARY KEY,
  clinic_id VARCHAR(64) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT '',
  whatsapp VARCHAR(50) DEFAULT '',
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active',
  total_sessions INT NOT NULL DEFAULT 0,
  last_visit DATE NULL,
  next_appointment DATE NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_patients_clinic
    FOREIGN KEY (clinic_id) REFERENCES clinics(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patient_attachments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  patient_id VARCHAR(64) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT NOT NULL,
  data_blob LONGBLOB NOT NULL,
  disk_path VARCHAR(1024) NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_patient_attachments_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON DELETE CASCADE
);
