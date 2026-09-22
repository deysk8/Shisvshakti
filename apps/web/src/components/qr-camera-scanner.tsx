'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

type QrCameraScannerProps = {
  onScan: (rawText: string) => void;
  paused?: boolean;
  className?: string;
};

type Html5QrcodeModule = typeof import('html5-qrcode');

export function QrCameraScanner({ onScan, paused = false, className = '' }: QrCameraScannerProps) {
  const reactId = useId();
  const elementId = `qr-scanner-${reactId.replace(/:/g, '')}`;
  const scannerRef = useRef<InstanceType<Html5QrcodeModule['Html5Qrcode']> | null>(null);
  const libRef = useRef<Html5QrcodeModule | null>(null);
  const onScanRef = useRef(onScan);
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  onScanRef.current = onScan;

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    const lib = libRef.current;
    if (!scanner || !lib) return;
    try {
      if (scanner.getState() === lib.Html5QrcodeScannerState.SCANNING) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // Camera may already be stopped during unmount.
    }
    scannerRef.current = null;
  }, []);

  useEffect(() => {
    if (paused) {
      stopScanner().then(() => setStatus('idle'));
      return;
    }

    let active = true;
    setStatus('starting');
    setErrorMsg(null);

    async function startScanner() {
      try {
        const lib = await import('html5-qrcode');
        if (!active) return;
        libRef.current = lib;

        const scanner = new lib.Html5Qrcode(elementId, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 8,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.min(viewfinderWidth, viewfinderHeight) * 0.72;
              const size = Math.max(180, Math.floor(edge));
              return { width: size, height: size };
            },
            aspectRatio: 1.777778,
          },
          (decodedText) => {
            if (active) onScanRef.current(decodedText);
          },
          () => {
            // No QR in frame — ignore per-frame misses.
          },
        );

        if (active) setStatus('scanning');
      } catch (err: unknown) {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Could not start camera';
        setErrorMsg(message);
        setStatus('error');
      }
    }

    void startScanner();

    return () => {
      active = false;
      void stopScanner();
    };
  }, [paused, elementId, stopScanner]);

  return (
    <div className={className}>
      <div
        id={elementId}
        className="min-h-[240px] overflow-hidden rounded-xl border border-gray-200 bg-black sm:min-h-[280px] [&_video]:!rounded-xl [&_video]:object-cover"
      />
      {status === 'starting' && (
        <p className="mt-3 text-center text-sm text-gray-500">
          Starting camera… allow access when your browser asks.
        </p>
      )}
      {status === 'scanning' && (
        <p className="mt-3 text-center text-sm text-gray-600">
          Align the ticket QR code inside the frame
        </p>
      )}
      {status === 'error' && errorMsg && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{errorMsg}</p>
          <p className="mt-1 text-xs text-red-600">
            Use manual entry below, or open this page on HTTPS / localhost with camera permission enabled.
          </p>
        </div>
      )}
    </div>
  );
}
