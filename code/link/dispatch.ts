/**
 * JSON-RPC method dispatcher.
 *
 * Routes incoming LSP messages to registered handlers.
 */

import type { Message } from '@/link/transport'
import { writeMessage } from '@/link/transport'

export type RequestHandler = (params: any) => unknown | Promise<unknown>
export type NotificationHandler = (params: any) => void

export type Dispatcher = {
  onRequest(method: string, handler: RequestHandler): void
  onNotification(method: string, handler: NotificationHandler): void
  handle(msg: Message): void
  sendNotification(method: string, params: unknown): void
  sendRequest(method: string, params: unknown): void
}

export function createDispatcher(input: {
  output: NodeJS.WritableStream
}): Dispatcher {
  const { output } = input
  const requests = new Map<string, RequestHandler>()
  const notifications = new Map<string, NotificationHandler>()
  let nextId = 1

  function sendResponse(id: number | string, result: unknown): void {
    writeMessage({
      stream: output,
      msg: { jsonrpc: '2.0', id, result },
    })
  }

  function sendError(id: number | string, code: number, message: string): void {
    writeMessage({
      stream: output,
      msg: { jsonrpc: '2.0', id, error: { code, message } },
    })
  }

  return {
    onRequest(method, handler) {
      requests.set(method, handler)
    },

    onNotification(method, handler) {
      notifications.set(method, handler)
    },

    handle(msg) {
      if (msg.id !== undefined && msg.method) {
        // Request
        const handler = requests.get(msg.method)
        if (!handler) {
          sendError(msg.id, -32601, `Method not found: ${msg.method}`)
          return
        }
        try {
          const result = handler(msg.params)
          if (result instanceof Promise) {
            result
              .then(r => sendResponse(msg.id!, r))
              .catch(e => sendError(msg.id!, -32603, String(e)))
          } else {
            sendResponse(msg.id, result)
          }
        } catch (e) {
          sendError(msg.id, -32603, String(e))
        }
      } else if (msg.method) {
        // Notification
        const handler = notifications.get(msg.method)
        if (handler) {
          try {
            handler(msg.params)
          } catch {
            // Notifications don't get error responses
          }
        }
      }
    },

    sendNotification(method, params) {
      writeMessage({
        stream: output,
        msg: { jsonrpc: '2.0', method, params },
      })
    },

    sendRequest(method, params) {
      const id = nextId++
      writeMessage({
        stream: output,
        msg: { jsonrpc: '2.0', id, method, params },
      })
    },
  }
}
