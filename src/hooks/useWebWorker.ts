'use client'

import { useEffect, useRef, useCallback } from 'react'

interface WebWorkerMessage {
  type: string
  data: any
}

interface UseWebWorkerOptions {
  onMessage?: (message: WebWorkerMessage) => void
  onError?: (error: ErrorEvent) => void
}

export function useWebWorker(scriptPath: string, options?: UseWebWorkerOptions) {
  const workerRef = useRef<Worker | null>(null)
  const messageHandlersRef = useRef<Map<string, (data: any) => void>>(new Map())

  // Initialize worker
  useEffect(() => {
    if (typeof window !== 'undefined') {
      workerRef.current = new Worker(scriptPath)
      
      workerRef.current.onmessage = (e) => {
        const { type, data } = e.data
        
        // Call specific handler if exists
        const handler = messageHandlersRef.current.get(type)
        if (handler) {
          handler(data)
        }
        
        // Call general message handler
        options?.onMessage?.(e.data)
      }
      
      workerRef.current.onerror = (error) => {
        console.error('WebWorker error:', error)
        options?.onError?.(error)
      }
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }
    }
  }, [scriptPath, options])

  // Send message to worker
  const postMessage = useCallback((type: string, data: any) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type, data })
    }
  }, [])

  // Register message handler
  const onMessage = useCallback((type: string, handler: (data: any) => void) => {
    messageHandlersRef.current.set(type, handler)
  }, [])

  // Remove message handler
  const offMessage = useCallback((type: string) => {
    messageHandlersRef.current.delete(type)
  }, [])

  return {
    postMessage,
    onMessage,
    offMessage,
    isAvailable: !!workerRef.current
  }
}

// Hook specifically for VRF calculations
export function useVRFWorker() {
  const worker = useWebWorker('/vrf-worker.js')
  
  const calculateEliminations = useCallback((
    seed: string,
    roundNumber: number,
    blockIds: number[],
    eliminationRate: number
  ) => {
    return new Promise((resolve) => {
      worker.onMessage('ELIMINATIONS_CALCULATED', resolve)
      worker.postMessage('CALCULATE_ELIMINATIONS', {
        seed,
        roundNumber,
        blockIds,
        eliminationRate
      })
    })
  }, [worker])

  const processRoundResults = useCallback((
    results: any[],
    gameState: any
  ) => {
    return new Promise((resolve) => {
      worker.onMessage('ROUND_RESULTS_PROCESSED', resolve)
      worker.postMessage('PROCESS_ROUND_RESULTS', {
        results,
        gameState
      })
    })
  }, [worker])

  return {
    calculateEliminations,
    processRoundResults,
    isAvailable: worker.isAvailable
  }
}

// Hook for performance monitoring
export function usePerformanceMonitor() {
  const metricsRef = useRef<Map<string, number[]>>(new Map())
  
  const recordMetric = useCallback((operation: string, duration: number, dataSize?: number) => {
    const metrics = metricsRef.current.get(operation) || []
    metrics.push(duration)
    
    // Keep only last 10 measurements
    if (metrics.length > 10) {
      metrics.shift()
    }
    
    metricsRef.current.set(operation, metrics)
  }, [])

  const getAverageMetric = useCallback((operation: string) => {
    const metrics = metricsRef.current.get(operation) || []
    if (metrics.length === 0) return 0
    
    return metrics.reduce((sum, m) => sum + m, 0) / metrics.length
  }, [])

  const getAllMetrics = useCallback(() => {
    const result: Record<string, { avg: number, last: number, count: number }> = {}
    
    for (const [operation, metrics] of metricsRef.current) {
      result[operation] = {
        avg: metrics.reduce((sum, m) => sum + m, 0) / metrics.length,
        last: metrics[metrics.length - 1] || 0,
        count: metrics.length
      }
    }
    
    return result
  }, [])

  return {
    recordMetric,
    getAverageMetric,
    getAllMetrics
  }
}