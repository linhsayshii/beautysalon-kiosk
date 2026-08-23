import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

interface FloatingLayerProps {
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className: string;
  align?: 'left' | 'right';
  gap?: number;
  matchAnchorWidth?: boolean;
  layerRef?: RefObject<HTMLDivElement | null>;
  role?: 'menu' | 'dialog' | 'listbox' | 'presentation';
  'aria-label'?: string;
}

interface FloatingLayout {
  bottom?: number;
  left: number;
  maxHeight: number;
  minWidth?: number;
  top?: number;
}

const VIEWPORT_MARGIN = 8;

export function FloatingLayer({
  anchorRef,
  children,
  className,
  align = 'left',
  gap = 6,
  matchAnchorWidth = false,
  layerRef,
  role,
  'aria-label': ariaLabel,
}: FloatingLayerProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<FloatingLayout | null>(null);

  const updateLayout = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const layer = internalRef.current;
    const width = layer?.offsetWidth ?? rect.width;
    const height = layer?.offsetHeight ?? 320;
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportBottom = viewportTop + viewportHeight;
    const spaceBelow = Math.max(0, viewportBottom - rect.bottom - gap - VIEWPORT_MARGIN);
    const spaceAbove = Math.max(0, rect.top - viewportTop - gap - VIEWPORT_MARGIN);
    const placeAbove = spaceBelow < height && spaceAbove > spaceBelow;
    const preferredLeft = align === 'right' ? rect.right - width : rect.left;
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, preferredLeft),
      Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
    );

    setLayout({
      left,
      maxHeight: Math.max(80, placeAbove ? spaceAbove : spaceBelow),
      minWidth: matchAnchorWidth ? rect.width : undefined,
      ...(placeAbove
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    });
  }, [align, anchorRef, gap, matchAnchorWidth]);

  useLayoutEffect(() => {
    updateLayout();
  }, [updateLayout]);

  useEffect(() => {
    const update = () => updateLayout();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [updateLayout]);

  const setRefs = (node: HTMLDivElement | null) => {
    internalRef.current = node;
    if (layerRef) layerRef.current = node;
  };

  return createPortal(
    <div
      ref={setRefs}
      className={className}
      role={role}
      aria-label={ariaLabel}
      style={{
        bottom: layout?.bottom ?? 'auto',
        left: layout?.left ?? VIEWPORT_MARGIN,
        maxHeight: layout?.maxHeight,
        minWidth: layout?.minWidth,
        overflowY: 'auto',
        position: 'fixed',
        right: 'auto',
        top: layout?.top ?? 'auto',
        visibility: layout ? 'visible' : 'hidden',
        zIndex: 10000,
      } as CSSProperties}
    >
      {children}
    </div>,
    document.body,
  );
}
