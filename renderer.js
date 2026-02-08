const state = {
  patients: [],
  selectedId: null,
  attachments: [],
  payments: [],
  selectedPaymentId: null,
  doctors: [],
  selectedDoctorId: null,
  isAuthenticated: false,
  activeClinic: null,
  authMode: "login"
};

const elements = {
  status: document.getElementById("status"),
  patientList: document.getElementById("patient-list"),
  patientSearch: document.getElementById("patient-search"),
  patientCount: document.getElementById("patient-count"),
  addPatient: document.getElementById("add-patient"),
  patientForm: document.getElementById("patient-form"),
  deletePatient: document.getElementById("delete-patient"),
  fullName: document.getElementById("full-name"),
  phone: document.getElementById("phone"),
  whatsapp: document.getElementById("whatsapp"),
  statusField: document.getElementById("status-field"),
  totalSessions: document.getElementById("total-sessions"),
  lastVisit: document.getElementById("last-visit"),
  nextAppointment: document.getElementById("next-appointment"),
  notes: document.getElementById("notes"),
  attachmentList: document.getElementById("attachment-list"),
  addAttachment: document.getElementById("add-attachment"),
  patientAnalysis: document.getElementById("patient-analysis"),
  overallAnalysis: document.getElementById("overall-analysis"),
  messageForm: document.getElementById("message-form"),
  messagePatient: document.getElementById("message-patient"),
  messageChannel: document.getElementById("message-channel"),
  messageText: document.getElementById("message-text"),
  configForm: document.getElementById("config-form"),
  messageApiUrl: document.getElementById("message-api-url"),
  messageApiKey: document.getElementById("message-api-key"),
  fromSms: document.getElementById("from-sms"),
  fromWhatsapp: document.getElementById("from-whatsapp"),
  authScreen: document.getElementById("auth-screen"),
  authStatus: document.getElementById("auth-status"),
  authShowLogin: document.getElementById("auth-show-login"),
  authShowRegister: document.getElementById("auth-show-register"),
  clinicRegisterForm: document.getElementById("clinic-register-form"),
  clinicLoginForm: document.getElementById("clinic-login-form"),
  clinicName: document.getElementById("clinic-name"),
  clinicType: document.getElementById("clinic-type"),
  clinicPhone: document.getElementById("clinic-phone"),
  brandTag: document.getElementById("brand-tag"),
  clinicEmail: document.getElementById("clinic-email"),
  clinicAddress: document.getElementById("clinic-address"),
  adminName: document.getElementById("admin-name"),
  adminEmail: document.getElementById("admin-email"),
  adminPhone: document.getElementById("admin-phone"),
  adminPassword: document.getElementById("admin-password"),
  loginClinic: document.getElementById("login-clinic"),
  loginEmail: document.getElementById("login-email"),
  loginPassword: document.getElementById("login-password"),
  logout: document.getElementById("logout"),
  activeClinic: document.getElementById("active-clinic"),
  paymentList: document.getElementById("payment-list"),
  paymentForm: document.getElementById("payment-form"),
  paymentPatient: document.getElementById("payment-patient"),
  paymentAmount: document.getElementById("payment-amount"),
  paymentCurrency: document.getElementById("payment-currency"),
  paymentDate: document.getElementById("payment-date"),
  paymentMethod: document.getElementById("payment-method"),
  paymentStatus: document.getElementById("payment-status"),
  paymentReference: document.getElementById("payment-reference"),
  paymentDescription: document.getElementById("payment-description"),
  savePayment: document.getElementById("save-payment"),
  newPayment: document.getElementById("new-payment"),
  deletePayment: document.getElementById("delete-payment"),
  patientDoctor: document.getElementById("patient-doctor"),
  doctorList: document.getElementById("doctor-list"),
  doctorForm: document.getElementById("doctor-form"),
  doctorName: document.getElementById("doctor-name"),
  saveDoctor: document.getElementById("save-doctor"),
  deleteDoctor: document.getElementById("delete-doctor"),
  numberOfDoctors: document.getElementById("number-of-doctors")
};

const tabs = Array.from(document.querySelectorAll(".tab-btn"));
const panels = Array.from(document.querySelectorAll(".section-panel"));

function setStatus(message, type = "") {
  elements.status.textContent = message || "";
  elements.status.className = `status ${type}`.trim();
}

function setAuthStatus(message, type = "") {
  if (!elements.authStatus) return;
  elements.authStatus.textContent = message || "";
  elements.authStatus.className = `status ${type}`.trim();
}

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
function isValidEmail(value) {
  return typeof value === "string" && emailRegex.test(value.trim());
}

function setAuthMode(mode) {
  state.authMode = mode;
  if (elements.clinicRegisterForm) {
    elements.clinicRegisterForm.classList.toggle(
      "is-active",
      mode === "register"
    );
  }
  if (elements.clinicLoginForm) {
    elements.clinicLoginForm.classList.toggle("is-active", mode === "login");
  }
}

function setAuthenticated(isAuthenticated, clinic) {
  state.isAuthenticated = isAuthenticated;
  state.activeClinic = clinic || null;
  document.body.classList.toggle("auth-locked", !isAuthenticated);

  if (elements.brandTag) {
    if (clinic?.clinicType && clinic.clinicType !== "General" && clinic.clinicType !== "Other") {
      elements.brandTag.textContent = `${clinic.clinicType} Clinic`;
    } else {
      elements.brandTag.textContent = "Clinic Desk";
    }
  }
  document.title = state.activeClinic?.name ? `${state.activeClinic.name} – Clinic Desk` : "Clinic Desk";

  if (elements.activeClinic) {
    if (clinic?.name) {
      elements.activeClinic.textContent = clinic.name;
      elements.activeClinic.classList.add("is-visible");
    } else {
      elements.activeClinic.textContent = "";
      elements.activeClinic.classList.remove("is-visible");
    }
  }

  if (elements.logout) {
    elements.logout.style.display = isAuthenticated ? "inline-flex" : "none";
  }
}

function setActiveSection(sectionId) {
  tabs.forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.target === sectionId
    );
  });
  panels.forEach((panel) => {
    panel.classList.toggle(
      "is-active",
      panel.dataset.section === sectionId
    );
  });
}

function clearForm() {
  elements.patientForm.reset();
  elements.statusField.value = "active";
}

/** Restrict input to digits only; optional leading + for international. */
function restrictToPhoneInput(inputEl) {
  if (!inputEl) return;
  inputEl.addEventListener("input", () => {
    const raw = inputEl.value;
    const hasPlus = raw.startsWith("+");
    const digits = raw.replace(/\D/g, "");
    inputEl.value = hasPlus ? "+" + digits : digits;
  });
}

function getFormData() {
  return {
    fullName: elements.fullName.value.trim(),
    doctorId: elements.patientDoctor?.value?.trim() || null,
    phone: elements.phone.value.trim(),
    whatsapp: elements.whatsapp.value.trim(),
    status: elements.statusField.value,
    totalSessions: Number(elements.totalSessions.value || 0),
    lastVisit: elements.lastVisit.value,
    nextAppointment: elements.nextAppointment.value,
    notes: elements.notes.value.trim()
  };
}

function fillForm(patient) {
  elements.fullName.value = patient.fullName || "";
  if (elements.patientDoctor) elements.patientDoctor.value = patient.doctorId ? String(patient.doctorId) : "";
  elements.phone.value = patient.phone || "";
  elements.whatsapp.value = patient.whatsapp || "";
  elements.statusField.value = patient.status || "active";
  elements.totalSessions.value = patient.totalSessions ?? 0;
  elements.lastVisit.value = patient.lastVisit || "";
  elements.nextAppointment.value = patient.nextAppointment || "";
  elements.notes.value = patient.notes || "";
}

function renderPatientList() {
  elements.patientList.innerHTML = "";
  const filter = elements.patientSearch.value.trim().toLowerCase();
  const filtered = state.patients.filter((patient) =>
    patient.fullName.toLowerCase().includes(filter)
  );

  if (!filtered.length) {
    elements.patientList.innerHTML =
      '<div class="empty-state">No patients found.</div>';
    return;
  }

  for (const patient of filtered) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "patient-item" + (patient.id === state.selectedId ? " active" : "");
    const name = document.createElement("strong");
    name.textContent = patient.fullName;

    const subtitle = document.createElement("small");
    const parts = [];
    if (patient.doctorName) parts.push(patient.doctorName);
    if (patient.nextAppointment) parts.push(`Next: ${patient.nextAppointment}`);
    subtitle.textContent = parts.length ? parts.join(" · ") : "No doctor · No upcoming appointment";

    button.append(name, subtitle);
    button.addEventListener("click", () => loadPatient(patient.id));
    elements.patientList.appendChild(button);
  }
}

function formatAnalysisValue(key, value) {
  if (value === null || value === undefined) return "N/A";
  if (key === "lastUpdated") {
    try {
      return new Date(value).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
    } catch (_) {
      return String(value);
    }
  }
  const currencyKeys = ["totalRevenue", "pendingAmount", "totalPaid"];
  if (currencyKeys.includes(key) && typeof value === "number") {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
}

function renderAnalysis(container, data) {
  container.innerHTML = "";
  if (!data) {
    container.innerHTML = '<div class="empty-state">No data available.</div>';
    return;
  }

  Object.entries(data).forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "analysis-item";
    const title = document.createElement("h4");
    title.textContent = label.replace(/([A-Z])/g, " $1");

    const content = document.createElement("p");
    content.textContent = formatAnalysisValue(label, value);

    item.append(title, content);
    container.appendChild(item);
  });
}

function formatBytes(size) {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

function setAttachmentControlsEnabled(enabled) {
  if (!elements.addAttachment) return;
  elements.addAttachment.disabled = !enabled;
}

function renderAttachments() {
  if (!elements.attachmentList) return;
  elements.attachmentList.innerHTML = "";

  if (!state.selectedId) {
    elements.attachmentList.innerHTML =
      '<div class="empty-state">Select a patient to manage attachments.</div>';
    setAttachmentControlsEnabled(false);
    return;
  }

  setAttachmentControlsEnabled(true);

  if (!state.attachments.length) {
    elements.attachmentList.innerHTML =
      '<div class="empty-state">No attachments yet.</div>';
    return;
  }

  state.attachments.forEach((attachment) => {
    const item = document.createElement("div");
    item.className = "attachment-item";

    const info = document.createElement("div");
    info.className = "attachment-info";
    const name = document.createElement("strong");
    name.textContent = attachment.fileName;
    const meta = document.createElement("small");
    const metaParts = [
      formatBytes(attachment.sizeBytes),
      attachment.mimeType || "file"
    ];
    meta.textContent = metaParts.join(" • ");
    info.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "attachment-actions";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "btn btn-secondary btn-small";
    openButton.textContent = "Open";
    openButton.addEventListener("click", async () => {
      try {
        await window.clinicApi.openAttachment(attachment.id);
      } catch (error) {
        setStatus(error.message, "error");
      }
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn btn-danger btn-small";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", async () => {
      const confirmRemove = window.confirm(
        "Remove this attachment? This cannot be undone."
      );
      if (!confirmRemove) return;
      try {
        await window.clinicApi.removeAttachment(attachment.id);
        await loadAttachments();
        setStatus("Attachment removed.", "success");
      } catch (error) {
        setStatus(error.message, "error");
      }
    });

    actions.append(openButton, removeButton);
    item.append(info, actions);
    elements.attachmentList.appendChild(item);
  });
}

function renderMessagePatients() {
  elements.messagePatient.innerHTML = "";
  for (const patient of state.patients) {
    const option = document.createElement("option");
    option.value = patient.id;
    option.textContent = patient.fullName;
    elements.messagePatient.appendChild(option);
  }
}

async function loadClinicOptions() {
  if (!elements.loginClinic) return;
  elements.loginClinic.innerHTML = "";
  const clinics = await window.clinicApi.listClinics();
  clinics.forEach((clinic) => {
    const option = document.createElement("option");
    option.value = clinic.id;
    option.textContent = clinic.name;
    elements.loginClinic.appendChild(option);
  });
}

async function loadAuthStatus() {
  setAuthStatus("");
  try {
    const status = await window.clinicApi.getAuthStatus();
    if (status.isAuthenticated) {
      setAuthenticated(true, status.activeClinic);
      return true;
    }

    setAuthenticated(false, null);
    if (status.hasClinics) {
      await loadClinicOptions();
      setAuthMode("login");
    } else {
      setAuthMode("register");
    }
    return false;
  } catch (error) {
    setAuthenticated(false, null);
    setAuthMode("register");
    setAuthStatus(error.message, "error");
    return false;
  }
}

async function loadAttachments() {
  if (!state.selectedId) {
    state.attachments = [];
    renderAttachments();
    return;
  }

  try {
    state.attachments = await window.clinicApi.listAttachments(state.selectedId);
  } catch (error) {
    state.attachments = [];
    setStatus(error.message, "error");
  }
  renderAttachments();
}

async function refreshAnalytics() {
  if (state.selectedId) {
    const analytics = await window.clinicApi.getPatientAnalytics(
      state.selectedId
    );
    renderAnalysis(elements.patientAnalysis, analytics);
  } else {
    renderAnalysis(elements.patientAnalysis, null);
  }

  const overall = await window.clinicApi.getOverallAnalytics();
  renderAnalysis(elements.overallAnalysis, overall);
}

async function loadPatient(id) {
  const patient = await window.clinicApi.getPatient(id);
  if (!patient) {
    setStatus("Patient not found.", "error");
    return;
  }
  state.selectedId = id;
  fillForm(patient);
  renderPatientList();
  setActiveSection("patient");
  await loadAttachments();
  await refreshAnalytics();
}

async function refreshPatients() {
  state.patients = await window.clinicApi.listPatients();
  state.doctors = await window.clinicApi.listDoctors().catch(() => []);
  fillDoctorOptions();
  renderPatientList();
  renderMessagePatients();
  if (elements.patientCount) {
    const count = state.patients.length;
    elements.patientCount.textContent =
      count === 1 ? "1 patient" : `${count} patients`;
  }

  if (state.selectedId) {
    const stillExists = state.patients.some(
      (patient) => patient.id === state.selectedId
    );
    if (!stillExists) {
      state.selectedId = null;
      clearForm();
    }
  }
  if (state.selectedId) {
    await loadAttachments();
  } else {
    state.attachments = [];
    renderAttachments();
  }
  await refreshAnalytics();
}

async function loadConfig() {
  const config = await window.clinicApi.getConfig();
  elements.messageApiUrl.value = config.messageApiUrl || "";
  elements.messageApiKey.value = config.messageApiKey || "";
  elements.fromSms.value = config.fromSms || "";
  elements.fromWhatsapp.value = config.fromWhatsapp || "";
}

function fillPaymentPatientOptions() {
  if (!elements.paymentPatient) return;
  elements.paymentPatient.innerHTML = "";
  const opt = document.createElement("option");
  opt.value = "";
  opt.textContent = "— Select patient —";
  elements.paymentPatient.appendChild(opt);
  for (const p of state.patients) {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.fullName;
    elements.paymentPatient.appendChild(option);
  }
}

function fillDoctorOptions() {
  if (!elements.patientDoctor) return;
  const cur = elements.patientDoctor.value;
  elements.patientDoctor.innerHTML = "";
  const opt = document.createElement("option");
  opt.value = "";
  opt.textContent = "— None —";
  elements.patientDoctor.appendChild(opt);
  for (const d of state.doctors) {
    const option = document.createElement("option");
    option.value = String(d.id);
    option.textContent = d.fullName;
    elements.patientDoctor.appendChild(option);
  }
  if (cur) elements.patientDoctor.value = cur;
}

async function loadPayments() {
  try {
    state.payments = await window.clinicApi.listPayments();
    renderPaymentList();
    fillPaymentPatientOptions();
  } catch (error) {
    state.payments = [];
    renderPaymentList();
    setStatus(error.message, "error");
  }
}

async function loadDoctors() {
  try {
    state.doctors = await window.clinicApi.listDoctors();
    renderDoctorList();
    fillDoctorOptions();
  } catch (error) {
    state.doctors = [];
    renderDoctorList();
    setStatus(error.message, "error");
  }
}

function renderDoctorList() {
  if (!elements.doctorList) return;
  elements.doctorList.innerHTML = "";
  if (!state.doctors.length) {
    elements.doctorList.innerHTML = '<div class="empty-state">No doctors yet. Add doctors below or set "Number of doctors" when registering.</div>';
    return;
  }
  state.doctors.forEach((doc) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "patient-item" + (doc.id === state.selectedDoctorId ? " active" : "");
    item.textContent = doc.fullName;
    item.addEventListener("click", () => selectDoctor(doc.id));
    elements.doctorList.appendChild(item);
  });
}

async function selectDoctor(id) {
  state.selectedDoctorId = id;
  renderDoctorList();
  try {
    const doc = await window.clinicApi.getDoctor(id);
    fillDoctorForm(doc);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function fillDoctorForm(doc) {
  if (!doc) return clearDoctorForm();
  if (elements.doctorName) elements.doctorName.value = doc.fullName || "";
  if (elements.deleteDoctor) elements.deleteDoctor.disabled = false;
}

function clearDoctorForm() {
  state.selectedDoctorId = null;
  renderDoctorList();
  if (elements.doctorForm) elements.doctorForm.reset();
  if (elements.deleteDoctor) elements.deleteDoctor.disabled = true;
}

function renderPaymentList() {
  if (!elements.paymentList) return;
  elements.paymentList.innerHTML = "";
  if (!state.payments.length) {
    elements.paymentList.innerHTML =
      '<div class="empty-state">No payments yet. Add one with the form.</div>';
    return;
  }
  state.payments.forEach((payment) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className =
      "patient-item" +
      (payment.id === state.selectedPaymentId ? " active" : "");
    const line1 = document.createElement("strong");
    line1.textContent = `${payment.patientName || "Patient"} · ${payment.amount} ${payment.currency}`;
    const line2 = document.createElement("small");
    line2.textContent = `${payment.paymentDate} · ${payment.method} · ${payment.status}`;
    item.append(line1, document.createElement("br"), line2);
    item.addEventListener("click", () => selectPayment(payment.id));
    elements.paymentList.appendChild(item);
  });
}

async function selectPayment(id) {
  state.selectedPaymentId = id;
  renderPaymentList();
  try {
    const payment = await window.clinicApi.getPayment(id);
    fillPaymentForm(payment);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function fillPaymentForm(payment) {
  if (!payment) return clearPaymentForm();
  if (elements.paymentPatient) elements.paymentPatient.value = payment.patientId || "";
  if (elements.paymentAmount) elements.paymentAmount.value = payment.amount ?? "";
  if (elements.paymentCurrency) elements.paymentCurrency.value = payment.currency || "USD";
  if (elements.paymentDate) elements.paymentDate.value = payment.paymentDate || "";
  if (elements.paymentMethod) elements.paymentMethod.value = payment.method || "cash";
  if (elements.paymentStatus) elements.paymentStatus.value = payment.status || "paid";
  if (elements.paymentReference) elements.paymentReference.value = payment.reference || "";
  if (elements.paymentDescription) elements.paymentDescription.value = payment.description || "";
  if (elements.deletePayment) elements.deletePayment.disabled = false;
}

function clearPaymentForm() {
  state.selectedPaymentId = null;
  renderPaymentList();
  if (elements.paymentForm) elements.paymentForm.reset();
  if (elements.paymentDate) elements.paymentDate.value = new Date().toISOString().slice(0, 10);
  if (elements.paymentCurrency) elements.paymentCurrency.value = "USD";
  if (elements.paymentMethod) elements.paymentMethod.value = "cash";
  if (elements.paymentStatus) elements.paymentStatus.value = "paid";
  if (elements.deletePayment) elements.deletePayment.disabled = true;
}

elements.patientSearch.addEventListener("input", renderPatientList);

tabs.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveSection(button.dataset.target);
    if (button.dataset.target === "payments") {
      fillPaymentPatientOptions();
      loadPayments();
    }
    if (button.dataset.target === "overview") {
      refreshAnalytics();
    }
    if (button.dataset.target === "team") {
      loadDoctors();
    }
  });
});

const overviewViewPayments = document.getElementById("overview-view-payments");
if (overviewViewPayments) {
  overviewViewPayments.addEventListener("click", (e) => {
    e.preventDefault();
    setActiveSection("payments");
    tabs.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.target === "payments"));
    panels.forEach((p) => p.classList.toggle("is-active", p.dataset.section === "payments"));
    fillPaymentPatientOptions();
    loadPayments();
  });
}

if (elements.authShowLogin) {
  elements.authShowLogin.addEventListener("click", async () => {
    setAuthMode("login");
    try {
      await loadClinicOptions();
    } catch (error) {
      setAuthStatus(error.message, "error");
    }
  });
}

if (elements.authShowRegister) {
  elements.authShowRegister.addEventListener("click", () =>
    setAuthMode("register")
  );
}

if (elements.clinicRegisterForm) {
  elements.clinicRegisterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const clinicEmail = elements.clinicEmail.value.trim();
    const adminEmail = elements.adminEmail.value.trim();
    if (clinicEmail && !isValidEmail(clinicEmail)) {
      setAuthStatus("Please enter a valid clinic email address.", "error");
      return;
    }
    if (!isValidEmail(adminEmail)) {
      setAuthStatus("Please enter a valid admin email address.", "error");
      return;
    }
    try {
      const payload = {
        numberOfDoctors: Math.max(0, Math.min(50, Number(elements.numberOfDoctors?.value || 1) || 0)),
        clinic: {
          name: elements.clinicName.value.trim(),
          clinicType: elements.clinicType?.value || "General",
          phone: elements.clinicPhone.value.trim(),
          email: elements.clinicEmail.value.trim(),
          address: elements.clinicAddress.value.trim()
        },
        admin: {
          fullName: elements.adminName.value.trim(),
          email: elements.adminEmail.value.trim(),
          phone: elements.adminPhone.value.trim(),
          password: elements.adminPassword.value
        }
      };
      const result = await window.clinicApi.registerClinic(payload);
      setAuthenticated(true, {
        id: result.clinicId,
        name: result.clinicName,
        clinicType: result.clinicType
      });
      setAuthStatus("Clinic created.", "success");
      await refreshPatients();
      await loadConfig();
    } catch (error) {
      setAuthStatus(error.message, "error");
    }
  });
}

if (elements.clinicLoginForm) {
  elements.clinicLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const loginEmail = elements.loginEmail.value.trim();
    if (!isValidEmail(loginEmail)) {
      setAuthStatus("Please enter a valid email address.", "error");
      return;
    }
    try {
      const payload = {
        clinicId: elements.loginClinic.value,
        email: loginEmail,
        password: elements.loginPassword.value
      };
      const result = await window.clinicApi.loginClinic(payload);
      setAuthenticated(true, {
        id: result.clinicId,
        name: result.clinicName,
        clinicType: result.clinicType
      });
      setAuthStatus("");
      setStatus("Logged in.", "success");
      await refreshPatients();
      await loadConfig();
    } catch (error) {
      setAuthStatus(error.message, "error");
    }
  });
}

if (elements.logout) {
  elements.logout.addEventListener("click", async () => {
    try {
      await window.clinicApi.logoutClinic();
      setAuthenticated(false, null);
      state.selectedId = null;
      state.patients = [];
      state.attachments = [];
      renderPatientList();
      renderMessagePatients();
      renderAttachments();
      await loadAuthStatus();
      setStatus("");
      setAuthStatus("Logged out.", "success");
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
}

elements.addPatient.addEventListener("click", () => {
  state.selectedId = null;
  state.attachments = [];
  clearForm();
  renderPatientList();
  renderAttachments();
  setActiveSection("patient");
  refreshAnalytics();
});

restrictToPhoneInput(elements.phone);
restrictToPhoneInput(elements.whatsapp);
restrictToPhoneInput(elements.clinicPhone);
restrictToPhoneInput(elements.adminPhone);

elements.patientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = getFormData();
    if (!payload.fullName) {
      setStatus("Full name is required.", "error");
      return;
    }

    if (state.selectedId) {
      await window.clinicApi.updatePatient(state.selectedId, payload);
      setStatus("Patient updated.", "success");
    } else {
      const created = await window.clinicApi.createPatient(payload);
      state.selectedId = created.id;
      setStatus("Patient created.", "success");
    }
    await refreshPatients();
    if (state.selectedId) {
      await loadPatient(state.selectedId);
    }
  } catch (error) {
    setStatus(error.message, "error");
  }
});

elements.deletePatient.addEventListener("click", async () => {
  if (!state.selectedId) {
    setStatus("Select a patient to delete.", "error");
    return;
  }
  const confirmDelete = window.confirm(
    "Are you sure you want to delete this patient?"
  );
  if (!confirmDelete) return;

  try {
    await window.clinicApi.deletePatient(state.selectedId);
    state.selectedId = null;
    clearForm();
    setStatus("Patient deleted.", "success");
    await refreshPatients();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

if (elements.addAttachment) {
  elements.addAttachment.addEventListener("click", async () => {
    if (!state.selectedId) {
      setStatus("Select a patient to add attachments.", "error");
      return;
    }
    try {
      const result = await window.clinicApi.addAttachment(state.selectedId);
      if (result?.canceled) return;
      await loadAttachments();
      setStatus("Attachment added.", "success");
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
}

elements.messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const patientId = elements.messagePatient.value;
    const channel = elements.messageChannel.value;
    const message = elements.messageText.value.trim();

    if (!patientId || !message) {
      setStatus("Select a patient and write a message.", "error");
      return;
    }

    await window.clinicApi.sendMessage({ patientId, channel, message });
    elements.messageText.value = "";
    setStatus("Message sent (or queued by API).", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

elements.configForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await window.clinicApi.setConfig({
      messageApiUrl: elements.messageApiUrl.value.trim(),
      messageApiKey: elements.messageApiKey.value.trim(),
      fromSms: elements.fromSms.value.trim(),
      fromWhatsapp: elements.fromWhatsapp.value.trim()
    });
    setStatus("Settings saved.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

if (elements.paymentForm) {
  elements.paymentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const patientId = elements.paymentPatient?.value?.trim();
    const amount = elements.paymentAmount?.value;
    if (!patientId || !amount) {
      setStatus("Patient and amount are required.", "error");
      return;
    }
    try {
      const payload = {
        patientId,
        amount: Number(amount),
        currency: elements.paymentCurrency?.value || "USD",
        paymentDate: elements.paymentDate?.value || "",
        method: elements.paymentMethod?.value || "cash",
        status: elements.paymentStatus?.value || "paid",
        reference: elements.paymentReference?.value?.trim() || "",
        description: elements.paymentDescription?.value?.trim() || ""
      };
      if (state.selectedPaymentId) {
        await window.clinicApi.updatePayment(state.selectedPaymentId, payload);
        setStatus("Payment updated.", "success");
      } else {
        await window.clinicApi.createPayment(payload);
        setStatus("Payment created.", "success");
      }
      clearPaymentForm();
      await loadPayments();
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
}

if (elements.newPayment) {
  elements.newPayment.addEventListener("click", () => clearPaymentForm());
}

if (elements.deletePayment) {
  elements.deletePayment.disabled = true;
  elements.deletePayment.addEventListener("click", async () => {
    if (!state.selectedPaymentId) return;
    if (!window.confirm("Delete this payment? This cannot be undone.")) return;
    try {
      await window.clinicApi.deletePayment(state.selectedPaymentId);
      setStatus("Payment deleted.", "success");
      clearPaymentForm();
      await loadPayments();
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
}

if (elements.doctorForm) {
  elements.doctorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fullName = elements.doctorName?.value?.trim();
    if (!fullName) {
      setStatus("Doctor name is required.", "error");
      return;
    }
    try {
      if (state.selectedDoctorId) {
        await window.clinicApi.updateDoctor(state.selectedDoctorId, { fullName });
        setStatus("Doctor updated.", "success");
      } else {
        await window.clinicApi.createDoctor({ fullName });
        setStatus("Doctor added.", "success");
      }
      clearDoctorForm();
      await loadDoctors();
      fillDoctorOptions();
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
}

if (elements.deleteDoctor) {
  elements.deleteDoctor.disabled = true;
  elements.deleteDoctor.addEventListener("click", async () => {
    if (!state.selectedDoctorId) return;
    if (!window.confirm("Remove this doctor? Patients assigned to them will have no doctor.")) return;
    try {
      await window.clinicApi.deleteDoctor(state.selectedDoctorId);
      setStatus("Doctor removed.", "success");
      clearDoctorForm();
      await loadDoctors();
      fillDoctorOptions();
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
}

async function init() {
  try {
    document.body.classList.add("auth-locked");
    setActiveSection("overview");
    const isAuthed = await loadAuthStatus();
    if (isAuthed) {
      await refreshPatients();
      await loadConfig();
      setStatus("Ready.");
    }
  } catch (error) {
    setStatus(error.message, "error");
  }
}

init();
