export function buildPagination(query) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, parseInt(query.limit) || 10);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function buildPaginationMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    totalPages:  Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}

export function buildSortOrder(query, allowedFields, defaultField = 'created_at', defaultDir = 'DESC') {
  const field = allowedFields.includes(query.sortBy) ? query.sortBy : defaultField;
  const dir   = ['ASC', 'DESC'].includes((query.sortDir || '').toUpperCase())
    ? query.sortDir.toUpperCase()
    : defaultDir;
  return [[field, dir]];
}
