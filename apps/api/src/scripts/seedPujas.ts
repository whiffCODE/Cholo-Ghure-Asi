import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { parse } from "csv-parse/sync";
import Pandal from "../models/Pandal";

const REGION_MAP: Record<string, "North" | "Central" | "South"> = {
  "north kolkata": "North",
  "central kolkata": "Central",
  "south kolkata": "South",
};

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseCoordinate(value: string): number | null {
  // Examples: 22.60470° N, 88.36613° E
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  let result = Number(match[0]);
  const direction = value.trim().slice(-1).toUpperCase();

  if (direction === "S" || direction === "W") {
    result = -Math.abs(result);
  }

  return Number.isFinite(result) ? result : null;
}

async function main() {
  const csvPath = path.resolve(process.cwd(), "../../data/pujas.csv");

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from apps/api/.env");
  }

  const csv = fs.readFileSync(csvPath, "latin1");

  const rows: string[][] = parse(csv, {
    bom: true,
    relax_quotes: true,
    skip_empty_lines: true,
    trim: true,
  });

  let currentRegion: "North" | "Central" | "South" | null = null;

  const records = new Map<string, {
    name: string;
    address: string;
    landmark: string;
    nearestMetro: string;
    latitude: number;
    longitude: number;
    region: "North" | "Central" | "South";
    slug: string;
  }>();

  for (const row of rows) {
    const name = (row[0] ?? "").trim();
    if (!name) continue;

    const section = REGION_MAP[name.toLowerCase()];

    if (section) {
      currentRegion = section;
      continue;
    }

    if (name.toLowerCase().includes("pujas / pandals")) {
      continue;
    }

    if (!currentRegion || row.length < 6) continue;

    const address = (row[1] ?? "").trim();
    const landmark = (row[2] ?? "").trim();
    const nearestMetro = (row[3] ?? "").trim();
    const latitude = parseCoordinate(row[4] ?? "");
    const longitude = parseCoordinate(row[5] ?? "");

    if (
      !address ||
      latitude === null ||
      longitude === null ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      console.warn(`Skipping invalid row: ${name}`);
      continue;
    }

    const slug = `${currentRegion.toLowerCase()}-${slugify(name)}`;

    records.set(slug, {
      name,
      address,
      landmark,
      nearestMetro,
      latitude,
      longitude,
      region: currentRegion,
      slug,
    });
  }

  const documents = [...records.values()];

  if (!documents.length) {
    throw new Error(
      "No valid records were found. Check the CSV structure and encoding."
    );
  }

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const operations = documents.map((record) => ({
      updateOne: {
        filter: { slug: record.slug },
        update: { $set: record },
        upsert: true,
      },
    }));

    const result = await Pandal.bulkWrite(operations);

    console.log(`Valid CSV records: ${documents.length}`);
    console.log(`Inserted: ${result.upsertedCount}`);
    console.log(`Updated: ${result.modifiedCount}`);

    const counts = await Pandal.aggregate([
      { $group: { _id: "$region", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    console.table(counts);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Pandal seeding failed:", error);
  process.exitCode = 1;
});