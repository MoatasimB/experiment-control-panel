export function stableHash(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function assignUser({ experimentId, userId, rolloutPercentage }) {
  if (!experimentId || !userId) {
    throw new Error("experimentId and userId are required");
  }

  const normalizedRollout = Math.max(0, Math.min(100, Number(rolloutPercentage)));
  const bucketNumber = stableHash(`${experimentId}:${userId}`) % 100;
  const included = bucketNumber < normalizedRollout;

  return {
    experimentId,
    userId,
    bucketNumber,
    included,
    variant: included ? "treatment" : "control"
  };
}
