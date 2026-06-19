/**
 * Synthetic, HIPAA-safe test-data factories.
 *
 * Everything here is 100% fabricated via faker — no real PHI ever. A deterministic
 * seed (TEST_DATA_SEED) makes runs reproducible, which matters for debugging flaky
 * tests and for stable visual baselines.
 *
 * When an Anthropic API key is present, `aiClinicalNote()` can generate a realistic
 * free-text reason-for-visit; otherwise it returns a deterministic template.
 */

import { faker } from '@faker-js/faker';
import { askClaude, aiEnabled } from '../ai/ai-client.ts';

const seed = Number(process.env.TEST_DATA_SEED ?? 20260619);
faker.seed(seed);

export interface SyntheticPatient {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  dob: string; // ISO date
  mrn: string; // medical record number (synthetic)
  memberId: string; // insurance member id (synthetic)
  phone: string;
}

const SPECIALTIES = ['Cardiology', 'Dermatology', 'Primary Care', 'Endocrinology'] as const;
export type Specialty = (typeof SPECIALTIES)[number];

/** A fully synthetic patient. Strong password meets common portal policies. */
export function makePatient(overrides: Partial<SyntheticPatient> = {}): SyntheticPatient {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  return {
    firstName,
    lastName,
    email: faker.internet.email({ firstName, lastName, provider: 'example.com' }).toLowerCase(),
    password: `Tst-${faker.string.alphanumeric(8)}!9`,
    dob: faker.date.birthdate({ min: 18, max: 90, mode: 'age' }).toISOString().slice(0, 10),
    mrn: `MRN-${faker.string.numeric(6)}`,
    memberId: `MBR-${faker.string.alphanumeric(9).toUpperCase()}`,
    phone: faker.phone.number({ style: 'national' }),
    ...overrides,
  };
}

export interface AppointmentRequest {
  specialty: Specialty;
  provider: string;
  date: string; // YYYY-MM-DD (future)
  time: string; // HH:mm
  reason: string;
}

/** A future-dated appointment request with a synthetic provider. */
export async function makeAppointment(overrides: Partial<AppointmentRequest> = {}): Promise<AppointmentRequest> {
  const future = faker.date.soon({ days: 60 });
  const specialty = faker.helpers.arrayElement(SPECIALTIES);
  return {
    specialty,
    provider: `Dr. ${faker.person.lastName()}`,
    date: future.toISOString().slice(0, 10),
    time: faker.helpers.arrayElement(['09:00', '10:30', '13:15', '14:45', '16:00']),
    reason: await aiClinicalNote(specialty),
    ...overrides,
  };
}

/** Realistic, non-PHI reason-for-visit. AI-generated when a key is present, else templated. */
export async function aiClinicalNote(specialty: Specialty): Promise<string> {
  if (aiEnabled()) {
    const note = await askClaude(
      `Write a one-sentence, realistic but fictional "reason for visit" for a ${specialty} ` +
        `appointment. No real names or identifiers. Plain text only.`,
      { maxTokens: 80 },
    );
    if (note) return note.replace(/\s+/g, ' ').trim();
  }
  const templates: Record<Specialty, string> = {
    Cardiology: 'Follow-up on blood pressure and routine ECG review.',
    Dermatology: 'Annual skin check and review of a recurring rash.',
    'Primary Care': 'Routine annual wellness visit and lab review.',
    Endocrinology: 'Diabetes management check-in and A1C review.',
  };
  return templates[specialty];
}

export interface ClaimRequest {
  service: string;
  amount: number;
}

export function makeClaim(overrides: Partial<ClaimRequest> = {}): ClaimRequest {
  return {
    service: faker.helpers.arrayElement([
      'Office visit — established patient',
      'Diagnostic blood panel',
      'Physical therapy session',
      'Preventive screening',
    ]),
    amount: Number(faker.commerce.price({ min: 40, max: 600 })),
    ...overrides,
  };
}
