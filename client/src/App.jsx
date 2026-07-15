import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Loads from './pages/Loads.jsx';
import NewLoad from './pages/NewLoad.jsx';
import LoadDetail from './pages/LoadDetail.jsx';
import RolesStaff from './pages/RolesStaff.jsx';
import Compliance from './pages/Compliance.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/loads" element={<Protected><Loads /></Protected>} />
      <Route path="/loads/new" element={<Protected><NewLoad /></Protected>} />
      <Route path="/loads/:id" element={<Protected><LoadDetail /></Protected>} />
      <Route path="/roles" element={<Protected><RolesStaff /></Protected>} />
      <Route path="/compliance" element={<Protected><Compliance /></Protected>} />
      <Route path="*" element={<Navigate to="/loads" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
