import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import Layout from './components/Layout';
import ToastContainer from './components/ToastContainer';
import ConfirmDialog from './components/ConfirmDialog';
import ForceChangePasswordScreen from './pages/ForceChangePasswordScreen';
import FuturisticCursor from './components/FuturisticCursor';
import useRippleEffect from './hooks/useRippleEffect';
// LoginPage وDashboardPage فقط يبقيان استيراداً عادياً (بلا lazy) — هما أول
// شاشتين يراهما أي مستخدم فعلياً (قبل الدخول، وبعده مباشرة)، فتحميلهما ضمن
// الحزمة الرئيسية يمنع أي وميض تحميل إضافي على المسار الأكثر شيوعاً. باقي
// الصفحات الـ30 (كل موديولات ERP) كانت جميعها تُستورَد فورياً بلا استثناء —
// يعني حزمة main.js واحدة تحمّل كل النظام دفعة واحدة حتى لمستخدم يريد فقط
// تسجيل الدخول ورؤية اللوحة الرئيسية. React.lazy() + Suspense يقسّم كل صفحة
// إلى ملف JS منفصل يُحمَّل فقط عند زيارتها فعلياً — قياس فعلي قبل/بعد هذا
// التعديل موثَّق بملخص المهمة.
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
const PatientsPage = lazy(() => import('./pages/PatientsPage'));
const MedicalCodesPage = lazy(() => import('./pages/MedicalCodesPage'));
const DoctorsPage = lazy(() => import('./pages/DoctorsPage'));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const DepartmentsPage = lazy(() => import('./pages/DepartmentsPage'));
const PersonalServicesPage = lazy(() => import('./pages/PersonalServicesPage'));
const AIDiagnosisPage = lazy(() => import('./pages/AIDiagnosisPage'));
const CRMPage = lazy(() => import('./pages/CRMPage'));
const PaymentSettingsPage = lazy(() => import('./pages/PaymentSettingsPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const VaccinationsPage = lazy(() => import('./pages/VaccinationsPage'));
const WardsPage = lazy(() => import('./pages/WardsPage'));
const DeliveryRoomPage = lazy(() => import('./pages/DeliveryRoomPage'));
const PhysicalTherapyPage = lazy(() => import('./pages/PhysicalTherapyPage'));
const QueuePage = lazy(() => import('./pages/QueuePage'));
const QueueDisplayPage = lazy(() => import('./pages/QueueDisplayPage'));
const DrugInteractionsPage = lazy(() => import('./pages/DrugInteractionsPage'));
const DosageCheckPage = lazy(() => import('./pages/DosageCheckPage'));
const AllergyCheckPage = lazy(() => import('./pages/AllergyCheckPage'));
const MedicalLeavePage = lazy(() => import('./pages/MedicalLeavePage'));
const SmartReportsPage = lazy(() => import('./pages/SmartReportsPage'));
const HRPage = lazy(() => import('./pages/HRPage'));
const AccountsPage = lazy(() => import('./pages/AccountsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
// ERP New Modules
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const ProcurementPage = lazy(() => import('./pages/ProcurementPage'));
const BillingAnomalyPage = lazy(() => import('./pages/BillingAnomalyPage'));
const InventoryPredictionPage = lazy(() => import('./pages/InventoryPredictionPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const QualityPage = lazy(() => import('./pages/QualityPage'));
const LaboratoryPage = lazy(() => import('./pages/LaboratoryPage'));
const ResultsPage = lazy(() => import('./pages/ResultsPage'));
const RadiologyPage = lazy(() => import('./pages/RadiologyPage'));
const PharmacyPage = lazy(() => import('./pages/PharmacyPage'));
const AmbulancePage = lazy(() => import('./pages/AmbulancePage'));
const AssetsPage = lazy(() => import('./pages/AssetsPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));

// بديل مؤقت بسيط أثناء تحميل حزمة الصفحة (شبكة بطيئة أو أول زيارة لصفحة لم
// تُحمَّل بعد) — يعيد استخدام .spinner الموجودة أصلاً بـindex.css (نفس
// المستخدَمة بزر الدخول بـLoginPage.js) بدل تصميم عنصر جديد.
function RouteLoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="spinner" />
    </div>
  );
}

function ProtectedRoute({ children, pageKey }) {
  const { user, hasPermission } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  if (pageKey && !hasPermission(pageKey)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useApp();
  // مؤشر مخصص + تأثير النبضة الضوئية عند النقر: يُفعَّلان مرة واحدة هنا
  // فيعملان تلقائياً في كل صفحات النظام الـ32 بلا أي ربط إضافي لكل صفحة.
  useRippleEffect();

  // حجب كامل التطبيق بشاشة إجبارية لو الحساب عليه علامة "يجب تغيير كلمة
  // المرور" (تُضبَط تلقائياً بعد إعادة ضبط كلمة مرور مؤقتة من الإدمن) — لا
  // يستطيع المستخدم تصفح أي صفحة أخرى قبل أن يغيّرها.
  if (user?.mustChangePassword) {
    return (
      <>
        <FuturisticCursor />
        <ToastContainer />
        <ConfirmDialog />
        <ForceChangePasswordScreen />
      </>
    );
  }

  return (
    <>
      <FuturisticCursor />
      <ToastContainer />
      <ConfirmDialog />
      <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        {/* Public, no login required — meant for a TV/monitor in a waiting area */}
        <Route path="/queue-display" element={<QueueDisplayPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          {/* Clinical */}
          <Route path="patients"           element={<ProtectedRoute pageKey="patients"><PatientsPage /></ProtectedRoute>} />
          <Route path="medical-codes"      element={<ProtectedRoute pageKey="medical-codes"><MedicalCodesPage /></ProtectedRoute>} />
          <Route path="doctors"            element={<ProtectedRoute pageKey="doctors"><DoctorsPage /></ProtectedRoute>} />
          <Route path="appointments"       element={<ProtectedRoute pageKey="appointments"><AppointmentsPage /></ProtectedRoute>} />
          <Route path="departments"        element={<ProtectedRoute pageKey="departments"><DepartmentsPage /></ProtectedRoute>} />
          <Route path="services"           element={<ProtectedRoute pageKey="services"><PersonalServicesPage /></ProtectedRoute>} />
          <Route path="ai-diagnosis"       element={<ProtectedRoute pageKey="ai-diagnosis"><AIDiagnosisPage /></ProtectedRoute>} />
          <Route path="crm"                element={<ProtectedRoute pageKey="crm"><CRMPage /></ProtectedRoute>} />
          <Route path="vaccinations"       element={<ProtectedRoute pageKey="vaccinations"><VaccinationsPage /></ProtectedRoute>} />
          <Route path="wards"              element={<ProtectedRoute pageKey="wards"><WardsPage /></ProtectedRoute>} />
          <Route path="delivery"           element={<ProtectedRoute pageKey="delivery"><DeliveryRoomPage /></ProtectedRoute>} />
          <Route path="physiotherapy"      element={<ProtectedRoute pageKey="physiotherapy"><PhysicalTherapyPage /></ProtectedRoute>} />
          <Route path="queue"              element={<ProtectedRoute pageKey="queue"><QueuePage /></ProtectedRoute>} />
          <Route path="drug-interactions"  element={<ProtectedRoute pageKey="drug-interactions"><DrugInteractionsPage /></ProtectedRoute>} />
          <Route path="dosage-check"       element={<ProtectedRoute pageKey="dosage-check"><DosageCheckPage /></ProtectedRoute>} />
          <Route path="allergy-check"      element={<ProtectedRoute pageKey="allergy-check"><AllergyCheckPage /></ProtectedRoute>} />
          <Route path="medical-leave"      element={<ProtectedRoute pageKey="medical-leave"><MedicalLeavePage /></ProtectedRoute>} />
          {/* Finance */}
          <Route path="accounts"           element={<ProtectedRoute pageKey="accounts"><AccountsPage /></ProtectedRoute>} />
          <Route path="inventory"          element={<ProtectedRoute pageKey="inventory"><InventoryPage /></ProtectedRoute>} />
          <Route path="payment-settings"   element={<ProtectedRoute pageKey="payment-settings"><PaymentSettingsPage /></ProtectedRoute>} />
          <Route path="billing"            element={<ProtectedRoute pageKey="billing"><BillingPage /></ProtectedRoute>} />
          <Route path="procurement"        element={<ProtectedRoute pageKey="procurement"><ProcurementPage /></ProtectedRoute>} />
          <Route path="billing-anomaly"    element={<ProtectedRoute pageKey="billing-anomaly"><BillingAnomalyPage /></ProtectedRoute>} />
          <Route path="inventory-prediction" element={<ProtectedRoute pageKey="inventory-prediction"><InventoryPredictionPage /></ProtectedRoute>} />
          {/* HR */}
          <Route path="hr"                 element={<ProtectedRoute pageKey="hr"><HRPage /></ProtectedRoute>} />
          {/* Projects */}
          <Route path="projects"           element={<ProtectedRoute pageKey="projects"><ProjectsPage /></ProtectedRoute>} />
          {/* Documents */}
          <Route path="documents"          element={<ProtectedRoute pageKey="documents"><DocumentsPage /></ProtectedRoute>} />
          <Route path="quality"            element={<ProtectedRoute pageKey="quality"><QualityPage /></ProtectedRoute>} />
          {/* Labs & Imaging */}
          <Route path="laboratory"         element={<ProtectedRoute pageKey="laboratory"><LaboratoryPage /></ProtectedRoute>} />
          <Route path="results"            element={<ProtectedRoute pageKey="results"><ResultsPage /></ProtectedRoute>} />
          <Route path="radiology"          element={<ProtectedRoute pageKey="radiology"><RadiologyPage /></ProtectedRoute>} />
          <Route path="pharmacy"           element={<ProtectedRoute pageKey="pharmacy"><PharmacyPage /></ProtectedRoute>} />
          {/* Operations */}
          <Route path="ambulance"          element={<ProtectedRoute pageKey="ambulance"><AmbulancePage /></ProtectedRoute>} />
          {/* Assets */}
          <Route path="assets"             element={<ProtectedRoute pageKey="assets"><AssetsPage /></ProtectedRoute>} />
          {/* Reports & Settings */}
          <Route path="smart-reports"      element={<ProtectedRoute pageKey="smart-reports"><SmartReportsPage /></ProtectedRoute>} />
          <Route path="settings"           element={<ProtectedRoute pageKey="settings"><SettingsPage /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
