import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import MedicalCodesPage from './pages/MedicalCodesPage';
import DoctorsPage from './pages/DoctorsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import DepartmentsPage from './pages/DepartmentsPage';
import PersonalServicesPage from './pages/PersonalServicesPage';
import AIDiagnosisPage from './pages/AIDiagnosisPage';
import CRMPage from './pages/CRMPage';
import PaymentSettingsPage from './pages/PaymentSettingsPage';
import BillingPage from './pages/BillingPage';
import VaccinationsPage from './pages/VaccinationsPage';
import WardsPage from './pages/WardsPage';
import DeliveryRoomPage from './pages/DeliveryRoomPage';
import PhysicalTherapyPage from './pages/PhysicalTherapyPage';
import QueuePage from './pages/QueuePage';
import QueueDisplayPage from './pages/QueueDisplayPage';
import DrugInteractionsPage from './pages/DrugInteractionsPage';
import DosageCheckPage from './pages/DosageCheckPage';
import AllergyCheckPage from './pages/AllergyCheckPage';
import MedicalLeavePage from './pages/MedicalLeavePage';
import SmartReportsPage from './pages/SmartReportsPage';
import HRPage from './pages/HRPage';
import AccountsPage from './pages/AccountsPage';
import SettingsPage from './pages/SettingsPage';
// ERP New Modules
import InventoryPage from './pages/InventoryPage';
import ProcurementPage from './pages/ProcurementPage';
import BillingAnomalyPage from './pages/BillingAnomalyPage';
import ProjectsPage from './pages/ProjectsPage';
import QualityPage from './pages/QualityPage';
import LaboratoryPage from './pages/LaboratoryPage';
import ResultsPage from './pages/ResultsPage';
import RadiologyPage from './pages/RadiologyPage';
import PharmacyPage from './pages/PharmacyPage';
import AmbulancePage from './pages/AmbulancePage';
import AssetsPage from './pages/AssetsPage';
import DocumentsPage from './pages/DocumentsPage';
import ToastContainer from './components/ToastContainer';
import ConfirmDialog from './components/ConfirmDialog';
import ForceChangePasswordScreen from './pages/ForceChangePasswordScreen';

function ProtectedRoute({ children, pageKey }) {
  const { user, hasPermission } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  if (pageKey && !hasPermission(pageKey)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useApp();

  // حجب كامل التطبيق بشاشة إجبارية لو الحساب عليه علامة "يجب تغيير كلمة
  // المرور" (تُضبَط تلقائياً بعد إعادة ضبط كلمة مرور مؤقتة من الإدمن) — لا
  // يستطيع المستخدم تصفح أي صفحة أخرى قبل أن يغيّرها.
  if (user?.mustChangePassword) {
    return (
      <>
        <ToastContainer />
        <ConfirmDialog />
        <ForceChangePasswordScreen />
      </>
    );
  }

  return (
    <>
      <ToastContainer />
      <ConfirmDialog />
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
