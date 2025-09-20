import { NextResponse } from "next/server"
import { fetchBookPrice } from "@/lib/sheets"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const isbn = searchParams.get('isbn')
    const title = searchParams.get('title')

    if (!isbn || !title) {
      return NextResponse.json(
        { error: "ISBN and title are required" },
        { status: 400 }
      )
    }

    const price = await fetchBookPrice(isbn, title)

    return NextResponse.json({
      success: true,
      price: price,
    })
  } catch (error) {
    console.error("Error fetching book price:", error)
    return NextResponse.json(
      { error: "Failed to fetch book price" },
      { status: 500 }
    )
  }
}