import { pool } from "../pool";

export interface ConditionAssessment {
  id: string;
  lead_id: string;
  smoking_household: boolean | null;
  pets: boolean | null;
  blemishes: string | null;
  odors: string | null;
  stains: string | null;
  notes: string | null;
  photo_refs: string[];
  created_at: Date;
}

export async function getLatestConditionAssessmentByLead(
  leadId: string,
): Promise<ConditionAssessment | null> {
  const result = await pool.query<ConditionAssessment>(
    `SELECT * FROM condition_assessments
     WHERE lead_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [leadId],
  );
  return result.rows[0] ?? null;
}

export async function insertConditionAssessment(input: {
  leadId: string;
  smokingHousehold: boolean | null;
  pets: boolean | null;
  blemishes: string | null;
  odors: string | null;
  stains: string | null;
  notes: string | null;
  photoRefs: string[];
}): Promise<ConditionAssessment> {
  const result = await pool.query<ConditionAssessment>(
    `INSERT INTO condition_assessments
       (lead_id, smoking_household, pets, blemishes, odors, stains, notes, photo_refs)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.leadId,
      input.smokingHousehold,
      input.pets,
      input.blemishes,
      input.odors,
      input.stains,
      input.notes,
      input.photoRefs,
    ],
  );
  return result.rows[0];
}
