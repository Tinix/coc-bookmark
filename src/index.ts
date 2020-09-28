import {
  commands,
  ExtensionContext,
  listManager,
  workspace,
  events
} from 'coc.nvim'
import { fsStat, fsMkdir } from './util/fs'
import BookmarkList from './lists/bookmark'
import Bookmark from './commands'
import path from 'path'
import BookmarkDB from './util/db'

export async function activate(context: ExtensionContext): Promise<void> {
  const config = workspace.getConfiguration('bookmark')

  const { subscriptions, storagePath } = context
  const { nvim } = workspace

  const db = new BookmarkDB(path.join(storagePath, 'bookmark.json'))
  const bookmark = new Bookmark(nvim, db)

  const stat = await fsStat(storagePath)
  if (!(stat?.isDirectory())) {
    await fsMkdir(storagePath)
  }

  const sign = config.get<string>('sign', '🔖')
  const signHl = config.get<string>('signHl', 'Tag')
  if (sign != '') {
    nvim.command(`hi link CocBookmarkSign ${signHl}`, true)
    nvim.command(`sign define CocBookmark text=${sign} texthl=CocBookmarkSign`, true)
  }

  events.on('BufEnter', async () => {
    await bookmark.refresh()
  }, null, subscriptions)

  // TODO: update bookmark if current buffer gets modified
  // bookmark might be removed, or updated with **new line number**
  // But coc's api does not supply sufficient info to detect which line was
  // added(i.e. press key "o", to add one line, but we can not get it from the api, can we???)

  // workspace.onDidChangeTextDocument(async e => {
  //   workspace.showMessage(JSON.stringify(e.contentChanges))
  //   await bookmark.update()
  // }, null, subscriptions)

  subscriptions.push(
    workspace.registerKeymap(
      ['n'],
      'bookmark-toggle',
      async () => await bookmark.toggle(),
      { sync: false }
    ))

  subscriptions.push(
    workspace.registerKeymap(
      ['n'],
      'bookmark-annotate',
      async () => await bookmark.annotate(),
      { sync: false }
    ))

  subscriptions.push(
    workspace.registerKeymap(
      ['n'],
      'bookmark-next',
      async () => await bookmark.jumpTo('next'),
      { sync: false }
    ))

  subscriptions.push(
    workspace.registerKeymap(
      ['n'],
      'bookmark-prev',
      async () => await bookmark.jumpTo('prev'),
      { sync: false }
    ))

  subscriptions.push(
    commands.registerCommand(
      'bookmark.toggle',
      async () => await bookmark.toggle()
    )
  )

  subscriptions.push(
    commands.registerCommand(
      'bookmark.annotate',
      async () => await bookmark.annotate()
    )
  )

  subscriptions.push(
    commands.registerCommand(
      'bookmark.prev',
      async () => await bookmark.jumpTo('prev')
    )
  )

  subscriptions.push(
    commands.registerCommand(
      'bookmark.next',
      async () => await bookmark.jumpTo('next')
    )
  )

  subscriptions.push(
    commands.registerCommand(
      'bookmark.clearForCurrentFile',
      async () => await bookmark.clear(false)
    )
  )

  subscriptions.push(
    commands.registerCommand(
      'bookmark.clearForAllFiles',
      async () => await bookmark.clear(true)
    )
  )

  subscriptions.push(
    listManager.registerList(
      new BookmarkList(nvim, db)
    )
  )
}
