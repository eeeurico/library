import { NextResponse } from "next/server"
import { deleteBook } from "@/lib/sheets"

export async function POST(req: Request) {
  const { rowIndex } = await req.json()
  await deleteBook(process.env.SHEET_ID!, rowIndex)
  return NextResponse.json({ success: true })
}
