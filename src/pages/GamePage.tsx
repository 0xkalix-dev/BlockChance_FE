import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  Users,
  Trophy,
  Settings,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Timer,
  ArrowLeft
} from 'lucide-react'
import { GameGrid } from '../components/GameGrid'
import { MintingInterface } from '../components/MintingInterface'
import { OrderBook } from '../components/OrderBook'
import { LiveReveal } from '../components/LiveReveal'
import { RoundTimer } from '../components/RoundTimer'
import { TradingStatus } from '../components/TradingStatus'
import { GameTimeline } from '../components/GameTimeline'
import { useGameWebSocket, useWebSocketEvent } from '../lib/websocket'
import { gameAPI, orderAPI } from '../lib/api'
import { cn, formatSOL, generateMockAddress } from '../lib/utils'
import type {
  GameData,
  BlockData,
  OrderData,
  OrderBook as OrderBookType,
  RoundData,
} from '../../../shared/types'

type TabType = 'game' | 'mint' | 'trade' | 'reveal'

export const GamePage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const [userAddress, setUserAddress] = useState<string>('')
  
  // Initialize user address only on client side
  useEffect(() => {
    setUserAddress(generateMockAddress())
  }, [])

  // State
  const [game, setGame] = useState<GameData | null>(null)
  const [blocks, setBlocks] = useState<BlockData[]>([])
  const [currentRound, setCurrentRound] = useState<RoundData | null>(null)
  const [orderBook, setOrderBook] = useState<OrderBookType>({
    asks: [],
    bids: [],
  })
  const [userOrders, setUserOrders] = useState<OrderData[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('game')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastReveal, setLastReveal] = useState<{
    results: any[]
    roundNumber: number
  } | null>(null)
  const [notifications, setNotifications] = useState<
    Array<{
      id: string
      type: 'success' | 'error' | 'info'
      message: string
    }>
  >([])

  // WebSocket
  const ws = useGameWebSocket(gameId || null)

  // Add notification
  const addNotification = useCallback(
    (type: 'success' | 'error' | 'info', message: string) => {
      const id = Date.now().toString()
      setNotifications((prev) => [...prev, { id, type, message }])

      // Auto remove after 3 seconds (shorter for mobile)
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
      }, 3000)
    },
    []
  )

  // Load initial data
  const loadGameData = useCallback(async () => {
    if (!gameId || !userAddress) return

    setLoading(true)
    setError(null)

    try {
      const [gameResponse, orderBookResponse, userOrdersResponse] =
        await Promise.all([
          gameAPI.getGame(gameId),
          orderAPI.getOrderBook(gameId),
          orderAPI.getUserOrders(gameId, userAddress),
        ])

      if (gameResponse.success) {
        setGame(gameResponse.game)
        setBlocks(gameResponse.blocks || [])
        setCurrentRound(gameResponse.currentRound)

        // Set initial tab based on game status
        if (gameResponse.game.status === 'minting') {
          setActiveTab('mint')
        } else if (gameResponse.game.status === 'active') {
          setActiveTab('game')
        }
      }

      if (orderBookResponse.success) {
        setOrderBook(orderBookResponse.orderBook)
      }

      if (userOrdersResponse.success) {
        setUserOrders(userOrdersResponse.orders)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game data')
    } finally {
      setLoading(false)
    }
  }, [gameId, userAddress])

  // Load data after userAddress is set
  useEffect(() => {
    if (userAddress && gameId) {
      loadGameData()
    }
  }, [userAddress, gameId, loadGameData])

  // WebSocket Event Handlers
  useWebSocketEvent(
    'game_state_update',
    useCallback(
      (data) => {
        if (data.gameId === gameId) {
          setGame(data.game)
          setBlocks(data.blocks)
          if (data.currentRound) {
            setCurrentRound(data.currentRound)
          }
        }
      },
      [gameId]
    )
  )

  useWebSocketEvent(
    'round_started',
    useCallback(
      (data) => {
        if (data.gameId === gameId) {
          addNotification('info', `🎯 Round ${data.roundNumber} started! Trading for ${Math.floor(data.duration/1000)}s`)
          // Refresh data to get latest round info
          loadGameData()
        }
      },
      [gameId, addNotification, loadGameData]
    )
  )

  useWebSocketEvent(
    'trading_closed',
    useCallback(
      (data) => {
        if (data.gameId === gameId) {
          addNotification('warning', `📈 Trading closed for Round ${data.roundNumber}. VRF requested.`)
        }
      },
      [gameId, addNotification]
    )
  )

  useWebSocketEvent(
    'round_completed',
    useCallback(
      (data) => {
        if (data.gameId === gameId) {
          setLastReveal({
            results: data.results,
            roundNumber: data.roundNumber,
          })
          setActiveTab('reveal')
          addNotification(
            'info',
            `💥 Round ${data.roundNumber} completed - ${data.eliminatedCount} blocks eliminated`
          )
        }
      },
      [gameId, addNotification]
    )
  )

  useWebSocketEvent(
    'order_book_update',
    useCallback(
      (data) => {
        if (data.gameId === gameId) {
          setOrderBook(data.orderBook)
        }
      },
      [gameId]
    )
  )

  // Event handlers
  const handleMintSuccess = useCallback(
    (mintedBlocks: BlockData[]) => {
      addNotification('success', `Minted ${mintedBlocks.length} blocks!`)
      loadGameData()
    },
    [addNotification, loadGameData]
  )

  const handleMintError = useCallback(
    (error: string) => {
      addNotification('error', `Minting failed: ${error}`)
    },
    [addNotification]
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <div>Loading game...</div>
        </div>
      </div>
    )
  }

  if (error || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Error Loading Game</h1>
          <p className="text-gray-600 mb-4">{error || 'Game not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  const userBlocks = blocks.filter((b) => b.ownerId === userAddress)
  const aliveUserBlocks = userBlocks.filter((b) => b.status === 'alive')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Notifications */}
      <div className="fixed top-2 right-2 left-2 md:left-auto space-y-2 z-50 max-w-sm md:max-w-none md:top-4 md:right-4">
        <AnimatePresence>
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.9 }}
              className={cn(
                'p-3 rounded-lg shadow-lg',
                notification.type === 'success' && 'bg-green-500 text-white',
                notification.type === 'error' && 'bg-red-500 text-white',
                notification.type === 'info' && 'bg-blue-500 text-white'
              )}
            >
              <div className="flex items-center gap-2">
                {notification.type === 'success' && <CheckCircle className="w-4 h-4" />}
                {notification.type === 'error' && <AlertCircle className="w-4 h-4" />}
                {notification.type === 'info' && <AlertCircle className="w-4 h-4" />}
                <span className="text-sm">{notification.message}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Mobile Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="p-2 -ml-2 text-gray-600 hover:text-gray-900 md:hidden"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="hidden md:block">
                <button
                  onClick={() => navigate('/')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  ← Back
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg md:text-xl font-bold truncate">{game.title}</h1>
                <div className="text-xs md:text-sm text-gray-500">
                  #{gameId?.slice(0, 8)}... • {userBlocks.length} blocks
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="text-right text-xs md:text-sm">
                <div className="font-semibold">
                  {formatSOL(game.currentEV)}
                </div>
                <div className="text-gray-500 hidden md:block">EV</div>
              </div>
              
              <div
                className={cn(
                  'px-2 py-1 rounded text-xs font-medium',
                  game.status === 'minting' && 'bg-blue-100 text-blue-800',
                  game.status === 'active' && 'bg-green-100 text-green-800',
                  game.status === 'finished' && 'bg-gray-100 text-gray-800'
                )}
              >
                {game.status.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Stats Bar */}
        <div className="px-4 py-2 bg-gray-50 border-t md:hidden">
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div>
              <div className="font-semibold text-blue-600">{formatSOL(game.prizePool)}</div>
              <div className="text-gray-500">Prize</div>
            </div>
            <div>
              <div className="font-semibold text-green-600">{game.aliveBlocks.toLocaleString()}</div>
              <div className="text-gray-500">Alive</div>
            </div>
            <div>
              <div className="font-semibold text-purple-600">R{typeof game.currentRound === 'object' ? game.currentRound?.roundNumber || 0 : game.currentRound}</div>
              <div className="text-gray-500">Round</div>
            </div>
            <div>
              <div className="font-semibold text-yellow-600">{aliveUserBlocks.length}</div>
              <div className="text-gray-500">Your</div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Stats Bar */}
      <div className="bg-white border-b hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="grid grid-cols-6 gap-4 text-center text-sm">
            <div>
              <div className="font-semibold text-blue-600">
                {formatSOL(game.prizePool)}
              </div>
              <div className="text-gray-500">Prize Pool</div>
            </div>
            <div>
              <div className="font-semibold text-green-600">
                {game.aliveBlocks.toLocaleString()}
              </div>
              <div className="text-gray-500">Alive Blocks</div>
            </div>
            <div>
              <div className="font-semibold text-purple-600">
                Round {typeof game.currentRound === 'object' ? game.currentRound?.roundNumber || 0 : game.currentRound}
              </div>
              <div className="text-gray-500">Current</div>
            </div>
            <div>
              <div className="font-semibold text-orange-600">
                {formatSOL(game.currentEV)}
              </div>
              <div className="text-gray-500">Current EV</div>
            </div>
            <div>
              <div className="font-semibold text-teal-600">
                {(game.survivalProbability * 100).toFixed(1)}%
              </div>
              <div className="text-gray-500">Survival Rate</div>
            </div>
            <div>
              <div className="font-semibold text-yellow-600">
                {aliveUserBlocks.length}
              </div>
              <div className="text-gray-500">Your Alive</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Tab Navigation */}
      <div className="bg-white border-b md:hidden">
        <div className="flex">
          {[
            { id: 'game' as TabType, label: 'Game', icon: Trophy },
            { id: 'mint' as TabType, label: 'Mint', icon: Settings, disabled: game.status !== 'minting' },
            { id: 'trade' as TabType, label: 'Trade', icon: Users, disabled: game.status !== 'active' },
            { id: 'reveal' as TabType, label: 'Reveal', icon: Timer, disabled: !lastReveal }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-500",
                tab.disabled && "opacity-50 cursor-not-allowed"
              )}
              disabled={tab.disabled}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Tab Navigation */}
      <div className="bg-white border-b hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'game' as TabType, label: 'Game View', icon: Trophy },
              { id: 'mint' as TabType, label: 'Mint Blocks', icon: Settings, disabled: game.status !== 'minting' },
              { id: 'trade' as TabType, label: 'Trading', icon: Users, disabled: game.status !== 'active' },
              { id: 'reveal' as TabType, label: 'Live Reveal', icon: Timer, disabled: !lastReveal }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors",
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                  tab.disabled && "opacity-50 cursor-not-allowed"
                )}
                disabled={tab.disabled}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Game Timeline - Always show */}
      <div className="max-w-7xl mx-auto px-2 md:px-4 lg:px-8 pt-4">
        <GameTimeline 
          game={game}
          currentRound={currentRound}
        />
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-2 md:px-4 lg:px-8 py-4 md:py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'game' && (
            <motion.div
              key="game"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <GameGrid
                game={game}
                blocks={blocks}
                userAddress={userAddress}
                mode="view"
              />
            </motion.div>
          )}

          {activeTab === 'mint' && (
            <motion.div
              key="mint"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <MintingInterface
                game={game}
                blocks={blocks}
                userAddress={userAddress}
                onMintSuccess={handleMintSuccess}
                onMintError={handleMintError}
              />
            </motion.div>
          )}

          {activeTab === 'trade' && (
            <motion.div
              key="trade"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <OrderBook
                gameId={gameId!}
                orderBook={orderBook}
                userOrders={userOrders}
                userAddress={userAddress}
                game={game}
                onOrderCreated={(order) => {
                  addNotification('success', 'Order created!')
                  setUserOrders(prev => [order, ...prev])
                }}
                onOrderCancelled={(orderId) => {
                  addNotification('info', 'Order cancelled')
                  setUserOrders(prev => prev.filter(o => o.orderId !== orderId))
                }}
                onError={(error) => addNotification('error', `Order error: ${error}`)}
              />
            </motion.div>
          )}

          {activeTab === 'reveal' && lastReveal && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <LiveReveal
                game={game}
                blocks={blocks}
                roundResults={lastReveal.results}
                userAddress={userAddress}
                onRevealComplete={() => {
                  addNotification('info', 'Reveal completed')
                  setActiveTab('game')
                }}
                onUserBlockRevealed={(blockId, eliminated) => {
                  if (eliminated) {
                    addNotification('error', `Block #${blockId} eliminated 💥`)
                  } else {
                    addNotification('success', `Block #${blockId} survived! ✅`)
                  }
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}