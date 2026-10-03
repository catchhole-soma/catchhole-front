import { createRoot } from 'react-dom/client';
import { ReviewValueComparison } from '../../src/app/components/catchhole/review-ui/ReviewPrimitives';

export function mountReviewComparison(props: {
  before: string; after: string; beforeLabel?: string; afterLabel?: string;
  beforeMeta?: string; afterMeta?: string;
}) {
  document.getElementById('root')?.remove();
  const target = document.createElement('main');
  target.className = 'theme-v2';
  target.style.cssText = 'max-width:800px;padding:12px;margin:auto;box-sizing:border-box;';
  document.body.style.cssText = 'margin:0;overflow:auto;';
  document.body.append(target);
  createRoot(target).render(<ReviewValueComparison {...props} mode="change" />);
}
