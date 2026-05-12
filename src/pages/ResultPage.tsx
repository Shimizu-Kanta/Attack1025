import { Navigate } from 'react-router-dom'
import { Board } from '../components/Board'
import { useGameStore } from '../store/gameStore'

export const ResultPage = () => {
  const {
    phase,
    settings,
    teams,
    board,
    ranking,
    logs,
    resetGame,
    setSelectedPanel,
    selectedPanelId,
  } = useGameStore((state) => ({
    phase: state.phase,
    settings: state.settings,
    teams: state.teams,
    board: state.board,
    ranking: state.ranking,
    logs: state.logs,
    resetGame: state.resetGame,
    setSelectedPanel: state.setSelectedPanel,
    selectedPanelId: state.selectedPanelId,
  }))

  if (phase === 'setup') {
    return <Navigate to="/" replace />
  }

  const rankingRows = ranking()

  return (
    <main className="mx-auto w-full max-w-6xl space-y-3 p-4">
      <header className="rounded border border-slate-300 bg-white p-4">
        <h1 className="text-2xl font-bold text-slate-800">ゲーム結果</h1>
        <p className="mt-1 text-sm text-slate-600">
          盤面: {settings.boardSize}x{settings.boardSize}
        </p>
      </header>

      <section className="rounded border border-slate-300 bg-white p-4">
        <h2 className="text-lg font-bold">順位</h2>
        <ol className="mt-2 space-y-1 text-sm">
          {rankingRows.map((row, index) => {
            const team = teams.find((item) => item.id === row.teamId)
            return (
              <li key={row.teamId} className="rounded border border-slate-200 p-2">
                {index + 1}位: {team?.name} / スコア {row.score} / 最大図鑑番号 {row.maxOwnedPokemonNumber}
              </li>
            )
          })}
        </ol>
      </section>

      <section className="space-y-2 rounded border border-slate-300 bg-white p-4">
        <h2 className="text-lg font-bold">最終盤面</h2>
        <Board
          board={board}
          boardSize={settings.boardSize}
          teams={teams}
          selectedPanelId={selectedPanelId}
          onSelectPanel={setSelectedPanel}
        />
      </section>

      <section className="rounded border border-slate-300 bg-white p-4">
        <h2 className="text-lg font-bold">最終ログ</h2>
        <ul className="mt-2 max-h-72 space-y-1 overflow-auto text-xs">
          {logs.map((log) => (
            <li key={log.id} className="rounded border border-slate-200 p-2">
              <p>{log.message}</p>
              <p className="text-[11px] text-slate-500">
                {new Date(log.createdAt).toLocaleString('ja-JP')}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        onClick={() => {
          resetGame()
        }}
        className="rounded bg-blue-600 px-4 py-2 font-semibold text-white"
      >
        新規ゲーム開始
      </button>
    </main>
  )
}
