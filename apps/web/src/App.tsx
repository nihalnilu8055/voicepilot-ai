import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';

// Public Pages
import { HomePage } from './pages/HomePage';
import { StatusPage } from './pages/StatusPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';

// Tenant & Dashboard Pages
import { CompanySetupPage } from './pages/tenant/CompanySetupPage';
import { CompanySelectionPage } from './pages/tenant/CompanySelectionPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';

// Phase 3 Pages: Leads & Campaigns
import { LeadsListPage } from './pages/leads/LeadsListPage';
import { LeadDetailsPage } from './pages/leads/LeadDetailsPage';
import { CampaignsListPage } from './pages/campaigns/CampaignsListPage';
import { CampaignCreatePage } from './pages/campaigns/CampaignCreatePage';
import { CampaignDetailsPage } from './pages/campaigns/CampaignDetailsPage';

// Phase 4 Page: AI Voice Studio
import { VoiceStudioPage } from './pages/voice/VoiceStudioPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
          <Header />
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/status" element={<StatusPage />} />

              {/* Authentication Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />

              {/* Protected Multi-Tenant Routes */}
              <Route
                path="/company-setup"
                element={
                  <ProtectedRoute requireCompany={false}>
                    <CompanySetupPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/companies"
                element={
                  <ProtectedRoute requireCompany={false}>
                    <CompanySelectionPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute requireCompany={true}>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Phase 3: Lead Management Routes */}
              <Route
                path="/leads"
                element={
                  <ProtectedRoute requireCompany={true}>
                    <LeadsListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leads/:id"
                element={
                  <ProtectedRoute requireCompany={true}>
                    <LeadDetailsPage />
                  </ProtectedRoute>
                }
              />

              {/* Phase 3: Campaign Management Routes */}
              <Route
                path="/campaigns"
                element={
                  <ProtectedRoute requireCompany={true}>
                    <CampaignsListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/new"
                element={
                  <ProtectedRoute requireCompany={true}>
                    <CampaignCreatePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/:id"
                element={
                  <ProtectedRoute requireCompany={true}>
                    <CampaignDetailsPage />
                  </ProtectedRoute>
                }
              />

              {/* Phase 4: Voice Studio Route */}
              <Route
                path="/voice-studio"
                element={
                  <ProtectedRoute requireCompany={true}>
                    <VoiceStudioPage />
                  </ProtectedRoute>
                }
              />

              {/* 404 Catch-All */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
