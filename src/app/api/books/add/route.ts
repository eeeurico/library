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
      // Adjust this array order to match your Google Sheet columns
      values = [
        "", // ID (auto-generated or empty)
        bookData.isbn || "",
        bookData.title || "",
        bookData.author || "",
        bookData.type || "book",
        bookData.publisher || "",
        bookData.year || "",
        bookData.coverUrl || "",
        bookData.notes || "",
        bookData.price || "",
        bookData.status || "available",
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
