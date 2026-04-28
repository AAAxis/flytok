import './App.css';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Layout from '@/Layout';
import Landing from '@/pages/marketing/Landing';
import Privacy from '@/pages/marketing/Privacy';
import Terms from '@/pages/marketing/Terms';
import PublicFeed from '@/pages/marketing/Feed';
import PublicVideo from '@/pages/marketing/Video';
import Support from '@/pages/marketing/Support';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Users from '@/pages/Users';
import UserDetail from '@/pages/UserDetail';
import Videos from '@/pages/Videos';
import Reports from '@/pages/Reports';
import Analytics from '@/pages/Analytics';

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-8 h-8 border-2 border-zinc-700 border-t-sky-400 rounded-full animate-spin" />
    </div>
  );
}

function NotAuthorized() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6">
      <div className="max-w-sm text-center space-y-3">
        <div className="text-zinc-100 text-lg font-medium">Not authorized</div>
        <div className="text-zinc-400 text-sm">
          {user?.email} is signed in but does not have admin access.
        </div>
        <button
          onClick={logout}
          className="text-sm text-sky-400 hover:text-sky-300 underline-offset-4 hover:underline"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/admin" replace />;
  if (!isAdmin) return <NotAuthorized />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;

  return (
    <Routes>
      {/* Public marketing */}
      <Route path="/" element={<Landing />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/feed" element={<PublicFeed />} />
      <Route path="/v/:id" element={<PublicVideo />} />
      <Route path="/support" element={<Support />} />

      {/* Admin login */}
      <Route
        path="/admin"
        element={user ? <Navigate to="/admin/dashboard" replace /> : <Login />}
      />

      {/* Admin app */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <Users />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users/:uid"
        element={
          <ProtectedRoute>
            <UserDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/videos"
        element={
          <ProtectedRoute>
            <Videos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />

      {/* Legacy redirects for old admin URLs */}
      <Route path="/login" element={<Navigate to="/admin" replace />} />
      <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/users" element={<Navigate to="/admin/users" replace />} />
      <Route path="/videos" element={<Navigate to="/admin/videos" replace />} />
      <Route path="/reports" element={<Navigate to="/admin/reports" replace />} />
      <Route path="/analytics" element={<Navigate to="/admin/analytics" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
