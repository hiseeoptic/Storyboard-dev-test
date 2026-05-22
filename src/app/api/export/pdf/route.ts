import { NextRequest, NextResponse } from "next/server";
import { generateStoryboardPdf } from "@/services/export/pdf";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pdfBuffer = await generateStoryboardPdf(body);

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="storyboard.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  }
}
