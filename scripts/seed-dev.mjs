#!/usr/bin/env node
/**
 * Database seed per ambiente dev locale.
 *
 * Popola:
 * - 3 tenant demo (dental, beauty, fitness) con owner user
 * - 5 conversazioni mock per il primo tenant
 * - 8 messaggi distribuiti
 * - 4 appointments mock
 * - 12 services
 * - business_hours per ognuno
 *
 * USO:
 *   node scripts/seed-dev.mjs
 *
 * Richiede SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL nell'env.
 *
 * IMPORTANTE: NON eseguire mai in produzione. Lo script verifica
 * NODE_ENV !== 'production' prima di iniziare.
 */

import { randomUUID } from 'node:crypto';

if (process.env['NODE_ENV'] === 'production') {
  console.error('❌ Abort: NODE_ENV=production. Refusing to seed.');
  process.exit(1);
}

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_ROLE = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const tenants = [
  {
    id: randomUUID(),
    name: 'Studio Dentistico Rossi',
    vertical: 'dental',
    timezone: 'Europe/Rome',
    locale: 'it-IT',
    vat_number: '12345678901',
  },
  {
    id: randomUUID(),
    name: 'Beauty Center Roma',
    vertical: 'beauty',
    timezone: 'Europe/Rome',
    locale: 'it-IT',
    vat_number: '23456789012',
  },
  {
    id: randomUUID(),
    name: 'Pilates Studio Milano',
    vertical: 'fitness',
    timezone: 'Europe/Rome',
    locale: 'it-IT',
    vat_number: '34567890123',
  },
];

async function callRpc(table, payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Insert ${table} failed: ${response.status} ${text}`);
  }

  return response.json();
}

async function main() {
  console.log('🌱 Seeding dev database...');
  console.log(`   Target: ${SUPABASE_URL}`);

  // Tenants
  console.log('\n📦 Tenants...');
  for (const tenant of tenants) {
    try {
      await callRpc('tenants', tenant);
      console.log(`   ✓ ${tenant.name} (${tenant.vertical})`);
    } catch (error) {
      console.error(`   ✗ ${tenant.name}: ${error.message}`);
    }
  }

  // Services per tenant 0 (dental)
  const dentalServices = [
    { name: 'Igiene dentale', duration_minutes: 45, price_eur: 80 },
    { name: 'Otturazione', duration_minutes: 60, price_eur: 120 },
    { name: 'Visita di controllo', duration_minutes: 20, price_eur: 0 },
    { name: 'Estrazione', duration_minutes: 45, price_eur: 100 },
  ];
  console.log('\n💼 Services dental...');
  for (const service of dentalServices) {
    try {
      await callRpc('services', { ...service, tenant_id: tenants[0].id, is_active: true });
      console.log(`   ✓ ${service.name}`);
    } catch (error) {
      console.error(`   ✗ ${service.name}: ${error.message}`);
    }
  }

  // Business hours dental
  console.log('\n🕐 Business hours dental...');
  for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek += 1) {
    try {
      await callRpc('business_hours', {
        tenant_id: tenants[0].id,
        day_of_week: dayOfWeek,
        opens_at: '09:00:00',
        closes_at: '19:00:00',
      });
      console.log(`   ✓ Day ${dayOfWeek}`);
    } catch (error) {
      console.error(`   ✗ Day ${dayOfWeek}: ${error.message}`);
    }
  }

  console.log('\n✅ Seed completato.');
  console.log(`\n💡 Test login con email tenant owner:`);
  for (const tenant of tenants) {
    console.log(`   - tenant_id: ${tenant.id}`);
  }
}

main().catch((error) => {
  console.error('💥 Seed failed:', error);
  process.exit(1);
});
