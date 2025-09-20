import { NextResponse } from "next/server"
import { addBook } from "@/lib/sheets"

export async function POST(req: Request) {
  const { values } = await req.json()
  await addBook(process.env.SHEET_ID!, values)
  return NextResponse.json({ success: true })
}
