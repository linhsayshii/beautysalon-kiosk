import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

export interface DrawerSection { title: string; rows: Array<[string, string]> }
interface DrawerState { title: string; sections: DrawerSection[] }
interface DrawerContextValue { openDrawer: (title: string, sections: DrawerSection[]) => void; closeDrawer: () => void }

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerProvider({ children }: PropsWithChildren) {
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const openDrawer = useCallback((title: string, sections: DrawerSection[]) => setDrawer({ title, sections }), []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeDrawer]);
  const value = useMemo(() => ({ openDrawer, closeDrawer }), [openDrawer, closeDrawer]);

  return (
    <DrawerContext.Provider value={value}>
      {children}
      <div className={`drawer-backdrop ${drawer ? 'is-open' : ''}`} hidden={!drawer} onClick={closeDrawer} />
      <aside className={`detail-drawer ${drawer ? 'is-open' : ''}`} aria-hidden={!drawer} aria-label="Chi tiết bản ghi">
        <div className="drawer-header">
          <div><small>Chi tiết</small><h2>{drawer?.title ?? 'Thông tin'}</h2></div>
          <button className="drawer-close" type="button" onClick={closeDrawer} aria-label="Đóng chi tiết"><i className="ph ph-x" /></button>
        </div>
        <div className="drawer-body">
          {drawer?.sections.map((section) => (
            <section className="drawer-section" key={section.title}>
              <h3>{section.title}</h3>
              {section.rows.map(([label, value]) => <div className="detail-pair" key={label}><span>{label}</span><strong>{value}</strong></div>)}
            </section>
          ))}
        </div>
      </aside>
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) throw new Error('useDrawer must be used inside DrawerProvider');
  return context;
}
