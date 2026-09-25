import {
  isAllowedImageMime,
  parseImageDataUrl,
  readImageDimensions,
  type ParsedImageDataUrl,
} from "@/lib/media/image-validation";

export type ImageModerationContext = {
  requestTitle: string;
  categoryName?: string | null;
  city?: string | null;
  caption?: string | null;
  fileName?: string | null;
};

export type ImageModerationResult =
  | { ok: true; mimeType: ParsedImageDataUrl["mimeType"]; byteLength: number; dataUrl: string }
  | {
      ok: false;
      reason: "invalid" | "obscene" | "irrelevant" | "unavailable";
      message: string;
    };

/**
 * FAIL CLOSED (L4, 2026-09-25). Denetlenemeyen görsel yayına çıkmaz.
 *
 * Önceki davranış yorumuyla çelişiyordu: başlık "fail closed" diyordu, kod ise
 * sağlayıcı hatası, zaman aşımı ve beklenmeyen/eksik yanıt yollarının üçünde de
 * `ok: true` dönüyordu. Sonuç, hiç denetlenmemiş bir görselin denetlenmiş
 * görselle aynı yoldan mesaja yazılmasıydı. Moderasyon kararı ALINAMADIYSA
 * karar "uygun" değildir; kullanıcıya nazik bir "şu an kontrol edilemedi"
 * mesajı döner ve olay loglanır (görsel içeriği ya da data URL'i loglanmaz).
 */
const MODERATION_UNAVAILABLE_MESSAGE =
  "Görsel şu anda kontrol edilemedi. Lütfen biraz sonra tekrar deneyin.";

/**
 * Tek fail-closed sınırı. `stage` yalnız sabit bir etikettir; görsel, data URL,
 * dosya adı ve talep metni buraya hiçbir koşulda girmez.
 */
function moderationUnavailable(
  stage: string,
  detail?: string,
): Extract<ImageModerationResult, { ok: false }> {
  console.warn(
    `[moderate-message-image] fail-closed: ${stage}${detail ? ` (${detail})` : ""}`,
  );
  return {
    ok: false,
    reason: "unavailable",
    message: MODERATION_UNAVAILABLE_MESSAGE,
  };
}

const EXPLICIT_NAME_PATTERN =
  /(nsfw|porn|xxx|nude|naked|sex|erotik|müstehcen|mustehcen|çıplak|ciplak|seks|porno)/i;

/**
 * Validate + moderate a message image before it is persisted.
 *
 * Yapısal kapı (mime, sihirli bayt, boyut, dosya adı) her koşulda koşar.
 * Sonrasında karar OpenAI moderation + vision yolundan gelir. Karar
 * ALINAMAZSA görsel geçmez — bkz. `moderationUnavailable`. `OPENAI_API_KEY`
 * yoksa yol yapılandırılmamış sayılır ve yine kapalıdır.
 */
export async function moderateMessageImage(
  dataUrl: string,
  context: ImageModerationContext,
): Promise<ImageModerationResult> {
  let parsed: ParsedImageDataUrl;

  try {
    parsed = parseImageDataUrl(dataUrl);
  } catch (error) {
    return {
      ok: false,
      reason: "invalid",
      message:
        error instanceof Error
          ? error.message
          : "Görsel doğrulanamadı. Farklı bir dosya deneyin.",
    };
  }

  if (!isAllowedImageMime(parsed.mimeType)) {
    return {
      ok: false,
      reason: "invalid",
      message: "Yalnızca JPEG, PNG veya WebP görselleri gönderilebilir.",
    };
  }

  const dimensions = readImageDimensions(parsed.buffer, parsed.mimeType);
  if (
    dimensions &&
    (dimensions.width < 32 ||
      dimensions.height < 32 ||
      dimensions.width > 8000 ||
      dimensions.height > 8000)
  ) {
    return {
      ok: false,
      reason: "invalid",
      message: "Görsel boyutu kabul edilen aralığın dışında.",
    };
  }

  const fileName = context.fileName?.trim() ?? "";
  if (fileName && EXPLICIT_NAME_PATTERN.test(fileName)) {
    return {
      ok: false,
      reason: "obscene",
      message:
        "Görsel uygun bulunmadı (müstehcen içerik şüphesi). Lütfen taleple ilgili bir fotoğraf gönderin.",
    };
  }

  const aiKey = process.env.OPENAI_API_KEY?.trim();
  if (aiKey) {
    const aiResult = await moderateWithOpenAI(aiKey, dataUrl, context);
    if (!aiResult.ok) return aiResult;
  } else {
    // Yapılandırma eksik. Yerel sezgiseller hâlâ REDDEDEBİLİR, fakat tek
    // başlarına "denetlendi" anlamına gelmezler: anahtar yoksa görsel yine
    // kapalı kalır. Üretimde sessizce açılmaması bilinçlidir; geliştirme
    // ortamında ayrıca neyin eksik olduğunu söyleyen açık bir uyarı basılır.
    const local = moderateLocallyWithoutAi(context);
    if (!local.ok) return local;

    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[moderate-message-image] OPENAI_API_KEY tanımlı değil — görsel moderasyonu yapılandırılmamış. " +
          "Görseller fail-closed reddediliyor; yerel geliştirmede göndermek için anahtarı ayarlayın.",
      );
    }

    return moderationUnavailable("configuration_missing");
  }

  return {
    ok: true,
    mimeType: parsed.mimeType,
    byteLength: parsed.byteLength,
    dataUrl: dataUrl.trim(),
  };
}

async function moderateWithOpenAI(
  apiKey: string,
  dataUrl: string,
  context: ImageModerationContext,
): Promise<Extract<ImageModerationResult, { ok: false }> | { ok: true }> {
  try {
    const moderationResponse = await fetch(
      "https://api.openai.com/v1/moderations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "omni-moderation-latest",
          input: [
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
            ...(context.caption
              ? [{ type: "text", text: context.caption }]
              : []),
          ],
        }),
      },
    );

    if (!moderationResponse.ok) {
      return moderationUnavailable(
        "moderations_http_error",
        String(moderationResponse.status),
      );
    }

    let moderationJson: {
      results?: Array<{ flagged?: boolean; categories?: Record<string, boolean> }>;
    };

    try {
      moderationJson = (await moderationResponse.json()) as typeof moderationJson;
    } catch {
      return moderationUnavailable("moderations_unparsable_body");
    }

    const result = moderationJson.results?.[0];
    if (!result) {
      return moderationUnavailable("moderations_missing_verdict");
    }

    const categories = result.categories ?? {};
    const sexual = Boolean(categories.sexual || categories["sexual/minors"]);

    if (result.flagged && (sexual || categories.violence || categories.hate)) {
      return {
        ok: false,
        reason: "obscene",
        message:
          "Görsel uygun bulunmadı (müstehcen veya sakıncalı içerik). Mesaj olarak iletilmedi.",
      };
    }

    const requestSummary = [
      context.requestTitle,
      context.categoryName ? `Kategori: ${context.categoryName}` : null,
      context.city ? `Şehir: ${context.city}` : null,
      context.caption ? `Gönderen notu: ${context.caption}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const visionResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Sen B2B talep platformu görsel denetçisisin. JSON döndür: {\"safe\":boolean,\"relevant\":boolean,\"reason\":\"obscene\"|\"irrelevant\"|\"ok\",\"detail\":string}. safe=false müstehcen/uygunsuz; relevant=false talep konusuyla alakasız (meme, rastgele selfie, reklam vb.).",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Talep bağlamı:\n${requestSummary}\n\nBu görsel talebe uygun mu?`,
                },
                {
                  type: "image_url",
                  image_url: { url: dataUrl, detail: "low" },
                },
              ],
            },
          ],
        }),
      },
    );

    if (!visionResponse.ok) {
      return moderationUnavailable("vision_http_error", String(visionResponse.status));
    }

    let visionJson: { choices?: Array<{ message?: { content?: string } }> };

    try {
      visionJson = (await visionResponse.json()) as typeof visionJson;
    } catch {
      return moderationUnavailable("vision_unparsable_body");
    }

    const raw = visionJson.choices?.[0]?.message?.content;
    if (!raw) {
      return moderationUnavailable("vision_missing_content");
    }

    let parsed: {
      safe?: boolean;
      relevant?: boolean;
      reason?: string;
      detail?: string;
    };

    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      return moderationUnavailable("vision_unparsable_verdict");
    }

    if (typeof parsed !== "object" || parsed === null) {
      return moderationUnavailable("vision_unexpected_verdict_shape");
    }

    if (parsed.safe === false || parsed.reason === "obscene") {
      return {
        ok: false,
        reason: "obscene",
        message:
          "Görsel uygun bulunmadı (müstehcen veya sakıncalı içerik). Mesaj olarak iletilmedi.",
      };
    }

    if (parsed.relevant === false || parsed.reason === "irrelevant") {
      return {
        ok: false,
        reason: "irrelevant",
        message: `Görsel taleple ilgili görünmüyor${
          context.requestTitle ? ` (“${context.requestTitle}”)` : ""
        }. Lütfen talebe ait ürün / iş fotoğrafı gönderin.`,
      };
    }

    // Olumlu karar AÇIK olmak zorundadır. Eksik alan "uygun" demek değildir:
    // denetçi iki soruyu da cevaplamadıysa görsel denetlenmemiştir.
    if (parsed.safe !== true || parsed.relevant !== true) {
      return moderationUnavailable("vision_incomplete_verdict");
    }

    return { ok: true };
  } catch (error) {
    // Zaman aşımı, DNS, soket hatası. Yalnız hata TÜRÜ loglanır; görsel,
    // data URL ve talep metni loglanmaz.
    return moderationUnavailable(
      "provider_error",
      error instanceof Error ? error.name : "unknown",
    );
  }
}

/** Lightweight offline policy when no OpenAI key is configured. */
function moderateLocallyWithoutAi(
  context: ImageModerationContext,
): Extract<ImageModerationResult, { ok: false }> | { ok: true } {
  const caption = context.caption?.trim() ?? "";
  if (caption && EXPLICIT_NAME_PATTERN.test(caption)) {
    return {
      ok: false,
      reason: "obscene",
      message:
        "Görsel açıklaması uygun değil. Lütfen taleple ilgili bir fotoğraf gönderin.",
    };
  }

  // Optional offline relevance hint: if caption is present and shares no
  // meaningful tokens with the request title, reject as irrelevant.
  if (caption.length >= 8 && context.requestTitle.trim()) {
    const titleTokens = tokenize(context.requestTitle);
    const captionTokens = tokenize(caption);
    const overlap = titleTokens.filter((token) => captionTokens.includes(token));
    if (titleTokens.length >= 2 && overlap.length === 0) {
      return {
        ok: false,
        reason: "irrelevant",
        message: `Görsel açıklaması taleple (“${context.requestTitle}”) ilişkili görünmüyor. Lütfen ilgili bir fotoğraf veya açıklama kullanın.`,
      };
    }
  }

  return { ok: true };
}

function tokenize(value: string): string[] {
  const stop = new Set([
    "ve",
    "veya",
    "bir",
    "bu",
    "şu",
    "için",
    "ile",
    "olan",
    "gibi",
    "the",
    "and",
    "for",
  ]);

  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !stop.has(part));
}
