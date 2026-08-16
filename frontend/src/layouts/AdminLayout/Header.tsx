import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { navigation } from './navigation.config';
import { homeForRole, useAuth } from '@/features/auth/AuthProvider';
import { useMetadata } from '@/services/metadata';

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const { account, logout } = useAuth();
  const { data: metadata } = useMetadata();
  const storeName = metadata?.data?.system?.storeName || 'AnnaChill Beauty';

  useEffect(() => { setMobileOpen(false); setOpenMenu(null); setAccountOpen(false); }, [location.pathname]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!headerRef.current?.contains(event.target as Node)) { setOpenMenu(null); setAccountOpen(false); } };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const activeSection = location.pathname.startsWith('/staff') ? 'staff'
    : location.pathname.startsWith('/customer') ? 'customers'
      : location.pathname === '/orders' ? 'orders'
        : ['/products', '/pricebooks'].includes(location.pathname) || location.pathname.startsWith('/purchase-orders') ? 'products'
          : 'dashboard';

  return (
    <header className="topbar" ref={headerRef}>
      <Link className="brand" to={account ? homeForRole(account.role) : '/login'} aria-label={`${storeName} - Trang chính`}>
        <span className="brand-mark" aria-hidden="true"><span /><span /></span><span className="brand-name">{storeName}</span>
      </Link>
      {account?.role === 'manager' && <button className="mobile-menu-button icon-button" type="button" aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={mobileOpen} onClick={() => setMobileOpen((value) => !value)}>
        <i className={`ph ${mobileOpen ? 'ph-x' : 'ph-list'}`} />
      </button>}
      {account?.role === 'manager' && <nav className={`main-nav ${mobileOpen ? 'is-open' : ''}`} aria-label="Điều hướng chính">
        {navigation.map((group) => group.to ? (
          <NavLink key={group.key} className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`} to={group.to}>{group.label}</NavLink>
        ) : (
          <div className={`nav-menu ${openMenu === group.key ? 'is-open' : ''}`} key={group.key}>
            <button className={`nav-link nav-trigger ${activeSection === group.key ? 'is-active' : ''}`} type="button" aria-expanded={openMenu === group.key} onClick={(event) => { event.stopPropagation(); setOpenMenu((value) => value === group.key ? null : group.key); }}>
              {group.label} <i className="ph ph-caret-down" />
            </button>
            <div className={`product-menu subnav-menu ${group.items && group.items.length < 4 ? 'compact-menu' : ''} ${group.key === 'staff' ? 'staff-menu' : ''}`} role="menu">
              <div className="menu-group">
                {group.items?.map((item) => item.to ? (
                  <Link className="menu-item" to={item.to} role="menuitem" key={item.label}><span className={`menu-icon ${item.tone}`}><i className={`ph ${item.icon}`} /></span><span>{item.label}</span></Link>
                ) : null)}
              </div>
            </div>
          </div>
        ))}
      </nav>}
      <div className="top-actions">
        {account?.role === 'manager' && <NavLink className={({ isActive }) => `action-pill attendance-qr-button ${isActive ? 'is-active' : ''}`} to="/attendance/qr" aria-label="Mở QR chấm công">
          <i className="ph ph-qr-code" aria-hidden="true" /><span>QR chấm công</span>
        </NavLink>}
        {(account?.role === 'manager' || account?.role === 'cashier') && <NavLink className={({ isActive }) => `action-pill cashier-button ${isActive ? 'is-active' : ''}`} to="/pos" aria-label="Mở trang thu ngân">
          <i className="ph ph-shopping-cart-simple" aria-hidden="true" />
          <span>Thu ngân</span>
        </NavLink>}
        <div className={`account-menu ${accountOpen ? 'is-open' : ''}`}>
          <button className="account-trigger" type="button" aria-expanded={accountOpen} onClick={() => setAccountOpen((value) => !value)}><span>{account?.displayName?.charAt(0).toUpperCase()}</span><i className="ph ph-caret-down" /></button>
          <div className="account-popover"><div><strong>{account?.displayName}</strong><span>{account?.role === 'manager' ? 'Quản lý' : account?.role === 'cashier' ? 'Thu ngân' : 'Nhân viên'} · {account?.branchName}</span></div><Link to="/account/settings"><i className="ph ph-gear-six" />Cài đặt tài khoản</Link><button type="button" onClick={() => logout()}><i className="ph ph-sign-out" />Đăng xuất</button></div>
        </div>
      </div>
    </header>
  );
}
