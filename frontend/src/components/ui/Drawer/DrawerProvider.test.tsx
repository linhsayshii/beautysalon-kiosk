import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { DrawerProvider, useDrawer } from './DrawerProvider';
function Trigger() {
  const { openDrawer } = useDrawer();
  return <button onClick={() => openDrawer('Khách hàng', [])}>Mở</button>;
}
it('removes closed controls, focuses the dialog, traps Tab and restores focus on Escape', async () => {
  render(<DrawerProvider><Trigger /></DrawerProvider>);
  expect(screen.queryByRole('button', { name: 'Đóng chi tiết' })).not.toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: 'Mở' });
  trigger.focus();
  fireEvent.click(trigger);
  const close = screen.getByRole('button', { name: 'Đóng chi tiết' });
  await waitFor(() => expect(close).toHaveFocus());
  expect(screen.getByRole('dialog', { name: 'Khách hàng' })).toBeInTheDocument();
  fireEvent.keyDown(close, { key: 'Tab' });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).not.toBe('hidden');
});
