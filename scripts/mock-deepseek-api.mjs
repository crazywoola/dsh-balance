import { createServer } from 'node:http'

const port = Number.parseInt(process.env.DSH_BALANCE_MOCK_PORT ?? '3091', 10)
const server = createServer((req, res) => {
  if (req.method !== 'GET' || req.url !== '/user/balance') {
    res.writeHead(404)
    res.end()
    return
  }
  if (req.headers.authorization !== 'Bearer dsh-balance-test-key') {
    res.writeHead(401, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: { message: 'invalid test key' } }))
    return
  }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({
    is_available: true,
    balance_infos: [
      { currency: 'CNY', total_balance: '128.50', granted_balance: '8.50', topped_up_balance: '120.00' },
      { currency: 'USD', total_balance: '18.25', granted_balance: '1.25', topped_up_balance: '17.00' },
    ],
  }))
})

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`mock DeepSeek API listening at http://127.0.0.1:${port}\n`)
})

const shutdown = () => { server.close(() => process.exit(0)) }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
