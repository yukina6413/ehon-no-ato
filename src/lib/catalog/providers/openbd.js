// ============================================================
// 外部書誌プロバイダ：openBD
// ============================================================
// docs/book-data-pipeline.md で「第一候補」とした取得元。
// 無料・登録不要で、ブラウザから直接呼べる（CORSが開いていることを確認済み）。
//
// 【重要な制約】openBDは「ISBNで引く」APIしか持たない。書名でのキーワード検索はできない。
//   そのため、このプロバイダが結果を返すのは
//   利用者が **ISBN（本の裏のバーコードの数字）を入力したとき**だけ。
//   書名で探して見つからなかったときは、手入力で追加する道に進んでもらう。
//
// 【取り込む項目】書名・著者・出版社・ISBN・出版年 だけ。
//   書影と内容紹介文は取り込まない（利用条件の確認が済むまで保存しない方針。
//   docs/book-data-pipeline.md「内容紹介文はそのまま転載しない」）。
// ============================================================

import { toCatalogWork, normalizeIsbn, detectMaterialType } from '../normalize'

export const OPENBD_ENDPOINT = 'https://api.openbd.jp/v1/get'
const TIMEOUT_MS = 8000

// pubdate は '20050301' / '2005-03' / '2005' などばらつく。先頭4桁だけを年として使う。
function toPublishedYear(pubdate) {
  const m = String(pubdate ?? '').match(/(\d{4})/)
  if (!m) return null
  const year = Number(m[1])
  return year >= 1800 && year <= 2200 ? year : null
}

/**
 * openBDの summary を、アプリ共通の CatalogWork へ変換する。
 * ネットワークに触れない純粋な関数（テストしやすさのため分けている）。
 */
export function openBdSummaryToWork(summary) {
  if (!summary?.title) return null
  // シリーズ名に「紙芝居」が入っていることがあるので、書名と一緒に見る
  const detected = detectMaterialType(summary.title, summary.series, summary.publisher)
  return toCatalogWork({
    source:        'openbd',
    sourceId:      summary.isbn ?? null,
    title:         [summary.title, summary.volume].filter(Boolean).join(' ').trim(),
    author:        summary.author ?? '',
    publisher:     summary.publisher ?? '',
    isbn:          summary.isbn ?? null,
    publishedYear: toPublishedYear(summary.pubdate),
    // 判定できないときは toCatalogWork の既定（絵本）になるが、
    // 画面側では detectMaterialType の結果が null なら利用者に選んでもらう
    materialType:  detected ?? undefined,
  })
}

/**
 * ISBNで1冊引く。見つからなければ空配列。
 * 通信に失敗したときは例外を投げる（呼び出し側＝catalogService が
 * 「外部が落ちてもアプリ内の結果は返す」形で受け止める）。
 */
export async function fetchOpenBdByIsbn(isbn13, { fetchImpl = globalThis.fetch } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetchImpl(`${OPENBD_ENDPOINT}?isbn=${encodeURIComponent(isbn13)}`, {
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`openBDから書誌を取得できませんでした（${res.status}）`)
    const rows = await res.json()
    return (Array.isArray(rows) ? rows : [])
      .map(row => openBdSummaryToWork(row?.summary))
      .filter(Boolean)
  } finally {
    clearTimeout(timer)
  }
}

export const openBdProvider = {
  id: 'openbd',
  label: 'openBD',
  // 入力がISBNのときだけ問い合わせる。書名では引けないAPIなので、
  // それ以外は「候補なし」を即返して通信を発生させない。
  async search(query) {
    const isbn13 = normalizeIsbn(query)
    if (!isbn13) return []
    return fetchOpenBdByIsbn(isbn13)
  },
}
