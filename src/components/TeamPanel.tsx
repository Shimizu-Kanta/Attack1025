import type { Panel, Team } from '../types/game'

type TeamPanelProps = {
  teams: Team[]
  board: Panel[]
}

export const TeamPanel = ({ teams, board }: TeamPanelProps) => {
  return (
    <section className="space-y-2 rounded border border-slate-300 bg-white p-3">
      <h2 className="text-sm font-bold text-slate-700">チーム / スコア</h2>
      <ul className="space-y-2 text-xs">
          {teams.map((team) => {
          const score = board.filter((panel) => panel.ownerTeamId === team.id).length
          const execs = team.attackExecutions ?? 0
          return (
            <li key={team.id} className="rounded border border-slate-200 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="font-semibold">{team.name}</span>
                </span>
                <span className="font-bold">{score}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">メンバー: {team.players.join(', ') || '-'}</p>
              <p className="text-[11px] text-slate-500">ペナルティ: {team.penaltyPoints}</p>
              <p className="text-[11px] text-slate-500">アタック実行回数: {execs}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
