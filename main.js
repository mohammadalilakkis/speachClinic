const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const https = require("https");
const { execFile } = require("child_process");
const bcrypt = require("bcryptjs");
const db = require("./db");

const fsp = fs.promises;

const DATA_DIR_NAME = "clinic-data";
const PATIENTS_DIR_NAME = "patients";
const CONFIG_FILE = "config.json";
const MESSAGE_LOG = "messages.log";

function loadEnvFile(envPath) {
  const p = envPath || path.join(__dirname, ".env");
  if (!fs.existsSync(p)) return;
  const contents = fs.readFileSync(p, "utf-8");
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadEnvFile();

function getDataDir() {
  return path.join(app.getPath("userData"), DATA_DIR_NAME);
}

function getPatientsDir() {
  return path.join(getDataDir(), PATIENTS_DIR_NAME);
}

function getPatientDir(id) {
  return path.join(getPatientsDir(), id);
}

function getProfilePath(id) {
  return path.join(getPatientDir(id), "profile.json");
}

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fsp.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function toSafeId(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function generateId(name) {
  const base = toSafeId(name) || "patient";
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${base}-${stamp}-${rand}`;
}

function normalizeDateInput(value) {
  return value ? value : null;
}

function normalizeDateOutput(value) {
  return value || "";
}

function mapPatientRow(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone || "",
    whatsapp: row.whatsapp || "",
    notes: row.notes || "",
    status: row.status || "active",
    totalSessions: Number(row.total_sessions || 0),
    lastVisit: normalizeDateOutput(row.last_visit),
    nextAppointment: normalizeDateOutput(row.next_appointment),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

let migrationChecked = false;

async function migrateJsonPatientsIfNeeded(clinicId) {
  if (!clinicId) return;
  if (migrationChecked) return;
  const config = await readConfig();
  if (config.migrationDone) {
    migrationChecked = true;
    return;
  }

  const pool = await db.getPool();
  const [countRows] = await pool.execute(
    "SELECT COUNT(*) AS count FROM patients"
  );
  const count = Number(countRows?.[0]?.count || 0);
  if (count > 0) {
    await writeConfig({ migrationDone: true });
    migrationChecked = true;
    return;
  }

  await ensureDir(getPatientsDir());
  const entries = await fsp.readdir(getPatientsDir(), { withFileTypes: true });
  let migrated = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const profile = await readJson(getProfilePath(entry.name), null);
    if (!profile || !profile.fullName || !profile.id) continue;

    const now = new Date();
    await pool.execute(
      `
        INSERT INTO patients (
          id,
          clinic_id,
          full_name,
          phone,
          whatsapp,
          notes,
          status,
          total_sessions,
          last_visit,
          next_appointment,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        profile.id,
        clinicId,
        profile.fullName,
        profile.phone || "",
        profile.whatsapp || "",
        profile.notes || "",
        profile.status || "active",
        Number(profile.totalSessions || 0),
        normalizeDateInput(profile.lastVisit),
        normalizeDateInput(profile.nextAppointment),
        profile.createdAt ? new Date(profile.createdAt) : now,
        profile.updatedAt ? new Date(profile.updatedAt) : now
      ]
    );
    migrated += 1;
  }

  if (migrated >= 0) {
    await writeConfig({ migrationDone: true });
  }
  migrationChecked = true;
}

async function listPatients() {
  const clinicId = await requireActiveClinicId();
  const config = await readConfig();
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/0b66ba84-1f65-45ec-99ab-fa5a1865714d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'auth-pre',hypothesisId:'H5',location:'main.js:190',message:'listPatients entry',data:{clinicIdSet:Boolean(clinicId),migrationDone:Boolean(config.migrationDone)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  await migrateJsonPatientsIfNeeded(clinicId);
  const pool = await db.getPool();
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        clinic_id,
        full_name,
        phone,
        whatsapp,
        notes,
        status,
        total_sessions,
        DATE_FORMAT(last_visit, '%Y-%m-%d') AS last_visit,
        DATE_FORMAT(next_appointment, '%Y-%m-%d') AS next_appointment,
        created_at,
        updated_at
      FROM patients
      WHERE clinic_id = ?
      ORDER BY full_name
    `,
    [clinicId]
  );
  return rows.map(mapPatientRow);
}

async function getPatient(id) {
  const clinicId = await requireActiveClinicId();
  await migrateJsonPatientsIfNeeded(clinicId);
  const pool = await db.getPool();
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        clinic_id,
        full_name,
        phone,
        whatsapp,
        notes,
        status,
        total_sessions,
        DATE_FORMAT(last_visit, '%Y-%m-%d') AS last_visit,
        DATE_FORMAT(next_appointment, '%Y-%m-%d') AS next_appointment,
        created_at,
        updated_at
      FROM patients
      WHERE id = ? AND clinic_id = ?
      LIMIT 1
    `,
    [id, clinicId]
  );
  if (!rows.length) return null;
  return mapPatientRow(rows[0]);
}

async function createPatient(payload) {
  const clinicId = await requireActiveClinicId();
  await migrateJsonPatientsIfNeeded(clinicId);
  const fullName = (payload.fullName || "").trim();
  if (!fullName) {
    throw new Error("Full name is required.");
  }

  const id = generateId(fullName);
  const now = new Date();
  const profile = {
    id,
    fullName,
    phone: payload.phone || "",
    whatsapp: payload.whatsapp || "",
    notes: payload.notes || "",
    status: payload.status || "active",
    totalSessions: Number(payload.totalSessions || 0),
    lastVisit: payload.lastVisit || "",
    nextAppointment: payload.nextAppointment || "",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  const pool = await db.getPool();
  await pool.execute(
    `
      INSERT INTO patients (
        id,
        clinic_id,
        full_name,
        phone,
        whatsapp,
        notes,
        status,
        total_sessions,
        last_visit,
        next_appointment,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      profile.id,
      clinicId,
      profile.fullName,
      profile.phone,
      profile.whatsapp,
      profile.notes,
      profile.status,
      profile.totalSessions,
      normalizeDateInput(profile.lastVisit),
      normalizeDateInput(profile.nextAppointment),
      now,
      now
    ]
  );

  return profile;
}

async function updatePatient(id, payload) {
  const clinicId = await requireActiveClinicId();
  await migrateJsonPatientsIfNeeded(clinicId);
  const existing = await getPatient(id);
  if (!existing) {
    throw new Error("Patient not found.");
  }

  const updated = {
    ...existing,
    fullName: (payload.fullName || existing.fullName).trim(),
    phone: payload.phone ?? existing.phone,
    whatsapp: payload.whatsapp ?? existing.whatsapp,
    notes: payload.notes ?? existing.notes,
    status: payload.status ?? existing.status,
    totalSessions: Number(payload.totalSessions ?? existing.totalSessions ?? 0),
    lastVisit: payload.lastVisit ?? existing.lastVisit,
    nextAppointment: payload.nextAppointment ?? existing.nextAppointment,
    updatedAt: new Date().toISOString()
  };

  const pool = await db.getPool();
  await pool.execute(
    `
      UPDATE patients
      SET
        full_name = ?,
        phone = ?,
        whatsapp = ?,
        notes = ?,
        status = ?,
        total_sessions = ?,
        last_visit = ?,
        next_appointment = ?,
        updated_at = ?
      WHERE id = ? AND clinic_id = ?
    `,
    [
      updated.fullName,
      updated.phone,
      updated.whatsapp,
      updated.notes,
      updated.status,
      updated.totalSessions,
      normalizeDateInput(updated.lastVisit),
      normalizeDateInput(updated.nextAppointment),
      new Date(),
      id,
      clinicId
    ]
  );

  return updated;
}

async function deletePatient(id) {
  const clinicId = await requireActiveClinicId();
  await migrateJsonPatientsIfNeeded(clinicId);
  const pool = await db.getPool();
  await pool.execute("DELETE FROM patients WHERE id = ? AND clinic_id = ?", [
    id,
    clinicId
  ]);
  await fsp.rm(getPatientDir(id), { recursive: true, force: true });
  return { ok: true };
}

function parseDate(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function diffDays(dateA, dateB) {
  const ms = dateA - dateB;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

async function getPatientAnalytics(id) {
  const patient = await getPatient(id);
  if (!patient) {
    throw new Error("Patient not found.");
  }

  const clinicId = await requireActiveClinicId();
  const lastVisit = parseDate(patient.lastVisit);
  const nextAppointment = parseDate(patient.nextAppointment);

  const pool = await db.getPool();
  const [payRows] = await pool.execute(
    `
    SELECT
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS totalPaid,
      COUNT(*) AS paymentsCount
    FROM payments
    WHERE clinic_id = ? AND patient_id = ?
    `,
    [clinicId, id]
  );
  const pay = payRows?.[0] || {};
  const totalPaid = Number(pay.totalPaid || 0);
  const paymentsCount = Number(pay.paymentsCount || 0);

  return {
    totalSessions: patient.totalSessions || 0,
    lastVisit: patient.lastVisit || "N/A",
    nextAppointment: patient.nextAppointment || "N/A",
    daysSinceLastVisit: lastVisit ? diffDays(new Date(), lastVisit) : null,
    daysUntilNextAppointment: nextAppointment
      ? diffDays(nextAppointment, new Date())
      : null,
    status: patient.status || "active",
    totalPaid,
    paymentsCount
  };
}

async function getOverallAnalytics() {
  const clinicId = await requireActiveClinicId();
  await migrateJsonPatientsIfNeeded(clinicId);
  const pool = await db.getPool();
  const [rows] = await pool.execute(
    `
    SELECT
      COUNT(*) AS totalPatients,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activePatients,
      SUM(CASE WHEN status <> 'active' THEN 1 ELSE 0 END) AS inactivePatients,
      SUM(total_sessions) AS totalSessions,
      AVG(total_sessions) AS averageSessions,
      SUM(
        CASE
          WHEN next_appointment IS NOT NULL
            AND next_appointment >= CURDATE()
          THEN 1
          ELSE 0
        END
      ) AS upcomingAppointments
    FROM patients
    WHERE clinic_id = ?
  `,
    [clinicId]
  );

  const summary = rows?.[0] || {};
  const totalPatients = Number(summary.totalPatients || 0);
  const totalSessions = Number(summary.totalSessions || 0);
  const averageSessions = totalPatients
    ? Math.round(Number(summary.averageSessions || 0))
    : 0;

  const [paymentRows] = await pool.execute(
    `
    SELECT
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS totalRevenue,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pendingAmount,
      COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paidPayments,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pendingPayments,
      COUNT(*) AS totalPayments
    FROM payments
    WHERE clinic_id = ?
    `,
    [clinicId]
  );
  const pay = paymentRows?.[0] || {};
  const totalRevenue = Number(pay.totalRevenue || 0);
  const pendingAmount = Number(pay.pendingAmount || 0);

  return {
    totalPatients,
    activePatients: Number(summary.activePatients || 0),
    inactivePatients: Number(summary.inactivePatients || 0),
    totalSessions,
    averageSessions,
    upcomingAppointments: Number(summary.upcomingAppointments || 0),
    totalRevenue,
    pendingAmount,
    paidPayments: Number(pay.paidPayments || 0),
    pendingPayments: Number(pay.pendingPayments || 0),
    totalPayments: Number(pay.totalPayments || 0),
    lastUpdated: new Date().toISOString()
  };
}

async function readConfig() {
  return readJson(path.join(getDataDir(), CONFIG_FILE), {
    messageApiUrl: "",
    messageApiKey: "",
    fromSms: "",
    fromWhatsapp: "",
    activeClinicId: "",
    activeAdminId: "",
    migrationDone: false,
    shortcutPromptShown: false
  });
}

async function writeConfig(payload) {
  const current = await readConfig();
  const updated = {
    ...current,
    ...payload
  };
  await writeJson(path.join(getDataDir(), CONFIG_FILE), updated);
  return updated;
}

async function setActiveSession(clinicId, adminId) {
  await writeConfig({
    activeClinicId: clinicId || "",
    activeAdminId: adminId ? String(adminId) : ""
  });
}

async function clearActiveSession() {
  await writeConfig({ activeClinicId: "", activeAdminId: "" });
}

async function getActiveClinicId() {
  const config = await readConfig();
  return config.activeClinicId || "";
}

async function requireActiveClinicId() {
  const clinicId = await getActiveClinicId();
  if (!clinicId) {
    throw new Error("No clinic selected. Please log in.");
  }
  return clinicId;
}

async function listClinics() {
  const pool = await db.getPool();
  const [rows] = await pool.execute(
    `
      SELECT id, name, phone, email, address
      FROM clinics
      ORDER BY name
    `
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone || "",
    email: row.email || "",
    address: row.address || ""
  }));
}

async function getClinicById(clinicId) {
  const pool = await db.getPool();
  const [rows] = await pool.execute(
    `
      SELECT id, name, phone, email, address
      FROM clinics
      WHERE id = ?
      LIMIT 1
    `,
    [clinicId]
  );
  return rows.length ? rows[0] : null;
}

async function registerClinic(payload) {
  const clinic = payload?.clinic || {};
  const admin = payload?.admin || {};

  const name = (clinic.name || "").trim();
  const phone = (clinic.phone || "").trim();
  const email = (clinic.email || "").trim();
  const address = (clinic.address || "").trim();

  const adminName = (admin.fullName || "").trim();
  const adminEmail = (admin.email || "").trim();
  const adminPhone = (admin.phone || "").trim();
  const adminPassword = admin.password || "";

  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/0b66ba84-1f65-45ec-99ab-fa5a1865714d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'auth-pre',hypothesisId:'H1',location:'main.js:501',message:'registerClinic entry',data:{hasClinicName:Boolean(name),hasAdminName:Boolean(adminName),hasAdminEmail:Boolean(adminEmail),hasPassword:Boolean(adminPassword)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!name || !adminName || !adminEmail || !adminPassword) {
    throw new Error("Clinic name and admin credentials are required.");
  }

  const clinicId = generateId(name);
  const now = new Date();
  const pool = await db.getPool();

  await pool.execute(
    `
      INSERT INTO clinics (
        id,
        name,
        phone,
        email,
        address,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [clinicId, name, phone, email, address, now, now]
  );

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const [adminResult] = await pool.execute(
    `
      INSERT INTO clinic_admins (
        clinic_id,
        full_name,
        email,
        phone,
        password_hash,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [clinicId, adminName, adminEmail, adminPhone, passwordHash, now]
  );

  await pool.execute(
    "UPDATE patients SET clinic_id = ? WHERE clinic_id IS NULL",
    [clinicId]
  );

  await setActiveSession(clinicId, adminResult.insertId);
  await migrateJsonPatientsIfNeeded(clinicId);

  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/0b66ba84-1f65-45ec-99ab-fa5a1865714d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'auth-pre',hypothesisId:'H2',location:'main.js:556',message:'registerClinic success',data:{clinicIdSet:Boolean(clinicId),adminIdSet:Boolean(adminResult.insertId)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return { clinicId, adminId: adminResult.insertId, clinicName: name };
}

async function loginClinic(payload) {
  const clinicId = (payload?.clinicId || "").trim();
  const email = (payload?.email || "").trim();
  const password = payload?.password || "";

  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/0b66ba84-1f65-45ec-99ab-fa5a1865714d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'auth-pre',hypothesisId:'H3',location:'main.js:563',message:'loginClinic entry',data:{hasClinicId:Boolean(clinicId),hasEmail:Boolean(email),hasPassword:Boolean(password)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!clinicId || !email || !password) {
    throw new Error("Clinic, email, and password are required.");
  }

  const pool = await db.getPool();
  const [rows] = await pool.execute(
    `
      SELECT id, password_hash
      FROM clinic_admins
      WHERE clinic_id = ? AND email = ?
      LIMIT 1
    `,
    [clinicId, email]
  );

  if (!rows.length) {
    throw new Error("Invalid credentials.");
  }

  const isValid = await bcrypt.compare(password, rows[0].password_hash);
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/0b66ba84-1f65-45ec-99ab-fa5a1865714d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'auth-pre',hypothesisId:'H4',location:'main.js:592',message:'loginClinic password check',data:{isValid},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!isValid) {
    throw new Error("Invalid credentials.");
  }

  await setActiveSession(clinicId, rows[0].id);
  const clinic = await getClinicById(clinicId);

  return {
    clinicId,
    adminId: rows[0].id,
    clinicName: clinic?.name || ""
  };
}

async function logoutClinic() {
  await clearActiveSession();
  return { ok: true };
}

async function getAuthStatus() {
  const clinics = await listClinics();
  const config = await readConfig();
  const activeClinicId = config.activeClinicId || "";
  let activeClinic = null;
  if (activeClinicId) {
    activeClinic = await getClinicById(activeClinicId);
    if (!activeClinic) {
      await clearActiveSession();
    }
  }

  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/0b66ba84-1f65-45ec-99ab-fa5a1865714d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'auth-pre',hypothesisId:'H6',location:'main.js:664',message:'getAuthStatus result',data:{hasClinics:clinics.length > 0,hasActiveClinicId:Boolean(activeClinicId),isAuthenticated:Boolean(activeClinic)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return {
    hasClinics: clinics.length > 0,
    isAuthenticated: Boolean(activeClinic),
    activeClinic: activeClinic
      ? { id: activeClinic.id, name: activeClinic.name }
      : null
  };
}

async function appendMessageLog(entry) {
  await ensureDir(getDataDir());
  const line = `${JSON.stringify(entry)}${os.EOL}`;
  await fsp.appendFile(path.join(getDataDir(), MESSAGE_LOG), line, "utf-8");
}

function getAttachmentsDir(id) {
  return path.join(getPatientDir(id), "attachments");
}

function sanitizeFilename(value) {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || "attachment";
}

function buildDiskFilename(originalName) {
  const ext = path.extname(originalName);
  const base = sanitizeFilename(path.basename(originalName, ext));
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
  const normalizedExt = safeExt && safeExt.startsWith(".") ? safeExt : safeExt ? `.${safeExt}` : "";
  return `${Date.now()}-${base}${normalizedExt}`;
}

function guessMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

async function listAttachments(patientId) {
  if (!patientId) return [];
  const clinicId = await requireActiveClinicId();
  const pool = await db.getPool();
  const [rows] = await pool.execute(
    `
      SELECT
        pa.id,
        pa.file_name,
        pa.mime_type,
        pa.size_bytes,
        pa.disk_path,
        pa.created_at
      FROM patient_attachments pa
      INNER JOIN patients p ON pa.patient_id = p.id
      WHERE pa.patient_id = ? AND p.clinic_id = ?
      ORDER BY pa.created_at DESC
    `,
    [patientId, clinicId]
  );
  return rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes || 0),
    diskPath: row.disk_path,
    createdAt: row.created_at || ""
  }));
}

async function addAttachment(patientId) {
  if (!patientId) {
    throw new Error("Patient is required to add attachments.");
  }
  const patient = await getPatient(patientId);
  if (!patient) {
    throw new Error("Patient not found.");
  }

  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Images and PDFs", extensions: ["png", "jpg", "jpeg", "gif", "webp", "pdf"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const stat = await fsp.stat(filePath);
  if (!stat.isFile()) {
    throw new Error("Selected file is not a file.");
  }

  const originalName = path.basename(filePath);
  const diskName = buildDiskFilename(originalName);
  const attachmentsDir = getAttachmentsDir(patientId);
  await ensureDir(attachmentsDir);
  const diskPath = path.join(attachmentsDir, diskName);
  const buffer = await fsp.readFile(filePath);
  await fsp.writeFile(diskPath, buffer);

  const mimeType = guessMimeType(originalName);
  const pool = await db.getPool();
  const [insertResult] = await pool.execute(
    `
      INSERT INTO patient_attachments (
        patient_id,
        file_name,
        mime_type,
        size_bytes,
        data_blob,
        disk_path,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      patientId,
      originalName,
      mimeType,
      buffer.length,
      buffer,
      diskPath,
      new Date()
    ]
  );

  return {
    id: insertResult.insertId,
    fileName: originalName,
    mimeType,
    sizeBytes: buffer.length,
    diskPath,
    createdAt: new Date().toISOString()
  };
}

async function removeAttachment(attachmentId) {
  const clinicId = await requireActiveClinicId();
  const pool = await db.getPool();
  const [rows] = await pool.execute(
    `
      SELECT pa.disk_path
      FROM patient_attachments pa
      INNER JOIN patients p ON pa.patient_id = p.id
      WHERE pa.id = ? AND p.clinic_id = ?
    `,
    [attachmentId, clinicId]
  );
  if (!rows.length) {
    throw new Error("Attachment not found.");
  }
  const diskPath = rows[0].disk_path;
  await pool.execute("DELETE FROM patient_attachments WHERE id = ?", [attachmentId]);
  if (diskPath) {
    await fsp.unlink(diskPath).catch(() => {});
  }
  return { ok: true };
}

async function openAttachment(attachmentId) {
  const clinicId = await requireActiveClinicId();
  const pool = await db.getPool();
  const [rows] = await pool.execute(
    `
      SELECT pa.file_name, pa.disk_path, pa.data_blob
      FROM patient_attachments pa
      INNER JOIN patients p ON pa.patient_id = p.id
      WHERE pa.id = ? AND p.clinic_id = ?
    `,
    [attachmentId, clinicId]
  );
  if (!rows.length) {
    throw new Error("Attachment not found.");
  }

  const row = rows[0];
  let diskPath = row.disk_path;
  if (!diskPath || !fs.existsSync(diskPath)) {
    const tempDir = path.join(getDataDir(), "temp-attachments");
    await ensureDir(tempDir);
    const diskName = buildDiskFilename(row.file_name || "attachment");
    diskPath = path.join(tempDir, diskName);
    await fsp.writeFile(diskPath, row.data_blob);
  }

  const openResult = await shell.openPath(diskPath);
  if (openResult) {
    throw new Error(openResult);
  }
  return { ok: true };
}

async function listPayments() {
  const clinicId = await requireActiveClinicId();
  const pool = await db.getPool();
  const [rows] = await pool.execute(
    `SELECT p.id, p.clinic_id, p.patient_id, p.amount, p.currency, p.payment_date,
            p.method, p.status, p.reference, p.description, p.created_at, p.updated_at,
            pt.full_name AS patient_name
     FROM payments p
     LEFT JOIN patients pt ON pt.id = p.patient_id AND pt.clinic_id = p.clinic_id
     WHERE p.clinic_id = ?
     ORDER BY p.payment_date DESC, p.created_at DESC`,
    [clinicId]
  );
  return rows.map((row) => ({
    id: row.id,
    clinicId: row.clinic_id,
    patientId: row.patient_id,
    patientName: row.patient_name || "",
    amount: Number(row.amount),
    currency: row.currency || "USD",
    paymentDate: row.payment_date || "",
    method: row.method || "cash",
    status: row.status || "paid",
    reference: row.reference || "",
    description: row.description || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

async function getPayment(id) {
  const clinicId = await requireActiveClinicId();
  const pool = await db.getPool();
  const [rows] = await pool.execute(
    `SELECT p.id, p.clinic_id, p.patient_id, p.amount, p.currency, p.payment_date,
            p.method, p.status, p.reference, p.description, p.created_at, p.updated_at,
            pt.full_name AS patient_name
     FROM payments p
     LEFT JOIN patients pt ON pt.id = p.patient_id AND pt.clinic_id = p.clinic_id
     WHERE p.id = ? AND p.clinic_id = ?`,
    [id, clinicId]
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: row.id,
    clinicId: row.clinic_id,
    patientId: row.patient_id,
    patientName: row.patient_name || "",
    amount: Number(row.amount),
    currency: row.currency || "USD",
    paymentDate: row.payment_date || "",
    method: row.method || "cash",
    status: row.status || "paid",
    reference: row.reference || "",
    description: row.description || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function createPayment(payload) {
  const clinicId = await requireActiveClinicId();
  const patientId = (payload.patientId || "").trim();
  if (!patientId) throw new Error("Patient is required.");
  const patient = await getPatient(patientId);
  if (!patient) throw new Error("Patient not found.");
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Amount must be a non-negative number.");
  const paymentDate = payload.paymentDate || new Date().toISOString().slice(0, 10);
  const now = new Date();
  const pool = await db.getPool();
  const [result] = await pool.execute(
    `INSERT INTO payments (
       clinic_id, patient_id, amount, currency, payment_date, method, status, reference, description, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clinicId,
      patientId,
      amount,
      (payload.currency || "USD").trim().slice(0, 10),
      paymentDate,
      (payload.method || "cash").trim().slice(0, 50),
      (payload.status || "paid").trim().slice(0, 20),
      (payload.reference || "").trim().slice(0, 255),
      (payload.description || "").trim().slice(0, 65535),
      now,
      now
    ]
  );
  const id = result.insertId;
  return getPayment(id);
}

async function updatePayment(id, payload) {
  const clinicId = await requireActiveClinicId();
  const existing = await getPayment(id);
  if (!existing) throw new Error("Payment not found.");
  const patientId = (payload.patientId || existing.patientId).trim();
  if (!patientId) throw new Error("Patient is required.");
  const patient = await getPatient(patientId);
  if (!patient) throw new Error("Patient not found.");
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Amount must be a non-negative number.");
  const pool = await db.getPool();
  await pool.execute(
    `UPDATE payments
     SET patient_id = ?, amount = ?, currency = ?, payment_date = ?, method = ?, status = ?, reference = ?, description = ?, updated_at = ?
     WHERE id = ? AND clinic_id = ?`,
    [
      patientId,
      amount,
      (payload.currency || existing.currency).trim().slice(0, 10),
      payload.paymentDate || existing.paymentDate,
      (payload.method || "cash").trim().slice(0, 50),
      (payload.status || "paid").trim().slice(0, 20),
      (payload.reference || "").trim().slice(0, 255),
      (payload.description || "").trim().slice(0, 65535),
      new Date(),
      id,
      clinicId
    ]
  );
  return getPayment(id);
}

async function deletePayment(id) {
  const clinicId = await requireActiveClinicId();
  const pool = await db.getPool();
  const [result] = await pool.execute(
    "DELETE FROM payments WHERE id = ? AND clinic_id = ?",
    [id, clinicId]
  );
  if (result.affectedRows === 0) throw new Error("Payment not found.");
  return { ok: true };
}

function postJson(url, payload, apiKey) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error("Message API URL not set."));
      return;
    }

    const target = new URL(url);
    const lib = target.protocol === "https:" ? https : http;
    const body = JSON.stringify(payload);
    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body)
    };

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const request = lib.request(
      {
        method: "POST",
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        headers
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          const result = {
            ok: response.statusCode >= 200 && response.statusCode < 300,
            statusCode: response.statusCode,
            body: data
          };
          try {
            result.json = JSON.parse(data);
          } catch (error) {
            // Non-JSON responses are allowed.
          }
          if (result.ok) {
            resolve(result);
          } else {
            reject(
              new Error(`Message API request failed (${response.statusCode}).`)
            );
          }
        });
      }
    );

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

async function sendMessage(payload) {
  const { patientId, channel, message } = payload;
  if (!patientId || !channel || !message) {
    throw new Error("Patient, channel, and message are required.");
  }

  const patient = await getPatient(patientId);
  if (!patient) {
    throw new Error("Patient not found.");
  }

  const config = await readConfig();
  const to = channel === "whatsapp" ? patient.whatsapp : patient.phone;
  const from = channel === "whatsapp" ? config.fromWhatsapp : config.fromSms;

  if (!to) {
    throw new Error("Selected patient does not have a number for this channel.");
  }

  const requestPayload = {
    channel,
    to,
    from,
    message,
    patient: {
      id: patient.id,
      fullName: patient.fullName
    }
  };

  const timestamp = new Date().toISOString();

  try {
    const result = await postJson(
      config.messageApiUrl,
      requestPayload,
      config.messageApiKey
    );
    await appendMessageLog({
      timestamp,
      status: "sent",
      payload: requestPayload,
      result
    });
    return result;
  } catch (error) {
    await appendMessageLog({
      timestamp,
      status: "failed",
      payload: requestPayload,
      error: error.message
    });
    throw error;
  }
}

/**
 * Create a Windows desktop shortcut pointing to the current app executable.
 * Used for first-run prompt and for "Create shortcut" from the app.
 */
function createDesktopShortcutWindows() {
  if (process.platform !== "win32") return Promise.resolve();
  const desktop = app.getPath("desktop");
  const shortcutPath = path.join(desktop, "Speech Therapy Clinic.lnk");
  const exePath = process.execPath;
  const exeDir = path.dirname(exePath);
  const iconPath = path.join(__dirname, "build", "icon.ico");
  const icon = fs.existsSync(iconPath) ? iconPath : exePath;

  const escapePs = (p) => (p || "").replace(/'/g, "''");
  const ps = `
$WshShell = New-Object -ComObject WScript.Shell
$s = $WshShell.CreateShortcut('${escapePs(shortcutPath)}')
$s.TargetPath = '${escapePs(exePath)}'
$s.WorkingDirectory = '${escapePs(exeDir)}'
$s.IconLocation = '${escapePs(icon)}'
$s.Description = 'Speech Therapy Clinic'
$s.Save()
`;
  const scriptPath = path.join(app.getPath("temp"), "create-shortcut.ps1");
  fs.writeFileSync(scriptPath, ps, "utf-8");
  return new Promise((resolve, reject) => {
    execFile(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
      (err) => {
        try {
          fs.unlinkSync(scriptPath);
        } catch (_) {}
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, "build", "icon.ico");
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadFile("index.html");
}

async function askCreateDesktopShortcutOnce() {
  const config = await readConfig();
  if (config.shortcutPromptShown) return;
  await writeConfig({ shortcutPromptShown: true });
  const { response } = await dialog.showMessageBox(null, {
    type: "question",
    buttons: ["Yes", "No"],
    defaultId: 0,
    title: "Desktop shortcut",
    message: "Create a desktop shortcut for Speech Therapy Clinic?",
    detail: "You can open the app from your desktop next time."
  });
  if (response === 0) {
    try {
      await createDesktopShortcutWindows();
    } catch (e) {
      console.error("Failed to create shortcut:", e);
    }
  }
}

app.whenReady().then(() => {
  loadEnvFile(path.join(app.getPath("userData"), ".env"));
  createWindow();

  // First-run: ask user if they want a desktop shortcut (Windows, packaged app only)
  if (process.platform === "win32" && app.isPackaged) {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.once("ready-to-show", () => {
        setImmediate(() => askCreateDesktopShortcutOnce());
      });
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  db.closePool().catch(() => {});
});

ipcMain.handle("patients:list", async () => listPatients());
ipcMain.handle("patients:get", async (_event, id) => getPatient(id));
ipcMain.handle("patients:create", async (_event, payload) =>
  createPatient(payload)
);
ipcMain.handle("patients:update", async (_event, payload) =>
  updatePatient(payload.id, payload.data)
);
ipcMain.handle("patients:delete", async (_event, id) => deletePatient(id));

ipcMain.handle("auth:status", async () => getAuthStatus());
ipcMain.handle("auth:register", async (_event, payload) =>
  registerClinic(payload)
);
ipcMain.handle("auth:login", async (_event, payload) => loginClinic(payload));
ipcMain.handle("auth:logout", async () => logoutClinic());
ipcMain.handle("clinics:list", async () => listClinics());

ipcMain.handle("analytics:patient", async (_event, id) =>
  getPatientAnalytics(id)
);
ipcMain.handle("analytics:overall", async () => getOverallAnalytics());

ipcMain.handle("config:get", async () => readConfig());
ipcMain.handle("config:set", async (_event, payload) => writeConfig(payload));

ipcMain.handle("messages:send", async (_event, payload) => sendMessage(payload));

ipcMain.handle("attachments:list", async (_event, patientId) =>
  listAttachments(patientId)
);
ipcMain.handle("attachments:add", async (_event, patientId) =>
  addAttachment(patientId)
);
ipcMain.handle("attachments:remove", async (_event, attachmentId) =>
  removeAttachment(attachmentId)
);
ipcMain.handle("attachments:open", async (_event, attachmentId) =>
  openAttachment(attachmentId)
);

ipcMain.handle("payments:list", async () => listPayments());
ipcMain.handle("payments:get", async (_event, id) => getPayment(id));
ipcMain.handle("payments:create", async (_event, payload) =>
  createPayment(payload)
);
ipcMain.handle("payments:update", async (_event, payload) =>
  updatePayment(payload.id, payload.data)
);
ipcMain.handle("payments:delete", async (_event, id) => deletePayment(id));
