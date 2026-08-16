import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate, formatTime } from '@/lib/format';
import { clientErrorMessage, errorMessage } from '@/services/api-client';
import { useAuth } from '@/features/auth/AuthProvider';
import { getMyAttendance, scanAttendance } from './attendance.api';

function currentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
    enableHighAccuracy: true, timeout: 15_000, maximumAge: 0,
  }));
}

function isGeolocationError(cause: unknown): cause is GeolocationPositionError {
  return typeof cause === 'object' && cause !== null && 'code' in cause;
}

export function AttendanceScanView() {
  const { account } = useAuth();
  const client = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processingRef = useRef(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [message, setMessage] = useState('');
  const [manualToken, setManualToken] = useState('');
  const status = useQuery({ queryKey: ['my-attendance'], queryFn: getMyAttendance });
  const mutation = useMutation({
    mutationFn: scanAttendance,
    onSuccess: (payload) => {
      client.setQueryData(['my-attendance'], { data: payload.data.attendance });
      setMessage(payload.data.action === 'check_in' ? 'Chấm công vào ca thành công' : 'Chấm công ra ca thành công');
      setCameraOn(false); streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    onError: (cause) => { setMessage(errorMessage(cause, 'Không thể chấm công')); processingRef.current = false; },
  });

  const submitToken = async (token: string) => {
    if (processingRef.current || mutation.isPending) return;
    processingRef.current = true; setMessage('Đang xác minh GPS…');
    try {
      if (!navigator.geolocation) throw new Error(clientErrorMessage('Trình duyệt không hỗ trợ GPS', 'GEOLOCATION_UNSUPPORTED'));
      const position = await currentPosition();
      mutation.mutate({ token, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy });
    } catch (error) {
      if (isGeolocationError(error)) {
        setMessage(clientErrorMessage(
          error.code === error.PERMISSION_DENIED ? 'Không lấy được GPS. Hãy cấp quyền vị trí và thử lại' : error.code === error.TIMEOUT ? 'Lấy vị trí GPS quá thời gian cho phép' : 'Dịch vụ GPS hiện không khả dụng',
          error.code === error.PERMISSION_DENIED ? 'GEOLOCATION_PERMISSION_DENIED' : error.code === error.TIMEOUT ? 'GEOLOCATION_TIMEOUT' : 'GEOLOCATION_UNAVAILABLE',
        ));
      } else {
        setMessage(error instanceof Error ? error.message : clientErrorMessage('Không lấy được GPS', 'GEOLOCATION_ERROR'));
      }
      processingRef.current = false;
    }
  };

  useEffect(() => {
    if (!cameraOn || !videoRef.current) return;
    let cancelled = false;
    let frame = 0;
    const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
    if (!Detector) {
      setMessage(clientErrorMessage('Trình duyệt chưa hỗ trợ quét QR trực tiếp. Hãy dùng Chrome mới nhất hoặc nhập mã thủ công', 'QR_SCANNER_UNSUPPORTED'));
      setCameraOn(false);
      return;
    }
    const detector = new Detector({ formats: ['qr_code'] });
    const scanFrame = async () => {
      if (cancelled || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes[0]?.rawValue) await submitToken(codes[0].rawValue);
      } catch { /* camera may not have a decodable frame yet */ }
      if (!cancelled) frame = window.requestAnimationFrame(scanFrame);
    };
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(async (stream) => {
        if (cancelled || !videoRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        frame = window.requestAnimationFrame(scanFrame);
      })
      .catch((cause: unknown) => {
        const denied = cause instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(cause.name);
        setMessage(clientErrorMessage(
          denied ? 'Quyền camera đã bị từ chối. Hãy cấp quyền camera hoặc nhập mã thủ công' : 'Không mở được camera. Hãy kiểm tra thiết bị hoặc nhập mã thủ công',
          denied ? 'CAMERA_PERMISSION_DENIED' : 'CAMERA_UNAVAILABLE',
        ));
        setCameraOn(false);
      });
    return () => { cancelled = true; window.cancelAnimationFrame(frame); streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; };
  }, [cameraOn]);

  const attendance = status.data?.data;
  const completed = Boolean(attendance?.checkOut);
  return <main className="employee-attendance-page">
    <header className="employee-heading"><span className="employee-logo"><span className="brand-mark"><span /><span /></span>{account?.branchName || 'Beauty Salon'}</span><span>{account?.displayName}</span></header>
    <div className="employee-attendance-shell">
      <section className="employee-welcome"><span>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long' })}</span><h1>Xin chào, {account?.displayName}</h1><p>{completed ? 'Bạn đã hoàn tất ca làm hôm nay.' : attendance ? 'Quét mã tại quầy để chấm công ra ca.' : 'Quét mã trên tài khoản quản lý để bắt đầu ca làm.'}</p></section>
      <section className="scan-card">
        {cameraOn ? <div className="camera-frame"><video ref={videoRef} muted playsInline /><span className="scan-corners" /><div className="scan-line" /></div> : <div className={`scan-placeholder ${completed ? 'is-complete' : ''}`}><i className={`ph ${completed ? 'ph-check-circle' : 'ph-qr-code'}`} /><strong>{completed ? 'Đã hoàn tất' : 'Sẵn sàng quét mã'}</strong><span>{completed ? 'Hẹn gặp lại bạn vào ca tiếp theo' : 'Camera chỉ dùng để đọc QR chấm công'}</span></div>}
        {!completed && <button className="scan-button" type="button" disabled={mutation.isPending} onClick={() => { processingRef.current = false; setMessage(''); setCameraOn((value) => !value); }}><i className={`ph ${cameraOn ? 'ph-x' : 'ph-camera'}`} />{cameraOn ? 'Đóng camera' : attendance ? 'Quét mã ra ca' : 'Mở camera quét mã'}</button>}
        {!completed && <details className="manual-code"><summary>Không dùng được camera?</summary><div><input value={manualToken} onChange={(event) => setManualToken(event.target.value)} placeholder="Dán nội dung mã QR" /><button type="button" disabled={!manualToken || mutation.isPending} onClick={() => submitToken(manualToken)}>Xác nhận</button></div></details>}
        {message && <div className={`scan-message ${mutation.isError ? 'is-error' : ''}`} role="status"><i className={`ph ${mutation.isError ? 'ph-warning-circle' : 'ph-circle-notch'}`} />{message}</div>}
      </section>
      <section className="today-attendance"><h2>Chấm công hôm nay</h2><div className="attendance-timeline"><div className={attendance?.checkIn ? 'is-done' : ''}><span><i className="ph ph-sign-in" /></span><p><small>VÀO CA</small><strong>{attendance?.checkIn ? formatTime(attendance.checkIn) : '--:--'}</strong></p></div><i className="timeline-line" /><div className={attendance?.checkOut ? 'is-done' : ''}><span><i className="ph ph-sign-out" /></span><p><small>RA CA</small><strong>{attendance?.checkOut ? formatTime(attendance.checkOut) : '--:--'}</strong></p></div></div>{attendance && <p className="attendance-date">{formatDate(attendance.workDate)} · {attendance.lateMinutes > 0 ? `Đi muộn ${attendance.lateMinutes} phút` : 'Đúng giờ'}</p>}</section>
    </div>
  </main>;
}
