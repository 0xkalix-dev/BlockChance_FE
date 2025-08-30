import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ZoomIn, ZoomOut, Move3D, Smartphone } from 'lucide-react'
import { cn } from '../lib/utils'
import type { BlockData, GameData } from '../../../shared/types'

interface MobileCanvasProps {
  game: GameData
  blocks: BlockData[]
  selectedBlocks?: Set<number>
  userAddress?: string
  onBlockSelect?: (blockId: number) => void
  onBlockDeselect?: (blockId: number) => void
  mode?: 'view' | 'select' | 'reveal'
  revealingBlocks?: Set<number>
}

export const MobileOptimizedCanvas: React.FC<MobileCanvasProps> = ({
  game,
  blocks,
  selectedBlocks = new Set(),
  userAddress,
  onBlockSelect,
  onBlockDeselect,
  mode = 'view',
  revealingBlocks = new Set()
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 0.3 }) // Start zoomed out on mobile
  const [isDragging, setIsDragging] = useState(false)
  const [isTouch, setIsTouch] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 350, height: 350 })

  const { rows, cols } = game.config.gridSize
  const baseCellSize = 6 // Smaller base size for mobile
  const cellSize = Math.max(1, baseCellSize * viewport.zoom)
  const gap = Math.max(0.5, viewport.zoom)

  // Detect touch device
  useEffect(() => {
    setIsTouch('ontouchstart' in window)
  }, [])

  // Create efficient block lookup
  const blockMap = useMemo(() => {
    const map = new Map<number, BlockData>()
    blocks.forEach(block => map.set(block.blockId, block))
    return map
  }, [blocks])

  // Mobile-optimized colors (higher contrast)
  const colors = {
    alive: '#059669',     // Darker green
    eliminated: '#DC2626', // Darker red
    unsold: '#D1D5DB',    // Light gray
    owned: '#D97706',     // Darker yellow
    selected: '#2563EB'   // Darker blue
  }

  // Optimized draw function for mobile
  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear with solid background
    ctx.fillStyle = '#F9FAFB'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Calculate visible area with wider buffer for smooth scrolling
    const buffer = 20
    const visibleStartX = Math.max(0, Math.floor((-viewport.x - buffer) / (cellSize + gap)))
    const visibleEndX = Math.min(cols, Math.ceil((canvas.width - viewport.x + buffer) / (cellSize + gap)))
    const visibleStartY = Math.max(0, Math.floor((-viewport.y - buffer) / (cellSize + gap)))
    const visibleEndY = Math.min(rows, Math.ceil((canvas.height - viewport.y + buffer) / (cellSize + gap)))

    let renderedCount = 0

    // Batch rendering for performance
    const blocksToRender = []
    for (let row = visibleStartY; row < visibleEndY; row++) {
      for (let col = visibleStartX; col < visibleEndX; col++) {
        const blockId = row * cols + col
        const x = viewport.x + col * (cellSize + gap)
        const y = viewport.y + row * (cellSize + gap)

        if (x + cellSize >= 0 && y + cellSize >= 0 && x < canvas.width && y < canvas.height) {
          blocksToRender.push({ blockId, x, y, row, col })
        }
      }
    }

    // Render blocks in batches
    blocksToRender.forEach(({ blockId, x, y }) => {
      const block = blockMap.get(blockId)
      
      // Determine colors
      let fillColor = colors.unsold
      let strokeWidth = 0.5

      if (block) {
        if (block.status === 'alive') fillColor = colors.alive
        else if (block.status === 'eliminated') fillColor = colors.eliminated
        
        if (block.ownerId === userAddress) {
          ctx.strokeStyle = colors.owned
          strokeWidth = 1.5
        }
      }

      if (selectedBlocks.has(blockId)) {
        ctx.strokeStyle = colors.selected
        strokeWidth = 2
      }

      // Pulsing for revealing blocks
      if (revealingBlocks.has(blockId)) {
        const pulse = Math.sin(Date.now() * 0.008) * 0.3 + 0.7
        ctx.globalAlpha = pulse
      } else {
        ctx.globalAlpha = 1
      }

      // Draw block (no stroke for very small cells)
      ctx.fillStyle = fillColor
      ctx.fillRect(x, y, cellSize, cellSize)
      
      if (cellSize > 3 && strokeWidth > 0) {
        ctx.lineWidth = strokeWidth
        ctx.strokeRect(x, y, cellSize, cellSize)
      }

      renderedCount++
    })

    ctx.globalAlpha = 1

    // Mobile-optimized info overlay
    if (cellSize > 0.5) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
      ctx.fillRect(5, 5, Math.min(200, canvas.width - 10), isTouch ? 60 : 45)
      
      ctx.fillStyle = '#FFFFFF'
      ctx.font = '12px system-ui'
      ctx.textAlign = 'left'
      ctx.fillText(`${renderedCount.toLocaleString()}/${(rows * cols).toLocaleString()}`, 10, 20)
      ctx.fillText(`${(viewport.zoom * 100).toFixed(0)}% | ${cellSize.toFixed(1)}px`, 10, 35)
      
      if (isTouch) {
        ctx.font = '10px system-ui'
        ctx.fillText('Pinch to zoom • Drag to pan', 10, 50)
      }
    }
  }, [viewport, cellSize, gap, rows, cols, blockMap, selectedBlocks, revealingBlocks, userAddress, colors, canvasSize, isTouch])

  // Touch event handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      setIsDragging(true)
      const touch = e.touches[0]
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        // Store initial touch position
        canvasRef.current!.dataset.lastX = touch.clientX.toString()
        canvasRef.current!.dataset.lastY = touch.clientY.toString()
      }
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    
    if (e.touches.length === 1 && isDragging) {
      // Single finger drag
      const touch = e.touches[0]
      const canvas = canvasRef.current
      if (!canvas) return

      const lastX = parseInt(canvas.dataset.lastX || '0')
      const lastY = parseInt(canvas.dataset.lastY || '0')
      
      const deltaX = touch.clientX - lastX
      const deltaY = touch.clientY - lastY

      setViewport(prev => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }))

      canvas.dataset.lastX = touch.clientX.toString()
      canvas.dataset.lastY = touch.clientY.toString()
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      )
      
      const canvas = canvasRef.current
      if (!canvas) return
      
      const lastDistance = parseFloat(canvas.dataset.lastDistance || distance.toString())
      const scale = distance / lastDistance
      
      if (Math.abs(scale - 1) > 0.01) { // Threshold to prevent jitter
        const newZoom = Math.max(0.1, Math.min(3, viewport.zoom * scale))
        setViewport(prev => ({
          ...prev,
          zoom: newZoom
        }))
      }
      
      canvas.dataset.lastDistance = distance.toString()
    }
  }, [isDragging, viewport.zoom])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    // Handle tap selection for mobile
    if (e.changedTouches.length === 1 && !isDragging && mode === 'select') {
      const touch = e.changedTouches[0]
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = touch.clientX - rect.left - viewport.x
      const y = touch.clientY - rect.top - viewport.y

      const col = Math.floor(x / (cellSize + gap))
      const row = Math.floor(y / (cellSize + gap))

      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        const blockId = row * cols + col
        const block = blockMap.get(blockId)
        
        if (block && block.status === 'unsold') {
          if (selectedBlocks.has(blockId)) {
            onBlockDeselect?.(blockId)
          } else {
            onBlockSelect?.(blockId)
          }
        }
      }
    }
  }, [isDragging, mode, viewport, cellSize, gap, rows, cols, blockMap, selectedBlocks, onBlockSelect, onBlockDeselect])

  // Canvas resize for mobile
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current && canvasRef.current) {
        const container = containerRef.current
        const rect = container.getBoundingClientRect()
        
        // Mobile: use available width, limit height
        const maxWidth = Math.min(rect.width, window.innerWidth - 16)
        const maxHeight = Math.min(400, window.innerHeight * 0.6) // 60% of viewport height
        
        const width = Math.floor(maxWidth)
        const height = Math.floor(maxHeight)
        
        setCanvasSize({ width, height })
        
        const canvas = canvasRef.current
        const dpr = Math.min(window.devicePixelRatio, 2) // Limit DPR for performance
        
        canvas.width = width * dpr
        canvas.height = height * dpr
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.scale(dpr, dpr)
          ctx.imageSmoothingEnabled = false // Disable for crisp pixels
        }
      }
    }

    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    window.addEventListener('orientationchange', updateCanvasSize)
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize)
      window.removeEventListener('orientationchange', updateCanvasSize)
    }
  }, [])

  useEffect(() => {
    drawGrid()
  }, [drawGrid])

  // Fit grid to view
  const fitToView = useCallback(() => {
    const gridWidth = cols * (baseCellSize + 0.5)
    const gridHeight = rows * (baseCellSize + 0.5)
    
    const scaleX = canvasSize.width / gridWidth
    const scaleY = canvasSize.height / gridHeight
    const scale = Math.min(scaleX, scaleY) * 0.8
    
    const offsetX = (canvasSize.width - gridWidth * scale) / 2
    const offsetY = (canvasSize.height - gridHeight * scale) / 2

    setViewport({ x: offsetX, y: offsetY, zoom: scale })
  }, [canvasSize, cols, rows, baseCellSize])

  // Auto-fit on load
  useEffect(() => {
    if (canvasSize.width > 0 && canvasSize.height > 0) {
      fitToView()
    }
  }, [canvasSize, fitToView])

  // Stats
  const stats = useMemo(() => {
    const alive = blocks.filter(b => b.status === 'alive').length
    const eliminated = blocks.filter(b => b.status === 'eliminated').length
    const unsold = game.totalBlocks - blocks.length
    const owned = userAddress ? blocks.filter(b => b.ownerId === userAddress).length : 0
    
    return { alive, eliminated, unsold, owned }
  }, [blocks, game.totalBlocks, userAddress])

  return (
    <div className="w-full space-y-3">
      {/* Mobile Controls */}
      <div className="flex items-center justify-between bg-white p-3 rounded-lg border text-sm">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-blue-600" />
          <div>
            <div className="font-semibold">Mobile Canvas</div>
            <div className="text-xs text-gray-500">
              {game.config.gridSize.rows}×{game.config.gridSize.cols}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewport(prev => ({ ...prev, zoom: Math.min(2, prev.zoom * 1.4) }))}
            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewport(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom / 1.4) }))}
            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={fitToView}
            className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 active:bg-blue-300 transition-colors"
          >
            <Move3D className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas Container */}
      <div 
        ref={containerRef}
        className="relative bg-white rounded-lg border overflow-hidden touch-none"
        style={{ 
          height: `${canvasSize.height}px`,
          maxHeight: '60vh' 
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            touchAction: 'none', // Prevent native gestures
            userSelect: 'none'
          }}
        />
        
        {/* Mobile overlay */}
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
          <div>📱 {(viewport.zoom * 100).toFixed(0)}%</div>
        </div>

        {/* Performance indicator */}
        <div className="absolute bottom-2 left-2 bg-green-600 bg-opacity-90 text-white text-xs p-2 rounded">
          <div>🚀 HW Accel</div>
        </div>
      </div>

      {/* Mobile-optimized stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-green-50 p-3 rounded-lg text-center">
          <div className="font-bold text-green-700 text-lg">
            {stats.alive.toLocaleString()}
          </div>
          <div className="text-green-600 text-sm">Alive</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg text-center">
          <div className="font-bold text-red-700 text-lg">
            {stats.eliminated.toLocaleString()}
          </div>
          <div className="text-red-600 text-sm">Eliminated</div>
        </div>
        {userAddress && (
          <div className="bg-yellow-50 p-3 rounded-lg text-center">
            <div className="font-bold text-yellow-700 text-lg">
              {stats.owned.toLocaleString()}
            </div>
            <div className="text-yellow-600 text-sm">Your Blocks</div>
          </div>
        )}
        <div className="bg-blue-50 p-3 rounded-lg text-center">
          <div className="font-bold text-blue-700 text-lg">
            {((stats.alive / game.totalBlocks) * 100).toFixed(1)}%
          </div>
          <div className="text-blue-600 text-sm">Survival</div>
        </div>
      </div>

      {/* Mobile instructions */}
      <div className="bg-blue-50 p-3 rounded-lg">
        <div className="text-sm font-medium text-blue-800 mb-1">
          📱 Mobile Controls
        </div>
        <div className="text-xs text-blue-700 space-y-1">
          <div>• Drag with one finger to pan around</div>
          <div>• Pinch with two fingers to zoom</div>
          <div>• Tap blocks to select (in mint mode)</div>
          <div>• Use buttons above for precise zoom control</div>
        </div>
      </div>

      {/* Performance info */}
      <div className="text-center text-xs text-gray-500">
        🚀 Mobile-optimized Canvas • Hardware accelerated •
        Rendering {((stats.alive + stats.eliminated) / game.totalBlocks * 100).toFixed(1)}% efficiently
      </div>
    </div>
  )
}