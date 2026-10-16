// backend/middleware/schemas.js
//
// Validation schemas. Phase 1 covered the most clinically and financially
// sensitive modules (patients, doctors, appointments, invoices, employees,
// retirees), and phase 2 below expanded coverage to 20 more modules. Any
// module not listed here is still left without validation for now (its
// current behavior is unchanged) until a schema is added for it later --
// just add the schema here, no need to touch server.js.
module.exports = {
  patients: {
    name: { required: true, type: 'string', minLength: 2 },
    phone: { required: true, type: 'string' },
  },
  doctors: {
    name: { required: true, type: 'string', minLength: 2 },
    phone: { required: true, type: 'string' },
  },
  appointments: {
    // Note: the actual page (AppointmentsPage.js) stores the patient's and
    // doctor's name directly as text in the "patient" and "doctor" fields,
    // not as a numeric id (patientId/doctorId) as this schema's first
    // version mistakenly assumed -- which is what was rejecting every
    // appointment save before. This was corrected to match the actual data
    // shape exactly.
    patient: { required: true, type: 'string' },
    doctor: { required: true, type: 'string' },
    date: { required: true, type: 'string' },
  },
  invoices: {
    patientId: { required: true },
    items: { required: true, type: 'array' },
  },
  employees: {
    name: { required: true, type: 'string', minLength: 2 },
    jobTitle: { required: true, type: 'string' },
  },
  retired: {
    name: { required: true, type: 'string', minLength: 2 },
  },

  // ── Expanded coverage (phase 2) ──────────────────────────────────────────────
  // Every field here matches exactly what the page itself validates on the
  // frontend (each page was checked individually before adding this, to
  // avoid repeating the mistake of assuming fields that don't exist, as
  // happened earlier with the appointments schema).
  departments: {
    name: { required: true, type: 'string', minLength: 2 },
  },
  labTests: {
    patientName: { required: true, type: 'string' },
    testType: { required: true, type: 'string' },
  },
  radiology: {
    patientName: { required: true, type: 'string' },
    modality: { required: true, type: 'string' },
  },
  pharmacyOrders: {
    patientName: { required: true, type: 'string' },
  },
  assets: {
    assetNo: { required: true, type: 'string' },
    name: { required: true, type: 'string' },
  },
  inventory: {
    code: { required: true, type: 'string' },
    name: { required: true, type: 'string' },
  },
  procurement: {
    supplier: { required: true, type: 'string' },
    title: { required: true, type: 'string' },
  },
  projects: {
    manager: { required: true, type: 'string' },
    name: { required: true, type: 'string' },
  },
  documents: {
    title: { required: true, type: 'string' },
  },
  vaccinations: {
    patient: { required: true, type: 'string' },
    vaccine: { required: true, type: 'string' },
    date: { required: true, type: 'string' },
  },
  medicalLeaves: {
    employee: { required: true, type: 'string' },
    from: { required: true, type: 'string' },
    to: { required: true, type: 'string' },
  },
  transactions: {
    desc: { required: true, type: 'string' },
    amount: { required: true },
  },
  // ── The unified promotions/allowances log (merging the former separate
  // promotions/allowances) -- each record may represent a promotion and/or
  // an allowance for one employee, so only the name is required here;
  // each side's own fields (grade/amount/...) are validated in the UI
  // depending on which side is actually filled in for that record.
  promotionsAllowances: {
    name: { required: true, type: 'string' },
  },
  salaries: {
    name: { required: true, type: 'string' },
  },
  ambulanceVehicles: {
    code: { required: true, type: 'string' },
    plate: { required: true, type: 'string' },
  },
  ambulanceMissions: {
    address: { required: true, type: 'string' },
  },
  outgoing: {
    title: { required: true, type: 'string' },
    to: { required: true, type: 'string' },
  },
  incoming: {
    title: { required: true, type: 'string' },
    from: { required: true, type: 'string' },
  },
  crmFollowUps: {
    patientId: { required: true },
    title: { required: true, type: 'string' },
    dueDate: { required: true, type: 'string' },
  },
  crmCampaigns: {
    nameAr: { required: true, type: 'string' },
  },

  // ── Phase 3 (full coverage): the last 4 modules that had no validation ──────────────
  dossiers: {
    // Matches exactly the validation of docForm.title on the retirees page
    // (HRPage.js). retiredId is required to link the document to the
    // correct retiree on the server.
    title: { required: true, type: 'string' },
    retiredId: { required: true },
  },
  crmInteractions: {
    // Note: there is no direct "add" UI for this module yet (the
    // addCrmInteraction function in AppContext.js is ready but not called
    // from any page currently) -- the rule here is defensive, matching the
    // table's only indexed column (patient_id).
    patientId: { required: true },
  },
  crmSegments: {
    // Same note as above (assignCrmSegment isn't called from any UI yet) --
    // these two fields match the table's actual indexed columns
    // (patient_id, segment_code).
    patientId: { required: true },
    segmentCode: { required: true, type: 'string' },
  },
  crmCampaignTargets: {
    // Created automatically via buildCrmCampaignTargets(), not through
    // direct manual entry -- the rule here is defensive protection
    // matching the table's actual indexed columns.
    campaignId: { required: true },
    patientId: { required: true },
  },
  servicePrices: {
    // Note: there is no direct "add" UI currently (addServicePrice in
    // AppContext.js is ready but not called from any page) -- the fields
    // match what the billing screen actually displays (nameAr, category,
    // price).
    nameAr: { required: true, type: 'string' },
    category: { required: true, type: 'string' },
    price: { required: true },
  },
  // ── Fix: the Quality (ISO) management page had no database connection at
  // all ── the data (audits, non-conformities, performance indicators) was
  // lost the moment the page refreshed. The three schemas below support
  // real storage -- see routes/modules.js and
  // database/postgres_schema.sql.
  qualityAudits: {
    title: { required: true, type: 'string' },
  },
  qualityNCs: {
    title: { required: true, type: 'string' },
  },
  qualityKPIs: {
    name: { required: true, type: 'string' },
  },
  // ── Fix: the "maintenance" field used to be just a status + a date that
  // got overwritten with no history at all ── every time maintenance was
  // completed, the previous maintenance record was lost permanently (just
  // replaced with a new date). Now every maintenance event is recorded
  // independently in a permanent log -- see routes/modules.js and
  // database/postgres_schema.sql.
  ambulanceMaintenanceLog: {
    vehicleId: { required: true },
    date: { required: true, type: 'string' },
    description: { required: true, type: 'string' },
  },
  assetMaintenanceLog: {
    assetId: { required: true },
    date: { required: true, type: 'string' },
    description: { required: true, type: 'string' },
  },
  // ── Wards (inpatient management) ────────────────────────────────────────
  wards: {
    name: { required: true, type: 'string' },
  },
  admissions: {
    patientName: { required: true, type: 'string' },
    wardId: { required: true },
  },
  medicationOrders: {
    admissionId: { required: true },
    drugName: { required: true, type: 'string' },
  },
  medicationAdministrations: {
    orderId: { required: true },
    administeredBy: { required: true, type: 'string' },
  },
  // ── Delivery room ────────────────────────────────────────────────────────
  // Fix: deliveryDate used to always be required, which rejected saving a
  // "mother before delivery" record (the admitted stage) because logically
  // there is no delivery date yet -- it gets filled in later at the moment
  // the delivery is "completed". The frontend itself (DeliveryRoomPage.js)
  // specifically checks for deliveryDate at the completion/full delivery
  // registration stage, so there's no need to force it here on every
  // record regardless of its stage.
  deliveries: {
    motherName: { required: true, type: 'string' },
  },
  // ── Physical therapy ──────────────────────────────────────────────────────
  ptEquipment: {
    name: { required: true, type: 'string' },
  },
  ptSessions: {
    patientName: { required: true, type: 'string' },
    date: { required: true, type: 'string' },
  },
  // ── Queue management ───────────────────────────────────────────────────────
  queueTickets: {
    patientName: { required: true, type: 'string' },
    department: { required: true, type: 'string' },
  },
};
