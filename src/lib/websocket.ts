import { io, Socket } from 'socket.io-client'
import type { WebSocketEvents } from '../../../shared/types'

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3005'

export class WebSocketClient {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  connect(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve(this.socket)
        return
      }

      this.socket = io(WS_URL, {
        transports: ['websocket'],
        timeout: 20000,
      })

      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected:', this.socket?.id)
        this.reconnectAttempts = 0
        resolve(this.socket!)
      })

      this.socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket disconnected:', reason)
        
        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          this.handleReconnection()
        }
      })

      this.socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error)
        this.handleReconnection()
        reject(error)
      })

      // Set up default error handler
      this.socket.on('error', (data: WebSocketEvents['error']) => {
        console.error('❌ WebSocket error:', data)
      })
    })
  }

  private handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
      
      setTimeout(() => {
        this.socket?.connect()
      }, this.reconnectDelay * this.reconnectAttempts)
    } else {
      console.error('❌ Max reconnection attempts reached')
    }
  }

  disconnect() {
    this.socket?.disconnect()
    this.socket = null
  }

  // Game room management
  joinGame(gameId: string) {
    this.emit('join_game', { gameId })
  }

  leaveGame(gameId: string) {
    this.emit('leave_game', { gameId })
  }

  // Request data
  requestGameState(gameId: string) {
    this.emit('request_game_state', { gameId })
  }

  requestOrderBook(gameId: string) {
    this.emit('request_order_book', { gameId })
  }

  // Event emitters
  private emit<K extends keyof WebSocketEvents>(
    event: K,
    data: WebSocketEvents[K]
  ) {
    if (this.socket?.connected) {
      this.socket.emit(event as string, data)
    } else {
      console.warn('⚠️ WebSocket not connected, cannot emit:', event)
    }
  }

  // Event listeners
  on<K extends keyof WebSocketEvents>(
    event: K,
    callback: (data: WebSocketEvents[K]) => void
  ) {
    this.socket?.on(event as string, callback)
  }

  off<K extends keyof WebSocketEvents>(event: K, callback?: Function) {
    if (callback) {
      this.socket?.off(event as string, callback)
    } else {
      this.socket?.off(event as string)
    }
  }

  // Connection status
  get connected(): boolean {
    return this.socket?.connected || false
  }

  get id(): string | undefined {
    return this.socket?.id
  }
}

// Global WebSocket instance
export const websocket = new WebSocketClient()

// React Hook for WebSocket
import { useEffect, useRef } from 'react'

export function useWebSocket() {
  const socketRef = useRef<WebSocketClient | null>(null)

  useEffect(() => {
    socketRef.current = websocket

    // Connect on mount
    websocket.connect().catch(console.error)

    // Cleanup on unmount
    return () => {
      // Don't disconnect here as other components might be using it
      socketRef.current = null
    }
  }, [])

  return socketRef.current
}

// Hook for game-specific WebSocket events
export function useGameWebSocket(gameId: string | null) {
  const ws = useWebSocket()

  useEffect(() => {
    if (!ws || !gameId) return

    // Join game room
    ws.joinGame(gameId)

    // Request initial state
    ws.requestGameState(gameId)
    ws.requestOrderBook(gameId)

    return () => {
      // Leave game room when component unmounts or gameId changes
      ws.leaveGame(gameId)
    }
  }, [ws, gameId])

  return ws
}

// Hook for specific WebSocket event
export function useWebSocketEvent<K extends keyof WebSocketEvents>(
  event: K,
  callback: (data: WebSocketEvents[K]) => void,
  deps: any[] = []
) {
  const ws = useWebSocket()

  useEffect(() => {
    if (!ws) return

    ws.on(event, callback)

    return () => {
      ws.off(event, callback)
    }
  }, [ws, event, ...deps])
}