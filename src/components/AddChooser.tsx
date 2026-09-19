import { Folder, Images } from 'lucide-react'

interface Props {
  left: number
  top: number
  onPickFiles: () => void
  onPickFolder: () => void
  onCancel: () => void
}

/** Minimal Files vs Folder chooser after empty-canvas double-click. */
export function AddChooser({ left, top, onPickFiles, onPickFolder, onCancel }: Props) {
  return (
    <div
      className="add-chooser"
      style={{ left, top }}
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
      <button type="button" className="add-chooser__cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
