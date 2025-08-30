import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ShoppingCart, 
  Ban, 
  Clock, 
  Zap, 
  Eye,
  TrendingUp,
  TrendingDown 
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useRoundTimer } from './RoundTimer'
import type { RoundData, GameData } from '../../../shared/types'

interface TradingStatusProps {
  game: GameData
  currentRound?: RoundData | null
  orderBookCount?: { asks: number; bids: number }
  className?: string
}

export const TradingStatus: React.FC<TradingStatusProps> = ({
  game,
  currentRound,
  orderBookCount = { asks: 0, bids: 0 },
  className
}) => {
  const { timeUntilClose, isTradeTime, isUrgent, formattedTime } = useRoundTimer(currentRound)

  const getStatusInfo = () => {
    if (!currentRound) {
      return {
        status: 'waiting',
        icon: Clock,
        title: 'Waiting for Round',
        subtitle: 'Next round will start soon',
        color: 'text-gray-600 bg-gray-50 border-gray-200'
      }
    }

    switch (currentRound.status) {
      case 'trading':
        return {
          status: 'trading',
          icon: ShoppingCart,
          title: isUrgent ? 'URGENT: Trading Ending!' : 'Trading Active',
          subtitle: isUrgent 
            ? `Only ${timeUntilClose}s remaining!` 
            : `${formattedTime} until close`,
          color: isUrgent 
            ? 'text-red-600 bg-red-50 border-red-300' 
            : 'text-green-600 bg-green-50 border-green-200'
        }
      case 'trading_closed':
        return {
          status: 'closed',
          icon: Ban,
          title: 'Trading Closed',
          subtitle: 'Orders locked, waiting for VRF',
          color: 'text-yellow-600 bg-yellow-50 border-yellow-200'
        }
      case 'vrf_requested':
        return {
          status: 'vrf',
          icon: Zap,
          title: 'Generating Randomness',
          subtitle: 'VRF oracle calculating results...',
          color: 'text-purple-600 bg-purple-50 border-purple-200'
        }
      case 'revealing':
        return {
          status: 'revealing',
          icon: Eye,
          title: 'Live Reveal Active',
          subtitle: 'Watch blocks get eliminated!',
          color: 'text-blue-600 bg-blue-50 border-blue-200'
        }
      default:
        return {
          status: 'unknown',
          icon: Clock,
          title: 'Round Status Unknown',
          subtitle: 'Please refresh',
          color: 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }
  }

  const statusInfo = getStatusInfo()
  const StatusIcon = statusInfo.icon

  return (
    <div className={cn('w-full', className)}>
      {/* Trading Status Card */}
      <motion.div
        className={cn(
          'border-2 rounded-lg p-3 md:p-4 transition-all duration-300',
          statusInfo.color,
          isUrgent && 'animate-pulse'
        )}
        layout
        whileHover={{ scale: 1.01 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2 bg-white bg-opacity-60 rounded-full"
              animate={isUrgent ? { 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              } : {}}
              transition={{ 
                duration: 0.5, 
                repeat: isUrgent ? Infinity : 0,
                repeatDelay: 0.5 
              }}
            >
              <StatusIcon className={cn(
                'w-5 h-5',
                statusInfo.color.split(' ')[0]
              )} />
            </motion.div>
            
            <div>
              <h3 className={cn(
                'font-bold text-base md:text-lg',
                statusInfo.color.split(' ')[0]
              )}>
                {statusInfo.title}
              </h3>
              <p className="text-sm opacity-80">
                {statusInfo.subtitle}
              </p>
            </div>
          </div>

          {/* Timer Display */}
          {isTradeTime && (
            <div className="text-right">
              <motion.div
                className={cn(
                  'font-mono text-xl md:text-2xl font-bold',
                  isUrgent ? 'text-red-600' : statusInfo.color.split(' ')[0]
                )}
                animate={isUrgent ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 1, repeat: isUrgent ? Infinity : 0 }}
              >
                {formattedTime}
              </motion.div>
              <div className="text-xs opacity-70">
                remaining
              </div>
            </div>
          )}
        </div>

        {/* Order Book Summary */}
        {statusInfo.status === 'trading' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 pt-3 border-t border-white border-opacity-30"
          >
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className="font-medium">{orderBookCount.asks}</span>
                  <span className="text-gray-600">sell orders</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="font-medium">{orderBookCount.bids}</span>
                  <span className="text-gray-600">buy orders</span>
                </div>
              </div>
              
              <div className="text-right">
                <div className="font-semibold">
                  Total: {orderBookCount.asks + orderBookCount.bids}
                </div>
                <div className="text-xs opacity-70">
                  active orders
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Round Info */}
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="text-center">
            <div className="font-semibold">{currentRound.blocksAtStart.toLocaleString()}</div>
            <div className="opacity-70">Blocks at Start</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">{(currentRound.eliminationRate * 100).toFixed(1)}%</div>
            <div className="opacity-70">Elimination Rate</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">{game.config.roundDuration}s</div>
            <div className="opacity-70">Round Duration</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">{currentRound.prizePoolSnapshot.toFixed(2)} SOL</div>
            <div className="opacity-70">Prize Pool</div>
          </div>
        </div>
      </motion.div>

      {/* Mobile Quick Stats */}
      <div className="md:hidden mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="bg-white p-2 rounded border">
          <div className="font-semibold text-sm">{game.aliveBlocks.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Alive</div>
        </div>
        <div className="bg-white p-2 rounded border">
          <div className="font-semibold text-sm">{game.currentEV.toFixed(4)}</div>
          <div className="text-xs text-gray-500">Current EV</div>
        </div>
        <div className="bg-white p-2 rounded border">
          <div className="font-semibold text-sm">{(game.survivalProbability * 100).toFixed(1)}%</div>
          <div className="text-xs text-gray-500">Survival</div>
        </div>
      </div>
    </div>
  )
}