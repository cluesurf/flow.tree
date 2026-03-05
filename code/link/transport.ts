/**
 * LSP transport layer: Content-Length framed JSON-RPC over stdio.
 */

const HEADER_DELIMITER = '\r\n\r\n'
const CONTENT_LENGTH = 'Content-Length: '

export type Message = {
  jsonrpc: '2.0'
  id?: number | string
  method?: string
  params?: unknown
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

export type MessageHandler = (msg: Message) => void

/**
 * Reads Content-Length framed messages from a readable stream.
 * Calls handler for each complete message.
 */
export function createReader(input: {
  stream: NodeJS.ReadableStream
  handler: MessageHandler
}): void {
  const { stream, handler } = input
  let buffer = ''
  let contentLength = -1

  stream.setEncoding('utf-8')
  stream.on('data', (chunk: string) => {
    buffer += chunk

    while (true) {
      if (contentLength === -1) {
        const headerEnd = buffer.indexOf(HEADER_DELIMITER)
        if (headerEnd === -1) break

        const header = buffer.slice(0, headerEnd)
        const match = header.match(/Content-Length:\s*(\d+)/)
        if (!match) {
          buffer = buffer.slice(headerEnd + HEADER_DELIMITER.length)
          continue
        }

        contentLength = parseInt(match[1]!, 10)
        buffer = buffer.slice(headerEnd + HEADER_DELIMITER.length)
      }

      if (buffer.length < contentLength) break

      const body = buffer.slice(0, contentLength)
      buffer = buffer.slice(contentLength)
      contentLength = -1

      try {
        const msg = JSON.parse(body) as Message
        handler(msg)
      } catch {
        // Malformed JSON, skip
      }
    }
  })
}

/**
 * Writes a Content-Length framed message to a writable stream.
 */
export function writeMessage(input: {
  stream: NodeJS.WritableStream
  msg: Message
}): void {
  const { stream, msg } = input
  const body = JSON.stringify(msg)
  const header = `${CONTENT_LENGTH}${Buffer.byteLength(body)}${HEADER_DELIMITER}`
  stream.write(header)
  stream.write(body)
}
