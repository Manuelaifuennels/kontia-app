import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ToastProvider } from "./components/ui/Toast";
import Login from "./pages/Login";
import AppLayout from "./components/layout/AppLayout";

function AppContent() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Login />;
  return <AppLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
