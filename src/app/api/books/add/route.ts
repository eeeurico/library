import { NextResponse } from "next/server"
import { addBook } from "@/lib/sheets"

export async function POST(req: Request) {
  try {
    const bookData = await req.json()

    // Handle both old format (values array) and new format (book object)
    let values: any[]

    if (bookData.values) {
      // Old format
      values = bookData.values
    } else {
      // New format - convert book object to values array
      // Order matches your Google Sheet headers: id, isbn, title, author, type, publisher, year, edition, coverUrl, notes, price, url, language, sellingprice, notforsale
      values = [
        "", // ID (auto-generated or empty)
        bookData.isbn || "",
        bookData.title || "",
        bookData.author || "",
        bookData.type || "book",
        bookData.publisher || "",
        bookData.year || "",
        bookData.edition || "",
        bookData.coverUrl || "",
        bookData.notes || "",
        bookData.price || "",
        bookData.url || "",
        bookData.language || "",
        bookData.sellingprice || "",
        bookData.notforsale ? "TRUE" : "FALSE",
      ]
    }

    await addBook(process.env.SHEET_ID!, values)

    return NextResponse.json({
      success: true,
      message: "Book added successfully",
    })
  } catch (error) {
    console.error("Error adding book:", error)
    return NextResponse.json(
      { error: "Failed to add book to library" },
      { status: 500 }
    )
  }
}
