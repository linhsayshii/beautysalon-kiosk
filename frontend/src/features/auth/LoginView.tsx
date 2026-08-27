import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { errorMessage } from '@/services/api-client';
import { useMetadata } from '@/services/metadata';
import { homeForRole, useAuth } from './AuthProvider';

export function LoginView() {
  const { account, loading, login } = useAuth();
  const { data: metadata } = useMetadata();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (loading) return <AuthLoading />;
  if (account) return <Navigate to={homeForRole(account.role)} replace />;

  const storeName = metadata?.data?.system?.storeName || 'Anna Chill Beauty';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true); setError('');
    try {
      const signedIn = await login(username.trim(), password);
      navigate(homeForRole(signedIn.role), { replace: true });
    } catch (cause) {
      setError(errorMessage(cause, 'Không thể đăng nhập lúc này'));
    } finally { setSubmitting(false); }
  };

  return <main className="login-page">
    <div className="login-shell">
      <div className="login-mobile-brand"><span className="brand-mark" aria-hidden="true"><span /><span /></span><span>{storeName}</span></div>
      <aside className="login-visual">
        <div className="login-brand"><span className="brand-mark" aria-hidden="true"><span /><span /></span><span>{storeName}</span></div>
        <div className="login-visual-copy"><span>Hệ thống quản lý</span><h2>{storeName}</h2><p>Đăng nhập vào tài khoản của bạn</p></div>
      </aside>
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-heading"><h1 id="login-title">Đăng nhập hệ thống</h1><p>Đăng nhập vào tài khoản của bạn</p></div>
        <form onSubmit={submit}>
          <label className="auth-field"><span>Tên đăng nhập</span><div><input autoFocus autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Nhập tên đăng nhập" /></div></label>
          <label className="auth-field"><span>Mật khẩu</span><div><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhập mật khẩu" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}><i className={`ph ${showPassword ? 'ph-eye-slash' : 'ph-eye'}`} /></button></div></label>
        {error && <div className="auth-error" role="alert"><i className="ph ph-warning-circle" />{error}</div>}
          <button className="login-submit" type="submit" disabled={submitting || !username.trim() || !password}>{submitting ? <><i className="ph ph-circle-notch spin" />Đang đăng nhập</> : <><i className="ph ph-sign-in" />Đăng nhập</>}</button>
        </form>
      </section>
    </div>
  </main>;
}

export function AuthLoading() {
  return <main className="auth-loading"><span className="brand-mark" aria-hidden="true"><span /><span /></span><p>Đang kiểm tra phiên đăng nhập…</p></main>;
}
