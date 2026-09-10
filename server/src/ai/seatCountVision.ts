import * as z from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "../integrations/anthropic/client";
import { env } from "../config/env";

const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

const seatCountSchema = z.object({
  seat_count: z
    .number()
    .int()
    .nullable()
    .describe(
      "Total number of people who could comfortably sit side by side on this couch/sectional, counted ONCE across all photos (not per photo) since multiple photos often show the same item from different angles. Null if the photos don't show enough of the item to judge, or don't clearly show a couch at all.",
    ),
  confidence: z.number().min(0).max(1),
  reasoning: z
    .string()
    .describe("1-2 sentences on how you arrived at the count"),
});

export type SeatCountVisionResult = z.infer<typeof seatCountSchema>;

async function fetchImageAsBase64(
  url: string,
): Promise<{ mediaType: SupportedMediaType; data: string } | null> {
  try {
    const response = await fetch(url, {
      headers: env.quoApiKey ? { Authorization: env.quoApiKey } : undefined,
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type")?.split(";")[0];
    const mediaType = SUPPORTED_MEDIA_TYPES.includes(
      contentType as SupportedMediaType,
    )
      ? (contentType as SupportedMediaType)
      : "image/jpeg";

    const buffer = Buffer.from(await response.arrayBuffer());
    return { mediaType, data: buffer.toString("base64") };
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You look at photos of a couch/sectional a customer sent to a couch-pickup
resale business and count how many people could comfortably sit side by side — the number of
"seats", not the number of decorative cushions or pillows (a 3-seat couch often has more than
3 cushions on it; count seat width, not cushion count).

You may be given multiple photos. They often show the SAME item from different angles
(front, side, a close-up of a stain, etc.) — count the seats on the item ONCE total, not once
per photo. If the photos clearly show more than one distinct piece of furniture, use your best
judgment about which one is the item being sold (usually the main couch/sectional, not a
side chair glimpsed in the background).

If the photos are too unclear, too zoomed-in, or don't show the whole item to count
confidently, return null rather than guessing, and say why in your reasoning.`;

export async function estimateSeatCountFromPhotos(
  photoUrls: string[],
): Promise<SeatCountVisionResult | null> {
  if (photoUrls.length === 0) {
    return null;
  }

  const images = await Promise.all(photoUrls.map(fetchImageAsBase64));
  const usableImages = images.filter(
    (img): img is NonNullable<typeof img> => img !== null,
  );

  if (usableImages.length === 0) {
    return null;
  }

  const response = await anthropic.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          ...usableImages.map(
            (img) =>
              ({
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: img.mediaType,
                  data: img.data,
                },
              }) as const,
          ),
          {
            type: "text" as const,
            text: `These ${usableImages.length} photo(s) were sent by the same customer about the same pickup — count the seats.`,
          },
        ],
      },
    ],
    output_config: {
      format: zodOutputFormat(seatCountSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return parseable seat count data");
  }

  return response.parsed_output;
}
