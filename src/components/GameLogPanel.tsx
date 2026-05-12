import type { GameLog } from '../types/game'

type GameLogPanelProps = {
  logs: GameLog[]
}

export const GameLogPanel = ({ logs }: GameLogPanelProps) => {
  return (
    <section className="space-y-2 rounded border border-slate-300 bg-white p-3">
      <h2 className="text-sm font-bold text-slate-700">ログ</h2>
      <ul className="max-h-96 space-y-2 overflow-auto text-xs">
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
  )
}
