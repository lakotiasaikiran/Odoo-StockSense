import React from 'react';

interface MoveStatusTrackerProps {
  status: string;
  isDelivery?: boolean;
}

export const MoveStatusTracker: React.FC<MoveStatusTrackerProps> = ({ status, isDelivery }) => {
  const norm = status?.toLowerCase() || 'draft';

  // Stages: Draft -> Ready (or Waiting) -> Done
  const isDone = norm === 'done';
  const isWaiting = norm === 'waiting';
  const isReady = norm === 'ready';
  const isDraft = norm === 'draft';
  const isCancelled = norm === 'cancelled';

  if (isCancelled) {
    return (
      <div className="status-tracker-bar cancelled">
        <span className="step-pill step-cancelled">Cancelled</span>
      </div>
    );
  }

  return (
    <div className="status-tracker-bar">
      <div className={`step-item ${isDraft ? 'active' : 'completed'}`}>
        <span className="step-dot" />
        <span className="step-title">Draft</span>
      </div>
      <div className="step-divider" />
      <div className={`step-item ${isWaiting ? 'active warning' : isReady ? 'active' : isDone ? 'completed' : ''}`}>
        <span className="step-dot" />
        <span className="step-title">
          {isDelivery && isWaiting ? 'Waiting for Stock' : 'Ready'}
        </span>
      </div>
      <div className="step-divider" />
      <div className={`step-item ${isDone ? 'active success' : ''}`}>
        <span className="step-dot" />
        <span className="step-title">Done</span>
      </div>
    </div>
  );
};
