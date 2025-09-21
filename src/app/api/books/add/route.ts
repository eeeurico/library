import { NextResponse } from "next/server"
import { addBookWithId } from "@/lib/sheets"

export async function POST(req: Request) {
  try {
    const bookData = await req.json()

    // Use the new addBookWithId function directly with book object
    const bookWithId = await addBookWithId(process.env.SHEET_ID!, bookData)

    return NextResponse.json({
      success: true,
      message: "Book added successfully",
      book: bookWithId,
    })
  } catch (error) {
    console.error("Error adding book:", error)
    return NextResponse.json(
      { error: "Failed to add book to library" },
      { status: 500 }
    )
  }
}
