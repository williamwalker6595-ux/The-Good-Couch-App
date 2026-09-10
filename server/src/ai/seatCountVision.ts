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
      "Number of ~30-inch-wide seat sections on this couch/sectional, counted ONCE across all photos (not per photo) since multiple photos often show the same item from different angles. Count each cushion as one section by default; count an unusually wide cushion as two (or more) sections instead of one. Null if the photos don't show enough of the item to judge, or don't clearly show a couch at all.",
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
resale business and count how many ~30-inch-wide seat sections it has — not decorative
cushions/pillows on top of the seat, and not simply the number of seat cushions either.

Default rule: count each seat cushion as one section. But cushion width varies — some couches
have noticeably wider cushions than a standard single seat, wide enough that two people could
comfortably sit side by side on what looks like "one" cushion (e.g. a couch with 2 large
cushions can easily be 3 sections' worth of width). When a cushion looks unusually wide relative
to a normal single seat, count it as two (or more) sections instead of one — judge by width, not
by how the cushions happen to be divided.

You may be given multiple photos. They often show the SAME item from different angles
(front, side, a close-up of a stain, etc.) — count the sections on the item ONCE total, not once
per photo. If the photos clearly show more than one distinct piece of furniture, use your best
judgment about which one is the item being sold (usually the main couch/sectional, not a
side chair glimpsed in the background).

If you're on the edge between two counts, or genuinely unsure, round UP rather than down —
it's better to overestimate a section count than underestimate one. Only return null if the
photos are too unclear, too zoomed-in, or don't show the whole item to count at all, and say
why in your reasoning.`;

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
