import type { Experiment } from "../types";
import { formatStatus } from "../utils/format";

export function RolloutPanel({ experiment, setRollout }: {
  experiment: Experiment;
  setRollout: (value: number) => Promise<void>;
}) {
  return (
    <article className="panel" id="rollout">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Rollout control</p>
          <h3>Exposure guardrail</h3>
        </div>
        <span className="pill">{formatStatus(experiment.status)}</span>
      </div>
      <label className="range-label" htmlFor="rollout-slider">
        Experimental traffic
        <strong>{experiment.rolloutPercentage}%</strong>
      </label>
      <input
        id="rollout-slider"
        min="0"
        max="100"
        step="5"
        type="range"
        value={experiment.rolloutPercentage}
        onChange={(event) => setRollout(Number(event.target.value))}
      />
      <div className="button-row">
        {[10, 25, 50].map((value) => (
          <button key={value} onClick={() => setRollout(value)}>{value}%</button>
        ))}
        <button className="secondary" onClick={() => setRollout(0)}>Pause</button>
      </div>
    </article>
  );
}
