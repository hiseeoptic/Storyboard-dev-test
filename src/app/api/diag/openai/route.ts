import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * TEMPORARY diagnostic: why does OpenAI fail in production ("Connection
 * error")? The normal pipeline swallows the underlying network cause. This
 * route makes a minimal OpenAI call and returns the FULL error decomposition
 * (name / status / type / code / cause) WITHOUT ever revealing the key.
 *
 * Visit:  /api/diag/openai?token=diag2502
 * Optionally test a specific model:  &model=gpt-4o
 *
 * Delete this route once OpenAI is confirmed working.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== "diag2502") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const key = process.env.OPENAI_API_KEY ?? "";
  // Never echo the secret — only shape/prefix so we can spot an empty/garbled
  // or wrong-type key (project keys start sk-proj-, classic keys sk-).
  const keyInfo = {
    present: key.length > 0,
    length: key.length,
    prefix: key.slice(0, 8),
    hasWhitespace: /\s/.test(key),
  };

  const model = url.searchParams.get("model") || "gpt-4o";
  const started = Date.now();

  try {
    const openai = new OpenAI({ apiKey: key });
    // Two-step probe: models.list() checks pure connectivity + auth without
    // any model-access question; then a 1-token completion checks the model.
    const list = await openai.models.list();
    const modelCount = list.data?.length ?? 0;

    const completion = await openai.chat.completions.create(
      {
        model,
        messages: [{ role: "user", content: "ping" }],
        max_completion_tokens: 5,
      },
      { timeout: 30_000 }
    );

    return NextResponse.json({
      ok: true,
      keyInfo,
      ms: Date.now() - started,
      modelsReachable: modelCount,
      testedModel: model,
      sampleReply: completion.choices?.[0]?.message?.content ?? null,
    });
  } catch (err: unknown) {
    // Decompose whatever OpenAI/undici threw so the real reason is visible.
    const e = err as {
      name?: string;
      message?: string;
      status?: number;
      code?: string;
      type?: string;
      cause?: { code?: string; message?: string; errno?: number };
    };
    return NextResponse.json(
      {
        ok: false,
        keyInfo,
        ms: Date.now() - started,
        testedModel: model,
        error: {
          name: e?.name ?? null,
          message: e?.message ?? String(err),
          status: e?.status ?? null,
          openaiCode: e?.code ?? null,
          openaiType: e?.type ?? null,
          // The real network reason lives here on APIConnectionError:
          // ETIMEDOUT / ENOTFOUND / ECONNRESET / CERT_* / UND_ERR_* ...
          causeCode: e?.cause?.code ?? null,
          causeMessage: e?.cause?.message ?? null,
        },
      },
      { status: 200 }
    );
  }
}
