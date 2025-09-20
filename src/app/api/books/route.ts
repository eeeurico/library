import { NextResponse } from "next/server"
import { getBooks } from "@/lib/sheets"

export async function GET() {
  const books = await getBooks(process.env.SHEET_ID!)
  return NextResponse.json(books)
}
