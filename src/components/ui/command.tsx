'use client';

import type * as React from 'react';
import { Autocomplete as AutocompletePrimitive } from '@base-ui/react/autocomplete';
import { SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Command palette primitives: Base UI Dialog around an always-open inline Autocomplete, no `cmdk`. */
function CommandDialog({
  title = 'Command palette',
  description = 'Search for a command, heading, file, or recent document.',
  children,
  className,
  finalFocus,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, 'children'> & {
  children?: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  finalFocus?: React.ComponentProps<typeof DialogContent>['finalFocus'];
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        showCloseButton={false}
        finalFocus={finalFocus}
        className={cn('top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl', className)}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Highlights the first match whenever the query changes, so Enter runs the top result. */
function Command<Group extends { items: readonly unknown[] }>({
  items,
  ...props
}: Omit<AutocompletePrimitive.Root.Props<Group['items'][number]>, 'items' | 'inline' | 'open'> & { items: readonly Group[] }) {
  return <AutocompletePrimitive.Root items={items} inline open autoHighlight="always" keepHighlight {...props} />;
}

function CommandInput({ className, ...props }: AutocompletePrimitive.Input.Props) {
  return (
    <div data-slot="command-input-wrapper" className="flex h-11 items-center gap-2 border-b px-3">
      <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <AutocompletePrimitive.Input
        data-slot="command-input"
        className={cn(
          'h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: AutocompletePrimitive.List.Props) {
  return (
    <AutocompletePrimitive.List
      data-slot="command-list"
      className={cn('max-h-80 overflow-y-auto overscroll-contain p-1 outline-none', className)}
      {...props}
    />
  );
}

function CommandEmpty({ className, ...props }: AutocompletePrimitive.Empty.Props) {
  return (
    <AutocompletePrimitive.Empty
      data-slot="command-empty"
      className={cn('py-6 text-center text-sm text-muted-foreground empty:p-0', className)}
      {...props}
    />
  );
}

function CommandGroup({ className, ...props }: AutocompletePrimitive.Group.Props) {
  return <AutocompletePrimitive.Group data-slot="command-group" className={cn('py-1', className)} {...props} />;
}

function CommandGroupLabel({ className, ...props }: AutocompletePrimitive.GroupLabel.Props) {
  return (
    <AutocompletePrimitive.GroupLabel
      data-slot="command-group-label"
      className={cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', className)}
      {...props}
    />
  );
}

const CommandCollection = AutocompletePrimitive.Collection;

function CommandItem({ className, ...props }: AutocompletePrimitive.Item.Props) {
  return (
    <AutocompletePrimitive.Item
      data-slot="command-item"
      className={cn(
        'flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-muted data-highlighted:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<'kbd'>) {
  return <kbd data-slot="command-shortcut" className={cn('ml-auto text-xs text-muted-foreground', className)} {...props} />;
}

export {
  Command,
  CommandCollection,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
};
