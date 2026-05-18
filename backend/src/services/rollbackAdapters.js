export async function executeRollbackAction({ experiment, actor }) {
  return {
    mode: "local_feature_flag",
    actor,
    experimentId: experiment.id,
    fromRolloutPercentage: experiment.rolloutPercentage,
    toRolloutPercentage: 0,
    message: "Local MVP rollback sets treatment exposure to 0%. Cloud Run traffic rollback can be plugged in here later."
  };
}
