import type { TreeNode } from '../source/directory';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/ui/collapsible';

export interface FileTreeProps {
  nodes: TreeNode[];
  activePath?: string | null;
  onSelectFile: (path: string, handle: FileSystemFileHandle) => void;
}

export function FileTree({ nodes, activePath, onSelectFile }: FileTreeProps) {
  if (nodes.length === 0) {
    return <div className="text-body-sm">No Markdown files found.</div>;
  }

  return (
    <ul className="tds-nav-list" role="tree">
      {nodes.map(node => {
        if (node.kind === 'directory') {
          return (
            <li key={node.path} role="treeitem">
              <Collapsible defaultOpen>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="tds-side-nav__nav-item"
                    aria-label={`Toggle ${node.name}`}
                  >
                    <span className="tds-caret" aria-hidden="true">
                      <svg viewBox="0 0 8 11" fill="currentColor">
                        <path d="M1.5 1.5L6.5 5.5L1.5 9.5" />
                      </svg>
                    </span>
                    <span>{node.name}</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <FileTree
                    nodes={node.children}
                    activePath={activePath}
                    onSelectFile={onSelectFile}
                  />
                </CollapsibleContent>
              </Collapsible>
            </li>
          );
        }

        const isActive = activePath === node.path;
        return (
          <li key={node.path} role="treeitem">
            <button
              type="button"
              className={`tds-side-nav__nav-item${isActive ? ' tds-side-nav__nav-item--active' : ''}`}
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
