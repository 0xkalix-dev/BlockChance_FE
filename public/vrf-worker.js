// VRF Worker for heavy block elimination calculations
self.onmessage = function(e) {
  const { type, data } = e.data

  switch (type) {
    case 'CALCULATE_ELIMINATIONS':
      calculateEliminations(data)
      break
    case 'PROCESS_ROUND_RESULTS':
      processRoundResults(data)
      break
    default:
      console.warn('Unknown worker message type:', type)
  }
}

function calculateEliminations({ seed, roundNumber, blockIds, eliminationRate }) {
  const results = []
  
  for (const blockId of blockIds) {
    const vrfValue = generateBlockRandomness(seed, roundNumber, blockId)
    const eliminated = vrfValue < eliminationRate
    
    results.push({
      blockId,
      eliminated,
      vrfValue
    })
  }

  self.postMessage({
    type: 'ELIMINATIONS_CALCULATED',
    data: {
      results,
      roundNumber,
      eliminationRate
    }
  })
}

function processRoundResults({ results, gameState }) {
  const survivors = results.filter(r => !r.eliminated)
  const eliminated = results.filter(r => r.eliminated)
  
  // Calculate new stats
  const newStats = {
    aliveCount: survivors.length,
    eliminatedCount: eliminated.length,
    survivalRate: survivors.length / results.length,
    averageVRF: results.reduce((sum, r) => sum + r.vrfValue, 0) / results.length
  }

  self.postMessage({
    type: 'ROUND_RESULTS_PROCESSED',
    data: {
      survivors: survivors.map(r => r.blockId),
      eliminated: eliminated.map(r => r.blockId),
      stats: newStats
    }
  })
}

// Deterministic random number generation
function generateBlockRandomness(seed, roundNumber, blockId) {
  const combined = `${seed}_${roundNumber}_${blockId}`
  
  // Simple hash function for demo (in production, use crypto.subtle)
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Convert to 0-1 range
  return Math.abs(hash) / 2147483647
}

// Performance monitoring
let startTime
self.addEventListener('message', function(e) {
  startTime = performance.now()
})

function sendPerformanceData(operationType, dataSize) {
  const endTime = performance.now()
  const duration = endTime - startTime
  
  self.postMessage({
    type: 'PERFORMANCE_DATA',
    data: {
      operation: operationType,
      duration,
      dataSize,
      throughput: dataSize / duration * 1000 // items per second
    }
  })
}