import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSOL(amount: number): string {
  return `${amount.toFixed(4)} SOL`
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString()
}

export function getBlockPosition(blockId: number, cols: number) {
  return {
    row: Math.floor(blockId / cols),
    col: blockId % cols
  }
}

export function getBlockId(row: number, col: number, cols: number): number {
  return row * cols + col
}

export function calculateEV(prizePool: number, aliveBlocks: number): number {
  return aliveBlocks > 0 ? prizePool / aliveBlocks : 0
}

export function calculateNextRoundEV(
  prizePool: number, 
  aliveBlocks: number, 
  eliminationRate: number
): number {
  const expectedSurvivors = aliveBlocks * (1 - eliminationRate)
  return expectedSurvivors > 0 ? prizePool / expectedSurvivors : 0
}

export function getBlockStatusColor(status: string, isOwned: boolean = false): string {
  if (isOwned) return 'border-yellow-400 bg-yellow-100'
  
  switch (status) {
    case 'alive':
      return 'border-green-400 bg-green-100'
    case 'eliminated':
      return 'border-red-400 bg-red-100'
    case 'unsold':
      return 'border-gray-300 bg-gray-50'
    default:
      return 'border-gray-300 bg-gray-50'
  }
}

export function getOrderTypeColor(type: string): string {
  switch (type) {
    case 'ask':
      return 'text-red-600 bg-red-50'
    case 'any_bid':
      return 'text-green-600 bg-green-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function generateMockAddress(): string {
  return 'player_' + Math.random().toString(36).substring(2, 8)
}

export function shortenAddress(address: string): string {
  if (address.length < 8) return address
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}