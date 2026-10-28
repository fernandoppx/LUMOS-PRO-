import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { supabaseServer } from '../supabase';

export const diagnosticosRouter = Router();

type Usuario = { id: string; email: string; papel: 'administrador' | 'auditor' };

function usuarioDaRequisicao(req: Request, res: Response): Usuario | null {
  const usuario = req.lumosUser;
  if (!usuario) {
    res.status(401).json({ error: 'É necessário entrar no Lumos Pro.' });
    return null;
  }
  return usuario;
}

function texto(valor: unknown, max = 2000): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'string') return null;
  const limpo = valor.trim();
  return limpo ? limpo.slice(0, max) : null;
}

function dataValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function uuidValido(valor: unknown): valor is string {
  return typeof valor === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
}

// Um auditor só pode trabalhar em clientes de sua autoria.
async function podeAcessarCliente(clienteId: string, usuario: Usuario): Promise<boolean> {
  let consulta = supabaseServer.from('clientes').select('id').eq('id', clienteId);
  if (usuario.papel !== 'administrador') {
    consulta = consulta.eq('criado_por_id', usuario.id);
  }
  const { data, error } = await consulta.maybeSingle();
  if (error) throw error;
  return !!data;
}

// Checa o diagnóstico E o cliente vinculado antes de acessar avaliações.
async function diagnosticoPermitido(id: string, usuario: Usuario) {
  const { data, error } = await supabaseServer
    .from('diagnosticos').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (!(await podeAcessarCliente(data.cliente_id, usuario))) return null;
  return data;
}

function falha(res: Response, erro: unknown, mensagem: string) {
  console.error(`[Lumos Pro] ${mensagem}:`, erro);
  res.status(500).json({ error: mensagem });
}

// GET /api/diagnosticos?cliente_id=...
diagnosticosRouter.get('/', async (req, res) => {
  const usuario = usuarioDaRequisicao(req, res);
  if (!usuario) return;
  try {
    const clienteId = req.query.cliente_id;
    if (clienteId !== undefined && typeof clienteId !== 'string') {
      res.status(400).json({ error: 'cliente_id inválido.' }); return;
    }
    // O join interno limita a listagem aos clientes do auditor NO BANCO.
    if (usuario.papel === 'auditor') {
      let consulta = supabaseServer
        .from('diagnosticos')
        .select('*, clientes!inner(criado_por_id)')
        .eq('clientes.criado_por_id', usuario.id);
      if (clienteId) consulta = consulta.eq('cliente_id', clienteId);
      const { data, error } = await consulta.order('data_referencia', { ascending: false });
      if (error) throw error;
      res.json((data ?? []).map(({ clientes: _cliente, ...diagnostico }: any) => diagnostico));
      return;
    }
    let consulta = supabaseServer.from('diagnosticos').select('*');
    if (clienteId) consulta = consulta.eq('cliente_id', clienteId);
    const { data, error } = await consulta.order('data_referencia', { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (erro) { falha(res, erro, 'Erro ao listar diagnósticos.'); }
});

// GET /api/diagnosticos/:id
diagnosticosRouter.get('/:id', async (req, res) => {
  const usuario = usuarioDaRequisicao(req, res);
  if (!usuario) return;
  try {
    const diagnostico = await diagnosticoPermitido(req.params.id, usuario);
