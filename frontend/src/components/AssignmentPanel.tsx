import type { Assignment } from "../types";

export function AssignmentPanel({ userId, setUserId, assignment }: {
  userId: string;
  setUserId: (userId: string) => void;
  assignment: Assignment | null;
}) {
  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">User assignment</p>
          <h3>Who gets the new feature?</h3>
        </div>
        <input
          value={userId}
          aria-label="User id for assignment"
          onChange={(event) => setUserId(event.target.value)}
        />
      </div>
      <div className="assignment">
        {assignment ? (
          <>
            <strong>{assignment.userId}</strong> maps to <strong>{assignment.variant}</strong>
            <br />
            <small>Stable bucket {assignment.bucketNumber}; included={String(assignment.included)}</small>
          </>
        ) : "Calculating assignment..."}
      </div>
    </article>
  );
}
