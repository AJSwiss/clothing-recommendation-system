import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import 'dotenv/config';
import {query} from './db.js';

const dataRoot = process.env.KAGGLE_DATA_PATH || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../kaggledata');
const csvPath = path.join(dataRoot, 'styles.csv');
const batchSize = 500;

const csvFields = (line) => {
  const fields = [];
  let field = '';
  let quoted = false;
  for (const character of line) {
    if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else field += character;
  }
  fields.push(field);
  return fields.map(value => value.replace(/^"|"$/g, '').replace(/""/g, '"'));
};

const categoryFor = (subCategory, masterCategory) => {
  if (subCategory === 'Topwear') return 'tops';
  if (subCategory === 'Bottomwear') return 'bottoms';
  if (subCategory === 'Socks') return 'socks';
  if (subCategory === 'Belts') return 'belts';
  if (subCategory === 'Eyewear') return 'sunglasses';
  if (['Shoes', 'Sandal', 'Flip Flops'].includes(subCategory)) return 'shoes';
  if (masterCategory === 'Apparel') return 'tops';
  return 'accessories';
};

const toItem = (values) => {
  const [id, gender, masterCategory, subCategory, articleType, baseColour, season, year, usage, productDisplayName] = values;
  return {
    sourceId: Number(id),
    name: productDisplayName,
    category: categoryFor(subCategory, masterCategory),
    subcategory: articleType.toLowerCase().replace(/\s+/g, '-'),
    genderTag: gender.toLowerCase(),
    color: baseColour.toLowerCase(),
    style: usage.toLowerCase(),
    material: masterCategory.toLowerCase(),
    imageUrl: `/catalog-images/${id}.jpg`,
    price: null
  };
};

async function insertBatch(items) {
  if (!items.length) return;
  const values = [];
  const params = [];
  for (const item of items) {
    const offset = params.length;
    values.push(`($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8},$${offset + 9},$${offset + 10})`);
    params.push(item.name, item.category, item.subcategory, item.genderTag, item.color, item.style, item.material, item.imageUrl, item.price, item.sourceId);
  }
  await query(`INSERT INTO clothing_items (name,category,subcategory,gender_tag,color,style,material,image_url,price,source_id)
    VALUES ${values.join(',')} ON CONFLICT (source_id) WHERE source_id IS NOT NULL DO NOTHING`, params);
}

export async function importCatalog() {
  if (!fs.existsSync(csvPath)) {
    console.warn(`Kaggle catalog not found at ${csvPath}; no catalog rows imported.`);
    return;
  }
  await query('ALTER TABLE clothing_items ADD COLUMN IF NOT EXISTS source_id INTEGER');
  await query('ALTER TABLE clothing_items ALTER COLUMN price DROP NOT NULL');
  await query('CREATE UNIQUE INDEX IF NOT EXISTS clothing_items_source_id_idx ON clothing_items(source_id) WHERE source_id IS NOT NULL');
  await query(`UPDATE clothing_items SET category='socks' WHERE subcategory='socks'`);
  await query(`UPDATE clothing_items SET category='belts' WHERE subcategory='belts'`);
  await query(`UPDATE clothing_items SET category='sunglasses' WHERE subcategory='eyewear'`);
  const existing = await query('SELECT COUNT(*)::int AS count FROM clothing_items WHERE source_id IS NOT NULL');
  if (existing.rows[0].count >= 40000) return;
  console.log(`Catalog import is incomplete (${existing.rows[0].count} rows); rebuilding it.`);
  await query('DELETE FROM user_interactions');
  await query('DELETE FROM clothing_items WHERE source_id IS NULL');
  await query('DELETE FROM clothing_items WHERE source_id IS NOT NULL');

  const input = readline.createInterface({input: fs.createReadStream(csvPath), crlfDelay: Infinity});
  let header = true;
  let items = [];
  for await (const line of input) {
    if (header) {
      header = false;
      continue;
    }
    if (!line.trim()) continue;
    const values = csvFields(line);
    if (fs.existsSync(path.join(dataRoot, 'images', `${values[0]}.jpg`))) items.push(toItem(values));
    if (items.length === batchSize) {
      await insertBatch(items);
      items = [];
    }
  }
  await insertBatch(items);
  console.log('Imported Kaggle clothing catalog.');
}
