'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown, Plus, X, Loader2 } from 'lucide-react'
import { cn, formatSOL, formatDate, getOrderTypeColor } from '@/lib/utils'
import { orderAPI } from '@/lib/api'
import type { OrderData, OrderBook as OrderBookType, GameData } from '../../../shared/types'

interface OrderBookProps {
  gameId: string
  orderBook: OrderBookType
  userOrders: OrderData[]
  userAddress: string
  game: GameData
  onOrderCreated?: (order: OrderData) => void
  onOrderCancelled?: (orderId: string) => void
  onError?: (error: string) => void
}

interface CreateOrderFormProps {
  gameId: string
  userAddress: string
  type: 'ask' | 'any_bid'
  availableBlocks?: number[]
  onSubmit: (orderData: any) => void
  onCancel: () => void
  isSubmitting: boolean
}

const CreateOrderForm: React.FC<CreateOrderFormProps> = ({
  gameId,
  userAddress,
  type,
  availableBlocks = [],
  onSubmit,
  onCancel,
  isSubmitting
}) => {
  const [formData, setFormData] = useState({
    blockId: type === 'ask' ? (availableBlocks[0] || '') : '',
    price: '',
    quantity: '1',
    carryOver: true
  })

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    
    const orderData = {
      gameId,
      userId: userAddress,
      type,
      price: parseFloat(formData.price),
      quantity: parseInt(formData.quantity),
      carryOver: formData.carryOver,
      ...(type === 'ask' && { blockId: parseInt(formData.blockId) })
    }

    onSubmit(orderData)
  }, [formData, gameId, userAddress, type, onSubmit])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white p-4 rounded-lg border shadow-lg"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">
          Create {type === 'ask' ? 'Sell' : 'Buy'} Order
        </h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {type === 'ask' && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Block ID
            </label>
            <select
              value={formData.blockId}
              onChange={(e) => setFormData(prev => ({ ...prev, blockId: e.target.value }))}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select block</option>
              {availableBlocks.map(blockId => (
                <option key={blockId} value={blockId}>
                  Block #{blockId}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            Price (SOL)
          </label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={formData.price}
            onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.000"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Quantity
          </label>
          <input
            type="number"
            min="1"
            value={formData.quantity}
            onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="carryOver"
            checked={formData.carryOver}
            onChange={(e) => setFormData(prev => ({ ...prev, carryOver: e.target.checked }))}
            className="rounded"
          />
          <label htmlFor="carryOver" className="text-sm">
            Carry over to next round
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "flex-1 px-4 py-2 rounded text-white font-medium",
              type === 'ask' 
                ? "bg-red-600 hover:bg-red-700" 
                : "bg-green-600 hover:bg-green-700",
              isSubmitting && "opacity-50 cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : (
              `Create ${type === 'ask' ? 'Sell' : 'Buy'} Order`
            )}
          </button>
        </div>
      </form>
    </motion.div>
  )
}

const OrderRow: React.FC<{ 
  order: OrderData
  type: 'ask' | 'bid'
  isUserOrder: boolean
  onCancel?: (orderId: string) => void
  isCancelling: boolean
}> = ({ order, type, isUserOrder, onCancel, isCancelling }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: type === 'ask' ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-center justify-between p-2 border-b last:border-b-0 hover:bg-gray-50",
        isUserOrder && "bg-blue-50"
      )}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">
            {formatSOL(order.price)}
          </span>
          {order.blockId && (
            <span className="text-xs text-gray-500">
              Block #{order.blockId}
            </span>
          )}
          {isUserOrder && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">
              You
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {order.quantity} blocks • {order.fillPercentage.toFixed(1)}% filled
        </div>
      </div>

      {isUserOrder && onCancel && (
        <button
          onClick={() => onCancel(order.orderId)}
          disabled={isCancelling}
          className="ml-2 text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          {isCancelling ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <X className="w-3 h-3" />
          )}
        </button>
      )}
    </motion.div>
  )
}

export const OrderBook: React.FC<OrderBookProps> = ({
  gameId,
  orderBook,
  userOrders,
  userAddress,
  game,
  onOrderCreated,
  onOrderCancelled,
  onError
}) => {
  const [showCreateForm, setShowCreateForm] = useState<'ask' | 'any_bid' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cancellingOrders, setCancellingOrders] = useState<Set<string>>(new Set())

  // Get user's available blocks for selling
  const userBlocks = userOrders
    .filter(o => o.type === 'ask' && o.status === 'active')
    .map(o => o.blockId!)

  const availableBlocksForSell = Array.from({ length: game.totalBlocks }, (_, i) => i)
    .filter(blockId => !userBlocks.includes(blockId))

  const handleCreateOrder = useCallback(async (orderData: any) => {
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      const result = await orderAPI.createOrder(orderData)
      if (result.success) {
        onOrderCreated?.(result.order)
        setShowCreateForm(null)
      } else {
        onError?.(result.message || 'Failed to create order')
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to create order')
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, onOrderCreated, onError])

  const handleCancelOrder = useCallback(async (orderId: string) => {
    setCancellingOrders(prev => new Set([...prev, orderId]))
    
    try {
      const result = await orderAPI.cancelOrder(orderId, userAddress)
      if (result.success) {
        onOrderCancelled?.(orderId)
      } else {
        onError?.(result.message || 'Failed to cancel order')
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to cancel order')
    } finally {
      setCancellingOrders(prev => {
        const newSet = new Set(prev)
        newSet.delete(orderId)
        return newSet
      })
    }
  }, [userAddress, onOrderCancelled, onError])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Order Book</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateForm('ask')}
            className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            <TrendingDown className="w-3 h-3" />
            Sell
          </button>
          <button
            onClick={() => setShowCreateForm('any_bid')}
            className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
          >
            <TrendingUp className="w-3 h-3" />
            Buy
          </button>
        </div>
      </div>

      {/* Create Order Form */}
      <AnimatePresence>
        {showCreateForm && (
          <CreateOrderForm
            gameId={gameId}
            userAddress={userAddress}
            type={showCreateForm}
            availableBlocks={availableBlocksForSell}
            onSubmit={handleCreateOrder}
            onCancel={() => setShowCreateForm(null)}
            isSubmitting={isSubmitting}
          />
        )}
      </AnimatePresence>

      {/* Order Book */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sell Orders (ASK) */}
        <div className="bg-white rounded-lg border">
          <div className="bg-red-50 p-3 border-b">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <h3 className="font-semibold text-red-800">
                Sell Orders ({orderBook.asks.length})
              </h3>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <AnimatePresence>
              {orderBook.asks.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No sell orders
                </div>
              ) : (
                orderBook.asks.map(order => (
                  <OrderRow
                    key={order.orderId}
                    order={order}
                    type="ask"
                    isUserOrder={order.userId === userAddress}
                    onCancel={handleCancelOrder}
                    isCancelling={cancellingOrders.has(order.orderId)}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Buy Orders (BID) */}
        <div className="bg-white rounded-lg border">
          <div className="bg-green-50 p-3 border-b">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <h3 className="font-semibold text-green-800">
                Buy Orders ({orderBook.bids.length})
              </h3>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <AnimatePresence>
              {orderBook.bids.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No buy orders
                </div>
              ) : (
                orderBook.bids.map(order => (
                  <OrderRow
                    key={order.orderId}
                    order={order}
                    type="bid"
                    isUserOrder={order.userId === userAddress}
                    onCancel={handleCancelOrder}
                    isCancelling={cancellingOrders.has(order.orderId)}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Your Orders */}
      {userOrders.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="bg-blue-50 p-3 border-b">
            <h3 className="font-semibold text-blue-800">
              Your Orders ({userOrders.length})
            </h3>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {userOrders.map(order => (
              <div
                key={order.orderId}
                className="flex items-center justify-between p-2 border-b last:border-b-0"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs px-2 py-1 rounded",
                      getOrderTypeColor(order.type)
                    )}>
                      {order.type.toUpperCase()}
                    </span>
                    <span className="font-mono text-sm">
                      {formatSOL(order.price)}
                    </span>
                    {order.blockId && (
                      <span className="text-xs text-gray-500">
                        Block #{order.blockId}
                      </span>
                    )}
                    <span className={cn(
                      "text-xs px-1 rounded",
                      order.status === 'active' ? 'bg-green-100 text-green-700' :
                      order.status === 'filled' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    )}>
                      {order.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {order.quantity} blocks • {order.fillPercentage.toFixed(1)}% filled
                  </div>
                </div>
                {order.status === 'active' && (
                  <button
                    onClick={() => handleCancelOrder(order.orderId)}
                    disabled={cancellingOrders.has(order.orderId)}
                    className="ml-2 text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    {cancellingOrders.has(order.orderId) ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market Stats */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
          <div>
            <div className="font-semibold">Best Sell</div>
            <div className="text-red-600">
              {orderBook.asks.length > 0 
                ? formatSOL(Math.min(...orderBook.asks.map(o => o.price)))
                : 'N/A'
              }
            </div>
          </div>
          <div>
            <div className="font-semibold">Best Buy</div>
            <div className="text-green-600">
              {orderBook.bids.length > 0 
                ? formatSOL(Math.max(...orderBook.bids.map(o => o.price)))
                : 'N/A'
              }
            </div>
          </div>
          <div>
            <div className="font-semibold">Spread</div>
            <div className="text-gray-600">
              {orderBook.asks.length > 0 && orderBook.bids.length > 0
                ? formatSOL(
                    Math.min(...orderBook.asks.map(o => o.price)) - 
                    Math.max(...orderBook.bids.map(o => o.price))
                  )
                : 'N/A'
              }
            </div>
          </div>
          <div>
            <div className="font-semibold">Current EV</div>
            <div className="text-blue-600">
              {formatSOL(game.currentEV)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}