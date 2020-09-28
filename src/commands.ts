import { workspace, Neovim, Uri } from 'coc.nvim'
import BookmarkDB from './util/db'

export default class Bookmark {
  private lnum: number
  private line: string
  private filetype: string
  private filepath: string
  constructor(private nvim: Neovim, private db: BookmarkDB) { }

  private async getDocInfo(): Promise<void> {
    // @XXX: to be improved
    const doc = await workspace.document
    this.lnum = (await this.nvim.call('line', ['.']))
    this.line = await this.nvim.line
    this.filetype = doc.filetype
    this.filepath = Uri.parse(doc.uri).fsPath
  }

  public async create(annotate?: string): Promise<void> {
    const data: BookmarkItem = { line: this.line, filetype: this.filetype }
    if (annotate) data.annotation = annotate
    await this.db.push(`${encode(this.filepath)}.${this.lnum}`, data)
  }

  public async annotate(): Promise<void> {
    const annotation = await workspace.requestInput('Annotation')
    if (annotation?.trim()) {
      await this.getDocInfo()
      await this.create(annotation.trim())
      await this.refresh()
      this.onChanged()
    }
  }

  public async delete(): Promise<void> {
    await this.getDocInfo()
    await this.db.delete(`${encode(this.filepath)}.${this.lnum}`)
    await this.refresh()
    this.onChanged()
  }

  public async toggle(): Promise<void> {
    await this.getDocInfo()
    const key = `${encode(this.filepath)}.${this.lnum}`
    if (await this.db.exists(key)) {
      await this.db.delete(key)
    } else {
      await this.create()
    }
    await this.refresh()
    this.onChanged()
  }

  public async jumpTo(direction: 'next' | 'prev'): Promise<void> {
    await this.getDocInfo()
    const bookmark = await this.db.fetch(encode(this.filepath))
    if (bookmark) {
      const blnums = Object.keys(bookmark).map(lnum => Number(lnum)).sort((a, b) => a - b)
      if (direction === 'next') {
        for (const blnum of blnums) {
          if (blnum > this.lnum) {
            await workspace.moveTo({
              line: Math.max(blnum - 1, 0),
              character: 0
            })
            return
          }
        }
      } else {
        for (const blnum of blnums.reverse()) {
          if (blnum < this.lnum) {
            await workspace.moveTo({
              line: Math.max(blnum - 1, 0),
              character: 0
            })
            return
          }
        }
      }
    }
  }

  public async update(): Promise<void> {
    // todo
  }

  public async refresh(): Promise<void> {
    // clear all coc-bookmark signs
    const bufnr = (await this.nvim.buffer).id
    await this.nvim.command(`silent! sign unplace * group=coc-bookmark buffer=${bufnr}`)

    // then add signs if exists
    await this.getDocInfo()
    const bookmarks = await this.db.fetch(`${encode(this.filepath)}`)
    if (bookmarks) {
      for (const lnumstr of Object.keys(bookmarks)) {
        const lnum = Number(lnumstr)
        this.nvim.command(`sign place ${lnum} line=${lnum} name=CocBookmark group=coc-bookmark buffer=${bufnr}`, true)
      }
    }
  }

  public async clear(all: boolean): Promise<void> {
    if (all) {
      await this.db.clear()
    } else {
      await this.getDocInfo()
      await this.db.push(`${encode(this.filepath)}`, {})
    }
    await this.refresh()
    this.onChanged()
  }

  private onChanged(): void {
    this.nvim.command('doautocmd User CocBookmarkChange', true)
  }
}

export function encode(filepath: string): string {
  return encodeURIComponent(filepath).replace(/\./g, '%2E')
}

export function decode(text: string): string {
  // dont need to replace "%2E" by "."
  return decodeURIComponent(text)
}

export interface BookmarkItem {
  line: string
  filetype: string
  annotation?: string
}

// bookmark data structure in bookmark.json
/*
 * {
 *   file1: {
 *       line1: BookmarkData,
 *       line2: BookmarkData
 *     },
 *   file1: {
 *     line1: BookmarkData,
 *     line2: BookmarkData
 *   }
 * }
 */
