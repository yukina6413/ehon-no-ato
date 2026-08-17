// ============================================================
// 作品カタログの検索サービス
// ============================================================
// 画面は「どこから book を取ってくるか」を知らなくてよい、という分離をつくる層。
//
//   検索UI
//     ↓
//   catalogService
//     ├─ アプリ内DB（books）
//     ├─ 外部書誌プロバイダA   ← あとから登録・差し替えできる
//     ├─ 外部書誌プロバイダB
//     └─ 手入力（未登録作品の仮登録）
//     ↓
//   CatalogWork（共通形式）
//
// 外部APIの仕様が変わっても、差し替えるのはプロバイダ1つだけで済むようにする。
// ============================================================

import { searchBooksByKeyword } from '../dataAdapter'
import { toCatalogWork, dedupeKey, findDuplicateCandidates, MATERIAL_TYPES } from './normalize'

// ──── 外部書誌プロバイダの登録簿 ────
// プロバイダは { id, label, search(query) => Promise<CatalogWork[]> } の形。
// 実際の接続（国立国会図書館・openBD など）は、利用条件を確認してから追加する。
const externalProviders = new Map()

export function registerCatalogProvider(provider) {
  if (!provider?.id || typeof provider.search !== 'function') {
    throw new Error('カタログプロバイダには id と search(query) が必要です')
  }
  externalProviders.set(provider.id, provider)
}

export function unregisterCatalogProvider(id) {
  externalProviders.delete(id)
}

export function listCatalogProviders() {
  return [...externalProviders.values()].map(p => ({ id: p.id, label: p.label ?? p.id }))
}

// ──── アプリ内DBの検索（既存の実装を使う）────
async function searchLocal(query) {
  const books = await searchBooksByKeyword(query)
  return books.map(b => toCatalogWork({
    source: 'local',
    id:     b.id,
    title:  b.title,
    author: b.author,
    publisher: b.publisher,
    summary:   b.synopsis,
    // material_type はDB未対応。列が入るまでは絵本として扱う（既存5冊はすべて絵本）
    materialType: b.materialType ?? MATERIAL_TYPES.PICTURE_BOOK,
  }))
}

/**
 * 作品を探す。まずアプリ内DB、必要なら外部書誌へ広げる。
 *
 * 返り値：
 *   { local: CatalogWork[], external: CatalogWork[], errors: [{providerId, message}] }
 *
 * 外部が落ちてもアプリ内の結果は返す（記録を止めないため）。
 */
export async function searchWorks(query, { includeExternal = false } = {}) {
  const q = String(query ?? '').trim()
  if (!q) return { local: [], external: [], errors: [] }

  const local = await searchLocal(q)

  if (!includeExternal || externalProviders.size === 0) {
    return { local, external: [], errors: [] }
  }

  const seen = new Set(local.map(dedupeKey))
  const external = []
  const errors = []

  const results = await Promise.allSettled(
    [...externalProviders.values()].map(async p => ({
      id: p.id,
      works: await p.search(q),
    }))
  )

  for (const r of results) {
    if (r.status === 'rejected') {
      errors.push({ providerId: 'unknown', message: String(r.reason?.message ?? r.reason) })
      continue
    }
    for (const raw of r.value.works ?? []) {
      const work = toCatalogWork({ ...raw, source: raw.source ?? r.value.id })
      const key = dedupeKey(work)
      if (seen.has(key)) continue      // アプリ内DBに既にある作品は外部から重ねて出さない
      seen.add(key)
      external.push(work)
    }
  }

  return { local, external, errors }
}

/**
 * 未登録作品を仮登録するための下書きを作る。
 * 利用者に求めるのは「タイトル」と「種別」だけ。他は分かれば入れてもらう。
 */
export function buildDraftWork({ title, materialType, author, illustrator, publisher, isbn }) {
  const work = toCatalogWork({
    source: 'manual', title, materialType, author, illustrator, publisher, isbn,
  })
  const problems = []
  if (!work.title) problems.push('タイトルを入力してください')
  return { work, problems, isValid: problems.length === 0 }
}

/**
 * 仮登録の前に、すでに登録済みでないかを確認する。
 * 自動で同一と決めず、候補を返して人に選んでもらう。
 */
export async function findExistingCandidates(work) {
  const target = toCatalogWork(work)
  if (!target.title) return []
  const local = await searchLocal(target.title)
  return findDuplicateCandidates(target, local)
}
