import { subtreeEventIds } from '../../logic/filter'
import type { FieldNode } from '../../types'

interface Props {
  nodes: FieldNode[]
  selected: string | null
  allLabel: string
  total: number
  onSelect: (id: string | null) => void
}

function Node({ node, selected, onSelect }: { node: FieldNode; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <li>
      <button type="button" class="tree-item" aria-pressed={selected === node.id} onClick={() => onSelect(node.id)}>
        <span>{node.title}</span>
        <span class="tree-count">{subtreeEventIds(node).size}</span>
      </button>
      {node.children.length > 0 && (
        <ul>{node.children.map((c) => <Node key={c.id} node={c} selected={selected} onSelect={onSelect} />)}</ul>
      )}
    </li>
  )
}

export function Tree({ nodes, selected, allLabel, total, onSelect }: Props) {
  return (
    <ul class="tree">
      <li>
        <button type="button" class="tree-item" aria-pressed={selected === null} onClick={() => onSelect(null)}>
          <span>{allLabel}</span>
          <span class="tree-count">{total}</span>
        </button>
      </li>
      {nodes.map((n) => <Node key={n.id} node={n} selected={selected} onSelect={onSelect} />)}
    </ul>
  )
}
