import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';

export function FileAccessDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable file access</DialogTitle>
          <DialogDescription>
            To render local Markdown files, open chrome://extensions, select Markdown Reader, and turn on “Allow access to file URLs”.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
