// سجل واحد موثوق (Single Source of Truth) لصفحات الوضع الداكن الهولوغرافي —
// يستهلكه المدار الهولوغرافي (HolographicOrbitDeck)، السايدبار (Layout.js)،
// السحب/الإفلات، اختيار الصفحة، وفتحها، كلّها من نفس المصفوفة.
// الترتيب هنا = ترتيب الأولوية البصرية: الصفحات المعتمدة ذات الشاشات
// المقعرة والقواعد الهولوغرافية أولاً لتشغل الفتحات الأبرز في المدارات.
import { ALL_PAGES } from '../contexts/AppContext';
import {
  DashboardPreview, PatientsPreview, DoctorsPreview, AppointmentsPreview,
  DepartmentsPreview, InventoryPreview, ProcurementPreview, ProjectsPreview,
  DocumentsPreview, ReportsPreview, VaccinationsPreview, LaboratoryPreview,
  HRPreview, AccountsPreview, GenericPreview,
} from '../components/holo/HolographicPagePreview';
import { CURVED_PAGE_IMAGES } from '../assets/darkPages';
import { ORBIT_SLOTS, ORBIT_SLOT_COUNT } from '../utils/holographicOrbit';

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

// الصفحات العشر المعتمدة ذات الشاشة المقعرة والقاعدة الهولوغرافية
const PRIORITY_KEYS = [
  'dashboard',
  'patients',
  'doctors',
  'appointments',
  'departments',
  'vaccinations',
  'medical-codes',
  'ambulance',
  'medical-leave',
  'ai-diagnosis',
];

function priorityOf(page, fallbackIndex) {
  const i = PRIORITY_KEYS.indexOf(page.key);
  return i >= 0 ? i : PRIORITY_KEYS.length + fallbackIndex;
}

const sortedByPriority = ALL_PAGES
  .map((p, i) => ({ p, priority: priorityOf(p, i) }))
  .sort((a, b) => a.priority - b.priority)
  .map(({ p }) => p);

export const DARK_HOLOGRAPHIC_PAGES = sortedByPriority.map((p, i) => {
  const slot = ORBIT_SLOTS[i % ORBIT_SLOT_COUNT];
  return {
    ...p,
    id: p.key,
    route: p.path,
    PreviewComponent: PREVIEW_BY_KEY[p.key] || GenericPreview,
    curvedImage: CURVED_PAGE_IMAGES[p.key] || null,
    hasCurvedPlatformAsset: !!CURVED_PAGE_IMAGES[p.key],
    visualPriority: i,
    orbitGroup: slot.orbit,
    orbitAngle: slot.angle,
  };
});

export function getDarkPage(key) {
  return DARK_HOLOGRAPHIC_PAGES.find(p => p.key === key);
}
