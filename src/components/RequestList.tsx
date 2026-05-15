import type { CaptureRequest, Team } from '../types/game'
import { useState } from 'react'

type RequestListProps = {
  requests: CaptureRequest[]
  teams: Team[]
  onApprove?: (requestId: string, bonusRadius?: number) => void
  onReject?: (requestId: string, withPenalty: boolean) => void
}

export const RequestList = ({ requests, teams, onApprove, onReject }: RequestListProps) => {
  const teamMap = new Map(teams.map((team) => [team.id, team]))
  const [showBonusFor, setShowBonusFor] = useState<string | null>(null)
  const [bonusRadius, setBonusRadius] = useState<number>(1)

  if (requests.length === 0) {
    return <p className="text-xs text-slate-500">申請はありません。</p>
  }

  return (
    <ul className="space-y-2 text-xs">
      {requests.map((request) => {
        const team = teamMap.get(request.teamId)
        return (
          <li key={request.id} className="rounded border border-slate-200 p-2">
            <p className="font-semibold">
              {team?.name ?? request.teamId} / No.{request.pokemonNumber}
            </p>
            <p>申請者: {request.playerName}</p>
            <p>提出: {new Date(request.submittedAt).toLocaleString('ja-JP')}</p>
            {request.evidenceUrl ? (
              <a
                className="break-all text-blue-600 underline"
                href={request.evidenceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {request.evidenceUrl}
              </a>
            ) : null}
            {request.comment ? <p className="mt-1">コメント: {request.comment}</p> : null}

            {request.status === 'pending' && onApprove && onReject ? (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => onApprove(request.id)}
                  className="rounded bg-emerald-600 px-2 py-1 text-white"
                >
                  承認
                </button>
                <button
                  type="button"
                  onClick={() => setShowBonusFor(request.id)}
                  className="rounded bg-yellow-500 px-2 py-1 text-white"
                >
                  ボーナス承認
                </button>
                <button
                  type="button"
                  onClick={() => onReject(request.id, false)}
                  className="rounded bg-slate-600 px-2 py-1 text-white"
                >
                  却下
                </button>
                <button
                  type="button"
                  onClick={() => onReject(request.id, true)}
                  className="rounded bg-rose-600 px-2 py-1 text-white"
                >
                  却下+ペナルティ
                </button>
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">状態: {request.status}</p>
            )}

            {showBonusFor === request.id ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="w-80 rounded bg-white p-4">
                  <h3 className="mb-2 font-bold">ボーナス承認</h3>
                  <p className="text-sm">周囲何マスをまとめて取得しますか？</p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={bonusRadius}
                      onChange={(e) => setBonusRadius(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
                      className="w-20 rounded border border-slate-300 p-2"
                    />
                    <div className="flex-1" />
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBonusFor(null)}
                      className="rounded bg-slate-200 px-3 py-1"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onApprove?.(request.id, bonusRadius)
                        setShowBonusFor(null)
                      }}
                      className="rounded bg-emerald-600 px-3 py-1 text-white"
                    >
                      実行
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
