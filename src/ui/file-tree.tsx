import { ChevronRight } from 'lucide-react';
import type { TreeNode } from '../source/directory';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/ui/collapsible';

export interface FileTreeProps {
  nodes: TreeNode[];
  activePath?: string | null;
  onSelectFile: (path: string, handle: FileSystemFileHandle) => void;
}

export function FileTree({ nodes, activePath, onSelectFile }: FileTreeProps) {
  if (nodes.length === 0) {
    return <div className="text-sm">No Markdown files found.</div>;
  }

  return (
    <ul className="nav-list" data-slot="file-tree">
      {nodes.map((node) => {
        if (node.kind === 'directory') {
          return (
            <li key={node.path}>
              <Collapsible defaultOpen>
                <CollapsibleTrigger
                  render={<button type="button" className="nav-item" data-slot="file-tree-toggle" aria-label={`Toggle ${node.name}`} />}
                >
                  <ChevronRight className="nav-caret" aria-hidden="true" />
                  <span>{node.name}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <FileTree nodes={node.children} activePath={activePath} onSelectFile={onSelectFile} />
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
              onClick={() => onSelectFile(node.path, node.handle)}
            >
              <span>{node.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
