const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3005/api";

export class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "APIError";
  }
}

async function fetchAPI<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // Fallback to status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new APIError(response.status, errorMessage);
  }

  return response.json();
}

// Game API
export const gameAPI = {
  // Get all active games
  getGames: () => fetchAPI("/games"),

  // Get specific game
  getGame: (gameId: string) => fetchAPI(`/games/${gameId}`),

  // Create new game
  createGame: (data: {
    config: any;
    creatorAddress: string;
    title: string;
    description?: string;
  }) =>
    fetchAPI("/games", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Start minting phase
  startMinting: (gameId: string) =>
    fetchAPI(`/games/${gameId}/start-minting`, {
      method: "POST",
    }),

  // Start game (after minting)
  startGame: (gameId: string) =>
    fetchAPI(`/games/${gameId}/start-game`, {
      method: "POST",
    }),

  // Mint blocks
  mintBlocks: (
    gameId: string,
    data: {
      buyerAddress: string;
      blockIds?: number[];
      quantity?: number;
      paymentAmount: number;
    }
  ) =>
    fetchAPI(`/games/${gameId}/mint`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Get blocks
  getBlocks: (gameId: string) => fetchAPI(`/games/${gameId}/blocks`),

  // Get player blocks
  getPlayerBlocks: (gameId: string, playerAddress: string) =>
    fetchAPI(`/games/${gameId}/blocks/player/${playerAddress}`),

  // Get rounds
  getRounds: (gameId: string) => fetchAPI(`/games/${gameId}/rounds`),

  // Get current round
  getCurrentRound: (gameId: string) =>
    fetchAPI(`/games/${gameId}/rounds/current`),

  // Get game stats
  getGameStats: (gameId: string) => fetchAPI(`/games/${gameId}/stats`),

  // Trigger reveal (admin)
  triggerReveal: (gameId: string, roundNumber: number) =>
    fetchAPI(`/games/${gameId}/rounds/${roundNumber}/reveal`, {
      method: "POST",
    }),
};

// Order API
export const orderAPI = {
  // Create order
  createOrder: (data: {
    gameId: string;
    userId: string;
    type: "ask" | "any_bid";
    blockId?: number;
    price: number;
    quantity: number;
    carryOver?: boolean;
  }) =>
    fetchAPI("/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Cancel order
  cancelOrder: (orderId: string, userId: string) =>
    fetchAPI(`/orders/${orderId}`, {
      method: "DELETE",
      body: JSON.stringify({ userId }),
    }),

  // Get order book
  getOrderBook: (gameId: string) => fetchAPI(`/orders/game/${gameId}`),

  // Get user orders
  getUserOrders: (gameId: string, userId: string) =>
    fetchAPI(`/orders/game/${gameId}/user/${userId}`),

  // Get order history
  getOrderHistory: (gameId: string, limit?: number) =>
    fetchAPI(`/orders/game/${gameId}/history${limit ? `?limit=${limit}` : ""}`),

  // Get market stats
  getMarketStats: (gameId: string) => fetchAPI(`/orders/game/${gameId}/stats`),

  // Manual matching (admin)
  triggerMatching: (gameId: string) =>
    fetchAPI(`/orders/game/${gameId}/match`, {
      method: "POST",
    }),
};

// Admin API
export const adminAPI = {
  // System status
  getStatus: () => fetchAPI("/admin/status"),

  // Create demo game
  createDemoGame: () =>
    fetchAPI("/admin/seed-demo-game", {
      method: "POST",
    }),

  // Force VRF
  forceVRF: (gameId: string, roundNumber: number, seed?: string) =>
    fetchAPI(`/admin/games/${gameId}/force-vrf`, {
      method: "POST",
      body: JSON.stringify({ roundNumber, seed }),
    }),

  // Force round
  forceRound: (gameId: string) =>
    fetchAPI(`/admin/games/${gameId}/force-round`, {
      method: "POST",
    }),

  // Debug info
  getDebugInfo: (gameId: string) => fetchAPI(`/admin/games/${gameId}/debug`),

  // Delete game
  deleteGame: (gameId: string) =>
    fetchAPI(`/admin/games/${gameId}`, {
      method: "DELETE",
    }),

  // Get all games (admin)
  getAllGames: (status?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (limit) params.append("limit", limit.toString());
    return fetchAPI(
      `/admin/games${params.toString() ? `?${params.toString()}` : ""}`
    );
  },
};
