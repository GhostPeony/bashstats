import { deleteAuth, getAuth } from '../upload/uploader.js'

export function runLogout(): void {
  const auth = getAuth()

  if (!auth) {
    console.log('Not logged in.')
    return
  }

  const deleted = deleteAuth()
  if (deleted) {
    console.log(`Logged out (was ${auth.username}).`)
  } else {
    console.log('Failed to delete auth file.')
  }
}
