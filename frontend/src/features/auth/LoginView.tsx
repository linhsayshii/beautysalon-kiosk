import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { errorMessage } from '@/services/api-client';
import { homeForRole, useAuth } from './AuthProvider';

export function LoginView() {
  const { account, loading, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (loading) return <AuthLoading />;
  if (account) return <Navigate to={homeForRole(account.role)} replace />;

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
    <section className="login-card">
      <div className="login-brand"><span className="brand-mark" aria-hidden="true"><span /><span /></span><span>Beauty Salon</span></div>
      <div className="login-heading"><span className="eyebrow">SALON MANAGEMENT</span><h1>Đăng nhập tài khoản</h1><p>Hệ thống sẽ tự mở đúng khu vực làm việc theo quyền của bạn.</p></div>
      <form onSubmit={submit}>
        <label className="auth-field"><span>Tên đăng nhập</span><div><i className="ph ph-user" /><input autoFocus autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Nhập tên đăng nhập" /></div></label>
        <label className="auth-field"><span>Mật khẩu</span><div><i className="ph ph-lock-key" /><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhập mật khẩu" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}><i className={`ph ${showPassword ? 'ph-eye-slash' : 'ph-eye'}`} /></button></div></label>
        {error && <div className="auth-error" role="alert"><i className="ph ph-warning-circle" />{error}</div>}
        <button className="login-submit" type="submit" disabled={submitting || !username.trim() || !password}>{submitting ? <><i className="ph ph-circle-notch spin" />Đang đăng nhập</> : <>Đăng nhập<i className="ph ph-arrow-right" /></>}</button>
      </form>
      <p className="login-footnote"><i className="ph ph-shield-check" /> Phiên đăng nhập được bảo vệ trên thiết bị này.</p>
    </section>
    <aside className="login-visual"><div className="login-orb"><i className="ph ph-sparkle" /></div><div><span>VẬN HÀNH GỌN GÀNG</span><h2>Mỗi vai trò,<br />đúng công việc.</h2><p>Quản lý toàn hệ thống, thu ngân tập trung bán hàng, nhân viên chấm công an toàn tại chi nhánh.</p></div></aside>
  </main>;
}

export function AuthLoading() {
  return <main className="auth-loading"><span className="brand-mark" aria-hidden="true"><span /><span /></span><p>Đang kiểm tra phiên đăng nhập…</p></main>;
}
