import type {
  AlignKind,
  Dancer,
  DocState,
  Group,
  Scene,
  StageConfig,
  Vec,
} from '@/types'
import { applyAlign, aspectOf, defaultPosition } from '@/lib/geometry'
import { colorForIndex } from '@/lib/palette'
import { DEFAULT_GROUP_NAME, type RosterRow } from '@/lib/roster'
import { isPresent } from '@/lib/scene'

export function uid(): string {
  return crypto.randomUUID()
}

export function createInitialState(): DocState {
  const groups: Group[] = [
    { id: uid(), name: 'グループA', color: colorForIndex(0) },
    { id: uid(), name: 'グループB', color: colorForIndex(5) },
  ]
  const sampleNames = ['れん', 'みお', 'はると', 'さくら', 'ゆうと', 'あおい']
  const dancers: Dancer[] = sampleNames.map((name, i) => ({
    id: uid(),
    name,
    groupId: groups[i % groups.length].id,
  }))
  const positions: Record<string, Vec> = {}
  dancers.forEach((d, i) => {
    positions[d.id] = defaultPosition(i)
  })
  const scene: Scene = { id: uid(), name: '場面1', positions }
  return {
    title: '新しいフォーメーション',
    stage: { kind: 'stage', widthM: 12, depthM: 8, gridM: 1 },
    groups,
    dancers,
    scenes: [scene],
    currentSceneId: scene.id,
  }
}

export type Action =
  | { type: 'SET_TITLE'; title: string }
  | { type: 'SET_STAGE'; patch: Partial<StageConfig> }
  | { type: 'ADD_GROUP' }
  | { type: 'UPDATE_GROUP'; id: string; patch: Partial<Omit<Group, 'id'>> }
  | { type: 'REMOVE_GROUP'; id: string }
  | { type: 'ADD_DANCER'; name: string; groupId: string }
  | { type: 'UPDATE_DANCER'; id: string; patch: Partial<Omit<Dancer, 'id'>> }
  | { type: 'REMOVE_DANCER'; id: string }
  | { type: 'IMPORT_ROSTER'; rows: RosterRow[]; mode: 'replace' | 'append' }
  | { type: 'SET_PRESENCE'; id: string; present: boolean }
  | { type: 'MOVE_DANCER'; id: string; pos: Vec }
  | { type: 'SET_POSITIONS'; positions: Record<string, Vec> }
  | { type: 'ALIGN'; kind: AlignKind; ids: string[] }
  | { type: 'ADD_SCENE' }
  | { type: 'DUPLICATE_SCENE' }
  | { type: 'REMOVE_SCENE'; id: string }
  | { type: 'RENAME_SCENE'; id: string; name: string }
  | { type: 'SELECT_SCENE'; id: string }
  | { type: 'MOVE_SCENE'; id: string; dir: -1 | 1 }

function mapScene(scenes: Scene[], id: string, fn: (s: Scene) => Scene): Scene[] {
  return scenes.map((s) => (s.id === id ? fn(s) : s))
}

function insertAfterCurrent(state: DocState, scene: Scene): Scene[] {
  const idx = state.scenes.findIndex((s) => s.id === state.currentSceneId)
  const scenes = [...state.scenes]
  scenes.splice(idx + 1, 0, scene)
  return scenes
}

// CSVから読み取った行を踊り子・グループへ取り込む。
// - グループはCSVのグループ名で解決する。既存グループと名前が一致すれば id と色を再利用し、
//   無ければ新しいグループを採番（色は既存数の続きから）して作る。空名は「未分類」にまとめる。
// - mode 'replace': 名簿を総入れ替えし、各シーンの配置を新メンバーの既定配置で作り直す。
// - mode 'append' : 既存の名簿・配置を保ったまま末尾に追加する（新規グループのみ後ろに足す）。
function importRoster(
  state: DocState,
  rows: RosterRow[],
  mode: 'replace' | 'append',
): DocState {
  if (rows.length === 0) return state

  const existingByName = new Map<string, Group>()
  for (const g of state.groups) existingByName.set(g.name.trim(), g)

  // CSVに出現したグループを出現順で解決する（同名は1つに集約）。
  const resolved = new Map<string, Group>()
  let createdCount = 0
  function resolveGroup(rawName: string): Group {
    const name = rawName.trim() || DEFAULT_GROUP_NAME
    const already = resolved.get(name)
    if (already) return already
    const existing = existingByName.get(name)
    const group: Group =
      existing ?? {
        id: uid(),
        name,
        // 既存グループと色が被らないよう、既存数の続きから採番する
        color: colorForIndex(state.groups.length + createdCount),
      }
    if (!existing) createdCount += 1
    resolved.set(name, group)
    return group
  }

  const importedDancers: Dancer[] = rows.map((row) => ({
    id: uid(),
    name: row.name.trim() || '踊り子',
    groupId: resolveGroup(row.group).id,
  }))

  if (mode === 'replace') {
    const groups = Array.from(resolved.values())
    const scenes = state.scenes.map((s) => {
      const positions: Record<string, Vec> = {}
      importedDancers.forEach((d, i) => {
        positions[d.id] = defaultPosition(i)
      })
      // メンバー総入れ替えのため、旧IDを参照する非出演情報は破棄する
      return { ...s, positions, absent: undefined }
    })
    return { ...state, groups, dancers: importedDancers, scenes }
  }

  // append: 既存に無い新規グループだけを後ろに追加する
  const newGroups = Array.from(resolved.values()).filter(
    (g) => !state.groups.some((x) => x.id === g.id),
  )
  const base = state.dancers.length
  const scenes = state.scenes.map((s) => {
    const positions = { ...s.positions }
    importedDancers.forEach((d, i) => {
      positions[d.id] = defaultPosition(base + i)
    })
    return { ...s, positions }
  })
  return {
    ...state,
    groups: [...state.groups, ...newGroups],
    dancers: [...state.dancers, ...importedDancers],
    scenes,
  }
}

export function projectReducer(state: DocState, action: Action): DocState {
  switch (action.type) {
    case 'SET_TITLE':
      return { ...state, title: action.title }

    case 'SET_STAGE':
      return { ...state, stage: { ...state.stage, ...action.patch } }

    case 'ADD_GROUP': {
      const group: Group = {
        id: uid(),
        name: `グループ${state.groups.length + 1}`,
        color: colorForIndex(state.groups.length),
      }
      return { ...state, groups: [...state.groups, group] }
    }

    case 'UPDATE_GROUP':
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.id ? { ...g, ...action.patch } : g,
        ),
      }

    case 'REMOVE_GROUP': {
      if (state.groups.length <= 1) return state
      const remaining = state.groups.filter((g) => g.id !== action.id)
      const fallback = remaining[0].id
      return {
        ...state,
        groups: remaining,
        dancers: state.dancers.map((d) =>
          d.groupId === action.id ? { ...d, groupId: fallback } : d,
        ),
      }
    }

    case 'ADD_DANCER': {
      const dancer: Dancer = {
        id: uid(),
        name: action.name.trim() || '踊り子',
        groupId: action.groupId,
      }
      const index = state.dancers.length
      return {
        ...state,
        dancers: [...state.dancers, dancer],
        scenes: state.scenes.map((s) => ({
          ...s,
          positions: { ...s.positions, [dancer.id]: defaultPosition(index) },
        })),
      }
    }

    case 'UPDATE_DANCER':
      return {
        ...state,
        dancers: state.dancers.map((d) =>
          d.id === action.id ? { ...d, ...action.patch } : d,
        ),
      }

    case 'REMOVE_DANCER':
      return {
        ...state,
        dancers: state.dancers.filter((d) => d.id !== action.id),
        scenes: state.scenes.map((s) => {
          const inPositions = action.id in s.positions
          const inAbsent = s.absent?.includes(action.id) ?? false
          if (!inPositions && !inAbsent) return s
          const positions = { ...s.positions }
          delete positions[action.id]
          const absent = inAbsent
            ? s.absent!.filter((x) => x !== action.id)
            : s.absent
          return { ...s, positions, absent }
        }),
      }

    case 'SET_PRESENCE': {
      // 現在のシーンでの出演ON/OFF（位置は保持したまま absent を出し入れする）
      return {
        ...state,
        scenes: mapScene(state.scenes, state.currentSceneId, (s) => {
          const absent = new Set(s.absent ?? [])
          if (action.present) absent.delete(action.id)
          else absent.add(action.id)
          return { ...s, absent: Array.from(absent) }
        }),
      }
    }

    case 'IMPORT_ROSTER':
      return importRoster(state, action.rows, action.mode)

    case 'MOVE_DANCER':
      return {
        ...state,
        scenes: mapScene(state.scenes, state.currentSceneId, (s) => ({
          ...s,
          positions: { ...s.positions, [action.id]: action.pos },
        })),
      }

    case 'SET_POSITIONS':
      return {
        ...state,
        scenes: mapScene(state.scenes, state.currentSceneId, (s) => ({
          ...s,
          positions: { ...s.positions, ...action.positions },
        })),
      }

    case 'ALIGN': {
      const scene = state.scenes.find((s) => s.id === state.currentSceneId)
      if (!scene) return state
      const items = action.ids
        .filter((id) => scene.positions[id] && isPresent(scene, id))
        .map((id) => ({ id, pos: scene.positions[id] }))
      const updated = applyAlign(action.kind, items, aspectOf(state.stage))
      if (Object.keys(updated).length === 0) return state
      return {
        ...state,
        scenes: mapScene(state.scenes, state.currentSceneId, (s) => ({
          ...s,
          positions: { ...s.positions, ...updated },
        })),
      }
    }

    case 'ADD_SCENE': {
      const positions: Record<string, Vec> = {}
      state.dancers.forEach((d, i) => {
        positions[d.id] = defaultPosition(i)
      })
      const scene: Scene = {
        id: uid(),
        name: `場面${state.scenes.length + 1}`,
        positions,
      }
      return {
        ...state,
        scenes: insertAfterCurrent(state, scene),
        currentSceneId: scene.id,
      }
    }

    case 'DUPLICATE_SCENE': {
      const current = state.scenes.find((s) => s.id === state.currentSceneId)
      if (!current) return state
      const scene: Scene = {
        id: uid(),
        name: `${current.name} のコピー`,
        positions: structuredClone(current.positions),
        absent: current.absent ? [...current.absent] : undefined,
      }
      return {
        ...state,
        scenes: insertAfterCurrent(state, scene),
        currentSceneId: scene.id,
      }
    }

    case 'REMOVE_SCENE': {
      if (state.scenes.length <= 1) return state
      const idx = state.scenes.findIndex((s) => s.id === action.id)
      const scenes = state.scenes.filter((s) => s.id !== action.id)
      let currentSceneId = state.currentSceneId
      if (action.id === currentSceneId) {
        currentSceneId = scenes[Math.min(idx, scenes.length - 1)].id
      }
      return { ...state, scenes, currentSceneId }
    }

    case 'RENAME_SCENE':
      return {
        ...state,
        scenes: mapScene(state.scenes, action.id, (s) => ({
          ...s,
          name: action.name,
        })),
      }

    case 'SELECT_SCENE':
      return { ...state, currentSceneId: action.id }

    case 'MOVE_SCENE': {
      const idx = state.scenes.findIndex((s) => s.id === action.id)
      const j = idx + action.dir
      if (idx < 0 || j < 0 || j >= state.scenes.length) return state
      const scenes = [...state.scenes]
      ;[scenes[idx], scenes[j]] = [scenes[j], scenes[idx]]
      return { ...state, scenes }
    }
  }
}
