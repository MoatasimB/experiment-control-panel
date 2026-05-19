export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">RCP</div>
        <div>
          <strong>Reliability Control</strong>
          <span>Experiment operations</span>
        </div>
      </div>
      <nav>
        <a href="#dashboard" className="active">Overview</a>
        <a href="#rollout">Rollout</a>
        <a href="#metrics">Metrics</a>
        <a href="#evidence">Evidence</a>
      </nav>
    </aside>
  );
}
