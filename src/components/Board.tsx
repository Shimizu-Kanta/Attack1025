import React, { useRef, useState, useEffect } from 'react'
import type { Panel, Team, CaptureRequest } from '../types/game'

type BoardProps = {
  board: Panel[]
  boardSize: number
  teams: Team[]
  requests?: CaptureRequest[]
  selectedPanelId: string | null
  onSelectPanel: (panelId: string) => void
  // attack execution mode: if true, selectable panels can be executed via onExecutePanel
  attackExecMode?: boolean
  attackExecutorTeamId?: string | null
  onExecutePanel?: (panelId: string) => void
}

export const Board = ({
  board,
  boardSize,
  teams,
  requests = [],
  selectedPanelId,
  onSelectPanel,
  attackExecMode = false,
  attackExecutorTeamId = null,
  onExecutePanel,
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

  const containerRef = useRef<HTMLDivElement | null>(null)
  const isDraggingRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })
  const [isPointerDown, setIsPointerDown] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let activePointerId: number | null = null

    const onPointerDown = (e: PointerEvent) => {
      if (e.isPrimary === false) return
      isDraggingRef.current = false
      setIsPointerDown(true)
      activePointerId = e.pointerId
      try {
        (el as Element).setPointerCapture?.(activePointerId)
      } catch (err) {
        // ignore
      }
      startRef.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDown) return
      if (activePointerId !== null && e.pointerId !== activePointerId) return
      const dx = e.clientX - startRef.current.x
      const dy = e.clientY - startRef.current.y
      if (!isDraggingRef.current && Math.hypot(dx, dy) > 5) {
        isDraggingRef.current = true
      }
      if (isDraggingRef.current) {
        el.scrollLeft = startRef.current.scrollLeft - dx
        el.scrollTop = startRef.current.scrollTop - dy
        e.preventDefault()
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (activePointerId !== null && e.pointerId !== activePointerId) return
      // if not dragging, try to detect clicked panel by pointer position
      if (!isDraggingRef.current) {
        try {
          const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
          const btn = target?.closest('button[data-panel-id]') as HTMLButtonElement | null
          if (btn) {
            const pid = btn.getAttribute('data-panel-id')
            if (pid) {
              // if attack exec mode is active and executor provided, prefer execute
              if (
                attackExecMode &&
                typeof onExecutePanel === 'function' &&
                (() => {
                  const panel = board.find((p) => p.id === pid)
                  if (!panel) return false
                  // selectable only if owned and not owned by executor
                  return !!panel.ownerTeamId && panel.ownerTeamId !== attackExecutorTeamId
                })()
              ) {
                onExecutePanel(pid)
              } else {
                onSelectPanel(pid)
              }
            }
          }
        } catch (err) {
          // ignore
        }
      }

      setIsPointerDown(false)
      setTimeout(() => {
        isDraggingRef.current = false
      }, 0)
      try {
        (el as Element).releasePointerCapture?.(e.pointerId)
      } catch (err) {
        // ignore
      }
      activePointerId = null
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
    }
  }, [isPointerDown])

  return (
    <div
      ref={containerRef}
      className="overflow-auto rounded border border-slate-300 bg-white p-2"
      style={{ cursor: isPointerDown ? 'grabbing' : 'grab', height: '100%', touchAction: 'none' as const }}
    >
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
          const isExecutable = attackExecMode && panel.ownerTeamId && panel.ownerTeamId !== attackExecutorTeamId

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
              className={`aspect-square rounded ${selected ? 'ring-2 ring-blue-500' : ''} ${isExecutable ? 'ring-2 ring-rose-500' : ''}`}
              style={{ padding: outerGradient ? '3px' : undefined, background: outerGradient, borderRadius: '0.375rem' }}
            >
                <button
                  type="button"
                  data-panel-id={panel.id}
                  onClick={() => {
                    // fallback for environments where pointerup might not fire
                    if (isDraggingRef.current) return
                    if (attackExecMode && typeof onExecutePanel === 'function' && panel.ownerTeamId && panel.ownerTeamId !== attackExecutorTeamId) {
                      onExecutePanel(panel.id)
                    } else {
                      onSelectPanel(panel.id)
                    }
                  }}
                  onPointerUp={(e) => {
                    // prefer pointerup for reliable detection alongside drag handling
                    if (isDraggingRef.current) return
                    // only react to primary button
                    // @ts-ignore - PointerEvent type is available in DOM
                    if (e && typeof (e as PointerEvent).button === 'number' && (e as PointerEvent).button !== 0) return
                    if (attackExecMode && typeof onExecutePanel === 'function' && panel.ownerTeamId && panel.ownerTeamId !== attackExecutorTeamId) {
                      onExecutePanel(panel.id)
                    } else {
                      onSelectPanel(panel.id)
                    }
                  }}
                  className={`w-full h-full aspect-square rounded border text-[10px] font-semibold leading-tight transition hover:border-slate-500 relative ${isExecutable ? 'cursor-crosshair' : ''}`}
                  style={{
                    backgroundColor:
                      owner?.color ??
                      (panel.revealStatus === 'revealed' ? 'rgb(241 245 249)' : 'rgb(15 23 42)'),
                    color: owner ? '#fff' : panel.revealStatus === 'revealed' ? '#0f172a' : '#94a3b8',
                    borderColor: owner?.color ?? 'rgb(148 163 184)',
                    padding: 0,
                    overflow: 'hidden',
                  }}
                  title={
                    panel.revealStatus === 'revealed'
                      ? `No.${panel.pokemonNumber} (${panel.x},${panel.y})`
                      : `非公開 (${panel.x},${panel.y})`
                  }
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
