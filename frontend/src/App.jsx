import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientProfile from './pages/PatientProfile';
import Appointments from './pages/Appointments';
import Billing from './pages/Billing';
import Users from './pages/Users';
import Pharmacy from './pages/Pharmacy';
import Warehouse from './pages/Warehouse';
import Departments from './pages/Departments';
import Doctors from './pages/Doctors';
import DentalPharmacyStaff from './pages/DentalPharmacyStaff';
import Technicians from './pages/Technicians';
import AdminGeneralStaff from './pages/AdminGeneralStaff';
import Payroll from './pages/Payroll';
import Attendance from './pages/Attendance';
import Backups from './pages/Backups';
import KpiDashboard from './pages/KpiDashboard';
import StaffRosterHR from './pages/StaffRosterHR';
import StaffRosterFinance from './pages/StaffRosterFinance';
import Insurance from './pages/Insurance';
import ChartOfAccounts from './pages/ChartOfAccounts';
import JournalEntries from './pages/JournalEntries';
import FinancialStatements from './pages/FinancialStatements';
import StaffApprovals from './pages/StaffApprovals';
import AdminActivityCenter from './pages/AdminActivityCenter';
import InsuranceCompanies from './pages/InsuranceCompanies';
import InsuranceClaims from './pages/InsuranceClaims';
import InsurerPortalPage from './pages/InsurerPortalPage';
import AuditLogs from './pages/AuditLogs';
import NotificationsCenter from './pages/NotificationsCenter';
import Installments from './pages/Installments';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* بوابة شركة التأمين: صفحة عامة مستقلة، مصادقتها بمفتاح API لا بحساب مستخدم داخل النظام */}
      <Route path="/insurer-portal" element={<InsurerPortalPage />} />
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/patients" element={<PrivateRoute><Patients /></PrivateRoute>} />
      <Route path="/patients/:id" element={<PrivateRoute><PatientProfile /></PrivateRoute>} />
      <Route path="/appointments" element={<PrivateRoute><Appointments /></PrivateRoute>} />
      <Route path="/billing" element={<PrivateRoute><Billing /></PrivateRoute>} />
      <Route path="/pharmacy" element={<PrivateRoute><Pharmacy /></PrivateRoute>} />
      <Route path="/warehouse" element={<PrivateRoute><Warehouse /></PrivateRoute>} />
      <Route path="/departments" element={<PrivateRoute><Departments /></PrivateRoute>} />
      <Route path="/doctors" element={<PrivateRoute><Doctors /></PrivateRoute>} />
      <Route path="/dental-pharmacy-staff" element={<PrivateRoute><DentalPharmacyStaff /></PrivateRoute>} />
      <Route path="/technicians" element={<PrivateRoute><Technicians /></PrivateRoute>} />
      <Route path="/admin-general-staff" element={<PrivateRoute><AdminGeneralStaff /></PrivateRoute>} />
      <Route path="/payroll" element={<PrivateRoute><Payroll /></PrivateRoute>} />
      <Route path="/attendance" element={<PrivateRoute><Attendance /></PrivateRoute>} />
      <Route path="/backups" element={<PrivateRoute><Backups /></PrivateRoute>} />
      <Route path="/kpis" element={<PrivateRoute><KpiDashboard /></PrivateRoute>} />
      <Route path="/staff-roster" element={<PrivateRoute><StaffRosterHR /></PrivateRoute>} />
      <Route path="/staff-roster-financial" element={<PrivateRoute><StaffRosterFinance /></PrivateRoute>} />
      <Route path="/insurance" element={<PrivateRoute><Insurance /></PrivateRoute>} />
      <Route path="/chart-of-accounts" element={<PrivateRoute><ChartOfAccounts /></PrivateRoute>} />
      <Route path="/journal-entries" element={<PrivateRoute><JournalEntries /></PrivateRoute>} />
      <Route path="/financial-statements" element={<PrivateRoute><FinancialStatements /></PrivateRoute>} />
      <Route path="/staff-approvals" element={<PrivateRoute><StaffApprovals /></PrivateRoute>} />
      <Route path="/admin-activity" element={<PrivateRoute><AdminActivityCenter /></PrivateRoute>} />
      <Route path="/insurance-companies" element={<PrivateRoute><InsuranceCompanies /></PrivateRoute>} />
      <Route path="/insurance-claims" element={<PrivateRoute><InsuranceClaims /></PrivateRoute>} />
      <Route path="/audit-logs" element={<PrivateRoute><AuditLogs /></PrivateRoute>} />
      <Route path="/notifications-center" element={<PrivateRoute><NotificationsCenter /></PrivateRoute>} />
      <Route path="/installments" element={<PrivateRoute><Installments /></PrivateRoute>} />
      <Route path="/users" element={<PrivateRoute><Users /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
