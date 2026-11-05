import { Button } from '../components/ui/button';
export function Announce({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="tds-announcement" role="alert"><span>{message}</span><Button variant="secondary" onClick={onRetry}>Retry</Button></div>;
}
