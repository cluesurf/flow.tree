const path = require('path')
const { workspace, window } = require('vscode')
const { LanguageClient, TransportKind } = require('vscode-languageclient/node')

let client

function activate(context) {
  const serverModule = path.join(__dirname, '..', 'host', 'host', 'main.js')

  const serverOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.stdio,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.stdio,
    },
  }

  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: 'tree' }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.tree'),
    },
  }

  client = new LanguageClient(
    'seedLanguageServer',
    'Seed Language Server',
    serverOptions,
    clientOptions,
  )

  client.start()
}

function deactivate() {
  if (client) {
    return client.stop()
  }
}

module.exports = { activate, deactivate }
