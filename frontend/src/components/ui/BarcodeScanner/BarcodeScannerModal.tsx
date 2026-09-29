import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { Modal } from '@/components/ui/Modal/Modal';

export interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  /** Called once with the decoded (or typed) code. The camera stops; the caller closes the dialog. */
  onDetected: (code: string) => void;
  title?: string;
  /** Opened on top of another dialog or sheet. */
  nested?: boolean;
}

type CameraState = 'starting' | 'scanning' | 'error';

function cameraErrorMessage(cause: unknown) {
  const name = cause instanceof DOMException ? cause.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Quyền camera đã bị từ chối. Hãy cấp quyền camera hoặc nhập mã thủ công.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Không tìm thấy camera trên thiết bị này. Hãy nhập mã thủ công.';
  if (name === 'NotReadableError') return 'Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó hoặc nhập mã thủ công.';
  return 'Không mở được camera. Hãy kiểm tra thiết bị hoặc nhập mã thủ công.';
}

/**
 * Reads a product barcode (EAN/UPC/Code 128/Code 39/ITF, plus QR) from the
 * rear camera. The decoder is loaded only when the dialog opens. Typing the
 * code, or a USB scanner that types it and presses Enter, works without a camera.
 */
export function BarcodeScannerModal({ open, onClose, onDetected, title = 'Quét mã vạch', nested = false }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const [state, setState] = useState<CameraState>('starting');
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const manualId = useId();

  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let controls: IScannerControls | null = null;
    setState('starting');
    setError('');
    setManualCode('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setState('error');
      setError(window.isSecureContext
        ? 'Trình duyệt này không hỗ trợ camera. Hãy nhập mã thủ công.'
        : 'Camera chỉ hoạt động khi truy cập qua HTTPS. Hãy nhập mã thủ công.');
      return;
    }

    Promise.all([import('@zxing/browser'), import('@zxing/library')])
      .then(async ([{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }]) => {
        const video = videoRef.current;
        if (stopped || !video) return;
        const hints = new Map<number, unknown>([
          [DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF, BarcodeFormat.QR_CODE,
          ]],
          [DecodeHintType.TRY_HARDER, true],
        ]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
        const scanner = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
          video,
          (result, _error, scanControls) => {
            const code = result?.getText().trim();
            if (stopped || !code) return;
            stopped = true;
            scanControls.stop();
            navigator.vibrate?.(60);
            onDetectedRef.current(code);
          },
        );
        if (stopped) { scanner.stop(); return; }
        controls = scanner;
        setState('scanning');
      })
      .catch((cause: unknown) => {
        if (stopped) return;
        setState('error');
        setError(cameraErrorMessage(cause));
      });

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [open]);

  const submitManual = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The dialog is portalled, but React still bubbles submit to a parent form.
    event.stopPropagation();
    const code = manualCode.trim();
    if (code) onDetectedRef.current(code);
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" nested={nested} className="barcode-scanner-modal">
      <div className="modal-body barcode-scanner-body">
        <div className={`barcode-scanner-frame is-${state}`}>
          <video ref={videoRef} muted playsInline aria-label="Hình ảnh camera" />
          {state === 'scanning' && <>
            <span className="barcode-scanner-target" aria-hidden="true" />
            <span className="barcode-scanner-line" aria-hidden="true" />
          </>}
          {state !== 'scanning' && (
            <div className="barcode-scanner-status" role={state === 'error' ? 'alert' : 'status'}>
              <i className={`ph ${state === 'error' ? 'ph-camera-slash' : 'ph-camera'}`} aria-hidden="true" />
              <span>{state === 'error' ? error : 'Đang mở camera…'}</span>
            </div>
          )}
        </div>
        {state === 'scanning' && <p className="barcode-scanner-hint">Đưa mã vạch vào giữa khung và giữ yên máy.</p>}
        <form className="barcode-scanner-manual" onSubmit={submitManual}>
          <label className="field-label" htmlFor={manualId}>Hoặc nhập mã vạch</label>
          <div className="barcode-scanner-manual-row">
            <input
              id={manualId}
              className="input"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="Nhập hoặc dùng máy quét"
              inputMode="text"
              enterKeyHint="done"
              autoComplete="off"
              // iOS can pause a hidden video; resume the preview once the keyboard closes.
              onBlur={() => {
                const video = videoRef.current;
                if (video?.srcObject && video.paused) void video.play().catch(() => undefined);
              }}
            />
            <button className="btn btn-primary" type="submit" disabled={!manualCode.trim()}>Xác nhận</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

/** Text input with a trailing button that opens the camera scanner. */
export function BarcodeInput({ id, value, onChange, placeholder = 'Nhập hoặc quét mã vạch', nested = true }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  nested?: boolean;
}) {
  const [isScanning, setIsScanning] = useState(false);
  return (
    <div className="barcode-input">
      <input className="input" id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" />
      <button className="btn btn-secondary btn-icon" type="button" onClick={() => setIsScanning(true)} aria-label="Quét mã vạch bằng camera" title="Quét mã vạch">
        <i className="ph ph-barcode" aria-hidden="true" />
      </button>
      <BarcodeScannerModal
        open={isScanning}
        nested={nested}
        onClose={() => setIsScanning(false)}
        onDetected={(code) => { onChange(code); setIsScanning(false); }}
      />
    </div>
  );
}
