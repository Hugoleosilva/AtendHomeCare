import { db, readBody, send, session } from './_lib.js'

// Armazenamento: coleção "docs" com um documento 'meta' (empresas, procedimentos, preços, pacientes)
// e um documento 'records:AAAA-MM' por mês de atendimento.
// Proteção contra perda de dados: coleção "history" guarda cópias completas do estado anterior
// (a cada 10 min de uso, e sempre que uma gravação reduzir dados, apagar um mês ou substituir tudo).
const YM = /^\d{4}-\d{2}$/
const KEEP = 60 // cópias mantidas
const EVERY_MS = 10 * 60 * 1000

async function snapshot(col, hist, reason) {
  const docs = await col.find({}).toArray()
  if (!docs.length) return
  const meta = docs.find((d) => d._id === 'meta')?.data
  const records = docs.filter((d) => d._id.startsWith('records:')).reduce((n, d) => n + Object.keys(d.data || {}).length, 0)
  await hist.insertOne({ savedAt: new Date(), reason, patients: meta?.patients?.length || 0, companies: meta?.companies?.length || 0, records, docs })
  const old = await hist.find({}, { projection: { _id: 1 } }).sort({ savedAt: -1 }).skip(KEEP).toArray()
  if (old.length) await hist.deleteMany({ _id: { $in: old.map((o) => o._id) } })
}

export default async function handler(req, res) {
  const s = session(req)
  if (!s) return send(res, 401, { error: 'Não autenticado' })
  try {
    const database = await db()
    const col = database.collection('docs')
    const hist = database.collection('history')

    if (req.method === 'GET') {
      const docs = await col.find({}).toArray()
      const meta = docs.find((d) => d._id === 'meta')?.data || null
      const records = {}
      for (const d of docs) if (d._id.startsWith('records:')) Object.assign(records, d.data)
      return send(res, 200, { empty: !meta, meta, records })
    }

    if (req.method === 'PUT') {
      const { meta, months = {}, replace = false } = await readBody(req)
      if (replace && s.role !== 'admin') return send(res, 403, { error: 'Apenas o admin pode substituir todos os dados' })
      if (meta !== undefined && (typeof meta !== 'object' || meta === null || Array.isArray(meta))) return send(res, 400, { error: 'meta inválido' })

      // guarda uma cópia do estado atual antes de qualquer gravação que possa perder dados
      const cur = await col.findOne({ _id: 'meta' })
      const curPatients = cur?.data?.patients?.length || 0
      const shrinks = meta !== undefined && (meta.patients?.length || 0) < curPatients
      const dropsMonth = Object.values(months).some((d) => d && typeof d === 'object' && !Object.keys(d).length)
      const last = await hist.find({}, { projection: { savedAt: 1 } }).sort({ savedAt: -1 }).limit(1).next()
      const stale = !last || Date.now() - last.savedAt.getTime() > EVERY_MS
      if (replace || shrinks || dropsMonth || stale) await snapshot(col, hist, replace ? 'substituição' : shrinks || dropsMonth ? 'redução de dados' : 'periódica')

      if (replace) await col.deleteMany({})
      const now = new Date()
      const ops = []
      if (meta !== undefined) ops.push({ replaceOne: { filter: { _id: 'meta' }, replacement: { _id: 'meta', data: meta, updatedAt: now }, upsert: true } })
      for (const [ym, data] of Object.entries(months)) {
        if (!YM.test(ym) || typeof data !== 'object' || data === null) return send(res, 400, { error: 'mês inválido' })
        const id = `records:${ym}`
        if (!Object.keys(data).length) ops.push({ deleteOne: { filter: { _id: id } } })
        else ops.push({ replaceOne: { filter: { _id: id }, replacement: { _id: id, data, updatedAt: now }, upsert: true } })
      }
      if (ops.length) await col.bulkWrite(ops, { ordered: true })
      return send(res, 200, { ok: true, at: now.toISOString() })
    }

    return send(res, 405, { error: 'Método não permitido' })
  } catch (e) {
    console.error(e)
    return send(res, 500, { error: 'Erro ao acessar o banco' })
  }
}
