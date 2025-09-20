import { NextRequest, NextResponse } from "next/server"
import { updateBook } from "@/lib/sheets"

export async function PUT(request: NextRequest) {
  try {
    const { rowIndex, ...bookData } = await request.json()

    if (typeof rowIndex !== "number") {
      return NextResponse.json(
        { error: "Row index is required" },
        { status: 400 }
      )
    }

    const sheetId = process.env.GOOGLE_SHEET_ID
    if (!sheetId) {
      return NextResponse.json(
        { error: "Google Sheet ID not configured" },
        { status: 500 }
      )
    }

    // Convert book data to array format matching sheet columns (A:O)
    const values = [
      bookData.id || "",
      bookData.isbn || "",
      bookData.title || "",
      bookData.author || "",
      bookData.type || "",
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

    await updateBook(sheetId, rowIndex, values)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating book:", error)
    return NextResponse.json(
      { error: "Failed to update book" },
      { status: 500 }
    )
  }
}
