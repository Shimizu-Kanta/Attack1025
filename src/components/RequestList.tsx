import type { CaptureRequest, Team } from '../types/game'

type RequestListProps = {
  requests: CaptureRequest[]
  teams: Team[]
  onApprove?: (requestId: string) => void
  onReject?: (requestId: string, withPenalty: boolean) => void
}

export const RequestList = ({ requests, teams, onApprove, onReject }: RequestListProps) => {
  const teamMap = new Map(teams.map((team) => [team.id, team]))

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
          </li>
        )
      })}
    </ul>
  )
}
