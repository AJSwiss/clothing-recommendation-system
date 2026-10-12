import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const schema = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../db/001_schema.sql'),
  'utf8'
);

describe('database schema', () => {
  test('defines the core tables and relationships', () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS users/i);
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS user_preferences/i);
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS clothing_items/i);
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS user_interactions/i);
    expect(schema).toMatch(/REFERENCES users\(id\) ON DELETE CASCADE/i);
    expect(schema).toMatch(/REFERENCES clothing_items\(id\) ON DELETE CASCADE/i);
  });

  test('enforces valid interaction types and unique user-item interactions', () => {
    expect(schema).toMatch(/CHECK \(interaction_type IN \('like','dislike'\)\)/i);
    expect(schema).toMatch(/UNIQUE\(user_id,item_id\)/i);
    expect(schema).toMatch(/CREATE INDEX IF NOT EXISTS items_category_idx/i);
  });
});
