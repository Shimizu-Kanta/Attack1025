import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  applyFlips,
  applyPenaltyLoss,
  calculateScore,
  createBoard,
  createPokemonNumberPool,
  getAvailablePanels,
  rankTeams,
  revealAroundPanel,
} from '../logic/gameLogic'
import type {
  CaptureRequest,
  GameLog,
  GamePhase,
  GameSettings,
  Panel,
  Team,
  TeamRanking,
} from '../types/game'
import { createDefaultSeed } from '../utils/seed'

type SubmitRequestInput = {
  panelId: string
  teamId: string
  playerName: string
  evidenceUrl?: string
  comment?: string
}

type SetupTeamInput = {
  name: string
  color: string
  players: string[]
}

type GameStore = {
  phase: GamePhase
  settings: GameSettings
  teams: Team[]
  board: Panel[]
  requests: CaptureRequest[]
  logs: GameLog[]
  selectedPanelId: string | null
  startedAt: string | null
  endedAt: string | null

  availablePanels: () => Panel[]
  scores: () => Record<string, number>
  ranking: () => TeamRanking[]

  startGame: (settings: GameSettings, teams: SetupTeamInput[]) => void
  submitRequest: (input: SubmitRequestInput) => { ok: boolean; message?: string }
  approveRequest: (requestId: string) => void
  rejectRequest: (requestId: string, withPenalty: boolean) => void
  manualAcquirePanel: (panelId: string, teamId: string) => void
  endGame: () => void
  resetGame: () => void
  setSelectedPanel: (panelId: string | null) => void
}

const STORAGE_KEY = 'attack1025-game-state'

const initialSettings: GameSettings = {
  boardSize: 8,
  seed: createDefaultSeed(),
  pokemonNumberStart: 1,
  pokemonNumberEnd: 1025,
  excludedPokemonNumbers: [],
  revealMode: 'afterApproval',
  penaltyThreshold: 2,
}

const createLog = (type: GameLog['type'], message: string): GameLog => ({
  id: crypto.randomUUID(),
  type,
  message,
  createdAt: new Date().toISOString(),
})

const canRestoreActivePhase = (
  phase: GamePhase,
  teams: Team[] | undefined,
  board: Panel[] | undefined,
  startedAt: string | null,
  endedAt: string | null,
) => {
  if (phase === 'playing') {
    return (
      Array.isArray(teams) &&
      teams.length > 0 &&
      Array.isArray(board) &&
      board.length > 0 &&
      startedAt !== null
    )
  }

  if (phase === 'ended') {
    return (
      Array.isArray(teams) &&
      teams.length > 0 &&
      Array.isArray(board) &&
      board.length > 0 &&
      startedAt !== null &&
      endedAt !== null
    )
  }
  return true
}

const isGamePhase = (value: unknown): value is GamePhase =>
  value === 'setup' || value === 'playing' || value === 'ended'

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      phase: 'setup',
      settings: initialSettings,
      teams: [],
      board: [],
      requests: [],
      logs: [],
      selectedPanelId: null,
      startedAt: null,
      endedAt: null,

      availablePanels: () => getAvailablePanels(get().board, get().settings.boardSize),

      scores: () => {
        const board = get().board
        return Object.fromEntries(
          get().teams.map((team) => [team.id, calculateScore(board, team.id)]),
        )
      },

      ranking: () => rankTeams(get().board, get().teams),

      startGame: (settings, teamInputs) => {
        const current = get()
        if (current.phase === 'playing') {
          return
        }

        const pool = createPokemonNumberPool(
          settings.pokemonNumberStart,
          settings.pokemonNumberEnd,
          settings.excludedPokemonNumbers,
        )
        const board = createBoard(settings.boardSize, settings.seed, pool)

        const teams: Team[] = teamInputs.map((team, index) => ({
          id: `team-${index + 1}`,
          name: team.name,
          color: team.color,
          players: team.players,
          penaltyPoints: 0,
        }))

        set({
          phase: 'playing',
          settings,
          teams,
          board,
          requests: [],
          logs: [
            createLog(
              'game_start',
              `ゲーム開始: ${settings.boardSize}x${settings.boardSize} / seed=${settings.seed}`,
            ),
          ],
          selectedPanelId: null,
          startedAt: new Date().toISOString(),
          endedAt: null,
        })
      },

      submitRequest: ({ panelId, teamId, playerName, evidenceUrl, comment }) => {
        const state = get()
        const panel = state.board.find((item) => item.id === panelId)
        if (!panel) {
          return { ok: false, message: '対象パネルが見つかりません。' }
        }

        const canRequest = state.availablePanels().some((item) => item.id === panelId)
        if (!canRequest) {
          return { ok: false, message: 'このパネルは現在申請できません。' }
        }

        const requestId = crypto.randomUUID()
        const request: CaptureRequest = {
          id: requestId,
          panelId,
          pokemonNumber: panel.pokemonNumber,
          teamId,
          playerName,
          evidenceUrl: evidenceUrl?.trim() || undefined,
          comment: comment?.trim() || undefined,
          status: 'pending',
          submittedAt: new Date().toISOString(),
          penaltyApplied: false,
        }

        let nextBoard: Panel[] = state.board.map((item): Panel =>
          item.id === panelId
            ? {
                ...item,
                requestStatus: 'pending',
                pendingRequestIds: [...item.pendingRequestIds, requestId],
              }
            : item,
        )

        const nextLogs = [
          createLog('request_created', `${playerName} が No.${panel.pokemonNumber} を申請しました`),
          ...state.logs,
        ]

        if (state.settings.revealMode === 'onRequest') {
          const result = revealAroundPanel(nextBoard, state.settings.boardSize, panelId)
          nextBoard = result.board
          if (result.revealedCount > 0) {
            nextLogs.unshift(
              createLog('panel_revealed', `申請時仮公開により ${result.revealedCount} マス公開`),
            )
          }
        }

        set({
          board: nextBoard,
          requests: [...state.requests, request],
          logs: nextLogs,
        })

        return { ok: true }
      },

      approveRequest: (requestId) => {
        const state = get()
        const request = state.requests.find((item) => item.id === requestId)
        if (!request || request.status !== 'pending') {
          return
        }

        const panel = state.board.find((item) => item.id === request.panelId)
        if (!panel || panel.ownerTeamId) {
          return
        }

        const team = state.teams.find((item) => item.id === request.teamId)
        if (!team) {
          return
        }

        let nextBoard: Panel[] = state.board.map((item): Panel =>
          item.id === panel.id
            ? {
                ...item,
                ownerTeamId: team.id,
                revealStatus: 'revealed',
                requestStatus: 'none',
                pendingRequestIds: [],
              }
            : item,
        )

        const revealResult = revealAroundPanel(nextBoard, state.settings.boardSize, panel.id)
        nextBoard = revealResult.board

        const flipResult = applyFlips(nextBoard, state.settings.boardSize, panel.id, team.id)
        nextBoard = flipResult.board

        const nextRequests = state.requests.map((item) => {
          if (item.id === request.id) {
            return {
              ...item,
              status: 'approved' as const,
              reviewedAt: new Date().toISOString(),
            }
          }

          if (item.panelId === request.panelId && item.status === 'pending') {
            return {
              ...item,
              status: 'cancelled' as const,
              reviewedAt: new Date().toISOString(),
            }
          }

          return item
        })

        const logs = [
          createLog('request_approved', `${team.name} の申請を承認 (No.${panel.pokemonNumber})`),
          createLog('panel_acquired', `${team.name} が No.${panel.pokemonNumber} を取得`),
          ...state.logs,
        ]

        if (revealResult.revealedCount > 0) {
          logs.unshift(
            createLog('panel_revealed', `取得により ${revealResult.revealedCount} マス公開`),
          )
        }

        if (flipResult.flippedPanelIds.length > 0) {
          logs.unshift(
            createLog('panel_flipped', `${flipResult.flippedPanelIds.length} マス反転`),
          )
        }

        set({
          board: nextBoard,
          requests: nextRequests,
          logs,
        })
      },

      rejectRequest: (requestId, withPenalty) => {
        const state = get()
        const request = state.requests.find((item) => item.id === requestId)
        if (!request || request.status !== 'pending') {
          return
        }

        let nextBoard: Panel[] = state.board.map((item): Panel => {
          if (item.id !== request.panelId) {
            return item
          }

          const nextPending = item.pendingRequestIds.filter((id) => id !== request.id)
          return {
            ...item,
            requestStatus: nextPending.length > 0 ? 'pending' : 'none',
            pendingRequestIds: nextPending,
          }
        })

        const nextTeams = [...state.teams]
        const logs = [createLog('request_rejected', `申請を却下 (No.${request.pokemonNumber})`), ...state.logs]

        if (withPenalty) {
          const idx = nextTeams.findIndex((team) => team.id === request.teamId)
          if (idx >= 0) {
            const target = nextTeams[idx]
            const nextPenalty = target.penaltyPoints + 1
            nextTeams[idx] = { ...target, penaltyPoints: nextPenalty }
            logs.unshift(
              createLog('penalty_added', `${target.name} にペナルティ +1 (現在 ${nextPenalty})`),
            )

            if (nextPenalty >= state.settings.penaltyThreshold) {
              const loss = applyPenaltyLoss(nextBoard, target.id)
              nextBoard = loss.board
              nextTeams[idx] = {
                ...nextTeams[idx],
                penaltyPoints: 0,
              }
              if (loss.lostPanelId) {
                logs.unshift(createLog('panel_lost', `${target.name} がパネルを1枚喪失`))
              }
            }
          }
        }

        set({
          board: nextBoard,
          teams: nextTeams,
          requests: state.requests.map((item) =>
            item.id === request.id
              ? {
                  ...item,
                  status: 'rejected',
                  reviewedAt: new Date().toISOString(),
                  penaltyApplied: withPenalty,
                }
              : item,
          ),
          logs,
        })
      },

      manualAcquirePanel: (panelId, teamId) => {
        const state = get()
        const panel = state.board.find((item) => item.id === panelId)
        const team = state.teams.find((item) => item.id === teamId)
        if (!panel || !team || panel.ownerTeamId) {
          return
        }

        let nextBoard: Panel[] = state.board.map((item): Panel =>
          item.id === panel.id
            ? {
                ...item,
                ownerTeamId: team.id,
                revealStatus: 'revealed',
              }
            : item,
        )

        const revealResult = revealAroundPanel(nextBoard, state.settings.boardSize, panel.id)
        nextBoard = revealResult.board

        const flipResult = applyFlips(nextBoard, state.settings.boardSize, panel.id, team.id)
        nextBoard = flipResult.board

        const logs = [
          createLog('panel_acquired', `GM操作: ${team.name} が No.${panel.pokemonNumber} を取得`),
          ...state.logs,
        ]

        if (flipResult.flippedPanelIds.length > 0) {
          logs.unshift(
            createLog('panel_flipped', `GM操作で ${flipResult.flippedPanelIds.length} マス反転`),
          )
        }

        set({ board: nextBoard, logs })
      },

      endGame: () => {
        set((state) => {
          if (state.phase !== 'playing') {
            return state
          }

          return {
            ...state,
            phase: 'ended',
            endedAt: new Date().toISOString(),
            logs: [createLog('game_end', 'GMがゲームを終了しました'), ...state.logs],
          }
        })
      },

      resetGame: () => {
        set((state) => {
          const alreadyReset =
            state.phase === 'setup' &&
            state.teams.length === 0 &&
            state.board.length === 0 &&
            state.requests.length === 0 &&
            state.logs.length === 0 &&
            state.selectedPanelId === null &&
            state.startedAt === null &&
            state.endedAt === null

          if (alreadyReset) {
            return state
          }

          return {
            ...state,
            phase: 'setup',
            settings: { ...initialSettings, seed: createDefaultSeed() },
            teams: [],
            board: [],
            requests: [],
            logs: [],
            selectedPanelId: null,
            startedAt: null,
            endedAt: null,
          }
        })
      },

      setSelectedPanel: (panelId) => {
        set((state) => {
          if (state.selectedPanelId === panelId) {
            return state
          }
          return { ...state, selectedPanelId: panelId }
        })
      },
    }),
    {
      name: STORAGE_KEY,
      merge: (persistedState, currentState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return currentState
        }

        const persisted = persistedState as Partial<GameStore>
        const merged = {
          ...currentState,
          ...persisted,
        }

        const nextBoard = Array.isArray(merged.board) ? merged.board : []
        const nextTeams = Array.isArray(merged.teams) ? merged.teams : []
        const restoredStartedAt = typeof merged.startedAt === 'string' ? merged.startedAt : null
        const restoredEndedAt = typeof merged.endedAt === 'string' ? merged.endedAt : null
        const mergedPhase = isGamePhase(merged.phase) ? merged.phase : currentState.phase
        const nextPhase = canRestoreActivePhase(
          mergedPhase,
          nextTeams,
          nextBoard,
          restoredStartedAt,
          restoredEndedAt,
        )
          ? mergedPhase
          : 'setup'
        const phaseChangedOnRestore = nextPhase !== mergedPhase
        const startedAt =
          phaseChangedOnRestore || nextPhase === 'setup' ? null : restoredStartedAt
        const endedAt = phaseChangedOnRestore || nextPhase !== 'ended' ? null : restoredEndedAt
        const selectedPanelId =
          merged.selectedPanelId !== null &&
          merged.selectedPanelId !== undefined &&
          nextBoard.some((panel) => panel.id === merged.selectedPanelId)
            ? merged.selectedPanelId
            : null

        return {
          ...merged,
          phase: nextPhase,
          board: nextBoard,
          teams: nextTeams,
          requests: Array.isArray(merged.requests) ? merged.requests : [],
          logs: Array.isArray(merged.logs) ? merged.logs : [],
          selectedPanelId,
          startedAt,
          endedAt,
        }
      },
      partialize: (state) => ({
        phase: state.phase,
        settings: state.settings,
        teams: state.teams,
        board: state.board,
        requests: state.requests,
        logs: state.logs,
        selectedPanelId: state.selectedPanelId,
        startedAt: state.startedAt,
        endedAt: state.endedAt,
      }),
    },
  ),
)
