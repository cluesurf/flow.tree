const path = require('path')
const { workspace, window, commands } = require('vscode')
const { LanguageClient, TransportKind } = require('vscode-languageclient/node')
const { exec } = require('child_process')

let client
let outputChannel

function activate(context) {
  const serverModule = path.join(__dirname, '..', 'host', 'host', 'main.js')

  outputChannel = window.createOutputChannel('Seed Benchmarks')

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

  // Benchmark commands
  context.subscriptions.push(
    commands.registerCommand('seed.runTime', (name) => {
      runSeedCommand(`seed time ${name} --json`, 'Benchmark', (stdout) => {
        try {
          const data = JSON.parse(stdout)
          if (data.benchmarks && client) {
            client.sendNotification('seed/timeResults', {
              results: data.benchmarks,
            })
          }
        } catch {
          // JSON parse failed, show raw output
        }
      })
    }),

    commands.registerCommand('seed.runAllTime', () => {
      runSeedCommand('seed time --json', 'All Benchmarks', (stdout) => {
        try {
          const data = JSON.parse(stdout)
          if (data.benchmarks && client) {
            client.sendNotification('seed/timeResults', {
              results: data.benchmarks,
            })
          }
        } catch {
          // JSON parse failed
        }
      })
    }),

    commands.registerCommand('seed.profileTime', (name) => {
      runSeedCommand(`seed profile cpu --time --top 10 ${name || ''}`, 'Profile')
    }),

    commands.registerCommand('seed.compareTime', () => {
      window.showInputBox({ prompt: 'Baseline name to compare against' }).then((baseline) => {
        if (baseline) {
          runSeedCommand(`seed time --compare ${baseline}`, 'Compare')
        }
      })
    }),
  )
}

function runSeedCommand(cmd, label, onSuccess) {
  const cwd = workspace.workspaceFolders?.[0]?.uri?.fsPath
  if (!cwd) {
    window.showErrorMessage('No workspace folder open')
    return
  }

  outputChannel.clear()
  outputChannel.show()
  outputChannel.appendLine(`Running: ${cmd}`)
  outputChannel.appendLine('')

  exec(cmd, { cwd }, (err, stdout, stderr) => {
    if (stderr) outputChannel.appendLine(stderr)
    if (stdout) outputChannel.appendLine(stdout)
    if (err) {
      outputChannel.appendLine(`${label} failed with code ${err.code}`)
    } else {
      outputChannel.appendLine(`${label} complete.`)
      if (onSuccess) onSuccess(stdout)
    }
  })
}

function deactivate() {
  if (client) {
    return client.stop()
  }
}

module.exports = { activate, deactivate }
