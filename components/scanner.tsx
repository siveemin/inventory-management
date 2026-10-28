"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";

export function HardwareScanListener({ onScan, disabled }: { onScan: (code: string) => void; disabled?: boolean }) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });
  useEffect(() => {
    if (disabled) return;
    let buffer = "";
    let last = 0;
    let started = 0;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const now = performance.now();
      if (now - last > 50) {
        buffer = "";
        started = now;
      }
      last = now;
      if (event.key === "Enter") {
        if (buffer.length >= 4 && now - started < 120) {
          event.preventDefault();
          onScanRef.current(buffer);
        }
        buffer = "";
        return;
      }
      if (event.key.length === 1) buffer += event.key;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled]);
  return null;
}

export function BarcodeCameraScanner({ onScan }: { onScan: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    let controls: { stop: () => void } | null = null;
    const last = { value: "" };

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const Detector = window.BarcodeDetector;
        if (Detector) {
          const detector = new Detector({ formats: ["ean_13", "ean_8", "code_128", "code_39", "qr_code", "upc_a", "upc_e"] });
          const tick = async () => {
            if (stop || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              const value = codes[0]?.rawValue;
              if (value && value !== last.value) {
                last.value = value;
                onScanRef.current(value);
              }
            } catch {
              /* frame not ready */
            }
            frame = requestAnimationFrame(tick);
          };
          frame = requestAnimationFrame(tick);
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const reader = new BrowserMultiFormatReader();
          controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
            const value = result?.getText();
            if (value && value !== last.value) {
              last.value = value;
              onScanRef.current(value);
            }
          });
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Camera unavailable");
      }
    }
    start();
    return () => {
      stop = true;
      cancelAnimationFrame(frame);
      controls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function onFile(file: File) {
    const url = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(url);
      onScanRef.current(result.getText());
      setError(null);
    } catch {
      setError("Could not read a barcode from that photo.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="relative aspect-[3/4] max-h-[420px] overflow-hidden rounded-[28px] bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-6">
          <span className="absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 border-white" />
          <span className="absolute right-0 top-0 h-8 w-8 border-r-2 border-t-2 border-white" />
          <span className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-white" />
          <span className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-white" />
          <span className="scanline absolute left-3 right-3 h-0.5 bg-[#7DCEA0] shadow-[0_0_16px_#1F7A4D]" />
        </div>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <label className="text-sm text-forest">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
          }}
        />
        <span className="cursor-pointer underline">Upload a photo of a barcode</span>
      </label>
    </div>
  );
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };
    };
  }
}

export function QtyStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-full border border-line">
      <Button variant="ghost" className="h-8 w-8 px-0" onClick={() => onChange(Math.max(1, value - 1))}>−</Button>
      <span className="w-8 text-center text-sm tabular-nums">{value}</span>
      <Button variant="ghost" className="h-8 w-8 px-0" onClick={() => onChange(value + 1)}>+</Button>
    </div>
  );
}
