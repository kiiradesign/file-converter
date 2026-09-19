import { useCanvasStore } from '../store/canvasStore'

export function Breadcrumb() {
  const folderStack = useCanvasStore((s) => s.folderStack)
  const folders = useCanvasStore((s) => s.folders)
  const goBack = useCanvasStore((s) => s.goBack)
  const goToStackIndex = useCanvasStore((s) => s.goToStackIndex)

  if (folderStack.length === 0) return null

  return (
    <div className="breadcrumb">
      <button type="button" onClick={() => useCanvasStore.setState({ folderStack: [], draft: null })}>
        Canvas
      </button>
      {folderStack.map((id, i) => (
        <span key={id} style={{ display: 'contents' }}>
          <span className="sep">/</span>
          <button
            type="button"
            onClick={() => {
              if (i === folderStack.length - 1) return
              goToStackIndex(i)
            }}
          >
            {folders[id]?.name ?? 'Folder'}
          </button>
        </span>
      ))}
      <span className="sep">·</span>
      <button type="button" onClick={goBack}>
        Back
      </button>
    </div>
  )
}
