
import type {
  Request,
  Response,
  NextFunction
} from 'express';

import { supabase } from '../supabase';

export type LumosRole = 'administrador' | 'auditor';

export interface LumosUser {
  id: string;
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

  if (item.count >= 180) {
    res.status(429).json({
      error: 'Limite de requisições atingido.'
    });
    return;
  }

  item.count++;
  next();
}

// Validação de identidade e perfil
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
        error: 'Autenticação necessária.'
      });
      return;
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      res.status(401).json({
        error: 'Token ausente.'
      });
      return;
    }

    // Validar token no Supabase Auth
    const { data, error } =
      await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({
        error: 'Sessão inválida ou expirada.'
      });
      return;
    }

    // Consultar perfil salvo no banco
    const { data: perfil, error: perfilError } =
      await supabase
        .from('perfis')
        .select('papel')
        .eq('id', data.user.id)
        .single();

    if (perfilError) {
      console.error(
        '[Lumos] Falha ao consultar perfil:',
        perfilError.message
      );

      res.status(503).json({
        error: 'Não foi possível verificar as permissões.'
      });
      return;
    }

    if (
      !perfil ||
      !['administrador', 'auditor'].includes(perfil.papel)
    ) {
      res.status(403).json({
        error: 'Usuário sem perfil autorizado.'
      });
      return;
    }

    req.lumosUser = {
      id: data.user.id,
      email: data.user.email || '',
      papel: perfil.papel as LumosRole
    };

    next();
  } catch (error) {
    console.error(
      '[Lumos] Erro ao validar acesso:',
      error
    );

    res.status(500).json({
      error: 'Falha interna na autenticação.'
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
      error: 'Acesso exclusivo do administrador.'
    });
    return;
  }

  next();
}
