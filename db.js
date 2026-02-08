const mysql = require("mysql2/promise");

let pool = null;

function getDbConfig() {
  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME
  };
}

function assertDbConfig(config) {
  const missing = [];
  if (!config.user) missing.push("DB_USER");
  if (!config.database) missing.push("DB_NAME");
  if (missing.length) {
    throw new Error(
      `MySQL config missing (${missing.join(
        ", "
      )}). Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in .env.`
    );
  }
}

async function ensureSchema(dbPool) {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS clinics (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      clinic_type VARCHAR(100) NOT NULL DEFAULT 'General',
      phone VARCHAR(50) DEFAULT '',
      email VARCHAR(255) DEFAULT '',
      address VARCHAR(255) DEFAULT '',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    )
  `);

  try {
    await dbPool.query("ALTER TABLE clinics ADD COLUMN clinic_type VARCHAR(100) NOT NULL DEFAULT 'General' AFTER name");
  } catch (err) {
    if (err?.code !== "ER_DUP_FIELDNAME") throw err;
  }

  await dbPool.query(`
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
    )
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS doctors (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      clinic_id VARCHAR(64) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      display_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      CONSTRAINT fk_doctors_clinic
        FOREIGN KEY (clinic_id) REFERENCES clinics(id)
        ON DELETE CASCADE
    )
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS patients (
      id VARCHAR(64) PRIMARY KEY,
      clinic_id VARCHAR(64) NOT NULL,
      doctor_id BIGINT NULL,
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
        ON DELETE CASCADE,
      CONSTRAINT fk_patients_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors(id)
        ON DELETE SET NULL
    )
  `);

  try {
    await dbPool.query("ALTER TABLE patients ADD COLUMN doctor_id BIGINT NULL AFTER clinic_id");
  } catch (err) {
    if (err?.code !== "ER_DUP_FIELDNAME") throw err;
  }
  try {
    await dbPool.query(
      "ALTER TABLE patients ADD CONSTRAINT fk_patients_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL"
    );
  } catch (err) {
    if (err?.code !== "ER_DUP_KEYNAME" && err?.errno !== 1826) throw err;
  }

  await dbPool.query(`
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
    )
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      clinic_id VARCHAR(64) NOT NULL,
      patient_id VARCHAR(64) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      payment_date DATE NOT NULL,
      method VARCHAR(50) NOT NULL DEFAULT 'cash',
      status VARCHAR(20) NOT NULL DEFAULT 'paid',
      reference VARCHAR(255) DEFAULT '',
      description TEXT,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      CONSTRAINT fk_payments_clinic
        FOREIGN KEY (clinic_id) REFERENCES clinics(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_payments_patient
        FOREIGN KEY (patient_id) REFERENCES patients(id)
        ON DELETE CASCADE
    )
  `);

  try {
    await dbPool.query("ALTER TABLE patients ADD COLUMN clinic_id VARCHAR(64) NULL");
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
}

async function getPool() {
  if (pool) return pool;
  const config = getDbConfig();
  assertDbConfig(config);

  pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true
  });

  await pool.query("SELECT 1");
  await ensureSchema(pool);
  return pool;
}

async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

module.exports = {
  getPool,
  closePool
};
