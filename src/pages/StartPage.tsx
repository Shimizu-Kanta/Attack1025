import { useMemo, useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { TEAM_COLOR_PRESETS } from '../data/teamColors'
import { useGameStore } from '../store/gameStore'
import type { GameSettings, RevealMode } from '../types/game'
import { createDefaultSeed } from '../utils/seed'

type TeamForm = {
  name: string
  color: string
  playersRaw: string
}

// board size can be any integer between 5 and 32

const createTeamDefaults = (count: number): TeamForm[] =>
  Array.from({ length: count }).map((_, i) => ({
    name: `チーム${i + 1}`,
    color: TEAM_COLOR_PRESETS[i % TEAM_COLOR_PRESETS.length].color,
    playersRaw: '',
  }))

export const StartPage = () => {
  const navigate = useNavigate()
  const startGame = useGameStore((state) => state.startGame)
  const phase = useGameStore((state) => state.phase)
  const resetGame = useGameStore((state) => state.resetGame)

  const [boardSize, setBoardSize] = useState(8)
  const [pokemonNumberStart, setPokemonNumberStart] = useState(1)
  const [pokemonNumberEnd, setPokemonNumberEnd] = useState(1025)
  const [excludedRaw, setExcludedRaw] = useState('')
  const [seed, setSeed] = useState(createDefaultSeed())
  const [revealMode, setRevealMode] = useState<RevealMode>('afterApproval')
  const [penaltyThreshold, setPenaltyThreshold] = useState(2)
  const [initialOpenCount, setInitialOpenCount] = useState(1)
  const [teams, setTeams] = useState<TeamForm[]>(createTeamDefaults(2))
  const [error, setError] = useState<string>('')

  useEffect(() => {
    console.log('StartPage initial phase:', phase)
    if (phase === 'playing') {
      console.warn('StartPage: restored phase is playing on open — check persisted state')
    }
  }, [phase])

  const requiredCount = boardSize * boardSize
  const previewPoolCount = useMemo(() => {
    const excluded = new Set(
      excludedRaw
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 1025),
    )

    let count = 0
    for (let no = pokemonNumberStart; no <= pokemonNumberEnd; no += 1) {
      if (!excluded.has(no)) {
        count += 1
      }
    }
    return count
  }, [excludedRaw, pokemonNumberEnd, pokemonNumberStart])

  if (phase === 'playing') {
    return <Navigate to="/game" replace />
  }
  if (phase === 'ended') {
    return <Navigate to="/result" replace />
  }

  const resizeTeams = (count: number) => {
    setTeams((prev) => {
      const next = [...prev]
      if (next.length > count) {
        return next.slice(0, count)
      }
      while (next.length < count) {
        const idx = next.length
        next.push({
          name: `チーム${idx + 1}`,
          color: TEAM_COLOR_PRESETS[idx % TEAM_COLOR_PRESETS.length].color,
          playersRaw: '',
        })
      }
      return next
    })
  }

  const updateTeam = (index: number, patch: Partial<TeamForm>) => {
    setTeams((prev) => prev.map((team, i) => (i === index ? { ...team, ...patch } : team)))
  }

  const addTeam = () => {
    setTeams((prev) => {
      const idx = prev.length
      return [
        ...prev,
        {
          name: `チーム${idx + 1}`,
          color: TEAM_COLOR_PRESETS[idx % TEAM_COLOR_PRESETS.length].color,
          playersRaw: '',
        },
      ]
    })
  }

  const removeTeam = (index: number) => {
    setTeams((prev) => prev.filter((_, i) => i !== index))
  }

  const getContrastColor = (hex: string) => {
    try {
      const c = hex.replace('#', '')
      const r = parseInt(c.substring(0, 2), 16)
      const g = parseInt(c.substring(2, 4), 16)
      const b = parseInt(c.substring(4, 6), 16)
      const yiq = (r * 299 + g * 587 + b * 114) / 1000
      return yiq >= 128 ? '#0f172a' : '#ffffff'
    } catch (e) {
      return '#0f172a'
    }
  }

  const parsePlayers = (playersRaw: string) =>
    playersRaw
      .split(',')
      .map((s) => s.trim())
      

  const updatePlayers = (teamIndex: number, players: string[]) => {
    updateTeam(teamIndex, { playersRaw: players.join(',') })
  }

  const addMember = (teamIndex: number) => {
    const players = parsePlayers(teams[teamIndex].playersRaw)
    updatePlayers(teamIndex, [...players, ''])
  }

  const removeMember = (teamIndex: number, memberIndex: number) => {
    const players = parsePlayers(teams[teamIndex].playersRaw)
    players.splice(memberIndex, 1)
    updatePlayers(teamIndex, players)
  }

  const handleStart = () => {
    setError('')
    const excludedPokemonNumbers = excludedRaw
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 1025)

    const settings: GameSettings = {
      boardSize,
      seed: seed.trim() || createDefaultSeed(),
      pokemonNumberStart,
      pokemonNumberEnd,
      excludedPokemonNumbers,
      revealMode,
      penaltyThreshold,
      initialOpenCount,
    }

    // 重複カラーのチェック
    const colors = teams.map((t) => t.color)
    const uniqueColors = new Set(colors)
    if (uniqueColors.size !== colors.length) {
      setError('同じカラーが選択されています。各チームで異なるカラーを選択してください。')
      return
    }

    if (teams.length <  2) {
      setError('チームは2つ以上必要です。')
      return
    }

    if (previewPoolCount < requiredCount) {
      setError('利用可能な図鑑番号が足りません。除外設定と範囲を確認してください。')
      return
    }

    try {
      startGame(
        settings,
        teams.map((team, index) => ({
          name: team.name.trim() || `チーム${index + 1}`,
          color: team.color,
          players: team.playersRaw
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean),
        })),
      )
      navigate('/game')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ゲーム開始に失敗しました。')
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <h1 className="text-2xl font-bold text-slate-800">Attack1025 - 初期設定</h1>

      <div className="mt-2">
        <button
          type="button"
          className="rounded bg-rose-500 px-3 py-1 text-xs text-white"
          onClick={() => {
            try {
              localStorage.removeItem('attack1025-game-state')
            } catch (e) {
              // ignore
            }
            resetGame()
            window.location.reload()
          }}
        >
          LocalStorage をクリアしてリセット
        </button>
      </div>

      <section className="grid gap-4 rounded border border-slate-300 bg-white p-4 md:grid-cols-2">
        <label className="text-sm">
          盤面サイズ
          <input
            type="number"
            min={5}
            max={32}
            className="mt-1 w-full rounded border border-slate-300 p-2"
            value={boardSize}
            onChange={(e) => setBoardSize(Math.max(5, Math.min(32, Number(e.target.value) || 5)))}
          />
        </label>

        <label className="text-sm">
          シード
          <div className="mt-1 flex gap-2">
            <input
              className="w-full rounded border border-slate-300 p-2"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setSeed(createDefaultSeed())}
              className="rounded bg-slate-700 px-3 text-xs text-white"
            >
              再生成
            </button>
          </div>
        </label>

        <label className="text-sm">
          図鑑番号開始
          <input
            type="number"
            min={1}
            max={1025}
            className="mt-1 w-full rounded border border-slate-300 p-2"
            value={pokemonNumberStart}
            onChange={(e) => setPokemonNumberStart(Number(e.target.value))}
          />
        </label>

        <label className="text-sm">
          図鑑番号終了
          <input
            type="number"
            min={1}
            max={1025}
            className="mt-1 w-full rounded border border-slate-300 p-2"
            value={pokemonNumberEnd}
            onChange={(e) => setPokemonNumberEnd(Number(e.target.value))}
          />
        </label>

        <label className="text-sm md:col-span-2">
          除外番号 (カンマ区切り)
          <input
            className="mt-1 w-full rounded border border-slate-300 p-2"
            value={excludedRaw}
            onChange={(e) => setExcludedRaw(e.target.value)}
            placeholder="例: 25,150,493"
          />
        </label>

        <label className="text-sm">
          公開方式
          <select
            className="mt-1 w-full rounded border border-slate-300 p-2"
            value={revealMode}
            onChange={(e) => setRevealMode(e.target.value as RevealMode)}
          >
            <option value="afterApproval">GM承認後に公開</option>
            <option value="onRequest">申請時に仮公開</option>
          </select>
        </label>

        <label className="text-sm">
          ペナルティ閾値
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded border border-slate-300 p-2"
            value={penaltyThreshold}
            onChange={(e) => setPenaltyThreshold(Math.max(1, Number(e.target.value)))}
          />
        </label>

        <label className="text-sm">
          初期公開マス数
          <input
            type="number"
            min={1}
            max={requiredCount}
            className="mt-1 w-full rounded border border-slate-300 p-2"
            value={initialOpenCount}
            onChange={(e) => setInitialOpenCount(Math.max(1, Math.min(requiredCount, Number(e.target.value) || 1)))}
          />
        </label>

        <p className="md:col-span-2 text-xs text-slate-500">
          利用可能番号: {previewPoolCount} / 必要マス数: {requiredCount}
        </p>
      </section>

      <section className="space-y-3 rounded border border-slate-300 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">チーム設定</h2>
            <div className="text-sm" />
          </div>

          {teams.map((team, i) => {
            const players = parsePlayers(team.playersRaw)
            return (
              <div
                key={`team-form-${i}`}
                className="grid gap-2 rounded border p-3 md:grid-cols-4 items-start"
                style={{ borderColor: team.color, backgroundColor: '#fff' }}
              >
                <label className="text-xs text-slate-700">
                  チーム名
                  <input
                    className="mt-1 w-full rounded border border-slate-300 p-2"
                    value={team.name}
                    onChange={(e) => updateTeam(i, { name: e.target.value })}
                  />
                </label>

                <label className="text-xs text-slate-700">
                  カラー
                  <select
                    className="mt-1 w-full rounded border border-slate-300 p-2"
                    value={team.color}
                    onChange={(e) => updateTeam(i, { color: e.target.value })}
                  >
                    {TEAM_COLOR_PRESETS.map((preset) => (
                      <option key={preset.color} value={preset.color}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="text-xs text-slate-700">
                  <div className="mb-1">メンバー</div>
                  <div className="space-y-1">
                    {players.map((p, j) => (
                      <div key={`member-${j}`} className="flex items-center gap-2">
                        <input
                          className="w-full rounded border border-slate-300 p-2 text-sm"
                          value={p}
                          onChange={(e) => {
                            const next = [...players]
                            next[j] = e.target.value
                            updatePlayers(i, next)
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeMember(i, j)}
                          className="rounded bg-rose-500 px-2 py-1 text-white text-sm"
                          aria-label={`メンバー${j + 1}を削除`}
                        >
                          -
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addMember(i)}
                      className="mt-1 rounded bg-green-600 px-2 py-1 text-white text-sm"
                    >
                      メンバーを追加
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeTeam(i)}
                    className="rounded bg-rose-600 px-2 py-1 text-white"
                    aria-label={`チーム${i + 1}を削除`}
                  >
                    -
                  </button>
                </div>
              </div>
            )
          })}

          <div>
            <button
              type="button"
              onClick={addTeam}
              className="rounded bg-green-600 px-3 py-1 text-sm text-white"
            >
              チームを追加
            </button>
          </div>
      </section>

      {error ? <p className="rounded bg-rose-100 p-2 text-sm text-rose-700">{error}</p> : null}

      <button
        type="button"
        onClick={handleStart}
        className="rounded bg-blue-600 px-4 py-2 font-semibold text-white"
      >
        ゲーム開始
      </button>
    </main>
  )
}
