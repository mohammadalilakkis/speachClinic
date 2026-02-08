const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("clinicApi", {
  listPatients: () => ipcRenderer.invoke("patients:list"),
  getPatient: (id) => ipcRenderer.invoke("patients:get", id),
  createPatient: (data) => ipcRenderer.invoke("patients:create", data),
  updatePatient: (id, data) =>
    ipcRenderer.invoke("patients:update", { id, data }),
  deletePatient: (id) => ipcRenderer.invoke("patients:delete", id),
  getPatientAnalytics: (id) => ipcRenderer.invoke("analytics:patient", id),
  getOverallAnalytics: () => ipcRenderer.invoke("analytics:overall"),
  getConfig: () => ipcRenderer.invoke("config:get"),
  setConfig: (data) => ipcRenderer.invoke("config:set", data),
  sendMessage: (data) => ipcRenderer.invoke("messages:send", data),
  getAuthStatus: () => ipcRenderer.invoke("auth:status"),
  registerClinic: (data) => ipcRenderer.invoke("auth:register", data),
  loginClinic: (data) => ipcRenderer.invoke("auth:login", data),
  logoutClinic: () => ipcRenderer.invoke("auth:logout"),
  listClinics: () => ipcRenderer.invoke("clinics:list"),
  listAttachments: (patientId) =>
    ipcRenderer.invoke("attachments:list", patientId),
  addAttachment: (patientId) => ipcRenderer.invoke("attachments:add", patientId),
  removeAttachment: (attachmentId) =>
    ipcRenderer.invoke("attachments:remove", attachmentId),
  openAttachment: (attachmentId) =>
    ipcRenderer.invoke("attachments:open", attachmentId),
  listPayments: () => ipcRenderer.invoke("payments:list"),
  getPayment: (id) => ipcRenderer.invoke("payments:get", id),
  createPayment: (data) => ipcRenderer.invoke("payments:create", data),
  updatePayment: (id, data) =>
    ipcRenderer.invoke("payments:update", { id, data }),
  deletePayment: (id) => ipcRenderer.invoke("payments:delete", id),
  listDoctors: () => ipcRenderer.invoke("doctors:list"),
  getDoctor: (id) => ipcRenderer.invoke("doctors:get", id),
  createDoctor: (data) => ipcRenderer.invoke("doctors:create", data),
  updateDoctor: (id, data) =>
    ipcRenderer.invoke("doctors:update", { id, data }),
  deleteDoctor: (id) => ipcRenderer.invoke("doctors:delete", id)
});
