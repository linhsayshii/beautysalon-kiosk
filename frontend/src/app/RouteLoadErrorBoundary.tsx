import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

const AUTO_RELOAD_KEY = 'annachill:route-load-recovery';
const AUTO_RELOAD_COOLDOWN_MS = 30_000;

function errorText(error: unknown) {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText} ${error.data ?? ''}`;
  return String(error ?? '');
}

function isDynamicImportFailure(error: unknown) {
  return /failed to fetch dynamically imported module|importing a module script failed|loading chunk .* failed/i.test(errorText(error));
}

/** Reloads once after a deploy changes Vite's hashed lazy-route files. */
export function RouteLoadErrorBoundary() {
  const error = useRouteError();
  const failedToLoadRoute = isDynamicImportFailure(error);

  useEffect(() => {
    if (!failedToLoadRoute) return;

    const lastAttempt = Number(window.sessionStorage.getItem(AUTO_RELOAD_KEY) ?? 0);
    if (Date.now() - lastAttempt < AUTO_RELOAD_COOLDOWN_MS) return;

    window.sessionStorage.setItem(AUTO_RELOAD_KEY, String(Date.now()));
    window.location.reload();
  }, [failedToLoadRoute]);

  return (
    <main className="route-load-error" role="alert">
      <section>
        <i className="ph ph-arrows-clockwise" aria-hidden="true" />
        <h1>{failedToLoadRoute ? 'Đang cập nhật phiên bản mới' : 'Không thể mở trang này'}</h1>
        <p>
          {failedToLoadRoute
            ? 'Ứng dụng đang tải lại để dùng đúng phiên bản mới nhất.'
            : 'Vui lòng tải lại trang. Nếu lỗi vẫn tiếp diễn, hãy liên hệ quản trị viên.'}
        </p>
        <button type="button" onClick={() => window.location.reload()}>Tải lại</button>
      </section>
    </main>
  );
}
