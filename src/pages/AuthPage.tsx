import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import { 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

interface AuthPageProps {
  initialMode?: 'login' | 'signup';
  onAuthSuccess: (user: any) => void;
  onBackToHome: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  onAuthSuccess,
  onBackToHome,
  onShowToast,
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'otp'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [demoOtpHint, setDemoOtpHint] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick helper to fill demo credentials
  const fillDemoAdmin = () => {
    setEmail('admin@stocksense.com');
    setPassword('admin123');
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login({ email: email.trim(), password });

      if (res.requireOtp) {
        setMode('otp');
        setDemoOtpHint(res.otpCode || null);
        onShowToast('info', 'Please enter your 6-digit email OTP verification code.');
        return;
      }

      if (res.token && res.user) {
        localStorage.setItem('stocksense_token', res.token);
        localStorage.setItem('stocksense_user', JSON.stringify(res.user));
        onShowToast('success', `Welcome back, ${res.user.name}!`);
        onAuthSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.signup({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      setDemoOtpHint(res.otpCode);
      setMode('otp');
      onShowToast('success', res.message || 'Account created! Enter your verification code.');
    } catch (err: any) {
      setError(err.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifyOtp({
        email: email.trim(),
        otp_code: otpCode.trim(),
      });

      localStorage.setItem('stocksense_token', res.token);
      localStorage.setItem('stocksense_user', JSON.stringify(res.user));
      onShowToast('success', res.message || 'Email verified! Welcome to StockSense.');
      onAuthSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.resendOtp(email.trim());
      setDemoOtpHint(res.otpCode);
      onShowToast('info', res.message || 'New OTP generated.');
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-root">
      <div className="ambient-glow glow-auth" />

      {/* Top Bar with Back Link */}
      <header className="auth-topbar">
        <button className="auth-back-btn" onClick={onBackToHome}>
          <ArrowLeft size={16} /> Return to Home
        </button>

        <div className="nav-brand" onClick={onBackToHome} style={{ cursor: 'pointer' }}>
          <div className="brand-mark">S</div>
          <span className="brand-name">StockSense</span>
        </div>
      </header>

      {/* Main Centered Card Container */}
      <div className="auth-card-container">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {/* Card Header */}
          <div className="auth-card-header">
            <h2>
              {mode === 'login' && 'Sign in to StockSense'}
              {mode === 'signup' && 'Create your account'}
              {mode === 'otp' && 'Verify your email'}
            </h2>
            <p>
              {mode === 'login' && 'Access real-time inventory, stock tracking, and moves.'}
              {mode === 'signup' && 'Get started with enterprise warehouse operations.'}
              {mode === 'otp' && `Enter the 6-digit verification code sent to ${email}`}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              className="form-alert error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Demo OTP Helper Banner */}
          {mode === 'otp' && demoOtpHint && (
            <div className="demo-otp-banner">
              <KeyRound size={16} className="text-purple" />
              <div>
                <strong>Local Dev OTP Code:</strong> <span className="otp-digit-pill">{demoOtpHint}</span>
                <p>Auto-generated from PostgreSQL users table.</p>
              </div>
            </div>
          )}

          {/* Form Switcher */}
          <AnimatePresence mode="wait">
            {mode === 'login' && (
              <motion.form
                key="login-form"
                onSubmit={handleLogin}
                className="auth-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="form-group">
                  <label>Email Address</label>
                  <div className="input-with-icon">
                    <Mail size={16} className="input-icon" />
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div className="label-with-action">
                    <label>Password</label>
                    <button
                      type="button"
                      className="text-link-btn"
                      onClick={fillDemoAdmin}
                      title="Fill with default administrator credentials"
                    >
                      Fill Demo Admin
                    </button>
                  </div>
                  <div className="input-with-icon">
                    <Lock size={16} className="input-icon" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" className="primary-btn auth-submit-btn" disabled={loading}>
                  {loading ? 'Authenticating...' : 'Sign In'} <ArrowRight size={16} />
                </button>

                <div className="auth-switch-prompt">
                  <span>Don't have an account?</span>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setError(null);
                      setMode('signup');
                    }}
                  >
                    Create account
                  </button>
                </div>
              </motion.form>
            )}

            {mode === 'signup' && (
              <motion.form
                key="signup-form"
                onSubmit={handleSignup}
                className="auth-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="form-group">
                  <label>Full Name</label>
                  <div className="input-with-icon">
                    <User size={16} className="input-icon" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Morgan"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Work Email</label>
                  <div className="input-with-icon">
                    <Mail size={16} className="input-icon" />
                    <input
                      type="email"
                      required
                      placeholder="alex@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Password (min. 6 characters)</label>
                  <div className="input-with-icon">
                    <Lock size={16} className="input-icon" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" className="primary-btn auth-submit-btn" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Continue to Verification'} <ArrowRight size={16} />
                </button>

                <div className="auth-switch-prompt">
                  <span>Already have an account?</span>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setError(null);
                      setMode('login');
                    }}
                  >
                    Sign in
                  </button>
                </div>
              </motion.form>
            )}

            {mode === 'otp' && (
              <motion.form
                key="otp-form"
                onSubmit={handleVerifyOtp}
                className="auth-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="form-group">
                  <label>6-Digit Verification Code</label>
                  <div className="input-with-icon">
                    <KeyRound size={16} className="input-icon" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="123456"
                      className="otp-input-field"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>

                <button type="submit" className="primary-btn auth-submit-btn" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify Code & Launch'} <ShieldCheck size={16} />
                </button>

                <div className="otp-actions-row">
                  <button
                    type="button"
                    className="text-link-btn"
                    onClick={handleResendOtp}
                    disabled={loading}
                  >
                    <RefreshCw size={13} /> Resend verification code
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setMode('login')}
                  >
                    Back to login
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};
