import { utapi } from "@/lib/uploadthing-server"

// Function to download an image from a URL and return as a File object
async function downloadImageAsFile(
  imageUrl: string,
  fileName?: string
): Promise<File | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`)
    }

    const contentType = response.headers.get("content-type")
    if (!contentType?.startsWith("image/")) {
      throw new Error("URL does not point to a valid image")
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate filename if not provided
    const extension = contentType.split("/")[1] || "jpg"
    const name = fileName || `cover-${Date.now()}.${extension}`

    // Create File object
    const file = new File([buffer], name, { type: contentType })

    return file
  } catch (error) {
    console.error("Error downloading image:", error)
    return null
  }
}

// Function to upload an image from URL to UploadThing
export async function uploadImageFromUrl(
  imageUrl: string,
  fileName?: string
): Promise<string | null> {
  try {
    // Download the image as a File
    const file = await downloadImageAsFile(imageUrl, fileName)
    if (!file) {
      return null
    }

    // Upload to UploadThing
    const uploadResult = await utapi.uploadFiles([file])

    if (uploadResult && uploadResult.length > 0 && uploadResult[0].data) {
      return uploadResult[0].data.url
    }

    return null
  } catch (error) {
    console.error("Error uploading image to UploadThing:", error)
    return null
  }
}

// Function to try multiple image URLs and upload the first successful one
export async function uploadBestAvailableImage(
  imageUrls: string[],
  bookInfo?: { isbn?: string; title?: string; author?: string }
): Promise<string | null> {
  for (const imageUrl of imageUrls) {
    try {
      // Generate a meaningful filename
      const fileName = bookInfo?.isbn
        ? `cover-${bookInfo.isbn}.jpg`
        : bookInfo?.title
        ? `cover-${bookInfo.title
            .replace(/[^a-zA-Z0-9]/g, "-")
            .substring(0, 50)}.jpg`
        : undefined

      const uploadedUrl = await uploadImageFromUrl(imageUrl, fileName)
      if (uploadedUrl) {
        console.log(`Successfully uploaded cover image from: ${imageUrl}`)
        return uploadedUrl
      }
    } catch (error) {
      console.log(`Failed to upload from ${imageUrl}, trying next...`)
      continue
    }
  }

  console.log("No images could be uploaded from the provided URLs")
  return null
}
