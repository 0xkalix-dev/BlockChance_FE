'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dice6, Hand, ShoppingCart, Loader2 } from 'lucide-react'
import { GameGrid } from './GameGrid'
import { cn, formatSOL, generateMockAddress } from '@/lib/utils'
import { gameAPI } from '@/lib/api'
import type { GameData, BlockData } from '../../../shared/types'

interface MintingInterfaceProps {
  game: GameData
  blocks: BlockData[]
  userAddress: string
  onMintSuccess?: (mintedBlocks: BlockData[]) => void
  onMintError?: (error: string) => void
}

type MintMode = 'select' | 'random'

export const MintingInterface: React.FC<MintingInterfaceProps> = ({
  game,
  blocks,
  userAddress,
  onMintSuccess,
  onMintError
}) => {
  const [mintMode, setMintMode] = useState<MintMode>('select')
  const [selectedBlocks, setSelectedBlocks] = useState<Set<number>>(new Set())
  const [randomQuantity, setRandomQuantity] = useState<number>(1)
  const [isMinting, setIsMinting] = useState(false)

  const availableBlocks = blocks.filter(b => b.status === 'unsold')
  const maxRandomQuantity = availableBlocks.length

  const handleBlockSelect = useCallback((blockId: number) => {
    setSelectedBlocks(prev => new Set([...prev, blockId]))
  }, [])

  const handleBlockDeselect = useCallback((blockId: number) => {
    setSelectedBlocks(prev => {
      const newSet = new Set(prev)
      newSet.delete(blockId)
      return newSet
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedBlocks(new Set())
  }, [])

  const selectRandomBlocks = useCallback(() => {
    const shuffled = [...availableBlocks].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, randomQuantity).map(b => b.blockId)
    setSelectedBlocks(new Set(selected))
    setMintMode('select') // Switch to select mode to show selection
  }, [availableBlocks, randomQuantity])

  const calculateCost = useCallback(() => {
    const quantity = mintMode === 'select' ? selectedBlocks.size : randomQuantity
    return quantity * game.config.blockPrice
  }, [mintMode, selectedBlocks.size, randomQuantity, game.config.blockPrice])

  const handleMint = useCallback(async () => {
    if (isMinting) return

    setIsMinting(true)
    
    try {
      const cost = calculateCost()
      const mintData = mintMode === 'select' 
        ? { blockIds: Array.from(selectedBlocks) }
        : { quantity: randomQuantity }

      const result = await gameAPI.mintBlocks(game.gameId, {
        buyerAddress: userAddress,
        paymentAmount: cost,
        ...mintData
      })

      if (result.success) {
        onMintSuccess?.(result.blocks)
        setSelectedBlocks(new Set())
        setRandomQuantity(1)
      } else {
        onMintError?.(result.message)
      }
    } catch (error) {
      onMintError?.(error instanceof Error ? error.message : 'Minting failed')
    } finally {
      setIsMinting(false)
    }
  }, [
    isMinting, 
    mintMode, 
    selectedBlocks, 
    randomQuantity, 
    game.gameId, 
    userAddress, 
    calculateCost, 
    onMintSuccess, 
    onMintError
  ])

  const canMint = mintMode === 'select' 
    ? selectedBlocks.size > 0 
    : randomQuantity > 0 && randomQuantity <= maxRandomQuantity

  if (game.status !== 'minting') {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 mb-2">Minting is not available</div>
        <div className="text-sm text-gray-400">
          Game status: {game.status}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Mint Blocks</h2>
        <p className="text-gray-600">
          Choose your blocks and join the survival game
        </p>
      </div>

      {/* Mode Selection */}
      <div className="flex justify-center">
        <div className="bg-gray-100 p-1 rounded-lg flex">
          <button
            onClick={() => setMintMode('select')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded transition-all",
              mintMode === 'select' 
                ? "bg-white shadow text-blue-600" 
                : "text-gray-600 hover:text-gray-800"
            )}
          >
            <Hand className="w-4 h-4" />
            Drag Select
          </button>
          <button
            onClick={() => setMintMode('random')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded transition-all",
              mintMode === 'random' 
                ? "bg-white shadow text-blue-600" 
                : "text-gray-600 hover:text-gray-800"
            )}
          >
            <Dice6 className="w-4 h-4" />
            Random
          </button>
        </div>
      </div>

      {/* Random Mode Controls */}
      <AnimatePresence>
        {mintMode === 'random' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-blue-50 p-4 rounded-lg"
          >
            <div className="flex items-center justify-center gap-4">
              <label className="flex items-center gap-2">
                <span className="text-sm font-medium">Quantity:</span>
                <input
                  type="number"
                  min={1}
                  max={maxRandomQuantity}
                  value={randomQuantity}
                  onChange={(e) => setRandomQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 px-2 py-1 border rounded text-center"
                />
              </label>
              <button
                onClick={selectRandomBlocks}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Preview Random
              </button>
            </div>
            <div className="text-center text-xs text-gray-600 mt-2">
              Available blocks: {maxRandomQuantity}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Grid */}
      <GameGrid
        game={game}
        blocks={blocks}
        selectedBlocks={selectedBlocks}
        userAddress={userAddress}
        onBlockSelect={handleBlockSelect}
        onBlockDeselect={handleBlockDeselect}
        mode="select"
      />

      {/* Selection Info & Actions */}
      <div className="bg-white p-4 rounded-lg border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-sm text-gray-600">Selected Blocks</div>
            <div className="text-xl font-bold">
              {mintMode === 'select' ? selectedBlocks.size : randomQuantity}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Price per Block</div>
            <div className="text-xl font-bold">
              {formatSOL(game.config.blockPrice)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Total Cost</div>
            <div className="text-xl font-bold text-blue-600">
              {formatSOL(calculateCost())}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={clearSelection}
            disabled={selectedBlocks.size === 0}
            className={cn(
              "px-4 py-2 rounded transition-colors",
              selectedBlocks.size > 0
                ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            Clear Selection
          </button>

          <button
            onClick={handleMint}
            disabled={!canMint || isMinting}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded font-semibold transition-colors",
              canMint && !isMinting
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            )}
          >
            {isMinting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
            {isMinting ? 'Minting...' : `Mint ${formatSOL(calculateCost())}`}
          </button>
        </div>

        {/* Selection List (for drag-select mode) */}
        {mintMode === 'select' && selectedBlocks.size > 0 && (
          <div className="border-t pt-4">
            <div className="text-sm text-gray-600 mb-2">
              Selected Blocks ({selectedBlocks.size}):
            </div>
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {Array.from(selectedBlocks).sort((a, b) => a - b).map(blockId => (
                <span
                  key={blockId}
                  className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                >
                  #{blockId}
                  <button
                    onClick={() => handleBlockDeselect(blockId)}
                    className="ml-1 hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Game Info */}
      <div className="text-center text-sm text-gray-500 space-y-1">
        <div>
          Available blocks: {availableBlocks.length} / {game.totalBlocks}
        </div>
        {game.saleEndTime && (
          <div>
            Sale ends: {new Date(game.saleEndTime).toLocaleString()}
          </div>
        )}
        <div className="text-xs">
          Fee: {(game.config.feeRate * 100).toFixed(1)}% • 
          Prize Pool: {formatSOL(game.prizePool)}
        </div>
      </div>
    </div>
  )
}