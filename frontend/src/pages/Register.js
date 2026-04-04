import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { EnvelopeSimple, Lock, User, ArrowRight } from '@phosphor-icons/react';

function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, name);
      navigate('/dashboard');
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-surface border-2 border-primary p-8 shadow-[8px_8px_0_0_#111111]">
          <h1 className="font-heading text-4xl font-black tracking-tighter mb-2">
            REVIEW<span className="text-accent">.</span>AI
          </h1>
          <p className="text-text-muted font-body text-sm mb-8">Create your account</p>
          
          {error && (
            <div data-testid="register-error" className="bg-accent/10 border-2 border-accent text-accent px-4 py-3 mb-6 font-body text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-body text-xs font-bold uppercase tracking-[0.2em] text-text-muted block mb-2">
                Name
              </label>
              <div className="relative">
                <User weight="duotone" className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                <input
                  data-testid="register-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border border-secondary rounded-none px-4 py-2.5 pl-12 w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-primary bg-white transition-all duration-200 font-body"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="font-body text-xs font-bold uppercase tracking-[0.2em] text-text-muted block mb-2">
                Email
              </label>
              <div className="relative">
                <EnvelopeSimple weight="duotone" className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                <input
                  data-testid="register-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border border-secondary rounded-none px-4 py-2.5 pl-12 w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-primary bg-white transition-all duration-200 font-body"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="font-body text-xs font-bold uppercase tracking-[0.2em] text-text-muted block mb-2">
                Password
              </label>
              <div className="relative">
                <Lock weight="duotone" className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                <input
                  data-testid="register-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border border-secondary rounded-none px-4 py-2.5 pl-12 w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-primary bg-white transition-all duration-200 font-body"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>
            
            <button
              data-testid="register-submit-button"
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white px-6 py-3 font-bold tracking-wide rounded-none border-2 border-primary hover:bg-white hover:text-primary transition-all duration-200 flex items-center justify-center gap-2 mt-6"
            >
              {loading ? <span className="loader"></span> : (
                <>
                  Create Account
                  <ArrowRight weight="bold" size={20} />
                </>
              )}
            </button>
          </form>
          
          <p className="mt-6 text-center font-body text-sm text-text-muted">
            Already have an account?{' '}
            <Link to="/login" data-testid="login-link" className="text-primary font-bold hover:text-accent transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
