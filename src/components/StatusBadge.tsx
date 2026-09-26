import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const norm = status?.toLowerCase() || 'draft';

  let label = status;
  let cssClass = 'status-tag tag-draft';

  if (norm === 'ready') {
    label = 'Ready';
    cssClass = 'status-tag tag-ready';
  } else if (norm === 'waiting') {
    label = 'Waiting';
    cssClass = 'status-tag tag-waiting';
  } else if (norm === 'done') {
    label = 'Done';
    cssClass = 'status-tag tag-done';
  } else if (norm === 'cancelled') {
    label = 'Cancelled';
    cssClass = 'status-tag tag-cancelled';
  } else if (norm === 'draft') {
    label = 'Draft';
    cssClass = 'status-tag tag-draft';
  }

  return <span className={cssClass}>{label}</span>;
};
