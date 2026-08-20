import { describe, it, expect, vi } from 'vitest'
import { openBdSummaryToWork, fetchOpenBdByIsbn, openBdProvider } from './openbd'

// 外部書誌の取得元が変わっても、差し替えるのはこのプロバイダ1つで済むこと。
// あわせて「取り込むのは書誌情報だけ（書影・内容紹介文は持ち込まない）」を固定する。

const SUMMARY = {
  isbn: '9784834000825',
  title: 'ぐりとぐら',
  volume: '',
  series: '',
  publisher: '福音館書店',
  pubdate: '19670120',
  cover: 'https://cover.openbd.jp/9784834000825.jpg',
  author: 'なかがわりえこ／さく',
}

describe('openBdSummaryToWork：共通形式への変換', () => {
  it('書名・著者・出版社・ISBN・出版年を取り込む', () => {
    const w = openBdSummaryToWork(SUMMARY)
    expect(w.title).toBe('ぐりとぐら')
    expect(w.author).toBe('なかがわりえこ／さく')
    expect(w.publisher).toBe('福音館書店')
    expect(w.isbn13).toBe('9784834000825')
    expect(w.publishedYear).toBe(1967)
    expect(w.source).toBe('openbd')
  })

  it('★ 書影と内容紹介文は取り込まない（利用条件の確認が済むまで持ち込まない）', () => {
    const w = openBdSummaryToWork({ ...SUMMARY, summary: '宣伝文です' })
    expect(w.summary).toBe('')
    expect(JSON.stringify(w)).not.toContain('cover.openbd.jp')
  })

  it('★ シリーズ名から紙芝居と分かるときは紙芝居にする', () => {
    const w = openBdSummaryToWork({ ...SUMMARY, title: 'おおきなかぶ', series: '紙芝居セット' })
    expect(w.materialType).toBe('kamishibai')
  })

  it('出版年が読めない形でも落ちない', () => {
    expect(openBdSummaryToWork({ ...SUMMARY, pubdate: '' }).publishedYear).toBeNull()
    expect(openBdSummaryToWork({ ...SUMMARY, pubdate: undefined }).publishedYear).toBeNull()
  })

  it('書名が無い行は捨てる（openBDは見つからないと null を返す）', () => {
    expect(openBdSummaryToWork(null)).toBeNull()
    expect(openBdSummaryToWork({ isbn: '9784834000825' })).toBeNull()
  })
})

describe('openBdProvider：ISBNのときだけ問い合わせる', () => {
  it('★ 書名で検索されたときは通信しない（openBDはISBNでしか引けない）', async () => {
    const fetchImpl = vi.fn()
    globalThis.fetch = fetchImpl
    expect(await openBdProvider.search('ぐりとぐら')).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('ISBNを入力したときは書誌を返す（ハイフン付き・10桁でも引ける）', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true, json: async () => [{ summary: SUMMARY }],
    })
    const works = await fetchOpenBdByIsbn('9784834000825', { fetchImpl })
    expect(works).toHaveLength(1)
    expect(works[0].title).toBe('ぐりとぐら')
    expect(fetchImpl.mock.calls[0][0]).toContain('isbn=9784834000825')
  })

  it('該当が無いとき（nullの行）は空配列になる', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => [null] })
    expect(await fetchOpenBdByIsbn('9784834000825', { fetchImpl })).toEqual([])
  })

  it('★ 取得に失敗したら例外を投げる（呼び出し側が「追加できない」と伝えられるように）', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => [] })
    await expect(fetchOpenBdByIsbn('9784834000825', { fetchImpl })).rejects.toThrow()
  })
})
