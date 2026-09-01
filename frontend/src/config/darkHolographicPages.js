// سجل واحد موثوق (Single Source of Truth) لصفحات الوضع الداكن الهولوغرافي —
// تستهلكه الحلقة (HolographicPageRing) والسايدبار (Layout.js) وحساب الصفحة
// المختارة وحركة الفتح، كلّها من نفس المصفوفة — لا مصفوفات منفصلة قد
// تتعارض. الترتيب هنا = ترتيب ظهور الصفحات على الحلقة (لوحة التحكم أولاً).
import { ALL_PAGES } from '../contexts/AppContext';
import {
  DashboardPreview, PatientsPreview, DoctorsPreview, AppointmentsPreview,
  DepartmentsPreview, InventoryPreview, ProcurementPreview, ProjectsPreview,
  DocumentsPreview, ReportsPreview, VaccinationsPreview, LaboratoryPreview,
  HRPreview, AccountsPreview, GenericPreview,
} from '../components/holo/HolographicPagePreview';
import { CURVED_PAGE_IMAGES } from '../assets/darkPages';

const PREVIEW_BY_KEY = {
  dashboard: DashboardPreview,
  patients: PatientsPreview,
  doctors: DoctorsPreview,
  appointments: AppointmentsPreview,
  departments: DepartmentsPreview,
  inventory: InventoryPreview,
  procurement: ProcurementPreview,
  projects: ProjectsPreview,
  documents: DocumentsPreview,
  'smart-reports': ReportsPreview,
  vaccinations: VaccinationsPreview,
  laboratory: LaboratoryPreview,
  results: LaboratoryPreview,
  hr: HRPreview,
  accounts: AccountsPreview,
};

// كل عنصر بـALL_PAGES (AppContext.js) يقابله هنا نفس key/label/icon/path —
// فقط نُضيف PreviewComponent فوقها، دون تكرار البيانات الأساسية. الترتيب
// هنا مُعاد ترتيبه عمداً (لوحة التحكم تُنقَل لمنتصف القائمة تقريباً، لا
// أول عنصر كما بـALL_PAGES/السايدبار) — حتى تظهر الحلقة متناظرة (لوحات
// على الجانبين) منذ اللحظة الأولى بدل تكديس أحادي الجانب لو بقيت لوحة
// التحكم أول عنصر مطلقاً على الحلقة (لا فهرس قبل 0). لا يؤثر هذا على ترتيب
// السايدبار (يعتمد ALL_PAGES مباشرة، غير هذه المصفوفة).
const nonDashboard = ALL_PAGES.filter(p => p.key !== 'dashboard');
const dashboardEntry = ALL_PAGES.find(p => p.key === 'dashboard');
const midPoint = Math.floor(nonDashboard.length / 2);
const reordered = dashboardEntry
  ? [...nonDashboard.slice(0, midPoint), dashboardEntry, ...nonDashboard.slice(midPoint)]
  : nonDashboard;

export const DARK_HOLOGRAPHIC_PAGES = reordered.map(p => ({
  ...p,
  PreviewComponent: PREVIEW_BY_KEY[p.key] || GenericPreview,
  // بند صريح — Part 8: الصورة المقعّرة (إن وُجدت) هي مصدر الحقيقة الوحيد
  // للمصغرة، لا تصميم CSS إضافي فوقها (راجع HolographicPagePanel.js).
  curvedImage: CURVED_PAGE_IMAGES[p.key] || null,
  hasCurvedAsset: !!CURVED_PAGE_IMAGES[p.key],
}));

export function getDarkPage(key) {
  return DARK_HOLOGRAPHIC_PAGES.find(p => p.key === key);
}
