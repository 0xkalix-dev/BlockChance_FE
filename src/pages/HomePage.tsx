import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  PlayCircle, 
  Users, 
  Trophy, 
  Clock, 
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Settings
} from 'lucide-react'
import { gameAPI, adminAPI } from '../lib/api'
import { cn, formatSOL, formatDate, generateMockAddress } from '../lib/utils'
import type { GameData } from '../../../shared/types'

interface GameCardProps {
  game: GameData
  onJoin: (gameId: string) => void
}

const GameCard: React.FC<GameCardProps> = ({ game, onJoin }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'minting':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'finished':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const canJoin = game.status === 'minting' || game.status === 'active'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="p-4 md:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">{game.title}</h3>
            {game.description && (
              <p className="text-gray-600 text-sm mb-2">{game.description}</p>
            )}
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-2 py-1 rounded text-xs font-medium border",
                getStatusColor(game.status)
              )}>
                {game.status.toUpperCase()}
              </span>
              <span className="text-xs text-gray-500">
                Round {typeof game.currentRound === 'object' ? game.currentRound?.roundNumber || 0 : game.currentRound}
              </span>
            </div>
          </div>
        </div>

        {/* Game Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div>
            <div className="text-gray-500">Prize Pool</div>
            <div className="font-semibold text-blue-600">
              {formatSOL(game.prizePool)}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Grid Size</div>
            <div className="font-semibold">
              {game.config.gridSize.rows} × {game.config.gridSize.cols}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Alive Blocks</div>
            <div className="font-semibold text-green-600">
              {game.aliveBlocks.toLocaleString()} / {game.totalBlocks.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Current EV</div>
            <div className="font-semibold text-orange-600">
              {formatSOL(game.currentEV)}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {game.status === 'minting' && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Blocks Sold</span>
              <span>{game.soldBlocks.toLocaleString()} / {game.totalBlocks.toLocaleString()}</span>
            </div>
            <div className="bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 rounded-full h-2 transition-all duration-300"
                style={{ 
                  width: `${(game.soldBlocks / game.totalBlocks) * 100}%` 
                }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex gap-2">
          <button
            onClick={() => onJoin(game.gameId)}
            disabled={!canJoin}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded font-medium text-sm transition-colors",
              canJoin
                ? "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            )}
          >
            {game.status === 'minting' ? (
              <>
                <PlayCircle className="w-4 h-4" />
                Join & Mint
              </>
            ) : game.status === 'active' ? (
              <>
                <Trophy className="w-4 h-4" />
                Join Game
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4" />
                View Results
              </>
            )}
          </button>
          
          <button
            onClick={() => onJoin(game.gameId)}
            className="px-3 py-2 border border-gray-300 text-gray-600 rounded hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>

        {/* Footer Info */}
        <div className="mt-4 pt-4 border-t text-xs text-gray-500 space-y-1">
          <div>Created: {formatDate(game.createdAt)}</div>
          {game.gameStartTime && (
            <div>Started: {formatDate(game.gameStartTime)}</div>
          )}
          {game.winnerId && (
            <div>Winner: {game.winnerId.slice(0, 8)}...</div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const [games, setGames] = useState<GameData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userAddress, setUserAddress] = useState<string>('')
  
  // Initialize user address only on client side
  useEffect(() => {
    setUserAddress(generateMockAddress())
  }, [])

  const loadGames = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await gameAPI.getGames()
      if (response.success) {
        setGames(response.games || [])
      } else {
        setError('Failed to load games')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load games')
    } finally {
      setLoading(false)
    }
  }, [])

  const createDemoGame = useCallback(async () => {
    try {
      const response = await adminAPI.createDemoGame()
      if (response.success) {
        navigate(`/game/${response.game.gameId}`)
      }
    } catch (err) {
      console.error('Failed to create demo game:', err)
    }
  }, [navigate])

  const handleJoinGame = useCallback((gameId: string) => {
    navigate(`/game/${gameId}`)
  }, [navigate])

  useEffect(() => {
    if (userAddress) {
      loadGames()
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(loadGames, 30000)
      return () => clearInterval(interval)
    }
  }, [loadGames, userAddress])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                🎲 BlockChance
              </h1>
              <span className="ml-3 text-sm text-gray-500 hidden sm:inline">
                Solana Survival Lottery
              </span>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4">
              <div className="text-right text-xs md:text-sm hidden sm:block">
                <div className="text-gray-500">Your Address</div>
                <div className="font-mono text-xs">
                  {userAddress}
                </div>
              </div>
              
              <button
                onClick={createDemoGame}
                className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Demo Game</span>
              </button>
              
              <button
                onClick={loadGames}
                disabled={loading}
                className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16">
          <div className="text-center">
            <h2 className="text-2xl md:text-4xl font-bold mb-4">
              Survival-Based Blockchain Lottery
            </h2>
            <p className="text-lg md:text-xl mb-6 md:mb-8 text-blue-100">
              Buy blocks, survive elimination rounds, and win the prize pool
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Settings className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Mint Blocks</h3>
                <p className="text-blue-100 text-sm">
                  Choose your blocks or get random assignments
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Trade & Survive</h3>
                <p className="text-blue-100 text-sm">
                  Trade blocks and survive VRF-based elimination rounds
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Win Prizes</h3>
                <p className="text-blue-100 text-sm">
                  Last survivor takes the entire prize pool
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Games Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Active Games</h2>
            <p className="text-gray-600 text-sm">Join a game or create a new one</p>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">Last updated:</span>
            <span>{loading ? '...' : new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-16"
            >
              <div className="flex items-center gap-3 text-gray-600">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <div>Loading games...</div>
              </div>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-16"
            >
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Failed to Load Games
                </h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={loadGames}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            </motion.div>
          ) : games.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-16"
            >
              <div className="text-gray-500 mb-4">
                <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Games Available</h3>
                <p>Create a demo game to get started</p>
              </div>
              <button
                onClick={createDemoGame}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Create Demo Game
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="games"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <AnimatePresence>
                  {games.map(game => (
                    <GameCard
                      key={game.gameId}
                      game={game}
                      onJoin={handleJoinGame}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <div className="text-center text-gray-500">
            <p className="text-sm md:text-base">BlockChance - Solana Survival Lottery Platform</p>
            <p className="text-xs md:text-sm mt-2">
              Built with Vite, React, Framer Motion, and Canvas optimization
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}