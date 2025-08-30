'use client'

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ZoomIn, ZoomOut, Move, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BlockData, GameData } from '../../../shared/types'

interface CanvasGameGridProps {
  game: GameData
  blocks: BlockData[]
  selectedBlocks?: Set<number>
  userAddress?: string
  onBlockSelect?: (blockId: number) => void
  onBlockDeselect?: (blockId: number) => void
  mode?: 'view' | 'select' | 'reveal'
  revealingBlocks?: Set<number>
  className?: string
}

interface ViewPort {
  x: number
  y: number
  zoom: number
}

interface BlockColors {
  alive: string
  eliminated: string
  unsold: string
  owned: string
  selected: string
}

export const CanvasGameGrid: React.FC<CanvasGameGridProps> = ({
  game,
  blocks,
  selectedBlocks = new Set(),
  userAddress,
  onBlockSelect,
  onBlockDeselect,
  mode = 'view',
  revealingBlocks = new Set(),
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<ViewPort>({ x: 0, y: 0, zoom: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })

  const { rows, cols } = game.config.gridSize
  const baseCellSize = 8 // Base cell size in pixels
  const cellSize = Math.max(2, baseCellSize * viewport.zoom)
  const gap = Math.max(1, viewport.zoom)

  // Create block map for O(1) lookup
  const blockMap = useMemo(() => {
    const map = new Map<number, BlockData>()
    blocks.forEach(block => {
      map.set(block.blockId, block)
    })
    return map
  }, [blocks])

  // Colors configuration
  const colors: BlockColors = {
    alive: '#10B981',     // green
    eliminated: '#EF4444', // red  
    unsold: '#E5E7EB',    // gray
    owned: '#F59E0B',     // yellow
    selected: '#3B82F6'   // blue
  }

  // Draw grid on canvas
  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Calculate visible area
    const visibleStartX = Math.max(0, Math.floor(-viewport.x / (cellSize + gap)))
    const visibleEndX = Math.min(cols, Math.ceil((canvas.width - viewport.x) / (cellSize + gap)) + 1)
    const visibleStartY = Math.max(0, Math.floor(-viewport.y / (cellSize + gap)))
    const visibleEndY = Math.min(rows, Math.ceil((canvas.height - viewport.y) / (cellSize + gap)) + 1)

    let renderedCount = 0

    // Draw only visible blocks
    for (let row = visibleStartY; row < visibleEndY; row++) {
      for (let col = visibleStartX; col < visibleEndX; col++) {
        const blockId = row * cols + col
        const block = blockMap.get(blockId)
        
        const x = viewport.x + col * (cellSize + gap)
        const y = viewport.y + row * (cellSize + gap)

        // Skip if outside canvas
        if (x + cellSize < 0 || y + cellSize < 0 || x > canvas.width || y > canvas.height) {
          continue
        }

        // Determine colors
        let fillColor = colors.unsold
        let strokeColor = '#D1D5DB'
        
        if (block) {
          if (block.status === 'alive') fillColor = colors.alive
          else if (block.status === 'eliminated') fillColor = colors.eliminated
          
          if (block.ownerId === userAddress) {
            strokeColor = colors.owned
            ctx.lineWidth = 2
          } else {
            ctx.lineWidth = 1
          }
        }

        if (selectedBlocks.has(blockId)) {
          strokeColor = colors.selected
          ctx.lineWidth = 2
        }

        if (revealingBlocks.has(blockId)) {
          // Pulsing effect for revealing blocks
          const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7
          ctx.globalAlpha = pulse
        } else {
          ctx.globalAlpha = 1
        }

        // Draw block
        ctx.fillStyle = fillColor
        ctx.strokeStyle = strokeColor
        ctx.fillRect(x, y, cellSize, cellSize)
        ctx.strokeRect(x, y, cellSize, cellSize)

        // Draw block ID for larger cells
        if (cellSize > 12 && blockId < 1000) {
          ctx.fillStyle = '#374151'
          ctx.font = `${Math.min(cellSize / 3, 8)}px monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(
            blockId.toString(), 
            x + cellSize / 2, 
            y + cellSize / 2
          )
        }

        // Draw status indicators for larger cells
        if (cellSize > 6) {
          const indicatorSize = Math.max(2, cellSize / 8)
          
          if (block?.status === 'alive') {
            ctx.fillStyle = '#059669'
            ctx.fillRect(x + cellSize - indicatorSize - 1, y + 1, indicatorSize, indicatorSize)
          } else if (block?.status === 'eliminated') {
            ctx.fillStyle = '#DC2626'
            ctx.fillRect(x + cellSize - indicatorSize - 1, y + 1, indicatorSize, indicatorSize)
          }
          
          if (block?.ownerId === userAddress) {
            ctx.fillStyle = '#D97706'
            ctx.fillRect(x + 1, y + cellSize - indicatorSize - 1, indicatorSize, indicatorSize)
          }
        }

        renderedCount++
      }
    }

    ctx.globalAlpha = 1

    // Draw grid info
    ctx.fillStyle = '#374151'
    ctx.font = '12px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`Rendered: ${renderedCount.toLocaleString()} / ${(rows * cols).toLocaleString()}`, 10, 20)
    ctx.fillText(`Zoom: ${(viewport.zoom * 100).toFixed(0)}% | Cell: ${cellSize}px`, 10, 35)
    ctx.fillText(`Position: (${(-viewport.x).toFixed(0)}, ${(-viewport.y).toFixed(0)})`, 10, 50)

  }, [
    viewport, 
    cellSize, 
    gap, 
    rows, 
    cols, 
    blockMap, 
    selectedBlocks, 
    revealingBlocks, 
    userAddress,
    colors,
    canvasSize
  ])

  // Handle canvas resize
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const width = Math.floor(rect.width)
        const height = Math.floor(rect.height)
        
        setCanvasSize({ width, height })
        
        const canvas = canvasRef.current
        canvas.width = width * window.devicePixelRatio
        canvas.height = height * window.devicePixelRatio
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
        }
      }
    }

    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    return () => window.removeEventListener('resize', updateCanvasSize)
  }, [])

  // Redraw when data changes
  useEffect(() => {
    drawGrid()
  }, [drawGrid])

  // Animation loop for revealing blocks
  useEffect(() => {
    if (revealingBlocks.size === 0) return

    const animate = () => {
      drawGrid()
      requestAnimationFrame(animate)
    }

    const animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [revealingBlocks.size, drawGrid])

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return

    const deltaX = e.clientX - dragStart.x
    const deltaY = e.clientY - dragStart.y

    setViewport(prev => ({
      ...prev,
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }))

    setDragStart({ x: e.clientX, y: e.clientY })
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (mode !== 'select' || isDragging) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left - viewport.x
    const y = e.clientY - rect.top - viewport.y

    const col = Math.floor(x / (cellSize + gap))
    const row = Math.floor(y / (cellSize + gap))

    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      const blockId = row * cols + col
      const block = blockMap.get(blockId)
      
      if (!block || block.status !== 'unsold') return

      if (selectedBlocks.has(blockId)) {
        onBlockDeselect?.(blockId)
      } else {
        onBlockSelect?.(blockId)
      }
    }
  }, [
    mode, 
    isDragging, 
    viewport, 
    cellSize, 
    gap, 
    rows, 
    cols, 
    blockMap, 
    selectedBlocks, 
    onBlockSelect, 
    onBlockDeselect
  ])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // e.preventDefault() // Remove to avoid passive listener warning
    
    const zoomFactor = 0.1
    const newZoom = Math.max(0.1, Math.min(5, viewport.zoom * (1 - e.deltaY * zoomFactor * 0.01)))
    
    // Zoom towards cursor position
    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      const zoomRatio = newZoom / viewport.zoom
      const newX = mouseX - (mouseX - viewport.x) * zoomRatio
      const newY = mouseY - (mouseY - viewport.y) * zoomRatio
      
      setViewport({
        x: newX,
        y: newY,
        zoom: newZoom
      })
    }
  }, [viewport])

  // Control functions
  const resetView = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 })
  }, [])

  const fitToView = useCallback(() => {
    if (!canvasSize.width || !canvasSize.height) return

    const gridWidth = cols * (baseCellSize + 1)
    const gridHeight = rows * (baseCellSize + 1)
    
    const scaleX = canvasSize.width / gridWidth
    const scaleY = canvasSize.height / gridHeight
    const scale = Math.min(scaleX, scaleY) * 0.9 // 90% to add padding

    const offsetX = (canvasSize.width - gridWidth * scale) / 2
    const offsetY = (canvasSize.height - gridHeight * scale) / 2

    setViewport({
      x: offsetX,
      y: offsetY,
      zoom: scale
    })
  }, [canvasSize, cols, rows, baseCellSize])

  const centerOnAliveBlocks = useCallback(() => {
    const aliveBlocks = blocks.filter(b => b.status === 'alive')
    if (aliveBlocks.length === 0) return

    // Calculate bounding box of alive blocks
    let minRow = rows, maxRow = 0, minCol = cols, maxCol = 0
    
    aliveBlocks.forEach(block => {
      minRow = Math.min(minRow, block.position.row)
      maxRow = Math.max(maxRow, block.position.row)
      minCol = Math.min(minCol, block.position.col)
      maxCol = Math.max(maxCol, block.position.col)
    })

    const centerRow = (minRow + maxRow) / 2
    const centerCol = (minCol + maxCol) / 2
    
    const targetX = canvasSize.width / 2 - centerCol * (cellSize + gap)
    const targetY = canvasSize.height / 2 - centerRow * (cellSize + gap)

    setViewport(prev => ({
      ...prev,
      x: targetX,
      y: targetY
    }))
  }, [blocks, rows, cols, canvasSize, cellSize, gap])

  // Stats
  const stats = useMemo(() => {
    const alive = blocks.filter(b => b.status === 'alive').length
    const eliminated = blocks.filter(b => b.status === 'eliminated').length
    const unsold = game.totalBlocks - blocks.length
    const owned = userAddress ? blocks.filter(b => b.ownerId === userAddress).length : 0
    
    return { alive, eliminated, unsold, owned }
  }, [blocks, game.totalBlocks, userAddress])

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Controls */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border">
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <div className="font-semibold">
              {game.config.gridSize.rows}×{game.config.gridSize.cols} Canvas Grid
            </div>
            <div className="text-gray-500">
              {game.totalBlocks.toLocaleString()} blocks total
            </div>
          </div>
          
          {mode === 'select' && (
            <div className="text-sm">
              <div className="font-semibold text-blue-600">
                {selectedBlocks.size} selected
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewport(prev => ({ ...prev, zoom: Math.min(5, prev.zoom * 1.5) }))}
            className="p-1 hover:bg-gray-100 rounded"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewport(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom / 1.5) }))}
            className="p-1 hover:bg-gray-100 rounded"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={fitToView}
            className="p-1 hover:bg-gray-100 rounded"
            title="Fit to View"
          >
            <Move className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            className="p-1 hover:bg-gray-100 rounded"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={centerOnAliveBlocks}
            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
            title="Center on Alive Blocks"
          >
            Center Alive
          </button>
        </div>
      </div>

      {/* Canvas Container */}
      <div 
        ref={containerRef}
        className="relative bg-white rounded-lg border overflow-hidden"
        style={{ height: '600px' }}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "w-full h-full",
            isDragging ? "cursor-grabbing" : "cursor-grab",
            mode === 'select' && "cursor-crosshair"
          )}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
          onWheel={handleWheel}
        />
        
        {/* Overlay UI */}
        <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
          <div>Zoom: {(viewport.zoom * 100).toFixed(0)}%</div>
          <div>Cell: {cellSize.toFixed(1)}px</div>
          {isDragging && <div className="text-yellow-300">Dragging...</div>}
        </div>

        {/* Performance indicator */}
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
          <div>🎨 Canvas Rendering</div>
          <div>High Performance Mode</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 justify-center text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: colors.alive }} />
          <span>Alive ({stats.alive.toLocaleString()})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: colors.eliminated }} />
          <span>Eliminated ({stats.eliminated.toLocaleString()})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: colors.unsold }} />
          <span>Unsold ({stats.unsold.toLocaleString()})</span>
        </div>
        {userAddress && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 rounded" style={{ borderColor: colors.owned }} />
            <span>Your Blocks ({stats.owned.toLocaleString()})</span>
          </div>
        )}
        {mode === 'select' && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 rounded" style={{ borderColor: colors.selected }} />
            <span>Selected ({selectedBlocks.size})</span>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center text-sm">
        <div className="bg-green-50 p-3 rounded">
          <div className="font-semibold text-green-700 text-lg">
            {stats.alive.toLocaleString()}
          </div>
          <div className="text-green-600">Alive</div>
        </div>
        <div className="bg-red-50 p-3 rounded">
          <div className="font-semibold text-red-700 text-lg">
            {stats.eliminated.toLocaleString()}
          </div>
          <div className="text-red-600">Eliminated</div>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <div className="font-semibold text-gray-700 text-lg">
            {stats.unsold.toLocaleString()}
          </div>
          <div className="text-gray-600">Unsold</div>
        </div>
        {userAddress && (
          <div className="bg-yellow-50 p-3 rounded">
            <div className="font-semibold text-yellow-700 text-lg">
              {stats.owned.toLocaleString()}
            </div>
            <div className="text-yellow-600">Your Blocks</div>
          </div>
        )}
        <div className="bg-blue-50 p-3 rounded">
          <div className="font-semibold text-blue-700 text-lg">
            {((stats.alive / game.totalBlocks) * 100).toFixed(1)}%
          </div>
          <div className="text-blue-600">Survival Rate</div>
        </div>
      </div>

      {/* Performance Info */}
      <div className="text-center text-xs text-gray-500 space-y-1">
        <div>
          🚀 High-Performance Canvas Rendering: {game.totalBlocks.toLocaleString()} blocks
        </div>
        <div>
          Only visible blocks rendered • Zoom: {(viewport.zoom * 100).toFixed(0)}% • 
          60fps animations • Hardware accelerated
        </div>
        <div>
          Alive: {stats.alive.toLocaleString()} • 
          EV: {game.currentEV.toFixed(4)} SOL • 
          Next EV: {game.nextRoundEV.toFixed(4)} SOL
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
        <div className="font-semibold mb-1">Controls:</div>
        <div className="space-y-1 text-xs">
          <div>• <strong>Drag</strong>: Pan around the grid</div>
          <div>• <strong>Scroll</strong>: Zoom in/out</div>
          <div>• <strong>Click</strong>: Select blocks (when in select mode)</div>
          <div>• <strong>Center Alive</strong>: Focus on surviving blocks</div>
        </div>
      </div>
    </div>
  )
}