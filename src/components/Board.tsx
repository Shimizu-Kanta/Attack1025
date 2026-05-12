import type { Panel, Team, CaptureRequest } from '../types/game'

type BoardProps = {
  board: Panel[]
  boardSize: number
  teams: Team[]
  requests?: CaptureRequest[]
  selectedPanelId: string | null
  onSelectPanel: (panelId: string) => void
}

export const Board = ({
  board,
  boardSize,
  teams,
  requests = [],
  selectedPanelId,
  onSelectPanel,
}: BoardProps) => {
  const teamMap = new Map(teams.map((team) => [team.id, team]))
  const requestsMap = new Map(requests.map((r) => [r.id, r]))

  const buildGradient = (colors: string[]) => {
    if (!colors || colors.length === 0) return undefined
    if (colors.length === 1) return colors[0]
    const n = colors.length
    const parts = colors.map((c, i) => {
      const start = (i * 100) / n
      const end = ((i + 1) * 100) / n
      return `${c} ${start}% ${end}%`
    })
    return `conic-gradient(${parts.join(',')})`
  }

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

          const requestTeamColors = Array.from(
            new Set(
              (panel.pendingRequestIds || [])
                .map((id) => requestsMap.get(id))
                .map((r) => (r ? teamMap.get(r.teamId)?.color : undefined))
                .filter(Boolean) as string[],
            ),
          )

          const gradient = panel.requestStatus === 'pending' ? buildGradient(requestTeamColors) : undefined

          return (
            <div
              key={panel.id}
              className={`aspect-square rounded ${selected ? 'ring-2 ring-blue-500' : ''}`}
              style={{ padding: gradient ? '3px' : undefined, background: gradient, borderRadius: '0.375rem' }}
            >
              <button
                type="button"
                onClick={() => onSelectPanel(panel.id)}
                className={`w-full h-full aspect-square rounded border text-[10px] font-semibold leading-tight transition hover:border-slate-500`}
                style={{
                  backgroundColor:
                    owner?.color ??
                    (panel.revealStatus === 'revealed' ? 'rgb(241 245 249)' : 'rgb(15 23 42)'),
                  color: owner ? '#fff' : panel.revealStatus === 'revealed' ? '#0f172a' : '#94a3b8',
                  borderColor: owner?.color ?? 'rgb(148 163 184)',
                  padding: 0,
                }}
                title={`No.${panel.pokemonNumber} (${panel.x},${panel.y})`}
              >
                {panel.revealStatus === 'revealed' ? `#${panel.pokemonNumber}` : '?'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
