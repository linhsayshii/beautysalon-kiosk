import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { getAttendanceChallenge, getAttendanceLocation } from '@/features/attendance/attendance.api';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import './mobile-staff.css';

export function MobileAttendanceQrAdminView() {
  const navigate = useNavigate();
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
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = challenge.data?.data.token;
    if (!token) return;
    QRCode.toDataURL(token, {
      width: 420,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
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
      {/* 1. Header Top Navigation */}
      <div className="mobile-staff-top-nav">
        <div className="mobile-staff-nav-left">
          <button
            type="button"
            className="mobile-staff-back-icon"
            onClick={() => navigate('/m/more')}
            aria-label="Quay lại"
          >
            <i className="ph ph-caret-left" />
          </button>
          <h1 className="mobile-staff-nav-title">Mã QR Chấm công</h1>
        </div>

        <div className="mobile-staff-nav-actions">
          <button
            type="button"
            className="mobile-staff-nav-btn"
            onClick={handleShareOrDownload}
            aria-label="Chia sẻ / Tải ảnh"
            title="Tải ảnh QR"
          >
            <i className="ph ph-share-network" />
          </button>
        </div>
      </div>

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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#94a3b8' }}>
              <i className="ph ph-spinner ph-spin" style={{ fontSize: 32 }} />
              <span style={{ fontSize: 13 }}>Đang tạo mã QR...</span>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mobile-qr-instructions">
          Mã QR bảo mật tự động đổi mỗi 15 giây. Kỹ thuật viên & nhân viên mở app quét mã khi vào và ra ca.
        </div>

        {/* Action Button */}
        <button
          type="button"
          className="mobile-staff-action-btn primary"
          style={{ width: '100%', maxWidth: 280 }}
          onClick={handleShareOrDownload}
          disabled={!qrImage}
        >
          <i className="ph ph-download-simple" />
          Tải ảnh QR để in / chia sẻ
        </button>

        {/* Location Info Box */}
        <div className="mobile-qr-location-box">
          <div className="mobile-qr-location-header">
            <i className="ph ph-map-pin" style={{ color: '#0062eb', fontSize: 18 }} />
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
