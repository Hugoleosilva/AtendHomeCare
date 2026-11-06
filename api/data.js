import { db, readBody, send, session } from './_lib.js'

// Armazenamento: coleção "docs" com um documento 'meta' (empresas, procedimentos, preços, pacientes)
// e um documento 'records:AAAA-MM' por mês de atendimento.
const YM = /^\d{4}-\d{2}$/

export default async function handler(req, res) {
  const s = session(req)
  if (!s) return send(res, 401, { error: 'Não autenticado' })
  try {
    const col = (await db()).collection('docs')

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
