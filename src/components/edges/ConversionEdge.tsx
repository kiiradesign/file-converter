import { BaseEdge, type EdgeProps } from '@xyflow/react'
import { memo } from 'react'

function ConversionEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
}: EdgeProps) {
  const dx = Math.max(80, Math.abs(targetX - sourceX) * 0.45)
  const path = `M ${sourceX},${sourceY} C ${sourceX + dx},${sourceY} ${targetX - dx},${targetY} ${targetX},${targetY}`

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={{
        stroke: 'var(--fc-wire)',
        strokeWidth: 1.6,
        fill: 'none',
        ...style,
      }}
    />
  )
}

export const ConversionEdge = memo(ConversionEdgeComponent)
