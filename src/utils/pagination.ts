/**
 * Aritmética de paginação em um só lugar: as páginas e o componente
 * `Pagination` derivavam a mesma fórmula por conta própria, então um ajuste no
 * fatiamento só valia para o arquivo editado.
 */
export function pageBounds(totalItems: number, pageSize: number, requestedPage: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return { totalPages, page: Math.min(requestedPage, totalPages) };
}

/** Recorte da página pedida, já com a página normalizada ao total disponível. */
export function paginate<T>(items: T[], pageSize: number, requestedPage: number) {
  const { totalPages, page } = pageBounds(items.length, pageSize, requestedPage);
  const start = (page - 1) * pageSize;
  return { totalPages, page, items: items.slice(start, start + pageSize) };
}
