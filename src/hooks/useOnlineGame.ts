import { useEffect } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { db } from '../firebase/firestore'
import { useGameStore } from '../store/gameStore'
import type {
  CaptureRequest,
  GameLog,
  GamePhase,
  GameSettings,
  Panel,
  Team,
} from '../types/game'
import { computePanelHighlights } from '../logic/gameLogic'

export const useOnlineGame = (gameId: string | undefined) => {
  const setOnlineState = useGameStore((state) => state.setOnlineState)

  useEffect(() => {
    if (!gameId) return

    const gameRef = doc(db, 'games', gameId)

    const unsubGame = onSnapshot(gameRef, (snapshot) => {
      const data = snapshot.data()

      if (!data) return

      setOnlineState({
        phase: data.phase as GamePhase,
        settings: data.settings as GameSettings,
        startedAt: data.startedAt?.toDate?.().toISOString?.() ?? null,
        endedAt: data.endedAt?.toDate?.().toISOString?.() ?? null,
      })
    })

    const unsubTeams = onSnapshot(
      collection(db, 'games', gameId, 'teams'),
      (snapshot) => {
        const teams: Team[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data()

          return {
            id: docSnap.id,
            name: data.name,
            color: data.color,
            players: data.players ?? [],
            bonusNumbers: data.bonusNumbers ?? [],
            penaltyPoints: data.penaltyPoints ?? 0,
            attackExecutions: data.attackExecutions ?? 0,
          }
        })

        const board = useGameStore.getState().board

        setOnlineState({
            teams,
            board: computePanelHighlights(board, teams),
        })
      },
    )

    const unsubPanels = onSnapshot(
      collection(db, 'games', gameId, 'panels'),
      (snapshot) => {
        const board: Panel[] = snapshot.docs
          .map((docSnap) => docSnap.data() as Panel)
          .sort((a, b) => a.y - b.y || a.x - b.x)

        const teams = useGameStore.getState().teams

        setOnlineState({
             board: computePanelHighlights(board, teams) 
        })
      },
    )

    const unsubRequests = onSnapshot(
      collection(db, 'games', gameId, 'requests'),
      (snapshot) => {
        const requests: CaptureRequest[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data()

          return {
            id: docSnap.id,
            panelId: data.panelId,
            pokemonNumber: data.pokemonNumber,
            teamId: data.teamId,
            playerName: data.playerName,
            evidenceUrl: data.evidenceUrl ?? undefined,
            comment: data.comment ?? undefined,
            status: data.status,
            submittedAt:
              data.submittedAt?.toDate?.().toISOString?.() ??
              new Date().toISOString(),
            reviewedAt:
              data.reviewedAt?.toDate?.().toISOString?.() ?? undefined,
            penaltyApplied: data.penaltyApplied ?? false,
          }
        })

        setOnlineState({ requests })
      },
    )

    const logsQuery = query(
      collection(db, 'games', gameId, 'logs'),
      orderBy('createdAt', 'desc'),
    )

    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      const logs: GameLog[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()

        return {
          id: docSnap.id,
          type: data.type,
          message: data.message,
          createdAt:
            data.createdAt?.toDate?.().toISOString?.() ??
            new Date().toISOString(),
        }
      })

      setOnlineState({ logs })
    })

    return () => {
      unsubGame()
      unsubTeams()
      unsubPanels()
      unsubRequests()
      unsubLogs()
    }
  }, [gameId, setOnlineState])
}