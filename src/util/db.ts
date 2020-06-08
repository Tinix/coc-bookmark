import { statAsync, writeFile, readFile } from './io'
import path from 'path'
import { BookmarkItem, BookmarkItemDB } from '../types'

export default class DB {
  private file: string

  constructor(
    directory: string,
    name: string,
    private maxsize: number
  ) {
    this.file = path.join(directory, `${name}.json`)
  }

  public async load(): Promise<BookmarkItemDB> {
    const stat = await statAsync(this.file)
    if (!stat || !stat.isFile()) return new Map()
    const content = await readFile(this.file)
    const map: BookmarkItemDB = new Map(JSON.parse(content))
    for (let p of map.keys()) {
      const s = await statAsync(p)
      if (!s || !s.isFile()) {
        map.delete(p)
      }
    }

    return map as BookmarkItemDB
  }

  public async add(data: BookmarkItem, path: string): Promise<void> {
    let items = await this.load()
    if (items.size == this.maxsize) {
      items.delete([...items][0][0]) // TODO
    }

    let bookmarks = items.get(path) || []
    bookmarks = bookmarks.filter(d => d.lnum != data.lnum)
    bookmarks.push(data)
    items.set(path, bookmarks)
    await writeFile(this.file, JSON.stringify([...items], null, 2))
  }

  // if no `lnum`, delete all bookmarks of the `path`
  public async delete(path: string, lnum?: number): Promise<void> {
    const items = await this.load()
    let bookmarks = items.get(path)
    if (bookmarks) {
      if (lnum != undefined) {
        bookmarks = bookmarks.filter(b => b.lnum != lnum)
        if (bookmarks.length === 0) {   // no bookmarks in this path
          items.delete(path)
        }
        else {
          items.set(path, bookmarks)
        }
      } else {
        items.delete(path)
      }
      await writeFile(this.file, JSON.stringify([...items], null, 2))
    }
  }

  public async clear(): Promise<void> {
    await writeFile(this.file, JSON.stringify([], null, 2))
  }
}
