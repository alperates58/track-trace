import { useEffect, useRef } from 'react';

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  onUndo?: () => void;
  enabled?: boolean;
  minChars?: number;
  maxDelayMs?: number;
}

/**
 * Hook to capture hardware barcode scanner inputs globally without losing focus.
 * Hardware scanners send keystrokes with very low inter-character latency (< 50ms)
 * and terminate with Enter.
 */
export const useBarcodeScanner = ({
  onScan,
  onUndo,
  enabled = true,
  minChars = 4,
  maxDelayMs = 70,
}: UseBarcodeScannerOptions) => {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);
  const onUndoRef = useRef(onUndo);

  useEffect(() => {
    onScanRef.current = onScan;
    onUndoRef.current = onUndo;
  }, [onScan, onUndo]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Check for Ctrl+Z for Undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        const target = e.target as HTMLElement | null;
        const isEditable =
          target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
          !target.classList.contains('hidden-input');

        if (!isEditable && onUndoRef.current) {
          e.preventDefault();
          onUndoRef.current();
          return;
        }
      }

      // 2. Ignore if user is actively typing in a standard visible input or modal textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'TEXTAREA' ||
          (target.tagName === 'INPUT' && !target.classList.contains('hidden-input')) ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // 3. Enter key terminates the barcode scan
      if (e.key === 'Enter') {
        const code = bufferRef.current.trim();
        bufferRef.current = '';

        if (code.length >= minChars) {
          e.preventDefault();
          onScanRef.current(code);
        }
        return;
      }

      // 4. Capture single characters or special GS1 chars
      if (e.key.length === 1) {
        // If elapsed time since last keystroke is too long (human typing sluggishly), reset buffer
        if (bufferRef.current.length > 0 && timeDiff > maxDelayMs && timeDiff > 120) {
          bufferRef.current = e.key;
        } else {
          bufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, minChars, maxDelayMs]);
};
