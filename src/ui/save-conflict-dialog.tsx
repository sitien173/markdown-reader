import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';

// Cancel is the only dismissal path; closing the dialog never writes to disk.
export function SaveConflictDialog({ open, onOverwrite, onReload, onCancel }: { open: boolean; onOverwrite(): void; onReload(): void; onCancel(): void }) {
  return <Dialog open={open} onOpenChange={next => { if (!next) onCancel(); }}><DialogContent aria-describedby="save-conflict-description"><DialogHeader><DialogTitle>File changed on disk</DialogTitle><DialogDescription id="save-conflict-description">This file changed after you opened it. Overwrite replaces it with your draft. Reload from disk discards your draft.</DialogDescription></DialogHeader><DialogFooter><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button variant="secondary" onClick={onReload}>Reload from disk</Button><Button variant="destructive" onClick={onOverwrite}>Overwrite</Button></DialogFooter></DialogContent></Dialog>;
}
