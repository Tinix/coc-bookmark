import {
  ListAction,
  ListContext,
  ListItem,
  BasicList,
  Neovim,
  Uri,
  workspace,
} from 'coc.nvim'
import { Position } from 'vscode-languageserver-protocol'
import BookmarkDB from '../util/db'
import { decode, encode, BookmarkItem } from '../commands'
import { fsStat } from '../util/fs'

export default class BookmarkList extends BasicList {
  public readonly name = 'bookmark'
  public readonly description = 'list of bookmarks'
  public readonly defaultAction = 'open'
  public actions: ListAction[] = []

  constructor(protected nvim: Neovim, private db: BookmarkDB) {
    super(nvim)

    this.addLocationActions()

    this.addAction('open', async (item: ListItem) => {
      const { filepath, lnum } = item.data
      const pos = Position.create(lnum - 1, 0)
      await workspace.jumpTo(Uri.file(filepath).toString(), pos)
    })

    this.addAction('delete', async (item: ListItem) => {
      const { filepath, lnum } = item.data
      await this.db.delete(`${encode(filepath)}.${lnum}`)
    }, { persist: true, reload: true })
  }

  public async loadItems(_context: ListContext): Promise<ListItem[]> {
    let items: ListItem[] = []
    const data = await this.db.load() as Object
    for (let [filepath, bookmarks] of Object.entries(data)) {
      filepath = decode(filepath)
      const stat = await fsStat(filepath)
      if (!(stat && stat.isFile())) {
        await this.db.delete(`${encode(filepath)}`)
        continue
      }
      for (const lnum of Object.keys(bookmarks).sort((l1, l2) => Number(l1) - Number(l2))) {
        const bookmark: BookmarkItem = bookmarks[lnum]
        items.push({
          label: `${filepath} line: ${lnum} \t ${bookmark.annotation ? bookmark.annotation : ''}`,
          filterText: (bookmark.annotation ? bookmark.annotation : '') + filepath,
          data: Object.assign({}, { filepath, bookmark, lnum }),
          location: {
            uri: Uri.file(filepath).toString(),
            range: {
              start: { line: Number(lnum) - 1, character: 0 },
              end: { line: Number(lnum) - 1, character: 0 },
            }
          }
        })
      }
    }
    return items
  }

  public doHighlight(): void {
    let { nvim } = this
    nvim.pauseNotification()
    nvim.command('syntax match CocBookmarkLineNumber /line: \\d\\+/', true)
    nvim.command('syntax match CocBookmarkAnnotation /\\t.*$/', true)
    nvim.command('syntax match CocBookmarkFilePath /^.\\{-}\\t/ contains=CocBookmarkLineNumber,CocBookmarkAnnotation', true)
    nvim.command('hi def link CocBookmarkLineNumber Special', true)
    nvim.command('hi def link CocBookmarkAnnotation Comment', true)
    nvim.command('hi def link CocBookmarkFilePath String', true)
    nvim.resumeNotification().catch(_e => {
      // nop
    })
  }
}
