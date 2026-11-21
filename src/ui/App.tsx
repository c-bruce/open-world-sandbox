import { useEffect, useRef } from 'react';
import './App.css';

export interface FatalError {
  title: string;
  message: string;
}

interface AppProps {
  canvas: HTMLCanvasElement;
  error?: FatalError;
}

export function App({ canvas, error }: AppProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.appendChild(canvas);
    return () => {
      canvas.remove();
    };
  }, [canvas]);

  return (
    <>
      <div ref={hostRef} className="viewport" />
      {error && (
        <div className="fatal-error" role="alert">
          <h1>{error.title}</h1>
          <p>{error.message}</p>
        </div>
      )}
    </>
  );
}
