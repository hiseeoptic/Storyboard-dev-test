import { NextRequest, NextResponse } from "next/server";
import { generateStoryboardZip } from "@/services/export/zip";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const zipBuffer = await generateStoryboardZip(body.title, body.scenes);

    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="storyboard-images.zip"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ZIP generation failed" },
      { status: 500 }
    );
  }
}
