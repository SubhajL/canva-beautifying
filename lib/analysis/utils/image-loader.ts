export class ImageLoader {
  static async loadImageFromUrl(url: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }
        
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, img.width, img.height)
        resolve(imageData)
      }
      
      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }
      
      img.src = url
    })
  }

  static async loadImageFromBlob(blob: Blob): Promise<ImageData> {
    const url = URL.createObjectURL(blob)
    try {
      return await this.loadImageFromUrl(url)
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  static async loadImageFromFile(file: File): Promise<ImageData> {
    return this.loadImageFromBlob(file)
  }

  // Server-side image loading using sharp
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async loadImageFromBuffer(_: Buffer): Promise<{
    data: Uint8ClampedArray
    width: number
    height: number
  }> {
    // This would use sharp or similar library on the server
    // For now, returning a placeholder
    throw new Error('Server-side image loading not implemented. Use sharp or jimp library.')
  }
}