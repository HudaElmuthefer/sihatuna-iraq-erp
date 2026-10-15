// backend/services/queue/prescriptionReadProcessor.js
//
// The logic for processing a single "read prescription" job -- a thin
// wrapper around agents/prescriptionAgent.js (the full flow: OCR -> AI ->
// interaction check) that only adds audit logging. Separated from BullMQ
// itself for the same reason as invoiceReadProcessor.js -- directly
// testable with no real Redis connection.
const { readPrescription } = require('../../agents/prescriptionAgent');
const { logAudit } = require('../../utils/auditLog');

async function processPrescriptionReadJob(jobData) {
  const { imageBase64, mimeType, lang, userId, userRole, mode, patientAllergies } = jobData;

  const result = await readPrescription(imageBase64, mimeType, lang, mode, patientAllergies);

  if (result.available) {
    logAudit({
      module: 'prescription-reader',
      action: 'read',
      userId,
      userRole,
      after: {
        provider: result.provider,
        medicinesCount: result.medicines?.length || 0,
        ocrUsed: result.ocrUsed,
        hasInteractions: result.hasInteractions,
        highestSeverity: result.highestSeverity,
        hasAllergyConflicts: result.hasAllergyConflicts,
      },
    });
  } else if (result.error) {
    console.error(`[prescription-worker] Call to ${result.provider} failed:`, result.error);
  }

  return result;
}

module.exports = { processPrescriptionReadJob };
