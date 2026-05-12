import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Board } from '../components/Board'
import { GameLogPanel } from '../components/GameLogPanel'
import { RequestList } from '../components/RequestList'
import { TeamPanel } from '../components/TeamPanel'
import { useGameStore } from '../store/gameStore'
import { getAvailablePanels } from '../logic/gameLogic'

export const GamePage = () => {
  const phase = useGameStore((state) => state.phase)
  const board = useGameStore((state) => state.board)
  const settings = useGameStore((state) => state.settings)
  const teams = useGameStore((state) => state.teams)
  const selectedPanelId = useGameStore((state) => state.selectedPanelId)
  const requests = useGameStore((state) => state.requests)
  const logs = useGameStore((state) => state.logs)

  const setSelectedPanel = useGameStore((state) => state.setSelectedPanel)
  const submitRequest = useGameStore((state) => state.submitRequest)
  const approveRequest = useGameStore((state) => state.approveRequest)
  const rejectRequest = useGameStore((state) => state.rejectRequest)
  const manualAcquirePanel = useGameStore((state) => state.manualAcquirePanel)
  const endGame = useGameStore((state) => state.endGame)

  const [role, setRole] = useState<'pl' | 'gm'>('pl')
  const [tab, setTab] = useState<'pending' | 'history' | 'logs' | 'available'>('pending')
  const [requestTeamId, setRequestTeamId] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [comment, setComment] = useState('')
  const [manualTeamId, setManualTeamId] = useState('')
  const [error, setError] = useState('')

  if (phase === 'setup') {
    return <Navigate to="/" replace />
  }
  if (phase === 'ended') {
    return <Navigate to="/result" replace />
  }

  const pendingRequests = [...requests]
    .filter((request) => request.status === 'pending')
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))

  const selectedPanel = board.find((panel) => panel.id === selectedPanelId) ?? null
  const available = getAvailablePanels(board, settings.boardSize)

  const handleRequestSubmit = () => {
    setError('')
    if (!selectedPanel) {
      setError('申請するパネルを選択してください。')
      return
    }
    if (!requestTeamId) {
      setError('申請チームを選択してください。')
      return
    }
    // プレイヤー名は匿名でも可

    const result = submitRequest({
      panelId: selectedPanel.id,
      teamId: requestTeamId,
      playerName: playerName.trim() || '匿名',
      evidenceUrl,
      comment,
    })

    if (!result.ok) {
      setError(result.message ?? '申請に失敗しました。')
      return
    }

    setEvidenceUrl('')
    setComment('')
  }

  const handleManualAcquire = () => {
    if (!selectedPanel || !manualTeamId) {
      return
    }
    manualAcquirePanel(selectedPanel.id, manualTeamId)
  }

  return (
    <main className="mx-auto w-full max-w-[1800px] min-h-screen space-y-3 p-3 pb-24 flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-300 bg-white p-3 h-16">
        <h1 className="text-xl font-bold text-slate-800">
          Attack1025 ゲーム画面 ({settings.boardSize}x{settings.boardSize})
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded px-3 py-1 text-sm ${role === 'pl' ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}
            onClick={() => setRole('pl')}
          >
            PL画面
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1 text-sm ${role === 'gm' ? 'bg-indigo-700 text-white' : 'bg-slate-200'}`}
            onClick={() => setRole('gm')}
          >
            GM画面
          </button>
          <button
            type="button"
            onClick={() => {
              endGame()
            }}
            className="rounded bg-rose-600 px-3 py-1 text-sm text-white"
          >
            ゲーム終了
          </button>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[280px_1fr_420px] flex-1 min-h-0" style={{ height: `calc(100vh - 4rem - 6rem)` }}>
        <aside style={{ position: 'sticky', top: '4rem', height: 'calc(100vh - 4rem - 6rem)', overflow: 'auto' }} className="space-y-3">
          <div style={{ paddingRight: 8 }}>
            <TeamPanel teams={teams} board={board} />
          </div>
        </aside>

        <section style={{ height: 'calc(100vh - 4rem - 6rem)', overflow: 'auto' }} className="space-y-3">
          <div style={{ minHeight: '100%' }}>
            <Board
              board={board}
              boardSize={settings.boardSize}
              teams={teams}
              requests={requests}
              selectedPanelId={selectedPanelId}
              onSelectPanel={setSelectedPanel}
            />
          </div>
        </section>

        <aside style={{ position: 'sticky', top: '4rem', height: 'calc(100vh - 4rem - 6rem)', overflow: 'auto' }} className="space-y-3">
          {role === 'pl' ? (
            <section className="space-y-3 rounded border border-slate-300 bg-white p-3">
              <h2 className="text-sm font-bold text-slate-700">PL: 取得申請</h2>
              <label className="block text-xs">
                チーム
                <select
                  className="mt-1 w-full rounded border border-slate-300 p-2"
                  value={requestTeamId}
                  onChange={(e) => {
                    setRequestTeamId(e.target.value)
                    setPlayerName('')
                  }}
                >
                  <option value="">選択してください</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                プレイヤー名
                <select
                  className="mt-1 w-full rounded border border-slate-300 p-2"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                >
                  <option value="">匿名</option>
                  {(teams.find((t) => t.id === requestTeamId)?.players || []).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                Discord URL (任意)
                <input
                  className="mt-1 w-full rounded border border-slate-300 p-2"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                />
              </label>
              <label className="block text-xs">
                コメント (任意)
                <textarea
                  className="mt-1 w-full rounded border border-slate-300 p-2"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </label>
              {error ? <p className="text-xs text-rose-600">{error}</p> : null}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestSubmit}
                  disabled={teams.length === 0}
                  className={`rounded px-3 py-2 text-sm font-semibold text-white ${teams.length === 0 ? 'bg-slate-300' : 'bg-blue-600'}`}
                >
                  取得申請する
                </button>
                {teams.length === 0 ? (
                  <p className="text-xs text-slate-500">チームが存在しないため申請できません。</p>
                ) : null}
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-700">現在取得可能なパネル</h3>
                <ul className="mt-1 max-h-44 space-y-1 overflow-auto text-xs">
                  {available.map((panel) => (
                    <li key={panel.id}>
                      <button
                        type="button"
                        className="w-full rounded border border-slate-200 px-2 py-1 text-left hover:bg-slate-50"
                        onClick={() => setSelectedPanel(panel.id)}
                      >
                        ({panel.x},{panel.y}) / #{panel.pokemonNumber}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : (
            <section className="space-y-2 rounded border border-slate-300 bg-white p-3">
              <h2 className="text-sm font-bold text-slate-700">GM管理</h2>
              <div className="flex flex-wrap gap-1 text-xs">
                {[
                  ['pending', '未処理申請'],
                  ['history', '申請履歴'],
                  ['logs', 'ログ'],
                  ['available', '取得可能'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTab(value as typeof tab)}
                    className={`rounded px-2 py-1 ${tab === value ? 'bg-indigo-700 text-white' : 'bg-slate-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'pending' ? (
                <RequestList
                  requests={pendingRequests}
                  teams={teams}
                  onApprove={approveRequest}
                  onReject={rejectRequest}
                />
              ) : null}

              {tab === 'history' ? (
                <RequestList requests={[...requests].reverse()} teams={teams} />
              ) : null}

              {tab === 'logs' ? <GameLogPanel logs={logs} /> : null}

              {tab === 'available' ? (
                <div className="space-y-2 text-xs">
                  <label className="block">
                    手動取得先チーム
                    <select
                      className="mt-1 w-full rounded border border-slate-300 p-2"
                      value={manualTeamId}
                      onChange={(e) => setManualTeamId(e.target.value)}
                    >
                      <option value="">選択してください</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={handleManualAcquire}
                    className="rounded bg-amber-600 px-3 py-1 text-white"
                  >
                    選択パネルを手動取得
                  </button>
                  <ul className="max-h-64 space-y-1 overflow-auto">
                    {available.map((panel) => (
                      <li key={panel.id}>
                        <button
                          type="button"
                          className="w-full rounded border border-slate-200 px-2 py-1 text-left hover:bg-slate-50"
                          onClick={() => setSelectedPanel(panel.id)}
                        >
                          ({panel.x},{panel.y}) / #{panel.pokemonNumber}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          )}
        </aside>
      </div>

      {/* 固定フッター: 選択中パネル */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-300 h-24">
        <div className="mx-auto max-w-[1800px] p-3 h-full">
          <section className="rounded bg-white text-sm">
            <h2 className="font-bold text-slate-700">選択中パネル</h2>
            {selectedPanel ? (
              <div className="mt-1 grid gap-1 text-xs">
                <p>
                  座標: ({selectedPanel.x}, {selectedPanel.y})
                </p>
                <p>図鑑番号: {selectedPanel.revealStatus === 'revealed' ? selectedPanel.pokemonNumber : '非公開'}</p>
                <p>公開状態: {selectedPanel.revealStatus}</p>
                <p>所有チーム: {teams.find((team) => team.id === selectedPanel.ownerTeamId)?.name ?? 'なし'}</p>
                <p>申請状態: {selectedPanel.requestStatus}</p>
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-500">盤面からパネルを選択してください。</p>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
