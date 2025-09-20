"use client"
import { createContext, useContext, useState, useEffect } from "react"

interface AuthContextType {
  isAuthenticated: boolean
  login: (password: string) => Promise<boolean>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Check if user is already authenticated on load
  useEffect(() => {
    const authStatus = localStorage.getItem("bookLibrary_auth")
    if (authStatus === "authenticated") {
      setIsAuthenticated(true)
    }
    setIsLoading(false)
  }, [])

  const login = async (password: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      })

      if (response.ok) {
        setIsAuthenticated(true)
        localStorage.setItem("bookLibrary_auth", "authenticated")
        return true
      } else {
        return false
      }
    } catch (error) {
      console.error("Login error:", error)
      return false
    }
  }

  const logout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem("bookLibrary_auth")
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
