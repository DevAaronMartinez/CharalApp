/**
 * Pobla DynamoDB con usuarios y posts de demo.
 * Uso: USERS_TABLE=... POSTS_TABLE=... node scripts/seed-dynamo.js
 */
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient, USERS_TABLE, POSTS_TABLE, useDynamo } = require('../src/db');
const seed = require('../src/data/seed');

async function seedTable() {
  if (!useDynamo()) {
    console.error('Define USERS_TABLE y POSTS_TABLE para ejecutar el seed.');
    process.exit(1);
  }

  console.log(`Seeding ${USERS_TABLE} (${seed.users.length} users)...`);
  for (const user of seed.users) {
    await docClient.send(new PutCommand({ TableName: USERS_TABLE, Item: user }));
  }

  console.log(`Seeding ${POSTS_TABLE} (${seed.posts.length} posts)...`);
  for (const post of seed.posts) {
    await docClient.send(new PutCommand({ TableName: POSTS_TABLE, Item: post }));
  }

  console.log('Seed completado.');
}

seedTable().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
