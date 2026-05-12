import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { TEAM_COLOR_PRESETS } from '../data/teamColors'
import { useGameStore } from '../store/gameStore'
import type { GameSettings, RevealMode } from '../types/game'
import { createDefaultSeed } from '../utils/seed'

type TeamForm = {
  name: string
  color: string
  playersRaw: string
}

const BOARD_SIZES = [5, 8, 16, 32]

const createTeamDefaults = (count: number): TeamForm[] =>
  Array.from({ length: count }).map((_, i) => ({
    name: `チーム${i + 1}`,
    color: TEAM_COLOR_PRESETS[i % TEAM_COLOR_PRESETS.length],
    playersRaw: '',
  }))

export const StartPage = () => {
  const { startGame, phase } = useGameStore((state) => ({
    startGame: state.startGame,
    phase: state.phase,
  }))

  const [boardSize, setBoardSize] = useState(8)
  const [pokemonNumberStart, setPokemonNumberStart] = useState(1)
  const [pokemonNumberEnd, setPokemonNumberEnd] = useState(1025)
  const [excludedRaw, setExcludedRaw] = useState('')
  const [seed, setSeed] = useState(createDefaultSeed())
  const [revealMode, setRevealMode] = useState<RevealMode>('afterApproval')
  const [penaltyThreshold, setPenaltyThreshold] = useState(2)
  const [teamCount, setTeamCount] = useState(2)
  const [teams, setTeams] = useState<TeamForm[]>(createTeamDefaults(2))
  const [error, setError] = useState<string>('')

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
    setTeamCount(count)
    setTeams((prev) => {
      const next = [...prev]
      if (next.length > count) {
        return next.slice(0, count)
      }
      while (next.length < count) {
        const idx = next.length
        next.push({
          name: `チーム${idx + 1}`,
          color: TEAM_COLOR_PRESETS[idx % TEAM_COLOR_PRESETS.length],
          playersRaw: '',
        })
      }
      return next
    })
  }

  const updateTeam = (index: number, patch: Partial<TeamForm>) => {
    setTeams((prev) => prev.map((team, i) => (i === index ? { ...team, ...patch } : team)))
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ゲーム開始に失敗しました。')
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <h1 className="text-2xl font-bold text-slate-800">Attack1025 - 初期設定</h1>

      <section className="grid gap-4 rounded border border-slate-300 bg-white p-4 md:grid-cols-2">
        <label className="text-sm">
          盤面サイズ
          <select
            className="mt-1 w-full rounded border border-slate-300 p-2"
            value={boardSize}
            onChange={(e) => setBoardSize(Number(e.target.value))}
          >
            {BOARD_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}x{size}
              </option>
            ))}
          </select>
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

        <p className="md:col-span-2 text-xs text-slate-500">
          利用可能番号: {previewPoolCount} / 必要マス数: {requiredCount}
        </p>
      </section>

      <section className="space-y-3 rounded border border-slate-300 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">チーム設定</h2>
          <label className="text-sm">
            チーム数
            <select
              className="ml-2 rounded border border-slate-300 p-1"
              value={teamCount}
              onChange={(e) => resizeTeams(Number(e.target.value))}
            >
              {Array.from({ length: 7 }).map((_, i) => (
                <option key={i + 2} value={i + 2}>
                  {i + 2}
                </option>
              ))}
            </select>
          </label>
        </div>

        {teams.map((team, i) => (
          <div key={`team-form-${i}`} className="grid gap-2 rounded border border-slate-200 p-3 md:grid-cols-3">
            <label className="text-xs">
              チーム名
              <input
                className="mt-1 w-full rounded border border-slate-300 p-2"
                value={team.name}
                onChange={(e) => updateTeam(i, { name: e.target.value })}
              />
            </label>
            <label className="text-xs">
              カラー
              <select
                className="mt-1 w-full rounded border border-slate-300 p-2"
                value={team.color}
                onChange={(e) => updateTeam(i, { color: e.target.value })}
              >
                {TEAM_COLOR_PRESETS.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              メンバー名 (カンマ区切り)
              <input
                className="mt-1 w-full rounded border border-slate-300 p-2"
                value={team.playersRaw}
                onChange={(e) => updateTeam(i, { playersRaw: e.target.value })}
                placeholder="例: かんた, しみず"
              />
            </label>
          </div>
        ))}
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
