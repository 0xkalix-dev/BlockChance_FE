'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, getBlockStatusColor, getBlockPosition } from '@/lib/utils'
import { VirtualizedGameGrid } from './VirtualizedGameGrid'
import { CanvasGameGrid } from './CanvasGameGrid'
import { MobileOptimizedCanvas } from './MobileOptimizedCanvas'
import type { BlockData, GameData } from '../../../shared/types'

interface GameGridProps {
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

interface BlockProps {
  block: BlockData
  game: GameData
  isSelected: boolean
  isOwned: boolean
  isRevealing: boolean
  onClick?: () => void
  mode: 'view' | 'select' | 'reveal'
}

const Block: React.FC<BlockProps> = React.memo(({ 
  block, 
  game, 
  isSelected, 
  isOwned, 
  isRevealing,
  onClick, 
  mode 
}) => {
  const position = getBlockPosition(block.blockId, game.config.gridSize.cols)
  const isSelectable = mode === 'select' && block.status === 'unsold'
  const baseColor = getBlockStatusColor(block.status, isOwned)

  return (
    <motion.div
      className={cn(
        "relative aspect-square border-2 rounded-lg cursor-pointer",
        "transition-all duration-200 hover:scale-105",
        "flex items-center justify-center",
        baseColor,
        isSelected && "ring-2 ring-blue-500 ring-offset-1",
        isSelectable && "hover:border-blue-400 hover:bg-blue-50",
        !isSelectable && mode === 'select' && "opacity-50 cursor-not-allowed",
        isRevealing && "animate-pulse",
        "min-h-[40px] min-w-[40px]"
      )}
      onClick={isSelectable ? onClick : undefined}
      whileHover={isSelectable ? { scale: 1.05 } : undefined}
      whileTap={isSelectable ? { scale: 0.95 } : undefined}
      initial={false}
      animate={{
        scale: isRevealing ? [1, 1.1, 1] : 1,
      }}
      transition={{ duration: 0.3 }}
    >
      {/* Block ID */}
      <div className="text-xs font-mono text-gray-700 select-none">
        {block.blockId}
      </div>

      {/* Status indicator */}
      <div className="absolute top-1 right-1">
        {block.status === 'alive' && (
          <div className="w-2 h-2 bg-green-500 rounded-full" />
        )}
        {block.status === 'eliminated' && (
          <div className="w-2 h-2 bg-red-500 rounded-full" />
        )}
        {isOwned && (
          <div className="w-2 h-2 bg-yellow-500 rounded-full" />
        )}
      </div>

      {/* Price indicator */}
      {(mode === 'select' && block.status === 'unsold') && (
        <div className="absolute bottom-1 left-1 text-[10px] font-semibold text-gray-600">
          {block.purchasePrice.toFixed(3)}
        </div>
      )}

      {/* Owner indicator */}
      {block.ownerId && (
        <div className="absolute bottom-1 right-1 text-[8px] text-gray-500">
          {block.ownerId.slice(-3)}
        </div>
      )}

      {/* Selection overlay */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            className="absolute inset-0 bg-blue-500 bg-opacity-20 rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Elimination animation */}
      <AnimatePresence>
        {isRevealing && block.status === 'eliminated' && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-2xl">💥</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

export const GameGrid: React.FC<GameGridProps> = ({
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
  const totalBlocks = rows * cols
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  // Use Mobile Canvas for mobile devices with large grids
  if (isMobile && totalBlocks > 1000) {
    return (
      <MobileOptimizedCanvas
        game={game}
        blocks={blocks}
        selectedBlocks={selectedBlocks}
        userAddress={userAddress}
        onBlockSelect={onBlockSelect}
        onBlockDeselect={onBlockDeselect}
        mode={mode}
        revealingBlocks={revealingBlocks}
      />
    )
  }

  // Use Canvas for ultra-large grids on desktop (>5000 blocks)
  if (totalBlocks > 5000) {
    return (
      <CanvasGameGrid
        game={game}
        blocks={blocks}
        selectedBlocks={selectedBlocks}
        userAddress={userAddress}
        onBlockSelect={onBlockSelect}
        onBlockDeselect={onBlockDeselect}
        mode={mode}
        revealingBlocks={revealingBlocks}
        className={className}
      />
    )
  }

  // Use virtualized grid for large grids (1000-5000 blocks)
  if (totalBlocks > 1000) {
    return (
      <VirtualizedGameGrid
        game={game}
        blocks={blocks}
        selectedBlocks={selectedBlocks}
        userAddress={userAddress}
        onBlockSelect={onBlockSelect}
        onBlockDeselect={onBlockDeselect}
        mode={mode}
        revealingBlocks={revealingBlocks}
        className={className}
      />
    )
  }

  // Create grid array for small grids
  const gridBlocks = Array.from({ length: totalBlocks }, (_, index) => {
    return blocks.find(block => block.blockId === index) || {
      gameId: game.gameId,
      blockId: index,
      position: getBlockPosition(index, cols),
      status: 'unsold' as const,
      purchasePrice: game.config.blockPrice,
      transactionHistory: []
    }
  })

  const handleBlockClick = useCallback((blockId: number) => {
    if (mode !== 'select') return

    const block = blocks.find(b => b.blockId === blockId)
    if (!block || block.status !== 'unsold') return

    if (selectedBlocks.has(blockId)) {
      onBlockDeselect?.(blockId)
    } else {
      onBlockSelect?.(blockId)
    }
  }, [mode, blocks, selectedBlocks, onBlockSelect, onBlockDeselect])

  return (
    <div className={cn("w-full max-w-4xl mx-auto", className)}>
      {/* Grid info */}
      <div className="mb-4 flex justify-between items-center text-sm text-gray-600">
        <div>
          Grid: {rows} × {cols} ({totalBlocks.toLocaleString()} blocks)
        </div>
        {mode === 'select' && (
          <div>
            Selected: {selectedBlocks.size} blocks
          </div>
        )}
      </div>

      {/* Grid */}
      <div 
        className="grid gap-1 md:gap-2 w-full"
        style={{ 
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          aspectRatio: `${cols} / ${rows}`
        }}
      >
        {gridBlocks.map((block) => (
          <Block
            key={block.blockId}
            block={block as BlockData}
            game={game}
            isSelected={selectedBlocks.has(block.blockId)}
            isOwned={block.ownerId === userAddress}
            isRevealing={revealingBlocks.has(block.blockId)}
            onClick={() => handleBlockClick(block.blockId)}
            mode={mode}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-green-400 bg-green-100 rounded" />
          <span>Alive</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-red-400 bg-red-100 rounded" />
          <span>Eliminated</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-300 bg-gray-50 rounded" />
          <span>Unsold</span>
        </div>
        {userAddress && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-yellow-400 bg-yellow-100 rounded" />
            <span>Your Blocks</span>
          </div>
        )}
        {mode === 'select' && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-500 bg-blue-100 rounded ring-2 ring-blue-500 ring-offset-1" />
            <span>Selected</span>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
        <div className="bg-green-50 p-2 rounded">
          <div className="font-semibold text-green-700">
            {blocks.filter(b => b.status === 'alive').length}
          </div>
          <div className="text-green-600">Alive</div>
        </div>
        <div className="bg-red-50 p-2 rounded">
          <div className="font-semibold text-red-700">
            {blocks.filter(b => b.status === 'eliminated').length}
          </div>
          <div className="text-red-600">Eliminated</div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="font-semibold text-gray-700">
            {blocks.filter(b => b.status === 'unsold').length}
          </div>
          <div className="text-gray-600">Unsold</div>
        </div>
        {userAddress && (
          <div className="bg-yellow-50 p-2 rounded">
            <div className="font-semibold text-yellow-700">
              {blocks.filter(b => b.ownerId === userAddress).length}
            </div>
            <div className="text-yellow-600">Your Blocks</div>
          </div>
        )}
      </div>
    </div>
  )
}