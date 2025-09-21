import { NextResponse } from "next/server"
import { getBooks } from "@/lib/sheets"

type Book = {
  id?: string
  isbn?: string | null
  title?: string | null
  author?: string | null
  type?: string | null
  coverUrl?: string | null
  notes?: string | null
  price?: string | null
  publisher?: string | null
  year?: string | null
  url?: string | null
  edition?: string | null
  language?: string | null
  sellingprice?: string | null
  forsale?: boolean | string | null
}

export async function GET() {
  try {
    const books = await getBooks(process.env.SHEET_ID!)

    // For now, we'll show all books. In the future, you can add authentication
    // logic here to filter out books with forsale = false for unauthenticated users

    // Convert string "TRUE"/"FALSE" to boolean for forsale field
    const processedBooks = books.map((book: Book) => ({
      ...book,
      forsale:
        book.forsale === "TRUE" ||
        book.forsale === true ||
        book.forsale === undefined, // Default to true if not set
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
