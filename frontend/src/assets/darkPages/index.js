// سجل الصور المقعّرة المعتمَدة كمصغرات صفحات فعلية للحلقة الهولوغرافية —
// hard-map يدوي (بند صريح: لا اكتشاف تلقائي من مجلد وقت التشغيل، Webpack
// يستورد كل ملف صراحةً). كل صورة هنا فُحصت بصرياً وطابقناها بصفحة حقيقية
// من ALL_PAGES (راجع التقرير المُعطى للمستخدم قبل هذا الملف). صورة
// "الإسعاف والمركبات" الوحيدة التي احتاجت معالجة (إزالة خلفية بيضاء معتمة
// عبر flood-fill من الحواف، بموافقة صريحة من المستخدم) — الملف الأصلي
// بمجلد components/dark يبقى كما هو بلا أي تعديل.
import dashboard from './page-dashboard.png';
import patients from './page-patients.png';
import medicalCodes from './page-medical-codes.png';
import doctors from './page-doctors.png';
import appointments from './page-appointments.png';
import departments from './page-departments.png';
import vaccinations from './page-vaccinations.png';
import medicalLeave from './page-medical-leave.png';
import ambulance from './page-ambulance.png';

export const CURVED_PAGE_IMAGES = {
  dashboard,
  patients,
  'medical-codes': medicalCodes,
  doctors,
  appointments,
  departments,
  vaccinations,
  'medical-leave': medicalLeave,
  ambulance,
};
