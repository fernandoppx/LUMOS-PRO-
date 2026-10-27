import { supabaseServer } from './supabase';

async function testConnection() {
  console.log('----------------------------------------------------');
  console.log('Iniciando teste de conexão exclusiva do servidor...');
  console.log('URL:', process.env.SUPABASE_URL);
  console.log('Chave Secreta configurada:', process.env.SUPABASE_SECRET_KEY ? 'Sim (sb_secret_***)' : 'Não');
  console.log('----------------------------------------------------');

  try {
    // 1. Teste exclusivo de leitura na tabela 'clientes' (sem alterar/excluir dados)
    console.log('\n[1/3] Testando leitura na tabela "clientes"...');
    const clientesRes = await supabaseServer
      .from('clientes')
      .select('*', { count: 'exact' })
      .limit(5);

    if (clientesRes.error) {
      console.error('❌ Erro ao ler tabela "clientes":', {
        message: clientesRes.error.message,
        details: clientesRes.error.details,
        hint: clientesRes.error.hint,
        code: clientesRes.error.code,
      });
    } else {
      console.log('✅ Conexão bem-sucedida com a tabela "clientes"!');
      console.log(`   Total de registros existentes: ${clientesRes.count ?? clientesRes.data?.length ?? 0}`);
      if (clientesRes.data && clientesRes.data.length > 0) {
        console.log('   Exemplo de registro encontrado (somente leitura):', {
          id: clientesRes.data[0].id,
          nome: clientesRes.data[0].nome,
          segmento: clientesRes.data[0].segmento,
        });
      } else {
        console.log('   Tabela está vazia e pronta para receber novos clientes.');
      }
    }

    // 2. Teste de leitura na tabela 'diagnosticos'
    console.log('\n[2/3] Testando leitura na tabela "diagnosticos"...');
    const diagRes = await supabaseServer
      .from('diagnosticos')
      .select('id, cliente_id, data_referencia, status', { count: 'exact' })
      .limit(1);

    if (diagRes.error) {
      console.error('⚠️ Aviso/Erro na tabela "diagnosticos":', diagRes.error.message);
    } else {
      console.log('✅ Conexão bem-sucedida com a tabela "diagnosticos"!');
      console.log(`   Total de registros existentes: ${diagRes.count ?? diagRes.data?.length ?? 0}`);
    }

    // 3. Teste de leitura na tabela 'avaliacoes'
    console.log('\n[3/3] Testando leitura na tabela "avaliacoes"...');
    const avalRes = await supabaseServer
      .from('avaliacoes')
      .select('id, diagnostico_id, criterio_id, nota', { count: 'exact' })
      .limit(1);

    if (avalRes.error) {
      console.error('⚠️ Aviso/Erro na tabela "avaliacoes":', avalRes.error.message);
    } else {
      console.log('✅ Conexão bem-sucedida com a tabela "avaliacoes"!');
      console.log(`   Total de registros existentes: ${avalRes.count ?? avalRes.data?.length ?? 0}`);
    }

    console.log('\n----------------------------------------------------');
    console.log('Resultado Geral do Teste:');
    if (!clientesRes.error && !diagRes.error && !avalRes.error) {
      console.log('STATUS: CONEXÃO 100% OPERACIONAL E TABELAS VALIDADAS NO BACKEND.');
    } else if (!clientesRes.error) {
      console.log('STATUS: Conexão com "clientes" validada, verifique mensagens acima para as outras tabelas.');
    } else {
      console.log('STATUS: Falha na conexão ou leitura.');
    }
    console.log('----------------------------------------------------');
  } catch (err: unknown) {
    console.error('❌ Exceção inesperada durante o teste de conexão:', err);
  }
}

testConnection();
