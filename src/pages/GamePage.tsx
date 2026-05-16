import { useState } from 'react'
import { Link, Navigate, useParams, useLocation } from 'react-router-dom'
import { Board } from '../components/Board'
import { GameLogPanel } from '../components/GameLogPanel'
import { RequestList } from '../components/RequestList'
import { TeamPanel } from '../components/TeamPanel'
import { useGameStore } from '../store/gameStore'
import { getAvailablePanels } from '../logic/gameLogic'

export const GamePage = () => {
  const { teamId } = useParams()
  const location = useLocation()
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
  const attackChance = useGameStore((state) => state.attackChance)
  const startAttackChance = useGameStore((state) => state.startAttackChance)
  const submitAttackChance = useGameStore((state) => state.submitAttackChance)
  const chooseAttackWinner = useGameStore((state) => state.chooseAttackWinner)
  const executeAttackByPanel = useGameStore((state) => state.executeAttackByPanel)
  const grantAttackChanceToTeam = useGameStore((state) => state.grantAttackChanceToTeam)

  const isGmPage = location.pathname === '/game/gm' ||  teamId === 'gm'
  const role: 'pl' | 'gm' = isGmPage ? 'gm' : 'pl'

  const currentTeam = 
    !isGmPage && teamId
      ? teams.find((team) => team.id === teamId)
      : null

  const [tab, setTab] = useState<'pending' |'attack-chance' | 'history' | 'logs' | 'available'>('pending')
  const [requestTeamId, setRequestTeamId] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [comment, setComment] = useState('')
  const [manualTeamId, setManualTeamId] = useState('')
  const [error, setError] = useState('')
  const [attackComment, setAttackComment] = useState('')
  const [attackTopic, setAttackTopic] = useState('')
  const [attackExecMode, setAttackExecMode] = useState(false)

  const effectiveTeamId = currentTeam?.id ?? requestTeamId
  const selectedRequestTeam = 
    currentTeam ?? teams.find((team) => team.id === requestTeamId) ?? null


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
  const available = getAvailablePanels(board)
  const winnerTeamId = attackChance?.winnerSubmissionId ? attackChance.submissions.find((s) => s.id === attackChance.winnerSubmissionId)?.teamId ?? null : null

  const handleRequestSubmit = () => {
    setError('')
    if (!selectedPanel) {
      setError('申請するパネルを選択してください。')
      return
    }
    if (!effectiveTeamId) {
      setError('申請チームを選択してください。')
      return
    }
    // プレイヤー名は匿名でも可

    const result = submitRequest({
      panelId: selectedPanel.id,
      teamId: effectiveTeamId,
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
    setError('')

    if (!selectedPanel) {
      setError('取得するパネルを選択してください。')
      return
    }

    if (!manualTeamId) {
      setError('取得先チームを選択してください。')
      return
    }

    manualAcquirePanel(selectedPanel.id, manualTeamId)
  }
  
  return (
    <main className="mx-auto w-full max-w-[1800px] min-h-screen space-y-3 p-3 pb-24 flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-300 bg-white p-3 h-16">
        <h1 className="text-xl font-bold text-slate-800">Attack1025 ゲーム画面 ({settings.boardSize}x{settings.boardSize})</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/game"
            className={`rounded px-3 py-1 text-sm ${
              role === 'pl' ? 'bg-indigo-600 text-white' : 'bg-slate-200'
              }`}
          >
            PL画面
          </Link>

          <Link
            to="/game/gm"
            className={`rounded px-3 py-1 text-sm text-white ${isGmPage ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600'}`}
          >
            GM画面
          </Link>

          {teams.map((team)  =>
            <Link
              key={team.id}
              to={`/game/${team.id}`}
              className={`rounded px-3 py-1 text-sm ${
                currentTeam?.id  === team.id
                ? 'text-white'
                : 'bg-slate-200 text-slate-700' 
              }`}
                style={{
                  backgroundColor: currentTeam?.id === team.id ? team.color : undefined,
                }}
            >
              {team.name}
            </Link>
          )}
          
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
              onSelectPanel={(panelId: string) => setSelectedPanel(panelId)}
              attackExecMode={attackExecMode}
              attackExecutorTeamId={winnerTeamId}
              onExecutePanel={(panelId: string) => {
                const winnerSub = attackChance.submissions.find((s) => s.id === attackChance.winnerSubmissionId)
                const executor = winnerSub?.teamId ?? null
                if (!executor) {
                  setError('勝者情報が見つかりません')
                  setAttackExecMode(false)
                  return
                }
                const res = executeAttackByPanel(executor, panelId)
                if (!res.ok) setError(res.message ?? '実行に失敗しました')
                setAttackExecMode(false)
              }}
            />
          </div>
        </section>

        <aside style={{ position: 'sticky', top: '4rem', height: 'calc(100vh - 4rem - 6rem)', overflow: 'auto' }} className="space-y-3">
          {role === 'pl' ? (
            <section className="space-y-3 rounded border border-slate-300 bg-white p-3">
              {currentTeam && (currentTeam.attackExecutions ?? 0) > 0 ? (
                <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3">
                  <h3 className='text-sm font-bold text-amber-800'>アタックチャンス</h3>
                  <p className="mt-1 text-xs text-amber-700">
                    残りアタック回数：{currentTeam.attackExecutions ?? 0} 回
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      if  (!selectedPanel) {
                        setError('アタックするパネルを選択してください。')
                        return
                      }

                      const result = executeAttackByPanel(currentTeam.id, selectedPanel.id)
                      if (!result.ok) {
                        setError(result.message ?? 'アタックの実行に失敗しました。')
                        return
                      }

                      setError('')
                    }}
                    className = "mt-2 rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white"
                  >    
                    選択パネルをアタックする
                  </button>
                </div>
              ): null}
              <h2 className="text-sm font-bold text-slate-700">PL: 取得申請</h2>
              {currentTeam ? (
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  <div className="text-slate-500">チーム</div>
                  <div className="font-bold" style={{ color: currentTeam.color }}>
                    {currentTeam.name}
                  </div>
                </div>
              ) : (
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
              )}
              <label className="block text-xs">
                プレイヤー名
                <select
                  className="mt-1 w-full rounded border border-slate-300 p-2"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                >
                  <option value="">匿名</option>
                  {(selectedRequestTeam?.players || []).map((p) => (
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
                {attackChance?.active ? (
                  <div className="mt-3 rounded border border-slate-200 p-2">
                    <h3 className="text-xs font-bold">アタックチャンス開催中</h3>
                    <p className="text-xs text-slate-600">お題: {attackChance.topic}</p>
                    <label className="block text-xs mt-2">
                      コメント (任意)
                      <input className="mt-1 w-full rounded border border-slate-300 p-2 text-sm" value={attackComment} onChange={(e) => setAttackComment(e.target.value)} />
                    </label>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!effectiveTeamId) {
                            setError('申請するチームを選択してください。')
                            return
                          }
                          const res = submitAttackChance({ teamId: effectiveTeamId, playerName: playerName.trim() || '匿名', comment: attackComment })
                          if (!res.ok) {
                            setError(res.message ?? '申請に失敗しました')
                            return
                          }
                          setAttackComment('')
                        }}
                        className="rounded bg-emerald-600 px-3 py-1 text-white text-sm"
                      >
                        アタック申請する
                      </button>
                    </div>
                  </div>
                ) : null}
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
                  ['attack-chance', 'アタックチャンス'],
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

              {/* Attack Chance GM controls */}
              <div className="mt-3 rounded border border-slate-200 p-2">
                <h3 className="text-xs font-bold">アタックチャンス (GM)</h3>
                <label className="block text-xs">
                  お題
                  <input
                    className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
                    value={attackTopic}
                    onChange={(e) => setAttackTopic(e.target.value)}
                    placeholder="例: 最もユニークなポケモンを選んだチーム"
                  />
                </label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!attackTopic.trim()) return
                      startAttackChance(attackTopic)
                      setAttackTopic('')
                    }}
                    className="rounded bg-indigo-700 px-3 py-1 text-white text-sm"
                  >
                    開始
                  </button>
                </div>

                {attackChance?.active ? (
                  <div className="mt-3 text-xs">
                    <p className="font-medium">開催中: {attackChance.topic}</p>
                    <ul className="mt-2 space-y-1 max-h-40 overflow-auto">
                      {attackChance.submissions.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm">{teams.find((t) => t.id === s.teamId)?.name ?? s.teamId} - {s.playerName}</div>
                            <div className="text-xs text-slate-500">{s.comment}</div>
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => chooseAttackWinner(s.id)}
                              className="rounded bg-amber-600 px-2 py-1 text-white text-xs"
                            >
                              勝者に選定
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  ) : (
                    attackChance?.winnerSubmissionId ? (
                      <div className="mt-3 text-xs">
                        <p className="font-medium">直近の勝者:</p>
                        {(() => {
                          const sub = attackChance?.submissions.find((s) => s.id === attackChance.winnerSubmissionId)
                          if (!sub) return <p className="text-xs">なし</p>
                          return (
                            <div className="mt-1">
                              <div className="text-sm">{teams.find((t) => t.id === sub.teamId)?.name ?? sub.teamId} - {sub.playerName}</div>
                              <div className="text-xs text-slate-500">{sub.comment}</div>
                              <div className="mt-2 text-xs text-slate-500">勝者は対象チームを選んで、後で実行できます。</div>
                            </div>
                          )
                        })()}
                      </div>
                    ) : null
                  )}
              </div>

              {tab === 'pending' ? (
                <RequestList
                  requests={pendingRequests}
                  teams={teams}
                  onApprove={approveRequest}
                  onReject={rejectRequest}
                />
              ) : null}

              {tab === 'attack-chance' ? (
                <div className="mt-3 rounded border border-slate-200 p-2">
                  <h3 className="text-xs font-bold">アタックチャンス付与</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    選択したチームにアタック実行権を一回付与します。
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {teams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => {
                          const result = grantAttackChanceToTeam(team.id)
                          if(!result.ok) {
                            setError(result.message ?? 'アタックチャンスの付与に失敗しました')
                          }
                        }}
                        className = "rounded px-3 py-1 text-xs text-white"
                        style = {{ backgroundColor: team.color }}
                      >
                        {team.name} に付与
                      </button>
                    ))}
                  </div>

                </div>
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
                {/* If a winner is selected and this PL belongs to the winner team, allow executing the right via selection mode */}
                {attackChance?.winnerSubmissionId && requestTeamId && (() => {
                  const winnerSub = attackChance.submissions.find((s) => s.id === attackChance.winnerSubmissionId)
                  if (!winnerSub) return null
                  if (winnerSub.teamId !== requestTeamId) return null
                  if (attackChance.executed) {
                    return <div className="mt-3 text-xs text-slate-500">既に実行済みです。</div>
                  }
                  return (
                    <div className="mt-3 rounded border border-slate-200 p-2">
                      <h3 className="text-xs font-bold">あなたは勝者です — 権利を行使できます</h3>
                      <p className="text-xs text-slate-500 mt-2">盤面上の任意の他チームの所有マスを1つ選択して所有を剝奪できます。</p>
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setAttackExecMode(true)}
                          className="rounded bg-rose-600 px-3 py-1 text-white text-sm"
                        >
                          マスを選択して実行モードにする
                        </button>
                        {attackExecMode ? <span className="ml-2 text-xs text-rose-600">選択モード: 盤面をクリックしてください</span> : null}
                      </div>
                    </div>
                  )
                })()}
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
