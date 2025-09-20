import { NextResponse } from "next/server"
import { getBooks } from "@/lib/sheets"

export async function GET() {
  try {
    const books = await getBooks(process.env.SHEET_ID!)

    // For now, we'll show all books. In the future, you can add authentication
    // logic here to filter out books with notforsale = true for unauthenticated users

    // Convert string "TRUE"/"FALSE" to boolean for notforsale field
    const processedBooks = books.map((book) => ({
      ...book,
      notforsale:
        (book as any).notforsale === "TRUE" ||
        (book as any).notforsale === true,
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
