import { describe, expect, it } from 'vitest'
import { extractCardExcerptFromPng } from './sillyTavernCard.js'

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])

describe('extractCardExcerptFromPng', () => {
  it('returns null for non-PNG input', async () => {
    expect(await extractCardExcerptFromPng(new Blob(['not a png']))).toBeNull()
  })

  it('extracts a synthetic character-card payload without external content', async () => {
    const payload = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: 'Synthetic Character',
        creator: 'Test Suite',
        character_version: '1.0',
        description: 'Synthetic description',
        alternate_greetings: ['One', 'Two'],
        character_book: { entries: [{}, {}] },
      },
    }
    const encoded = window.btoa(JSON.stringify(payload))
    const png = makeTextChunkPng('chara', encoded)

    await expect(extractCardExcerptFromPng(new Blob([png]))).resolves.toMatchObject({
      spec: 'chara_card_v3',
      name: 'Synthetic Character',
      creator: 'Test Suite',
      alternateGreetingCount: 2,
      worldBookEntryCount: 2,
    })
  })
})

function makeTextChunkPng(key, value) {
  const encoder = new TextEncoder()
  const data = encoder.encode(`${key}\0${value}`)
  const chunk = new Uint8Array(12 + data.length)
  const view = new DataView(chunk.buffer)

  view.setUint32(0, data.length)
  chunk.set(encoder.encode('tEXt'), 4)
  chunk.set(data, 8)

  const png = new Uint8Array(PNG_SIGNATURE.length + chunk.length)
  png.set(PNG_SIGNATURE)
  png.set(chunk, PNG_SIGNATURE.length)
  return png
}
