import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { getAttendanceChallenge, getAttendanceLocation } from '@/features/attendance/attendance.api';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { LoadingState } from '@/components/data-display/DataState';

export function MobileAttendanceQrAdminView() {
  const { notify } = useToast();
  const [qrImage, setQrImage] = useState('');
  const [now, setNow] = useState(Date.now());

  const challenge = useQuery({
    queryKey: ['attendance-challenge'],
    queryFn: getAttendanceChallenge,
    refetchInterval: 1_000,
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
    QRCode.toDataURL(token, {
      width: 420,
      margin: 2,
      color: { dark: 'var(--ink-950)', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setQrImage);
  }, [challenge.data?.data.token]);

  const handleShareOrDownload = () => {
    if (!qrImage) return;
    const link = document.createElement('a');
    link.href = qrImage;
    link.download = `QR-ChamCong-${location.data?.data?.name || 'ChiNhanh'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('Đã tải ảnh QR', 'Ảnh mã QR chấm công đã được lưu về thiết bị.');
  };

  const branchData = location.data?.data;

  return (
    <div className="mobile-staff-view">
      <MobilePageHeader
        title="Mã QR Chấm công"
        backTo="/m/more"
        actions={(
          <button
            type="button"
            className="btn btn-ghost btn-icon m-header-action"
            onClick={handleShareOrDownload}
            aria-label="Chia sẻ / Tải ảnh"
            title="Tải ảnh QR"
          >
            <i className="ph ph-share-network" />
          </button>
        )}
      />

      {/* Main Inset Screen Card */}
      <div className="mobile-qr-screen-card">
        <div className="mobile-qr-status-pill">
          <span className="live-dot" />
          <span>MÃ ĐANG HOẠT ĐỘNG ({secondsLeft}s)</span>
        </div>

        {/* Large QR Display */}
        <div className="mobile-qr-image-wrapper">
          {qrImage ? (
            <img src={qrImage} alt="Mã QR chấm công cửa hàng" />
          ) : (
            <LoadingState compact label="Đang tạo mã QR..." />
          )}
        </div>

        {/* Instructions */}
        <div className="mobile-qr-instructions">
          Mã QR bảo mật tự động đổi mỗi 15 giây. Kỹ thuật viên & nhân viên mở app quét mã khi vào và ra ca.
        </div>

        {/* Action Button */}
        <button
          type="button"
          className="btn btn-primary mobile-qr-action"
          onClick={handleShareOrDownload}
          disabled={!qrImage}
        >
          <i className="ph ph-download-simple" />
          Tải ảnh QR để in / chia sẻ
        </button>

        {/* Location Info Box */}
        <div className="mobile-qr-location-box">
          <div className="mobile-qr-location-header">
            <i className="ph ph-map-pin text-primary" />
            <span>{branchData?.name || 'Chi nhánh Anna Spa'}</span>
          </div>
          <div className="mobile-qr-location-coords">
            Tọa độ: {branchData?.latitude?.toFixed(5) || '10.7768'}, {branchData?.longitude?.toFixed(5) || '106.7009'} • Bán kính GPS: {branchData?.radiusMeters || 100}m
          </div>
        </div>
      </div>
    </div>
  );
}
