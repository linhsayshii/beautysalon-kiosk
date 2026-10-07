import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { challengeRefetchInterval, getAttendanceChallenge, getAttendanceLocation } from '@/features/attendance/attendance.api';
import { Link } from 'react-router-dom';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { useStoreName } from '@/services/metadata';
import { resolveHexToken } from '@/lib/color-token';

export function MobileAttendanceQrAdminView() {
  const storeName = useStoreName();
  const [qrImage, setQrImage] = useState('');
  const [qrError, setQrError] = useState<Error | null>(null);
  const [retryGeneration, setRetryGeneration] = useState(0);
  const [now, setNow] = useState(Date.now());

  const challenge = useQuery({
    queryKey: ['attendance-challenge'],
    queryFn: getAttendanceChallenge,
    refetchInterval: challengeRefetchInterval,
  });

  const location = useQuery({
    queryKey: ['attendance-location'],
    queryFn: getAttendanceLocation,
  });

  const secondsLeft = challenge.data
    ? Math.max(
        0,
        Math.ceil((new Date(challenge.data.data.expiresAt).getTime() - now) / 1000)
      )
    : 0;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = challenge.data?.data.token;
    if (!token) return;
    let active = true;
    setQrImage('');
    setQrError(null);
    QRCode.toDataURL(token, {
      width: 420,
      margin: 2,
      // qrcode renders to a canvas and only accepts literal hex colors. CSS
      // variables are not resolved here, which previously left this view in
      // its loading state after the promise rejected.
      color: { dark: resolveHexToken('--ink-950', '#000000'), light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(image => { if (active) setQrImage(image); }).catch(error => { if (active) setQrError(error); });
    return () => { active = false; };
  }, [challenge.data?.data.token, retryGeneration]);

  const branchData = location.data?.data;
  const hasGps = branchData?.latitude != null && branchData?.longitude != null;

  return (
    <div className="m-page">
      <MobilePageHeader
        title="Mã QR Chấm công"
        backTo="/m/more"
      />

      {/* Main Inset Screen Card */}
      <div className="mobile-qr-screen-card">
        <div className="mobile-qr-status-pill">
          <span className="live-dot" />
          <span>{challenge.error || qrError ? 'KHÔNG THỂ TẢI MÃ' : secondsLeft > 0 && hasGps ? `MÃ ĐANG HOẠT ĐỘNG (${secondsLeft}s)` : !hasGps ? 'CHƯA THIẾT LẬP GPS' : 'ĐANG ĐỔI MÃ'}</span>
        </div>

        {/* Large QR Display */}
        <div className="mobile-qr-image-wrapper">
          {challenge.error || qrError ? <ErrorState compact error={(challenge.error || qrError)!} onRetry={() => { setRetryGeneration(value => value + 1); challenge.refetch(); }} /> : qrImage && secondsLeft > 0 && hasGps ? (
            <img src={qrImage} alt="Mã QR chấm công cửa hàng" />
          ) : (
            !location.isPending && !hasGps ? <p className="field-hint">Cần tọa độ chi nhánh để sử dụng mã chấm công.</p> : <LoadingState compact label="Đang tạo mã QR..." />
          )}
        </div>

        {/* Instructions */}
        <div className="mobile-qr-instructions">
          Mã QR bảo mật tự động đổi mỗi 15 giây. Kỹ thuật viên & nhân viên mở app quét mã khi vào và ra ca.
        </div>

        <p className="field-hint">Giữ màn hình này mở tại salon. Mã hết hạn sau 15 giây, không dùng ảnh chụp hoặc bản in để chấm công.</p>
        {!location.isPending && !location.error && !hasGps && <Link className="btn btn-primary" to="/m/account">Thiết lập GPS chi nhánh</Link>}

        {/* Location Info Box */}
        <div className="mobile-qr-location-box">
          <div className="mobile-qr-location-header">
            <i className="ph ph-map-pin text-primary" />
            <span>{branchData?.name || storeName}</span>
          </div>
          <div className="mobile-qr-location-coords">
            {location.error ? <ErrorState compact error={location.error} onRetry={() => location.refetch()} /> : location.isPending ? 'Đang tải vị trí…' : hasGps ? `Tọa độ: ${Number(branchData.latitude).toFixed(5)}, ${Number(branchData.longitude).toFixed(5)} · Bán kính GPS: ${branchData.radiusMeters}m` : 'Chưa thiết lập tọa độ GPS'}
          </div>
        </div>
      </div>
    </div>
  );
}
