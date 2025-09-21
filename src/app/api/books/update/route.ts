import { NextRequest, NextResponse } from "next/server"
import { updateBookById } from "@/lib/sheets"

export async function PUT(request: NextRequest) {
  try {
    const bookData = await request.json()
    console.log("Update request data:", bookData)

    // Validate that we have an ID
    if (!bookData.id) {
      console.error("Missing book ID")
      return NextResponse.json(
        { error: "Book ID is required" },
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

    console.log("Updating book with ID:", bookData.id)

    await updateBookById(sheetId, bookData.id, bookData)

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
