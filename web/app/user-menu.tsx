'use client'

import { useState, useRef, useEffect } from 'react'

interface UserMenuProps {
  username: string
}

export default function UserMenu({ username }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-menu-trigger" onClick={() => setOpen(!open)}>
        <img
          src={`https://github.com/${username}.png?size=64`}
          alt={username}
          width={28}
          height={28}
          className="user-menu-avatar"
        />
      </button>
      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">@{username}</div>
          <a href={`/u/${username}`} className="user-menu-item">Profile</a>
          <a href="/settings" className="user-menu-item">Settings</a>
          <form action="/api/auth/logout" method="post" style={{ margin: 0 }}>
            <button type="submit" className="user-menu-item" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit', padding: '8px 16px' }}>Logout</button>
          </form>
        </div>
      )}
    </div>
  )
}
