import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute';
import { ROUTES } from './routePaths';
import { LoadingState } from '@/components/common/LoadingState';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const LiveMapPage = lazy(() => import('@/pages/live-map/LiveMapPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const SitesListPage = lazy(() => import('@/pages/sites/SitesListPage'));
const SiteDetailPage = lazy(() => import('@/pages/sites/SiteDetailPage'));
const WeatherObservationsPage = lazy(() => import('@/pages/weather/WeatherObservationsPage'));
const HistoricalDataPage = lazy(() => import('@/pages/historical/HistoricalDataPage'));
const ForecastPage = lazy(() => import('@/pages/forecast/ForecastPage'));
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'));
const AlertsPage = lazy(() => import('@/pages/alerts/AlertsPage'));
const ComparisonPage = lazy(() => import('@/pages/comparison/ComparisonPage'));
const HazardsPage = lazy(() => import('@/pages/hazards/HazardsPage'));
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingState label="Loading page..." />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path={ROUTES.login} element={<LoginPage />} />
            <Route path={ROUTES.register} element={<RegisterPage />} />
            <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path={ROUTES.liveMap} element={<LiveMapPage />} />
            <Route path={ROUTES.alerts} element={<AlertsPage />} />
            <Route path={ROUTES.reports} element={<ReportsPage />} />
            <Route path={ROUTES.comparison} element={<ComparisonPage />} />
            <Route path={ROUTES.hazards} element={<HazardsPage />} />
            <Route path={ROUTES.profile} element={<ProfilePage />} />

            {/* Legacy / secondary routes - not in the primary top nav, kept
                for reuse (e.g. SiteDetailPage opened from a map marker). */}
            <Route path={ROUTES.dashboard} element={<DashboardPage />} />
            <Route path={ROUTES.sites} element={<SitesListPage />} />
            <Route path="/sites/:siteId" element={<SiteDetailPage />} />
            <Route path={ROUTES.observations} element={<WeatherObservationsPage />} />
            <Route path={ROUTES.historical} element={<HistoricalDataPage />} />
            <Route path={ROUTES.forecast} element={<ForecastPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to={ROUTES.liveMap} replace />} />
        <Route path={ROUTES.notFound} element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to={ROUTES.notFound} replace />} />
      </Routes>
    </Suspense>
  );
}
