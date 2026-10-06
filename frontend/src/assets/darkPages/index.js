// سجل الصور المعتمَدة رسمياً كمصغرات صفحات — hard-map يدوي (بند صريح: لا
// اكتشاف تلقائي من مجلد وقت التشغيل، Webpack يستورد كل ملف صراحةً). كل صورة
// هنا فُحصت بصرياً وحقّقت الشرطين الإلزاميين معاً (بند صريح بالمواصفة):
//   1. شاشة مقعّرة/Concave فعلية بمحتوى صفحة حقيقي.
//   2. قاعدة/منصة هولوغرافية واضحة أسفل الشاشة (لا مجرد عنصر زخرفي داخلي).
// WebP بدل PNG الأصلي (نفس المحتوى البصري بالضبط، تحقّقتُ بصرياً) — إصلاح
// أداء نافذة المعاينة المكبّرة بـDashboardPage.js: هذه نفس الملفات المعروضة
// بالمصغّرات المدارية العشر وبالنافذة المكبّرة معاً، وكانت ~470-530 كيلوبايت
// لكل PNG غير مضغوط لمحتوى 640×480 فقط. راجع ملخص المهمة للأرقام الكاملة.
import dashboard from './page-dashboard.webp';
import patients from './page-patients.webp';
import medicalCodes from './page-medical-codes.webp';
import doctors from './page-doctors.webp';
import appointments from './page-appointments.webp';
import departments from './page-departments.webp';
import vaccinations from './page-vaccinations.webp';
import ambulance from './page-ambulance.webp';
import medicalLeave from './page-medical-leave.webp';
import aiDiagnosis from './page-ai-diagnosis.webp';

// Small 320x213 variants of the exact same images, for the 10 orbiting
// thumbnails (displayed at ~205x120 max — see DashboardPage.js's
// curvedThumbnails radialPos.w/h). The full 800x533 images above stay in
// use only for the single enlarged preview window, which actually needs
// that resolution; rendering all ten tiny orbit nodes from the full-size
// files was costing ~1.6 MiB of unused image data on every dashboard load.
import dashboardThumb from './page-dashboard-thumb.webp';
import patientsThumb from './page-patients-thumb.webp';
import medicalCodesThumb from './page-medical-codes-thumb.webp';
import doctorsThumb from './page-doctors-thumb.webp';
import appointmentsThumb from './page-appointments-thumb.webp';
import departmentsThumb from './page-departments-thumb.webp';
import vaccinationsThumb from './page-vaccinations-thumb.webp';
import ambulanceThumb from './page-ambulance-thumb.webp';
import medicalLeaveThumb from './page-medical-leave-thumb.webp';
import aiDiagnosisThumb from './page-ai-diagnosis-thumb.webp';

export const CURVED_PAGE_IMAGES = {
  dashboard,
  patients,
  'medical-codes': medicalCodes,
  doctors,
  appointments,
  departments,
  vaccinations,
  ambulance,
  'medical-leave': medicalLeave,
  'ai-diagnosis': aiDiagnosis,
};

export const CURVED_PAGE_THUMBNAILS = {
  dashboard: dashboardThumb,
  patients: patientsThumb,
  'medical-codes': medicalCodesThumb,
  doctors: doctorsThumb,
  appointments: appointmentsThumb,
  departments: departmentsThumb,
  vaccinations: vaccinationsThumb,
  ambulance: ambulanceThumb,
  'medical-leave': medicalLeaveThumb,
  'ai-diagnosis': aiDiagnosisThumb,
};
