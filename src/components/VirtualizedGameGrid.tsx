'use client'

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn, getBlockStatusColor } from '@/lib/utils'
import type { BlockData, GameData } from '../../../shared/types'

interface VirtualizedGameGridProps {
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

interface VisibleRange {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

export const VirtualizedGameGrid: React.FC<VirtualizedGameGridProps> = ({
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
  const { rows, cols } = game.config.gridSize
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({
    startRow: 0,
    endRow: Math.min(50, rows), // Show first 50 rows initially
    startCol: 0,
    endCol: Math.min(50, cols) // Show first 50 cols initially
  })
  const [cellSize, setCellSize] = useState(8) // Smaller cells for large grids

  // Create block map for O(1) lookup
  const blockMap = useMemo(() => {
    const map = new Map<number, BlockData>()
    blocks.forEach(block => {
      map.set(block.blockId, block)
    })
    return map
  }, [blocks])

  // Handle scroll to update visible range
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const scrollTop = container.scrollTop
    const scrollLeft = container.scrollLeft
    const containerHeight = container.clientHeight
    const containerWidth = container.clientWidth

    const startRow = Math.floor(scrollTop / (cellSize + 1))
    const endRow = Math.min(rows, startRow + Math.ceil(containerHeight / (cellSize + 1)) + 5)
    const startCol = Math.floor(scrollLeft / (cellSize + 1))
    const endCol = Math.min(cols, startCol + Math.ceil(containerWidth / (cellSize + 1)) + 5)

    setVisibleRange({ startRow, endRow, startCol, endCol })
  }, [cellSize, rows, cols])

  const handleBlockClick = useCallback((blockId: number) => {
    if (mode !== 'select') return

    const block = blockMap.get(blockId)
    if (!block || block.status !== 'unsold') return

    if (selectedBlocks.has(blockId)) {
      onBlockDeselect?.(blockId)
    } else {
      onBlockSelect?.(blockId)
    }
  }, [mode, blockMap, selectedBlocks, onBlockSelect, onBlockDeselect])

  // Generate visible blocks only
  const visibleBlocks = useMemo(() => {
    const visible: Array<{blockId: number, row: number, col: number, block?: BlockData}> = []
    
    for (let row = visibleRange.startRow; row < visibleRange.endRow; row++) {
      for (let col = visibleRange.startCol; col < visibleRange.endCol; col++) {
        const blockId = row * cols + col
        const block = blockMap.get(blockId)
        visible.push({ blockId, row, col, block })
      }
    }
    
    return visible
  }, [visibleRange, cols, blockMap])

  // Stats
  const aliveCount = blocks.filter(b => b.status === 'alive').length
  const eliminatedCount = blocks.filter(b => b.status === 'eliminated').length
  const unsoldCount = game.totalBlocks - blocks.length
  const ownedCount = userAddress ? blocks.filter(b => b.ownerId === userAddress).length : 0

  return (
    <div className={cn('w-full', className)}>
      {/* Grid Info */}
      <div className="mb-4 flex justify-between items-center text-sm text-gray-600">
        <div>
          Grid: {rows} × {cols} ({game.totalBlocks.toLocaleString()} blocks)
        </div>
        <div className="flex items-center gap-4">
          {mode === 'select' && (
            <div>Selected: {selectedBlocks.size} blocks</div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-xs">Cell Size:</label>
            <input
              type="range"
              min="4"
              max="20"
              value={cellSize}
              onChange={(e) => setCellSize(parseInt(e.target.value))}
              className="w-16"
            />
            <span className="text-xs">{cellSize}px</span>
          </div>
        </div>
      </div>

      {/* Scrollable Grid Container */}
      <div 
        ref={containerRef}
        className="border-2 border-gray-300 rounded-lg overflow-auto bg-white"
        style={{ 
          height: '600px',
          width: '100%'
        }}
        onScroll={handleScroll}
      >
        {/* Full grid size container */}
        <div 
          style={{
            height: rows * (cellSize + 1),
            width: cols * (cellSize + 1),
            position: 'relative'
          }}
        >
          {/* Render only visible blocks */}
          {visibleBlocks.map(({ blockId, row, col, block }) => {
            const actualBlock = block || {
              gameId: game.gameId,
              blockId,
              position: { row, col },
              status: 'unsold' as const,
              purchasePrice: game.config.blockPrice,
              transactionHistory: []
            }

            const isSelected = selectedBlocks.has(blockId)
            const isOwned = actualBlock.ownerId === userAddress
            const isRevealing = revealingBlocks.has(blockId)
            const isSelectable = mode === 'select' && actualBlock.status === 'unsold'
            const baseColor = getBlockStatusColor(actualBlock.status, isOwned)

            return (
              <div
                key={blockId}
                className={cn(
                  'absolute border cursor-pointer transition-all duration-100',
                  'flex items-center justify-center text-[8px] font-mono',
                  baseColor,
                  isSelected && 'ring-1 ring-blue-500',
                  isSelectable && 'hover:border-blue-400 hover:bg-blue-50',
                  !isSelectable && mode === 'select' && 'opacity-50 cursor-not-allowed',
                  isRevealing && 'animate-pulse'
                )}
                style={{
                  left: col * (cellSize + 1),
                  top: row * (cellSize + 1),
                  width: cellSize,
                  height: cellSize
                }}
                onClick={isSelectable ? () => handleBlockClick(blockId) : undefined}
                title={`Block #${blockId} (${row}, ${col}) - ${actualBlock.status}`}
              >
                {/* Minimal content for performance - only show ID for small blocks */}
                {cellSize >= 12 && blockId < 1000 && (
                  <div className="select-none text-[6px]">{blockId}</div>
                )}

                {/* Status indicators */}
                {cellSize >= 8 && (
                  <>
                    {actualBlock.status === 'alive' && (
                      <div className="absolute top-0 right-0 w-1 h-1 bg-green-500 rounded-full" />
                    )}
                    {actualBlock.status === 'eliminated' && (
                      <div className="absolute top-0 right-0 w-1 h-1 bg-red-500 rounded-full" />
                    )}
                    {isOwned && (
                      <div className="absolute bottom-0 right-0 w-1 h-1 bg-yellow-500 rounded-full" />
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Navigation Info */}
      <div className="mt-2 text-center text-xs text-gray-500">
        Viewing rows {visibleRange.startRow}-{visibleRange.endRow} • 
        cols {visibleRange.startCol}-{visibleRange.endCol} • 
        Rendering {visibleBlocks.length.toLocaleString()} / {game.totalBlocks.toLocaleString()} blocks
      </div>

      {/* Statistics */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-center text-sm">
        <div className="bg-green-50 p-3 rounded">
          <div className="font-semibold text-green-700 text-lg">
            {aliveCount.toLocaleString()}
          </div>
          <div className="text-green-600">Alive</div>
        </div>
        <div className="bg-red-50 p-3 rounded">
          <div className="font-semibold text-red-700 text-lg">
            {eliminatedCount.toLocaleString()}
          </div>
          <div className="text-red-600">Eliminated</div>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <div className="font-semibold text-gray-700 text-lg">
            {unsoldCount.toLocaleString()}
          </div>
          <div className="text-gray-600">Unsold</div>
        </div>
        {userAddress && (
          <div className="bg-yellow-50 p-3 rounded">
            <div className="font-semibold text-yellow-700 text-lg">
              {ownedCount.toLocaleString()}
            </div>
            <div className="text-yellow-600">Your Blocks</div>
          </div>
        )}
        <div className="bg-blue-50 p-3 rounded">
          <div className="font-semibold text-blue-700 text-lg">
            {((aliveCount / game.totalBlocks) * 100).toFixed(1)}%
          </div>
          <div className="text-blue-600">Survival Rate</div>
        </div>
      </div>

      {/* Performance Info */}
      <div className="mt-4 text-center text-xs text-gray-500 space-y-1">
        <div>
          Large grid: {game.totalBlocks.toLocaleString()} blocks using viewport rendering
        </div>
        <div>
          Alive: {aliveCount.toLocaleString()} • 
          Current EV: {game.currentEV.toFixed(4)} SOL • 
          Next EV: {game.nextRoundEV.toFixed(4)} SOL
        </div>
        <div className="text-xs">
          Mode: {mode} • Cell Size: {cellSize}px • 
          Performance: Rendering only visible blocks
        </div>
      </div>
    </div>
  )
}