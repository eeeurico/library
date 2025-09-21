import { NextResponse } from "next/server"
import { deleteBookById } from "@/lib/sheets"

export async function POST(req: Request) {
  const { id } = await req.json()

  if (!id) {
    return NextResponse.json({ error: "Book ID is required" }, { status: 400 })
  }

  try {
    await deleteBookById(process.env.SHEET_ID!, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json(
      { error: "Failed to delete book" },
      { status: 500 }
    )
  }
}
