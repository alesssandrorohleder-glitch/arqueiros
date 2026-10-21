/**
 * Configuração das contas online (Supabase).
 *
 * Coloque os dados do projeto Supabase (Project Settings → API) em variáveis de
 * ambiente no serviço de hospedagem, ou num arquivo .env na raiz para testar:
 *
 *   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...   (a chave "anon"/"publishable" — é pública)
 *
 * NUNCA coloque a chave "service_role"/"secret" aqui.
 * Sem esses dados, as contas ficam salvas só neste navegador (contas locais).
 * Passo a passo no README (seção "Contas online").
 */
export const ONLINE = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
};

export const onlineEnabled = () => !!(ONLINE.supabaseUrl && ONLINE.supabaseAnonKey);
