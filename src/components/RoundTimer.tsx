import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Clock, 
  Play, 
  Pause, 
  ShoppingCart, 
  Zap, 
  AlertTriangle,
  CheckCircle,
  Timer
} from 'lucide-react'
import { cn, formatTime } from '../lib/utils'
import type { RoundData, GameData } from '../../../shared/types'

interface RoundTimerProps {
  game: GameData
  currentRound?: RoundData | null
  className?: string
}

interface TimeLeft {
  total: number
  hours: number
  minutes: number
  seconds: number
}

export const RoundTimer: React.FC<RoundTimerProps> = ({
  game,
  currentRound,
  className
}) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ total: 0, hours: 0, minutes: 0, seconds: 0 })
  const [roundStatus, setRoundStatus] = useState<string>('waiting')
  const [isUrgent, setIsUrgent] = useState(false)

  const calculateTimeLeft = useCallback((): TimeLeft => {
    if (!currentRound) {
      return { total: 0, hours: 0, minutes: 0, seconds: 0 }
    }

    let targetTime: Date
    let status = 'waiting'

    switch (currentRound.status) {
      case 'trading':
        targetTime = new Date(currentRound.tradeCloseTime)
        status = 'trading'
        break
      case 'trading_closed':
        status = 'closed'
        return { total: 0, hours: 0, minutes: 0, seconds: 0 }
      case 'vrf_requested':
        status = 'vrf_pending'
        return { total: 0, hours: 0, minutes: 0, seconds: 0 }
      case 'revealing':
        status = 'revealing'
        return { total: 0, hours: 0, minutes: 0, seconds: 0 }
      default:
        return { total: 0, hours: 0, minutes: 0, seconds: 0 }
    }

    setRoundStatus(status)

    const now = new Date()
    const difference = targetTime.getTime() - now.getTime()

    if (difference <= 0) {
      return { total: 0, hours: 0, minutes: 0, seconds: 0 }
    }

    const total = Math.floor(difference / 1000)
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = total % 60

    return { total, hours, minutes, seconds }
  }, [currentRound])

  // Update timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft()
      setTimeLeft(newTimeLeft)
      
      // Set urgent state when less than 30 seconds
      setIsUrgent(newTimeLeft.total > 0 && newTimeLeft.total <= 30)
    }, 1000)

    // Initial calculation
    setTimeLeft(calculateTimeLeft())

    return () => clearInterval(timer)
  }, [calculateTimeLeft])

  const getStatusConfig = useCallback(() => {
    switch (roundStatus) {
      case 'trading':
        return {
          icon: ShoppingCart,
          label: 'Trading Active',
          color: 'text-green-600 bg-green-50 border-green-200',
          message: 'Place your buy/sell orders now!'
        }
      case 'closed':
        return {
          icon: Pause,
          label: 'Trading Closed',
          color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
          message: 'Waiting for VRF...'
        }
      case 'vrf_pending':
        return {
          icon: Zap,
          label: 'VRF Requested',
          color: 'text-purple-600 bg-purple-50 border-purple-200',
          message: 'Random number generation in progress...'
        }
      case 'revealing':
        return {
          icon: Timer,
          label: 'Revealing Results',
          color: 'text-blue-600 bg-blue-50 border-blue-200',
          message: 'Watch the live reveal!'
        }
      default:
        return {
          icon: Clock,
          label: 'Waiting',
          color: 'text-gray-600 bg-gray-50 border-gray-200',
          message: 'Next round starting soon...'
        }
    }
  }, [roundStatus])

  const status = getStatusConfig()
  const Icon = status.icon

  const formatTimeDisplay = useCallback((time: TimeLeft) => {
    if (time.hours > 0) {
      return `${time.hours}:${time.minutes.toString().padStart(2, '0')}:${time.seconds.toString().padStart(2, '0')}`
    }
    return `${time.minutes}:${time.seconds.toString().padStart(2, '0')}`
  }, [])

  if (!currentRound || game.status !== 'active') {
    return null
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Main Timer Card */}
      <motion.div
        className={cn(
          'bg-white rounded-lg border-2 p-4 md:p-6 transition-all duration-300',
          status.color,
          isUrgent && roundStatus === 'trading' && 'animate-pulse border-red-300 bg-red-50'
        )}
        layout
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 md:p-3 rounded-full transition-colors',
              isUrgent && roundStatus === 'trading' ? 'bg-red-100' : 'bg-white bg-opacity-60'
            )}>
              <Icon className={cn(
                'w-5 h-5 md:w-6 md:h-6',
                isUrgent && roundStatus === 'trading' ? 'text-red-600' : status.color.split(' ')[0]
              )} />
            </div>
            
            <div>
              <h3 className={cn(
                'font-bold text-lg md:text-xl',
                isUrgent && roundStatus === 'trading' ? 'text-red-700' : status.color.split(' ')[0]
              )}>
                {status.label}
              </h3>
              <p className="text-sm text-gray-600">
                Round {currentRound.roundNumber} • {currentRound.blocksAtStart.toLocaleString()} blocks
              </p>
            </div>
          </div>

          {/* Countdown Display */}
          <div className="text-right">
            <AnimatePresence mode="wait">
              {timeLeft.total > 0 ? (
                <motion.div
                  key="countdown"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className={cn(
                    'font-mono text-2xl md:text-3xl font-bold',
                    isUrgent ? 'text-red-600' : 'text-gray-800'
                  )}
                >
                  {formatTimeDisplay(timeLeft)}
                </motion.div>
              ) : (
                <motion.div
                  key="finished"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-gray-500 font-medium"
                >
                  {roundStatus === 'closed' && '⏳ Processing...'}
                  {roundStatus === 'vrf_pending' && '🎲 Generating...'}
                  {roundStatus === 'revealing' && '🎪 Revealing...'}
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="text-xs text-gray-500 mt-1">
              {roundStatus === 'trading' && timeLeft.total > 0 && 'until trading closes'}
              {roundStatus === 'closed' && 'Trading has ended'}
              {roundStatus === 'vrf_pending' && 'VRF in progress'}
              {roundStatus === 'revealing' && 'Results revealing'}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <AnimatePresence>
          {timeLeft.total > 0 && roundStatus === 'trading' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4"
            >
              <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                <motion.div
                  className={cn(
                    'h-full rounded-full transition-colors duration-300',
                    isUrgent ? 'bg-red-500' : 'bg-blue-500'
                  )}
                  style={{
                    width: `${Math.max(0, Math.min(100, (timeLeft.total / (game.config.roundDuration)) * 100))}%`
                  }}
                  initial={{ width: '100%' }}
                />
              </div>
              
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Round started</span>
                <span>Trading closes</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Message */}
        <div className="mt-4 p-3 bg-white bg-opacity-60 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            {roundStatus === 'trading' && !isUrgent && (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
            {isUrgent && (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            )}
            <span className={cn(
              'font-medium',
              isUrgent ? 'text-red-700' : 'text-gray-700'
            )}>
              {status.message}
            </span>
          </div>
          
          {/* Elimination info */}
          <div className="text-xs text-gray-600 mt-1">
            Expected elimination: {(currentRound.eliminationRate * 100).toFixed(1)}% 
            (~{Math.floor(currentRound.blocksAtStart * currentRound.eliminationRate).toLocaleString()} blocks)
          </div>
        </div>

        {/* Quick Actions for Mobile */}
        <div className="md:hidden mt-4 flex gap-2">
          {roundStatus === 'trading' && (
            <>
              <button className="flex-1 py-2 bg-red-500 text-white rounded text-sm font-medium">
                Quick Sell
              </button>
              <button className="flex-1 py-2 bg-green-500 text-white rounded text-sm font-medium">
                Quick Buy
              </button>
            </>
          )}
          {roundStatus === 'revealing' && (
            <button className="w-full py-2 bg-blue-500 text-white rounded text-sm font-medium">
              Watch Reveal
            </button>
          )}
        </div>
      </motion.div>

      {/* Urgent Warning Banner */}
      <AnimatePresence>
        {isUrgent && roundStatus === 'trading' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-3 p-3 bg-red-500 text-white rounded-lg flex items-center gap-2"
          >
            <AlertTriangle className="w-5 h-5 animate-bounce" />
            <div className="flex-1">
              <div className="font-bold text-sm">⚡ URGENT: Trading closes in {timeLeft.seconds}s!</div>
              <div className="text-xs opacity-90">Place your orders now or they'll be cancelled</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next Round Preview */}
      {game.aliveBlocks > 1 && (
        <div className="mt-3 p-3 bg-gray-100 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-700">Next Round Preview</span>
            </div>
            <div className="text-right text-xs">
              <div className="font-semibold">Expected EV: {game.nextRoundEV.toFixed(4)} SOL</div>
              <div className="text-gray-500">
                {game.aliveBlocks} → ~{Math.floor(game.aliveBlocks * (1 - (currentRound?.eliminationRate || 0.2)))} survivors
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Hook for round countdown
export const useRoundTimer = (currentRound?: RoundData | null) => {
  const [timeUntilClose, setTimeUntilClose] = useState<number>(0)
  const [isTradeTime, setIsTradeTime] = useState<boolean>(false)
  const [isUrgent, setIsUrgent] = useState<boolean>(false)

  useEffect(() => {
    if (!currentRound || currentRound.status !== 'trading') {
      setTimeUntilClose(0)
      setIsTradeTime(false)
      setIsUrgent(false)
      return
    }

    const updateTimer = () => {
      const now = new Date()
      const closeTime = new Date(currentRound.tradeCloseTime)
      const difference = Math.max(0, Math.floor((closeTime.getTime() - now.getTime()) / 1000))
      
      setTimeUntilClose(difference)
      setIsTradeTime(difference > 0)
      setIsUrgent(difference > 0 && difference <= 30)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [currentRound])

  return {
    timeUntilClose,
    isTradeTime,
    isUrgent,
    formattedTime: formatTime(timeUntilClose)
  }
}