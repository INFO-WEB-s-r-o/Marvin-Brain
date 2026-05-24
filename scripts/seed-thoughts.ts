import { ulid } from "ulid"
import { getDb, closeDb } from "~/db/client"
import { thoughts } from "~/db/schema"
import { contentHash } from "~/lib/content"

const SAMPLES = [
  "A Monday comes right after every Sunday",
  "Water boils at 100 degrees Celsius at sea level",
  "There are seven days in a week",
  "The sun rises in the east and sets in the west",
  "A triangle has three sides",
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
