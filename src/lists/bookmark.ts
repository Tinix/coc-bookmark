import {
  ListAction,
  ListContext,
  ListItem,
  BasicList,
  Neovim,
  Uri,
  workspace,
} from 'coc.nvim'
import colors from 'colors/safe'
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
      if (!(stat?.isFile())) {
        await this.db.delete(`${encode(filepath)}`)
        continue
      }
      for (const lnum of Object.keys(bookmarks).sort((l1, l2) => Number(l1) - Number(l2))) {
        const bookmark: BookmarkItem = bookmarks[lnum]
        items.push({
          label: `${colors.yellow(filepath)} line: ${lnum} ${bookmark.annotation ? colors.gray(bookmark.annotation) : ''}`,
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
}
