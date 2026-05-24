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
          if (!(action.id in s.positions)) return s
          const positions = { ...s.positions }
          delete positions[action.id]
          return { ...s, positions }
        }),
      }

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
        .filter((id) => scene.positions[id])
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
