import { MenuIcon } from 'lucide-react';
import { Fragment } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { useT } from '../i18n';
import type { Command, CommandId } from '../reader/commands';
import { formatShortcut } from '../reader/shortcuts';
import { useReaderStore } from '../store/reader-store';

/** Menu groups in DESIGN order. Labels and availability come from the command registry, which the palette also reads. */
const GROUPS: CommandId[][] = [
  ['toggle-raw'],
  ['toggle-fullscreen'],
  ['print', 'export-html'],
  ['open-file'],
  ['open-folder'],
  ['open-url', 'command-palette'],
  ['settings', 'about'],
];

export function ReaderMenu({ commands }: { commands: Command[] }) {
  const t = useT();
  const state = useReaderStore(useShallow((s) => ({ text: s.text, writable: s.writable, mode: s.mode, docKind: s.docKind })));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="secondary" size="icon" className="reader-float reader-float--end" aria-label={t('reader.menu')} />}
      >
        <MenuIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {GROUPS.map((ids, index) => (
          <Fragment key={ids[0]}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              {ids.map((id) => {
                const command = commands.find((c) => c.id === id);
                return (
                  command && (
                    <DropdownMenuItem key={id} disabled={!command.available(state)} onClick={() => command.run()}>
                      {command.label}
                      {command.shortcut && <DropdownMenuShortcut>{formatShortcut(command.shortcut)}</DropdownMenuShortcut>}
                    </DropdownMenuItem>
                  )
                );
              })}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
