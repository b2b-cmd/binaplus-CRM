-- F1: SELECT must be governed only by the read policy. Split FOR ALL write policies.
drop policy if exists tickets_write on public.tickets;
create policy tickets_insert on public.tickets for insert to authenticated with check (true);
create policy tickets_update on public.tickets for update to authenticated
  using (public.is_manager() or assigned_rep = public.current_rep_id() or assigned_rep is null) with check (true);
create policy tickets_delete on public.tickets for delete to authenticated
  using (public.is_manager() or assigned_rep = public.current_rep_id() or assigned_rep is null);

drop policy if exists people_write on public.people;
create policy people_insert on public.people for insert to authenticated with check (true);
create policy people_update on public.people for update to authenticated
  using (public.is_manager() or assigned_sales_rep = public.current_rep_id() or assigned_sales_rep is null) with check (true);
create policy people_delete on public.people for delete to authenticated
  using (public.is_manager() or assigned_sales_rep = public.current_rep_id() or assigned_sales_rep is null);
