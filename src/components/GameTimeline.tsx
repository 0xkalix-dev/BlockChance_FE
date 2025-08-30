import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ShoppingCart, 
  Zap, 
  Trophy, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Eye
} from 'lucide-react'
import { cn } from '../lib/utils'
import type { GameData, RoundData } from '../../../shared/types'

interface GameTimelineProps {
  game: GameData
  currentRound?: RoundData | null
  className?: string
}

interface PhaseInfo {
  id: string
  type: 'mint' | 'round' | 'final'
  label: string
  status: 'completed' | 'active' | 'upcoming'
  timeLeft?: number
  totalTime?: number
  roundNumber?: number
  icon: any
  color: string
  description: string
}

export const GameTimeline: React.FC<GameTimelineProps> = ({
  game,
  currentRound,
  className
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [currentPhaseId, setCurrentPhaseId] = useState<string>('')
  const timelineRef = useRef<HTMLDivElement>(null)

  // Generate timeline phases
  const phases = useMemo((): PhaseInfo[] => {
    const phaseList: PhaseInfo[] = []

    // Minting Phase
    phaseList.push({
      id: 'mint',
      type: 'mint',
      label: 'Mint',
      status: game.status === 'minting' ? 'active' : 'completed',
      icon: ShoppingCart,
      color: game.status === 'minting' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 bg-gray-100',
      description: game.status === 'minting' ? 'Buy your blocks now!' : 'Minting completed'
    })

    // Generate round phases dynamically
    const currentRoundNum = typeof game.currentRound === 'object' 
      ? game.currentRound?.roundNumber || 0 
      : game.currentRound

    // Show: completed rounds + current + next 3 rounds
    const visibleRounds = Math.max(5, currentRoundNum + 3)
    
    for (let i = 1; i <= visibleRounds; i++) {
      let status: 'completed' | 'active' | 'upcoming' = 'upcoming'
      let color = 'text-gray-400 bg-gray-50'
      let description = `Round ${i} - Elimination & Trading`

      if (i < currentRoundNum) {
        status = 'completed'
        color = 'text-green-600 bg-green-50'
        description = `Round ${i} completed`
      } else if (i === currentRoundNum && game.status === 'active') {
        status = 'active'
        color = 'text-purple-600 bg-purple-50'
        
        if (currentRound) {
          switch (currentRound.status) {
            case 'trading':
              description = `Trading active - ${(currentRound.eliminationRate * 100).toFixed(1)}% elimination`
              break
            case 'trading_closed':
              description = 'Trading closed - Waiting for VRF'
              break
            case 'vrf_requested':
              description = 'Generating random numbers...'
              break
            case 'revealing':
              description = 'Live reveal in progress!'
              break
            default:
              description = `Round ${i} in progress`
          }
        }
      }

      phaseList.push({
        id: `round${i}`,
        type: 'round',
        label: `Round ${i}`,
        status,
        roundNumber: i,
        icon: i === currentRoundNum && currentRound?.status === 'revealing' ? Eye : Zap,
        color,
        description
      })

      // Stop generating rounds if game is finished
      if (game.status === 'finished' && i > currentRoundNum) {
        break
      }
    }

    // Add "..." indicator for future rounds if game is still active
    if (game.status === 'active' && game.aliveBlocks > 1) {
      phaseList.push({
        id: 'future',
        type: 'round',
        label: '...',
        status: 'upcoming',
        icon: Clock,
        color: 'text-gray-400 bg-gray-50',
        description: 'More rounds until 1 survivor remains'
      })
    }

    // Final phase
    if (game.status === 'finished') {
      phaseList.push({
        id: 'final',
        type: 'final',
        label: 'Winner',
        status: 'completed',
        icon: Trophy,
        color: 'text-yellow-600 bg-yellow-50',
        description: game.winnerId ? `Winner: ${game.winnerId.slice(0, 8)}...` : 'Game completed'
      })
    }

    return phaseList
  }, [game, currentRound])

  // Calculate time left for current active phase
  useEffect(() => {
    if (!currentRound || currentRound.status !== 'trading') {
      setTimeLeft(0)
      return
    }

    const updateTimer = () => {
      const now = new Date()
      const closeTime = new Date(currentRound.tradeCloseTime)
      const remaining = Math.max(0, Math.floor((closeTime.getTime() - now.getTime()) / 1000))
      setTimeLeft(remaining)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [currentRound])

  // Find current active phase and auto-scroll to it
  useEffect(() => {
    const activePhase = phases.find(p => p.status === 'active')
    setCurrentPhaseId(activePhase?.id || '')

    // Auto-scroll to current phase on desktop
    if (activePhase && timelineRef.current) {
      const activeElement = timelineRef.current.querySelector(`[data-phase-id="${activePhase.id}"]`)
      if (activeElement) {
        activeElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'center' 
        })
      }
    }
  }, [phases])

  const formatTime = useCallback((seconds: number) => {
    if (seconds === 0) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  return (
    <div className={cn('w-full', className)}>
      <div className="bg-white rounded-lg border p-4 md:p-6">
        <div className="mb-4">
          <h3 className="font-bold text-lg mb-1">Game Progress</h3>
          <p className="text-sm text-gray-600">Follow the timeline to see current phase and upcoming events</p>
        </div>

        {/* Desktop Timeline */}
        <div className="hidden md:block">
          <div className="overflow-x-auto pb-2" ref={timelineRef}>
            <div className="flex items-center gap-8 relative min-w-max px-4">
              <div className="absolute top-6 left-4 right-4 h-0.5 bg-gray-200 z-0">
                <motion.div
                  className="h-full bg-blue-500"
                  initial={{ width: '0%' }}
                  animate={{ 
                    width: `${(phases.filter(p => p.status === 'completed').length / phases.length) * 100}%` 
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              {phases.map((phase, index) => {
                const Icon = phase.icon
                const isActive = phase.status === 'active'
                const isCompleted = phase.status === 'completed'
                
                return (
                  <div 
                    key={phase.id} 
                    className="relative z-10 flex flex-col items-center min-w-[100px]"
                    data-phase-id={phase.id}
                  >
                    <motion.div
                      className={cn(
                        'w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300',
                        isCompleted && 'bg-green-500 border-green-500 text-white',
                        isActive && 'bg-white border-blue-500 text-blue-600 shadow-lg',
                        !isCompleted && !isActive && 'bg-gray-100 border-gray-300 text-gray-400'
                      )}
                      whileHover={{ scale: 1.1 }}
                      animate={isActive ? { 
                        scale: [1, 1.05, 1],
                        boxShadow: ['0 0 0 0 rgba(59, 130, 246, 0.4)', '0 0 0 10px rgba(59, 130, 246, 0)', '0 0 0 0 rgba(59, 130, 246, 0)']
                      } : {}}
                      transition={{ duration: 2, repeat: isActive ? Infinity : 0 }}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </motion.div>

                    <div className="mt-2 text-center min-w-[80px]">
                      <div className={cn(
                        'font-semibold text-sm',
                        isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                      )}>
                        {phase.label}
                      </div>
                      
                      {isActive && phase.type === 'round' && timeLeft > 0 && (
                        <motion.div
                          className={cn(
                            'text-xs font-mono mt-1 px-2 py-1 rounded',
                            timeLeft <= 30 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                          )}
                          animate={timeLeft <= 30 ? { scale: [1, 1.05, 1] } : {}}
                          transition={{ duration: 1, repeat: timeLeft <= 30 ? Infinity : 0 }}
                        >
                          {formatTime(timeLeft)}
                        </motion.div>
                      )}
                      
                      <div className="text-xs text-gray-500 mt-1">
                        {phase.description}
                      </div>
                    </div>

                    {index < phases.length - 1 && (
                      <div className="absolute top-6 -right-4 w-8 flex justify-center">
                        <div className={cn(
                          'text-gray-400',
                          isCompleted && 'text-green-500'
                        )}>
                          →
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Mobile Timeline */}
        <div className="md:hidden">
          <div className="space-y-3">
            {phases.map((phase, index) => {
              const Icon = phase.icon
              const isActive = phase.status === 'active'
              const isCompleted = phase.status === 'completed'
              
              return (
                <motion.div
                  key={phase.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-all duration-300',
                    isCompleted && 'bg-green-50 border-green-200',
                    isActive && 'bg-blue-50 border-blue-300 shadow-md',
                    !isCompleted && !isActive && 'bg-gray-50 border-gray-200'
                  )}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                    isCompleted && 'bg-green-500 text-white',
                    isActive && 'bg-blue-500 text-white',
                    !isCompleted && !isActive && 'bg-gray-300 text-gray-500'
                  )}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        'font-semibold',
                        isActive ? 'text-blue-700' : isCompleted ? 'text-green-700' : 'text-gray-500'
                      )}>
                        {phase.label}
                      </div>
                      
                      {isActive && phase.type === 'round' && timeLeft > 0 && (
                        <motion.div
                          className={cn(
                            'font-mono font-bold px-2 py-1 rounded text-sm',
                            timeLeft <= 30 ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                          )}
                          animate={timeLeft <= 30 ? { scale: [1, 1.1, 1] } : {}}
                          transition={{ duration: 0.8, repeat: timeLeft <= 30 ? Infinity : 0 }}
                        >
                          {formatTime(timeLeft)}
                        </motion.div>
                      )}
                    </div>
                    
                    <div className="text-xs text-gray-600 mt-1">
                      {phase.description}
                    </div>
                  </div>

                  {index < phases.length - 1 && (
                    <div className="text-gray-400">↓</div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Current Phase Summary */}
        <AnimatePresence>
          {currentPhaseId && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-blue-800 mb-1">Current Phase</h4>
                  <p className="text-sm text-blue-700">
                    {phases.find(p => p.id === currentPhaseId)?.description}
                  </p>
                </div>
                
                {timeLeft > 0 && (
                  <div className="text-right">
                    <motion.div
                      className={cn(
                        'text-3xl md:text-4xl font-mono font-bold',
                        timeLeft <= 30 ? 'text-red-600' : 'text-blue-600'
                      )}
                      animate={timeLeft <= 30 ? { 
                        scale: [1, 1.1, 1]
                      } : {}}
                      transition={{ duration: 1, repeat: timeLeft <= 30 ? Infinity : 0 }}
                    >
                      {formatTime(timeLeft)}
                    </motion.div>
                    <div className="text-xs text-gray-600">
                      {timeLeft <= 30 ? 'URGENT!' : 'until phase ends'}
                    </div>
                  </div>
                )}
              </div>

              {timeLeft > 0 && currentRound && (
                <div className="mt-3">
                  <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className={cn(
                        'h-full rounded-full transition-colors duration-300',
                        timeLeft <= 30 ? 'bg-red-500' : 'bg-blue-500'
                      )}
                      style={{
                        width: `${Math.max(0, (timeLeft / game.config.roundDuration) * 100)}%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Phase started</span>
                    <span>{timeLeft <= 30 ? '⚡ ENDING SOON!' : 'Trading closes'}</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Stats */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="font-bold text-blue-700 text-lg">
              {game.aliveBlocks.toLocaleString()}
            </div>
            <div className="text-blue-600 text-sm">Blocks Alive</div>
          </div>
          
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="font-bold text-green-700 text-lg">
              {game.prizePool.toFixed(2)} SOL
            </div>
            <div className="text-green-600 text-sm">Prize Pool</div>
          </div>
          
          <div className="bg-purple-50 p-3 rounded-lg">
            <div className="font-bold text-purple-700 text-lg">
              {game.currentEV.toFixed(4)} SOL
            </div>
            <div className="text-purple-600 text-sm">Current EV</div>
          </div>
          
          <div className="bg-orange-50 p-3 rounded-lg">
            <div className="font-bold text-orange-700 text-lg">
              {(game.survivalProbability * 100).toFixed(1)}%
            </div>
            <div className="text-orange-600 text-sm">Survival Rate</div>
          </div>
        </div>

        {/* Emergency notifications */}
        <AnimatePresence>
          {timeLeft > 0 && timeLeft <= 10 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mt-4 p-4 bg-red-500 text-white rounded-lg"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 animate-bounce" />
                <div>
                  <div className="font-bold">🚨 FINAL SECONDS!</div>
                  <div className="text-sm opacity-90">Trading ends in {timeLeft} seconds!</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}