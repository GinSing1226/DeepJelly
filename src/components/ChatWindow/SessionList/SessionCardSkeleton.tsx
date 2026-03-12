/**
 * SessionCardSkeleton Component
 *
 * Loading skeleton for session cards.
 */

import './SessionCardSkeleton.css';

function SessionCardSkeleton() {
  return (
    <div className="session-card-skeleton">
      <div className="skeleton-avatar"></div>
      <div className="skeleton-info">
        <div className="skeleton-line skeleton-title"></div>
        <div className="skeleton-line skeleton-preview"></div>
      </div>
    </div>
  );
}

export default SessionCardSkeleton;
