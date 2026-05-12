export type RevealMode = 'afterApproval' | 'onRequest'

export type GamePhase = 'setup' | 'playing' | 'ended'

export type GameSettings = {
  boardSize: number
  seed: string
  pokemonNumberStart: number
  pokemonNumberEnd: number
  excludedPokemonNumbers: number[]
  revealMode: RevealMode
  penaltyThreshold: number
  initialOpenCount?: number
}

export type Team = {
  id: string
  name: string
  color: string
  players: string[]
  bonusNumbers?: number[]
  penaltyPoints: number
}

export type Panel = {
  id: string
  x: number
  y: number
  pokemonNumber: number
  ownerTeamId: string | null
  revealStatus: 'hidden' | 'revealed'
  requestStatus: 'none' | 'pending'
  pendingRequestIds: string[]
  highlightType?: 'none' | 'request' | 'bonus'
  highlightRequest?: boolean
  highlightBonus?: boolean
}

export type CaptureRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'

export type CaptureRequest = {
  id: string
  panelId: string
  pokemonNumber: number
  teamId: string
  playerName: string
  evidenceUrl?: string
  comment?: string
  status: CaptureRequestStatus
  submittedAt: string
  reviewedAt?: string
  penaltyApplied: boolean
}

export type GameLogType =
  | 'game_start'
  | 'request_created'
  | 'request_approved'
  | 'request_rejected'
  | 'panel_acquired'
  | 'panel_revealed'
  | 'panel_flipped'
  | 'penalty_added'
  | 'panel_lost'
  | 'game_end'

export type GameLog = {
  id: string
  type: GameLogType
  message: string
  createdAt: string
}

export type TeamRanking = {
  teamId: string
  score: number
  maxOwnedPokemonNumber: number
}
