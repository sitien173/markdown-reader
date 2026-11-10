import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react';
import { useT } from '../i18n';
import type { TreeNode } from '../source/directory';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/ui/collapsible';

export interface FileTreeProps {
  nodes: TreeNode[];
  activePath?: string | null;
  onSelectFile: (path: string) => void;
  /** Case-insensitive name filter. A folder stays when any file inside it matches. */
  filter?: string;
  onExpandFolder?: (path: string) => void;
}

function filterTree(nodes: TreeNode[], needle: string): TreeNode[] {
  return nodes.flatMap<TreeNode>((node) => {
    if (node.kind !== 'directory') return node.name.toLowerCase().includes(needle) ? [node] : [];
    if (node.children === null) {
      return node.name.toLowerCase().includes(needle) ? [node] : [];
    }
    const children = filterTree(node.children, needle);
    return children.length > 0 ? [{ ...node, children }] : [];
  });
}

export function FileTree({ nodes, activePath, onSelectFile, filter = '', onExpandFolder }: FileTreeProps) {
  const t = useT();
  const needle = filter.trim().toLowerCase();
  const shown = needle ? filterTree(nodes, needle) : nodes;
  if (shown.length === 0) {
    return (
      <div className="text-sm text-muted-foreground px-2 py-3 text-center">
        {needle ? t('reader.noMatches') : 'No Markdown files found.'}
      </div>
    );
  }

  return (
    <ul className="nav-list" data-slot="file-tree">
      {shown.map((node) => {
        if (node.kind === 'directory') {
          return (
            <li key={node.path}>
              <Collapsible
                defaultOpen={node.children !== null}
                onOpenChange={(open) => {
                  if (open && node.children === null && onExpandFolder) {
                    onExpandFolder(node.path);
                  }
                }}
              >
                <CollapsibleTrigger
                  render={
                    <button
                      type="button"
                      className="nav-item group"
                      data-slot="file-tree-toggle"
                      aria-label={`Toggle ${node.name}`}
                      title={node.name}
                    />
                  }
                >
                  <ChevronRight className="nav-caret" aria-hidden="true" />
                  <Folder className="nav-folder-closed" aria-hidden="true" />
                  <FolderOpen className="nav-folder-open" aria-hidden="true" />
                  <span className="truncate">{node.name}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {node.error ? (
                    <div className="text-sm text-destructive px-2 py-1" data-slot="file-tree-error">
                      {t('reader.couldNotReadFolder')}
                    </div>
                  ) : (
                    <FileTree
                      nodes={node.children ?? []}
                      activePath={activePath}
                      onSelectFile={onSelectFile}
                      filter={filter}
                      onExpandFolder={onExpandFolder}
                    />
                  )}
                </CollapsibleContent>
              </Collapsible>
            </li>
          );
        }

        const isActive = activePath === node.path;
        return (
          <li key={node.path}>
            <button
              type="button"
              data-slot="file-tree-file"
              className={`nav-item${isActive ? ' nav-item--active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              title={node.name}
              onClick={() => onSelectFile(node.path)}
            >
              <span className="nav-item-spacer" aria-hidden="true" />
              <FileText className="nav-file-icon" aria-hidden="true" />
              <span className="truncate">{node.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
