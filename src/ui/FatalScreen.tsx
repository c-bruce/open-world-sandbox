export interface FatalError {
  kind: 'unsupported' | 'error';
  title: string;
  message: string;
}

export function FatalScreen({ error }: { error: FatalError }) {
  return (
    <div className="fatal" role="alert">
      <div className="fatal-card">
        <h1>{error.title}</h1>
        <p>{error.message}</p>
        {error.kind === 'unsupported' && (
          <>
            <p>
              This sandbox runs real-time simulations with WebGPU. Try a current version of Chrome
              or Edge on desktop.
            </p>
            {/* TODO: link the demo video once it's published. */}
            <a className="fatal-link" href="#demo-video" aria-disabled="true">
              Watch a demo video (coming soon)
            </a>
          </>
        )}
      </div>
    </div>
  );
}
