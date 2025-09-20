import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { password } = await req.json()

    // Check password against environment variable
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword) {
      return NextResponse.json(
        { error: "Admin password not configured" },
        { status: 500 }
      )
    }

    if (password === adminPassword) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 })
    }
  } catch (error) {
    console.error("Auth error:", error)
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    )
  }
}
