import { NextResponse } from "next/server"
import { getBooks } from "@/lib/sheets"

export async function GET() {
  try {
    const books = await getBooks(process.env.SHEET_ID!)

    // For now, we'll show all books. In the future, you can add authentication
    // logic here to filter out books with forsale = false for unauthenticated users

    // Convert string "TRUE"/"FALSE" to boolean for forsale field
    const processedBooks = books.map((book) => ({
      ...book,
      forsale:
        (book as any).forsale === "TRUE" ||
        (book as any).forsale === true ||
        (book as any).forsale === undefined, // Default to true if not set
    }))

    return NextResponse.json(processedBooks)
  } catch (error) {
    console.error("Error fetching books:", error)
    return NextResponse.json(
      { error: "Failed to fetch books" },
      { status: 500 }
    )
  }
}
