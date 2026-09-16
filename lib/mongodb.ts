import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI

type MongooseCache = {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var mongooseCache: MongooseCache | undefined
}

const cached: MongooseCache = globalThis.mongooseCache ?? {
  conn: null,
  promise: null,
}

if (!globalThis.mongooseCache) {
  globalThis.mongooseCache = cached
}

export class MongoConfigurationError extends Error {
  constructor() {
    super("MONGODB_URI is not configured")
    this.name = "MongoConfigurationError"
  }
}

export async function connectMongo() {
  if (!MONGODB_URI) {
    throw new MongoConfigurationError()
  }

  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    })
  }

  try {
    cached.conn = await cached.promise
    return cached.conn
  } catch (error) {
    cached.promise = null
    throw error
  }
}

export function toApiError(error: unknown) {
  if (error instanceof MongoConfigurationError) {
    return {
      body: {
        error:
          "MongoDB is not configured. Add MONGODB_URI to your environment.",
      },
      status: 503,
    }
  }

  return {
    body: { error: "Database request failed" },
    status: 500,
  }
}
