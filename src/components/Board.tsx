import type { Panel, Team } from '../types/game'

type BoardProps = {
  board: Panel[]
  boardSize: number
  teams: Team[]
  selectedPanelId: string | null
  onSelectPanel: (panelId: string) => void
}

export const Board = ({
  board,
  boardSize,
  teams,
  selectedPanelId,
  onSelectPanel,
}: BoardProps) => {
  const teamMap = new Map(teams.map((team) => [team.id, team]))

  return (
    <div className="overflow-auto rounded border border-slate-300 bg-white p-2">
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${boardSize}, minmax(2.2rem, 1fr))`,
          minWidth: `${boardSize * 2.6}rem`,
        }}
      >
        {board.map((panel) => {
          const owner = panel.ownerTeamId ? teamMap.get(panel.ownerTeamId) : undefined
          const selected = panel.id === selectedPanelId

          return (
            <button
              key={panel.id}
              type="button"
              onClick={() => onSelectPanel(panel.id)}
              className={`aspect-square rounded border text-[10px] font-semibold leading-tight transition hover:border-slate-500 ${
                selected ? 'ring-2 ring-blue-500' : ''
              }`}
              style={{
                backgroundColor:
                  owner?.color ??
                  (panel.revealStatus === 'revealed' ? 'rgb(241 245 249)' : 'rgb(15 23 42)'),
                color: owner ? '#fff' : panel.revealStatus === 'revealed' ? '#0f172a' : '#94a3b8',
                borderColor: owner?.color ?? 'rgb(148 163 184)',
              }}
              title={`No.${panel.pokemonNumber} (${panel.x},${panel.y})`}
            >
              {panel.revealStatus === 'revealed' ? `#${panel.pokemonNumber}` : '?'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
