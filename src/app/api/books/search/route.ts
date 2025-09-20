import { NextRequest, NextResponse } from "next/server"
import { searchBooks } from "@/lib/sheets"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")
    const type =
      (searchParams.get("type") as "title" | "author" | "isbn" | "general") ||
      "general"
    const source =
      (searchParams.get("source") as "google" | "openlibrary" | "all") ||
      "google"

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    const results = await searchBooks(query, type, source)

    return NextResponse.json({ results, count: results.length })
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json(
      { error: "Failed to search books" },
      { status: 500 }
    )
  }
}
