import { arrayRemove, arrayUnion, collection, doc, serverTimestamp, writeBatch, getDoc, getDocs, query, where, increment} from 'firebase/firestore'
import { db } from '../firebase/firestore'
import { applyFlips, createBoard, createPokemonNumberPool, revealAroundPanel } from '../logic/gameLogic'
import type { CaptureRequest, GameSettings, Panel } from '../types/game'

type CreateOnlineTeamInput = {
  name: string
  color: string
  players: string[]
  bonusNumbers?: number[]
}

type CreateOnlineGameInput = {
  settings: GameSettings
  teams: CreateOnlineTeamInput[]
}

export const createOnlineGame = async ({
  settings,
  teams,
}: CreateOnlineGameInput): Promise<string> => {
  const gameRef = doc(collection(db, 'games'))
  const gameId = gameRef.id

  const pool = createPokemonNumberPool(
    settings.pokemonNumberStart,
    settings.pokemonNumberEnd,
    settings.excludedPokemonNumbers,
  )

  const board = createBoard(
    settings.boardSize,
    settings.seed,
    pool,
    settings.initialOpenCount ?? 1,
  )

  const batch = writeBatch(db)

  batch.set(gameRef, {
    phase: 'playing',
    settings,
    startedAt: serverTimestamp(),
    endedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  teams.forEach((team, index) => {
    const teamId = `team-${index + 1}`
    const teamRef = doc(db, 'games', gameId, 'teams', teamId)

    batch.set(teamRef, {
      name: team.name,
      color: team.color,
      players: team.players,
      bonusNumbers: team.bonusNumbers ?? [],
      penaltyPoints: 0,
      attackExecutions: 0,
    })
  })

  board.forEach((panel) => {
    const panelRef = doc(db, 'games', gameId, 'panels', panel.id)
    batch.set(panelRef, panel)
  })

  const logRef = doc(collection(db, 'games', gameId, 'logs'))

  batch.set(logRef, {
    type: 'game_start',
    message: `ゲーム開始: ${settings.boardSize}x${settings.boardSize} / seed=${settings.seed}`,
    createdAt: serverTimestamp(),
  })

  await batch.commit()

  return gameId
}

type SubmitRequestOnlineInput = {
  panelId: string
  pokemonNumber: number
  teamId: string
  playerName: string
  evidenceUrl?: string
  comment?: string
}

export const submitRequestOnline = async (
  gameId: string,
  input: SubmitRequestOnlineInput,
): Promise<void> => {
  const gameRef = doc(db, 'games', gameId)
  const requestRef = doc(collection(db, 'games', gameId, 'requests'))
  const panelRef = doc(db, 'games', gameId, 'panels', input.panelId)
  const logRef = doc(collection(db, 'games', gameId, 'logs'))

  const gameSnap = await getDoc(gameRef)
  const gameData = gameSnap.data()

  if (!gameData) {
    throw new Error('ゲーム情報が見つかりません。')
  }

  const settings = gameData.settings as GameSettings
  const batch = writeBatch(db)

  batch.set(requestRef, {
    panelId: input.panelId,
    pokemonNumber: input.pokemonNumber,
    teamId: input.teamId,
    playerName: input.playerName,
    evidenceUrl: input.evidenceUrl?.trim() || null,
    comment: input.comment?.trim() || null,
    status: 'pending',
    submittedAt: serverTimestamp(),
    reviewedAt: null,
    penaltyApplied: false,
  })

  batch.update(panelRef, {
    requestStatus: 'pending',
    pendingRequestIds: arrayUnion(requestRef.id),
  })

  batch.set(logRef, {
    type: 'request_created',
    message: `${input.playerName} が No.${input.pokemonNumber} を申請しました`,
    createdAt: serverTimestamp(),
  })

  if (settings.revealMode === 'onRequest') {
    const panelsSnap = await getDocs(collection(db, 'games', gameId, 'panels'))

    const board: Panel[] = panelsSnap.docs
      .map((docSnap) => docSnap.data() as Panel)
      .sort((a, b) => a.y - b.y || a.x - b.x)

    const revealResult = revealAroundPanel(
      board,
      settings.boardSize,
      input.panelId,
    )

    const revealedPanelIds = new Set(
      revealResult.board
        .filter((panel) => {
          const before = board.find((item) => item.id === panel.id)

          return (
            before &&
            before.revealStatus === 'hidden' &&
            panel.revealStatus === 'revealed'
          )
        })
        .map((panel) => panel.id),
    )

    panelsSnap.docs.forEach((docSnap) => {
      if (!revealedPanelIds.has(docSnap.id)) return

      batch.update(docSnap.ref, {
        revealStatus: 'revealed',
      })
    })

    if (revealedPanelIds.size > 0) {
      const revealedLogRef = doc(collection(db, 'games', gameId, 'logs'))

      batch.set(revealedLogRef, {
        type: 'panel_revealed',
        message: `申請時仮公開により ${revealedPanelIds.size} マス公開しました`,
        createdAt: serverTimestamp(),
      })
    }
  }

  await batch.commit()
}

export const rejectRequestOnline = async (
  gameId: string,
  request: CaptureRequest,
  withPenalty: boolean,
): Promise<void> => {
  const gameRef = doc(db, 'games', gameId)
  const requestRef = doc(db, 'games', gameId, 'requests', request.id)
  const panelRef = doc(db, 'games', gameId, 'panels', request.panelId)
  const teamRef = doc(db, 'games', gameId, 'teams', request.teamId)
  const logRef = doc(collection(db, 'games', gameId, 'logs'))

  const gameSnap = await getDoc(gameRef)
  const teamSnap = await getDoc(teamRef)

  const gameData = gameSnap.data()
  const teamData = teamSnap.data()

  const panelSnap = await getDoc(panelRef)
  const panelData = panelSnap.data()

  if (!panelData) {
    throw new Error('パネル情報が見つかりません。')
  }

  const currentPendingRequestIds:string[] = Array.isArray(panelData.pendingRequestIds)
    ? panelData.pendingRequestIds
    : []

  const nextPendingRequestIds = currentPendingRequestIds.filter(
    (id: string) => id !== request.id,
  )

  if (!gameData) {
    throw new Error('ゲーム情報が見つかりません。')
  }

  if (!teamData) {
    throw new Error('チーム情報が見つかりません。')
  }

  const penaltyThreshold = gameData.settings?.penaltyThreshold ?? 2
  const currentPenaltyPoints = teamData.penaltyPoints ?? 0
  const nextPenaltyPoints = withPenalty
    ? currentPenaltyPoints + 1
    : currentPenaltyPoints

  const shouldLosePanel = withPenalty && nextPenaltyPoints >= penaltyThreshold

  const batch = writeBatch(db)

  batch.update(requestRef, {
    status: 'rejected',
    reviewedAt: serverTimestamp(),
    penaltyApplied: withPenalty,
  })

  batch.update(panelRef, {
    pendingRequestIds: arrayRemove(request.id),
    requestStatus: nextPendingRequestIds.length > 0 ? 'pending' : 'none',
  })

  if (withPenalty) {
    batch.update(teamRef, {
      penaltyPoints: shouldLosePanel ? 0 : nextPenaltyPoints,
    })
  }

  batch.set(logRef, {
    type: 'request_rejected',
    message: withPenalty
      ? `申請を却下し、${teamData.name ?? request.teamId} にペナルティを付与しました (No.${request.pokemonNumber})`
      : `申請を却下しました (No.${request.pokemonNumber})`,
    createdAt: serverTimestamp(),
  })

  if (shouldLosePanel) {
    const ownedPanelsQuery = query(
      collection(db, 'games', gameId, 'panels'),
      where('ownerTeamId', '==', request.teamId),
    )

    const ownedPanelsSnap = await getDocs(ownedPanelsQuery)
    const ownedPanels = ownedPanelsSnap.docs

    if (ownedPanels.length > 0) {
      const lostDoc = ownedPanels[Math.floor(Math.random() * ownedPanels.length)]
      const lostPanel = lostDoc.data()

      batch.update(lostDoc.ref, {
        ownerTeamId: null,
        revealStatus: 'revealed',
      })

      const panelLostLogRef = doc(collection(db, 'games', gameId, 'logs'))

      batch.set(panelLostLogRef, {
        type: 'panel_lost',
        message: `${teamData.name ?? request.teamId} がペナルティにより No.${lostPanel.pokemonNumber} のパネルを1枚喪失しました`,
        createdAt: serverTimestamp(),
      })
    }
  }

  await batch.commit()
}

export const approveRequestOnline = async (
  gameId: string,
  request: CaptureRequest,
): Promise<void> => {
  const gameRef = doc(db, 'games', gameId)
  const requestRef = doc(db, 'games', gameId, 'requests', request.id)
  const teamRef = doc(db, 'games', gameId, 'teams', request.teamId)

  const gameSnap = await getDoc(gameRef)
  const teamSnap = await getDoc(teamRef)

  const gameData = gameSnap.data()
  const teamData = teamSnap.data()

  if (!gameData) {
    throw new Error('ゲーム情報が見つかりません。')
  }

  if (!teamData) {
    throw new Error('チーム情報が見つかりません。')
  }

  const boardSize = gameData.settings?.boardSize

  if (typeof boardSize !== 'number') {
    throw new Error('盤面サイズが取得できません。')
  }

  const panelsSnap = await getDocs(collection(db, 'games', gameId, 'panels'))

  let board: Panel[] = panelsSnap.docs
    .map((docSnap) => docSnap.data() as Panel)
    .sort((a, b) => a.y - b.y || a.x - b.x)

  const targetPanel = board.find((panel) => panel.id === request.panelId)

  const pendingRequestIds: string[] = Array.isArray(targetPanel?.pendingRequestIds) 
    ? targetPanel.pendingRequestIds
    : []

  const cancelledRequestIds = pendingRequestIds.filter(
    (id: string) => id !== request.id
  )

  if (!targetPanel) {
    throw new Error('対象パネルが見つかりません。')
  }

  if (targetPanel.ownerTeamId) {
    throw new Error('対象パネルはすでに取得されています。')
  }

  const beforeRevealCount = board.filter(
    (panel) => panel.revealStatus === 'revealed',
  ).length

  board = board.map((panel) =>
    panel.id === request.panelId
      ? {
          ...panel,
          ownerTeamId: request.teamId,
          revealStatus: 'revealed' as const,
          requestStatus: 'none' as const,
          pendingRequestIds: [],
        }
      : panel,
  )

  const revealResult = revealAroundPanel(board, boardSize, request.panelId)
  board = revealResult.board

  const flipResult = applyFlips(board, boardSize, request.panelId, request.teamId)
  board = flipResult.board

  const afterRevealCount = board.filter(
    (panel) => panel.revealStatus === 'revealed',
  ).length

  const revealedCount = Math.max(0, afterRevealCount - beforeRevealCount)
  const flippedCount = flipResult.flippedPanelIds.length

  const batch = writeBatch(db)

  batch.update(requestRef, {
    status: 'approved',
    reviewedAt: serverTimestamp(),
  })

  cancelledRequestIds.forEach((cancelledRequestId) => {
    const cancelledRequestRef = doc(
        db,
        'games',
        gameId,
        'requests',
        cancelledRequestId,
    )

    batch.update(cancelledRequestRef, {
      status: 'cancelled',
      reviewedAt: serverTimestamp(),
    })
  })

  panelsSnap.docs.forEach((docSnap) => {
    const nextPanel = board.find((panel) => panel.id === docSnap.id)

    if (!nextPanel) return

    batch.update(docSnap.ref, {
      ownerTeamId: nextPanel.ownerTeamId,
      revealStatus: nextPanel.revealStatus,
      requestStatus: nextPanel.requestStatus,
      pendingRequestIds: nextPanel.pendingRequestIds,
    })
  })

  const approvedLogRef = doc(collection(db, 'games', gameId, 'logs'))
  batch.set(approvedLogRef, {
    type: 'request_approved',
    message: `${teamData.name ?? request.teamId} の申請を承認しました (No.${request.pokemonNumber})`,
    createdAt: serverTimestamp(),
  })

  const acquiredLogRef = doc(collection(db, 'games', gameId, 'logs'))
  batch.set(acquiredLogRef, {
    type: 'panel_acquired',
    message: `${teamData.name ?? request.teamId} が No.${request.pokemonNumber} を取得しました`,
    createdAt: serverTimestamp(),
  })

  if (revealedCount > 0) {
    const revealedLogRef = doc(collection(db, 'games', gameId, 'logs'))
    batch.set(revealedLogRef, {
      type: 'panel_revealed',
      message: `周囲公開により ${revealedCount} マス公開しました`,
      createdAt: serverTimestamp(),
    })
  }

  if (flippedCount > 0) {
    const flippedLogRef = doc(collection(db, 'games', gameId, 'logs'))
    batch.set(flippedLogRef, {
      type: 'panel_flipped',
      message: `${teamData.name ?? request.teamId} が ${flippedCount} マスを反転しました`,
      createdAt: serverTimestamp(),
    })
  }

  await batch.commit()
}

export const grantAttackChanceOnline = async (
  gameId: string,
  teamId: string,
): Promise<void> => {
  const teamRef = doc(db, 'games', gameId, 'teams', teamId)
  const logRef = doc(collection(db, 'games', gameId, 'logs'))

  const teamSnap = await getDoc(teamRef)
  const teamData = teamSnap.data()

  if (!teamData) {
    throw new Error('チーム情報が見つかりません。')
  }

  const batch = writeBatch(db)

  batch.update(teamRef, {
    attackExecutions: increment(1),
  })

  batch.set(logRef, {
    type: 'request_approved',
    message: `${teamData.name ?? teamId} がアタックチャンスを獲得しました`,
    createdAt: serverTimestamp(),
  })

  await batch.commit()
}

export const executeAttackByPanelOnline = async (
  gameId: string,
  executorTeamId: string,
  panelId: string,
): Promise<void> => {
  const executorTeamRef = doc(db, 'games', gameId, 'teams', executorTeamId)
  const panelRef = doc(db, 'games', gameId, 'panels', panelId)

  const executorTeamSnap = await getDoc(executorTeamRef)
  const panelSnap = await getDoc(panelRef)

  const executorTeam = executorTeamSnap.data()
  const panel = panelSnap.data()

  if (!executorTeam) {
    throw new Error('実行チームが見つかりません。')
  }

  if (!panel) {
    throw new Error('対象パネルが見つかりません。')
  }

  if ((executorTeam.attackExecutions ?? 0) <= 0) {
    throw new Error('アタック実行権がありません。')
  }

  if (!panel.ownerTeamId) {
    throw new Error('対象パネルは所有されていません。')
  }

  if (panel.ownerTeamId === executorTeamId) {
    throw new Error('自チームのパネルは対象にできません。')
  }

  const ownerTeamRef = doc(db, 'games', gameId, 'teams', panel.ownerTeamId)
  const ownerTeamSnap = await getDoc(ownerTeamRef)
  const ownerTeam = ownerTeamSnap.data()

  const logRef = doc(collection(db, 'games', gameId, 'logs'))

  const batch = writeBatch(db)

  batch.update(panelRef, {
    ownerTeamId: null,
    revealStatus: 'revealed',
  })

  batch.update(executorTeamRef, {
    attackExecutions: increment(-1),
  })

  batch.set(logRef, {
    type: 'panel_lost',
    message: `${executorTeam.name ?? executorTeamId} が ${
      ownerTeam?.name ?? '不明なチーム'
    } の No.${panel.pokemonNumber} をアタックし、所有者なしにしました`,
    createdAt: serverTimestamp(),
  })

  await batch.commit()
}

export const endGameOnline = async (gameId: string): Promise<void> => {
  const gameRef = doc(db, 'games', gameId)
  const logRef = doc(collection(db, 'games', gameId, 'logs'))

  const batch = writeBatch(db)

  batch.update(gameRef, {
    phase: 'ended',
    endedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  batch.set(logRef, {
    type: 'game_end',
    message: 'GMがゲームを終了しました',
    createdAt: serverTimestamp(),
  })

  await batch.commit()
}