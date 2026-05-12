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

          const bonusTeamColors = Array.from(
            new Set(
              teams
                .filter((t) => (t.bonusNumbers || []).includes(panel.pokemonNumber))
                .map((t) => t.color),
            ),
          )

          // Do not show outer effects for already owned panels
          // Outer gradient for request; bonus will be rendered as inner circle
          const outerGradient = owner
            ? undefined
            : panel.highlightRequest
            ? buildGradient(requestTeamColors)
            : undefined

          const innerBonusGradient = !owner && panel.highlightBonus && bonusTeamColors.length > 0 ? buildGradient(bonusTeamColors) : undefined

          return (
            <div
              key={panel.id}
              className={`aspect-square rounded ${selected ? 'ring-2 ring-blue-500' : ''}`}
              style={{ padding: outerGradient ? '3px' : undefined, background: outerGradient, borderRadius: '0.375rem' }}
            >
                <button
                  type="button"
                  onClick={() => onSelectPanel(panel.id)}
                  className={`w-full h-full aspect-square rounded border text-[10px] font-semibold leading-tight transition hover:border-slate-500 relative`}
                  style={{
                    backgroundColor:
                      owner?.color ??
                      (panel.revealStatus === 'revealed' ? 'rgb(241 245 249)' : 'rgb(15 23 42)'),
                    color: owner ? '#fff' : panel.revealStatus === 'revealed' ? '#0f172a' : '#94a3b8',
                    borderColor: owner?.color ?? 'rgb(148 163 184)',
                    padding: 0,
                    overflow: 'hidden',
                  }}
                  title={`No.${panel.pokemonNumber} (${panel.x},${panel.y})`}
                >
                  {panel.revealStatus === 'revealed' ? `#${panel.pokemonNumber}` : '?'}

                  {innerBonusGradient && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '58%',
                        height: '58%',
                        borderRadius: '9999px',
                        background: innerBonusGradient,
                        opacity: 0.28,
                        zIndex: 0,
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  <span style={{ position: 'relative', zIndex: 10 }}>{/* keep text above inner effect */}</span>
                </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
