interface Props {
  stages: string[];
  currentStage: number;
  error: string | null;
  elapsed: number;
}

const STAGE_ICONS = ['🔍', '🔄', '📊', '✨'];

export default function ProgressBar({ stages, currentStage, error, elapsed }: Props) {
  const pct = stages.length > 1 ? Math.round((currentStage / (stages.length - 1)) * 100) : 0;

  return (
    <div id="progress-wrap" style={{ display: 'block' }}>
      <div id="progress-bar-bg">
        <div id="progress-bar-fill" className={currentStage < 0 ? 'indeterminate' : ''} style={{ width: currentStage < 0 ? '40%' : `${pct}%` }} />
      </div>
      <div id="progress-info">
        <span id="progress-stage">
          {error ? (
            <span style={{ color: 'var(--red)' }}>⚠ {error}</span>
          ) : (
            <>{STAGE_ICONS[currentStage] || ''} {stages[currentStage] || 'Done'}</>
          )}
        </span>
        <span id="progress-time">{(elapsed / 1000).toFixed(1)}s</span>
      </div>
      <div id="progress-stages">
        {stages.map((s, i) => {
          const done = i < currentStage;
          const active = i === currentStage;
          return (
            <div key={i} className={`prog-dot${done ? ' done' : ''}${active ? ' active' : ''}${error && active ? ' error' : ''}`} title={s} />
          );
        })}
      </div>
    </div>
  );
}
