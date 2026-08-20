// ============================================================
// 未登録の作品を、その場で追加して記録に進むためのパネル
// ============================================================
// この画面の目的は「本のデータを登録すること」ではなく、
// **今読んだ絵本・紙芝居を記録すること**。
// そのため入力は「タイトル」と「絵本／紙芝居」だけに絞り、
// 追加が終わったら検索し直させず、そのまま記録画面へ進む。
//
//   検索して見つからない
//     ↓ この作品を追加する
//   （ISBNを入れていれば外部書誌の候補／それ以外は手入力）
//     ↓ 追加して記録する
//   RecordInput（作品が選ばれた状態）
//
// 【守っていること】
//   ・books へ直接INSERTしない。追加は create_provisional_book RPC だけ
//     （dataAdapter.createProvisionalBook 経由）
//   ・同じ作品を二重に登録しない。RPCが候補を返したときは人に選んでもらう
//   ・仮登録した作品は、その場ですぐ記録できる（管理者の確認を待たせない）
// ============================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { createProvisionalBook, getBookById, isMock, PROVISIONAL_BOOK_STATUS } from '../lib/dataAdapter'
import { searchWorks } from '../lib/catalog/catalogService'
import {
  MATERIAL_TYPES, MATERIAL_TYPE_LABELS, detectMaterialType, toCatalogWork,
} from '../lib/catalog/normalize'

const GENERIC_ERROR = '作品を追加できませんでした。もう一度お試しください。'

function MaterialTypeChips({ value, onChange }) {
  return (
    <div className="flex gap-1.5">
      {Object.values(MATERIAL_TYPES).map(t => (
        <button key={t} type="button" onClick={() => onChange(t)}
          className={`text-xs px-4 py-1.5 rounded-full border transition-colors
            ${value === t
              ? 'bg-green-600 border-green-600 text-white'
              : 'bg-white border-[#DCE4D9] text-[#5A5A57] active:bg-[#EAF5EC]'}`}>
          {MATERIAL_TYPE_LABELS[t]}
        </button>
      ))}
    </div>
  )
}

function WorkLine({ work }) {
  const sub = [work.author, work.publisher, work.publishedYear ? `${work.publishedYear}年` : '']
    .filter(Boolean).join('・')
  return (
    <>
      <p className="text-sm text-[#2C2C2A] leading-snug">{work.title}</p>
      {sub && <p className="text-[11px] text-[#8A8A85] mt-0.5">{sub}</p>}
    </>
  )
}

export default function AddWorkPanel({ query }) {
  const navigate = useNavigate()
  const { ensureSession } = useAuth()

  // 'idle' → 'choose'（外部候補から選ぶ）→ 'confirm'（最小限の確認）→ 記録画面
  //                                      → 'candidates'（似た作品があった）
  const [mode,       setMode]       = useState('idle')
  const [busy,       setBusy]       = useState(false)
  const [error,      setError]      = useState(null)
  const [found,      setFound]      = useState([])     // 外部書誌の候補
  const [draft,      setDraft]      = useState(null)   // 追加しようとしている作品
  const [manual,     setManual]     = useState(false)  // 手入力で追加しようとしている
  const [candidates, setCandidates] = useState([])     // RPCが返した「似た作品」

  const q = String(query ?? '').trim()

  function newDraft(work) {
    const w = toCatalogWork(work)
    return {
      ...w,
      // 判定できたときだけ種別を決める。分からなければ利用者に選んでもらう。
      materialType: detectMaterialType(w.title, w.publisher),
    }
  }

  async function open() {
    setMode('choose')
    setError(null)
    setBusy(true)
    setFound([])
    try {
      // 既存のprovider層をそのまま使う。外部が落ちてもここで止めない。
      const { external, errors } = await searchWorks(q, { includeExternal: true })
      setFound(external)
      if (external.length === 0) {
        // 外部でも見つからない（＝書名で探した場合はほぼ常にこちら）→ 手入力へ
        setManual(true)
        setDraft(newDraft({ title: q }))
        setMode('confirm')
        if (errors.length > 0) {
          setError('外部の書誌情報は取得できませんでした。手入力で追加できます。')
        }
      }
    } catch (err) {
      console.error('外部書誌の検索に失敗:', err)
      setManual(true)
      setDraft(newDraft({ title: q }))
      setMode('confirm')
      setError('外部の書誌情報は取得できませんでした。手入力で追加できます。')
    } finally {
      setBusy(false)
    }
  }

  function pick(work) {
    setManual(false)
    setDraft(newDraft(work))
    setError(null)
    setMode('confirm')
  }

  function startManual() {
    setManual(true)
    setDraft(newDraft({ title: q }))
    setError(null)
    setMode('confirm')
  }

  function close() {
    setMode('idle')
    setError(null)
    setDraft(null)
    setCandidates([])
    setFound([])
  }

  // 記録画面へ進む。保存の正本は book_id。title等は表示のために渡すだけ。
  function goToRecord(bookId, work) {
    navigate('/record', {
      state: {
        bookId,
        bookTitle:        work?.title ?? '',
        bookAuthor:       work?.author ?? '',
        bookPublisher:    work?.publisher ?? '',
        bookMaterialType: work?.materialType ?? null,
      },
    })
  }

  // 既にある作品を使うとき、書名・著者はDB側の正本に合わせ直す（表示のずれを防ぐ）
  async function goToExisting(bookId, fallback) {
    try {
      const book = await getBookById(bookId)
      if (book) {
        goToRecord(bookId, {
          title:        book.title ?? fallback?.title ?? '',
          author:       book.author ?? '',
          publisher:    book.publisher ?? '',
          materialType: fallback?.materialType ?? null,
        })
        return
      }
    } catch (err) {
      console.error('作品の再取得に失敗:', err)
    }
    goToRecord(bookId, fallback)
  }

  async function submit(forceNew = false) {
    if (busy || !draft) return
    setBusy(true)
    setError(null)
    try {
      // 記録の保存前と同じく、ここで匿名セッションを用意する
      // （RPCは authenticated だけが実行できるため）
      if (!isMock) await ensureSession()

      const result = await createProvisionalBook(draft, { forceNew })

      if (result.status === PROVISIONAL_BOOK_STATUS.CANDIDATES) {
        setCandidates(result.candidates ?? [])
        setMode('candidates')
        return
      }
      if (!result.bookId) throw new Error(GENERIC_ERROR)

      if (result.status === PROVISIONAL_BOOK_STATUS.EXISTING) {
        await goToExisting(result.bookId, draft)
        return
      }
      goToRecord(result.bookId, draft)   // 'created'
    } catch (err) {
      console.error('作品の追加に失敗:', err)
      setError(err?.message || GENERIC_ERROR)
    } finally {
      setBusy(false)
    }
  }

  // ── 入口のボタン ──
  if (mode === 'idle') {
    return (
      <button type="button" onClick={open} disabled={!q}
        className="mt-3 w-full flex items-center justify-center gap-1.5 border border-green-600
                   text-green-700 text-xs font-bold rounded-xl py-2.5 active:bg-[#EAF5EC]
                   transition-colors disabled:opacity-50">
        <Plus size={14} /> この作品を追加する
      </button>
    )
  }

  return (
    <div className="mt-3 border border-[#DCE4D9] rounded-2xl p-3.5 bg-[#FAFAF8]">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-bold text-[#2C2C2A]">見つからない作品を追加する</p>
        <button type="button" onClick={close} className="text-[11px] text-[#8A8A85]">
          やめる
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2.5">
          {error}
        </p>
      )}

      {/* ── 外部書誌の候補から選ぶ ── */}
      {mode === 'choose' && (
        <div className="flex flex-col gap-2">
          {busy && <p className="text-xs text-[#8A8A85] py-2">書誌情報を調べています...</p>}
          {!busy && found.length > 0 && (
            <>
              <p className="text-[11px] text-[#8A8A85]">この作品ですか？</p>
              {found.map((w, i) => (
                <button key={w.isbn13 ?? `${w.title}-${i}`} type="button" onClick={() => pick(w)}
                  className="w-full text-left border border-[#DCE4D9] rounded-xl px-3 py-2.5 bg-white
                             active:bg-[#F4F6F2] transition-colors">
                  <WorkLine work={w} />
                </button>
              ))}
              <button type="button" onClick={startManual}
                className="text-[11px] text-green-700 underline self-start mt-0.5">
                どれでもない（自分で入力する）
              </button>
            </>
          )}
        </div>
      )}

      {/* ── 最小限の確認 → 追加して記録する ── */}
      {mode === 'confirm' && draft && (
        <div className="flex flex-col gap-3">
          {manual ? (
            <>
              <div>
                <p className="text-[11px] text-[#5F5E5A] mb-1.5">タイトル</p>
                <input value={draft.title}
                  onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                  placeholder="例：ぐりとぐら"
                  className="w-full text-sm border border-[#DCE4D9] rounded-xl px-3 py-2.5
                             bg-white outline-none focus:border-green-400" />
              </div>
              <div>
                <p className="text-[11px] text-[#5F5E5A] mb-1.5">作・絵（任意）</p>
                <input value={draft.author}
                  onChange={e => setDraft(d => ({ ...d, author: e.target.value }))}
                  placeholder="分かれば入力してください"
                  className="w-full text-sm border border-[#DCE4D9] rounded-xl px-3 py-2.5
                             bg-white outline-none focus:border-green-400" />
              </div>
            </>
          ) : (
            <div className="border border-[#DCE4D9] rounded-xl px-3 py-2.5 bg-white">
              <WorkLine work={draft} />
            </div>
          )}

          <div>
            <p className="text-[11px] text-[#5F5E5A] mb-1.5">
              作品の種類
              {!draft.materialType && <span className="text-orange-500 ml-1">選んでください</span>}
            </p>
            <MaterialTypeChips value={draft.materialType}
              onChange={t => setDraft(d => ({ ...d, materialType: t }))} />
          </div>

          <button type="button" onClick={() => submit(false)}
            disabled={busy || !draft.title.trim() || !draft.materialType}
            className={`w-full rounded-xl py-3 text-sm font-bold transition-colors
              ${busy || !draft.title.trim() || !draft.materialType
                ? 'bg-[#E8E6E0] text-[#B0B0A8]'
                : 'bg-green-700 text-white active:bg-green-800'}`}>
            {busy ? '追加しています...' : '追加して記録する'}
          </button>
          <p className="text-[10px] text-[#8A8A85] leading-relaxed">
            追加した作品はすぐに記録できます。ほかの方の検索結果には出ません。
          </p>
        </div>
      )}

      {/* ── 似た作品があった（勝手に決めず、選んでもらう）── */}
      {mode === 'candidates' && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-[#5F5E5A] leading-relaxed">
            同じ書名の作品が見つかりました。この作品ですか？
          </p>
          {candidates.map(c => (
            <button key={c.id} type="button" disabled={busy}
              onClick={() => goToExisting(c.id, {
                title: c.title, author: c.author, publisher: c.publisher,
                materialType: c.material_type,
              })}
              className="w-full text-left border border-[#DCE4D9] rounded-xl px-3 py-2.5 bg-white
                         active:bg-[#F4F6F2] transition-colors">
              <p className="text-sm text-[#2C2C2A] leading-snug">{c.title}</p>
              <p className="text-[11px] text-[#8A8A85] mt-0.5">
                {[c.author, c.publisher, c.published_year ? `${c.published_year}年` : '']
                  .filter(Boolean).join('・') || '作・出版社の情報なし'}
              </p>
            </button>
          ))}
          <button type="button" onClick={() => submit(true)} disabled={busy}
            className="w-full border border-green-600 text-green-700 text-xs font-bold
                       rounded-xl py-2.5 active:bg-[#EAF5EC] transition-colors">
            {busy ? '追加しています...' : 'どれでもない（新しく追加する）'}
          </button>
          <button type="button" onClick={() => { setMode('confirm'); setCandidates([]) }}
            className="text-[11px] text-[#8A8A85] flex items-center gap-0.5 self-start">
            <ChevronLeft size={12} /> 入力に戻る
          </button>
        </div>
      )}
    </div>
  )
}
