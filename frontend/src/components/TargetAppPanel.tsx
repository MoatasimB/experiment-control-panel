import { useState } from "react";

export function TargetAppPanel({ onTrafficGenerated }: { onTrafficGenerated: () => Promise<void> }) {
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function generateTraffic() {
    try {
      setGenerating(true);
      setMessage(null);
      const response = await fetch("http://127.0.0.1:4180/traffic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count: 100 })
      });

      if (!response.ok) throw new Error(`Target app returned ${response.status}`);

      const result = await response.json();
      setMessage(`Generated ${result.generated} requests with ${result.failures} failures.`);
      await onTrafficGenerated();
    } catch (error) {
      setMessage(error instanceof Error
        ? `${error.message}. Make sure npm run dev:target is running.`
        : "Could not generate target-app traffic.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Target app</p>
          <h3>The app being rolled out</h3>
        </div>
      </div>
      <p className="muted">
        The target search app asks this control plane who should see the experimental feature, serves current or experimental behavior, then reports latency and errors back as metric events.
      </p>
      <div className="command-box">
        <span>Generate local traffic</span>
        <code>npm run traffic -- 100</code>
      </div>
      <div className="button-row traffic-actions">
        <button onClick={generateTraffic} disabled={generating}>
          {generating ? "Generating..." : "Generate 100 requests"}
        </button>
        {message ? <small className="muted">{message}</small> : null}
      </div>
    </article>
  );
}
