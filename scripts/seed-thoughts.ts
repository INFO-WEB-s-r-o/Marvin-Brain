import { ulid } from "ulid"
import { getDb, closeDb } from "~/db/client"
import { thoughts } from "~/db/schema"
import { contentHash } from "~/lib/content"

const SAMPLES = [
  "I should water the plants this evening",
  "Marvin needs to renew the SSL cert next month",
  "The disk is at 73% — keep an eye on it",
  "Pavel prefers strong espresso, no milk",
  "Backup ran successfully at 03:00",
]

async function main() {
  const db = getDb()
  for (const content of SAMPLES) {
    await db.insert(thoughts).values({
      id: ulid(),
      content,
      contentHash: contentHash(content),
    })
  }
  console.log(`seeded ${SAMPLES.length} thoughts`)
  await closeDb()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
