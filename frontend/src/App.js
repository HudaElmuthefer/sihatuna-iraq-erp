import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import DoctorsPage from './pages/DoctorsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import DepartmentsPage from './pages/DepartmentsPage';
import PersonalServicesPage from './pages/PersonalServicesPage';
import AIDiagnosisPage from './pages/AIDiagnosisPage';
import CRMPage from './pages/CRMPage';
import PaymentSettingsPage from './pages/PaymentSettingsPage';
import BillingPage from './pages/BillingPage';
import VaccinationsPage from './pages/VaccinationsPage';
import DrugInteractionsPage from './pages/DrugInteractionsPage';
import MedicalLeavePage from './pages/MedicalLeavePage';
import SmartReportsPage from './pages/SmartReportsPage';
import HRPage from './pages/HRPage';
import AccountsPage from './pages/AccountsPage';
import SettingsPage from './pages/SettingsPage';
// ERP New Modules
import InventoryPage from './pages/InventoryPage';
import ProcurementPage from './pages/ProcurementPage';
import ProjectsPage from './pages/ProjectsPage';
import QualityPage from './pages/QualityPage';
import LaboratoryPage from './pages/LaboratoryPage';
import RadiologyPage from './pages/RadiologyPage';
import PharmacyPage from './pages/PharmacyPage';
import AmbulancePage from './pages/AmbulancePage';
import AssetsPage from './pages/AssetsPage';
import ToastContainer from './components/ToastContainer';

function ProtectedRoute({ children, pageKey }) {
  const { user, hasPermission } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  if (pageKey && !hasPermission(pageKey)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useApp();
  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          {/* Clinical */}
          <Route path="patients"           element={<ProtectedRoute pageKey="patients"><PatientsPage /></ProtectedRoute>} />
          <Route path="doctors"            element={<ProtectedRoute pageKey="doctors"><DoctorsPage /></ProtectedRoute>} />
          <Route path="appointments"       element={<ProtectedRoute pageKey="appointments"><AppointmentsPage /></ProtectedRoute>} />
          <Route path="departments"        element={<ProtectedRoute pageKey="departments"><DepartmentsPage /></ProtectedRoute>} />
          <Route path="services"           element={<ProtectedRoute pageKey="services"><PersonalServicesPage /></ProtectedRoute>} />
          <Route path="ai-diagnosis"       element={<ProtectedRoute pageKey="ai-diagnosis"><AIDiagnosisPage /></ProtectedRoute>} />
          <Route path="crm"                element={<ProtectedRoute pageKey="crm"><CRMPage /></ProtectedRoute>} />
          <Route path="vaccinations"       element={<ProtectedRoute pageKey="vaccinations"><VaccinationsPage /></ProtectedRoute>} />
          <Route path="drug-interactions"  element={<ProtectedRoute pageKey="drug-interactions"><DrugInteractionsPage /></ProtectedRoute>} />
          <Route path="medical-leave"      element={<ProtectedRoute pageKey="medical-leave"><MedicalLeavePage /></ProtectedRoute>} />
          {/* Finance */}
          <Route path="accounts"           element={<ProtectedRoute pageKey="accounts"><AccountsPage /></ProtectedRoute>} />
          <Route path="inventory"          element={<ProtectedRoute pageKey="inventory"><InventoryPage /></ProtectedRoute>} />
          <Route path="payment-settings"   element={<ProtectedRoute pageKey="payment-settings"><PaymentSettingsPage /></ProtectedRoute>} />
          <Route path="billing"            element={<ProtectedRoute pageKey="billing"><BillingPage /></ProtectedRoute>} />
          <Route path="procurement"        element={<ProtectedRoute pageKey="procurement"><ProcurementPage /></ProtectedRoute>} />
          {/* HR */}
          <Route path="hr"                 element={<ProtectedRoute pageKey="hr"><HRPage /></ProtectedRoute>} />
          {/* Projects */}
          <Route path="projects"           element={<ProtectedRoute pageKey="projects"><ProjectsPage /></ProtectedRoute>} />
          {/* Documents */}
          <Route path="quality"            element={<ProtectedRoute pageKey="quality"><QualityPage /></ProtectedRoute>} />
          {/* Labs & Imaging */}
          <Route path="laboratory"         element={<ProtectedRoute pageKey="laboratory"><LaboratoryPage /></ProtectedRoute>} />
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
