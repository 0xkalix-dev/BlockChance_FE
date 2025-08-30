'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { gameAPI, orderAPI } from '@/lib/api'
import type { GameData, BlockData, OrderData, OrderBook as OrderBookType, RoundData } from '../../../shared/types'

interface LazyGameData {
  game: GameData | null
  blocks: BlockData[]
  currentRound: RoundData | null
  orderBook: OrderBookType
  userOrders: OrderData[]
  loading: boolean
  error: string | null
  loadProgress: number
  refresh: () => void
}

export function useLazyGameData(gameId: string | null, userAddress: string): LazyGameData {
  const [game, setGame] = useState<GameData | null>(null)
  const [blocks, setBlocks] = useState<BlockData[]>([])
  const [currentRound, setCurrentRound] = useState<RoundData | null>(null)
  const [orderBook, setOrderBook] = useState<OrderBookType>({ asks: [], bids: [] })
  const [userOrders, setUserOrders] = useState<OrderData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadProgress, setLoadProgress] = useState(0)
  
  const abortControllerRef = useRef<AbortController | null>(null)
  const cacheRef = useRef<Map<string, any>>(new Map())

  const loadData = useCallback(async () => {
    if (!gameId || !userAddress) return

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    setLoading(true)
    setError(null)
    setLoadProgress(0)

    try {
      // Step 1: Load game data first (fastest)
      setLoadProgress(25)
      const gameResponse = await gameAPI.getGame(gameId)
      
      if (signal.aborted) return
      
      if (gameResponse.success) {
        setGame(gameResponse.game)
        setCurrentRound(gameResponse.currentRound)
        setBlocks(gameResponse.blocks || [])
        
        // Cache game data
        cacheRef.current.set(`game_${gameId}`, gameResponse)
      }

      // Step 2: Load order book (medium priority)
      setLoadProgress(50)
      if (!signal.aborted) {
        const orderBookResponse = await orderAPI.getOrderBook(gameId)
        if (orderBookResponse.success) {
          setOrderBook(orderBookResponse.orderBook)
        }
      }

      // Step 3: Load user orders (lowest priority)
      setLoadProgress(75)
      if (!signal.aborted) {
        try {
          const userOrdersResponse = await orderAPI.getUserOrders(gameId, userAddress)
          if (userOrdersResponse.success) {
            setUserOrders(userOrdersResponse.orders)
          }
        } catch (err) {
          // User orders are optional, don't fail the whole load
          console.warn('Failed to load user orders:', err)
        }
      }

      setLoadProgress(100)
    } catch (err) {
      if (!signal.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to load game data')
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false)
      }
    }
  }, [gameId, userAddress])

  // Load data when gameId or userAddress changes
  useEffect(() => {
    if (gameId && userAddress) {
      loadData()
    }
  }, [gameId, userAddress, loadData])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const refresh = useCallback(() => {
    loadData()
  }, [loadData])

  return {
    game,
    blocks,
    currentRound,
    orderBook,
    userOrders,
    loading,
    error,
    loadProgress,
    refresh
  }
}

// Hook for optimized block data loading
export function useOptimizedBlocks(blocks: BlockData[], userAddress: string) {
  return useMemo(() => {
    const userBlocks = blocks.filter(b => b.ownerId === userAddress)
    const aliveBlocks = blocks.filter(b => b.status === 'alive')
    const eliminatedBlocks = blocks.filter(b => b.status === 'eliminated')
    
    // Create efficient lookup maps
    const blockMap = new Map<number, BlockData>()
    blocks.forEach(block => {
      blockMap.set(block.blockId, block)
    })

    const statusMap = new Map<number, string>()
    blocks.forEach(block => {
      statusMap.set(block.blockId, block.status)
    })

    const ownerMap = new Map<number, string | undefined>()
    blocks.forEach(block => {
      if (block.ownerId) {
        ownerMap.set(block.blockId, block.ownerId)
      }
    })

    return {
      userBlocks,
      aliveBlocks,
      eliminatedBlocks,
      blockMap,
      statusMap,
      ownerMap,
      userBlockCount: userBlocks.length,
      aliveCount: aliveBlocks.length,
      eliminatedCount: eliminatedBlocks.length
    }
  }, [blocks, userAddress])
}