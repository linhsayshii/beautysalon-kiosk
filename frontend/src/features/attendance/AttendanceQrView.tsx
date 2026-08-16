import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { getAttendanceChallenge, getAttendanceLocation, updateAttendanceLocation } from './attendance.api';
import { LocationMapPicker } from '@/components/map/LocationMapPicker';
import { clientErrorMessage, errorMessage } from '@/services/api-client';

export function AttendanceQrView() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [qrImage, setQrImage] = useState('');
  const [now, setNow] = useState(Date.now());
  const [radius, setRadius] = useState(100);
  const [coordinates, setCoordinates] = useState<{ latitude: number | null; longitude: number | null }>({ latitude: null, longitude: null });
  const challenge = useQuery({ queryKey: ['attendance-challenge'], queryFn: getAttendanceChallenge, refetchInterval: 1_000 });
  const location = useQuery({ queryKey: ['attendance-location'], queryFn: getAttendanceLocation });
  const secondsLeft = challenge.data ? Math.max(0, Math.ceil((new Date(challenge.data.data.expiresAt).getTime() - now) / 1000)) : 0;

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (location.data) { setRadius(location.data.data.radiusMeters); setCoordinates({ latitude: location.data.data.latitude, longitude: location.data.data.longitude }); } }, [location.data]);
  useEffect(() => {
    const token = challenge.data?.data.token;
    if (!token) return;
    QRCode.toDataURL(token, { width: 420, margin: 2, color: { dark: '#111827', light: '#ffffff' }, errorCorrectionLevel: 'M' }).then(setQrImage);
  }, [challenge.data?.data.token]);

  const update = useMutation({
    mutationFn: updateAttendanceLocation,
    onSuccess: (payload) => {
      queryClient.setQueryData(['attendance-location'], payload);
      notify('Đã cập nhật vị trí', `Bán kính chấm công là ${payload.data.radiusMeters}m.`);
    },
    onError: (cause) => notify('Không thể cập nhật vị trí', errorMessage(cause, 'Vui lòng thử lại')),
  });

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { notify('Không hỗ trợ GPS', clientErrorMessage('Trình duyệt này không cung cấp vị trí', 'GEOLOCATION_UNSUPPORTED')); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => { const next = { latitude: position.coords.latitude, longitude: position.coords.longitude }; setCoordinates(next); update.mutate({ ...next, radiusMeters: radius }); },
      (cause) => notify('Không lấy được vị trí', clientErrorMessage(
        cause.code === cause.PERMISSION_DENIED ? 'Hãy cho phép truy cập vị trí rồi thử lại' : cause.code === cause.TIMEOUT ? 'Thiết bị lấy vị trí quá thời gian cho phép' : 'Dịch vụ vị trí hiện không khả dụng',
        cause.code === cause.PERMISSION_DENIED ? 'GEOLOCATION_PERMISSION_DENIED' : cause.code === cause.TIMEOUT ? 'GEOLOCATION_TIMEOUT' : 'GEOLOCATION_UNAVAILABLE',
      )),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  };

  return <main className="workspace"><div className="workspace-shell attendance-shell">
    <PageHeader title="QR chấm công" subtitle="Mở màn hình này tại chi nhánh để nhân viên quét khi vào và ra ca." />
    <div className="attendance-manager-grid">
      <section className="qr-panel">
        <div className="qr-panel-heading"><span className="live-dot" /><span>MÃ ĐANG HOẠT ĐỘNG</span><strong>{secondsLeft}s</strong></div>
        {challenge.isPending ? <LoadingState /> : challenge.error ? <ErrorState error={challenge.error} onRetry={() => challenge.refetch()} /> : <>
          <div className="qr-frame">{qrImage && <img src={qrImage} alt="Mã QR chấm công hiện tại" />}</div>
          <h2>Quét mã để chấm công</h2><p>Mã tự đổi sau mỗi 15 giây. Nhân viên cần bật GPS và đứng trong bán kính chi nhánh.</p>
        </>}
      </section>
      <aside className="location-panel">
        <span className="location-icon"><i className="ph ph-map-pin-area" /></span><div><span className="eyebrow">VỊ TRÍ CHI NHÁNH</span><h2>{location.data?.data.name ?? 'Đang tải…'}</h2><p>GPS của nhân viên được so sánh với vị trí này khi gửi yêu cầu chấm công.</p></div>
        <div className="attendance-map-block"><LocationMapPicker latitude={coordinates.latitude} longitude={coordinates.longitude} radiusMeters={radius} height={280} onChange={(latitude, longitude) => setCoordinates({ latitude, longitude })} /></div>
        <div className="location-values"><div><span>Vĩ độ</span><strong>{coordinates.latitude?.toFixed(6) ?? 'Chưa đặt'}</strong></div><div><span>Kinh độ</span><strong>{coordinates.longitude?.toFixed(6) ?? 'Chưa đặt'}</strong></div></div>
        <label className="radius-field"><span>Bán kính cho phép</span><div><input type="number" min="10" max="1000" value={radius} onChange={(event) => setRadius(Number(event.target.value))} /><strong>mét</strong></div></label>
        <div className="location-actions"><button className="secondary-button" type="button" onClick={useCurrentLocation} disabled={update.isPending}><i className="ph ph-crosshair" />Vị trí hiện tại</button><button className="primary-button" type="button" disabled={update.isPending || coordinates.latitude === null || coordinates.longitude === null} onClick={() => update.mutate({ ...coordinates, radiusMeters: radius })}><i className="ph ph-floppy-disk" />{update.isPending ? 'Đang lưu…' : 'Lưu vị trí GPS'}</button></div>
        <p className="location-note"><i className="ph ph-info" /> Thao tác này cập nhật tọa độ chi nhánh. Chỉ thực hiện khi thiết bị quản lý đang ở đúng salon.</p>
      </aside>
    </div>
  </div></main>;
}
