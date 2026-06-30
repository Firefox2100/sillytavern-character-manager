const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const TEXT_DECODER = new TextDecoder('latin1')
const JSON_DECODER = new TextDecoder('utf-8')

export async function extractCardExcerptFromPng(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())

  if (!isPng(bytes)) {
    return null
  }

  const textChunks = readTextChunks(bytes)
  const payload = textChunks.chara ?? textChunks.ccv3

  if (!payload) {
    return null
  }

  const card = JSON.parse(decodeBase64Json(payload))
  const data = card.data ?? {}

  return {
    spec: card.spec,
    specVersion: card.spec_version,
    name: data.name ?? '',
    creator: data.creator ?? '',
    characterVersion: data.character_version ?? '',
    definition: data.description ?? '',
    personality: data.personality ?? '',
    scenario: data.scenario ?? '',
    firstMessage: data.first_mes ?? '',
    exampleMessages: data.mes_example ?? '',
    alternateGreetingCount: Array.isArray(data.alternate_greetings)
      ? data.alternate_greetings.length
      : 0,
    worldBookEntryCount: Array.isArray(data.character_book?.entries)
      ? data.character_book.entries.length
      : 0,
  }
}

function isPng(bytes) {
  return PNG_SIGNATURE.every((value, index) => bytes[index] === value)
}

function readTextChunks(bytes) {
  const chunks = {}
  let offset = PNG_SIGNATURE.length

  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset)
    const type = TEXT_DECODER.decode(bytes.slice(offset + 4, offset + 8))
    const dataStart = offset + 8
    const dataEnd = dataStart + length

    if (dataEnd > bytes.length) {
      break
    }

    if (type === 'tEXt') {
      const data = bytes.slice(dataStart, dataEnd)
      const separatorIndex = data.indexOf(0)

      if (separatorIndex > -1) {
        const key = TEXT_DECODER.decode(data.slice(0, separatorIndex))
        const value = TEXT_DECODER.decode(data.slice(separatorIndex + 1))
        chunks[key] = value
      }
    }

    offset = dataEnd + 4
  }

  return chunks
}

function readUint32(bytes, offset) {
  return (
    bytes[offset] * 2 ** 24 +
    bytes[offset + 1] * 2 ** 16 +
    bytes[offset + 2] * 2 ** 8 +
    bytes[offset + 3]
  )
}

function decodeBase64Json(value) {
  const binaryString = window.atob(value)
  const bytes = Uint8Array.from(binaryString, (character) =>
    character.charCodeAt(0),
  )

  return JSON_DECODER.decode(bytes)
}
