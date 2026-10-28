import type {
  Request,
  Response,
  NextFunction
} from 'express';

import { supabaseServer } from '../supabase.js';

export type LumosRole = 'administrador' | 'auditor';

export interface LumosUser {
  id: string;
  nome: string;
  email: string;
  papel: LumosRole;
}

declare global {
  namespace Express {
    interface Request {
      lumosUser?: LumosUser;
    }
  }
}

// Emissão de cookie de sessão informativa
export function issueTeamSessionCookie(res?: Response): void {
  if (!res || typeof res.cookie !== 'function') return;
  try {
    res.cookie('lumos_session', 'active', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
  } catch (_e) {
    // Falha silenciosa se cabeçalhos já tiverem sido enviados
  }
}

// Limitação básica de requisições
const requests = new Map<
  string,
  { count: number; resetAt: number }
>();

export function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = req.ip || 'unknown';
  const now = Date.now();

  const item = requests.get(ip);

  if (!item || now >= item.resetAt) {
    requests.set(ip, {
      count: 1,
      resetAt: now + 60000
    });
    next();
    return;
  }

  if (item.count >= 240) {
    res.status(429).json({
      error: 'Limite de requisições atingido. Aguarde um minuto.'
    });
    return;
  }

  item.count++;
  next();
}

// Validação de identidade e perfil real no Supabase Auth + tabela perfis
export async function requireTeamAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authorization = req.headers.authorization;

    if (
      !authorization ||
      !authorization.startsWith('Bearer ')
    ) {
      res.status(401).json({
        error: 'Autenticação necessária. Faça login para continuar.'
      });
      return;
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      res.status(401).json({
        error: 'Token de acesso ausente.'
      });
      return;
    }

    // Validar token no Supabase Auth
    const { data, error } =
      await supabaseServer.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({
        error: 'Sessão inválida ou expirada. Entre novamente.'
      });
      return;
    }

    // Consultar perfil salvo no banco
    const { data: perfil, error: perfilError } =
      await supabaseServer
        .from('perfis')
        .select('id, nome, email, papel')
        .eq('id', data.user.id)
        .maybeSingle();

    if (perfilError) {
      console.error(
        '[Lumos] Falha ao consultar perfil:',
        perfilError.message
      );
      res.status(503).json({
        error: 'Não foi possível verificar permissões no banco de dados.'
      });
      return;
    }

    const metaNome =
      data.user.user_metadata?.nome ||
      data.user.user_metadata?.full_name ||
      '';

    let papel: LumosRole = 'auditor';
    let nome: string = perfil?.nome || metaNome || data.user.email?.split('@')[0] || '';

    if (perfil && (perfil.papel === 'administrador' || perfil.papel === 'auditor')) {
      papel = perfil.papel as LumosRole;

      // Se o perfil existe no banco mas ainda não tem nome preenchido e metadata tem nome, atualiza
      if (!perfil.nome && metaNome) {
        try {
          await supabaseServer
            .from('perfis')
            .update({ nome: metaNome })
            .eq('id', data.user.id);
        } catch (_e) {
          // falha silenciosa
        }
        nome = metaNome;
      }
    } else if (!perfil) {
      // Se ainda não existir registro em perfis (ex: trigger recém executado ou novo cadastro),
      // provisiona o registro como auditor de forma resiliente
      const { data: novoPerfil } = await supabaseServer
        .from('perfis')
        .insert({
          id: data.user.id,
          email: data.user.email || '',
          nome: metaNome || data.user.email?.split('@')[0] || 'Auditor',
          papel: 'auditor'
        })
        .select('id, nome, papel')
        .maybeSingle();

      if (novoPerfil?.papel === 'administrador' || novoPerfil?.papel === 'auditor') {
        papel = novoPerfil.papel as LumosRole;
      }
      if (novoPerfil?.nome) {
        nome = novoPerfil.nome;
      }
    }

    req.lumosUser = {
      id: data.user.id,
      nome,
      email: data.user.email || '',
      papel
    };

    next();
  } catch (error) {
    console.error(
      '[Lumos] Erro interno na autenticação:',
      error
    );

    res.status(500).json({
      error: 'Falha interna na autenticação do servidor.'
    });
  }
}

// Restringir endpoints exclusivos do administrador
export function requireAdministrator(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (
    !req.lumosUser ||
    req.lumosUser.papel !== 'administrador'
  ) {
    res.status(403).json({
      error: 'Acesso restrito ao perfil Administrador.'
    });
    return;
  }

  next();
}
