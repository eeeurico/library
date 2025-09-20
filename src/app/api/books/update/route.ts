import { NextRequest, NextResponse } from "next/server"
import { updateBook } from "@/lib/sheets"

export async function PUT(request: NextRequest) {
  try {
    const requestData = await request.json()
    console.log("Update request data:", requestData)

    const { rowIndex, ...bookData } = requestData

    if (typeof rowIndex !== "number") {
      console.error("Invalid rowIndex:", rowIndex)
      return NextResponse.json(
        { error: "Row index is required" },
        { status: 400 }
      )
    }

    const sheetId = process.env.SHEET_ID
    if (!sheetId) {
      console.error("SHEET_ID environment variable not configured")
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

    console.log("Updating sheet with values:", values)
    console.log("Row index:", rowIndex)

    await updateBook(sheetId, rowIndex, values)

    console.log("Book updated successfully")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating book:", error)
    return NextResponse.json(
      {
        error: "Failed to update book",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
