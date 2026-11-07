import { Toast as ToastPrimitive } from '@base-ui/react/toast';
import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** App-wide manager so the controller can queue a toast from outside the React tree. */
export const toastManager = ToastPrimitive.createToastManager();

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager();
  return toasts.map((toast) => (
    <ToastPrimitive.Root
      key={toast.id}
      toast={toast}
      data-slot="toast"
      className={cn(
        'absolute right-0 bottom-0 w-full rounded-lg border bg-popover text-popover-foreground shadow-lg',
        'transition-[opacity,translate] duration-200 data-ending-style:translate-y-2 data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0',
      )}
    >
      <ToastPrimitive.Content className="flex items-center gap-3 p-3 text-sm">
        <ToastPrimitive.Title className="min-w-0 flex-1 font-medium" />
        <ToastPrimitive.Close
          aria-label="Dismiss notification"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-muted"
        >
          <XIcon className="size-3.5" aria-hidden="true" />
        </ToastPrimitive.Close>
      </ToastPrimitive.Content>
    </ToastPrimitive.Root>
  ));
}

/** Provider plus viewport. The viewport is a polite live region, so notices are announced without stealing focus. */
export function Toaster() {
  return (
    <ToastPrimitive.Provider toastManager={toastManager} limit={3} timeout={4000}>
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport data-slot="toast-viewport" className="fixed right-4 bottom-4 z-50 h-12 w-[calc(100vw-2rem)] sm:w-80">
          <ToastList />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  );
}

export function notifyToast(message: string) {
  toastManager.add({ title: message });
}
