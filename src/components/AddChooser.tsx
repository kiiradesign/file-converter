import { Folder, Images } from 'lucide-react'

interface Props {
  left?: number
  top?: number
  /** Centered empty-state vs floating double-click instance. */
  centered?: boolean
  onPickFiles: () => void
  onPickFolder: () => void
}

/** Files / Folder picker — empty canvas default + double-click floating instance. */
export function AddChooser({
  left,
  top,
  centered = false,
  onPickFiles,
  onPickFolder,
}: Props) {
  return (
    <div
      className={`add-chooser${centered ? ' add-chooser--centered' : ''}`}
      style={centered ? undefined : { left, top }}
      role="dialog"
      aria-label="Add to canvas"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="add-chooser__hint">Add to canvas</p>
      <button type="button" className="add-chooser__option" onClick={onPickFiles}>
        <Images size={16} strokeWidth={1.75} />
        <span>
          <strong>Files</strong>
          <em>Select one or more images</em>
        </span>
      </button>
      <button type="button" className="add-chooser__option" onClick={onPickFolder}>
        <Folder size={16} strokeWidth={1.75} />
        <span>
          <strong>Folder</strong>
          <em>Select an entire folder</em>
        </span>
      </button>
    </div>
  )
}
