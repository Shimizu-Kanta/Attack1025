import type { Panel, Team, TeamRanking } from '../types/game'
import { seededRandom } from '../utils/seed'

const DIRECTIONS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const

const DIRECTIONS_8 = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
] as const

export const createPokemonNumberPool = (
  start: number,
  end: number,
  excluded: number[],
): number[] => {
  const excludedSet = new Set(excluded)
  const pool: number[] = []

  for (let no = Math.max(1, start); no <= Math.min(1025, end); no += 1) {
    if (!excludedSet.has(no)) {
      pool.push(no)
    }
  }

  return pool
}

export const createBoard = (
  boardSize: number,
  seed: string,
  pokemonPool: number[],
  initialOpenCount = 1,
): Panel[] => {
  const needed = boardSize * boardSize
  if (pokemonPool.length < needed) {
    throw new Error('使用可能な図鑑番号が盤面サイズより少ないため盤面を生成できません。')
  }

  const random = seededRandom(seed)
  const numbers = [...pokemonPool]
  for (let i = numbers.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[numbers[i], numbers[j]] = [numbers[j], numbers[i]]
  }

  const selected = numbers.slice(0, needed)

  // choose initialOpenCount unique indices to reveal, seeded by the provided seed
  const rnd = seededRandom(seed + '-open')
  const indices = Array.from({ length: needed }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  const openCount = Math.max(0, Math.min(needed, Math.floor(initialOpenCount)))
  const openSet = new Set(indices.slice(0, openCount))

  return selected.map((pokemonNumber, index) => {
    const x = index % boardSize
    const y = Math.floor(index / boardSize)
    const id = `p-${x}-${y}`

    return {
      id,
      x,
      y,
      pokemonNumber,
      ownerTeamId: null,
      revealStatus: openSet.has(index) ? 'revealed' : 'hidden',
      requestStatus: 'none',
      pendingRequestIds: [],
    }
  })
}

export const getPanelByPosition = (
  board: Panel[],
  boardSize: number,
  x: number,
  y: number,
): Panel | undefined => {
  if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) {
    return undefined
  }
  return board[y * boardSize + x]
}

export const revealAroundPanel = (
  board: Panel[],
  boardSize: number,
  panelId: string,
): { board: Panel[]; revealedCount: number } => {
  const nextBoard = board.map((panel) => ({ ...panel }))
  const index = nextBoard.findIndex((panel) => panel.id === panelId)

  if (index < 0) {
    return { board, revealedCount: 0 }
  }

  const target = nextBoard[index]
  let revealedCount = 0

  if (target.revealStatus === 'hidden') {
    target.revealStatus = 'revealed'
    revealedCount += 1
  }

  for (const [dx, dy] of DIRECTIONS) {
    const neighbor = getPanelByPosition(nextBoard, boardSize, target.x + dx, target.y + dy)
    if (neighbor && neighbor.revealStatus === 'hidden') {
      neighbor.revealStatus = 'revealed'
      revealedCount += 1
    }
  }

  return { board: nextBoard, revealedCount }
}

export const getAvailablePanels = (board: Panel[], boardSize: number): Panel[] => {
  // All revealed and unowned panels are available for request/acquisition.
  // Previously availability required adjacency to owned panels after initial captures.
  return board.filter((panel) => panel.revealStatus === 'revealed' && panel.ownerTeamId === null)
}

export const applyFlips = (
  board: Panel[],
  boardSize: number,
  panelId: string,
  teamId: string,
): { board: Panel[]; flippedPanelIds: string[] } => {
  const nextBoard = board.map((panel) => ({ ...panel }))
  const startPanel = nextBoard.find((panel) => panel.id === panelId)

  if (!startPanel) {
    return { board, flippedPanelIds: [] }
  }

  const flipped = new Set<string>()

  for (const [dx, dy] of DIRECTIONS_8) {
    let x = startPanel.x + dx
    let y = startPanel.y + dy
    const chain: Panel[] = []

    while (true) {
      const panel = getPanelByPosition(nextBoard, boardSize, x, y)
      if (!panel || !panel.ownerTeamId) {
        chain.length = 0
        break
      }
      if (panel.ownerTeamId === teamId) {
        break
      }
      chain.push(panel)
      x += dx
      y += dy
    }

    const edge = getPanelByPosition(nextBoard, boardSize, x, y)
    if (!edge || edge.ownerTeamId !== teamId) {
      continue
    }

    chain.forEach((panel) => {
      panel.ownerTeamId = teamId
      flipped.add(panel.id)
    })
  }

  return { board: nextBoard, flippedPanelIds: Array.from(flipped) }
}

export const calculateScore = (board: Panel[], teamId: string): number => {
  return board.filter((panel) => panel.ownerTeamId === teamId).length
}

export const rankTeams = (board: Panel[], teams: Team[]): TeamRanking[] => {
  return teams
    .map((team) => {
      const owned = board.filter((panel) => panel.ownerTeamId === team.id)
      const maxOwnedPokemonNumber = owned.reduce(
        (max, panel) => Math.max(max, panel.pokemonNumber),
        0,
      )

      return {
        teamId: team.id,
        score: owned.length,
        maxOwnedPokemonNumber,
      }
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.maxOwnedPokemonNumber - a.maxOwnedPokemonNumber ||
        a.teamId.localeCompare(b.teamId),
    )
}

export const applyPenaltyLoss = (
  board: Panel[],
  teamId: string,
): { board: Panel[]; lostPanelId: string | null } => {
  const owned = board.filter((panel) => panel.ownerTeamId === teamId)
  if (owned.length === 0) {
    return { board, lostPanelId: null }
  }

  const lost = owned[Math.floor(Math.random() * owned.length)]
  const nextBoard: Panel[] = board.map((panel): Panel =>
    panel.id === lost.id
      ? {
          ...panel,
          ownerTeamId: null,
          revealStatus: 'revealed',
        }
      : panel,
  )

  return { board: nextBoard, lostPanelId: lost.id }
}
