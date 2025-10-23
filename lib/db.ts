import mysql from 'mysql2/promise'

interface DbConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
  waitForConnections: boolean
  connectionLimit: number
  queueLimit: number
}

// Connection pool configuration
const dbConfig: DbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'callup_db',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || '0'),
}

// Debug: Log connection configuration (hide password)
console.log('🔧 Database Configuration:', {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database,
  password: dbConfig.password ? `${dbConfig.password.substring(0, 3)}...${dbConfig.password.substring(dbConfig.password.length - 3)}` : 'EMPTY',
  hasPassword: !!dbConfig.password,
  connectionLimit: dbConfig.connectionLimit,
})
console.log('🔍 Raw ENV values:', {
  DB_HOST: process.env.DB_HOST,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD ? 'SET' : 'NOT SET',
})

// Create connection pool
let pool: mysql.Pool | null = null

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(dbConfig)
    console.log('✅ MySQL connection pool created')
  }
  return pool
}

// Get a connection from the pool
export async function getConnection() {
  const pool = getPool()
  return await pool.getConnection()
}

// Execute query with automatic connection handling
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<T> {
  const pool = getPool()
  try {
    const [rows] = await pool.execute(sql, params)
    return rows as T
  } catch (error) {
    console.error('❌ Database query error:', error)
    throw error
  }
}

// Execute transaction
export async function transaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getConnection()

  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    console.error('❌ Transaction error:', error)
    throw error
  } finally {
    connection.release()
  }
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    console.log('🔍 Attempting database connection...')
    console.log('🔍 Config:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
    })

    const pool = getPool()
    const connection = await pool.getConnection()
    await connection.ping()
    connection.release()
    console.log('✅ Database connection successful')
    return true
  } catch (error: any) {
    console.error('❌ Database connection failed:', error)
    console.error('❌ Error code:', error.code)
    console.error('❌ Error message:', error.message)
    console.error('❌ Error errno:', error.errno)
    console.error('❌ Error sqlState:', error.sqlState)
    return false
  }
}

// Close all connections
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    console.log('✅ MySQL connection pool closed')
  }
}

// Export pool for direct access if needed
export { pool }
