'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react'
import { GameGrid } from './GameGrid'
import { cn, formatPercentage } from '@/lib/utils'
import type { GameData, BlockData, RoundResult } from '../../../shared/types'

interface LiveRevealProps {
  game: GameData
  blocks: BlockData[]
  roundResults: RoundResult[]
  userAddress: string
  autoPlay?: boolean
  revealSpeed?: number // ms between reveals
  onRevealComplete?: () => void
  onUserBlockRevealed?: (blockId: number, eliminated: boolean) => void
}

export const LiveReveal: React.FC<LiveRevealProps> = ({
  game,
  blocks,
  roundResults,
  userAddress,
  autoPlay = true,
  revealSpeed = 200,
  onRevealComplete,
  onUserBlockRevealed
}) => {
  const [isRevealing, setIsRevealing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealedBlocks, setRevealedBlocks] = useState<Set<number>>(new Set())
  const [revealOrder, setRevealOrder] = useState<RoundResult[]>([])
  const [isPaused, setIsPaused] = useState(false)

  // Initialize reveal order (randomized)
  useEffect(() => {
    const shuffled = [...roundResults].sort(() => Math.random() - 0.5)
    setRevealOrder(shuffled)
    setCurrentIndex(0)
    setRevealedBlocks(new Set())
    setIsPaused(!autoPlay)
  }, [roundResults, autoPlay])

  // Auto reveal logic
  useEffect(() => {
    if (!isRevealing || isPaused || currentIndex >= revealOrder.length) {
      return
    }

    const timer = setTimeout(() => {
      const result = revealOrder[currentIndex]
      
      setRevealedBlocks(prev => new Set([...prev, result.blockId]))
      
      // Check if this is a user block
      const block = blocks.find(b => b.blockId === result.blockId)
      if (block?.ownerId === userAddress) {
        onUserBlockRevealed?.(result.blockId, result.eliminated)
      }
      
      setCurrentIndex(prev => prev + 1)
    }, revealSpeed)

    return () => clearTimeout(timer)
  }, [
    isRevealing, 
    isPaused, 
    currentIndex, 
    revealOrder, 
    revealSpeed, 
    blocks, 
    userAddress, 
    onUserBlockRevealed
  ])

  // Complete reveal
  useEffect(() => {
    if (currentIndex >= revealOrder.length && revealOrder.length > 0) {
      setIsRevealing(false)
      onRevealComplete?.()
    }
  }, [currentIndex, revealOrder.length, onRevealComplete])

  const startReveal = useCallback(() => {
    setIsRevealing(true)
    setIsPaused(false)
  }, [])

  const pauseReveal = useCallback(() => {
    setIsPaused(true)
  }, [])

  const resumeReveal = useCallback(() => {
    setIsPaused(false)
  }, [])

  const skipToEnd = useCallback(() => {
    setRevealedBlocks(new Set(revealOrder.map(r => r.blockId)))
    setCurrentIndex(revealOrder.length)
    setIsRevealing(false)
  }, [revealOrder])

  const reset = useCallback(() => {
    setIsRevealing(false)
    setIsPaused(!autoPlay)
    setCurrentIndex(0)
    setRevealedBlocks(new Set())
  }, [autoPlay])

  const progress = revealOrder.length > 0 ? (currentIndex / revealOrder.length) * 100 : 0
  const isComplete = currentIndex >= revealOrder.length && revealOrder.length > 0
  const canReveal = !isRevealing && currentIndex < revealOrder.length

  // Calculate stats
  const revealedResults = revealOrder.slice(0, currentIndex)
  const eliminatedCount = revealedResults.filter(r => r.eliminated).length
  const survivedCount = revealedResults.length - eliminatedCount

  const userBlocks = blocks.filter(b => b.ownerId === userAddress)
  const userRevealedResults = revealedResults.filter(r => 
    userBlocks.some(b => b.blockId === r.blockId)
  )
  const userEliminated = userRevealedResults.filter(r => r.eliminated).length
  const userSurvived = userRevealedResults.length - userEliminated

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Round {game.currentRound} Results</h2>
        <p className="text-gray-600">
          {isComplete 
            ? 'Reveal complete!' 
            : isRevealing && !isPaused
            ? 'Revealing blocks...'
            : 'Ready to reveal'
          }
        </p>
      </div>

      {/* Progress Bar */}
      <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border text-center">
          <div className="text-2xl font-bold text-blue-600">
            {currentIndex}
          </div>
          <div className="text-sm text-gray-600">Revealed</div>
          <div className="text-xs text-gray-400">
            / {revealOrder.length}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border text-center">
          <div className="text-2xl font-bold text-red-600">
            {eliminatedCount}
          </div>
          <div className="text-sm text-gray-600">Eliminated</div>
          <div className="text-xs text-gray-400">
            {formatPercentage(eliminatedCount / Math.max(currentIndex, 1))}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border text-center">
          <div className="text-2xl font-bold text-green-600">
            {survivedCount}
          </div>
          <div className="text-sm text-gray-600">Survived</div>
          <div className="text-xs text-gray-400">
            {formatPercentage(survivedCount / Math.max(currentIndex, 1))}
          </div>
        </div>

        {userBlocks.length > 0 && (
          <div className="bg-white p-4 rounded-lg border text-center border-yellow-200">
            <div className="text-2xl font-bold text-yellow-600">
              {userSurvived}
            </div>
            <div className="text-sm text-gray-600">Your Survived</div>
            <div className="text-xs text-gray-400">
              / {userBlocks.length} blocks
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-2">
        {canReveal && (
          <button
            onClick={startReveal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Play className="w-4 h-4" />
            Start Reveal
          </button>
        )}

        {isRevealing && !isPaused && (
          <button
            onClick={pauseReveal}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
          >
            <Pause className="w-4 h-4" />
            Pause
          </button>
        )}

        {isRevealing && isPaused && (
          <button
            onClick={resumeReveal}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            <Play className="w-4 h-4" />
            Resume
          </button>
        )}

        {(isRevealing || currentIndex > 0) && !isComplete && (
          <button
            onClick={skipToEnd}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            <SkipForward className="w-4 h-4" />
            Skip to End
          </button>
        )}

        {(currentIndex > 0 || isComplete) && (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        )}
      </div>

      {/* Game Grid */}
      <GameGrid
        game={game}
        blocks={blocks}
        userAddress={userAddress}
        mode="reveal"
        revealingBlocks={revealedBlocks}
      />

      {/* Recent Reveals */}
      {currentIndex > 0 && (
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="font-semibold mb-3">Recent Reveals</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            <AnimatePresence>
              {revealedResults.slice(-10).reverse().map((result, index) => {
                const block = blocks.find(b => b.blockId === result.blockId)
                const isUserBlock = block?.ownerId === userAddress
                
                return (
                  <motion.div
                    key={`${result.blockId}-${index}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "flex items-center justify-between p-2 rounded text-sm",
                      result.eliminated 
                        ? "bg-red-50 text-red-800"
                        : "bg-green-50 text-green-800",
                      isUserBlock && "ring-2 ring-yellow-400"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono">
                        Block #{result.blockId}
                      </span>
                      {isUserBlock && (
                        <span className="text-xs bg-yellow-200 text-yellow-800 px-1 rounded">
                          Your Block
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span>
                        {result.eliminated ? '💥 Eliminated' : '✅ Survived'}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({(result.vrfValue * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Completion Message */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-purple-100 to-blue-100 p-6 rounded-lg border-2 border-purple-200 text-center"
          >
            <div className="text-2xl mb-2">🎉</div>
            <h3 className="text-xl font-bold mb-2">Round Complete!</h3>
            <div className="space-y-1 text-sm text-gray-700">
              <div>
                <strong>{survivedCount}</strong> blocks survived out of <strong>{revealOrder.length}</strong>
              </div>
              {userBlocks.length > 0 && (
                <div className="text-yellow-700">
                  You had <strong>{userSurvived}</strong> survivors out of <strong>{userBlocks.length}</strong> blocks
                </div>
              )}
              <div className="text-xs text-gray-500 mt-2">
                Elimination rate: {formatPercentage(eliminatedCount / revealOrder.length)}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}