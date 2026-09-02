// سجل الصور المعتمَدة رسمياً كمصغرات صفحات — hard-map يدوي (بند صريح: لا
// اكتشاف تلقائي من مجلد وقت التشغيل، Webpack يستورد كل ملف صراحةً). كل صورة
// هنا فُحصت بصرياً وحقّقت الشرطين الإلزاميين معاً (بند صريح بالمواصفة):
//   1. شاشة مقعّرة/Concave فعلية بمحتوى صفحة حقيقي.
//   2. قاعدة/منصة هولوغرافية واضحة أسفل الشاشة (لا مجرد عنصر زخرفي داخلي).
import dashboard from './page-dashboard.png';
import patients from './page-patients.png';
import medicalCodes from './page-medical-codes.png';
import doctors from './page-doctors.png';
import appointments from './page-appointments.png';
import departments from './page-departments.png';
import vaccinations from './page-vaccinations.png';
import ambulance from './page-ambulance.png';
import medicalLeave from './page-medical-leave.png';
import aiDiagnosis from './page-ai-diagnosis.png';

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
