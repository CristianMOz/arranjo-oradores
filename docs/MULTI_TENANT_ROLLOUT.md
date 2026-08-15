# Implantação multi-congregação

## Estado preservado

A migração transforma a base existente na congregação inicial `alto-da-colina`. Nenhuma tabela atual é apagada e os IDs existentes permanecem iguais.

## Ordem segura de implantação

1. Gerar um backup/snapshot do projeto Supabase `Arranjo-oradores`.
2. Publicar a branch em Preview e criar a primeira conta pelo novo login.
3. Aplicar `20260814111500_multi_tenant_foundation.sql` no banco.
4. Vincular a primeira conta à congregação inicial e torná-la administradora da plataforma:

```sql
with selected_user as (
  select id from auth.users where lower(email) = lower('EMAIL_DO_ADMIN')
), selected_tenant as (
  select id from public.tenants where slug = 'alto-da-colina'
)
insert into public.tenant_memberships (tenant_id, user_id, role)
select selected_tenant.id, selected_user.id, 'owner'
from selected_tenant cross join selected_user;

insert into public.platform_admins (user_id)
select id from auth.users where lower(email) = lower('EMAIL_DO_ADMIN');
```

5. Confirmar que a conta enxerga somente `alto-da-colina`.
6. Usar a aba **Admin** para criar uma segunda congregação e definir o e-mail do responsável.
7. Entrar com a conta da segunda congregação e validar que nenhum registro da primeira é visível.
8. Rodar os advisors de segurança e desempenho do Supabase.
9. Publicar a mesma versão em produção.

## Opções de cópia

- Esboços são sempre copiados, mas a data de último uso começa vazia.
- Oradores e temas podem ser copiados; esta opção inclui celular.
- Congregações de contato podem ser copiadas; esta opção inclui contato, telefone e endereço.
- Histórico de visitantes e saídas é opcional e vem desmarcado por padrão.

## Validação obrigatória

- Usuário sem vínculo não acessa dados.
- `viewer` apenas lê.
- `editor` lê e altera, mas não exclui.
- `owner` e `admin` podem excluir registros da própria congregação.
- Nenhuma função cliente utiliza chave `service_role`.
- Uma mutação com `tenant_id` de outra congregação é rejeitada pelo RLS.
