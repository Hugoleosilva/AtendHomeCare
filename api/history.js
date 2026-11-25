import { ObjectId } from 'mongodb'
import { db, readBody, send, session } from './_lib.js'

// Histórico de cópias do banco (somente administrador): listar e restaurar uma cópia anterior.
export default async function handler(req, res) {
  const s = session(req)
  if (!s) return send(res, 401, { error: 'Não autenticado' })
  if (s.role !== 'admin') return send(res, 403, { error: 'Apenas o administrador' })
  try {
    const database = await db()
    const col = database.collection('docs')
    const hist = database.collection('history')

    if (req.method === 'GET') {
      const list = await hist.find({}, { projection: { docs: 0 } }).sort({ savedAt: -1 }).toArray()
      return send(res, 200, { items: list.map((h) => ({ id: String(h._id), savedAt: h.savedAt, reason: h.reason, patients: h.patients, companies: h.companies, records: h.records })) })
    }

    if (req.method === 'POST') {
      const { id } = await readBody(req)
      let oid
      try { oid = new ObjectId(String(id)) } catch { return send(res, 400, { error: 'id inválido' }) }
      const snap = await hist.findOne({ _id: oid })
      if (!snap?.docs?.length) return send(res, 404, { error: 'Cópia não encontrada' })

      // antes de restaurar, guarda o estado atual (assim dá para desfazer a restauração)
      const cur = await col.find({}).toArray()
      if (cur.length) {
        const meta = cur.find((d) => d._id === 'meta')?.data
        await hist.insertOne({ savedAt: new Date(), reason: 'antes de restaurar', patients: meta?.patients?.length || 0, companies: meta?.companies?.length || 0, records: cur.filter((d) => d._id.startsWith('records:')).reduce((n, d) => n + Object.keys(d.data || {}).length, 0), docs: cur })
      }
      await col.deleteMany({})
      await col.insertMany(snap.docs)
      return send(res, 200, { ok: true })
    }

    return send(res, 405, { error: 'Método não permitido' })
  } catch (e) {
    console.error(e)
    return send(res, 500, { error: 'Erro ao acessar o banco' })
  }
}
