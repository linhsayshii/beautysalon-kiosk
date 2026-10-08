import { useEffect, useState } from 'react';

/** Keep a closing popover mounted for its 100ms exit transition. */
export function usePopoverPresence(open: boolean) {
  const [present, setPresent] = useState(open);
  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    if (!present) return;
    const timer = window.setTimeout(() => setPresent(false), 100);
    return () => window.clearTimeout(timer);
  }, [open, present]);
  return open || present;
}
