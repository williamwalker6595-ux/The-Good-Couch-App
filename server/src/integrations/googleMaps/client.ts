import { env } from "../../config/env";

export class GoogleMapsApiError extends Error {
  constructor(message: string) {
    super(message);
  }
}

interface DistanceMatrixResponse {
  status: string;
  rows: {
    elements: {
      status: string;
      distance?: { value: number; text: string };
      duration?: { value: number; text: string };
    }[];
  }[];
}

/**
 * Real driving-route distance (following roads, not a straight line) between
 * two addresses, via the Distance Matrix API.
 */
export async function getDrivingDistanceMiles(
  origin: string,
  destination: string,
): Promise<number> {
  if (!env.googleMapsApiKey) {
    throw new GoogleMapsApiError("GOOGLE_MAPS_API_KEY is not configured");
  }

  const url = new URL(
    "https://maps.googleapis.com/maps/api/distancematrix/json",
  );
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("units", "imperial");
  url.searchParams.set("mode", "driving");
  url.searchParams.set("key", env.googleMapsApiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new GoogleMapsApiError(
      `Google Maps API error (${response.status}): ${await response.text()}`,
    );
  }

  const data = (await response.json()) as DistanceMatrixResponse;
  if (data.status !== "OK") {
    throw new GoogleMapsApiError(`Google Maps API status: ${data.status}`);
  }

  const element = data.rows[0]?.elements[0];
  if (!element || element.status !== "OK" || !element.distance) {
    throw new GoogleMapsApiError(
      `Could not resolve driving distance to "${destination}" (element status: ${element?.status})`,
    );
  }

  return element.distance.value / 1609.344;
}
