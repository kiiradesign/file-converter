import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'
import { memo } from 'react'

function ConversionEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={{
        stroke: 'var(--fc-wire)',
        strokeWidth: 1.5,
        ...style,
      }}
    />
  )
}

export const ConversionEdge = memo(ConversionEdgeComponent)
