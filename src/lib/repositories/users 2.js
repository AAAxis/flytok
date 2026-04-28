import { base44 } from '@/api/base44Client';

const E = base44.entities.User;

export const users = {
  list: (sort, limit) => E.list(sort, limit),
  filter: (query, sort, limit) => E.filter(query, sort, limit),
};
