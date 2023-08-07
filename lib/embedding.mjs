import { Collection, SimpleStorage } from '@kessler/embedding'
import { homedir } from 'node:os'
import path from 'node:path'
import { mkdirp } from 'mkdirp'

export default async function initEmbedding(openai) {

  const collectionDirectory = path.join(homedir(), '.kessler-assist', 'collections')
  await mkdirp(collectionDirectory)

  function add(collectionName, text, metadata) {
    const collection = _createCollection(collectionName)
    return collection.add(text, metadata)
  }

  function query(collectionName, text, { maxResults, threshold } = {}) {
    const collection = _createCollection(collectionName)
    return collection.query(text, { maxResults, threshold })
  }

  function delete(collectionName, id) {
    const collection = _createCollection(collectionName)
    return collection.delete(id)
  }

  function _createCollection(collectionName) {
    const filename = path.join(collectionDirectory, `${collectionName}.json`)
    const storage = new SimpleStorage({ filename })
    return new Collection(openai.embedder, storage)
  }

  return { add, query }
}