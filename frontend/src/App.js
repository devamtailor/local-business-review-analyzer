import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Businesses from './pages/Businesses';
import Reviews from './pages/Reviews';
import { House, Buildings, ChatText, SignOut, List, X } from '@phosphor-icons/react';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="loader w-8 h-8"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  
  const navItems = [
    { path: '/dashboard', icon: House, label: 'Dashboard' },
    { path: '/businesses', icon: Buildings, label: 'Businesses' },
    { path: '/reviews', icon: ChatText, label: 'Reviews' },
  ];
  
  const handleLogout = async () => {
    await logout();
  };
  
  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden bg-white/90 backdrop-blur-xl border-b border-secondary sticky top-0 z-50 px-4 py-3 flex items-center justify-between">
        <h1 className="font-heading text-xl font-black tracking-tighter">
          REVIEW<span className="text-accent">.</span>AI
        </h1>
        <button 
          data-testid="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2"
        >
          {mobileMenuOpen ? <X weight="bold" size={24} /> : <List weight="bold" size={24} />}
        </button>
      </div>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-14 bg-white z-40 p-6">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 font-body font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary text-white'
                    : 'hover:bg-secondary'
                }`}
              >
                <item.icon weight="duotone" size={20} />
                {item.label}
              </Link>
            ))}
            <button
              data-testid="mobile-logout-button"
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 font-body font-medium text-accent hover:bg-accent/10 transition-colors w-full"
            >
              <SignOut weight="duotone" size={20} />
              Sign Out
            </button>
          </nav>
        </div>
      )}
      
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-col bg-white border-r border-secondary h-screen w-64 fixed left-0 top-0">
        <div className="p-6 border-b border-secondary">
          <h1 className="font-heading text-2xl font-black tracking-tighter">
            REVIEW<span className="text-accent">.</span>AI
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={`flex items-center gap-3 px-4 py-3 font-body font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-primary text-white'
                  : 'hover:bg-secondary'
              }`}
            >
              <item.icon weight="duotone" size={20} />
              {item.label}
            </Link>
          ))}
        </nav>
        
        <div className="p-4 border-t border-secondary">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="w-8 h-8 bg-primary flex items-center justify-center text-white font-bold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body font-medium truncate">{user?.name}</p>
              <p className="font-body text-xs text-text-muted truncate">{user?.email}</p>
            </div>
          </div>
          <button
            data-testid="logout-button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 font-body font-medium text-accent hover:bg-accent/10 transition-colors w-full"
          >
            <SignOut weight="duotone" size={20} />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ml-64">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/businesses"
            element={
              <ProtectedRoute>
                <Layout>
                  <Businesses />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reviews"
            element={
              <ProtectedRoute>
                <Layout>
                  <Reviews />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
