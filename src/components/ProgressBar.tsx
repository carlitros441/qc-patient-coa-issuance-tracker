export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-wrap" aria-label={`${value}% complete`}>
      <div className="progress-fill" style={{ width: `${value}%` }} />
      <span>{value}%</span>
    </div>
  );
}
