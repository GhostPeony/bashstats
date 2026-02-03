import http from 'http'
import crypto from 'crypto'
import { exec } from 'child_process'
import { saveAuth } from '../upload/uploader.js'
import * as readline from 'readline'

const CLI_PORT = 17901
const BASE_URL = 'https://bashstats.com'

function openBrowser(url: string): void {
  const platform = process.platform
  let command: string

  if (platform === 'win32') {
    command = `start "" "${url}"`
  } else if (platform === 'darwin') {
    command = `open "${url}"`
  } else {
    command = `xdg-open "${url}"`
  }

  exec(command, () => {})
}

export async function runLogin(): Promise<void> {
  const stateParam = crypto.randomBytes(16).toString('hex')

  console.log('Logging in to bashstats.com...')
  console.log('')

  const result = await new Promise<{ token: string; username: string } | null>((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${CLI_PORT}`)

      if (url.pathname === '/callback') {
        const token = url.searchParams.get('token')
        const username = url.searchParams.get('username')
        const returnedState = url.searchParams.get('state')

        if (returnedState !== stateParam) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end('<h1>State mismatch. Please try again.</h1>')
          resolve(null)
          server.close()
          return
        }

        if (token && username) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(`
            <html><body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #FFF8F0;">
              <div style="text-align: center;">
                <h1 style="color: #1B2A4A;">Logged in to bashstats!</h1>
                <p style="color: #5A6B8A;">You can close this tab and return to your terminal.</p>
              </div>
            </body></html>
          `)
          resolve({ token, username })
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end('<h1>Login failed. Missing token.</h1>')
          resolve(null)
        }

        server.close()
        return
      }

      res.writeHead(404)
      res.end()
    })

    server.listen(CLI_PORT, '127.0.0.1', () => {
      const callbackUrl = `http://127.0.0.1:${CLI_PORT}/callback`
      const authUrl = `${BASE_URL}/api/auth/github?cli_callback=${encodeURIComponent(callbackUrl)}&state=${stateParam}`

      console.log('Opening browser for GitHub sign-in...')
      console.log('')
      console.log(`If the browser doesn't open, visit:`)
      console.log(authUrl)
      console.log('')

      openBrowser(authUrl)
    })

    // Timeout after 120 seconds
    setTimeout(() => {
      server.close()
      resolve(null)
    }, 120000)
  })

  if (result) {
    saveAuth({ api_token: result.token, username: result.username })
    console.log(`Logged in as ${result.username}`)
    console.log('Your stats will auto-sync after each session.')
    console.log(`Profile: ${BASE_URL}/u/${result.username}`)
    return
  }

  // Fallback: prompt to paste token
  console.log('Browser login timed out.')
  console.log('')
  console.log(`Visit ${BASE_URL}/token to get your API token, then paste it below.`)
  console.log('')

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  const token = await new Promise<string>((resolve) => {
    rl.question('API token: ', (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })

  if (!token) {
    console.log('No token provided. Login cancelled.')
    return
  }

  // Validate token by calling /api/auth/me
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })

    if (res.ok) {
      const data = await res.json() as { username: string }
      saveAuth({ api_token: token, username: data.username })
      console.log(`Logged in as ${data.username}`)
      console.log(`Profile: ${BASE_URL}/u/${data.username}`)
    } else {
      console.log('Invalid token. Login failed.')
    }
  } catch {
    console.log('Could not reach bashstats.com. Check your connection.')
  }
}
