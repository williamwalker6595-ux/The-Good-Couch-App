import { getDrivingDistanceMiles } from "../integrations/googleMaps/client";
import { DispositionType } from "../db/repositories/dispositions";

export const SHOP_ADDRESS = "8475 W Colfax Ave, Lakewood, CO";

const RATE_PER_MILE = 3;
const MILEAGE_BASE_FEE = 20;
const FULL_BASE_FEE = 40;
const FULL_PER_SEAT_FEE = 20;

export class MissingQuoteInputError extends Error {}

export interface QuoteCalculation {
  amount: number;
  distanceMiles: number;
  explanation: string;
}

/**
 * Computes the exact pickup fee for a "mileage" or "full" disposition from
 * real driving distance (not straight-line) between the shop and the
 * customer's address, plus (for "full") a per-seat/section charge.
 */
export async function calculateQuoteAmount(input: {
  type: Extract<DispositionType, "mileage" | "full">;
  address: string;
  seatCount: number | null;
}): Promise<QuoteCalculation> {
  if (input.type === "full" && input.seatCount === null) {
    throw new MissingQuoteInputError(
      "seat/section count is required to calculate a full-charge quote",
    );
  }

  const distanceMiles = await getDrivingDistanceMiles(
    SHOP_ADDRESS,
    input.address,
  );
  const mileageFee = RATE_PER_MILE * distanceMiles;

  if (input.type === "mileage") {
    const amount = Math.round(mileageFee + MILEAGE_BASE_FEE);
    return {
      amount,
      distanceMiles,
      explanation: `${distanceMiles.toFixed(1)} mi driving distance × $${RATE_PER_MILE}/mi + $${MILEAGE_BASE_FEE} base = $${amount}`,
    };
  }

  const seatCount = input.seatCount as number;
  const seatFee = FULL_PER_SEAT_FEE * seatCount;
  const amount = Math.round(mileageFee + FULL_BASE_FEE + seatFee);
  return {
    amount,
    distanceMiles,
    explanation: `${distanceMiles.toFixed(1)} mi driving distance × $${RATE_PER_MILE}/mi + $${FULL_BASE_FEE} base + ${seatCount} seat(s) × $${FULL_PER_SEAT_FEE} = $${amount}`,
  };
}
